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
                const cat = c.sport === 'tennis' ? 'tabletennis' : c.sport;
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
    const fb = escHtml(initials);
    return `<div class="mc-logo"><img src="${escHtml(logo)}" alt="${escHtml(name)}" loading="lazy" onerror="this.onerror=null;this.outerHTML='<div class=\\'mc-logo\\'><span class=\\'team-initials\\'>${fb}</span></div>'"></div>`;
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
    initCalendar();
    initNavigation();
    initHamburger();
    initSearch();
    
    const savedCricketKey = localStorage.getItem('cricket_api_key');
    if (savedCricketKey) {
        const el = document.getElementById('cricket-api-key');
        if (el) el.value = savedCricketKey;
    }

    // Set sport from URL
    switchSport(currentSport, false);

    // Set calendar to correct date
    if (typeof highlightDate === 'function') highlightDate(currentDate);
    if (typeof updateSelectedDateDisplay === 'function') updateSelectedDateDisplay(currentDate);

    await loadMatchesForDate(currentDate);
    refreshCalendarEvents();

    // Check for match slug in URL
    const slugInfo = getMatchFromSlug();
    if (slugInfo) {
        // Try to find and select match after data loads
        setTimeout(() => {
            const match = findMatchBySlug(slugInfo);
            if (match) selectMatch(match.id, false);
        }, 1500);
    }

    console.log('🚀 Live Streaming initialized');

    // Start 60-day schedule agent (background, non-blocking)
    setTimeout(() => prefetchSchedule(), 2000);

    // Re-fetch schedule every hour (no cache, always fresh)
    setInterval(() => {
        console.log('📅 Schedule agent: re-fetching...');
        prefetchSchedule();
    }, 60 * 60 * 1000);
});

// Initialize navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.sport === currentSport) {
            btn.classList.add('active');
        }
    });
}

// Switch sport tab
function switchSport(sport, updateUrlFlag = true) {
    currentSport = sport;
    currentLeagueFilter = null;
    
    // Update active tab
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.sport === sport) {
            btn.classList.add('active');
        }
    });
    
    // Update schedule header
    const icons = { football: '⚽', cricket: '🏏', basketball: '🏀', tennis: '🎾', mma: '🥊', ufc: '🥋', nfl: '🏈' };
    const scheduleIcon = document.getElementById('schedule-icon');
    const scheduleTitle = document.getElementById('schedule-title');
    if (scheduleIcon) scheduleIcon.textContent = icons[sport] || '🏟️';
    if (scheduleTitle) scheduleTitle.textContent = `${sport.charAt(0).toUpperCase() + sport.slice(1)} Schedule`;
    
    // Close mobile menu
    const navContent = document.querySelector('.nav-content');
    if (navContent) navContent.classList.remove('active');
    
    if (updateUrlFlag) updateUrl(currentSport, currentDate, null);
    
    // Reload matches
    selectedMatch = null;
    loadMatchesForDate(currentDate);
    setTimeout(addMatchDots, 300);
}

// Initialize hamburger menu
function initHamburger() {
    const hamburger = document.getElementById('hamburger');
    const navContent = document.querySelector('.nav-content');

    if (hamburger && navContent) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            navContent.classList.toggle('active');
        });

        navContent.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                navContent.classList.remove('active');
            });
        });

        document.addEventListener('click', function(e) {
            if (!navContent.contains(e.target) && !hamburger.contains(e.target)) {
                navContent.classList.remove('active');
            }
        });
    }
}

