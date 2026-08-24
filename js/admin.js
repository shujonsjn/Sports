// ===== Admin Dashboard =====

const SESSION_KEY = 'admin_session';
const ADMIN_API = '/api/admin';

function isLoggedIn() {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return false;
    try {
        const d = JSON.parse(s);
        if (!d.token || Date.now() - d.time > 24 * 60 * 60 * 1000) {
            localStorage.removeItem(SESSION_KEY);
            return false;
        }
        return true;
    } catch {
        localStorage.removeItem(SESSION_KEY);
        return false;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error');
    const btn = document.querySelector('#login-form button[type="submit"]');

    btn.disabled = true;
    btn.textContent = 'Signing in...';

    try {
        const res = await fetch(ADMIN_API + '?action=login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (data.success && data.token) {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ token: data.token, time: Date.now() }));
            showAdminApp();
        } else {
            err.textContent = data.error || 'Invalid username or password';
            err.style.display = 'block';
            document.getElementById('login-pass').value = '';
            document.getElementById('login-pass').focus();
        }
    } catch (e) {
        err.textContent = 'Connection error. Please try again.';
        err.style.display = 'block';
    }

    btn.disabled = false;
    btn.textContent = 'Sign In';
}

function getAdminToken() {
    try {
        const s = localStorage.getItem(SESSION_KEY);
        if (!s) return null;
        return JSON.parse(s).token;
    } catch { return null; }
}

function adminFetch(url, options = {}) {
    const token = getAdminToken();
    if (!token) { logout(); return Promise.reject(new Error('No session')); }
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    return fetch(url, { ...options, headers }).then(res => {
        if (res.status === 401) { logout(); throw new Error('Session expired'); }
        return res;
    });
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    document.getElementById('admin-app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('login-error').style.display = 'none';
}

function showAdminApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-app').style.display = 'block';
    initDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
    isLoggedIn() ? showAdminApp() : document.getElementById('login-screen').style.display = 'flex';
});

// ===== Dashboard =====
let allAdminMatches = [];

function initDashboard() {
    updateClock();
    setInterval(updateClock, 1000);
    loadSettings();
    refreshDashboard();
    loadAdminMatches();
}

function updateClock() {
    const el = document.getElementById('admin-time');
    if (el) el.textContent = new Date().toLocaleTimeString();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const el = document.getElementById(`page-${page}`);
    if (el) el.classList.add('active');
    const link = document.querySelector(`[data-page="${page}"]`);
    if (link) link.classList.add('active');
    const t = { dashboard: 'Dashboard', apis: 'API Status', matches: 'Matches', settings: 'Settings' };
    document.getElementById('page-title').textContent = t[page] || 'Dashboard';
    if (page === 'apis') renderAPIList();
    if (page === 'settings') loadSettings();
}

// ===== Logging =====
function addLog(msg, type = '') {
    const log = document.getElementById('system-log');
    if (!log) return;
    const d = document.createElement('div');
    d.className = `log-entry ${type}`;
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    log.prepend(d);
    if (log.children.length > 100) log.removeChild(log.lastChild);
}

function clearLog() {
    const log = document.getElementById('system-log');
    if (log) log.innerHTML = '<div class="log-entry">Log cleared</div>';
}

// ===== Dashboard Data =====
async function refreshDashboard() {
    addLog('Refreshing dashboard...');
    try {
        const data = await autoFetchMatches();
        if (!data) { addLog('No data returned', 'warn'); return; }

        const all = [
            ...(data.football || []),
            ...(data.cricket || []),
            ...(data.basketball || []),
            ...(data.tennis || []),
            ...(data.mma || []),
            ...(data.ufc || []),
            ...(data.nfl || [])
        ];

        const live = all.filter(m => ['live','in'].includes((m.status||'').toLowerCase())).length;
        const leagues = new Set(all.map(m => m.league).filter(Boolean));

        document.getElementById('stat-total').textContent = all.length;
        document.getElementById('stat-live').textContent = live;
        document.getElementById('stat-leagues').textContent = leagues.size;
        document.getElementById('stat-apis').textContent = '5';

        const sports = [
            { name: 'Football', icon: '⚽', key: 'football' },
            { name: 'Cricket', icon: '🏏', key: 'cricket' },
            { name: 'Basketball', icon: '🏀', key: 'basketball' },
            { name: 'Tennis', icon: '🎾', key: 'tennis' },
            { name: 'MMA', icon: '🥊', key: 'mma' },
            { name: 'UFC', icon: '🥋', key: 'ufc' },
            { name: 'NFL', icon: '🏈', key: 'nfl' }
        ];

        document.getElementById('sport-breakdown').innerHTML = sports.map(s => {
            const c = (data[s.key] || []).length;
            const l = (data[s.key] || []).filter(m => (m.status||'').toLowerCase() === 'live').length;
            return `<div class="sport-cell">
                <span class="sport-cell-icon">${s.icon}</span>
                <div>
                    <div class="sport-cell-name">${s.name}</div>
                    <div class="sport-cell-meta">${c} matches${l > 0 ? ` · <span style="color:var(--red)">${l} live</span>` : ''}</div>
                </div>
            </div>`;
        }).join('');

        addLog(`Loaded: ${all.length} matches, ${live} live, ${leagues.size} leagues`);
    } catch (e) {
        addLog(`Error: ${e.message}`, 'err');
    }
}

