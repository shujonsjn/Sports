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
    // Check for blog URL FIRST - before ANY init
    const urlParams = new URLSearchParams(window.location.search);
    const blogName = urlParams.get('match') || '';
    if (blogName) {
        const matchDate = urlParams.get('date') || '';
        const matchTime = urlParams.get('time') || '';
        const matchLeague = urlParams.get('league') || '';
        const matchSport = urlParams.get('sport') || '';
        const matchStatus = urlParams.get('status') || '';

        // Show blog view IMMEDIATELY - no flash of home page
        const mc = document.getElementById('main-content');
        const bv = document.getElementById('blog-view');
        if (mc) mc.style.display = 'none';
        if (bv) bv.style.display = 'block';

        // Set sport/date
        currentSport = matchSport || currentSport;
        currentDate = matchDate || currentDate;

        initTheme();
        initNavigation();
        initSearch();
        renderDatePills();
        await loadMatchesForDate(currentDate);
        showBlogView(blogName, matchDate, matchTime, matchLeague, matchSport, matchStatus);
        return;
    }

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
    showAllPills();

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
        desktopContainer.innerHTML += `<button class="date-pill" onclick="pickCustomDate(event)" title="Pick a date">📅 ${today.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</button>`;
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

var calViewDate = null;
var calPopup = null;

function pickCustomDate(e) {
    calPopup = document.getElementById('calendar-popup');
    if (!calPopup) return;
    const parts = currentDate.split('-');
    calViewDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (calPopup.style.display === 'none') {
        renderCalendar();
        var btn = e ? e.currentTarget : document.querySelector('.date-pill:last-child');
        if (btn) {
            var rect = btn.getBoundingClientRect();
            calPopup.style.top = (rect.bottom + 4) + 'px';
            calPopup.style.left = rect.left + 'px';
        }
        calPopup.style.display = 'block';
        setTimeout(function(){ document.addEventListener('click', calCloseOutside); }, 0);
    } else {
        closeCalendar();
    }
}

function calCloseOutside(e) {
    var popup = document.getElementById('calendar-popup');
    if (popup && !popup.contains(e.target) && !e.target.closest('.date-pill')) {
        closeCalendar();
    }
}

function closeCalendar() {
    var popup = document.getElementById('calendar-popup');
    if (popup) popup.style.display = 'none';
    document.removeEventListener('click', calCloseOutside);
}

function calPrevMonth() {
    calViewDate.setMonth(calViewDate.getMonth() - 1);
    renderCalendar();
}

function calNextMonth() {
    calViewDate.setMonth(calViewDate.getMonth() + 1);
    renderCalendar();
}

function renderCalendar() {
    var titleEl = document.getElementById('cal-title');
    var daysEl = document.getElementById('cal-days');
    if (!titleEl || !daysEl) return;

    var year = calViewDate.getFullYear();
    var month = calViewDate.getMonth();
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    titleEl.textContent = monthNames[month] + ' ' + year;

    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrev = new Date(year, month, 0).getDate();

    var html = '';
    // Previous month trailing days
    for (var p = firstDay - 1; p >= 0; p--) {
        html += '<button class="cal-day other-month" disabled>' + (daysInPrev - p) + '</button>';
    }
    // Current month days
    for (var d = 1; d <= daysInMonth; d++) {
        var ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var cls = 'cal-day';
        if (ds === todayStr) cls += ' today';
        if (ds === currentDate) cls += ' selected';
        html += '<button class="' + cls + '" onclick="calSelectDate(\'' + ds + '\')">' + d + '</button>';
    }
    // Next month leading days
    var totalCells = firstDay + daysInMonth;
    var remaining = (7 - (totalCells % 7)) % 7;
    for (var n = 1; n <= remaining; n++) {
        html += '<button class="cal-day other-month" disabled>' + n + '</button>';
    }

    daysEl.innerHTML = html;
}

