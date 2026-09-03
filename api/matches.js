// Central /api/matches — single source of truth for all match data.
// Frontend MUST consume this endpoint. No direct provider orchestration.
//
// Architecture:
//   Request → Validate → Fetch providers (absolute URLs) → Normalize →
//   Score validation → Apply admin overrides → Cache → Respond
//
// Provider priority per sport:
//   football:  ESPN → SportScore → SportsRC
//   cricket:   ESPN Cricket → CricketData → TheSportsDB
//   basketball: ESPN → SportScore
//   nfl:       ESPN → NFLData
//   tennis:    SportScore
//   mma/ufc:   TheSportsDB

import { getCachedMatches, setCachedMatches, getAllOverrides, getAllCustoms } from './_lib/storage.js';
import { setCors, errorResponse } from './_lib/response.js';
import { getTodayString, isValidDateString, toESPNDate } from './_lib/date.js';

const SITE_URL = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.SITE_URL || 'https://live-streaming-eta.vercel.app';

const PROVIDER_PRIORITY = {
    football: ['espn', 'sportscore', 'sportsrc'],
    cricket: ['espn_cricket', 'cricketdata', 'thesportsdb'],
    basketball: ['espn', 'sportscore'],
    nfl: ['espn', 'nfldata'],
    tennis: ['sportscore'],
    mma: ['thesportsdb'],
    ufc: ['thesportsdb']
};

const TIMEOUT_MS = 10000;

function normalizeTeamName(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function makeStableId(source, externalId, team1, team2, date) {
    if (externalId) return `${source}_${externalId}`;
    const t1 = normalizeTeamName(team1);
    const t2 = normalizeTeamName(team2);
    return `${source}_${date}_${t1}_vs_${t2}`;
}

function validateScore(score) {
    if (!score) return { team1: null, team2: null };
    const isValid = (v) => v !== undefined && v !== null && v !== '' && v !== '-';
    return {
        team1: isValid(score.team1) ? String(score.team1) : null,
        team2: isValid(score.team2) ? String(score.team2) : null
    };
}

function mergeMatchScores(existing, incoming) {
    if (!existing || !incoming) return existing || incoming;
    const hasScore = (v) => v !== null && v !== undefined && v !== '-' && v !== '';
    const merged = { ...existing };
    if (hasScore(incoming.score?.team1) && !hasScore(existing.score?.team1)) {
        merged.score = { ...merged.score, team1: incoming.score.team1 };
    }
    if (hasScore(incoming.score?.team2) && !hasScore(existing.score?.team2)) {
        merged.score = { ...merged.score, team2: incoming.score.team2 };
    }
    if (incoming.status === 'live') merged.status = 'live';
    else if (incoming.status === 'finished' && merged.status === 'upcoming') merged.status = 'finished';
    if (incoming.statusText && incoming.statusText.length > (merged.statusText || '').length) {
        merged.statusText = incoming.statusText;
    }
    if (incoming.overs) merged.overs = { ...merged.overs, ...incoming.overs };
    return merged;
}

// --- Internal provider fetchers (absolute URLs) ---

async function fetchProvider(url, label) {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers: { 'User-Agent': 'SportsLive/1.0' }
        });
        if (!res.ok) {
            console.error(`[matches] ${label} HTTP ${res.status}`);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.error(`[matches] ${label} failed:`, e.message);
        return null;
    }
}

async function fetchESPN(sport, dateStr) {
    const espnDate = toESPNDate(dateStr);
    const data = await fetchProvider(
        `${SITE_URL}/api/espn-scores?sport=${sport}&date=${espnDate}`,
        `ESPN-${sport}`
    );
    return (data?.matches || []).map(m => ({
        ...m,
        source: 'espn',
        _externalId: m.id
    }));
}

async function fetchESPNCricket(dateStr) {
    const data = await fetchProvider(
        `${SITE_URL}/api/google-cricket?date=${dateStr}`,
        'ESPN-Cricket'
    );
    const leagues = data?.sports?.[0]?.leagues || [];
    const matches = [];
    for (const league of leagues) {
        for (const ev of (league.events || [])) {
            const competitors = ev.competitors || [];
            const state = ev.fullStatus?.type?.state || '';
            matches.push({
                id: `espn_crick_${ev.id}`,
                _externalId: ev.id,
                source: 'espn_cricket',
                sport: 'cricket',
                team1: {
                    name: competitors[0]?.displayName || competitors[0]?.name || 'TBA',
                    short: competitors[0]?.abbreviation || '',
                    logo: competitors[0]?.logo || '',
                    flag: ''
                },
                team2: {
                    name: competitors[1]?.displayName || competitors[1]?.name || 'TBA',
                    short: competitors[1]?.abbreviation || '',
                    logo: competitors[1]?.logo || '',
                    flag: ''
                },
                league: league.name || 'Cricket',
                venue: ev.location || '',
                date: ev.date ? new Date(ev.date).toISOString().slice(0, 10) : dateStr,
                time: ev.date ? new Date(ev.date).toISOString().slice(11, 16) : '00:00',
                status: state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming',
                statusText: ev.fullStatus?.type?.description || '',
                score: { team1: null, team2: null },
                overs: { team1: '', team2: '' }
            });
        }
    }
    return matches;
}

