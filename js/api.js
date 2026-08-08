// ===== SportScore API Integration =====

let LIVE_MATCHES = {};
let DATE_CACHE = {};
let LAST_UPDATED = null;
let AUTO_REFRESH_INTERVAL = null;
let LIVE_REFRESH_INTERVAL = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LIVE_REFRESH_MS = 5 * 60 * 1000;

const SPORTSCORE_BASE = 'https://sportscore.com/api/widget';
const SPORTSRC_BASE = 'https://api.sportsrc.org';
const CACHE_KEY_PREFIX = 'sportsrc_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

function getCachedData(dateStr) {
    try {
        const cached = localStorage.getItem(CACHE_KEY_PREFIX + dateStr);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < CACHE_DURATION_MS) {
                return data.matches;
            }
        }
    } catch (e) {}
    return null;
}

function setCachedData(dateStr, matches) {
    try {
        localStorage.setItem(CACHE_KEY_PREFIX + dateStr, JSON.stringify({
            timestamp: Date.now(),
            matches: matches
        }));
    } catch (e) {}
}

const SPORT_MAP = {
    'football': 'football',
    'cricket': 'cricket',
    'basketball': 'basketball',
    'tabletennis': 'tennis'
};

function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function convertSportScoreMatch(match, sport) {
    const statusMap = {
        'live': 'live',
        'finished': 'finished',
        'upcoming': 'upcoming',
        'not_started': 'upcoming',
        'cancelled': 'finished',
        'postponed': 'upcoming',
        'suspended': 'live'
    };

    const matchDate = match.time ? match.time.split('T')[0] : getTodayString();
    const matchTime = match.time ? new Date(match.time).toTimeString().slice(0, 5) : '00:00';

    return {
        id: match.url || Date.now(),
        sport: sport,
        icon: getSportIcon(sport),
        team1: {
            name: match.home || 'Home Team',
            short: (match.home || 'HOME').slice(0, 3).toUpperCase(),
            logo: match.home_logo || '',
            flag: ''
        },
        team2: {
            name: match.away || 'Away Team',
            short: (match.away || 'AWAY').slice(0, 3).toUpperCase(),
            logo: match.away_logo || '',
            flag: ''
        },
        league: match.competition || 'Unknown League',
        venue: '',
        date: matchDate,
        time: matchTime,
        status: statusMap[match.status] || 'upcoming',
        statusText: match.status_text || '',
        score: {
            team1: match.home_score || '0',
            team2: match.away_score || '0'
        }
    };
}

function getSportIcon(sport) {
    const icons = {
        'football': '⚽',
        'cricket': '🏏',
        'basketball': '🏀',
        'tennis': '🎾',
        'tabletennis': '🏓'
    };
    return icons[sport] || '🏟️';
}

async function fetchSportScore(sport, limit = 20) {
    try {
        const url = `${SPORTSCORE_BASE}/matches/?sport=${sport}&limit=${limit}`;
        console.log(`🌐 Fetching ${sport}...`);

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return (data.matches || []).map(m => convertSportScoreMatch(m, sport));
    } catch (error) {
        console.log(`⚠️ ${sport} fetch failed: ${error.message}`);
        return [];
    }
}

async function fetchAllSports() {
    const sports = ['football', 'cricket', 'basketball', 'tennis'];
    const results = {
        football: [],
        cricket: [],
        basketball: [],
        tabletennis: []
    };

    const promises = sports.map(async (sport) => {
        const matches = await fetchSportScore(sport, 30);
        return { sport, matches };
    });

    const allResults = await Promise.allSettled(promises);

    allResults.forEach(result => {
        if (result.status === 'fulfilled') {
            const { sport, matches } = result.value;
            if (sport === 'tennis') {
                results.tabletennis = matches;
            } else {
                results[sport] = matches;
            }
        }
    });

    return results;
}

async function autoFetchMatches() {
    console.log('🔄 Auto-fetching live matches from SportScore...');

    try {
        const data = await fetchAllSports();
        const hasData = data.football.length + data.cricket.length + data.basketball.length + (data.tabletennis?.length || 0);

        if (hasData === 0) {
            console.log('⚠️ SportScore returned no data, trying SportSRC...');
            const today = getTodayString();
            const srcData = await fetchSportSRC(today);
            DATE_CACHE[today] = srcData;
            LIVE_MATCHES = srcData;
            LAST_UPDATED = new Date();
            return LIVE_MATCHES;
        }

        const today = getTodayString();
        DATE_CACHE[today] = {
            football: data.football,
            cricket: data.cricket,
            basketball: data.basketball,
            tabletennis: data.tabletennis,
            source: 'sportscore'
        };

        LIVE_MATCHES = DATE_CACHE[today];
        LAST_UPDATED = new Date();

        console.log(`✅ Matches updated: Football ${data.football.length}, Cricket ${data.cricket.length}, Basketball ${data.basketball.length}, Tennis ${data.tabletennis?.length || 0}`);
    } catch (e) {
        console.log(`⚠️ SportScore failed: ${e.message}, trying SportSRC...`);
        try {
            const today = getTodayString();
            const srcData = await fetchSportSRC(today);
            DATE_CACHE[today] = srcData;
            LIVE_MATCHES = srcData;
            LAST_UPDATED = new Date();
        } catch (e2) {
            console.log(`⚠️ Both APIs failed: ${e2.message}`);
        }
    }

    return LIVE_MATCHES;
}

