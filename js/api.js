// ===== API-Sports Integration with Auto-Update =====

// Live matches data store
let LIVE_MATCHES = {};
let DATE_CACHE = {};
let LAST_UPDATED = null;
let AUTO_REFRESH_INTERVAL = null;
let LIVE_REFRESH_INTERVAL = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes for non-live
const LIVE_REFRESH_MS = 60 * 1000; // 1 minute for live matches

// Sofascore API Config
const SOFASCORE_BASE = 'https://api.sofascore.com/api/v1';
const SOFASCORE_HEADERS = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.sofascore.com/',
    'Origin': 'https://www.sofascore.com'
};

// Sport mapping for Sofascore
const SPORT_MAP = {
    'football': 'football',
    'cricket': 'cricket',
    'basketball': 'basketball',
    'tabletennis': 'table-tennis',
    'tennis': 'tennis',
    'ice-hockey': 'ice-hockey',
    'baseball': 'baseball'
};

// Country flags mapping
const COUNTRY_FLAGS = {
    'India': { flag: '🇮🇳', logo: 'https://flagcdn.com/w80/in.png' },
    'Australia': { flag: '🇦🇺', logo: 'https://flagcdn.com/w80/au.png' },
    'England': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' },
    'Pakistan': { flag: '🇵🇰', logo: 'https://flagcdn.com/w80/pk.png' },
    'Bangladesh': { flag: '🇧🇩', logo: 'https://flagcdn.com/w80/bd.png' },
    'Sri Lanka': { flag: '🇱🇰', logo: 'https://flagcdn.com/w80/lk.png' },
    'South Africa': { flag: '🇿🇦', logo: 'https://flagcdn.com/w80/za.png' },
    'New Zealand': { flag: '🇳🇿', logo: 'https://flagcdn.com/w80/nz.png' },
    'West Indies': { flag: '🇯🇲', logo: 'https://flagcdn.com/w80/jm.png' },
    'Afghanistan': { flag: '🇦🇫', logo: 'https://flagcdn.com/w80/af.png' },
    'Zimbabwe': { flag: '🇿🇼', logo: 'https://flagcdn.com/w80/zw.png' },
    'Ireland': { flag: '🇮🇪', logo: 'https://flagcdn.com/w80/ie.png' },
    'Netherlands': { flag: '🇳🇱', logo: 'https://flagcdn.com/w80/nl.png' },
    'Scotland': { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', logo: 'https://flagcdn.com/w80/gb-sct.png' },
    'Barcelona': { flag: '🇪🇸', logo: 'https://flagcdn.com/w80/es.png' },
    'Real Madrid': { flag: '🇪🇸', logo: 'https://flagcdn.com/w80/es.png' },
    'Manchester United': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' },
    'Liverpool': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' },
    'Bayern Munich': { flag: '🇩🇪', logo: 'https://flagcdn.com/w80/de.png' },
    'Dortmund': { flag: '🇩🇪', logo: 'https://flagcdn.com/w80/de.png' },
    'LA Lakers': { flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png' },
    'Boston Celtics': { flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png' },
    'Golden State Warriors': { flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png' },
    'Brooklyn Nets': { flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png' },
    'Paris Saint-Germain': { flag: '🇫🇷', logo: 'https://flagcdn.com/w80/fr.png' },
    'Juventus': { flag: '🇮🇹', logo: 'https://flagcdn.com/w80/it.png' },
    'AC Milan': { flag: '🇮🇹', logo: 'https://flagcdn.com/w80/it.png' },
    'Inter Milan': { flag: '🇮🇹', logo: 'https://flagcdn.com/w80/it.png' },
    'Atletico Madrid': { flag: '🇪🇸', logo: 'https://flagcdn.com/w80/es.png' },
    'Chelsea': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' },
    'Arsenal': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' },
    'Tottenham': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' },
    'Manchester City': { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png' }
};

// Get country info for a team
function getCountryInfo(teamName) {
    return COUNTRY_FLAGS[teamName] || { flag: '🏳️', logo: 'https://flagcdn.com/w80/un.png' };
}

// Set API key (for future use)
function setApiKey(key) {
    console.log('API key set (not used in current version)');
}

// ===== Sofascore API Functions =====

// Fetch scheduled events from Sofascore for a specific sport and date
async function fetchSofascoreScheduled(sport, date) {
    try {
        const targetUrl = `${SOFASCORE_BASE}/sport/${sport}/scheduled-events/${date}`;
        const proxyUrl = `/proxy?url=${encodeURIComponent(targetUrl)}`;
        console.log(`🌐 Fetching Sofascore via proxy: ${targetUrl}`);

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.events || [];
    } catch (error) {
        console.log(`⚠️ Sofascore ${sport} fetch failed: ${error.message}`);
        return [];
    }
}

// Fetch live events from Sofascore for a specific sport
async function fetchSofascoreLive(sport) {
    try {
        const targetUrl = `${SOFASCORE_BASE}/sport/${sport}/events/live`;
        const proxyUrl = `/proxy?url=${encodeURIComponent(targetUrl)}`;
        console.log(`🌐 Fetching Sofascore LIVE via proxy: ${targetUrl}`);

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.events || [];
    } catch (error) {
        console.log(`⚠️ Sofascore ${sport} live fetch failed: ${error.message}`);
        return [];
    }
}

// Convert Sofascore event to our format
function convertSofascoreEvent(event, sport) {
    const homeTeam = event.homeTeam || {};
    const awayTeam = event.awayTeam || {};
    const homeScore = event.homeScore || {};
    const awayScore = event.awayScore || {};
    const tournament = event.tournament || {};
    const venue = event.venue || {};

    // Get country info
    const homeInfo = getCountryInfo(homeTeam.name);
    const awayInfo = getCountryInfo(awayTeam.name);

    // Determine status
    let status = 'upcoming';
    if (event.status) {
        const statusCode = event.status.code;
        if (statusCode === 0) status = 'upcoming';
        else if (statusCode === 1) status = 'live';
        else if (statusCode === 3 || statusCode === 70) status = 'finished';
        else if (statusCode === 40) status = 'live';
    }

    // Format time
    const startTime = event.startTimestamp ? new Date(event.startTimestamp * 1000) : new Date();
    const time = startTime.toTimeString().slice(0, 5);

    // Sport icon mapping
    const sportIcons = {
        'football': '⚽',
        'cricket': '🏏',
        'basketball': '🏀',
        'table-tennis': '🏓',
        'tennis': '🎾',
        'ice-hockey': '🏒',
        'baseball': '⚾'
    };

    // Map sport name for internal use
    const sportName = sport === 'table-tennis' ? 'tabletennis' : sport;

    return {
        id: event.id || Date.now(),
        sport: sportName,
        icon: sportIcons[sport] || '🏟️',
        team1: {
            name: homeTeam.name || 'Home Team',
            short: homeTeam.nameCode || homeTeam.shortName || 'HOME',
            flag: homeInfo.flag,
            logo: homeInfo.logo
        },
        team2: {
            name: awayTeam.name || 'Away Team',
            short: awayTeam.nameCode || awayTeam.shortName || 'AWAY',
            flag: awayInfo.flag,
            logo: awayInfo.logo
        },
        league: tournament.name || 'Unknown League',
        venue: venue.stadium ? venue.stadium.name : (venue.city ? venue.city.name : 'Unknown Venue'),
        date: date || startTime.toISOString().split('T')[0],
        time: time,
        status: status,
        score: {
            team1: homeScore.current || homeScore.display || 0,
            team2: awayScore.current || awayScore.display || 0
        },
        sofascoreId: event.id
    };
}

// Fetch all sports from Sofascore for a date
async function fetchAllSofascoreForDate(date) {
    const sports = ['football', 'basketball', 'cricket', 'table-tennis'];
    const results = { cricket: [], football: [], basketball: [], tabletennis: [] };

    // Fetch in parallel
    const promises = sports.map(async (sport) => {
        const events = await fetchSofascoreScheduled(sport, date);
        const converted = events.map(e => convertSofascoreEvent(e, sport));
        return { sport, converted };
    });

    const allResults = await Promise.allSettled(promises);

    allResults.forEach(result => {
        if (result.status === 'fulfilled') {
            const { sport, converted } = result.value;
            results[sport] = converted;
        }
    });

    // Also fetch live events for today
    const today = getTodayString();
    if (date === today) {
        const livePromises = sports.map(async (sport) => {
            const events = await fetchSofascoreLive(sport);
            return { sport, events };
        });

        const liveResults = await Promise.allSettled(livePromises);

        liveResults.forEach(result => {
            if (result.status === 'fulfilled') {
                const { sport, events } = result.value;
                const converted = events.map(e => convertSofascoreEvent(e, sport));
                // Merge live events (avoid duplicates by ID)
                const existingIds = new Set(results[sport].map(m => m.id));
                converted.forEach(match => {
                    if (!existingIds.has(match.id)) {
                        results[sport].push(match);
                    }
                });
            }
        });
    }

    return results;
}

// Generate dynamic mock data based on any date/time
function generateDynamicMatchesForDate(dateStr) {
    const now = new Date();
    const currentHour = now.getHours();
    const isToday = dateStr === getTodayString();

    const cricketTeams = [
        ['India', 'IND', '🇮🇳', 'https://flagcdn.com/w80/in.png'],
        ['Australia', 'AUS', '🇦🇺', 'https://flagcdn.com/w80/au.png'],
        ['England', 'ENG', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'https://flagcdn.com/w80/gb-eng.png'],
        ['Pakistan', 'PAK', '🇵🇰', 'https://flagcdn.com/w80/pk.png'],
        ['Bangladesh', 'BAN', '🇧🇩', 'https://flagcdn.com/w80/bd.png'],
        ['Sri Lanka', 'SL', '🇱🇰', 'https://flagcdn.com/w80/lk.png'],
        ['South Africa', 'SA', '🇿🇦', 'https://flagcdn.com/w80/za.png'],
        ['New Zealand', 'NZ', '🇳🇿', 'https://flagcdn.com/w80/nz.png']
    ];

    const footballTeams = [
        ['Barcelona', 'BAR', '🇪🇸', 'https://flagcdn.com/w80/es.png'],
        ['Real Madrid', 'RMA', '🇪🇸', 'https://flagcdn.com/w80/es.png'],
        ['Manchester United', 'MUN', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'https://flagcdn.com/w80/gb-eng.png'],
        ['Liverpool', 'LIV', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'https://flagcdn.com/w80/gb-eng.png'],
        ['Bayern Munich', 'BAY', '🇩🇪', 'https://flagcdn.com/w80/de.png'],
        ['Paris Saint-Germain', 'PSG', '🇫🇷', 'https://flagcdn.com/w80/fr.png'],
        ['Chelsea', 'CHE', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'https://flagcdn.com/w80/gb-eng.png'],
        ['Arsenal', 'ARS', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'https://flagcdn.com/w80/gb-eng.png']
    ];

    const basketballTeams = [
        ['LA Lakers', 'LAL', '🇺🇸', 'https://flagcdn.com/w80/us.png'],
        ['Boston Celtics', 'BOS', '🇺🇸', 'https://flagcdn.com/w80/us.png'],
        ['Golden State Warriors', 'GSW', '🇺🇸', 'https://flagcdn.com/w80/us.png'],
        ['Brooklyn Nets', 'BKN', '🇺🇸', 'https://flagcdn.com/w80/us.png'],
        ['Miami Heat', 'MIA', '🇺🇸', 'https://flagcdn.com/w80/us.png'],
        ['Chicago Bulls', 'CHI', '🇺🇸', 'https://flagcdn.com/w80/us.png']
    ];

    const tabletennisTeams = [
        ['Fan Zhendong', 'FAN', '🇨🇳', 'https://flagcdn.com/w80/cn.png'],
        ['Ma Long', 'MA', '🇨🇳', 'https://flagcdn.com/w80/cn.png'],
        ['Xu Xin', 'XU', '🇨🇳', 'https://flagcdn.com/w80/cn.png'],
        ['Tomokazu Harimoto', 'HAR', '🇯🇵', 'https://flagcdn.com/w80/jp.png'],
        ['Jun Mizutani', 'MIZ', '🇯🇵', 'https://flagcdn.com/w80/jp.png'],
        ['Timo Boll', 'BOL', '🇩🇪', 'https://flagcdn.com/w80/de.png'],
        ['Dimitrij Ovtcharov', 'OVT', '🇩🇪', 'https://flagcdn.com/w80/de.png'],
        ['Truls Moregardh', 'MOR', '🇸🇪', 'https://flagcdn.com/w80/se.png'],
        ['Mattias Falck', 'FAL', '🇸🇪', 'https://flagcdn.com/w80/se.png'],
        ['Wang Chuqin', 'WAN', '🇨🇳', 'https://flagcdn.com/w80/cn.png'],
        ['Liang Jingkun', 'LIA', '🇨🇳', 'https://flagcdn.com/w80/cn.png'],
        ['Lin Gaoyuan', 'LIN', '🇨🇳', 'https://flagcdn.com/w80/cn.png']
    ];

    const cricketLeagues = ['ICC World Cup 2026', 'IPL 2026', 'Asia Cup 2026', 'T20 World Cup', 'BBL 2026'];
    const footballLeagues = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'];
    const basketballLeagues = ['NBA 2025-26', 'EuroLeague', 'NCAA'];
    const tabletennisLeagues = ['WTT Champions', 'WTT Star Contender', 'ITTF World Tour', 'Olympics 2028', 'WTT Grand Smash'];

    const venues = [
        'National Stadium', 'Wankhede Stadium', 'Lord\'s Cricket Ground',
        'Old Trafford', 'Camp Nou', 'Allianz Arena', 'Stamford Bridge',
        'Crypto.com Arena', 'Madison Square Garden',
        'Olympic Sports Center', 'Tokyo Metropolitan Gymnasium',
        'Düsseldorf Arena', 'Budapest Sports Arena'
    ];

    // Seed random by date for consistent results
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) {
        seed = ((seed << 5) - seed) + dateStr.charCodeAt(i);
        seed |= 0;
    }
    function seededRandom() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }

    // Generate 6 cricket matches
    const cricketMatches = [];
    for (let i = 0; i < 6; i++) {
        const t1idx = Math.floor(seededRandom() * cricketTeams.length);
        const team1 = cricketTeams[t1idx];
        const t2list = cricketTeams.filter((_, idx) => idx !== t1idx);
        const team2 = t2list[Math.floor(seededRandom() * t2list.length)];
        const matchHour = 8 + (i * 3);
        const isLive = isToday && matchHour <= currentHour && matchHour + 3 > currentHour;
        const isFinished = isToday && matchHour + 3 <= currentHour;

        cricketMatches.push({
            id: parseInt(dateStr.replace(/-/g, '')) + 100 + i,
            sport: 'cricket',
            icon: '🏏',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: cricketLeagues[Math.floor(seededRandom() * cricketLeagues.length)],
            venue: venues[Math.floor(seededRandom() * venues.length)],
            date: dateStr,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? Math.floor(seededRandom() * 200) + 100 : 0,
                team2: isLive || isFinished ? Math.floor(seededRandom() * 200) + 100 : 0
            }
        });
    }

    // Generate 6 football matches
    const footballMatches = [];
    for (let i = 0; i < 6; i++) {
        const t1idx = Math.floor(seededRandom() * footballTeams.length);
        const team1 = footballTeams[t1idx];
        const t2list = footballTeams.filter((_, idx) => idx !== t1idx);
        const team2 = t2list[Math.floor(seededRandom() * t2list.length)];
        const matchHour = 14 + (i * 2);
        const isLive = isToday && matchHour <= currentHour && matchHour + 2 > currentHour;
        const isFinished = isToday && matchHour + 2 <= currentHour;

        footballMatches.push({
            id: parseInt(dateStr.replace(/-/g, '')) + 200 + i,
            sport: 'football',
            icon: '⚽',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: footballLeagues[Math.floor(seededRandom() * footballLeagues.length)],
            venue: venues[Math.floor(seededRandom() * venues.length)],
            date: dateStr,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? Math.floor(seededRandom() * 5) : 0,
                team2: isLive || isFinished ? Math.floor(seededRandom() * 5) : 0
            }
        });
    }

    // Generate 5 basketball matches
    const basketballMatches = [];
    for (let i = 0; i < 5; i++) {
        const t1idx = Math.floor(seededRandom() * basketballTeams.length);
        const team1 = basketballTeams[t1idx];
        const t2list = basketballTeams.filter((_, idx) => idx !== t1idx);
        const team2 = t2list[Math.floor(seededRandom() * t2list.length)];
        const matchHour = 15 + (i * 2);
        const isLive = isToday && matchHour <= currentHour && matchHour + 2 > currentHour;
        const isFinished = isToday && matchHour + 2 <= currentHour;

        basketballMatches.push({
            id: parseInt(dateStr.replace(/-/g, '')) + 300 + i,
            sport: 'basketball',
            icon: '🏀',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: basketballLeagues[Math.floor(seededRandom() * basketballLeagues.length)],
            venue: venues[Math.floor(seededRandom() * venues.length)],
            date: dateStr,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? Math.floor(seededRandom() * 80) + 80 : 0,
                team2: isLive || isFinished ? Math.floor(seededRandom() * 80) + 80 : 0
            }
        });
    }

    // Generate 8 table tennis matches
    const tabletennisMatches = [];
    for (let i = 0; i < 8; i++) {
        const t1idx = Math.floor(seededRandom() * tabletennisTeams.length);
        const team1 = tabletennisTeams[t1idx];
        const t2list = tabletennisTeams.filter((_, idx) => idx !== t1idx);
        const team2 = t2list[Math.floor(seededRandom() * t2list.length)];
        const matchHour = 10 + (i * 2);
        const isLive = isToday && matchHour <= currentHour && matchHour + 1 > currentHour;
        const isFinished = isToday && matchHour + 1 <= currentHour;

        // Table tennis uses set scores (best of 5/7)
        const setsPlayed = isLive || isFinished ? Math.floor(seededRandom() * 4) + 1 : 0;
        const team1Sets = Math.ceil(setsPlayed / 2);
        const team2Sets = setsPlayed - team1Sets;

        tabletennisMatches.push({
            id: parseInt(dateStr.replace(/-/g, '')) + 400 + i,
            sport: 'tabletennis',
            icon: '🏓',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: tabletennisLeagues[Math.floor(seededRandom() * tabletennisLeagues.length)],
            venue: venues[Math.floor(seededRandom() * venues.length)],
            date: dateStr,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? team1Sets : 0,
                team2: isLive || isFinished ? team2Sets : 0
            }
        });
    }

    return {
        cricket: cricketMatches,
        football: footballMatches,
        basketball: basketballMatches,
        tabletennis: tabletennisMatches
    };
}

