// ===== API-Sports Integration with Auto-Update =====

// Live matches data store
let LIVE_MATCHES = [];
let LAST_UPDATED = null;
let AUTO_REFRESH_INTERVAL = null;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

// Free APIs for live sports data
const FREE_APIS = {
    cricket: {
        url: 'https://cricket32.p.rapidapi.com/schedule',
        host: 'cricket32.p.rapidapi.com'
    },
    football: {
        url: 'https://v3.football.api-sports.io/fixtures?live',
        host: 'v3.football.api-sports.io'
    }
};

// Fetch live cricket data from ESPN Cricinfo (free)
async function fetchLiveCricket() {
    try {
        // Using a free cricket API endpoint
        const response = await fetch('https://api.cricapi.com/v1/currentMatches?apikey=demo');
        if (response.ok) {
            const data = await response.json();
            if (data && data.data) {
                return data.data.map(match => ({
                    id: match.id || Date.now(),
                    sport: 'cricket',
                    icon: '🏏',
                    team1: {
                        name: match.teams?.[0] || 'Team 1',
                        short: match.teams?.[0]?.substring(0, 3).toUpperCase() || 'T1',
                        ...getCountryInfo(match.teams?.[0])
                    },
                    team2: {
                        name: match.teams?.[1] || 'Team 2',
                        short: match.teams?.[1]?.substring(0, 3).toUpperCase() || 'T2',
                        ...getCountryInfo(match.teams?.[1])
                    },
                    league: match.name || 'Unknown League',
                    venue: match.venue || 'Unknown Venue',
                    date: match.date ? match.date.split('T')[0] : getTodayString(),
                    time: match.date ? new Date(match.date).toTimeString().slice(0, 5) : '00:00',
                    status: match.matchStarted ? 'live' : 'upcoming',
                    score: {
                        team1: match.score?.[0]?.r || 0,
                        team2: match.score?.[1]?.r || 0
                    }
                }));
            }
        }
    } catch (e) {
        console.log('Cricket API not available, using demo data');
    }
    return null;
}

// Fetch live football data (free API)
async function fetchLiveFootball() {
    try {
        // Using free football API
        const response = await fetch('https://api.football-data.org/v4/matches', {
            headers: { 'X-Auth-Token': 'demo' }
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.matches) {
                return data.matches.map(match => ({
                    id: match.id || Date.now(),
                    sport: 'football',
                    icon: '⚽',
                    team1: {
                        name: match.homeTeam?.name || 'Team 1',
                        short: match.homeTeam?.tla || 'T1',
                        ...getCountryInfo(match.homeTeam?.name)
                    },
                    team2: {
                        name: match.awayTeam?.name || 'Team 2',
                        short: match.awayTeam?.tla || 'T2',
                        ...getCountryInfo(match.awayTeam?.name)
                    },
                    league: match.competition?.name || 'Unknown League',
                    venue: match.venue || 'Unknown Venue',
                    date: match.utcDate ? match.utcDate.split('T')[0] : getTodayString(),
                    time: match.utcDate ? new Date(match.utcDate).toTimeString().slice(0, 5) : '00:00',
                    status: match.status === 'IN_PLAY' ? 'live' : 'upcoming',
                    score: {
                        team1: match.score?.fullTime?.home || 0,
                        team2: match.score?.fullTime?.away || 0
                    }
                }));
            }
        }
    } catch (e) {
        console.log('Football API not available, using demo data');
    }
    return null;
}

