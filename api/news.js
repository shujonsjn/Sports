function decodeEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
}

function extractCDATA(str) {
    const m = str.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
    return m ? m[1] : str;
}

function extractUrl(str) {
    const cleaned = decodeEntities(extractCDATA(str));
    const hrefMatch = cleaned.match(/href="([^"]+)"/);
    if (hrefMatch) return hrefMatch[1];
    const httpMatch = cleaned.match(/https?:\/\/[^\s<"']+/);
    if (httpMatch) return httpMatch[0];
    return cleaned.trim();
}

function cleanText(str) {
    let s = decodeEntities(extractCDATA(str));
    s = s.replace(/<[^>]*>/g, '');
    return s.trim();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const team1 = req.query.team1 || '';
    const team2 = req.query.team2 || '';
    const sport = req.query.sport || '';

    if (!team1 && !team2) {
        return res.status(400).json({ error: 'At least one team name required' });
    }

    const query = [team1, team2, sport, 'sports'].filter(Boolean).join(' ');
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;

    try {
        const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(10000)
        });
        if (!r.ok) throw new Error(`Google News RSS returned ${r.status}`);

        const xml = await r.text();
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;

        while ((match = itemRegex.exec(xml)) && count < 10) {
            const block = match[1];
            const title = cleanText((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
            const linkRaw = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
            const link = extractUrl(linkRaw);
            const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
            const source = cleanText((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '');

            if (title && link && link.startsWith('http')) {
                items.push({ title, link, pubDate, source });
                count++;
            }
        }

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json({ news: items });
    } catch (e) {
        return res.status(200).json({ news: [], error: e.message });
    }
}