// Legacy function - generates for today
function generateDynamicMatches() {
    return generateDynamicMatchesForDate(getTodayString());
}

// Auto-fetch and update all matches for today and upcoming days
async function autoFetchMatches() {
    console.log('🔄 Auto-fetching live matches from Sofascore...');

    const today = getTodayString();

    // Fetch today's data from Sofascore
    try {
        const todayData = await fetchAllSofascoreForDate(today);
        DATE_CACHE[today] = {
            cricket: todayData.cricket.length > 0 ? todayData.cricket : generateDynamicMatchesForDate(today).cricket,
            football: todayData.football.length > 0 ? todayData.football : generateDynamicMatchesForDate(today).football,
            basketball: todayData.basketball.length > 0 ? todayData.basketball : generateDynamicMatchesForDate(today).basketball,
            tabletennis: todayData.tabletennis.length > 0 ? todayData.tabletennis : generateDynamicMatchesForDate(today).tabletennis,
            source: (todayData.cricket.length + todayData.football.length + todayData.basketball.length + todayData.tabletennis.length) > 0 ? 'sofascore' : 'generated'
        };
        console.log(`📊 Today's data: Football ${DATE_CACHE[today].football.length}, Cricket ${DATE_CACHE[today].cricket.length}, Basketball ${DATE_CACHE[today].basketball.length}, Table Tennis ${DATE_CACHE[today].tabletennis.length}`);
    } catch (e) {
        console.log(`⚠️ Sofascore fetch failed, using generated data: ${e.message}`);
        DATE_CACHE[today] = generateDynamicMatchesForDate(today);
        DATE_CACHE[today].source = 'generated';
    }

    // Cache next 7 days with generated data (will be fetched on demand)
    for (let i = 1; i <= 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        if (!DATE_CACHE[dateStr]) {
            DATE_CACHE[dateStr] = generateDynamicMatchesForDate(dateStr);
            DATE_CACHE[dateStr].source = 'generated';
        }
    }

    // Set today's live matches
    LIVE_MATCHES = DATE_CACHE[today];

    LAST_UPDATED = new Date();
    console.log(`✅ Matches updated at ${LAST_UPDATED.toLocaleTimeString()} (source: ${DATE_CACHE[today].source})`);

    // Update UI if available
    if (typeof loadMatchesForDate === 'function') {
        loadMatchesForDate(currentDate);
    }

    return LIVE_MATCHES;
}