// Generate dynamic mock data based on current date/time
function generateDynamicMatches() {
    const now = new Date();
    const today = getTodayString();
    const currentHour = now.getHours();

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

    const cricketLeagues = ['ICC World Cup 2026', 'IPL 2026', 'Asia Cup 2026', 'T20 World Cup', 'BBL 2026'];
    const footballLeagues = ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'Champions League'];
    const basketballLeagues = ['NBA 2025-26', 'EuroLeague', 'NCAA'];

    const venues = [
        'National Stadium', 'Wankhede Stadium', 'Lord\'s Cricket Ground',
        'Old Trafford', 'Camp Nou', 'Allianz Arena', 'Stamford Bridge',
        'Crypto.com Arena', 'Madison Square Garden'
    ];

    // Generate 5-8 cricket matches
    const cricketMatches = [];
    for (let i = 0; i < 6; i++) {
        const team1 = cricketTeams[Math.floor(Math.random() * cricketTeams.length)];
        const team2 = cricketTeams.filter(t => t[0] !== team1[0])[Math.floor(Math.random() * (cricketTeams.length - 1))];
        const matchHour = 8 + (i * 3);
        const isLive = matchHour <= currentHour && matchHour + 3 > currentHour;
        const isFinished = matchHour + 3 <= currentHour;

        cricketMatches.push({
            id: 100 + i,
            sport: 'cricket',
            icon: '🏏',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: cricketLeagues[Math.floor(Math.random() * cricketLeagues.length)],
            venue: venues[Math.floor(Math.random() * venues.length)],
            date: today,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? Math.floor(Math.random() * 200) + 100 : 0,
                team2: isLive || isFinished ? Math.floor(Math.random() * 200) + 100 : 0
            }
        });
    }

    // Generate 5-8 football matches
    const footballMatches = [];
    for (let i = 0; i < 6; i++) {
        const team1 = footballTeams[Math.floor(Math.random() * footballTeams.length)];
        const team2 = footballTeams.filter(t => t[0] !== team1[0])[Math.floor(Math.random() * (footballTeams.length - 1))];
        const matchHour = 14 + (i * 2);
        const isLive = matchHour <= currentHour && matchHour + 2 > currentHour;
        const isFinished = matchHour + 2 <= currentHour;

        footballMatches.push({
            id: 200 + i,
            sport: 'football',
            icon: '⚽',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: footballLeagues[Math.floor(Math.random() * footballLeagues.length)],
            venue: venues[Math.floor(Math.random() * venues.length)],
            date: today,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? Math.floor(Math.random() * 5) : 0,
                team2: isLive || isFinished ? Math.floor(Math.random() * 5) : 0
            }
        });
    }

    // Generate 4-6 basketball matches
    const basketballMatches = [];
    for (let i = 0; i < 5; i++) {
        const team1 = basketballTeams[Math.floor(Math.random() * basketballTeams.length)];
        const team2 = basketballTeams.filter(t => t[0] !== team1[0])[Math.floor(Math.random() * (basketballTeams.length - 1))];
        const matchHour = 15 + (i * 2);
        const isLive = matchHour <= currentHour && matchHour + 2 > currentHour;
        const isFinished = matchHour + 2 <= currentHour;

        basketballMatches.push({
            id: 300 + i,
            sport: 'basketball',
            icon: '🏀',
            team1: { name: team1[0], short: team1[1], flag: team1[2], logo: team1[3] },
            team2: { name: team2[0], short: team2[1], flag: team2[2], logo: team2[3] },
            league: basketballLeagues[Math.floor(Math.random() * basketballLeagues.length)],
            venue: venues[Math.floor(Math.random() * venues.length)],
            date: today,
            time: `${String(matchHour).padStart(2, '0')}:00`,
            status: isLive ? 'live' : isFinished ? 'finished' : 'upcoming',
            score: {
                team1: isLive || isFinished ? Math.floor(Math.random() * 80) + 80 : 0,
                team2: isLive || isFinished ? Math.floor(Math.random() * 80) + 80 : 0
            }
        });
    }

    return {
        cricket: cricketMatches,
        football: footballMatches,
        basketball: basketballMatches
    };
}

// Auto-fetch and update all matches
async function autoFetchMatches() {
    console.log('🔄 Auto-fetching live matches...');

    // Try to fetch from real APIs first
    const cricketData = await fetchLiveCricket();
    const footballData = await fetchLiveFootball();

    // Generate dynamic data for demo
    const dynamicData = generateDynamicMatches();

    // Merge data
    LIVE_MATCHES = {
        cricket: cricketData || dynamicData.cricket,
        football: footballData || dynamicData.football,
        basketball: dynamicData.basketball
    };

    LAST_UPDATED = new Date();
    console.log(`✅ Matches updated at ${LAST_UPDATED.toLocaleTimeString()}`);

    // Update UI if available
    if (typeof loadMatchesForDate === 'function') {
        loadMatchesForDate(currentDate);
    }

    return LIVE_MATCHES;
}

// Start auto-refresh job
function startAutoRefresh() {
    // Initial fetch
    autoFetchMatches();

    // Set up recurring fetch every 5 minutes
    if (AUTO_REFRESH_INTERVAL) {
        clearInterval(AUTO_REFRESH_INTERVAL);
    }

    AUTO_REFRESH_INTERVAL = setInterval(() => {
        autoFetchMatches();
    }, REFRESH_INTERVAL_MS);

    console.log('⏰ Auto-refresh job started (every 5 minutes)');
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (AUTO_REFRESH_INTERVAL) {
        clearInterval(AUTO_REFRESH_INTERVAL);
        AUTO_REFRESH_INTERVAL = null;
        console.log('⏹️ Auto-refresh stopped');
    }
}

// Get matches for a specific date
function getMatchesForDate(dateStr) {
    // If we have live data, use it
    if (LIVE_MATCHES.cricket && LIVE_MATCHES.cricket.length > 0) {
        const allMatches = [
            ...LIVE_MATCHES.cricket,
            ...LIVE_MATCHES.football,
            ...LIVE_MATCHES.basketball
        ];
        return allMatches.filter(match => match.date === dateStr);
    }

    // Fallback to initial data
    const allMatches = [
        ...MOCK_DATA.cricket,
        ...MOCK_DATA.football,
        ...MOCK_DATA.basketball
    ];
    return allMatches.filter(match => match.date === dateStr);
}

// Get all matches
function getAllMatches() {
    if (LIVE_MATCHES.cricket && LIVE_MATCHES.cricket.length > 0) {
        return [
            ...LIVE_MATCHES.cricket,
            ...LIVE_MATCHES.football,
            ...LIVE_MATCHES.basketball
        ];
    }
    return [
        ...MOCK_DATA.cricket,
        ...MOCK_DATA.football,
        ...MOCK_DATA.basketball
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
    ]
};
