// ===== Main Application =====

let currentSport = window.SPORT_PAGE || 'football';
let currentDate = getTodayString();
let selectedMatch = null;
let currentRenderedMatches = [];

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
    initNavigation();
    initHamburger();
    loadMatchesForDate(currentDate);

    preCacheUpcomingDays();

    setInterval(async () => {
        if (currentDate !== getTodayString()) return;
        
        console.log('🔄 Auto-refreshing today...');
        await fetchAllSports();
        const matches = getMatchesForDate(currentDate);
        if (matches.length > 0) {
            renderMatchList(currentSport === 'all' ? matches : matches.filter(m => m.sport === currentSport));
        }
    }, 5 * 60 * 1000);

    console.log('🚀 Sports Live Hub initialized with auto-refresh');
});

// Initialize navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        if (btn.dataset.sport === currentSport) {
            btn.classList.add('active');
        }
    });

    navButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            if (this.tagName === 'A') {
                return;
            }
            navButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentSport = this.dataset.sport;
            loadMatchesForDate(currentDate);
        });
    });
}

// Initialize hamburger menu
function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const navContent = document.querySelector('.nav-content');

    if (hamburger && navContent) {
        hamburger.addEventListener('click', function() {
            navContent.classList.toggle('active');
        });

        // Close menu when clicking a nav button
        navContent.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                navContent.classList.remove('active');
            });
        });
    }
}

// Load matches for date
async function loadMatchesForDate(dateStr) {
    currentDate = dateStr;
    updateSelectedDateDisplay(dateStr);

    const container = document.getElementById('match-list');
    container.innerHTML = '<div class="loading">Loading matches...</div>';

    const today = getTodayString();

    if (dateStr === today) {
        await autoFetchMatches();
    } else if (dateStr > today) {
        try {
            await fetchMatchesForDate(dateStr);
        } catch (e) {
            console.log(`⚠️ Future date fetch failed: ${e.message}`);
        }
    }

    let matches = getMatchesForDate(dateStr);

    if (currentSport !== 'all') {
        matches = matches.filter(m => m.sport === currentSport);
    }

    if (APIFOOTBALL_KEY && matches.length > 0) {
        matches = await enrichMatchesWithVenue(matches, dateStr);
    }

    renderMatchList(matches);

    if (selectedMatch && !matches.find(m => String(m.id) === String(selectedMatch.id))) {
        selectedMatch = null;
        renderMatchDetails(null);
    }
}

