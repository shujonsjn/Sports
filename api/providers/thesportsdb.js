// TheSportsDB provider — UFC/MMA events.

const TIMEOUT_MS = 8000;
const THESPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

const LEAGUE_MAP = { ufc: '4443', mma: '4443' };

export async function fetchTheSportsDB(sport, dateStr) {
    const leagueId = LEAGUE_MAP[sport];
    if (!leagueId) return [];

    try {
        const r = await fetch(`${THESPORTSDB_BASE}/eventsseason.php?id=${leagueId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!r.ok) return [];

        const json = await r.json();
        if (!json.events) return [];

        const targetDate = new Date(dateStr);
        const weekBefore = new Date(targetDate);
        weekBefore.setDate(weekBefore.getDate() - 7);
        const weekAfter = new Date(targetDate);
        weekAfter.setDate(weekAfter.getDate() + 30);

        return json.events
            .filter(e => {
                const eventDate = new Date(e.strTimestamp);
                return eventDate >= weekBefore && eventDate <= weekAfter;
            })
            .map(e => {
                const eventDate = e.strTimestamp ? new Date(e.strTimestamp) : new Date();
                const matchDate = eventDate.toISOString().slice(0, 10);
                const matchTime = eventDate.toISOString().slice(11, 16);
                const eventTitle = e.strEvent || 'TBA vs TBA';
                const parts = eventTitle.split(' vs ');
                const team1Name = (parts[0] || 'TBA').trim();
                const team2Name = (parts[1] || 'TBA').trim();

                let status = 'upcoming';
                const now = new Date();
                if (eventDate < now) {
                    const hoursDiff = (now - eventDate) / (1000 * 60 * 60);
                    status = hoursDiff > 3 ? 'finished' : 'live';
                }

                return {
                    id: e.idEvent ? `tsdb_${e.idEvent}` : null,
                    externalId: e.idEvent || null,
                    source: 'thesportsdb',
                    sport,
                    team1: { name: team1Name, short: team1Name.slice(0, 3).toUpperCase(), logo: e.strThumb || '', flag: '' },
                    team2: { name: team2Name, short: team2Name.slice(0, 3).toUpperCase(), logo: e.strThumb || '', flag: '' },
                    league: e.strLeague || sport.toUpperCase(),
                    venue: e.strVenue || '',
                    date: matchDate,
                    time: matchTime,
                    startTimeUtc: e.strTimestamp || null,
                    status,
                    statusText: e.strStatus || '',
                    score: { team1: e.intHomeScore || null, team2: e.intAwayScore || null }
                };
            });
    } catch (e) {
        console.error(`[provider:thesportsdb] ${sport} error:`, e.message);
        return [];
    }
}
