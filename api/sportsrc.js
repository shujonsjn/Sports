export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const category = req.query.category || 'football';
    try {
        const r = await fetch(`https://api.sportsrc.org/?data=matches&category=${category}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) return res.status(r.status).json({ error: `Upstream ${r.status}` });
        const data = await r.json();
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