// Fetch matches for a specific date from Sofascore
async function fetchMatchesForDateAPI(dateStr) {
    // Check cache first (unless it's today)
    const today = getTodayString();
    if (DATE_CACHE[dateStr] && dateStr !== today) {
        console.log(`📦 Using cached data for ${dateStr}`);
        return DATE_CACHE[dateStr];
    }

    console.log(`🌐 Fetching matches for ${dateStr} from Sofascore...`);

    // Fetch from Sofascore
    let sofascoreData = null;
    try {
        sofascoreData = await fetchAllSofascoreForDate(dateStr);
        console.log(`📊 Sofascore data: Football ${sofascoreData.football.length}, Cricket ${sofascoreData.cricket.length}, Basketball ${sofascoreData.basketball.length}`);
    } catch (e) {
        console.log(`⚠️ Sofascore fetch failed: ${e.message}`);
    }

    // Generate fallback data for this date
    const dynamicData = generateDynamicMatchesForDate(dateStr);

    // Merge: use Sofascore data if available, otherwise generated
    const result = {
        cricket: (sofascoreData && sofascoreData.cricket.length > 0) ? sofascoreData.cricket : dynamicData.cricket,
        football: (sofascoreData && sofascoreData.football.length > 0) ? sofascoreData.football : dynamicData.football,
        basketball: (sofascoreData && sofascoreData.basketball.length > 0) ? sofascoreData.basketball : dynamicData.basketball,
        tabletennis: (sofascoreData && sofascoreData.tabletennis.length > 0) ? sofascoreData.tabletennis : dynamicData.tabletennis,
        source: (sofascoreData && (sofascoreData.cricket.length + sofascoreData.football.length + sofascoreData.basketball.length + sofascoreData.tabletennis.length) > 0) ? 'sofascore' : 'generated'
    };

    // Cache the result
    DATE_CACHE[dateStr] = result;

    console.log(`✅ Fetched and cached ${result.cricket.length + result.football.length + result.basketball.length} matches for ${dateStr} (source: ${result.source})`);

    return result;
}