async function fetchSportScore(sport, dateStr) {
    const data = await fetchProvider(
        `${SITE_URL}/api/sportscore?sport=${sport}&limit=30`,
        `SportScore-${sport}`
    );
    if (!data?.matches) return [];
    return data.matches
        .filter(m => {
            if (!m.time) return true;
            const matchDate = m.time.split('T')[0];
            return matchDate === dateStr;
        })
        .map(m => ({
            id: m.id || `ss_${sport}_${m.url || ''}`,
            _externalId: m.id || m.url,
            source: 'sportscore',
            sport,
            team1: {
                name: m.home || m.home_team || 'Home',
                short: (m.home || 'HOM').slice(0, 3).toUpperCase(),
                logo: m.home_logo || '',
                flag: ''
            },
            team2: {
                name: m.away || m.away_team || 'Away',
                short: (m.away || 'AWA').slice(0, 3).toUpperCase(),
                logo: m.away_logo || '',
                flag: ''
            },
            league: m.competition || sport,
            venue: m.venue || '',
            date: m.time ? m.time.split('T')[0] : dateStr,
            time: m.time ? new Date(m.time).toISOString().slice(11, 16) : '00:00',
            status: m.status === 'live' ? 'live' : m.status === 'finished' ? 'finished' : 'upcoming',
            statusText: m.status_text || '',
            score: { team1: m.home_score ?? null, team2: m.away_score ?? null }
        }));
}

async function fetchSportsRC(sport, dateStr) {
    const data = await fetchProvider(
        `${SITE_URL}/api/sportsrc?category=${sport}`,
        `SportsRC-${sport}`
    );
    const items = data?.data || data?.items || data || [];
    if (!Array.isArray(items)) return [];
    return items
        .filter(m => {
            const d = m.date ? new Date(m.date).toISOString().slice(0, 10) : '';
            return d === dateStr;
        })
        .map(m => ({
            id: m.id || `src_${sport}_${dateStr}_${m.teams?.home?.name || ''}`,
            _externalId: m.id,
            source: 'sportsrc',
            sport,
            team1: {
                name: m.teams?.home?.name || 'Home',
                short: (m.teams?.home?.name || 'HOM').slice(0, 3).toUpperCase(),
                logo: m.teams?.home?.badge || '',
                flag: ''
            },
            team2: {
                name: m.teams?.away?.name || 'Away',
                short: (m.teams?.away?.name || 'AWA').slice(0, 3).toUpperCase(),
                logo: m.teams?.away?.badge || '',
                flag: ''
            },
            league: m.league?.name || m.tournament?.name || sport,
            venue: m.venue?.name || '',
            date: m.date ? new Date(m.date).toISOString().slice(0, 10) : dateStr,
            time: m.date ? new Date(m.date).toISOString().slice(11, 16) : '00:00',
            status: 'upcoming',
            statusText: 'Scheduled',
            score: { team1: null, team2: null }
        }));
}

async function fetchNFLData(dateStr) {
    const data = await fetchProvider(
        `${SITE_URL}/api/nfldata?season=2026&season_type=2`,
        'NFLData'
    );
    const games = data?.data || [];
    return games
        .filter(g => g.gameday === dateStr)
        .map(g => ({
            id: g.id || `nfl_${g.gameday}_${g.home_team}_${g.away_team}`,
            _externalId: g.id || g.game_id,
            source: 'nfldata',
            sport: 'nfl',
            team1: {
                name: g.home_team || 'Home',
                short: (g.home_team || 'HOM').slice(0, 3).toUpperCase(),
                logo: '',
                flag: ''
            },
            team2: {
                name: g.away_team || 'Away',
                short: (g.away_team || 'AWA').slice(0, 3).toUpperCase(),
                logo: '',
                flag: ''
            },
            league: g.week ? `NFL - Week ${g.week}` : 'NFL',
            venue: g.location || g.venue || '',
            date: g.gameday || dateStr,
            time: g.gametime || '00:00',
            status: g.result ? 'finished' : g.status?.includes('Live') ? 'live' : 'upcoming',
            statusText: g.status || '',
            score: { team1: g.home_score ?? null, team2: g.away_score ?? null }
        }));
}

