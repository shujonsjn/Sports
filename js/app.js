// ===== Main Application =====

const SPORTS = ['football','cricket','basketball','tennis','mma','ufc','nfl'];

function applyAdminOverrides(dateStr) {
    try {
        const overrides = JSON.parse(localStorage.getItem('admin_match_overrides') || '{}');
        const customs = JSON.parse(localStorage.getItem('admin_custom_matches') || '[]');
        const day = DATE_CACHE[dateStr];
        if (!day && customs.length === 0) return;
        const data = day || {};
        SPORTS.forEach(sport => {
            if (!data[sport]) data[sport] = [];
            data[sport].forEach(m => {
                if (m.id && overrides[m.id] && !overrides[m.id]._deleted) {
                    const o = overrides[m.id];
                    if (o.team1) m.team1 = { ...m.team1, ...o.team1 };
                    if (o.team2) m.team2 = { ...m.team2, ...o.team2 };
                    if (o.score) m.score = o.score;
                    if (o.status) m.status = o.status;
                    if (o.league) m.league = o.league;
                    if (o.venue) m.venue = o.venue;
                    if (o.result) m.result = o.result;
                    if (o.time) m.time = o.time;
                    if (o.date) m.date = o.date;
                } else if (m.id && overrides[m.id]?._deleted) {
                    m._deleted = true;
                }
            });
            data[sport] = data[sport].filter(m => !m._deleted);
        });
        customs.forEach(c => {
            if (c.date === dateStr && c.sport) {
                const cat = c.sport;
                if (!data[cat]) data[cat] = [];
                if (!data[cat].find(x => x.id === c.id)) data[cat].push(c);
            }
        });
        DATE_CACHE[dateStr] = data;
    } catch (e) {}
}

function parseUrlPath() {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!path) return { sport: 'football', date: getTodayString(), matchSlug: null };
    const parts = path.split('/');
    let sport = (SPORTS.includes(parts[0]) || parts[0] === 'all') ? parts[0] : 'football';
    let date = getTodayString();
    let matchSlug = null;
    if (parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) {
        date = parts[1];
    }
    if (parts[2]) {
        matchSlug = parts.slice(2).join('/');
    }
    return { sport, date, matchSlug };
}

const urlInfo = parseUrlPath();
let currentSport = urlInfo.sport;
let currentDate = urlInfo.date;
let selectedMatch = null;

function buildUrlPath(sport, date, matchSlug) {
    const parts = [sport || currentSport];
    if (date) parts.push(date);
    if (matchSlug) parts.push(matchSlug);
    return '/' + parts.join('/');
}

function updateUrl(sport, date, matchSlug) {
    const url = buildUrlPath(sport, date, matchSlug);
    window.history.pushState({}, '', url);
}

