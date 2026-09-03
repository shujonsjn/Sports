// Central /api/matches — single source of truth for all match data.
// Frontend MUST consume this endpoint. No direct provider orchestration.
//
// Architecture:
//   Request → Validate → Fetch providers (direct imports, no HTTP) →
//   Normalize → Score validation → Provider priority → Deduplication →
//   Persist to KV → Apply admin overrides → Cache → Respond

import {
    getCachedMatches, setCachedMatches, getAllOverrides, getAllCustoms,
    persistMatch, getPersistedMatch, invalidateMatchCache
} from './_lib/storage.js';
import { setCors, errorResponse } from './_lib/response.js';
import { getTodayString, isValidDateString } from './_lib/date.js';
import { fetchESPN } from './providers/espn.js';
import { fetchSportScore } from './providers/sportscore.js';
import { fetchSportsRC } from './providers/sportsrc.js';
import { fetchNFLData } from './providers/nfldata.js';
import { fetchESPNCricket, fetchCricketData } from './providers/cricket.js';
import { fetchTheSportsDB } from './providers/thesportsdb.js';

// Provider priority per sport — primary first, fallbacks in order
const PROVIDER_PRIORITY = {
    football: ['sportscore', 'espn', 'sportsrc'],
    cricket: ['espn_cricket', 'cricketdata'],
    basketball: ['sportscore', 'espn'],
    nfl: ['nfldata', 'espn'],
    tennis: ['sportscore'],
    mma: ['thesportsdb'],
    ufc: ['thesportsdb']
};

