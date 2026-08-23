export default async function handler(req, res) {
    const endpoints = [
        'https://site.api.espn.com/apis/site/v2/sports/cricket/scoreboard',
        'https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&tz=Asia/Calcutta',
        'https://site.api.espn.com/apis/site/v2/sports/cricket/australia/scoreboard',
        'https://site.api.espn.com/apis/site/v2/sports/cricket/england/scoreboard'
    ];
    const allData = { sports: [{ leagues: [] }] };

    for (const url of endpoints) {
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(6000)
            });
            if (!r.ok) continue;
            const data = await r.json();
            const leagues = data?.sports?.[0]?.leagues || [];
            for (const league of leagues) {
                const exists = allData.sports[0].leagues.find(l => l.id === league.id);
                if (!exists) {
                    allData.sports[0].leagues.push(league);
                } else if (league.events) {
                    for (const ev of league.events) {
                        if (!exists.events) exists.events = [];
                        if (!exists.events.find(e => e.id === ev.id)) {
                            exists.events.push(ev);
                        }
                    }
                }
            }
        } catch (e) { continue; }
    }

    const total = allData.sports[0].leagues.reduce((sum, l) => sum + (l.events?.length || 0), 0);
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate');
    return res.status(200).json(allData);
}