// Start auto-refresh job
function startAutoRefresh() {
    // Initial fetch
    autoFetchMatches();

    // Set up recurring fetch every 5 minutes for all data
    if (AUTO_REFRESH_INTERVAL) {
        clearInterval(AUTO_REFRESH_INTERVAL);
    }

    AUTO_REFRESH_INTERVAL = setInterval(() => {
        autoFetchMatches();
    }, REFRESH_INTERVAL_MS);

    // Set up 1-minute refresh for live matches
    if (LIVE_REFRESH_INTERVAL) {
        clearInterval(LIVE_REFRESH_INTERVAL);
    }

    LIVE_REFRESH_INTERVAL = setInterval(() => {
        refreshLiveMatches();
    }, LIVE_REFRESH_MS);

    console.log('⏰ Auto-refresh started (5 min for schedule, 1 min for live scores)');
}

// Refresh only live match scores
async function refreshLiveMatches() {
    console.log('🔄 Refreshing live scores...');

    const today = getTodayString();
    try {
        const liveData = await fetchAllSofascoreForDate(today);

        // Update live matches in cache
        if (DATE_CACHE[today]) {
            // Update each sport's live matches
            ['cricket', 'football', 'basketball', 'tabletennis'].forEach(sport => {
                if (liveData[sport] && liveData[sport].length > 0) {
                    // Merge live data - update existing and add new
                    const existingIds = new Set(DATE_CACHE[today][sport].map(m => m.id));
                    liveData[sport].forEach(match => {
                        const existingIdx = DATE_CACHE[today][sport].findIndex(m => m.id === match.id);
                        if (existingIdx >= 0) {
                            // Update existing match score
                            DATE_CACHE[today][sport][existingIdx] = match;
                        } else {
                            // Add new live match
                            DATE_CACHE[today][sport].push(match);
                        }
                    });
                }
            });

            LIVE_MATCHES = DATE_CACHE[today];
            LAST_UPDATED = new Date();

            // Update UI
            if (typeof loadMatchesForDate === 'function') {
                loadMatchesForDate(currentDate);
            }

            console.log(`✅ Live scores updated at ${LAST_UPDATED.toLocaleTimeString()}`);
        }
    } catch (e) {
        console.log(`⚠️ Live refresh failed: ${e.message}`);
    }
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (AUTO_REFRESH_INTERVAL) {
        clearInterval(AUTO_REFRESH_INTERVAL);
        AUTO_REFRESH_INTERVAL = null;
    }
    if (LIVE_REFRESH_INTERVAL) {
        clearInterval(LIVE_REFRESH_INTERVAL);
        LIVE_REFRESH_INTERVAL = null;
    }
    console.log('⏹️ Auto-refresh stopped');
}