function calSelectDate(dateStr) {
    loadMatchesForDate(dateStr);
    renderDatePills();
    closeCalendar();
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

        return `<div class="live-mini-card" onclick="showBlogView('${esc(t1 + ' vs ' + t2)}','${esc(match.date||'')}','${esc(match.time||'')}','${esc(match.league||'')}','${esc(match.sport||currentSport)}','live')">
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
            // Strip <...> tags (cricket overs like <9.2>)
            s1 = String(s1).replace(/<[^>]*>/g, '').trim();
            s2 = String(s2).replace(/<[^>]*>/g, '').trim();
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
            let centerClass = 'mc-center';
            if (status === 'live') {
                const hasS1 = s1 && s1 !== '-';
                const hasS2 = s2 && s2 !== '-';
                centerClass += ' mc-scores';
                centerHtml = `<div class="mc-score live">${hasS1 ? escHtml(s1) : '-'}</div>
                    <span class="mc-score-sep">-</span>
                    <div class="mc-score live">${hasS2 ? escHtml(s2) : '-'}</div>`;
            } else if (status === 'finished') {
                const hasS1 = s1 && s1 !== '-';
                const hasS2 = s2 && s2 !== '-';
                if (hasS1 || hasS2) {
                    centerClass += ' mc-scores';
                    centerHtml = `<div class="mc-score">${hasS1 ? escHtml(s1) : '-'}</div><span class="mc-score-sep">-</span><div class="mc-score">${hasS2 ? escHtml(s2) : '-'}</div>`;
                } else {
                    centerHtml = `<div class="mc-time">${escHtml(time)}</div><div class="mc-subtitle">${escHtml(formatDate(match.date))}</div>`;
                }
            } else {
                centerHtml = `<div class="mc-time">${escHtml(time)}</div><div class="mc-subtitle">Today</div>`;
            }

            // Helper for preview onclick
            const pvCall = `showBlogView('${esc((match.team1?.name||'') + ' vs ' + (match.team2?.name||''))}','${esc(match.date||'')}','${esc(match.time||'')}','${esc(match.league||'')}','${esc(currentSport)}','${esc(status)}')`;

            // Score/time values
            let t1Score = '', t2Score = '';
            if (status === 'live' || status === 'finished') {
                t1Score = (s1 && s1 !== '-') ? escHtml(s1) : '-';
                t2Score = (s2 && s2 !== '-') ? escHtml(s2) : '-';
            }

            // Score boxes (live/finished only)
            const scoreBoxHtml = (score) => `<div class="mc-score-box">${score}</div>`;
            const scoreRow = (status === 'live' || status === 'finished');

            // Status box on right side
            let statusBoxHtml = '';
            if (status === 'upcoming') {
                statusBoxHtml = `<div class="mc-status-box" onclick="event.stopPropagation();${pvCall}">
                    <div class="mc-time-val">${escHtml(time)}</div>
                    <div class="mc-time-label">UPCOMING</div>
                </div>`;
            } else if (status === 'live') {
                statusBoxHtml = `<div class="mc-status-box" onclick="event.stopPropagation();${pvCall}">
                    <div class="mc-status-text">LIVE</div>
                </div>`;
            } else {
                statusBoxHtml = `<div class="mc-status-box" onclick="event.stopPropagation();${pvCall}">
                    <div class="mc-status-text">Watch<br>Highlights</div>
                </div>`;
            }

            html += `<div class="match-card-wrapper">
                <div class="match-card ${status} ${active ? 'active' : ''}" data-match-id="${escHtml(id)}" onclick="${pvCall}">
                    <div class="mc-rows">
                        <div class="mc-team-row">
                            <div class="mc-logo-wrap mc-logo-t1"><img class="mc-logo-img" src="${escHtml(match.team1?.logo || '')}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy"><span class="mc-logo-fallback" style="display:${match.team1?.logo ? 'none' : 'flex'}">${escHtml((t1Name||'T')[0])}</span></div>
                            <div class="mc-team-name">${t1Name}</div>
                            ${scoreRow ? scoreBoxHtml(t1Score) : ''}
                        </div>
                        <div class="mc-team-row">
                            <div class="mc-logo-wrap mc-logo-t2"><img class="mc-logo-img" src="${escHtml(match.team2?.logo || '')}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" loading="lazy"><span class="mc-logo-fallback" style="display:${match.team2?.logo ? 'none' : 'flex'}">${escHtml((t2Name||'T')[0])}</span></div>
                            <div class="mc-team-name">${t2Name}</div>
                            ${scoreRow ? scoreBoxHtml(t2Score) : ''}
                        </div>
                    </div>
                    ${statusBoxHtml}
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
                center.classList.add('mc-scores');
                center.innerHTML = `<div class="mc-score live">${hasS1 ? escHtml(s1) : '-'}</div><span class="mc-score-sep">-</span><div class="mc-score live">${hasS2 ? escHtml(s2) : '-'}</div>`;
            } else if (status === 'finished' && (hasS1 || hasS2)) {
                center.classList.add('mc-scores');
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
    document.querySelectorAll('.match-card').forEach(card => {
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

    // Update Leagues sidebar section
    const leaguesContainer = document.getElementById('leagues-list');
    if (leaguesContainer) {
        if (sortedLeagues.length === 0) {
            leaguesContainer.innerHTML = '<div style="padding:0.5rem 1rem;color:var(--muted);font-size:0.82rem">No leagues</div>';
        } else {
            leaguesContainer.innerHTML = sortedLeagues.map(([league, data]) => {
                return `<div class="league-item" onclick="filterByLeague('${esc(league)}')">
                    <span class="league-item-icon">${data.icon}</span>
                    <span class="league-item-name">${escHtml(league)}</span>
                    <span class="league-item-count">${data.count}</span>
                </div>`;
            }).join('');
        }
    }
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

// ===== Match Preview View =====
function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val || ''; }
function hideAllPills() {
    var sb = document.getElementById('sidebar-right');
    var sl = document.getElementById('sidebar-left');
    if (sb) sb.style.display = 'none';
    if (sl) sl.style.display = 'none';
}
function showAllPills() {
    var sb = document.getElementById('sidebar-right');
    var sl = document.getElementById('sidebar-left');
    if (sb) sb.style.display = '';
    if (sl) sl.style.display = '';
}
function showBlogView(name, date, time, league, sport, status) {
    const pv = document.getElementById('blog-view');
    const mainContent = document.getElementById('main-content');
    const nflPage = document.getElementById('nfl-page');
    if (!pv) return;
    pv.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    if (nflPage) nflPage.style.display = 'none';
    hideAllPills();
    var df = document.getElementById('date-filters');
    if (df) df.style.display = 'none';

    var t1 = name || 'Team 1', t2 = 'Team 2';
    if (name && name.toLowerCase().includes(' vs ')) {
        var parts = name.split(/\s+vs\s+/i);
        t1 = parts[0]; t2 = parts[1] || 'Team 2';
    }
    var sportLabel = sport || 'Football';
    var leagueLabel = league || 'League';
    var st = (status || 'upcoming').toLowerCase();

    setText('pv-sport', sportLabel);
    setText('pv-league', leagueLabel);
    setText('pv-vs', t1 + ' vs ' + t2);
    setText('pv-league2', leagueLabel);
    setText('pv-title', t1 + ' vs ' + t2);
    setText('pv-t1-name', t1);
    setText('pv-t2-name', t2);
    setText('pv-time', time || 'TBA');
    setText('pv-date', formatDate(date || '') + (time ? ' • ' + time : ''));
    setText('pv-form-t1', t1);
    setText('pv-form-t2', t2);
    setText('pv-detail-league', leagueLabel);
    setText('pv-detail-date', date || '-');
    setText('pv-detail-time', time || '-');
    setText('pv-detail-venue', '-');
    setText('pv-info-date', date || '-');
    setText('pv-info-time', time || '-');
    setText('pv-time-label', 'Today');

    // For live/finished matches, show score instead of time in center
    if (st === 'live' || st === 'in' || st === 'finished' || st === 'post') {
        var matchData = (currentRenderedMatches || []).find(m => {
            var mn = ((m.team1?.name||'') + ' vs ' + (m.team2?.name||'')).toLowerCase();
            var sn = (name || '').toLowerCase();
            return mn === sn || mn.includes(sn) || sn.includes(mn.split(' vs ')[0]);
        });
        if (matchData) {
            var sc1 = String(matchData.score?.team1 || '').replace(/<[^>]*>/g, '').trim();
            var sc2 = String(matchData.score?.team2 || '').replace(/<[^>]*>/g, '').trim();
            if (sc1 && sc2) {
                setText('pv-time', sc1 + ' - ' + sc2);
                setText('pv-time-label', st === 'live' || st === 'in' ? 'Live' : 'Finished');
            }
        }
    }

    var t1Logo = document.getElementById('pv-t1-logo');
    var t2Logo = document.getElementById('pv-t2-logo');
    if (t1Logo) t1Logo.innerHTML = teamLogoHtml({name: t1, logo: fetchTeamLogo(t1)});
    if (t2Logo) t2Logo.innerHTML = teamLogoHtml({name: t2, logo: fetchTeamLogo(t2)});

    var badge = document.getElementById('pv-status-badge');
    if (badge) {
        if (st === 'live' || st === 'in') {
            badge.className = 'pv-status-badge live';
            badge.innerHTML = '<span class="pv-status-dot"></span> LIVE';
            setText('pv-detail-status', 'Live');
        } else if (st === 'finished' || st === 'post') {
            badge.className = 'pv-status-badge finished';
            badge.innerHTML = '<span class="pv-status-dot"></span> FINISHED';
            setText('pv-detail-status', 'Finished');
        } else {
            badge.className = 'pv-status-badge';
            badge.innerHTML = '<span class="pv-status-dot"></span> UPCOMING';
            setText('pv-detail-status', 'Upcoming');
        }
    }

    var watchBtn = document.getElementById('pv-watch-btn');
    if (watchBtn) {
        if (st === 'live' || st === 'in') {
            watchBtn.textContent = 'Watch Live ▶';
            watchBtn.className = 'pv-watch-btn live';
        } else if (st === 'finished' || st === 'post') {
            watchBtn.textContent = 'Watch Highlights ▶';
            watchBtn.className = 'pv-watch-btn';
        } else {
            // Upcoming - start countdown
            watchBtn.className = 'pv-watch-btn';
            var countdownDate = date;
            var countdownTime = time;
            function updateWatchCountdown() {
                if (!countdownDate || !countdownTime || countdownTime === 'TBA') {
                    watchBtn.textContent = 'Watch Live ▶';
                    return;
                }
                var now = new Date();
                var parts = countdownDate.split('-');
                var tParts = countdownTime.split(':');
                var match_dt = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), parseInt(tParts[0]||0), parseInt(tParts[1]||0), 0);
                var diff = match_dt - now;
                if (diff <= 0) {
                    watchBtn.textContent = 'Watch Live ▶';
                    watchBtn.className = 'pv-watch-btn live';
                    return;
                }
                var d = Math.floor(diff / 86400000);
                var h = Math.floor((diff % 86400000) / 3600000);
                var m = Math.floor((diff % 3600000) / 60000);
                var s = Math.floor((diff % 60000) / 1000);
                var label = d > 0 ? d + 'd ' : '';
                label += String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
                watchBtn.textContent = 'Watch Live ▶ ' + label;
                requestAnimationFrame(() => setTimeout(updateWatchCountdown, 1000));
            }
            updateWatchCountdown();
        }
    }

    var formDots1 = document.getElementById('pv-form-t1-dots');
    var formDots2 = document.getElementById('pv-form-t2-dots');
    if (formDots1) formDots1.innerHTML = ['w','w','w','d','w'].map(r => '<span class="pv-form-dot '+r+'">'+r.toUpperCase()+'</span>').join('');
    if (formDots2) formDots2.innerHTML = ['w','l','w','d','d'].map(r => '<span class="pv-form-dot '+r+'">'+r.toUpperCase()+'</span>').join('');

    pvTab(document.querySelector('.pv-tab'), 'preview');

    window.history.pushState({ blog: true }, '', '/blog.html?match=' + encodeURIComponent(name || '') + '&date=' + encodeURIComponent(date || '') + '&time=' + encodeURIComponent(time || '') + '&league=' + encodeURIComponent(league || '') + '&sport=' + encodeURIComponent(sport || ''));
    window.scrollTo(0, 0);
}

function hideBlogView() {
    const pv = document.getElementById('blog-view');
    const mainContent = document.getElementById('main-content');
    if (pv) pv.style.display = 'none';
    if (mainContent) mainContent.style.display = '';
    showAllPills();
    var df = document.getElementById('date-filters');
    if (df) df.style.display = '';
    updateUrl(currentSport, currentDate, null);
    initNavigation();
    window.scrollTo(0, 0);
}

function pvTab(el, tab) {
    document.querySelectorAll('.pv-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pv-tab-content').forEach(c => c.style.display = 'none');
    if (el) el.classList.add('active');
    var content = document.getElementById('pv-tab-' + tab);
    if (content) content.style.display = 'block';
}

function copyBlogLink() {
    var url = window.location.href;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
    }
}