// ===== API Status =====
const API_ENDPOINTS = [
    { name: 'SportScore', url: 'sportscore.com/api/widget/matches/?sport=football&limit=1', type: 'direct' },
    { name: 'SportSRC', url: 'api.sportsrc.org/?data=matches&category=football', type: 'direct' },
    { name: 'nfldata.org', url: '/api/nfldata?season=2026&season_type=2', type: 'proxy' },
    { name: 'TheSportsDB', url: 'www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal', type: 'direct' },
    { name: 'ESPN Cricket', url: 'site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket', type: 'direct' },
    { name: 'Server: SportScore', url: '/api/sportscore?sport=football&limit=1', type: 'proxy' },
    { name: 'Server: nfldata.org', url: '/api/nfldata?season=2026&season_type=2', type: 'proxy' },
    { name: 'Server: TheSportsDB', url: '/api/thesportsdb?path=searchteams.php?t=Arsenal', type: 'proxy' }
];

function renderAPIList() {
    const list = document.getElementById('api-list');
    const proxy = document.getElementById('proxy-list');
    if (!list || !proxy) return;

    const render = (arr) => arr.map(a => `
        <div class="api-row" id="api-${a.name.replace(/[^a-z]/gi,'')}">
            <div class="api-dot pending"></div>
            <div class="api-body">
                <div class="api-name">${a.name}</div>
                <div class="api-url">${a.url}</div>
            </div>
            <div class="api-right">
                <div class="api-time">—</div>
                <button class="api-btn" onclick="checkAPI('${a.name.replace(/'/g,"\\'")}','${a.url.replace(/'/g,"\\'")}')">Test</button>
            </div>
        </div>
    `).join('');

    list.innerHTML = render(API_ENDPOINTS.filter(a => a.type === 'direct'));
    proxy.innerHTML = render(API_ENDPOINTS.filter(a => a.type === 'proxy'));
}

async function checkAPI(name, url) {
    const id = `api-${name.replace(/[^a-z]/gi,'')}`;
    const el = document.getElementById(id);
    if (!el) return;
    const dot = el.querySelector('.api-dot');
    const time = el.querySelector('.api-time');
    dot.className = 'api-dot pending';
    time.textContent = 'Testing...';
    const t0 = Date.now();
    try {
        const proto = url.startsWith('/') ? '' : (url.startsWith('localhost') ? 'http://' : 'https://');
        const res = await fetch(`${proto}${url}`, { signal: AbortSignal.timeout(8000) });
        const ms = Date.now() - t0;
        if (res.ok) {
            dot.className = 'api-dot ok';
            time.textContent = `${ms}ms ✓`;
            addLog(`OK: ${name} (${ms}ms)`);
        } else {
            dot.className = 'api-dot fail';
            time.textContent = `${res.status} ✗`;
            addLog(`FAIL: ${name} → ${res.status}`, 'err');
        }
    } catch (e) {
        dot.className = 'api-dot fail';
        time.textContent = 'Error';
        addLog(`ERR: ${name} → ${e.message}`, 'err');
    }
}

async function checkAllAPIs() {
    addLog('Checking all APIs...');
    await Promise.allSettled(API_ENDPOINTS.map(a => checkAPI(a.name, a.url)));
    addLog('All checks complete');
}

