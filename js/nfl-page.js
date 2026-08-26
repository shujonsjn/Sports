// ===== NFL Page Module =====
// Premium NFL-specific rendering with hero, date nav, featured game, game cards, sidebar.

const NFLPage = (() => {
  let activeFilter = 'all';
  let activeDate = null;
  let allNflMatches = [];
  let expandedGameId = null;

  // --- NFL Team Data ---
  const NFL_TEAMS = {
    'ARI': { name: 'Arizona Cardinals', abbr: 'ARI', conference: 'NFC West' },
    'ATL': { name: 'Atlanta Falcons', abbr: 'ATL', conference: 'NFC South' },
    'BAL': { name: 'Baltimore Ravens', abbr: 'BAL', conference: 'AFC North' },
    'BUF': { name: 'Buffalo Bills', abbr: 'BUF', conference: 'AFC East' },
    'CAR': { name: 'Carolina Panthers', abbr: 'CAR', conference: 'NFC South' },
    'CHI': { name: 'Chicago Bears', abbr: 'CHI', conference: 'NFC North' },
    'CIN': { name: 'Cincinnati Bengals', abbr: 'CIN', conference: 'AFC North' },
    'CLE': { name: 'Cleveland Browns', abbr: 'CLE', conference: 'AFC North' },
    'DAL': { name: 'Dallas Cowboys', abbr: 'DAL', conference: 'NFC East' },
    'DEN': { name: 'Denver Broncos', abbr: 'DEN', conference: 'AFC West' },
    'DET': { name: 'Detroit Lions', abbr: 'DET', conference: 'NFC North' },
    'GB':  { name: 'Green Bay Packers', abbr: 'GB',  conference: 'NFC North' },
    'HOU': { name: 'Houston Texans', abbr: 'HOU', conference: 'AFC South' },
    'IND': { name: 'Indianapolis Colts', abbr: 'IND', conference: 'AFC South' },
    'JAX': { name: 'Jacksonville Jaguars', abbr: 'JAX', conference: 'AFC South' },
    'KC':  { name: 'Kansas City Chiefs', abbr: 'KC',  conference: 'AFC West' },
    'LAC': { name: 'Los Angeles Chargers', abbr: 'LAC', conference: 'AFC West' },
    'LAR': { name: 'Los Angeles Rams', abbr: 'LAR', conference: 'NFC West' },
    'LV':  { name: 'Las Vegas Raiders', abbr: 'LV',  conference: 'AFC West' },
    'MIA': { name: 'Miami Dolphins', abbr: 'MIA', conference: 'AFC East' },
    'MIN': { name: 'Minnesota Vikings', abbr: 'MIN', conference: 'NFC North' },
    'NE':  { name: 'New England Patriots', abbr: 'NE',  conference: 'AFC East' },
    'NO':  { name: 'New Orleans Saints', abbr: 'NO',  conference: 'NFC South' },
    'NYG': { name: 'New York Giants', abbr: 'NYG', conference: 'NFC East' },
    'NYJ': { name: 'New York Jets', abbr: 'NYJ', conference: 'AFC East' },
    'PHI': { name: 'Philadelphia Eagles', abbr: 'PHI', conference: 'NFC East' },
    'PIT': { name: 'Pittsburgh Steelers', abbr: 'PIT', conference: 'AFC North' },
    'SEA': { name: 'Seattle Seahawks', abbr: 'SEA', conference: 'NFC West' },
    'SF':  { name: 'San Francisco 49ers', abbr: 'SF',  conference: 'NFC West' },
    'TB':  { name: 'Tampa Bay Buccaneers', abbr: 'TB',  conference: 'NFC South' },
    'TEN': { name: 'Tennessee Titans', abbr: 'TEN', conference: 'AFC South' },
    'WAS': { name: 'Washington Commanders', abbr: 'WAS', conference: 'NFC East' },
  };

  // Build reverse lookup: full name -> abbr
  const NFL_NAME_TO_ABBR = {};
  Object.entries(NFL_TEAMS).forEach(([abbr, t]) => {
    NFL_NAME_TO_ABBR[t.name.toUpperCase()] = abbr;
    NFL_NAME_TO_ABBR[t.name.toUpperCase().replace(/\s+/g,'')] = abbr;
  });

  function findNflTeam(str) {
    if (!str) return null;
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    // Direct abbreviation match
    if (NFL_TEAMS[s]) return NFL_TEAMS[s];
    // Full name match
    const byName = NFL_NAME_TO_ABBR[str.toUpperCase()] || NFL_NAME_TO_ABBR[str.toUpperCase().replace(/\s+/g,'')];
    if (byName && NFL_TEAMS[byName]) return NFL_TEAMS[byName];
    // Partial match on full name
    for (const [abbr, t] of Object.entries(NFL_TEAMS)) {
      const fullName = t.name.toUpperCase();
      if (fullName.includes(s) || s.includes(fullName.split(' ').pop())) return t;
    }
    return null;
  }

  function getTeamAbbr(match, side) {
    const team = match[side] || {};
    const found = findNflTeam(team.name || team.short);
    if (found) return found.abbr;
    if (team.short && NFL_TEAMS[team.short.toUpperCase()]) return team.short.toUpperCase();
    return (team.name || '').slice(0,3).toUpperCase();
  }

  function getTeamName(match, side) {
    const team = match[side] || {};
    const found = findNflTeam(team.name);
    return found ? found.name : team.name || (side === 'team1' ? 'Home' : 'Away');
  }

  function getConference(match) {
    const abbr = getTeamAbbr(match, 'team1');
    const team = NFL_TEAMS[abbr];
    return team ? team.conference : '';
  }

  // --- Date Helpers ---
  function getTodayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function getWeekDates(center) {
    const dates = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(center);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function formatDateShort(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  function getDayAbbr(d) {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  }

  function toStr(d) {
    return d.toISOString().split('T')[0];
  }

  // --- Filtering ---
  function filterMatches() {
    let filtered = [...allNflMatches];
    if (activeFilter === 'afc') {
      filtered = filtered.filter(m => {
        const conf1 = getConference(m);
        return conf1.includes('AFC');
      });
    } else if (activeFilter === 'nfc') {
      filtered = filtered.filter(m => {
        const conf1 = getConference(m);
        return conf1.includes('NFC');
      });
    } else if (activeFilter === 'live') {
      filtered = filtered.filter(m => {
        const status = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
        return status === 'live';
      });
    } else if (activeFilter === 'upcoming') {
      filtered = filtered.filter(m => {
        const status = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
        return status === 'upcoming';
      });
    }
    return filtered;
  }

  // --- Logo ---
  function getTeamLogo(match, side) {
    const team = match[side] || {};
    if (team.logo) return escHtml(team.logo);
    const abbr = getTeamAbbr(match, side);
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;
  }

  function logoFallback(el, abbr) {
    el.onerror = null;
    el.style.display = 'none';
    el.insertAdjacentHTML('afterend', `<div class="nfl-team-initials">${escHtml(abbr)}</div>`);
  }

  // --- Skeleton ---
  function renderSkeleton(count) {
    let cards = '';
    for (let i = 0; i < (count || 4); i++) {
      cards += `
        <div class="nfl-skeleton-card">
          <div class="nfl-skeleton nfl-skeleton-status"></div>
          <div class="nfl-skeleton-row">
            <div class="nfl-skeleton-team"><div class="nfl-skeleton nfl-skeleton-logo"></div><div><div class="nfl-skeleton nfl-skeleton-name"></div><div class="nfl-skeleton nfl-skeleton-abbr"></div></div></div>
            <div class="nfl-skeleton-center"><div class="nfl-skeleton nfl-skeleton-score"></div><div class="nfl-skeleton nfl-skeleton-divider"></div><div class="nfl-skeleton nfl-skeleton-score"></div></div>
            <div class="nfl-skeleton-team" style="flex-direction:row-reverse"><div class="nfl-skeleton nfl-skeleton-logo"></div><div style="text-align:right"><div class="nfl-skeleton nfl-skeleton-name"></div><div class="nfl-skeleton nfl-skeleton-abbr"></div></div></div>
          </div>
        </div>`;
    }
    return cards;
  }

  // --- Empty State ---
  function renderEmpty(title, desc, actionText, actionFn) {
    const btnHtml = actionText && actionFn
      ? `<button class="nfl-btn nfl-btn-primary" onclick="${actionFn}">${escHtml(actionText)}</button>` : '';
    return `
      <div class="nfl-empty">
        <div class="nfl-empty-icon">🏈</div>
        <div class="nfl-empty-title">${escHtml(title)}</div>
        <div class="nfl-empty-desc">${escHtml(desc)}</div>
        ${btnHtml ? `<div class="nfl-empty-actions">${btnHtml}</div>` : ''}
      </div>`;
  }

  // --- Hero Stats ---
  function renderHeroStats() {
    const liveCount = allNflMatches.filter(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'live';
    }).length;
    const upcomingCount = allNflMatches.filter(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'upcoming';
    }).length;
    const finishedCount = allNflMatches.filter(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'finished';
    }).length;
    const totalCount = allNflMatches.length;
    return `
      <div class="nfl-hero-stat">
        <div class="nfl-hero-stat-num">${totalCount}</div>
        <div class="nfl-hero-stat-label">Total</div>
      </div>
      <div class="nfl-hero-stat">
        <div class="nfl-hero-stat-num" style="color:var(--nfl-live)">${liveCount}</div>
        <div class="nfl-hero-stat-label">Live</div>
      </div>
      <div class="nfl-hero-stat">
        <div class="nfl-hero-stat-num">${upcomingCount}</div>
        <div class="nfl-hero-stat-label">Upcoming</div>
      </div>
      <div class="nfl-hero-stat">
        <div class="nfl-hero-stat-num">${finishedCount}</div>
        <div class="nfl-hero-stat-label">Final</div>
      </div>`;
  }

  // --- Date Navigation ---
  function renderDateNav() {
    const centerDate = activeDate ? new Date(activeDate + 'T12:00:00') : new Date();
    const dates = getWeekDates(centerDate);
    const todayStr = getTodayStr();
    const prevDate = new Date(centerDate);
    prevDate.setDate(prevDate.getDate() - 7);
    const nextDate = new Date(centerDate);
    nextDate.setDate(nextDate.getDate() + 7);

    let items = '';
    dates.forEach(d => {
      const str = toStr(d);
      const isToday = str === todayStr;
      const isActive = str === activeDate;
      items += `
        <div class="nfl-date-item ${isActive ? 'active' : ''}" onclick="NFLPage.selectDate('${str}')" role="button" tabindex="0" aria-label="${getDayAbbr(d)} ${formatDateShort(d)}${isToday ? ' (Today)' : ''}">
          ${isToday ? '<div class="nfl-date-today">Today</div>' : ''}
          <div class="nfl-date-day">${getDayAbbr(d)}</div>
          <div class="nfl-date-num">${d.getDate()}</div>
        </div>`;
    });

    return `
      <div class="nfl-date-nav">
        <div class="nfl-date-nav-inner">
          <button class="nfl-date-arrow" onclick="NFLPage.navigateWeek(-1)" aria-label="Previous week">&lsaquo;</button>
          ${items}
          <button class="nfl-date-arrow" onclick="NFLPage.navigateWeek(1)" aria-label="Next week">&rsaquo;</button>
        </div>
      </div>`;
  }

  // --- Featured Game ---
  function renderFeaturedGame() {
    const live = allNflMatches.filter(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'live';
    });
    if (live.length === 0) return '';
    const match = live[0];
    const id = escHtml(String(match.id || ''));
    const t1Name = escHtml(getTeamName(match, 'team1'));
    const t2Name = escHtml(getTeamName(match, 'team2'));
    const t1Abbr = escHtml(getTeamAbbr(match, 'team1'));
    const t2Abbr = escHtml(getTeamAbbr(match, 'team2'));
    const s1 = scoreValue(match.score?.team1);
    const s2 = scoreValue(match.score?.team2);
    const hasScore = s1 && s1 !== '-' && s2 && s2 !== '-';
    const logo1 = getTeamLogo(match, 'team1');
    const logo2 = getTeamLogo(match, 'team2');
    const quarter = match.statusText || match.quarter || '';
    const isFav = typeof Favorites !== 'undefined' && Favorites.isFavorite(id);

    return `
      <div class="nfl-featured" onclick="NFLPage.toggleGameDetail('${id}')" role="button" tabindex="0" aria-label="Featured: ${t1Name} vs ${t2Name}">
        <div class="nfl-featured-badge">
          <div class="nfl-featured-badge-dot"></div>
          <div class="nfl-featured-badge-text">Live Now</div>
        </div>
        <div class="nfl-featured-body">
          <div class="nfl-featured-team">
            <div class="nfl-featured-logo">
              <img src="${logo1}" alt="${t1Name}" onerror="logoFallback(this,'${t1Abbr}')">
            </div>
            <div class="nfl-featured-name">${t1Name}</div>
            <div class="nfl-featured-abbr">${t1Abbr}</div>
          </div>
          <div class="nfl-featured-score">
            <div class="nfl-featured-scores">
              <div class="nfl-featured-score-num">${hasScore ? escHtml(s1) : '-'}</div>
              <div class="nfl-featured-vs">VS</div>
              <div class="nfl-featured-score-num">${hasScore ? escHtml(s2) : '-'}</div>
            </div>
            ${quarter ? `<div class="nfl-featured-meta">${escHtml(quarter)}</div>` : ''}
          </div>
          <div class="nfl-featured-team">
            <div class="nfl-featured-logo">
              <img src="${logo2}" alt="${t2Name}" onerror="logoFallback(this,'${t2Abbr}')">
            </div>
            <div class="nfl-featured-name">${t2Name}</div>
            <div class="nfl-featured-abbr">${t2Abbr}</div>
          </div>
        </div>
        <div class="nfl-featured-actions" onclick="event.stopPropagation()">
          <button class="nfl-btn nfl-btn-primary" onclick="NFLPage.toggleGameDetail('${id}')">View Details</button>
          <button class="nfl-btn nfl-btn-secondary nfl-fav-btn ${isFav ? 'active' : ''}" onclick="NFLPage.toggleFav('${id}')" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ${isFav ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>`;
  }

  // --- Game Card ---
  function renderGameCard(match) {
    const status = typeof getMatchStatus === 'function' ? getMatchStatus(match) : (match.status || 'upcoming');
    const id = escHtml(String(match.id || ''));
    const t1Name = escHtml(getTeamName(match, 'team1'));
    const t2Name = escHtml(getTeamName(match, 'team2'));
    const t1Abbr = escHtml(getTeamAbbr(match, 'team1'));
    const t2Abbr = escHtml(getTeamAbbr(match, 'team2'));
    let s1 = scoreValue(match.score?.team1);
    let s2 = scoreValue(match.score?.team2);
    const hasScore1 = s1 && s1 !== '-';
    const hasScore2 = s2 && s2 !== '-';
    const logo1 = getTeamLogo(match, 'team1');
    const logo2 = getTeamLogo(match, 'team2');
    const time = match.time && match.time !== '00:00' ? match.time : 'TBA';
    const venue = match.venue ? escHtml(match.venue) : '';
    const label = status === 'live' ? 'LIVE' : status === 'finished' ? 'FINAL' : time;
    const quarter = match.statusText || match.quarter || '';
    const isFav = typeof Favorites !== 'undefined' && Favorites.isFavorite(id);
    const scoreClass1 = (status === 'finished' && hasScore1 && hasScore2) ? (parseFloat(s1) >= parseFloat(s2) ? 'winner' : 'loser') : '';
    const scoreClass2 = (status === 'finished' && hasScore1 && hasScore2) ? (parseFloat(s2) >= parseFloat(s1) ? 'winner' : 'loser') : '';

    return `
      <div class="nfl-game-card ${status}" data-match-id="${id}" onclick="NFLPage.toggleGameDetail('${id}')" role="listitem" tabindex="0" aria-label="${t1Name} vs ${t2Name}, ${label}">
        <div class="nfl-game-status-bar">
          <div class="nfl-game-status-badge ${status}">${status === 'live' ? '<span class="nfl-status-dot"></span>' : ''}${label}</div>
          <div class="nfl-game-time">${time}</div>
        </div>
        <div class="nfl-game-body">
          <div class="nfl-game-team">
            <div class="nfl-game-logo">
              <img src="${logo1}" alt="${t1Name}" onerror="logoFallback(this,'${t1Abbr}')">
            </div>
            <div class="nfl-game-team-info">
              <div class="nfl-game-team-name">${t1Name}</div>
              <div class="nfl-game-team-abbr">${t1Abbr}</div>
            </div>
          </div>
          <div class="nfl-game-center">
            <div class="nfl-game-scores">
              <div class="nfl-game-score ${scoreClass1}">${hasScore1 ? escHtml(s1) : '-'}</div>
              <div class="nfl-game-score-divider">-</div>
              <div class="nfl-game-score ${scoreClass2}">${hasScore2 ? escHtml(s2) : '-'}</div>
            </div>
            ${quarter ? `<div class="nfl-game-quarter">${escHtml(quarter)}</div>` : ''}
          </div>
          <div class="nfl-game-team right">
            <div class="nfl-game-logo">
              <img src="${logo2}" alt="${t2Name}" onerror="logoFallback(this,'${t2Abbr}')">
            </div>
            <div class="nfl-game-team-info">
              <div class="nfl-game-team-name">${t2Name}</div>
              <div class="nfl-game-team-abbr">${t2Abbr}</div>
            </div>
          </div>
        </div>
        <div class="nfl-game-footer">
          <div class="nfl-game-venue">${venue}</div>
          <div class="nfl-game-actions" onclick="event.stopPropagation()">
            <button class="nfl-game-action-btn nfl-fav-btn ${isFav ? 'active' : ''}" onclick="NFLPage.toggleFav('${id}')" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
              <svg viewBox="0 0 24 24" width="12" height="12"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }

  // --- Sidebar ---
  function renderSidebar() {
    const live = allNflMatches.filter(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'live';
    });
    const upcoming = allNflMatches.filter(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'upcoming';
    }).slice(0, 5);

    let liveHtml = '';
    live.forEach(m => {
      const t1Name = escHtml(getTeamName(m, 'team1'));
      const t2Name = escHtml(getTeamName(m, 'team2'));
      const t1Abbr = escHtml(getTeamAbbr(m, 'team1'));
      const t2Abbr = escHtml(getTeamAbbr(m, 'team2'));
      const s1 = scoreValue(m.score?.team1);
      const s2 = scoreValue(m.score?.team2);
      const hasScore = s1 && s1 !== '-';
      const logo = getTeamLogo(m, 'team1');
      const id = String(m.id || '');
      liveHtml += `
        <div class="nfl-sidebar-item" onclick="NFLPage.toggleGameDetail('${escHtml(id)}')" tabindex="0" role="button" aria-label="${t1Name} vs ${t2Name}">
          <div class="nfl-sidebar-item-logo">
            <img src="${logo}" alt="" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<div class=\\'nfl-team-initials\\'>${t1Abbr}</div>'">
          </div>
          <div class="nfl-sidebar-item-info">
            <div class="nfl-sidebar-item-teams">${t1Name} vs ${t2Name}</div>
            <div class="nfl-sidebar-item-meta">LIVE</div>
          </div>
          <div class="nfl-sidebar-item-score">${hasScore ? escHtml(s1) + ' - ' + escHtml(s2) : 'LIVE'}</div>
        </div>`;
    });
    if (!liveHtml) liveHtml = '<div class="nfl-sidebar-empty">No live games right now</div>';

    let upHtml = '';
    upcoming.forEach(m => {
      const t1Abbr = escHtml(getTeamAbbr(m, 'team1'));
      const t2Abbr = escHtml(getTeamAbbr(m, 'team2'));
      const time = m.time && m.time !== '00:00' ? m.time : 'TBA';
      const logo = getTeamLogo(m, 'team1');
      const id = String(m.id || '');
      upHtml += `
        <div class="nfl-sidebar-item" onclick="NFLPage.toggleGameDetail('${escHtml(id)}')" tabindex="0" role="button" aria-label="${t1Abbr} vs ${t2Abbr} at ${time}">
          <div class="nfl-sidebar-item-logo">
            <img src="${logo}" alt="" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<div class=\\'nfl-team-initials\\'>${t1Abbr}</div>'">
          </div>
          <div class="nfl-sidebar-item-info">
            <div class="nfl-sidebar-item-teams">${t1Abbr} vs ${t2Abbr}</div>
            <div class="nfl-sidebar-item-meta">${time}</div>
          </div>
        </div>`;
    });
    if (!upHtml) upHtml = '<div class="nfl-sidebar-empty">No upcoming games</div>';

    return `
      <aside class="nfl-sidebar">
        <div class="nfl-sidebar-card">
          <div class="nfl-sidebar-header">
            <div class="nfl-sidebar-title">Live Games</div>
            ${live.length > 0 ? `<div class="nfl-sidebar-badge">${live.length}</div>` : ''}
          </div>
          <div class="nfl-sidebar-list">${liveHtml}</div>
        </div>
        <div class="nfl-sidebar-card">
          <div class="nfl-sidebar-header">
            <div class="nfl-sidebar-title">Upcoming</div>
          </div>
          <div class="nfl-sidebar-list">${upHtml}</div>
        </div>
      </aside>`;
  }

  // --- Find nearest date with NFL games ---
  function findNearestNflDate() {
    const today = getTodayStr();
    const todayDate = new Date(today + 'T12:00:00');
    // Direct check using filterAugust2026 (synchronous, no timing issues)
    if (typeof filterAugust2026 === 'function') {
      for (let offset = 0; offset <= 31; offset++) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];
        if (!dateStr.startsWith('2026-08')) break;
        const games = filterAugust2026(dateStr, 'nfl');
        if (games.length > 0) return dateStr;
      }
      for (let offset = -1; offset >= -30; offset--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];
        if (!dateStr.startsWith('2026-08')) break;
        const games = filterAugust2026(dateStr, 'nfl');
        if (games.length > 0) return dateStr;
      }
    }
    // Fallback: check DATE_CACHE
    const cacheKeys = Object.keys(typeof DATE_CACHE !== 'undefined' ? DATE_CACHE : {}).sort();
    for (const key of cacheKeys) {
      const dayData = DATE_CACHE[key];
      if (dayData && dayData.nfl && dayData.nfl.length > 0) return key;
    }
    return null;
  }

  // --- Main Render ---
  function render() {
    const nflPage = document.getElementById('nfl-page');
    const mainContainer = document.querySelector('.main-container');
    if (!nflPage) return;

    // Show NFL page, hide generic
    nflPage.classList.add('active');
    if (mainContainer) mainContainer.style.display = 'none';

    if (!activeDate) activeDate = getTodayStr();

    // Get NFL matches — use getMatchesForDate to include static data
    allNflMatches = [];
    if (typeof getMatchesForDate === 'function') {
      const allMatches = getMatchesForDate(activeDate);
      allNflMatches = allMatches.filter(m => m.sport === 'nfl');
    } else {
      // Fallback: read from DATE_CACHE
      const dateData = typeof DATE_CACHE !== 'undefined' ? DATE_CACHE[activeDate] : null;
      allNflMatches = dateData ? [...(dateData.nfl || [])] : [];
    }

    // Merge live matches
    if (typeof LIVE_MATCHES !== 'undefined' && LIVE_MATCHES.nfl && LIVE_MATCHES.nfl.length > 0) {
      const liveIds = new Set(allNflMatches.map(m => String(m.id)));
      LIVE_MATCHES.nfl.forEach(m => { if (!liveIds.has(String(m.id))) allNflMatches.push(m); });
    }

    const filtered = filterMatches();

    // Check for featured live game
    const hasLive = filtered.some(m => {
      const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
      return s === 'live';
    });

    let mainHtml = '';

    // Featured live game
    if (hasLive) {
      mainHtml += renderFeaturedGame();
    }

    // Game list
    if (filtered.length === 0) {
      const today = getTodayStr();
      const nearestDate = findNearestNflDate();
      if (activeDate < today) {
        mainHtml += renderEmpty('No historical NFL data', 'Game data for past dates is not available yet.');
      } else if (activeDate > today) {
        mainHtml += renderEmpty('No games scheduled', 'No NFL games have been scheduled for this date yet.');
      } else if (nearestDate && nearestDate > today) {
        mainHtml += renderEmpty(
          'No games today',
          `Next NFL games on ${nearestDate}. Preseason games are available!`,
          `View ${nearestDate}`,
          `NFLPage.selectDate('${nearestDate}')`
        );
      } else if (nearestDate) {
        mainHtml += renderEmpty(
          'No games today',
          `Browse available dates below to see NFL games.`,
          `View Games`,
          `NFLPage.selectDate('${nearestDate}')`
        );
      } else {
        mainHtml += renderEmpty('No games right now', 'Check back later for NFL game updates.');
      }
    } else {
      const liveGames = filtered.filter(m => {
        const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
        return s === 'live';
      });
      const upcomingGames = filtered.filter(m => {
        const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
        return s === 'upcoming';
      });
      const finishedGames = filtered.filter(m => {
        const s = typeof getMatchStatus === 'function' ? getMatchStatus(m) : (m.status || '');
        return s === 'finished';
      });

      if (liveGames.length > 0) {
        mainHtml += `<div class="nfl-section-header"><div class="nfl-section-title">Live Games</div><div class="nfl-section-count">${liveGames.length}</div></div>`;
        mainHtml += `<div class="nfl-game-list">${liveGames.map(renderGameCard).join('')}</div>`;
      }
      if (upcomingGames.length > 0) {
        mainHtml += `<div class="nfl-section-header"><div class="nfl-section-title">Upcoming</div><div class="nfl-section-count">${upcomingGames.length}</div></div>`;
        mainHtml += `<div class="nfl-game-list">${upcomingGames.map(renderGameCard).join('')}</div>`;
      }
      if (finishedGames.length > 0) {
        mainHtml += `<div class="nfl-section-header"><div class="nfl-section-title">Final</div><div class="nfl-section-count">${finishedGames.length}</div></div>`;
        mainHtml += `<div class="nfl-game-list">${finishedGames.map(renderGameCard).join('')}</div>`;
      }
    }

    const html = `
      <div class="nfl-hero">
        <div class="nfl-hero-inner">
          <div class="nfl-hero-left">
            <div class="nfl-hero-badge"><div class="nfl-hero-badge-dot"></div>2026 Season</div>
            <h1 class="nfl-hero-title">NFL <span>Scores</span></h1>
            <p class="nfl-hero-sub">Live scores, stats, and game updates</p>
          </div>
          <div class="nfl-hero-right" id="nfl-hero-stats">
            ${renderHeroStats()}
          </div>
        </div>
      </div>
      ${renderDateNav()}
      <div class="nfl-filters">
        <button class="nfl-filter-btn ${activeFilter === 'all' ? 'active' : ''}" onclick="NFLPage.setFilter('all')">All</button>
        <button class="nfl-filter-btn ${activeFilter === 'live' ? 'active' : ''}" onclick="NFLPage.setFilter('live')">
          <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--nfl-live);margin-right:4px;animation:nflPulseDot 2s infinite"></span>Live
        </button>
        <button class="nfl-filter-btn ${activeFilter === 'afc' ? 'active' : ''}" onclick="NFLPage.setFilter('afc')">AFC</button>
        <button class="nfl-filter-btn ${activeFilter === 'nfc' ? 'active' : ''}" onclick="NFLPage.setFilter('nfc')">NFC</button>
        <button class="nfl-filter-btn ${activeFilter === 'upcoming' ? 'active' : ''}" onclick="NFLPage.setFilter('upcoming')">Upcoming</button>
      </div>
      <div class="nfl-content">
        <div class="nfl-main" id="nfl-main-content">${mainHtml}</div>
        ${renderSidebar()}
      </div>`;

    nflPage.innerHTML = html;
  }

  // --- Public API ---
  return {
    init(date) {
      activeDate = date || getTodayStr();
      activeFilter = 'all';
      // Auto-navigate to nearest date with games if current date has none
      const todayGames = filterAugust2026(activeDate, 'nfl');
      if (todayGames.length === 0) {
        const nearest = findNearestNflDate();
        if (nearest) activeDate = nearest;
      }
      render();
    },

    refresh() {
      if (!activeDate) activeDate = getTodayStr();
      render();
    },

    hide() {
      const nflPage = document.getElementById('nfl-page');
      const mainContainer = document.querySelector('.main-container');
      if (nflPage) nflPage.classList.remove('active');
      if (mainContainer) mainContainer.style.display = '';
    },

    isActive() {
      const nflPage = document.getElementById('nfl-page');
      return nflPage && nflPage.classList.contains('active');
    },

    selectDate(dateStr) {
      activeDate = dateStr;
      activeFilter = 'all';
      render();
      if (typeof updateUrl === 'function') updateUrl('nfl', dateStr, null);
    },

    navigateWeek(dir) {
      const d = new Date(activeDate + 'T12:00:00');
      d.setDate(d.getDate() + (dir * 7));
      activeDate = toStr(d);
      render();
      if (typeof updateUrl === 'function') updateUrl('nfl', activeDate, null);
    },

    setFilter(filter) {
      activeFilter = filter;
      render();
    },

    toggleGameDetail(matchId) {
      expandedGameId = expandedGameId === matchId ? null : matchId;
      const allCards = document.querySelectorAll('.nfl-game-card');
      allCards.forEach(c => c.style.display = '');

      if (!expandedGameId) return;

      const match = allNflMatches.find(m => String(m.id) === matchId);
      if (!match) return;

      const detailContainer = document.createElement('div');
      detailContainer.className = 'nfl-game-detail';
      detailContainer.id = `nfl-detail-${matchId}`;

      const detailHtml = renderGameDetail(match);
      detailContainer.innerHTML = detailHtml;

      const targetCard = document.querySelector(`.nfl-game-card[data-match-id="${matchId}"]`);
      if (targetCard) {
        targetCard.insertAdjacentElement('afterend', detailContainer);
      }
    },

    toggleFav(matchId) {
      if (typeof toggleFavorite === 'function') {
        toggleFavorite(matchId);
      }
      render();
    }
  };
})();

// --- Game Detail Panel ---
function renderGameDetail(match) {
  const status = typeof getMatchStatus === 'function' ? getMatchStatus(match) : (match.status || 'upcoming');
  const t1Name = escHtml(getTeamName(match, 'team1'));
  const t2Name = escHtml(getTeamName(match, 'team2'));
  const t1Abbr = escHtml(getTeamAbbr(match, 'team1'));
  const t2Abbr = escHtml(getTeamAbbr(match, 'team2'));
  const s1 = scoreValue(match.score?.team1);
  const s2 = scoreValue(match.score?.team2);
  const hasScore1 = s1 && s1 !== '-';
  const hasScore2 = s2 && s2 !== '-';
  const time = match.time || 'TBA';
  const venue = match.venue ? escHtml(match.venue) : 'TBD';
  const league = match.league ? escHtml(match.league) : '';
  const quarter = match.statusText || '';
  const logo1 = getTeamLogo(match, 'team1');
  const logo2 = getTeamLogo(match, 'team2');

  const tabs = ['Overview', 'Stats', 'Roster'];
  let tabBtns = '';
  tabs.forEach((t, i) => {
    tabBtns += `<button class="nfl-detail-tab ${i === 0 ? 'active' : ''}" onclick="this.parentElement.querySelectorAll('.nfl-detail-tab').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${t}</button>`;
  });

  return `
    <div class="nfl-detail-tabs" style="position:relative">
      ${tabBtns}
      <button class="nfl-detail-close" onclick="NFLPage.toggleGameDetail(null)" aria-label="Close details">&times;</button>
    </div>
    <div class="nfl-detail-body">
      <div style="display:flex;align-items:center;justify-content:center;gap:2rem;margin-bottom:1.25rem">
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem">
          <div class="nfl-featured-logo" style="width:56px;height:56px">
            <img src="${logo1}" alt="${t1Name}" onerror="logoFallback(this,'${t1Abbr}')">
          </div>
          <div class="nfl-featured-name" style="font-size:0.82rem">${t1Name}</div>
          <div class="nfl-featured-abbr">${t1Abbr}</div>
        </div>
        <div style="text-align:center">
          <div style="display:flex;align-items:center;gap:0.75rem">
            <div class="nfl-featured-score-num" style="font-size:2rem">${hasScore1 ? escHtml(s1) : '-'}</div>
            <div class="nfl-featured-vs">VS</div>
            <div class="nfl-featured-score-num" style="font-size:2rem">${hasScore2 ? escHtml(s2) : '-'}</div>
          </div>
          ${quarter ? `<div style="font-size:0.72rem;color:var(--nfl-text-secondary);margin-top:0.3rem">${escHtml(quarter)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem">
          <div class="nfl-featured-logo" style="width:56px;height:56px">
            <img src="${logo2}" alt="${t2Name}" onerror="logoFallback(this,'${t2Abbr}')">
          </div>
          <div class="nfl-featured-name" style="font-size:0.82rem">${t2Name}</div>
          <div class="nfl-featured-abbr">${t2Abbr}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
        <div style="padding:0.6rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--nfl-border-subtle)">
          <div style="font-size:0.6rem;color:var(--nfl-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem">Kickoff</div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--nfl-text)">${time}</div>
        </div>
        <div style="padding:0.6rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--nfl-border-subtle)">
          <div style="font-size:0.6rem;color:var(--nfl-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem">Venue</div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--nfl-text)">${venue}</div>
        </div>
        <div style="padding:0.6rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--nfl-border-subtle)">
          <div style="font-size:0.6rem;color:var(--nfl-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem">Status</div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--nfl-text)">${status === 'live' ? '🔴 LIVE' : status === 'finished' ? '✅ Final' : '🕐 Upcoming'}</div>
        </div>
        <div style="padding:0.6rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid var(--nfl-border-subtle)">
          <div style="font-size:0.6rem;color:var(--nfl-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0.2rem">League</div>
          <div style="font-size:0.82rem;font-weight:600;color:var(--nfl-text)">${league || 'NFL'}</div>
        </div>
      </div>
    </div>`;
}

// Make renderGameDetail available globally for detail panel
window.renderGameDetail = renderGameDetail;