function normalizeTeamName(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function hasScore(v) {
    return v !== null && v !== undefined && v !== '' && v !== '-';
}

function validateScore(score) {
    if (!score) return { team1: null, team2: null };
    return {
        team1: hasScore(score.team1) ? String(score.team1) : null,
        team2: hasScore(score.team2) ? String(score.team2) : null
    };
}

function mergeMatchScores(existing, incoming) {
    if (!existing || !incoming) return existing || incoming;
    const merged = { ...existing };
    // Only upgrade scores — never overwrite real score with null/empty
    if (hasScore(incoming.score?.team1) && !hasScore(existing.score?.team1)) {
        merged.score = { ...merged.score, team1: incoming.score.team1 };
    }
    if (hasScore(incoming.score?.team2) && !hasScore(existing.score?.team2)) {
        merged.score = { ...merged.score, team2: incoming.score.team2 };
    }
    // Status transitions: upcoming→live→finished (never regress)
    if (incoming.status === 'live' && merged.status !== 'finished') merged.status = 'live';
    else if (incoming.status === 'finished') merged.status = 'finished';
    if (incoming.statusText && incoming.statusText.length > (merged.statusText || '').length) {
        merged.statusText = incoming.statusText;
    }
    if (incoming.overs) merged.overs = { ...merged.overs, ...incoming.overs };
    if (incoming.team1?.logo && !merged.team1?.logo) merged.team1 = { ...merged.team1, logo: incoming.team1.logo };
    if (incoming.team2?.logo && !merged.team2?.logo) merged.team2 = { ...merged.team2, logo: incoming.team2.logo };
    return merged;
}

function makeMatchKey(m) {
    return `${normalizeTeamName(m.team1?.name)}_vs_${normalizeTeamName(m.team2?.name)}_${m.date}`;
}

function applyProviderPriority(matches, sport) {
    const priority = PROVIDER_PRIORITY[sport] || [];
    const byKey = new Map();
    for (const m of matches) {
        const key = makeMatchKey(m);
        const reverseKey = `${normalizeTeamName(m.team2?.name)}_vs_${normalizeTeamName(m.team1?.name)}_${m.date}`;
        const existingKey = byKey.has(key) ? key : byKey.has(reverseKey) ? reverseKey : null;
        if (existingKey) {
            const existing = byKey.get(existingKey);
            const existingPriority = priority.indexOf(existing.source);
            const newPriority = priority.indexOf(m.source);
            // Lower index = higher priority
            if (newPriority !== -1 && (existingPriority === -1 || newPriority < existingPriority)) {
                byKey.set(existingKey, mergeMatchScores(m, existing));
            } else {
                byKey.set(existingKey, mergeMatchScores(existing, m));
            }
        } else {
            byKey.set(key, m);
        }
    }
    return [...byKey.values()];
}

// Fetch from a provider with fallback chain
async function fetchWithFallback(sport, dateStr) {
    const providers = PROVIDER_PRIORITY[sport] || [];
    const allMatches = [];

    for (const provider of providers) {
        try {
            let matches = [];
            switch (provider) {
                case 'espn': matches = await fetchESPN(sport, dateStr); break;
                case 'sportscore': matches = await fetchSportScore(sport, dateStr); break;
                case 'sportsrc': matches = await fetchSportsRC(sport, dateStr); break;
                case 'nfldata': matches = await fetchNFLData(dateStr); break;
                case 'espn_cricket': matches = await fetchESPNCricket(dateStr); break;
                case 'cricketdata': matches = await fetchCricketData(dateStr); break;
                case 'thesportsdb': matches = await fetchTheSportsDB(sport, dateStr); break;
            }
            // Tag each match with its source
            matches.forEach(m => { m.source = provider; m.sport = sport; });
            allMatches.push(...matches);

            // If primary provider returned results, use them (with fallback supplementation)
            if (provider === providers[0] && matches.length > 0) break;
        } catch (e) {
            console.error(`[matches] ${provider} for ${sport} failed:`, e.message);
        }
    }

    // Apply provider priority within the sport
    return applyProviderPriority(allMatches, sport);
}

export default async function handler(req, res) {
    setCors(res, req);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { date, live, sport } = req.query || {};
    const targetDate = date || getTodayString();

    if (!isValidDateString(targetDate)) {
        return errorResponse(res, 400, 'Invalid date format. Use YYYY-MM-DD.');
    }

    try {
        // 1. Check server-side cache
        const cacheKey = `${targetDate}_${sport || 'all'}`;
        const cached = await getCachedMatches(targetDate, sport || 'all');
        if (cached && !live) {
            return res.status(200).json({ matches: cached, date: targetDate, count: cached.length, cached: true });
        }

        // 2. Determine which sports to fetch
        const sportsToFetch = sport ? [sport] : ['football', 'cricket', 'basketball', 'nfl', 'tennis', 'mma', 'ufc'];

        // 3. Fetch from providers using fallback chains (in parallel per sport)
        const sportPromises = sportsToFetch.map(s => fetchWithFallback(s, targetDate));
        const sportResults = await Promise.allSettled(sportPromises);

        // 4. Collect all matches
        let allMatches = [];
        for (const result of sportResults) {
            if (result.status === 'fulfilled') {
                allMatches.push(...result.value);
            }
        }

        // 5. Generate stable IDs for matches without external IDs
        allMatches.forEach(m => {
            if (!m.id) {
                m.id = `${m.source}_${normalizeTeamName(m.team1?.name)}_${normalizeTeamName(m.team2?.name)}_${m.date}`;
            }
            // Validate scores
            m.score = validateScore(m.score);
        });

        // 6. Persist scores to KV (survives cold starts)
        for (const m of allMatches) {
            try {
                const existing = await getPersistedMatch(m.id);
                // Only persist if we have a real score to store, or this is a new match
                if (hasScore(m.score?.team1) || hasScore(m.score?.team2) || !existing) {
                    await persistMatch(m);
                } else if (existing) {
                    // Merge stored score into current data (score persistence)
                    if (hasScore(existing.score?.team1)) m.score.team1 = existing.score.team1;
                    if (hasScore(existing.score?.team2)) m.score.team2 = existing.score.team2;
                    if (existing.status === 'finished') m.status = 'finished';
                    if (existing.innings) m.innings = existing.innings;
                }
            } catch (e) {
                console.error(`[matches] persist failed for ${m.id}:`, e.message);
            }
        }

        // 7. Apply admin overrides from persistent storage
        try {
            const overrides = await getAllOverrides();
            const customs = await getAllCustoms();

            allMatches = allMatches.map(m => {
                const o = overrides[m.id];
                if (o) {
                    if (o._deleted) return null;
                    return {
                        ...m,
                        ...(o.team1 ? { team1: { ...m.team1, ...o.team1 } } : {}),
                        ...(o.team2 ? { team2: { ...m.team2, ...o.team2 } } : {}),
                        ...(o.score ? { score: o.score } : {}),
                        ...(o.status ? { status: o.status } : {}),
                        ...(o.league ? { league: o.league } : {}),
                        ...(o.venue ? { venue: o.venue } : {}),
                        ...(o.result ? { result: o.result } : {}),
                        ...(o.time ? { time: o.time } : {}),
                        ...(o.overs ? { overs: o.overs } : {})
                    };
                }
                return m;
            }).filter(Boolean);

            // Add custom matches for this date
            for (const c of customs) {
                if (c.date === targetDate && !allMatches.find(x => x.id === c.id)) {
                    allMatches.push(c);
                }
            }
        } catch (e) {
            console.error('[matches] Failed to apply admin overrides:', e.message);
        }

        // 8. Filter by live if requested
        if (live === 'true') {
            allMatches = allMatches.filter(m => m.status === 'live');
        }

        // 9. Cache and respond
        await setCachedMatches(targetDate, allMatches, sport || 'all');

        return res.status(200).json({
            matches: allMatches,
            date: targetDate,
            count: allMatches.length,
            cached: false
        });
    } catch (e) {
        console.error('[matches] Handler error:', e);
        return errorResponse(res, 500, 'Internal server error');
    }
}