// ===== Matches =====
function filterAdminMatches() {
    const f = document.getElementById('match-sport-filter')?.value || 'all';
    const m = f === 'all' ? allAdminMatches : allAdminMatches.filter(x => x.sport === f);
    const tb = document.getElementById('matches-tbody');
    if (!tb) return;
    if (!m.length) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:2rem;">No matches</td></tr>';
        return;
    }
    const em = { football:'⚽', cricket:'🏏', basketball:'🏀', tennis:'🎾', mma:'🥊', ufc:'🥋', nfl:'🏈' };
    tb.innerHTML = m.slice(0,100).map((x,i) => {
        const s = (x.status||'').toLowerCase();
        const live = s==='live'||s==='in';
        const ft = s==='finished'||s==='post';
        const tc = live?'tag-live':ft?'tag-ft':'tag-up';
        const tt = live?'LIVE':ft?'FT':x.time||'TBD';
        const origIdx = allAdminMatches.indexOf(x);
        return `<tr>
            <td><span class="tag tag-sport">${em[x.sport]||'🏆'} ${x.sport}</span></td>
            <td>${x.team1?.name||'-'}</td>
            <td>${x.team2?.name||'-'}</td>
            <td>${x.score?.team1||'-'} - ${x.score?.team2||'-'}</td>
            <td>${x.league||'-'}</td>
            <td>${x.date||'-'}</td>
            <td><span class="tag ${tc}">${tt}</span></td>
            <td><button class="action-btn" onclick="editMatch(${origIdx})">Edit</button> <button class="action-btn del" onclick="deleteMatch(${origIdx})">Del</button></td>
        </tr>`;
    }).join('');
}

// ===== Settings =====
function loadSettings() {
    const r = localStorage.getItem('refresh_interval') || '5';
    const ri = document.getElementById('setting-refresh');
    const di = document.getElementById('setting-date');
    if (ri) ri.value = r;
    if (di) di.value = new Date().toISOString().split('T')[0];
    updateStorageInfo();
}

function saveSetting(key, id) {
    const el = document.getElementById(id);
    if (!el) return;
    localStorage.setItem(key, el.value);
    addLog(`Saved: ${key} = ${el.value}`);
    alert('Saved!');
}

function updateStorageInfo() {
    let total = 0;
    for (let k in localStorage) {
        if (localStorage.hasOwnProperty(k)) total += localStorage.getItem(k).length * 2;
    }
    const kb = (total / 1024).toFixed(1);
    const pct = Math.min((total / (5120 * 1024)) * 100, 100);
    const fill = document.getElementById('storage-fill');
    const info = document.getElementById('storage-info');
    if (fill) fill.style.width = `${pct}%`;
    if (info) info.textContent = `${kb} KB used (${Object.keys(localStorage).length} keys)`;
}

function clearAllStorage() {
    if (confirm('Clear ALL local data?')) {
        localStorage.clear();
        addLog('Storage cleared', 'warn');
        updateStorageInfo();
        alert('Cleared!');
    }
}

// ===== Match Edit / New Match =====
const OVERRIDES_KEY = 'admin_match_overrides';
const CUSTOM_MATCHES_KEY = 'admin_custom_matches';

function getOverrides() {
    try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o) { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o)); }
function getCustomMatches() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_MATCHES_KEY) || '[]'); } catch { return []; }
}
function saveCustomMatches(m) { localStorage.setItem(CUSTOM_MATCHES_KEY, JSON.stringify(m)); }

function editMatch(idx) {
    const m = allAdminMatches[idx];
    if (!m) return;
    document.getElementById('edit-modal-title').textContent = 'Edit Match';
    document.getElementById('edit-match-idx').value = idx;
    document.getElementById('edit-sport').value = m.sport || 'football';
    document.getElementById('edit-team1').value = m.team1?.name || '';
    document.getElementById('edit-score1').value = m.score?.team1 || '-';
    document.getElementById('edit-team2').value = m.team2?.name || '';
    document.getElementById('edit-score2').value = m.score?.team2 || '-';
    document.getElementById('edit-date').value = m.date || '';
    document.getElementById('edit-time').value = m.time || '19:00';
    document.getElementById('edit-league').value = m.league || '';
    document.getElementById('edit-venue').value = m.venue || '';
    document.getElementById('edit-status').value = (m.status || 'upcoming').toLowerCase();
    document.getElementById('edit-result').value = m.result || '';
    document.getElementById('edit-modal').style.display = 'flex';
}

