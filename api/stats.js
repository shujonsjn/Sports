export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const team1 = req.query.team1 || '';
    const team2 = req.query.team2 || '';
    const sport = req.query.sport || 'football';

    if (!team1 && !team2) {
        return res.status(400).json({ error: 'Team names required' });
    }

    const sportMap = {
        'football': { sport: 'soccer', leagues: ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'usa.1', 'ned.1', 'por.1', 'tur.1', 'bra.1', 'arg.1', 'mex.1', 'uefa.champions', 'uefa.europa', 'nz.1', 'aus.1', 'chn.1'] },
        'cricket': { sport: 'cricket', leagues: ['icc.t20i', 'icc.odi', 'icc.test', 'ind IPL'] },
        'basketball': { sport: 'basketball', leagues: ['nba', 'wnba'] },
        'nfl': { sport: 'football', leagues: ['nfl'] },
        'tennis': { sport: 'tennis', leagues: ['atp'] },
        'mma': { sport: 'mma', leagues: ['ufc'] },
        'ufc': { sport: 'mma', leagues: ['ufc'] }
    };

    const cfg = sportMap[sport] || sportMap['football'];
    const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const lg of cfg.leagues) {
        try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${lg}/scoreboard`;
            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(8000)
            });
            if (!r.ok) continue;
            const data = await r.json();
            const events = data.events || [];

            for (const ev of events) {
                const comp = ev.competitions?.[0];
                if (!comp) continue;
                const home = comp.competitors?.find(c => c.homeAway === 'home');
                const away = comp.competitors?.find(c => c.homeAway === 'away');
                if (!home || !away) continue;

                const hName = norm(home.team?.shortDisplayName || home.team?.displayName);
                const aName = norm(away.team?.shortDisplayName || away.team?.displayName);
                const t1n = norm(team1);
                const t2n = norm(team2);

                if ((hName.includes(t1n) || t1n.includes(hName)) && (aName.includes(t2n) || t2n.includes(aName))) {
                    const stats = [];
                    const homeStats = home.statistics || [];
                    const awayStats = away.statistics || [];

                    for (let i = 0; i < homeStats.length; i++) {
                        const hs = homeStats[i];
                        const as = awayStats[i];
                        if (hs && as) {
                            stats.push({
                                name: hs.name || hs.displayName || `Stat ${i+1}`,
                                home: hs.displayValue || hs.value || '0',
                                away: as.displayValue || as.value || '0'
                            });
                        }
                    }

                    if (stats.length === 0 && comp.details) {
                        const detailStats = {};
                        comp.details.forEach(d => {
                            if (d.home && d.away) {
                                const name = d.type?.text || d.type?.name || '';
                                if (name) {
                                    if (!detailStats[name]) detailStats[name] = { home: 0, away: 0 };
                                    if (d.home.score !== undefined) detailStats[name].home++;
                                    if (d.away.score !== undefined) detailStats[name].away++;
                                }
                            }
                        });
                        Object.entries(detailStats).forEach(([name, val]) => {
                            stats.push({ name, home: String(val.home), away: String(val.away) });
                        });
                    }

                    if (stats.length === 0) {
                        const possession = comp.probabilities || [];
                        if (possession.length >= 2) {
                            stats.push({ name: 'Win Probability', home: `${Math.round((possession[0]?.gameProjection || 0) * 100)}%`, away: `${Math.round((possession[1]?.gameProjection || 0) * 100)}%` });
                        }
                    }

                    const statusType = comp.status?.type?.name || ev.status?.type?.name || '';
                    const statusText = comp.status?.type?.detail || '';

                    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
                    return res.status(200).json({
                        stats,
                        status: statusType === 'STATUS_IN_PROGRESS' ? 'live' : statusType === 'STATUS_FINAL' ? 'finished' : 'upcoming',
                        statusText,
                        homeTeam: { name: home.team?.shortDisplayName || home.team?.displayName, score: home.score },
                        awayTeam: { name: away.team?.shortDisplayName || away.team?.displayName, score: away.score }
                    });
                }
            }
        } catch (e) {
            console.error(`Stats fetch error for league ${lg}:`, e.message);
            continue;
        }
    }

    return res.status(200).json({ stats: [], status: 'unknown', message: 'Match not found' });
}