// Filter matches by current sport/league and render
function filterAndRender(matches, container) {
    if (currentSport !== 'all') {
        matches = matches.filter(m => m.sport === currentSport);
    }
    if (currentLeagueFilter) {
        matches = matches.filter(m => m.league === currentLeagueFilter);
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
            container.innerHTML = '<div class="loading">Loading matches...</div>';
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
                ['cricket','football','basketball','tabletennis','mma','ufc','nfl'].forEach(sport => {
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
    matches = (Array.isArray(matches) ? matches : []).map(normalizeDisplayMatch).filter(Boolean);
    // Remove duplicate cards without changing the provider's match identity.
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
        container.innerHTML = `<div class="no-matches"><span class="icon">${isPastDate?'📅':isFutureDate?'⏳':'📭'}</span><p>${isPastDate?'No historical data available':isFutureDate?'No matches found for this date':'No matches scheduled for this date'}</p></div>`;
        return;
    }

    const groupedByLeague = {};
    matches.forEach(m => { const league = m?.league || 'Other'; (groupedByLeague[league] ||= []).push(m); });
    const sortedLeagues = Object.keys(groupedByLeague).sort((a,b)=>groupedByLeague[b].length-groupedByLeague[a].length);
    let html='';

    sortedLeagues.forEach(league => {
        const leagueMatches = groupedByLeague[league];
        const icons = [...new Set(leagueMatches.map(m=>m?.icon||'🏟️'))].join(' ');
        const compLogo = leagueMatches.find(m=>m?.competitionLogo)?.competitionLogo || '';
        const generic = sortedLeagues.length===1 && ['Football','Cricket','Basketball','Tennis','MMA','UFC','NFL'].includes(league) && !leagueMatches.some(m=>m?.competitionLogo);
        html += `<div class="league-group">${generic?'':`<div class="league-header">${compLogo?`<img src="${escHtml(compLogo)}" class="league-logo" alt="" loading="lazy" onerror="this.style.display='none'">`:`<span class="league-icons">${escHtml(icons)}</span>`}<span class="league-name">${escHtml(league)}</span><span class="league-count">${leagueMatches.length} match${leagueMatches.length>1?'es':''}</span></div>`}<div class="league-matches">`;

        leagueMatches.forEach(match => {
            const status = getMatchStatus(match);
            const id = String(match?.id ?? '');
            const team1 = match?.team1 || {name:'Home Team'};
            const team2 = match?.team2 || {name:'Away Team'};
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
            const time = match?.time && match.time!=='00:00' ? match.time : 'TBA';
            const label = status==='live'?'LIVE':status==='finished'?'FINISHED':'UPCOMING';
            const active = selectedMatch && String(selectedMatch.id)===id;

            if (match.sport === 'ufc' || match.sport === 'mma') {
                const method = s1 && s1 !== '-' ? escHtml(s1) : '';
                const boutType = match.league ? escHtml(match.league) : '';
                const result = s1 && s1 !== '-' ? s1 : '';
                const isKO = /ko|tko/i.test(result);
                const isSUB = /sub/i.test(result);
                const isDec = /ud|sd|md|dec/i.test(result);
                let methodClass = 'pending';
                let methodLabel = 'TBD';
                if (result) {
                    if (isKO) { methodClass = 'ko'; methodLabel = result; }
                    else if (isSUB) { methodClass = 'sub'; methodLabel = result; }
                    else if (isDec) { methodClass = 'dec'; methodLabel = result; }
                    else { methodClass = ''; methodLabel = result; }
                }
                const winnerSide = (status === 'finished' && s1 && s1 !== '-') ? 'left' : '';
                const t1Logo = team1.logo || '';
                const t2Logo = team2.logo || '';
                const t1Img = t1Logo ? `<img src="${escHtml(t1Logo)}" alt="${escHtml(cleanDisplayName(team1.name))}" class="ufc-fighter-img" onerror="this.outerHTML='<div class=\\'ufc-fighter-img fallback\\'>🥊</div>'">` : `<div class="ufc-fighter-img fallback">🥊</div>`;
                const t2Img = t2Logo ? `<img src="${escHtml(t2Logo)}" alt="${escHtml(cleanDisplayName(team2.name))}" class="ufc-fighter-img" onerror="this.outerHTML='<div class=\\'ufc-fighter-img fallback\\'>🥊</div>'">` : `<div class="ufc-fighter-img fallback">🥊</div>`;
                html += `<div class="match-card-wrapper"><div class="ufc-card ${status} ${active?'active':''}" data-match-id="${escHtml(id)}" onclick='selectMatch(${idJson})'>
                    <div class="ufc-fighter fighter-left" onclick="event.stopPropagation(); toggleTeamPlayers(${idJson}, &quot;team1&quot;, ${jsAttr(cleanDisplayName(team1.name))}, ${jsAttr(t1Logo)})">
                        ${status==='finished' && s1 && s1!=='-' ? '<span class="ufc-win-badge">WIN</span>' : ''}
                        ${t1Img}
                        <div class="ufc-fighter-name">${escHtml(cleanDisplayName(team1.name))}</div>
                    </div>
                    <div class="ufc-center">
                        <div class="ufc-bout-type">${boutType || 'UFC BOUT'}</div>
                        <div class="ufc-vs">VS</div>
                        <div class="ufc-stats">
                            <div class="ufc-stat-row">
                                <span class="ufc-stat-label">METHOD</span>
                            </div>
                            <div class="ufc-method ${methodClass}">${methodLabel}</div>
                        </div>
                        <div class="ufc-status ${status}">${label}</div>
                    </div>
                    <div class="ufc-fighter fighter-right" onclick="event.stopPropagation(); toggleTeamPlayers(${idJson}, &quot;team2&quot;, ${jsAttr(cleanDisplayName(team2.name))}, ${jsAttr(t2Logo)})">
                        ${t2Img}
                        <div class="ufc-fighter-name">${escHtml(cleanDisplayName(team2.name))}</div>
                    </div>
                </div><div class="match-detail-accordion" id="accordion-${escHtml(id)}" style="display:none"></div></div>`;
            } else {
                const scoreOrTime = status==='live'||status==='finished'
                    ? (() => {
                        const ov1 = match?.overs?.team1 || '';
                        const ov2 = match?.overs?.team2 || '';
                        const hasScore1 = s1 && s1 !== '-';
                        const hasScore2 = s2 && s2 !== '-';
                        let scoreText;
                        if (hasScore1 && hasScore2) scoreText = `${escHtml(s1)} <span class="mc-vs">VS</span> ${escHtml(s2)}`;
                        else if (hasScore1) scoreText = escHtml(s1);
                        else if (hasScore2) scoreText = escHtml(s2);
                        else if (status === 'live') scoreText = 'LIVE';
                        else scoreText = time || 'TBA';
                        return `<div class="mc-score-center"><span class="mc-score-val">${scoreText}</span></div>`;
                    })()
                    : `<div class="mc-score-center"><span class="mc-countdown" data-match-id="${escHtml(id)}">${escHtml(time)}</span></div>`;
                html += `<div class="match-card-wrapper"><div class="match-card ${status} ${active?'active':''}" data-match-id="${escHtml(id)}" onclick='selectMatch(${idJson})'>
                    <div class="mc-row">
                        <div class="mc-team-left">
                            ${teamLogoHtml(team1)}
                            <span class="mc-name team-clickable" onclick="event.stopPropagation(); toggleTeamPlayers(${idJson}, &quot;team1&quot;, ${jsAttr(cleanDisplayName(team1.name||'Home Team'))}, ${jsAttr(team1.logo||'')})">${escHtml(cleanDisplayName(team1.name||'Home Team'))}</span>
                        </div>
                        ${scoreOrTime}
                        <div class="mc-team-right-inline">
                            <span class="mc-name team-clickable" onclick="event.stopPropagation(); toggleTeamPlayers(${idJson}, &quot;team2&quot;, ${jsAttr(cleanDisplayName(team2.name||'Away Team'))}, ${jsAttr(team2.logo||'')})">${escHtml(cleanDisplayName(team2.name||'Away Team'))}</span>
                            ${teamLogoHtml(team2)}
                        </div>
                    </div>
                    <div class="mc-bottom">
                        <div class="mc-status ${status}">${label}</div>
                    </div>
                </div><div class="match-detail-accordion" id="accordion-${escHtml(id)}" style="display:none"></div></div>`;
            }
        });
        html += `</div></div>`;
    });
    container.innerHTML=html;

    matches.forEach(m=>{ if(getMatchStatus(m)==='upcoming' && m.date && m.time && m.time!=='00:00') startCountdown(String(m.id),m.date,m.time); });
    if(selectedMatch){ const acc=document.getElementById(`accordion-${CSS.escape(String(selectedMatch.id))}`); if(acc){renderAccordionContent(selectedMatch,acc);acc.style.display='block';} }
    updateLiveFilterBtn();
}

// Update live scores in-place without rebuilding DOM
function updateLiveScoresInPlace(matches, container) {
    if (!container) container = document.getElementById('match-list');
    if (!container) return false;

    if (currentSport !== 'all') matches = matches.filter(m => m.sport === currentSport);
    if (currentLeagueFilter) matches = matches.filter(m => m.league === currentLeagueFilter);

    matches = matches.map(normalizeDisplayMatch).filter(Boolean);
    const seen = new Set();
    matches = matches.filter(m => {
        const key = String(m.id || `${m.date}|${m.time}|${m.team1?.name}|${m.team2?.name}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const existingCards = container.querySelectorAll('.match-card[data-match-id], .ufc-card[data-match-id]');
    const existingIds = new Set();
    existingCards.forEach(card => existingIds.add(card.getAttribute('data-match-id')));

    const newIds = new Set(matches.map(m => String(m.id)));
    const hasStructureChange = existingIds.size !== newIds.size || [...newIds].some(id => !existingIds.has(id));

    if (hasStructureChange) return false;

    matches.forEach(match => {
        const id = String(match.id);
        const card = container.querySelector(`.match-card[data-match-id="${CSS.escape(id)}"], .ufc-card[data-match-id="${CSS.escape(id)}"]`);
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
        const label = status === 'live' ? 'LIVE' : status === 'finished' ? 'FINISHED' : 'UPCOMING';

        card.className = card.className.replace(/\b(live|finished|upcoming)\b/g, '').trim() + ' ' + status;
        if (selectedMatch && String(selectedMatch.id) === id) card.classList.add('active');

        const scoreEl = card.querySelector('.mc-score-val');
        if (!scoreEl) return false;
            const hasScore1 = s1 && s1 !== '-';
            const hasScore2 = s2 && s2 !== '-';
            let scoreText;
            if (hasScore1 && hasScore2) scoreText = `${escHtml(s1)} <span class="mc-vs">VS</span> ${escHtml(s2)}`;
            else if (hasScore1) scoreText = escHtml(s1);
            else if (hasScore2) scoreText = escHtml(s2);
            else if (status === 'live') scoreText = 'LIVE';
            else scoreText = time || 'TBA';
            const newPlainText = scoreText.replace(/<[^>]*>/g, '').trim();
            const oldPlainText = (scoreEl.textContent || '').trim();
            if (oldPlainText !== newPlainText) {
                scoreEl.innerHTML = scoreText;
            }

        const statusEl = card.querySelector('.mc-status, .ufc-status');
        if (statusEl) {
            const isUFC = card.classList.contains('ufc-card');
            statusEl.className = isUFC ? `ufc-status ${status}` : `mc-status ${status}`;
            if (statusEl.textContent !== label) statusEl.textContent = label;
        }

        if (card.classList.contains('ufc-card')) {
            const methodEl = card.querySelector('.ufc-method');
            if (methodEl) {
                const result = s1 && s1 !== '-' ? s1 : '';
                const isKO = /ko|tko/i.test(result);
                const isSUB = /sub/i.test(result);
                const isDec = /ud|sd|md|dec/i.test(result);
                let methodClass = 'pending';
                let methodLabel = 'TBD';
                if (result) {
                    if (isKO) { methodClass = 'ko'; methodLabel = result; }
                    else if (isSUB) { methodClass = 'sub'; methodLabel = result; }
                    else if (isDec) { methodClass = 'dec'; methodLabel = result; }
                    else { methodClass = ''; methodLabel = result; }
                }
                methodEl.className = `ufc-method ${methodClass}`;
                if (methodEl.textContent !== methodLabel) methodEl.textContent = methodLabel;
            }
            const winBadge = card.querySelector('.ufc-win-badge');
            if (status === 'finished' && s1 && s1 !== '-') {
                if (!winBadge) {
                    const fighterLeft = card.querySelector('.fighter-left');
                    if (fighterLeft) fighterLeft.insertAdjacentHTML('afterbegin', '<span class="ufc-win-badge">WIN</span>');
                }
            } else if (winBadge) {
                winBadge.remove();
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
    updateLiveFilterBtn();
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
        ${match.statusText?`<div class="accordion-row"><span class="accordion-row-label">ℹ️ Status</span><span class="accordion-row-value">${escHtml(match.statusText)}</span></div>`:''}
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
    document.querySelectorAll('.match-card, .ufc-card').forEach(card => {
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
    const container = document.getElementById('league-list');
    if (!container) return;

    if (!matches || matches.length === 0) {
        container.innerHTML = '<div class="league-list-empty">No leagues available</div>';
        return;
    }

    // Group matches by league
    const leagueCount = {};
    matches.forEach(match => {
        const league = match.league || 'Other';
        if (!leagueCount[league]) {
            leagueCount[league] = { count: 0, icon: match.icon || '🏟️', logo: match.competitionLogo || '' };
        }
        leagueCount[league].count++;
    });

    const genericLeagues = ['Football', 'Cricket', 'Basketball', 'Tennis', 'MMA', 'UFC', 'NFL'];
    const hasRealLeagues = Object.keys(leagueCount).some(l => !genericLeagues.includes(l) || Object.values(leagueCount).some(d => d.logo));

    if (!hasRealLeagues && Object.keys(leagueCount).length <= 1) {
        const total = matches.length;
        const icon = matches[0]?.icon || '🏟️';
        container.innerHTML = `
            <div class="league-list-item" onclick="filterByLeague(null)">
                <span class="league-list-icon">${icon}</span>
                <span class="league-list-name">All Matches</span>
                <span class="league-list-count">${total}</span>
            </div>
        `;
        return;
    }

    // Sort by count
    const sortedLeagues = Object.entries(leagueCount)
        .sort((a, b) => b[1].count - a[1].count);

    let html = '';
    sortedLeagues.forEach(([league, data]) => {
        html += `
            <div class="league-list-item" onclick="filterByLeague('${league.replace(/'/g, "\\'")}')">
                ${data.logo ? `<img src="${data.logo}" alt="" class="league-list-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="league-list-icon" style="display:none">${data.icon}</span>` : `<span class="league-list-icon">${data.icon}</span>`}
                <span class="league-list-name">${league}</span>
                <span class="league-list-count">${data.count}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Filter live matches to top
let _liveFilterActive = false;

function renderWithLiveFirst() {
    const container = document.getElementById('match-list');
    if (!container) return;
    const matches = getMatchesForDate(currentDate);
    let filtered = matches;
    if (currentSport !== 'all') filtered = filtered.filter(m => m.sport === currentSport);
    if (currentLeagueFilter) filtered = filtered.filter(m => m.league === currentLeagueFilter);
    if (_liveFilterActive) {
        const live = filtered.filter(m => getMatchStatus(m) === 'live');
        const nonLive = filtered.filter(m => getMatchStatus(m) !== 'live');
        filtered = [...live, ...nonLive];
    }
    renderMatchList(filtered, container);
}

function filterLiveMatches() {
    _liveFilterActive = !_liveFilterActive;
    const btn = document.getElementById('live-filter-btn');
    if (btn) btn.classList.toggle('active', _liveFilterActive);
    renderWithLiveFirst();
}

function updateLiveFilterBtn() {
    const btn = document.getElementById('live-filter-btn');
    if (!btn) return;
    const matches = getMatchesForDate(currentDate);
    const hasLive = matches.some(m => getMatchStatus(m) === 'live');
    btn.classList.toggle('visible', hasLive);
}

// Filter matches by league
let currentLeagueFilter = null;

function filterByLeague(league) {
    const items = document.querySelectorAll('.league-list-item');
    
    if (currentLeagueFilter === league) {
        // Toggle off - show all
        currentLeagueFilter = null;
        items.forEach(item => item.classList.remove('active'));
    } else {
        // Filter by league
        currentLeagueFilter = league;
        items.forEach(item => {
            item.classList.remove('active');
            if (item.querySelector('.league-list-name').textContent === league) {
                item.classList.add('active');
            }
        });
    }
    
    // Re-render matches
    loadMatchesForDate(currentDate);
}

// Set API key
function setMyApiKey(key) {
    setApiKey(key);
    loadMatchesForDate(currentDate);
    refreshCalendarEvents();
    console.log('API key set! Fetching live data...');
}

// Profile toggle
function toggleProfile() {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Mobile calendar toggle
function toggleMobileCalendar() {
    const sidebar = document.querySelector('.sidebar-left');
    const overlay = document.getElementById('calendar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    }
}

// Mobile sidebar toggle
function toggleMobileSidebar() {
    const sidebar = document.getElementById('mobile-sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('calendar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('active');
        if (hamburger) hamburger.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('mobile-sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('calendar-overlay');
    if (sidebar) sidebar.classList.remove('active');
    if (hamburger) hamburger.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

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
        if (now - _lastRefreshTime < 4000) return;
        _lastRefreshTime = now;

        console.log('🔄 Live Agent: refreshing scores...');
        try {
            const result = await autoFetchMatches();
            if (currentDate !== today) return;

            const hasLive = Object.values(result).some(arr => arr && arr.length > 0);
            if (hasLive) {
                const existing = DATE_CACHE[today] || {};
                ['cricket','football','basketball','tabletennis','mma','ufc','nfl'].forEach(sport => {
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
                    if (_liveFilterActive) {
                        renderWithLiveFirst();
                    } else {
                        const updated = updateLiveScoresInPlace(fresh, container);
                        if (!updated) filterAndRender(fresh, container);
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
    const sidebar = document.querySelector('.sidebar-left');
    const overlay = document.getElementById('calendar-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
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
