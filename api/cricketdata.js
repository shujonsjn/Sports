export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const k = Math.floor(new Date().getTime() / 5000);
        const r = encodeURIComponent('https://live-streaming-eta.vercel.app/');
        const url = `https://cricketdata.org/apis/prepmatchlist.aspx?k=${k}&r=${r}`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
        });
        
        if (!response.ok) {
            return res.status(502).json({ error: 'Upstream error', status: response.status });
        }
        
        const raw = await response.json();
        const data = raw.value || raw;
        
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
