export default async function handler(req, res) {
    const category = req.query.category || 'football';
    try {
        const r = await fetch(`https://api.sportsrc.org/?data=matches&category=${category}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!r.ok) return res.status(r.status).json({ error: `Upstream ${r.status}` });
        const data = await r.json();
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