async function fetchCricketData(dateStr) {
    const data = await fetchProvider(`${SITE_URL}/api/cricketdata`, 'CricketData');
    if (!Array.isArray(data)) return [];
    return data.map(m => {
        const matchDate = m.d ? m.d.split('T')[0] : dateStr;
        let status = 'upcoming';
        if (m.ms === 'live') status = 'live';
        else if (m.ms === 'result') status = 'finished';
        return {
            id: m.id ? `cdorg_${m.id}` : `cdorg_${matchDate}_${m.t1}_${m.t2}`,
            _externalId: m.id,
            source: 'cricketdata',
            sport: 'cricket',
            team1: { name: m.t1n || m.t1 || 'TBA', short: (m.t1 || 'TBA').slice(0, 3).toUpperCase(), logo: m.t1i ? `https://cricketdata.org/iapi/${m.t1i}?w=48` : '', flag: '' },
            team2: { name: m.t2n || m.t2 || 'TBA', short: (m.t2 || 'TBA').slice(0, 3).toUpperCase(), logo: m.t2i ? `https://cricketdata.org/iapi/${m.t2i}?w=48` : '', flag: '' },
            league: m.t || 'Cricket',
            venue: '',
            date: matchDate,
            time: m.d ? new Date(m.d).toISOString().slice(11, 16) : '00:00',
            status,
            statusText: m.s || '',
            score: {
                team1: m.t1s ? m.t1s.replace(/\?/g, '').trim() || null : null,
                team2: m.t2s ? m.t2s.replace(/\?/g, '').trim() || null : null
            }
        };
    }).filter(m => m.date === dateStr);
}

// --- Provider fetch orchestration ---

async function fetchFromProvider(provider, sport, dateStr) {
    switch (provider) {
        case 'espn': return fetchESPN(sport, dateStr);
        case 'espn_cricket': return fetchESPNCricket(dateStr);
        case 'sportscore': return fetchSportScore(sport, dateStr);
        case 'sportsrc': return fetchSportsRC(sport, dateStr);
        case 'nfldata': return fetchNFLData(dateStr);
        case 'cricketdata': return fetchCricketData(dateStr);
        case 'thesportsdb': return []; // UFC/MMA handled separately
        default: return [];
    }
}

function deduplicateMatches(allMatches) {
    const merged = new Map();
    for (const m of allMatches) {
        const key = `${normalizeTeamName(m.team1?.name)}_vs_${normalizeTeamName(m.team2?.name)}_${m.date}`;
        const reverseKey = `${normalizeTeamName(m.team2?.name)}_vs_${normalizeTeamName(m.team1?.name)}_${m.date}`;
        const existingKey = merged.has(key) ? key : merged.has(reverseKey) ? reverseKey : null;
        if (existingKey) {
            merged.set(existingKey, mergeMatchScores(merged.get(existingKey), m));
        } else {
            merged.set(key, m);
        }
    }
    return [...merged.values()];
}

function applyProviderPriority(matches, sport) {
    const priority = PROVIDER_PRIORITY[sport] || [];
    const byKey = new Map();
    for (const m of matches) {
        const key = `${normalizeTeamName(m.team1?.name)}_vs_${normalizeTeamName(m.team2?.name)}_${m.date}`;
        const reverseKey = `${normalizeTeamName(m.team2?.name)}_vs_${normalizeTeamName(m.team1?.name)}_${m.date}`;
        const existingKey = byKey.has(key) ? key : byKey.has(reverseKey) ? reverseKey : null;
        if (existingKey) {
            const existing = byKey.get(existingKey);
            const existingPriority = priority.indexOf(existing.source);
            const newPriority = priority.indexOf(m.source);
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

// --- Main handler ---

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
        const cached = await getCachedMatches(cacheKey);
        if (cached && !live) {
            return res.status(200).json({ matches: cached, date: targetDate, count: cached.length, cached: true });
        }

        // 2. Determine which sports to fetch
        const sportsToFetch = sport ? [sport] : ['football', 'cricket', 'basketball', 'nfl', 'tennis', 'mma', 'ufc'];

        // 3. Fetch from providers in parallel
        const fetchPromises = [];
        for (const s of sportsToFetch) {
            const providers = PROVIDER_PRIORITY[s] || [];
            for (const provider of providers) {
                fetchPromises.push(
                    fetchFromProvider(provider, s, targetDate)
                        .then(matches => ({ sport: s, provider, matches, error: null }))
                        .catch(e => ({ sport: s, provider, matches: [], error: e.message }))
                );
            }
        }

        const results = await Promise.allSettled(fetchPromises);

        // 4. Collect all matches per sport
        const bySport = {};
        for (const s of sportsToFetch) bySport[s] = [];

        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            const { sport: s, provider, matches } = result.value;
            if (!bySport[s]) bySport[s] = [];
            matches.forEach(m => {
                m.source = provider;
                m.sport = s;
                bySport[s].push(m);
            });
        }

        // 5. Apply provider priority and deduplicate per sport
        let allMatches = [];
        for (const s of sportsToFetch) {
            const prioritized = applyProviderPriority(bySport[s], s);
            allMatches.push(...prioritized);
        }

        // 6. Apply admin overrides from persistent storage
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
                        ...(o.time ? { time: o.time } : {})
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

        // 7. Filter by live if requested
        if (live === 'true') {
            allMatches = allMatches.filter(m => m.status === 'live');
        }

        // 8. Cache and respond
        await setCachedMatches(cacheKey, allMatches);

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