// ===== URL Slug Management =====
function matchToSlug(match) {
    const t1 = (match.team1?.name || 'tbd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const t2 = (match.team2?.name || 'tbd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${t1}-vs-${t2}`;
}

function setMatchSlug(match) {
    const slug = matchToSlug(match);
    updateUrl(currentSport, currentDate, slug);
}

function clearMatchSlug() {
    updateUrl(currentSport, currentDate, null);
}

function getMatchFromSlug() {
    const info = parseUrlPath();
    if (!info.matchSlug) return null;
    const teams = info.matchSlug.split('-vs-');
    if (teams.length < 2) return null;
    return { t1: teams[0], t2: teams[1], sport: info.sport };
}

function findMatchBySlug(slugInfo) {
    if (!slugInfo || !currentRenderedMatches.length) return null;
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    return currentRenderedMatches.find(m => {
        const t1 = norm(m.team1?.name || '');
        const t2 = norm(m.team2?.name || '');
        return (t1.includes(norm(slugInfo.t1)) && t2.includes(norm(slugInfo.t2))) ||
               (t1.includes(norm(slugInfo.t2)) && t2.includes(norm(slugInfo.t1)));
    });
}

window.addEventListener('popstate', function() {
    // Check if navigating to/from blog view
    if (window.location.pathname.includes('blog.html') || window.location.pathname.includes('blog')) {
        const params = new URLSearchParams(window.location.search);
        const matchName = params.get('match') || '';
        if (matchName) {
            showBlogView(matchName, params.get('date') || '', params.get('time') || '', params.get('league') || '', params.get('sport') || '');
            return;
        }
    } else {
        hideBlogView();
    }

    const info = parseUrlPath();
    if (info.sport !== currentSport) {
        switchSport(info.sport, false);
    }
    if (info.date !== currentDate) {
        currentDate = info.date;
        loadMatchesForDate(currentDate);
    }
    const slugInfo = getMatchFromSlug();
    if (slugInfo) {
        setTimeout(() => {
            const match = findMatchBySlug(slugInfo);
            if (match) selectMatch(match.id, false);
        }, 1000);
    } else {
        selectedMatch = null;
        document.querySelectorAll('.match-detail-accordion').forEach(acc => {
            acc.style.display = 'none';
            acc.innerHTML = '';
        });
        document.querySelectorAll('.match-card').forEach(card => card.classList.remove('active'));
    }
});

// Escape string for use in HTML attributes (prevents XSS)

// Defensive cleanup for malformed provider names before rendering.
function cleanDisplayName(value) {
    let name = String(value ?? '');

    // Decode common HTML entities first.
    name = name
        .replace(/&quot;|&#34;|&#x22;/gi, '"')
        .replace(/&gt;|&#62;|&#x3e;/gi, '>')
        .replace(/&lt;|&#60;|&#x3c;/gi, '<')
        .replace(/&amp;/gi, '&');

    // Remove HTML tags
    name = name.replace(/<[^>]*>/g, ' ');

    // Remove malformed provider prefixes like: S'"> , B"> , IC" , G" etc.
    // Strategy: find the LAST occurrence of > or " and take everything after it
    const lastGt = Math.max(name.lastIndexOf('>'), name.indexOf('&gt;'));
    if (lastGt !== -1 && lastGt < name.length - 1) {
        const after = name.slice(lastGt + 1).replace(/^\s*['"]?\s*/, '');
        if (after.length > 0 && after !== name) { name = after; }
    }

    // Fallback: remove any prefix pattern like X"> at the start
    for (let i = 0; i < 5; i++) {
        name = name.replace(/^\s*\S{1,20}\s*["']?\s*>\s*/i, '');
        name = name.replace(/^\s*\S{1,20}\s*["']?\s*&gt;\s*/i, '');
    }

    // Remove leftover punctuation/quotes around the actual name.
    name = name.replace(/^[\s"'<>:;|]+|[\s"'<>:;|]+$/g, '');
    name = name.replace(/\s+/g, ' ').trim();
    return name || 'Team';
}

function esc(str) {
    return String(str ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
function escHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function jsAttr(value) { return escHtml(JSON.stringify(String(value ?? ''))); }
function scoreValue(value) { return value === null || value === undefined || value === '' ? '-' : String(value); }
function teamLogoHtml(team) {
    const name = cleanDisplayName(team?.name || 'Team');
    const logo = String(team?.logo || '').trim();
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'T';
    if (!logo) return `<div class="mc-logo"><span class="team-initials">${escHtml(initials)}</span></div>`;
    return `<div class="mc-logo"><img src="${escHtml(logo)}" alt="${escHtml(name)}" loading="lazy" onload="this.style.display='';this.nextElementSibling.style.display='none'" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="team-initials" style="display:none">${escHtml(initials)}</span></div>`;
}

function updateSelectedDateDisplay(dateStr) {}
function renderLoadingSkeleton(container) {
    if (!container) return;
    let html = '';
    for (let i = 0; i < 5; i++) {
        html += '<div class="skeleton-card"></div>';
    }
    container.innerHTML = html;
}

// ===== Empty State =====
function renderEmptyState(container, options = {}) {
    if (!container) return;
    const { icon = '📭', title = 'No matches found', desc = 'There are no matches scheduled for this date.', action = null, actionText = '', subtle = false } = options;
    const cls = subtle ? 'empty-state empty-state-subtle' : 'empty-state';
    let html = `<div class="${cls}" role="status">
        <div class="empty-state-icon" aria-hidden="true">${icon}</div>
        <div class="empty-state-title">${escHtml(title)}</div>
        <div class="empty-state-desc">${escHtml(desc)}</div>`;
    if (action && actionText) {
        html += `<button class="empty-state-btn" onclick="${action}">${escHtml(actionText)}</button>`;
    }
    html += '</div>';
    container.innerHTML = html;
}

// ===== Error State =====
function renderErrorState(container, options = {}) {
    if (!container) return;
    const { title = 'Unable to load matches', desc = 'Something went wrong while fetching match data.', retryAction = 'loadMatchesForDate(currentDate)' } = options;
    container.innerHTML = `<div class="error-state" role="alert">
        <div class="error-state-icon" aria-hidden="true">⚠️</div>
        <div class="error-state-title">${escHtml(title)}</div>
        <div class="error-state-desc">${escHtml(desc)}</div>
        <button class="error-state-btn error-state-retry" onclick="${retryAction}">
            <span class="loading-spinner-inline" style="display:none"></span>
            Retry
        </button>
    </div>`;
}

// ===== Password Toggle =====
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
        btn.setAttribute('aria-label', 'Hide password');
    } else {
        input.type = 'password';
        btn.textContent = '👁';
        btn.setAttribute('aria-label', 'Show password');
    }
}
let currentRenderedMatches = [];

// ===== Theme Switcher =====
function setTheme(theme) {
    document.body.className = '';
    if (theme !== 'default') document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('site_theme', theme);
    document.querySelectorAll('.theme-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === theme);
    });
}

function toggleThemePanel() {
    const panel = document.getElementById('theme-panel');
    if (panel) panel.classList.toggle('open');
}

function initTheme() {
    const saved = localStorage.getItem('site_theme') || 'default';
    setTheme(saved);
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('theme-panel');
        const btn = document.querySelector('.theme-btn');
        if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
            panel.classList.remove('open');
        }
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    initTheme();
    initNavigation();
    initSearch();

    // Set sport from URL
    switchSport(currentSport, false);

    // Render date pills
    renderDatePills();

    await loadMatchesForDate(currentDate);

    // Check for match slug in URL
    const slugInfo = getMatchFromSlug();
    if (slugInfo) {
        setTimeout(() => {
            const match = findMatchBySlug(slugInfo);
            if (match) selectMatch(match.id, false);
        }, 1500);
    }

    // Check for blog URL on page load
    if (window.location.pathname.includes('blog.html') || window.location.pathname.includes('blog')) {
        const params = new URLSearchParams(window.location.search);
        const matchName = params.get('match') || '';
        const matchDate = params.get('date') || '';
        const matchTime = params.get('time') || '';
        const matchLeague = params.get('league') || '';
        const matchSport = params.get('sport') || '';
        if (matchName || matchDate) {
            setTimeout(() => showBlogView(matchName, matchDate, matchTime, matchLeague, matchSport), 500);
        }
    }

    console.log('🚀 SportsLive initialized');
    setTimeout(startScoreChecker, 5000);
});

// Initialize navigation
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sport === currentSport);
    });
    document.querySelectorAll('.sport-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sport === currentSport);
    });
    document.querySelectorAll('.mobile-nav-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sport === currentSport);
    });
}

// Switch sport tab
function switchSport(sport, updateUrlFlag = true) {
    currentSport = sport;
    currentLeagueFilter = null;

    // Hide blog view when switching sports
    const bv = document.getElementById('blog-view');
    const mc = document.getElementById('main-content');
    const nfl = document.getElementById('nfl-page');
    if (bv) bv.style.display = 'none';
    if (mc) mc.style.display = '';
    if (nfl) nfl.style.display = 'none';

    // Update desktop nav links
    document.querySelectorAll('.nav-link').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sport === sport);
    });
    // Update desktop sport pills
    document.querySelectorAll('.sport-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sport === sport);
    });
    // Update mobile nav pills
    document.querySelectorAll('.mobile-nav-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sport === sport);
    });
    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach((btn, i) => {
        btn.classList.toggle('active', (i === 0 && sport === 'all') || (i === 2 && sport === 'football'));
    });

    if (updateUrlFlag) updateUrl(currentSport, currentDate, null);

    // Reload matches
    selectedMatch = null;
    loadMatchesForDate(currentDate);
    renderDatePills();
    updateLiveNowSidebar();
}

function toggleMobileNav() {
    // no-op - mobile uses pills now
}

// ===== Date Pills =====
function renderDatePills() {
    const today = new Date();
    const dates = [];
    for (let i = -1; i <= 2; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d);
    }
    const fmt = d => {
        const str = d.toISOString().slice(0, 10);
        if (i === 0) return 'Today';
        if (i === -1) return 'Yesterday';
        if (i === 1) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    var i = 0;
    // Desktop
    const desktopContainer = document.getElementById('date-filters');
    if (desktopContainer) {
        desktopContainer.innerHTML = dates.map((d, idx) => {
            const dateStr = d.toISOString().slice(0, 10);
            const isActive = dateStr === currentDate;
            let label = '';
            if (idx === 0) label = 'Yesterday';
            else if (idx === 1) label = 'Today';
            else if (idx === 2) label = 'Tomorrow';
            else label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            return `<button class="date-pill ${isActive ? 'active' : ''}" onclick="loadMatchesForDate('${dateStr}');renderDatePills()">${label}</button>`;
        }).join('');
        // Add custom date option
        desktopContainer.innerHTML += `<button class="date-pill" onclick="pickCustomDate()" title="Pick a date">📅 ${today.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</button>`;
    }
    // Mobile
    const mobileContainer = document.getElementById('mobile-date-pills');
    if (mobileContainer) {
        mobileContainer.innerHTML = dates.map((d, idx) => {
            const dateStr = d.toISOString().slice(0, 10);
            const isActive = dateStr === currentDate;
            let label = '';
            if (idx === 0) label = 'Yesterday';
            else if (idx === 1) label = 'Today';
            else if (idx === 2) label = 'Tomorrow';
            else label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
            return `<button class="mobile-date-pill ${isActive ? 'active' : ''}" onclick="loadMatchesForDate('${dateStr}');renderDatePills()">${label}</button>`;
        }).join('');
    }
}

function pickCustomDate() {
    const input = document.createElement('input');
    input.type = 'date';
    input.value = currentDate;
    input.onchange = () => {
        if (input.value) {
            loadMatchesForDate(input.value);
            renderDatePills();
        }
    };
    input.click();
}

// ===== Live Now Sidebar =====
function updateLiveNowSidebar() {
    const container = document.getElementById('live-now-list');
    if (!container) return;

    const today = getTodayString();
    const allMatches = getMatchesForDate(today);
    const liveMatches = allMatches.filter(m => getMatchStatus(m) === 'live').slice(0, 3);

    if (liveMatches.length === 0) {
        container.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--muted);font-size:0.82rem">No live matches</div>';
        return;
    }

    container.innerHTML = liveMatches.map(match => {
        const t1 = cleanDisplayName(match.team1?.name || 'TBD');
        const t2 = cleanDisplayName(match.team2?.name || 'TBD');
        const s1 = scoreValue(match.score?.team1);
        const s2 = scoreValue(match.score?.team2);
        const league = match.league || '';
        const minute = match.statusText || '';

        return `<div class="live-mini-card" onclick="selectMatch('${esc(String(match.id))}')">
            <div class="live-mini-league">${escHtml(league)}</div>
            <div class="live-mini-teams">
                <div class="live-mini-team">${escHtml(t1)}</div>
                <div class="live-mini-score">${s1 && s1 !== '-' ? escHtml(s1) : '-'} - ${s2 && s2 !== '-' ? escHtml(s2) : '-'}</div>
                <div class="live-mini-team">${escHtml(t2)}</div>
            </div>
            ${minute ? `<div class="live-mini-minute">${escHtml(minute)}</div>` : ''}
        </div>`;
    }).join('');
}

// Initialize hamburger menu (no-op - mobile uses bottom nav now)
function initHamburger() {}

// Filter matches by current sport/league and render
function filterAndRender(matches, container) {
    if (currentSport !== 'all') {
        matches = matches.filter(m => m.sport === currentSport);
    }
    if (currentLeagueFilter) {
        matches = matches.filter(m => m.league === currentLeagueFilter);
    }
    if (_statusFilter !== 'all') {
        matches = matches.filter(m => getMatchStatus(m) === _statusFilter);
    }
    renderMatchList(matches, container);
    updateLeagueList(getMatchesForDate(currentDate).filter(m => currentSport === 'all' || m.sport === currentSport));
}

// Load matches for date
async function loadMatchesForDate(dateStr) {
    currentDate = dateStr;
    updateSelectedDateDisplay(dateStr);

    const container = document.getElementById('match-list');
    if (!container) return;

    const today = getTodayString();

    if (dateStr === today) {
        let cached = getMatchesForDate(dateStr);
        if (cached.length > 0) {
            await enrichMatchLogos(cached);
            filterAndRender(cached, container);
        } else {
            renderLoadingSkeleton(container);
        }
        try {
            await autoFetchMatches();
        } catch (err) {
            console.error('Fetch error:', err);
        }
        if (currentDate === dateStr) {
            const hasLive = Object.values(LIVE_MATCHES).some(arr => arr && arr.length > 0);
            if (hasLive) {
                const existing = DATE_CACHE[dateStr] || {};
                ['cricket','football','basketball','tennis','mma','ufc','nfl'].forEach(sport => {
                    if (LIVE_MATCHES[sport] && LIVE_MATCHES[sport].length > 0) {
                        const apiMatches = LIVE_MATCHES[sport];
                        const existingMatches = existing[sport] || [];
                        const merged = [...existingMatches];
                        apiMatches.forEach(apiM => {
                            const apiId = String(apiM.id);
                            let idx = merged.findIndex(e => String(e.id) === apiId);
                            if (idx < 0) {
                                const normName = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                const apiT1 = normName(apiM.team1?.name);
                                const apiT2 = normName(apiM.team2?.name);
                                idx = merged.findIndex(e => {
                                    const eT1 = normName(e.team1?.name);
                                    const eT2 = normName(e.team2?.name);
                                    return (eT1 === apiT1 && eT2 === apiT2) || (eT1 === apiT2 && eT2 === apiT1);
                                });
                            }
                            if (idx >= 0) {
                                const ex = merged[idx];
                                const hasScore = v => v && v !== '-' && v !== '';
                                const _mergeDate = ex.date || '';
                                const _isPastMatch = _mergeDate && _mergeDate < getTodayString();
                                if (!_isPastMatch) {
                                    if (apiM.status === 'live') ex.status = 'live';
                                    else if (apiM.status) ex.status = apiM.status;
                                    if (apiM.statusText && apiM.statusText.length > (ex.statusText || '').length) ex.statusText = apiM.statusText;
                                }
                                if (hasScore(apiM.score?.team1)) { ex.score = ex.score || {}; ex.score.team1 = apiM.score.team1; }
                                if (hasScore(apiM.score?.team2)) { ex.score = ex.score || {}; ex.score.team2 = apiM.score.team2; }
                                if (apiM.overs?.team1) { ex.overs = ex.overs || {}; ex.overs.team1 = apiM.overs.team1; }
                                if (apiM.overs?.team2) { ex.overs = ex.overs || {}; ex.overs.team2 = apiM.overs.team2; }
                                if (apiM.innings && apiM.innings.some(arr => arr && arr.length > 0)) {
                                    if (!_isPastMatch && (!ex.innings || !ex.innings.some(arr => arr && arr.length > 0))) {
                                        ex.innings = apiM.innings;
                                    }
                                }
                                if (apiM.team1?.logo && !ex.team1?.logo) ex.team1.logo = apiM.team1.logo;
                                if (apiM.team2?.logo && !ex.team2?.logo) ex.team2.logo = apiM.team2.logo;
                            } else {
                                merged.push(apiM);
                            }
                        });
                        existing[sport] = merged;
                    }
                });
                DATE_CACHE[dateStr] = existing;
                applyAdminOverrides(dateStr);
                const ufcMma = [...(existing.ufc || []), ...(existing.mma || [])];
                if (ufcMma.length > 0) applyUFCPhotos(ufcMma);
            }
            const fresh = getMatchesForDate(dateStr);
            await enrichMatchLogos(fresh);
            filterAndRender(fresh, container);
        }
        return;
    } else if (dateStr > today) {
        const cached = getMatchesForDate(dateStr);
        if (cached.length > 0) {
            await enrichMatchLogos(cached);
            filterAndRender(cached, container);
            return;
        }
        filterAndRender([], container);
        return;
    } else {
        const cached = getMatchesForDate(dateStr);
        await enrichMatchLogos(cached);
        filterAndRender(cached, container);
        return;
    }
}

// Normalize every match immediately before rendering so malformed provider names
// cannot appear in cards, titles, league rows, or detail panels.
function normalizeDisplayMatch(match) {
    if (!match || typeof match !== 'object') return null;
    const t1 = match.team1 || {};
    const t2 = match.team2 || {};
    const n1 = cleanDisplayName(t1.name || 'Home Team');
    const n2 = cleanDisplayName(t2.name || 'Away Team');
    return {
        ...match,
        team1: { ...t1, name: n1, short: cleanDisplayName(t1.short || n1.slice(0,3)).slice(0,3).toUpperCase() },
        team2: { ...t2, name: n2, short: cleanDisplayName(t2.short || n2.slice(0,3)).slice(0,3).toUpperCase() },
        league: cleanDisplayName(match.league || 'Other'),
        venue: match.venue ? cleanDisplayName(match.venue) : '',
        statusText: match.statusText ? cleanDisplayName(match.statusText) : ''
    };
}

// Render match list
function renderMatchList(matches, container) {
    container = container || document.getElementById('match-list');
    if (!container) return;
    matches = Array.isArray(matches) ? matches.filter(Boolean) : [];
    stopAllCountdowns();
    matches = matches.map(normalizeDisplayMatch).filter(Boolean);
    const seen = new Set();
    matches = matches.filter(m => {
        const key = String(m.id || `${m.date}|${m.time}|${m.team1?.name}|${m.team2?.name}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    currentRenderedMatches = matches;

    if (!matches.length) {
        const today = getTodayString();
        const isPastDate = currentDate < today;
        const isFutureDate = currentDate > today;
        if (isPastDate) {
            container.innerHTML = '<div class="empty-state"><div class="icon">📅</div><div class="title">No historical data</div><div class="desc">Match data for past dates is not available yet.</div></div>';
        } else if (isFutureDate) {
            container.innerHTML = '<div class="empty-state"><div class="icon">⏳</div><div class="title">No upcoming matches</div><div class="desc">No matches have been scheduled for this date yet.</div></div>';
        } else {
            container.innerHTML = '<div class="empty-state"><div class="icon">📭</div><div class="title">No live matches right now</div><div class="desc">Check back later for live match updates.</div></div>';
        }
        updateLiveNowSidebar();
        return;
    }

    // Group by league
    const groupedByLeague = {};
    matches.forEach(m => { const league = m?.league || 'Other'; (groupedByLeague[league] ||= []).push(m); });
    const sortedLeagues = Object.keys(groupedByLeague).sort((a,b) => groupedByLeague[b].length - groupedByLeague[a].length);

    let html = '';
    sortedLeagues.forEach(league => {
        const leagueMatches = groupedByLeague[league];
        const leagueIcon = leagueMatches[0]?.icon || '🏟️';
        html += `<div class="league-section">
            <div class="league-header">
                <div class="league-title">${escHtml(leagueIcon)} ${escHtml(league)}</div>
                <span class="league-view-all" onclick="filterByLeague('${escHtml(league)}')">View All ›</span>
            </div>`;

        leagueMatches.forEach(match => {
            const status = getMatchStatus(match);
            const id = String(match?.id ?? '');
            const team1 = match?.team1 || { name: 'Home Team' };
            const team2 = match?.team2 || { name: 'Away Team' };
            let s1 = scoreValue(match?.score?.team1);
            let s2 = scoreValue(match?.score?.team2);
            if (match.sport === 'cricket' && match.innings && match.innings.length >= 2) {
                const inn = match.innings;
                const lastT1 = (inn[0] || []).filter(i => i && i.runs && i.runs !== '-');
                const lastT2 = (inn[1] || []).filter(i => i && i.runs && i.runs !== '-');
                if (lastT1.length > 0) s1 = lastT1[lastT1.length - 1].runs;
                if (lastT2.length > 0) s2 = lastT2[lastT2.length - 1].runs;
            }
            const idJson = JSON.stringify(id);
            const time = match?.time && match.time !== '00:00' ? match.time : 'TBA';
            const active = selectedMatch && String(selectedMatch.id) === id;
            const isFav = typeof Favorites !== 'undefined' && Favorites.isFavorite(id);
            const t1Name = escHtml(cleanDisplayName(team1.name || 'Home'));
            const t2Name = escHtml(cleanDisplayName(team2.name || 'Away'));

            // Center content based on status
            let centerHtml = '';
            if (status === 'live') {
                const hasS1 = s1 && s1 !== '-';
                const hasS2 = s2 && s2 !== '-';
                centerHtml = `<div class="mc-score">${hasS1 ? escHtml(s1) : '-'}</div>
                    <span class="mc-score-sep">-</span>
                    <div class="mc-score">${hasS2 ? escHtml(s2) : '-'}</div>`;
            } else if (status === 'finished') {
                const hasS1 = s1 && s1 !== '-';
                const hasS2 = s2 && s2 !== '-';
                centerHtml = hasS1 || hasS2
                    ? `<div class="mc-score">${hasS1 ? escHtml(s1) : '-'}</div><span class="mc-score-sep">-</span><div class="mc-score">${hasS2 ? escHtml(s2) : '-'}</div>`
                    : `<div class="mc-time">${escHtml(time)}</div><div class="mc-subtitle">${escHtml(formatDate(match.date))}</div>`;
            } else {
                centerHtml = `<div class="mc-time">${escHtml(time)}</div><div class="mc-subtitle">Today</div>`;
            }

            // Right side - Preview button for upcoming, fav for all
            const rightHtml = status === 'upcoming'
                ? `<button class="mc-preview-btn" onclick="event.stopPropagation();selectMatch(${idJson})">Preview</button>`
                : `<button class="fav-btn ${isFav ? 'active' : ''}" data-match-id="${escHtml(id)}" onclick="event.stopPropagation();toggleFavorite('${escHtml(id)}')" title="${isFav ? 'Remove from Favorites' : 'Add to Favorites'}"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>`;

            // Team dot color
            const dotColors = { football:'#3b82f6', cricket:'#10b981', basketball:'#f97316', tennis:'#8b5cf6', mma:'#ef4444', ufc:'#dc2626', nfl:'#6366f1' };
            const dotColor = dotColors[match.sport] || '#747A84';

            html += `<div class="match-card-wrapper">
                <div class="match-card ${status} ${active ? 'active' : ''}" data-match-id="${escHtml(id)}" onclick='selectMatch(${idJson})'>
                    <div class="mc-left">
                        <div class="mc-team-dot" style="background:${dotColor}"></div>
                        <div class="mc-team-name">${t1Name}</div>
                    </div>
                    <div class="mc-center">
                        ${centerHtml}
                    </div>
                    <div class="mc-right">
                        <div class="mc-team-name" style="text-align:right">${t2Name}</div>
                        ${rightHtml}
                    </div>
                </div>
                <div class="match-detail-accordion" id="accordion-${escHtml(id)}" style="display:none"></div>
            </div>`;
        });
        html += '</div>';
    });

    container.innerHTML = html;

    matches.forEach(m => {
        if (getMatchStatus(m) === 'upcoming' && m.date && m.time && m.time !== '00:00') {
            startCountdown(String(m.id), m.date, m.time);
        }
    });
    if (selectedMatch) {
        const acc = document.getElementById(`accordion-${CSS.escape(String(selectedMatch.id))}`);
        if (acc) { renderAccordionContent(selectedMatch, acc); acc.style.display = 'block'; }
    }
    updateLiveNowSidebar();
}

// Update live scores in-place without rebuilding DOM
function updateLiveScoresInPlace(matches, container) {
    if (!container) container = document.getElementById('match-list');
    if (!container) return false;

    if (currentSport !== 'all') matches = matches.filter(m => m.sport === currentSport);
    if (currentLeagueFilter) matches = matches.filter(m => m.league === currentLeagueFilter);
    if (_statusFilter !== 'all') matches = matches.filter(m => getMatchStatus(m) === _statusFilter);

    matches = matches.map(normalizeDisplayMatch).filter(Boolean);
    const seen = new Set();
    matches = matches.filter(m => {
        const key = String(m.id || `${m.date}|${m.time}|${m.team1?.name}|${m.team2?.name}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const existingCards = container.querySelectorAll('.match-card[data-match-id]');
    const existingIds = new Set();
    existingCards.forEach(card => existingIds.add(card.getAttribute('data-match-id')));

    const newIds = new Set(matches.map(m => String(m.id)));
    const hasStructureChange = existingIds.size !== newIds.size || [...newIds].some(id => !existingIds.has(id));

    if (hasStructureChange) return false;

    matches.forEach(match => {
        const id = String(match.id);
        const card = container.querySelector(`.match-card[data-match-id="${CSS.escape(id)}"]`);
        if (!card) return;

        const status = getMatchStatus(match);
        let s1 = scoreValue(match.score?.team1);
        let s2 = scoreValue(match.score?.team2);
        if (match.sport === 'cricket' && match.innings && match.innings.length >= 2) {
            const inn = match.innings;
            const lastT1 = (inn[0] || []).filter(i => i && i.runs && i.runs !== '-');
            const lastT2 = (inn[1] || []).filter(i => i && i.runs && i.runs !== '-');
            if (lastT1.length > 0) s1 = lastT1[lastT1.length - 1].runs;
            if (lastT2.length > 0) s2 = lastT2[lastT2.length - 1].runs;
        }

        card.className = card.className.replace(/\b(live|finished|upcoming)\b/g, '').trim() + ' ' + status;
        if (selectedMatch && String(selectedMatch.id) === id) card.classList.add('active');

        const center = card.querySelector('.mc-center');
        if (center) {
            const hasS1 = s1 && s1 !== '-';
            const hasS2 = s2 && s2 !== '-';
            if (status === 'live') {
                center.innerHTML = `<div class="mc-score live">${hasS1 ? escHtml(s1) : '-'}</div><span class="mc-score-sep">-</span><div class="mc-score live">${hasS2 ? escHtml(s2) : '-'}</div>`;
            } else if (status === 'finished' && (hasS1 || hasS2)) {
                center.innerHTML = `<div class="mc-score">${hasS1 ? escHtml(s1) : '-'}</div><span class="mc-score-sep">-</span><div class="mc-score">${hasS2 ? escHtml(s2) : '-'}</div>`;
            }
        }

        if (selectedMatch && String(selectedMatch.id) === id) {
            const acc = document.getElementById(`accordion-${CSS.escape(id)}`);
            if (acc && acc.style.display !== 'none') {
                renderAccordionContent(match, acc);
            }
        }
    });

    currentRenderedMatches = matches;
    updateLiveNowSidebar();
    return true;
}

// Select match - toggle accordion
function selectMatch(matchId, updateUrl = true) {
    const match = currentRenderedMatches.find(m => String(m.id) === String(matchId));

    if (!match) return;

    const wasActive = selectedMatch && String(selectedMatch.id) === String(matchId);

    // Close all accordions
    document.querySelectorAll('.match-detail-accordion').forEach(acc => {
        acc.style.display = 'none';
        acc.innerHTML = '';
    });
    document.querySelectorAll('.match-card, .ufc-card').forEach(card => {
        card.classList.remove('active');
    });

    if (wasActive) {
        selectedMatch = null;
        if (updateUrl) clearMatchSlug();
        return;
    }

    selectedMatch = match;
    if (updateUrl) setMatchSlug(match);

    const matchCard = document.querySelector(`[data-match-id="${CSS.escape(matchId)}"]`);
    if (matchCard) matchCard.classList.add('active');

    const accordion = document.getElementById(`accordion-${matchId}`);
    if (accordion) {
        renderAccordionContent(match, accordion);
        accordion.style.display = 'block';
        accordion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Render accordion content
function renderAccordionContent(match, container) {
    if (!match || !container) return;
    const status=getMatchStatus(match), t1=match.team1||{name:'Home Team'}, t2=match.team2||{name:'Away Team'};
    const s1=scoreValue(match.score?.team1), s2=scoreValue(match.score?.team2);
    const isCricket = match.sport === 'cricket';

    let scoreSection = '';
    if (isCricket) {
        const sClass = status === 'live' ? ' live' : '';
        const statusLabel = status==='live'?'LIVE':status==='finished'?'FINISHED':'UPCOMING';
        const isTest = match.innings && match.innings.length >= 2;

        if (isTest) {
            const inn = match.innings;
            const t1inn = inn[0] || [];
            const t2inn = inn[1] || [];
            const fmt = v => (!v || v === '-') ? '-' : escHtml(v);
            const fmtOvers = v => (!v || v === '') ? '' : escHtml(v);
            scoreSection = `
            <div class="cricket-test-display">
              <div class="cricket-test-innings">
                <div class="cricket-innings-row">
                  <span class="cricket-inn-label">1st</span>
                  <span class="cricket-inn-runs">${fmt(t1inn[0]?.runs)}</span>
                  <span class="cricket-inn-overs">${fmtOvers(t1inn[0]?.overs)}</span>
                </div>
                <div class="cricket-innings-row">
                  <span class="cricket-inn-label">2nd</span>
                  <span class="cricket-inn-runs">${fmt(t1inn[1]?.runs)}</span>
                  <span class="cricket-inn-overs">${fmtOvers(t1inn[1]?.overs)}</span>
                </div>
              </div>
              <div class="cricket-vs-badge">VS</div>
              <div class="cricket-test-innings">
                <div class="cricket-innings-row">
                  <span class="cricket-inn-label">1st</span>
                  <span class="cricket-inn-runs">${fmt(t2inn[0]?.runs || '-')}</span>
                  <span class="cricket-inn-overs">${fmtOvers(t2inn[0]?.overs)}</span>
                </div>
                <div class="cricket-innings-row">
                  <span class="cricket-inn-label">2nd</span>
                  <span class="cricket-inn-runs">${fmt(t2inn[1]?.runs || '-')}</span>
                  <span class="cricket-inn-overs">${fmtOvers(t2inn[1]?.overs)}</span>
                </div>
              </div>
            </div>
            ${match.target ? `<div class="cricket-target">Target ${escHtml(match.target)}</div>` : ''}
            ${match.result ? `<div class="cricket-result">${escHtml(match.result)}</div>` : ''}
`;
        } else {
            const fmt = v => (!v || v === '-') ? '<span class="cricket-score-pending">YET TO BAT</span>' : escHtml(v);
            const fmtOvers = v => (!v || v === '') ? '' : escHtml(v);
            scoreSection = `
            <div class="cricket-score-display">
              <div class="cricket-score-block">
                <div class="cricket-score-num${sClass}">${fmt(s1)}</div>
                <div class="cricket-score-overs">${fmtOvers(match.overs?.team1)}</div>
              </div>
              <div class="cricket-vs-badge">VS</div>
              <div class="cricket-score-block">
                <div class="cricket-score-num${sClass}">${fmt(s2)}</div>
                <div class="cricket-score-overs">${fmtOvers(match.overs?.team2)}</div>
              </div>
            </div>
`;
        }
    } else {
        scoreSection = '';
    }

    container.innerHTML=`<div class="accordion-content">
      ${scoreSection}
      <div class="accordion-info">
        <div class="accordion-row"><span class="accordion-row-label">📅 Date</span><span class="accordion-row-value">${escHtml(formatDate(match.date))}</span></div>
        <div class="accordion-row"><span class="accordion-row-label">⏰ Time</span><span class="accordion-row-value">${escHtml(match.time&&match.time!=='00:00'?match.time:'TBA')}</span></div>
        ${match.venue?`<div class="accordion-row"><span class="accordion-row-label">📍 Venue</span><span class="accordion-row-value">${escHtml(match.venue)}</span></div>`:''}
        <div class="accordion-row"><span class="accordion-row-label">🏆 League</span><span class="accordion-row-value">${escHtml(match.league||'Other')}</span></div>
        ${match.statusText?`<div class="accordion-row"><span class="accordion-row-label">ℹ️ Status</span><span class="accordion-row-value">${escHtml((() => { const s = match.statusText.toLowerCase(); if (s.includes('abnormal') || s.includes('unknown') || s.includes('invalid')) return getMatchStatus(match)==='live'?'Live':getMatchStatus(match)==='finished'?'Finished':'Scheduled'; return match.statusText; })())}</span></div>`:''}
      </div>
      ${status==='live'?`<div class="accordion-live-section"><button class="accordion-live-btn" onclick="event.stopPropagation();window.open('https://www.google.com/search?q=${encodeURIComponent((t1.name||'')+' vs '+(t2.name||'')+' live stream')}','_blank')">▶ Watch Live</button></div>`:''}
      <div class="accordion-players-section"><div id="players-${escHtml(String(match.id))}-team1" class="player-roster-section" style="display:none"></div><div id="player-detail-${escHtml(String(match.id))}-team1" class="player-detail-section" style="display:none"></div><div id="players-${escHtml(String(match.id))}-team2" class="player-roster-section" style="display:none"></div><div id="player-detail-${escHtml(String(match.id))}-team2" class="player-detail-section" style="display:none"></div></div>
    </div>`;
}

// Close all accordions
function closeAllAccordions() {
    document.querySelectorAll('.match-detail-accordion').forEach(acc => {
        acc.style.display = 'none';
        acc.innerHTML = '';
    });
    document.querySelectorAll('.match-card').forEach(card => {
        card.classList.remove('active');
    });
    selectedMatch = null;
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Update league list in sidebar
function updateLeagueList(matches) {
    // Update Top Leagues sidebar
    const container = document.getElementById('top-leagues-list');
    if (!container) return;

    if (!matches || matches.length === 0) {
        container.innerHTML = '<div style="padding:0.5rem;color:var(--muted);font-size:0.82rem">No leagues available</div>';
        return;
    }

    const leagueCount = {};
    matches.forEach(match => {
        const league = match.league || 'Other';
        if (!leagueCount[league]) {
            leagueCount[league] = { count: 0, icon: match.icon || '🏟️' };
        }
        leagueCount[league].count++;
    });

    const sortedLeagues = Object.entries(leagueCount).sort((a, b) => b[1].count - a[1].count);
    container.innerHTML = sortedLeagues.slice(0, 6).map(([league, data]) => {
        return `<div class="top-league-item" onclick="filterByLeague('${esc(league)}')">${escHtml(league)} <span class="top-league-arrow">›</span></div>`;
    }).join('');
}

// Filter matches by status
let _statusFilter = 'all';

function filterByStatus(status) {
    _statusFilter = status;
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });
    renderWithLiveFirst();
}

function renderWithLiveFirst() {
    const container = document.getElementById('match-list');
    if (!container) return;
    const matches = getMatchesForDate(currentDate);
    let filtered = matches;
    if (currentSport !== 'all') filtered = filtered.filter(m => m.sport === currentSport);
    if (currentLeagueFilter) filtered = filtered.filter(m => m.league === currentLeagueFilter);
    if (_statusFilter !== 'all') {
        filtered = filtered.filter(m => getMatchStatus(m) === _statusFilter);
    }
    renderMatchList(filtered, container);
}

function filterLiveMatches() {
    if (_statusFilter === 'live') {
        filterByStatus('all');
    } else {
        filterByStatus('live');
    }
}

function updateLiveFilterBtn() {
    const matches = getMatchesForDate(currentDate);
    const liveCount = matches.filter(m => getMatchStatus(m) === 'live').length;
    const liveBtn = document.querySelector('.status-filter-btn.live');
    if (liveBtn) {
        liveBtn.style.display = liveCount > 0 ? '' : 'none';
    }
}

// Filter matches by league
let currentLeagueFilter = null;

function filterByLeague(league) {
    if (currentLeagueFilter === league) {
        currentLeagueFilter = null;
    } else {
        currentLeagueFilter = league;
    }
    loadMatchesForDate(currentDate);
}

// Set API key
function setMyApiKey(key) {
    setApiKey(key);
    loadMatchesForDate(currentDate);
    console.log('API key set! Fetching live data...');
}

// Profile toggle
function toggleProfile() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Mobile calendar toggle (no-op - mobile uses date pills now)
function toggleMobileCalendar() {}

// Mobile sidebar toggle (no-op - mobile uses bottom nav now)
function toggleMobileSidebar() {}
function closeMobileSidebar() {}

// Close profile dropdown when clicking outside
document.addEventListener('click', function(e) {
    if (!e.target.closest('.profile-btn')) {
        const dropdown = document.getElementById('profile-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    }
});

// ===== Live Score Auto-Refresh Agent (every 60 seconds) =====
let _liveAgentInterval = null;
let _lastRefreshTime = 0;

function startLiveAgent() {
    stopLiveAgent();
    _liveAgentInterval = setInterval(async () => {
        const today = getTodayString();
        if (currentDate !== today) return;

        const now = Date.now();
        if (now - _lastRefreshTime < 14000) return;
        _lastRefreshTime = now;

        console.log('🔄 Live Agent: refreshing scores...');
        try {
            const result = await autoFetchMatches();
            if (currentDate !== today) return;

            const hasLive = Object.values(result).some(arr => arr && arr.length > 0);
            if (hasLive) {
                const existing = DATE_CACHE[today] || {};
                ['cricket','football','basketball','tennis','mma','ufc','nfl'].forEach(sport => {
                    if (result[sport] && result[sport].length > 0) {
                        const apiMatches = result[sport];
                        const existingMatches = existing[sport] || [];
                        const merged = [...existingMatches];
                        apiMatches.forEach(apiM => {
                            const apiId = String(apiM.id);
                            let idx = merged.findIndex(e => String(e.id) === apiId);
                            if (idx < 0) {
                                const normName = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                const apiT1 = normName(apiM.team1?.name);
                                const apiT2 = normName(apiM.team2?.name);
                                idx = merged.findIndex(e => {
                                    const eT1 = normName(e.team1?.name);
                                    const eT2 = normName(e.team2?.name);
                                    return (eT1 === apiT1 && eT2 === apiT2) || (eT1 === apiT2 && eT2 === apiT1);
                                });
                            }
                            if (idx >= 0) {
                                const ex = merged[idx];
                                const hasScore = v => v && v !== '-' && v !== '';
                                const _mergeDate = ex.date || '';
                                const _isPastMatch = _mergeDate && _mergeDate < getTodayString();
                                if (!_isPastMatch) {
                                    if (apiM.status === 'live') ex.status = 'live';
                                    else if (apiM.status) ex.status = apiM.status;
                                    if (apiM.statusText && apiM.statusText.length > (ex.statusText || '').length) ex.statusText = apiM.statusText;
                                }
                                if (hasScore(apiM.score?.team1)) { ex.score = ex.score || {}; ex.score.team1 = apiM.score.team1; }
                                if (hasScore(apiM.score?.team2)) { ex.score = ex.score || {}; ex.score.team2 = apiM.score.team2; }
                                if (apiM.overs?.team1) { ex.overs = ex.overs || {}; ex.overs.team1 = apiM.overs.team1; }
                                if (apiM.overs?.team2) { ex.overs = ex.overs || {}; ex.overs.team2 = apiM.overs.team2; }
                                if (apiM.innings && apiM.innings.some(arr => arr && arr.length > 0)) {
                                    if (!_isPastMatch && (!ex.innings || !ex.innings.some(arr => arr && arr.length > 0))) {
                                        ex.innings = apiM.innings;
                                    }
                                }
                                if (apiM.team1?.logo && !ex.team1?.logo) ex.team1.logo = apiM.team1.logo;
                                if (apiM.team2?.logo && !ex.team2?.logo) ex.team2.logo = apiM.team2.logo;
                            } else {
                                merged.push(apiM);
                            }
                        });
                        existing[sport] = merged;
                    }
                });
                DATE_CACHE[today] = existing;
            }

            const fresh = getMatchesForDate(today);
            if (fresh.length > 0) {
                await enrichMatchLogos(fresh);
                const container = document.getElementById('match-list');
                if (container && currentDate === today) {
                    const updated = updateLiveScoresInPlace(fresh, container);
                    if (!updated) {
                        if (_statusFilter !== 'all') {
                            renderWithLiveFirst();
                        } else {
                            filterAndRender(fresh, container);
                        }
                    }
                }
            }
            console.log('✅ Live Agent: refresh complete');
        } catch (e) {
            console.log('⚠️ Live Agent refresh failed:', e.message);
        }
    }, 5000);
}

function stopLiveAgent() {
    if (_liveAgentInterval) {
        clearInterval(_liveAgentInterval);
        _liveAgentInterval = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    startLiveAgent();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopLiveAgent();
    } else {
        startLiveAgent();
    }
});

// ===== Inline Player Accordion =====

const teamRosterCache = {};
const playerDetailCache = {};

async function toggleTeamPlayers(matchId, teamKey, teamName, teamLogo) {
    const accordion = document.getElementById(`accordion-${matchId}`);
    if (!accordion || accordion.style.display === 'none') {
        selectMatch(matchId);
    }

    const playerSection = document.getElementById(`players-${matchId}-${teamKey}`);
    if (!playerSection) return;

    if (playerSection.style.display === 'block') {
        playerSection.style.display = 'none';
        return;
    }

    playerSection.style.display = 'block';
    playerSection.innerHTML = `<div class="player-loading"><div class="loading-spinner"></div><p>Loading ${teamName}...</p></div>`;

    const cacheKey = teamName;
    if (!teamRosterCache[cacheKey]) {
        const match = currentRenderedMatches.find(m => String(m.id) === String(matchId));
        const isUFC = match && (match.sport === 'ufc' || match.sport === 'mma');

        if (isUFC) {
            const players = await searchTheSportsDBPlayer(teamName);
            const fighter = players.find(p => {
                const pname = (p.strPlayer || '').toLowerCase();
                const tname = teamName.toLowerCase();
                return pname === tname || pname.includes(tname) || tname.includes(pname);
            }) || players[0] || null;
            if (fighter) {
                teamRosterCache[cacheKey] = [fighter];
            } else {
                teamRosterCache[cacheKey] = [];
            }
        } else {
            const team = await searchTheSportsDBTeam(teamName);
            if (!team) {
                playerSection.innerHTML = `<div class="player-empty">Team data not available.</div>`;
                return;
            }
            const roster = await fetchTeamRoster(team.id);
            teamRosterCache[cacheKey] = roster.filter(p => p.strPlayer && p.strPosition !== 'Manager' && p.strPosition !== 'Assistant Coach');
        }
    }

    const players = teamRosterCache[cacheKey];
    if (players.length === 0) {
        playerSection.innerHTML = `<div class="player-empty">No player data available.</div>`;
        return;
    }

    const isUFCFighter = players.length === 1 && players[0].strPlayer;
    if (isUFCFighter) {
        const p = players[0];
        playerSection.innerHTML = `
            <div class="player-blog" style="display:block;margin-top:0">
                <div class="player-blog-top">
                    <img src="${p.strCutout || p.strThumb || ''}" alt="" class="player-blog-photo" onerror="this.style.display='none'">
                    <div class="player-blog-info">
                        <h4 class="player-blog-name">${p.strPlayer || teamName}</h4>
                        <span class="player-blog-team">${p.strTeam || p.strNationality || ''}</span>
                    </div>
                </div>
                <div class="player-blog-stats">
                    ${p.strNationality ? `<div class="player-stat"><span class="player-stat-label">Nationality</span><span class="player-stat-value">${p.strNationality}</span></div>` : ''}
                    ${p.strHeight ? `<div class="player-stat"><span class="player-stat-label">Height</span><span class="player-stat-value">${p.strHeight}</span></div>` : ''}
                    ${p.strWeight ? `<div class="player-stat"><span class="player-stat-label">Weight</span><span class="player-stat-value">${p.strWeight}</span></div>` : ''}
                    ${p.strPosition ? `<div class="player-stat"><span class="player-stat-label">Weight Class</span><span class="player-stat-value">${p.strPosition}</span></div>` : ''}
                    ${p.strGender === 'Male' ? `<div class="player-stat"><span class="player-stat-label">Gender</span><span class="player-stat-value">Male</span></div>` : ''}
                    ${p.strGender === 'Female' ? `<div class="player-stat"><span class="player-stat-label">Gender</span><span class="player-stat-value">Female</span></div>` : ''}
                </div>
                ${p.strDescriptionEN ? `<div class="player-blog-desc">${p.strDescriptionEN.split('\n').filter(x => x.trim()).slice(0,3).map(x => `<p>${x.trim()}</p>`).join('')}</div>` : ''}
            </div>
        `;
    } else {
        playerSection.innerHTML = `
            <div class="player-roster-grid">
                ${players.map(p => `
                    <div class="player-roster-card" onclick="event.stopPropagation(); togglePlayerDetail('${esc(matchId)}', '${esc(teamKey)}', '${esc(p.idPlayer)}')">
                        <img src="${p.strThumb || ''}" alt="" class="player-roster-img" onerror="this.style.display='none'">
                        <div class="player-roster-info">
                            <span class="player-roster-name">${p.strPlayer}</span>
                            <span class="player-roster-pos">${p.strPosition || ''}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

async function togglePlayerDetail(matchId, teamKey, playerId) {
    const detailBox = document.getElementById(`player-detail-${matchId}-${teamKey}`);
    if (!detailBox) return;

    if (detailBox.style.display === 'block') {
        detailBox.style.display = 'none';
        return;
    }

    detailBox.style.display = 'block';
    detailBox.innerHTML = `<div class="player-loading"><div class="loading-spinner"></div></div>`;

    if (!playerDetailCache[playerId]) {
        playerDetailCache[playerId] = await fetchPlayerDetail(playerId);
    }

    const player = playerDetailCache[playerId];
    if (!player) {
        detailBox.innerHTML = `<div class="player-empty">Player details not available.</div>`;
        return;
    }

    const birthDate = player.dateBorn ? new Date(player.dateBorn).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const desc = player.strDescriptionEN || player.strDescription || '';

    detailBox.innerHTML = `
        <div class="player-blog">
            <div class="player-blog-top">
                <img src="${player.strCutout || player.strThumb || ''}" alt="" class="player-blog-photo" onerror="this.style.display='none'">
                <div class="player-blog-info">
                    <h4 class="player-blog-name">${player.strPlayer}</h4>
                    <span class="player-blog-team">${player.strTeam || ''}</span>
                </div>
            </div>
            <div class="player-blog-stats">
                ${player.strNationality ? `<div class="player-stat"><span class="player-stat-label">Nationality</span><span class="player-stat-value">${player.strNationality}</span></div>` : ''}
                ${player.strPosition ? `<div class="player-stat"><span class="player-stat-label">Position</span><span class="player-stat-value">${player.strPosition}</span></div>` : ''}
                ${birthDate ? `<div class="player-stat"><span class="player-stat-label">Born</span><span class="player-stat-value">${birthDate}</span></div>` : ''}
                ${player.strHeight ? `<div class="player-stat"><span class="player-stat-label">Height</span><span class="player-stat-value">${player.strHeight}</span></div>` : ''}
                ${player.strWeight ? `<div class="player-stat"><span class="player-stat-label">Weight</span><span class="player-stat-value">${player.strWeight}</span></div>` : ''}
                ${player.strStatus ? `<div class="player-stat"><span class="player-stat-label">Status</span><span class="player-stat-value">${player.strStatus}</span></div>` : ''}
            </div>
            ${desc ? `<div class="player-blog-desc">${desc.split('\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('')}</div>` : ''}
        </div>
    `;
}

// ===== Blog View =====
function showBlogView(name, date, time, league, sport) {
    const blogView = document.getElementById('blog-view');
    const mainContent = document.getElementById('main-content');
    const nflPage = document.getElementById('nfl-page');
    if (!blogView) return;
    blogView.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    if (nflPage) nflPage.style.display = 'none';

    document.getElementById('blog-team1-name').textContent = name || 'Team 1';
    document.getElementById('blog-team2-name').textContent = name || 'Team 2';
    document.getElementById('blog-title').textContent = (name || 'Match') + ' — Match Preview';
    document.getElementById('blog-date').textContent = '📅 ' + (date || 'TBA');
    document.getElementById('blog-league').textContent = '🏅 ' + (league || 'League');
    document.getElementById('blog-time').textContent = '⏱️ ' + (time || 'TBA');
    document.getElementById('blog-match-date').textContent = date || '-';
    document.getElementById('blog-match-time').textContent = time || '-';
    document.getElementById('blog-match-league').textContent = league || '-';
    document.getElementById('blog-match-status').textContent = 'Upcoming';
    document.getElementById('blog-tag-sport').textContent = '⚽ ' + (sport || 'Football');
    document.getElementById('blog-tag-league').textContent = league || 'League';

    const shareUrl = window.location.origin + '/blog.html?match=' + encodeURIComponent(name || '') + '&date=' + encodeURIComponent(date || '') + '&time=' + encodeURIComponent(time || '') + '&league=' + encodeURIComponent(league || '') + '&sport=' + encodeURIComponent(sport || '');
    document.getElementById('share-twitter').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(name || 'Match Preview') + '&url=' + encodeURIComponent(shareUrl);
    document.getElementById('share-facebook').href = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl);

    window.history.pushState({ blog: true }, '', '/blog.html?match=' + encodeURIComponent(name || '') + '&date=' + encodeURIComponent(date || '') + '&time=' + encodeURIComponent(time || '') + '&league=' + encodeURIComponent(league || '') + '&sport=' + encodeURIComponent(sport || ''));
    window.scrollTo(0, 0);
}

function hideBlogView() {
    const blogView = document.getElementById('blog-view');
    const mainContent = document.getElementById('main-content');
    if (blogView) blogView.style.display = 'none';
    if (mainContent) mainContent.style.display = '';
    updateUrl(currentSport, currentDate, null);
    window.scrollTo(0, 0);
}

function copyBlogLink() {
    const url = window.location.href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            const btn = document.querySelector('.blog-share-btn:last-child');
            if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy Link', 2000); }
        });
    }
}
