// Central /api/matches — single source of truth for all match data
// Frontend should consume THIS endpoint instead of fetching providers directly.

const PROVIDER_PRIORITY = {
    football: ['espn', 'sportscore', 'sportsrc'],
    cricket: ['espn_cricket', 'cricketdata', 'thesportsdb'],
    basketball: ['espn', 'sportscore'],
    nfl: ['espn', 'nfldata'],
    tennis: ['sportscore'],
    mma: ['thesportsdb'],
    ufc: ['thesportsdb']
};

function normalizeTeam(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function makeMatchId(source, externalId) {
    return `${source}_${externalId}`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { date, live, sport } = req.query || {};
    const targetDate = date || new Date().toISOString().slice(0, 10);

    try {
        const allMatches = [];

        // Fetch from ESPN (primary for football/basketball/nfl)
        const espnSports = sport ? [sport] : ['football', 'basketball', 'nfl'];
        for (const s of espnSports) {
            try {
                const url = `/api/espn-scores?sport=${s}&date=${targetDate.replace(/-/g, '')}`;
                const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
                if (r.ok) {
                    const data = await r.json();
                    (data.matches || []).forEach(m => {
                        m.source = 'espn';
                        allMatches.push(m);
                    });
                }
            } catch {}
        }

        // Fetch cricket
        if (!sport || sport === 'cricket') {
            try {
                const r = await fetch(`/api/google-cricket?date=${targetDate}`, { signal: AbortSignal.timeout(8000) });
                if (r.ok) {
                    const data = await r.json();
                    const leagues = data?.sports?.[0]?.leagues || [];
                    for (const league of leagues) {
                        for (const ev of (league.events || [])) {
                            allMatches.push({
                                id: `espn_crick_${ev.id}`,
                                sport: 'cricket',
                                source: 'espn_cricket',
                                team1: { name: ev.competitors?.[0]?.displayName || 'TBA', logo: ev.competitors?.[0]?.logo || '' },
                                team2: { name: ev.competitors?.[1]?.displayName || 'TBA', logo: ev.competitors?.[1]?.logo || '' },
                                league: league.name || 'Cricket',
                                date: ev.date ? new Date(ev.date).toISOString().slice(0, 10) : targetDate,
                                time: ev.date ? new Date(ev.date).toTimeString().slice(0, 5) : '00:00',
                                status: ev.fullStatus?.type?.state === 'in' ? 'live' : ev.fullStatus?.type?.state === 'post' ? 'finished' : 'upcoming',
                                statusText: ev.fullStatus?.type?.description || '',
                                score: { team1: '-', team2: '-' }
                            });
                        }
                    }
                }
            } catch {}
        }

        // Filter by live if requested
        let result = allMatches;
        if (live === 'true') {
            result = allMatches.filter(m => m.status === 'live');
        }

        return res.status(200).json({ matches: result, date: targetDate, count: result.length });
    } catch (e) {
        return res.status(500).json({ error: e.message, matches: [] });
    }
}
