// Cricket providers — ESPN Cricket, CricketData.org, direct fetch.

const TIMEOUT_MS = 8000;

export async function fetchESPNCricket(dateStr) {
    const espnDate = (dateStr || '').replace(/-/g, '');
    const endpoints = [
        `https://site.api.espn.com/apis/site/v2/sports/cricket/scoreboard${espnDate ? '?dates=' + espnDate : ''}`,
        `https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&region=in&tz=Asia/Calcutta${espnDate ? '&dates=' + espnDate : ''}`,
        `https://site.api.espn.com/apis/site/v2/sports/cricket/australia/scoreboard${espnDate ? '?dates=' + espnDate : ''}`,
        `https://site.api.espn.com/apis/site/v2/sports/cricket/england/scoreboard${espnDate ? '?dates=' + espnDate : ''}`
    ];

    const seenLeagueIds = new Set();
    const seenEventIds = new Set();
    const matches = [];

    for (const url of endpoints) {
        try {
            const r = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });
            if (!r.ok) continue;

            const data = await r.json();
            const leagues = data?.sports?.[0]?.leagues || [];

            for (const league of leagues) {
                if (seenLeagueIds.has(league.id)) continue;
                seenLeagueIds.add(league.id);

                for (const ev of (league.events || [])) {
                    if (seenEventIds.has(ev.id)) continue;
                    seenEventIds.add(ev.id);

                    const competitors = ev.competitors || [];
                    const state = ev.fullStatus?.type?.state || '';

                    const matchDate = ev.date ? new Date(ev.date).toISOString().slice(0, 10) : dateStr;
                    const matchTime = ev.date ? new Date(ev.date).toISOString().slice(11, 16) : '00:00';

                    const team1Raw = competitors[0]?.score || '';
                    const team2Raw = competitors[1]?.score || '';
                    const t1OvMatch = team1Raw.match(/\((\d+\.?\d*)\s*ov\)/);
                    const t2OvMatch = team2Raw.match(/\((\d+\.?\d*)\s*ov\)/);
                    const team1Score = team1Raw.replace(/\s*\([^)]*\)\s*/, '').trim() || null;
                    const team2Score = team2Raw.replace(/\s*\([^)]*\)\s*/, '').trim() || null;

                    let statusText = ev.fullStatus?.type?.description || '';
                    const session = ev.fullStatus?.session || '';
                    const dayNum = ev.fullStatus?.dayNumber || '';
                    if (session) statusText = session + (statusText ? ' - ' + statusText : '');
                    else if (dayNum && state === 'in') statusText = 'Day ' + dayNum + (statusText ? ' - ' + statusText : '');

                    matches.push({
                        id: `espn_crick_${ev.id}`,
                        externalId: ev.id,
                        source: 'espn_cricket',
                        sport: 'cricket',
                        team1: {
                            name: competitors[0]?.displayName || competitors[0]?.name || 'TBA',
                            short: competitors[0]?.abbreviation || '',
                            logo: competitors[0]?.logo || '',
                            flag: ''
                        },
                        team2: {
                            name: competitors[1]?.displayName || competitors[1]?.name || 'TBA',
                            short: competitors[1]?.abbreviation || '',
                            logo: competitors[1]?.logo || '',
                            flag: ''
                        },
                        league: league.name || 'Cricket',
                        venue: ev.location || '',
                        date: matchDate,
                        time: matchTime,
                        startTimeUtc: ev.date || null,
                        status: state === 'in' ? 'live' : state === 'post' ? 'finished' : 'upcoming',
                        statusText,
                        score: { team1: team1Score, team2: team2Score },
                        overs: {
                            team1: t1OvMatch ? t1OvMatch[1] : '',
                            team2: t2OvMatch ? t2OvMatch[1] : ''
                        }
                    });
                }
            }
        } catch (e) {
            console.error(`[provider:espn_cricket] error:`, e.message);
        }
    }
    return matches;
}

export async function fetchCricketData(dateStr) {
    try {
        const k = Math.floor(Date.now() / 5000);
        const r = await fetch(`https://cricketdata.org/apis/prepmatchlist.aspx?k=${k}&r=${encodeURIComponent('https://live-streaming-eta.vercel.app/')}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!r.ok) return [];

        const text = await r.text();
        if (text.startsWith('<!')) return [];
        const data = JSON.parse(text);

        return (Array.isArray(data) ? data : [])
            .map(m => {
                const matchDate = m.d ? m.d.split('T')[0] : dateStr;
                let status = 'upcoming';
                if (m.ms === 'live') status = 'live';
                else if (m.ms === 'result') status = 'finished';

                return {
                    id: m.id ? `cdorg_${m.id}` : null,
                    externalId: m.id || null,
                    source: 'cricketdata',
                    sport: 'cricket',
                    team1: { name: m.t1n || m.t1 || 'TBA', short: (m.t1 || 'TBA').slice(0, 3).toUpperCase(), logo: m.t1i ? `https://cricketdata.org/iapi/${m.t1i}?w=48` : '', flag: '' },
                    team2: { name: m.t2n || m.t2 || 'TBA', short: (m.t2 || 'TBA').slice(0, 3).toUpperCase(), logo: m.t2i ? `https://cricketdata.org/iapi/${m.t2i}?w=48` : '', flag: '' },
                    league: m.t || 'Cricket',
                    venue: '',
                    date: matchDate,
                    time: m.d ? new Date(m.d).toISOString().slice(11, 16) : '00:00',
                    startTimeUtc: m.d || null,
                    status,
                    statusText: m.s || '',
                    score: {
                        team1: m.t1s ? m.t1s.replace(/\?/g, '').trim() || null : null,
                        team2: m.t2s ? m.t2s.replace(/\?/g, '').trim() || null : null
                    }
                };
            })
            .filter(m => m.date === dateStr);
    } catch (e) {
        console.error(`[provider:cricketdata] error:`, e.message);
        return [];
    }
}