// Get matches for a specific date
function getMatchesForDate(dateStr) {
    // Check cache first
    if (DATE_CACHE[dateStr]) {
        const allMatches = [
            ...DATE_CACHE[dateStr].cricket,
            ...DATE_CACHE[dateStr].football,
            ...DATE_CACHE[dateStr].basketball,
            ...(DATE_CACHE[dateStr].tabletennis || [])
        ];
        return allMatches.filter(match => match.date === dateStr);
    }

    // Check live matches
    if (LIVE_MATCHES.cricket && LIVE_MATCHES.cricket.length > 0) {
        const allMatches = [
            ...LIVE_MATCHES.cricket,
            ...LIVE_MATCHES.football,
            ...LIVE_MATCHES.basketball,
            ...(LIVE_MATCHES.tabletennis || [])
        ];
        return allMatches.filter(match => match.date === dateStr);
    }

    // Fallback to initial data
    const allMatches = [
        ...MOCK_DATA.cricket,
        ...MOCK_DATA.football,
        ...MOCK_DATA.basketball,
        ...(MOCK_DATA.tabletennis || [])
    ];
    return allMatches.filter(match => match.date === dateStr);
}

// Get all matches
function getAllMatches() {
    const today = getTodayString();
    const todayData = DATE_CACHE[today] || LIVE_MATCHES;

    if (todayData && todayData.cricket && todayData.cricket.length > 0) {
        return [
            ...todayData.cricket,
            ...todayData.football,
            ...todayData.basketball,
            ...(todayData.tabletennis || [])
        ];
    }
    return [
        ...MOCK_DATA.cricket,
        ...MOCK_DATA.football,
        ...MOCK_DATA.basketball,
        ...(MOCK_DATA.tabletennis || [])
    ];
}

