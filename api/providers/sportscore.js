// SportScore provider — fetches directly from sportscore.com API.

const TIMEOUT_MS = 10000;

export async function fetchSportScore(sport, dateStr) {
    if (sport === 'mma' || sport === 'ufc') return [];

    try {
        const r = await fetch(`https://sportscore.com/api/widget/matches/?sport=${sport}&limit=30`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!r.ok) return [];

        const data = await r.json();
        const matches = data?.matches || [];

        return matches
            .filter(m => {
                if (!m.time) return true;
                const matchDate = m.time.split('T')[0];
                return matchDate === dateStr;
            })
            .map(m => ({
                id: m.id ? `ss_${sport}_${m.id}` : null,
                externalId: m.id || m.url || null,
                source: 'sportscore',
                sport,
                team1: {
                    name: m.home || m.home_team || 'Home',
                    short: (m.home || 'HOM').slice(0, 3).toUpperCase(),
                    logo: m.home_logo || '',
                    flag: ''
                },
                team2: {
                    name: m.away || m.away_team || 'Away',
                    short: (m.away || 'AWA').slice(0, 3).toUpperCase(),
                    logo: m.away_logo || '',
                    flag: ''
                },
                league: m.competition || sport,
                venue: m.venue || '',
                date: m.time ? m.time.split('T')[0] : dateStr,
                time: m.time ? new Date(m.time).toISOString().slice(11, 16) : '00:00',
                startTimeUtc: m.time || null,
                status: m.status === 'live' ? 'live' : m.status === 'finished' ? 'finished' : 'upcoming',
                statusText: m.status_text || '',
                score: {
                    team1: m.home_score ?? null,
                    team2: m.away_score ?? null
                }
            }));
    } catch (e) {
        console.error(`[provider:sportscore] ${sport} error:`, e.message);
        return [];
    }
}