function convertSportSRCMatch(match, category) {
    const matchDate = new Date(match.date).toISOString().split('T')[0];
    const matchTime = new Date(match.date).toTimeString().slice(0, 5);

    const categoryNames = {
        'football': 'Football',
        'cricket': 'Cricket',
        'basketball': 'Basketball',
        'tennis': 'Tennis'
    };

    return {
        id: match.id || Date.now(),
        sport: category,
        icon: getSportIcon(category),
        team1: {
            name: match.teams?.home?.name || 'Home Team',
            short: (match.teams?.home?.name || 'HOME').slice(0, 3).toUpperCase(),
            logo: match.teams?.home?.badge || '',
            flag: ''
        },
        team2: {
            name: match.teams?.away?.name || 'Away Team',
            short: (match.teams?.away?.name || 'AWAY').slice(0, 3).toUpperCase(),
            logo: match.teams?.away?.badge || '',
            flag: ''
        },
        league: categoryNames[category] || category,
        venue: '',
        date: matchDate,
        time: matchTime,
        status: 'upcoming',
        statusText: 'Scheduled',
        score: { team1: '-', team2: '-' }
    };
}

async function fetchSportSRC(dateStr) {
    const cached = getCachedData(dateStr);
    if (cached) {
        console.log(`📦 Using cached data for ${dateStr}`);
        return cached;
    }

    const categories = ['football', 'cricket', 'basketball', 'tennis'];
    const results = { football: [], cricket: [], basketball: [], tabletennis: [] };

    for (const cat of categories) {
        try {
            const url = `${SPORTSRC_BASE}?data=matches&category=${cat}`;
            const res = await fetch(url);
            if (!res.ok) continue;
            const json = await res.json();
            const items = json.data || json.items || json || [];
            const dayMatches = items.filter(m => {
                const d = new Date(m.date).toISOString().split('T')[0];
                return d === dateStr;
            }).map(m => convertSportSRCMatch(m, cat));

            if (cat === 'tennis') {
                results.tabletennis = dayMatches;
            } else {
                results[cat] = dayMatches;
            }
        } catch (e) {
            console.log(`⚠️ SportSRC ${cat} failed: ${e.message}`);
        }
    }

    setCachedData(dateStr, results);
    return results;
}

function getMatchesForDate(dateStr) {
    const today = getTodayString();
    
    if (DATE_CACHE[dateStr]) {
        const cache = DATE_CACHE[dateStr];
        return [
            ...(cache.cricket || []),
            ...(cache.football || []),
            ...(cache.basketball || []),
            ...(cache.tabletennis || [])
        ].filter(m => m.date === dateStr);
    }
    
    if (dateStr === today && LIVE_MATCHES) {
        return [
            ...(LIVE_MATCHES.cricket || []),
            ...(LIVE_MATCHES.football || []),
            ...(LIVE_MATCHES.basketball || []),
            ...(LIVE_MATCHES.tabletennis || [])
        ].filter(m => m.date === dateStr);
    }
    
    return [];
}

async function fetchMatchesForDate(dateStr) {
    const today = getTodayString();
    
    if (dateStr === today) {
        return await autoFetchMatches();
    }
    
    const data = await fetchSportSRC(dateStr);
    DATE_CACHE[dateStr] = data;
    return data;
}

async function preCacheUpcomingDays() {
    const today = new Date();
    const dates = [];
    
    for (let i = 1; i <= 7; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log('📦 Pre-caching upcoming days...');
    for (const dateStr of dates) {
        const cached = getCachedData(dateStr);
        if (!cached) {
            await fetchSportSRC(dateStr);
            await new Promise(r => setTimeout(r, 500));
        }
    }
    console.log('✅ Pre-cache complete');
}

function getAllMatches() {
    const today = getTodayString();
    return getMatchesForDate(today);
}

function getMatchesBySport(sport) {
    if (sport === 'all') {
        return getAllMatches();
    }
    const today = getTodayString();
    const cache = DATE_CACHE[today] || LIVE_MATCHES;
    if (cache && cache[sport]) {
        return cache[sport];
    }
    return [];
}

function setApiKey(key) {
    console.log('API key set (not used in SportScore)');
}

function startAutoRefresh() {
    autoFetchMatches();

    if (AUTO_REFRESH_INTERVAL) clearInterval(AUTO_REFRESH_INTERVAL);
    AUTO_REFRESH_INTERVAL = setInterval(autoFetchMatches, REFRESH_INTERVAL_MS);

    if (LIVE_REFRESH_INTERVAL) clearInterval(LIVE_REFRESH_INTERVAL);
    LIVE_REFRESH_INTERVAL = setInterval(async () => {
        console.log('🔄 Refreshing live scores...');
        try {
            const data = await fetchAllSports();
            const today = getTodayString();
            if (DATE_CACHE[today]) {
                DATE_CACHE[today].football = data.football;
                DATE_CACHE[today].cricket = data.cricket;
                DATE_CACHE[today].basketball = data.basketball;
                DATE_CACHE[today].tabletennis = data.tabletennis;
                LIVE_MATCHES = DATE_CACHE[today];
                LAST_UPDATED = new Date();
            }
            console.log(`✅ Live scores updated at ${LAST_UPDATED.toLocaleTimeString()}`);
        } catch (e) {
            console.log(`⚠️ Live refresh failed: ${e.message}`);
        }
    }, LIVE_REFRESH_MS);

    console.log('⏰ Auto-refresh started (5 min schedule, 1 min live)');
}

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
