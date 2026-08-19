export default async function handler(req, res) {
    const season = req.query.season || '2026';
    const seasonType = req.query.season_type || '2';
    try {
        const r = await fetch(`https://api.nfldata.org/v1/games?season=${season}&season_type=${seasonType}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!r.ok) return res.status(r.status).json({ error: `Upstream ${r.status}` });
        const data = await r.json();
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
