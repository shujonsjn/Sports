export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const r = await fetch('https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&tz=Asia/Calcutta', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
        });
        if (!r.ok) return res.status(r.status).json({ error: `ESPN ${r.status}` });
        const data = await r.json();
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
