// ESPN provider — fetches directly from ESPN API.
// Supports football (soccer), basketball, NFL.

const TIMEOUT_MS = 10000;

const SPORT_MAP = {
    football: { sport: 'soccer', leagues: ['eng.1', 'esp.1', 'ger.1', 'ita.1', 'fra.1', 'usa.1', 'ned.1', 'por.1', 'tur.1', 'bra.1', 'arg.1', 'mex.1', 'uefa.champions', 'uefa.europa', 'eng.2', 'esp.2', 'ita.2', 'ger.2', 'fra.2', 'aus.1', 'ind.1', 'sau.1', 'are.1', 'chn.1', 'jpn.1', 'kor.1'] },
    basketball: { sport: 'basketball', leagues: ['nba', 'wnba'] },
    nfl: { sport: 'football', leagues: ['nfl'] }
};

function mapLeagueName(id) {
    if (!id) return '';
    const map = {
        'eng.1': 'Premier League', 'eng.2': 'Championship', 'esp.1': 'La Liga', 'esp.2': 'La Liga 2',
        'ita.1': 'Serie A', 'ita.2': 'Serie B', 'ger.1': 'Bundesliga', 'ger.2': '2. Bundesliga',
        'fra.1': 'Ligue 1', 'fra.2': 'Ligue 2', 'ned.1': 'Eredivisie', 'por.1': 'Liga Portugal',
        'tur.1': 'Super Lig', 'bra.1': 'Brasileirão', 'arg.1': 'Liga Profesional', 'mex.1': 'Liga MX',
        'usa.1': 'MLS', 'chn.1': 'Chinese Super League', 'jpn.1': 'J1 League', 'kor.1': 'K League 1',
        'aus.1': 'A-League', 'ind.1': 'ISL', 'sau.1': 'Saudi Pro League', 'are.1': 'UAE Pro League',
        'nba': 'NBA', 'wnba': 'WNBA', 'nfl': 'NFL',
        'uefa.champions': 'UEFA Champions League', 'uefa.europa': 'UEFA Europa League'
    };
    return map[id] || id.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function fetchESPN(sport, dateStr) {
    const cfg = SPORT_MAP[sport];
    if (!cfg) return [];

    const espnDate = (dateStr || '').replace(/-/g, '');
    const allMatches = [];

    for (const lg of cfg.leagues) {
        try {
            let url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${lg}/scoreboard`;
            if (espnDate) url += `?dates=${espnDate}`;

            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });
            if (!r.ok) continue;

            const data = await r.json();
            for (const ev of (data.events || [])) {
                const comp = ev.competitions?.[0];
                if (!comp) continue;
                const home = comp.competitors?.find(c => c.homeAway === 'home');
                const away = comp.competitors?.find(c => c.homeAway === 'away');
                if (!home || !away) continue;

                const statusType = comp.status?.type?.name || ev.status?.type?.name || '';
                let status = 'upcoming';
                if (statusType === 'STATUS_IN_PROGRESS' || statusType === 'STATUS_HALFTIME' || statusType === 'STATUS_SECOND_HALF' || statusType === 'STATUS_END_PERIOD') {
                    status = 'live';
                } else if (statusType === 'STATUS_FINAL' || statusType === 'STATUS_FULL_TIME') {
                    status = 'finished';
                }

                const matchDate = ev.date ? new Date(ev.date).toISOString().slice(0, 10) : dateStr;
                const matchTime = ev.date ? new Date(ev.date).toISOString().slice(11, 16) : '00:00';

                allMatches.push({
                    id: `espn-${lg}-${ev.id}`,
                    externalId: ev.id,
                    source: 'espn',
                    sport,
                    team1: {
                        name: home.team?.shortDisplayName || home.team?.displayName || 'Home',
                        short: home.team?.abbreviation || '',
                        logo: home.team?.logo || '',
                        flag: ''
                    },
                    team2: {
                        name: away.team?.shortDisplayName || away.team?.displayName || 'Away',
                        short: away.team?.abbreviation || '',
                        logo: away.team?.logo || '',
                        flag: ''
                    },
                    league: mapLeagueName(lg),
                    venue: comp.venue?.fullName || '',
                    date: matchDate,
                    time: matchTime,
                    startTimeUtc: ev.date || null,
                    status,
                    statusText: comp.status?.type?.detail || statusType,
                    score: {
                        team1: home.score || null,
                        team2: away.score || null
                    }
                });
            }
        } catch (e) {
            console.error(`[provider:espn] ${sport}/${lg} error:`, e.message);
        }
    }
    return allMatches;
}
