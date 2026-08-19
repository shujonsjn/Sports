export default async function handler(req, res) {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'Missing path parameter' });
    try {
        const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/${path}`, {
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