// Render match list
function renderMatchList(matches) {
    const container = document.getElementById('match-list');

    stopAllCountdowns();
    currentRenderedMatches = matches;

    if (matches.length === 0) {
        const today = getTodayString();
        const isPastDate = currentDate < today;
        const isFutureDate = currentDate > today;
        container.innerHTML = `
            <div class="no-matches">
                <span class="icon">${isPastDate ? '📅' : isFutureDate ? '⏳' : '📭'}</span>
                <p>${isPastDate ? 'No historical data available' : isFutureDate ? 'Fetching matches from SportSRC API...' : 'No matches scheduled for this date'}</p>
                ${isFutureDate ? '<small style="color: var(--text-muted); margin-top: 0.5rem; display: block;">Loading future match schedules...</small>' : ''}
            </div>
        `;
        return;
    }

    // Group matches by league
    const groupedByLeague = {};
    matches.forEach(match => {
        const league = match.league || 'Other';
        if (!groupedByLeague[league]) {
            groupedByLeague[league] = [];
        }
        groupedByLeague[league].push(match);
    });

    // Sort leagues by number of matches (most first)
    const sortedLeagues = Object.keys(groupedByLeague).sort((a, b) => {
        return groupedByLeague[b].length - groupedByLeague[a].length;
    });

    let html = '';
    sortedLeagues.forEach(league => {
        const leagueMatches = groupedByLeague[league];
        const sportIcons = leagueMatches.map(m => m.icon);
        const uniqueIcons = [...new Set(sportIcons)].join(' ');

        html += `
            <div class="league-group">
                <div class="league-header">
                    <span class="league-icons">${uniqueIcons}</span>
                    <span class="league-name">${league}</span>
                    <span class="league-count">${leagueMatches.length} match${leagueMatches.length > 1 ? 'es' : ''}</span>
                </div>
                <div class="league-matches">
                    ${leagueMatches.map(match => {
                        const status = getMatchStatus(match);
                        const matchDateTime = getMatchDateTime(match.date, match.time);
                        const remaining = calculateRemaining(matchDateTime);
                        const isActive = selectedMatch && selectedMatch.id === match.id;

                        return `
                            <div class="match-card ${status} ${isActive ? 'active' : ''}" 
                                 data-match-id="${match.id}"
                                 onclick="selectMatch('${match.id}')">
                                <div class="match-sport-icon">${match.icon}</div>
                                <div class="match-info">
                                    <div class="match-teams">
                                        <div class="team-item">
                                                <img src="${match.team1.logo}" alt="" class="team-logo" onerror="this.style.display='none'">
                                                <span class="team-name">${match.team1.name}</span>
                                        </div>
                                        <span class="vs-text">vs</span>
                                        <div class="team-item">
                                                <img src="${match.team2.logo}" alt="" class="team-logo" onerror="this.style.display='none'">
                                                <span class="team-name">${match.team2.name}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="match-time-section">
                                    ${status === 'finished' ? 
                                        `<div class="match-score">${match.score.team1} - ${match.score.team2}</div>` :
                                        status === 'live' ?
                                            `<div class="match-countdown live">LIVE</div>` :
                                            `<div class="match-time">${match.time}</div>`
                                    }
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Select match
function selectMatch(matchId) {
    const match = currentRenderedMatches.find(m => String(m.id) === String(matchId));

    if (match) {
        selectedMatch = match;

        document.querySelectorAll('.match-card').forEach(card => {
            card.classList.remove('active');
        });
        const matchCard = document.querySelector(`[data-match-id="${CSS.escape(matchId)}"]`);
        if (matchCard) matchCard.classList.add('active');

        renderMatchDetails(match);
    }
}

// Render match details
function renderMatchDetails(match) {
    const container = document.getElementById('match-details');

    if (!match) {
        container.innerHTML = `
            <div class="no-selection">
                <span class="icon">👈</span>
                <p>Select a match to view details</p>
            </div>
        `;
        return;
    }

    const status = getMatchStatus(match);

    container.innerHTML = `
        <div class="detail-header">
            <div class="detail-sport-icon">${match.icon}</div>
            <div class="detail-league">${match.league}</div>
            <span class="detail-status ${status}">
                ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        </div>
        <div class="detail-teams">
            <div class="detail-team">
                <img src="${match.team1.logo}" alt="" class="detail-team-logo-img" onerror="this.style.display='none'">
                <div class="detail-team-name">${match.team1.name}</div>
            </div>
            <div class="detail-score-center">
                ${(status === 'live' || status === 'finished') ? 
                    `<div class="detail-score">
                        <span class="score-team1">${match.score.team1}</span>
                        <span class="score-divider">-</span>
                        <span class="score-team2">${match.score.team2}</span>
                    </div>` :
                    `<div class="detail-vs">VS</div>`
                }
            </div>
            <div class="detail-team">
                <img src="${match.team2.logo}" alt="" class="detail-team-logo-img" onerror="this.style.display='none'">
                <div class="detail-team-name">${match.team2.name}</div>
            </div>
        </div>
        <div class="detail-info">
            <div class="detail-row">
                <span class="detail-label">📅 Date</span>
                <span class="detail-value">${formatDate(match.date)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">⏰ Time</span>
                <span class="detail-value">${match.time}</span>
            </div>
            ${match.venue ? `
            <div class="detail-row">
                <span class="detail-label">📍 Venue</span>
                <span class="detail-value">${match.venue}</span>
            </div>
            ` : ''}
            ${(status === 'live' || status === 'finished') ? `
                <div class="detail-row score-row">
                    <span class="detail-label">📊 Score</span>
                    <span class="detail-value score-display">
                        <span class="score-flag">${match.team1.flag}</span>
                        <span class="score-num">${match.score.team1}</span>
                        <span class="score-sep">-</span>
                        <span class="score-num">${match.score.team2}</span>
                        <span class="score-flag">${match.team2.flag}</span>
                    </span>
                </div>
            ` : ''}
        </div>
        ${status === 'live' ? `
            <div class="live-now-section">
                <div class="live-now-title">🔴 Live Now</div>
                <button class="live-now-btn" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(match.team1.name + ' vs ' + match.team2.name + ' live stream')}', '_blank')">
                    ▶ Watch Live
                </button>
            </div>
        ` : ''}
    `;
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Set API key (call this function to set your API key)
function setMyApiKey(key) {
    setApiKey(key);
    loadMatchesForDate(currentDate);
    refreshCalendarEvents();
    console.log('API key set! Fetching live data...');
}
