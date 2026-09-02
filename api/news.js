export default async function handler(req, res) {
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
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!r.ok) throw new Error(`Google News RSS returned ${r.status}`);

        const xml = await r.text();
        const items = [];
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        let match;
        let count = 0;

        while ((match = itemRegex.exec(xml)) && count < 10) {
            const block = match[1];
            const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
            const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
            const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
            const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';
            const description = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';

            if (title && link) {
                items.push({
                    title: title.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
                    link: link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
                    pubDate,
                    source: source.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
                    description: description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').trim()
                });
                count++;
            }
        }

        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json({ news: items });
    } catch (e) {
        return res.status(200).json({ news: [], error: e.message });
    }
}
