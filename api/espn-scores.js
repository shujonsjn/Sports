export default async function handler(req, res) {
    const sport = req.query.sport || 'soccer';
    const league = req.query.league || '';
    const date = req.query.date || '';

    const sportMap = {
        'football': { sport: 'soccer', leagues: ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'usa.1', 'ned.1', 'por.1', 'tur.1', 'bra.1', 'arg.1', 'mex.1', 'uefa.champions', 'uefa.europa'] },
        'basketball': { sport: 'basketball', leagues: ['nba', 'wnba'] },
        'nfl': { sport: 'football', leagues: ['nfl'] }
    };

    const cfg = sportMap[sport];
    if (!cfg) return res.status(400).json({ error: 'Unsupported sport' });

    const leagues = league ? [league] : cfg.leagues;
    const allEvents = [];

    for (const lg of leagues) {
        try {
            let url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${lg}/scoreboard`;
            const params = [];
            if (date) params.push(`dates=${date.replace(/-/g, '')}`);
            if (params.length) url += '?' + params.join('&');

            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
            });
            if (!r.ok) continue;
            const data = await r.json();
            const events = data.events || [];
            events.forEach(ev => {
                const comp = ev.competitions?.[0];
                if (!comp) return;
                const home = comp.competitors?.find(c => c.homeAway === 'home');
                const away = comp.competitors?.find(c => c.homeAway === 'away');
                if (!home || !away) return;

                const statusType = comp.status?.type?.name || ev.status?.type?.name || '';
                let status = 'upcoming';
                if (statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME') status = 'live';
                else if (statusType === 'STATUS_FINAL' || statusType === 'STATUS_FULL_TIME') status = 'finished';
                else if (statusType === 'STATUS_POSTPONED') status = 'upcoming';

                const matchDate = ev.date ? new Date(ev.date).toLocaleDateString('en-CA') : '';
                const matchTime = ev.date ? new Date(ev.date).toTimeString().slice(0, 5) : '';

                allEvents.push({
                    id: `espn-${lg}-${ev.id}`,
                    sport: sport,
                    team1: {
                        name: home.team?.shortDisplayName || home.team?.displayName || 'Home',
                        logo: home.team?.logo || '',
                        score: home.score || '-'
                    },
                    team2: {
                        name: away.team?.shortDisplayName || away.team?.displayName || 'Away',
                        logo: away.team?.logo || '',
                        score: away.score || '-'
                    },
                    league: comp.series?.type || ev.league?.slug || lg,
                    venue: comp.venue?.fullName || '',
                    date: matchDate,
                    time: matchTime,
                    status: status,
                    statusText: comp.status?.type?.detail || statusType,
                    score: {
                        team1: home.score || '-',
                        team2: away.score || '-'
                    }
                });
            });
        } catch (e) {}
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json({ matches: allEvents });
}
