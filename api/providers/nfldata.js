// NFLData provider — fetches directly from api.nfldata.org.

const TIMEOUT_MS = 8000;

export async function fetchNFLData(dateStr) {
    try {
        const targetDate = new Date(`${dateStr}T00:00:00Z`);
        const year = targetDate.getUTCFullYear();

        const r = await fetch(`https://api.nfldata.org/v1/games?season=${year}&season_type=2`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!r.ok) return [];

        const text = await r.text();
        if (text.startsWith('<!')) return [];
        const json = JSON.parse(text);
        const games = json?.data || [];

        return games
            .filter(g => g.gameday === dateStr)
            .map(g => ({
                id: g.id ? `nfl_${g.id}` : `nfl_${g.gameday}_${g.home_team}_${g.away_team}`,
                externalId: g.id || g.game_id || null,
                source: 'nfldata',
                sport: 'nfl',
                team1: {
                    name: g.home_team || 'Home',
                    short: (g.home_team || 'HOM').slice(0, 3).toUpperCase(),
                    logo: '',
                    flag: ''
                },
                team2: {
                    name: g.away_team || 'Away',
                    short: (g.away_team || 'AWA').slice(0, 3).toUpperCase(),
                    logo: '',
                    flag: ''
                },
                league: g.week ? `NFL - Week ${g.week}` : 'NFL',
                venue: g.location || g.venue || '',
                date: g.gameday || dateStr,
                time: g.gametime || '00:00',
                startTimeUtc: g.gameday ? `${g.gameday}T${g.gametime || '00:00'}:00Z` : null,
                status: g.result ? 'finished' : g.status?.includes('Live') ? 'live' : 'upcoming',
                statusText: g.status || '',
                score: {
                    team1: g.home_score ?? null,
                    team2: g.away_score ?? null
                }
            }));
    } catch (e) {
        console.error(`[provider:nfldata] error:`, e.message);
        return [];
    }
}
