export default async function handler(req, res) {
    const { teams } = req.query;
    if (!teams) return res.status(400).json({ error: 'Missing teams parameter (comma-separated)' });
    const teamNames = teams.split(',').slice(0, 10);
    const results = {};
    const lookup = async (name) => {
        try {
            const encoded = encodeURIComponent(name);
            const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encoded}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (!r.ok) return;
            const data = await r.json();
            if (data.teams && data.teams[0]?.strBadge) {
                results[name.toLowerCase()] = data.teams[0].strBadge;
            }
        } catch(e) {}
    };
    await Promise.allSettled(teamNames.map(lookup));
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(results);
}