// Filter matches by sport
function getMatchesBySport(sport) {
    if (sport === 'all') {
        return getAllMatches();
    }
    return LIVE_MATCHES[sport] || MOCK_DATA[sport] || [];
}

// Helper function to get today's date string
function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

// Initial mock data (fallback)
const MOCK_DATA = {
    cricket: [
        {
            id: 1,
            sport: 'cricket',
            icon: '🏏',
            team1: { name: 'India', short: 'IND', flag: '🇮🇳', logo: 'https://flagcdn.com/w80/in.png', color: '#0066b3' },
            team2: { name: 'Australia', short: 'AUS', flag: '🇦🇺', logo: 'https://flagcdn.com/w80/au.png', color: '#ffcd00' },
            league: 'ICC World Cup 2026',
            venue: 'Wankhede Stadium, Mumbai',
            date: getTodayString(),
            time: '14:00',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        },
        {
            id: 2,
            sport: 'cricket',
            icon: '🏏',
            team1: { name: 'England', short: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png', color: '#cf142b' },
            team2: { name: 'Pakistan', short: 'PAK', flag: '🇵🇰', logo: 'https://flagcdn.com/w80/pk.png', color: '#01411c' },
            league: 'ICC World Cup 2026',
            venue: 'Lord\'s Cricket Ground, London',
            date: getTodayString(),
            time: '18:30',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        },
        {
            id: 3,
            sport: 'cricket',
            icon: '🏏',
            team1: { name: 'Bangladesh', short: 'BAN', flag: '🇧🇩', logo: 'https://flagcdn.com/w80/bd.png', color: '#006a4e' },
            team2: { name: 'Sri Lanka', short: 'SL', flag: '🇱🇰', logo: 'https://flagcdn.com/w80/lk.png', color: '#8b1a1a' },
            league: 'Asia Cup 2026',
            venue: 'Shere Bangla Stadium, Dhaka',
            date: getTodayString(),
            time: '10:00',
            status: 'live',
            score: { team1: 186, team2: 142 }
        }
    ],
    football: [
        {
            id: 4,
            sport: 'football',
            icon: '⚽',
            team1: { name: 'Barcelona', short: 'BAR', flag: '🇪🇸', logo: 'https://flagcdn.com/w80/es.png', color: '#a50044' },
            team2: { name: 'Real Madrid', short: 'RMA', flag: '🇪🇸', logo: 'https://flagcdn.com/w80/es.png', color: '#febe10' },
            league: 'La Liga 2025-26',
            venue: 'Camp Nou, Barcelona',
            date: getTodayString(),
            time: '20:00',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        },
        {
            id: 5,
            sport: 'football',
            icon: '⚽',
            team1: { name: 'Manchester United', short: 'MUN', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png', color: '#da291c' },
            team2: { name: 'Liverpool', short: 'LIV', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', logo: 'https://flagcdn.com/w80/gb-eng.png', color: '#c8102e' },
            league: 'Premier League 2025-26',
            venue: 'Old Trafford, Manchester',
            date: getTodayString(),
            time: '17:30',
            status: 'live',
            score: { team1: 2, team2: 1 }
        },
        {
            id: 6,
            sport: 'football',
            icon: '⚽',
            team1: { name: 'Bayern Munich', short: 'BAY', flag: '🇩🇪', logo: 'https://flagcdn.com/w80/de.png', color: '#dc052d' },
            team2: { name: 'Dortmund', short: 'BVB', flag: '🇩🇪', logo: 'https://flagcdn.com/w80/de.png', color: '#fde100' },
            league: 'Bundesliga 2025-26',
            venue: 'Allianz Arena, Munich',
            date: getTodayString(),
            time: '21:30',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        }
    ],
    basketball: [
        {
            id: 7,
            sport: 'basketball',
            icon: '🏀',
            team1: { name: 'LA Lakers', short: 'LAL', flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png', color: '#552583' },
            team2: { name: 'Boston Celtics', short: 'BOS', flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png', color: '#007a33' },
            league: 'NBA 2025-26',
            venue: 'Crypto.com Arena, Los Angeles',
            date: getTodayString(),
            time: '19:00',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        },
        {
            id: 8,
            sport: 'basketball',
            icon: '🏀',
            team1: { name: 'Golden State Warriors', short: 'GSW', flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png', color: '#1d428a' },
            team2: { name: 'Brooklyn Nets', short: 'BKN', flag: '🇺🇸', logo: 'https://flagcdn.com/w80/us.png', color: '#000000' },
            league: 'NBA 2025-26',
            venue: 'Chase Center, San Francisco',
            date: getTodayString(),
            time: '22:00',
            status: 'live',
            score: { team1: 98, team2: 102 }
        }
    ],
    tabletennis: [
        {
            id: 9,
            sport: 'tabletennis',
            icon: '🏓',
            team1: { name: 'Fan Zhendong', short: 'FAN', flag: '🇨🇳', logo: 'https://flagcdn.com/w80/cn.png' },
            team2: { name: 'Tomokazu Harimoto', short: 'HAR', flag: '🇯🇵', logo: 'https://flagcdn.com/w80/jp.png' },
            league: 'WTT Champions 2026',
            venue: 'Olympic Sports Center, Beijing',
            date: getTodayString(),
            time: '10:00',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        },
        {
            id: 10,
            sport: 'tabletennis',
            icon: '🏓',
            team1: { name: 'Ma Long', short: 'MA', flag: '🇨🇳', logo: 'https://flagcdn.com/w80/cn.png' },
            team2: { name: 'Timo Boll', short: 'BOL', flag: '🇩🇪', logo: 'https://flagcdn.com/w80/de.png' },
            league: 'WTT Star Contender 2026',
            venue: 'Düsseldorf Arena, Düsseldorf',
            date: getTodayString(),
            time: '12:00',
            status: 'live',
            score: { team1: 3, team2: 2 }
        },
        {
            id: 11,
            sport: 'tabletennis',
            icon: '🏓',
            team1: { name: 'Wang Chuqin', short: 'WAN', flag: '🇨🇳', logo: 'https://flagcdn.com/w80/cn.png' },
            team2: { name: 'Truls Moregardh', short: 'MOR', flag: '🇸🇪', logo: 'https://flagcdn.com/w80/se.png' },
            league: 'ITTF World Tour 2026',
            venue: 'Budapest Sports Arena, Budapest',
            date: getTodayString(),
            time: '14:00',
            status: 'upcoming',
            score: { team1: 0, team2: 0 }
        }
    ]
};