function openNewMatchModal() {
    document.getElementById('edit-modal-title').textContent = 'Add New Match';
    document.getElementById('edit-match-idx').value = 'new';
    document.getElementById('edit-sport').value = 'football';
    document.getElementById('edit-team1').value = '';
    document.getElementById('edit-score1').value = '-';
    document.getElementById('edit-team2').value = '';
    document.getElementById('edit-score2').value = '-';
    document.getElementById('edit-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('edit-time').value = '19:00';
    document.getElementById('edit-league').value = '';
    document.getElementById('edit-venue').value = '';
    document.getElementById('edit-status').value = 'upcoming';
    document.getElementById('edit-result').value = '';
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function saveEditMatch(e) {
    e.preventDefault();
    const idx = document.getElementById('edit-match-idx').value;
    const sport = document.getElementById('edit-sport').value;
    const status = document.getElementById('edit-status').value;
    const matchData = {
        sport,
        team1: { name: document.getElementById('edit-team1').value.trim() },
        team2: { name: document.getElementById('edit-team2').value.trim() },
        score: { team1: document.getElementById('edit-score1').value.trim() || '-', team2: document.getElementById('edit-score2').value.trim() || '-' },
        date: document.getElementById('edit-date').value,
        time: document.getElementById('edit-time').value || '19:00',
        league: document.getElementById('edit-league').value.trim(),
        venue: document.getElementById('edit-venue').value.trim(),
        status,
        result: document.getElementById('edit-result').value.trim() || undefined
    };

    if (idx === 'new') {
        matchData.id = 'admin_' + Date.now();
        const customs = getCustomMatches();
        customs.push(matchData);
        saveCustomMatches(customs);
        addLog(`NEW MATCH: ${matchData.team1.name} vs ${matchData.team2.name} (${sport})`);
    } else {
        const orig = allAdminMatches[idx];
        if (orig) {
            const overrides = getOverrides();
            const matchId = orig.id || `override_${idx}`;
            overrides[matchId] = matchData;
            saveOverrides(overrides);
            addLog(`EDIT MATCH: ${matchData.team1.name} vs ${matchData.team2.name}`);
        }
    }
    closeEditModal();
    loadAdminMatches();
    alert('Match saved!');
}

function deleteMatch(idx) {
    if (!confirm('Delete this match?')) return;
    const m = allAdminMatches[idx];
    if (m && m.id && m.id.startsWith('admin_')) {
        const customs = getCustomMatches().filter(c => c.id !== m.id);
        saveCustomMatches(customs);
    } else if (m) {
        const overrides = getOverrides();
        overrides[m.id] = { _deleted: true };
        saveOverrides(overrides);
    }
    addLog(`DELETE MATCH: ${m?.team1?.name} vs ${m?.team2?.name}`);
    loadAdminMatches();
}

function clearAllOverrides() {
    if (!confirm('Clear all admin overrides and custom matches?')) return;
    localStorage.removeItem(OVERRIDES_KEY);
    localStorage.removeItem(CUSTOM_MATCHES_KEY);
    addLog('All overrides cleared');
    loadAdminMatches();
}

function renderOverrides() {
    const overrides = getOverrides();
    const customs = getCustomMatches();
    const keys = Object.keys(overrides).filter(k => !overrides[k]._deleted);
    const card = document.getElementById('overrides-card');
    const list = document.getElementById('overrides-list');
    if (!card || !list) return;
    if (keys.length === 0 && customs.length === 0) {
        card.style.display = 'none';
        return;
    }
    card.style.display = 'block';
    let html = '';
    keys.forEach(k => {
        const o = overrides[k];
        html += `<div class="override-item"><span>${o.sport} — ${o.team1?.name} vs ${o.team2?.name} (${o.date})</span><span class="tag tag-ft">edited</span></div>`;
    });
    customs.forEach(c => {
        html += `<div class="override-item"><span>${c.sport} — ${c.team1?.name} vs ${c.team2?.name} (${c.date})</span><span class="tag tag-live">new</span></div>`;
    });
    list.innerHTML = html;
}

async function loadAdminMatches() {
    addLog('Loading matches...');
    try {
        const result = await autoFetchMatches();
        allAdminMatches = [
            ...(result.football || []).map(m => ({...m, sport:'football'})),
            ...(result.cricket || []).map(m => ({...m, sport:'cricket'})),
            ...(result.basketball || []).map(m => ({...m, sport:'basketball'})),
            ...(result.tennis || []).map(m => ({...m, sport:'tennis'})),
            ...(result.mma || []).map(m => ({...m, sport:'mma'})),
            ...(result.ufc || []).map(m => ({...m, sport:'ufc'})),
            ...(result.nfl || []).map(m => ({...m, sport:'nfl'}))
        ];
        const customs = getCustomMatches();
        if (customs.length > 0) allAdminMatches.push(...customs);
        filterAdminMatches();
        renderOverrides();
        addLog(`Loaded ${allAdminMatches.length} matches`);
    } catch (e) {
        addLog(`Error: ${e.message}`, 'err');
    }
}
