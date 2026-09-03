// SportsRC provider — fetches directly from api.sportsrc.org.

const TIMEOUT_MS = 8000;

export async function fetchSportsRC(sport, dateStr) {
    try {
        const r = await fetch(`https://api.sportsrc.org?data=matches&category=${sport}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!r.ok) return [];

        const data = await r.json();
        const items = data?.data || data?.items || data || [];
        if (!Array.isArray(items)) return [];

        return items
            .filter(m => {
                const d = m.date ? new Date(m.date).toISOString().slice(0, 10) : '';
                return d === dateStr;
            })
            .map(m => ({
                id: m.id ? `src_${sport}_${m.id}` : null,
                externalId: m.id || null,
                source: 'sportsrc',
                sport,
                team1: {
                    name: m.teams?.home?.name || 'Home',
                    short: (m.teams?.home?.name || 'HOM').slice(0, 3).toUpperCase(),
                    logo: m.teams?.home?.badge || '',
                    flag: ''
                },
                team2: {
                    name: m.teams?.away?.name || 'Away',
                    short: (m.teams?.away?.name || 'AWA').slice(0, 3).toUpperCase(),
                    logo: m.teams?.away?.badge || '',
                    flag: ''
                },
                league: m.league?.name || m.tournament?.name || sport,
                venue: m.venue?.name || '',
                date: m.date ? new Date(m.date).toISOString().slice(0, 10) : dateStr,
                time: m.date ? new Date(m.date).toISOString().slice(11, 16) : '00:00',
                startTimeUtc: m.date || null,
                status: 'upcoming',
                statusText: 'Scheduled',
                score: { team1: null, team2: null }
            }));
    } catch (e) {
        console.error(`[provider:sportsrc] ${sport} error:`, e.message);
        return [];
    }
}
