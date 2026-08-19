// ===== Admin Dashboard =====

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const SESSION_KEY = 'admin_session';

function isLoggedIn() {
    const s = localStorage.getItem(SESSION_KEY);
    if (!s) return false;
    const d = JSON.parse(s);
    if (Date.now() - d.time > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(SESSION_KEY);
        return false;
    }
    return true;
}

function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error');
    if (u === ADMIN_USER && p === ADMIN_PASS) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: u, time: Date.now() }));
        showAdminApp();
    } else {
        err.textContent = 'Invalid username or password';
        err.style.display = 'block';
        document.getElementById('login-pass').value = '';
        document.getElementById('login-pass').focus();
    }
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
            ...(data.tabletennis || []),
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
    { name: 'nfldata.org', url: 'api.nfldata.org/v1/games?season=2026&season_type=2', type: 'direct' },
    { name: 'TheSportsDB', url: 'www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal', type: 'direct' },
    { name: 'ESPN Cricket', url: 'site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket', type: 'direct' },
    { name: 'Server: SportScore', url: 'localhost:8080/api?sport=football&limit=1', type: 'proxy' },
    { name: 'Server: SportSRC', url: 'localhost:8080/api/sportsrc?category=football', type: 'proxy' },
    { name: 'Server: nfldata.org', url: 'localhost:8080/api/nfldata?season=2026&season_type=2', type: 'proxy' },
    { name: 'Server: TheSportsDB', url: 'localhost:8080/api/thesportsdb?path=searchteams.php?t=Arsenal', type: 'proxy' }
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
                <button class="api-btn" onclick="checkAPI('${a.name}','${a.url}')">Test</button>
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
        const proto = url.startsWith('localhost') ? 'http://' : 'https://';
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
async function loadAdminMatches() {
    addLog('Loading matches...');
    try {
        const data = await autoFetchMatches();
        if (!data) return;
        allAdminMatches = [
            ...(data.football || []).map(m => ({...m, sport:'football'})),
            ...(data.cricket || []).map(m => ({...m, sport:'cricket'})),
            ...(data.basketball || []).map(m => ({...m, sport:'basketball'})),
            ...(data.tabletennis || []).map(m => ({...m, sport:'tennis'})),
            ...(data.mma || []).map(m => ({...m, sport:'mma'})),
            ...(data.ufc || []).map(m => ({...m, sport:'ufc'})),
            ...(data.nfl || []).map(m => ({...m, sport:'nfl'}))
        ];
        filterAdminMatches();
        addLog(`Loaded ${allAdminMatches.length} matches`);
    } catch (e) {
        addLog(`Error: ${e.message}`, 'err');
    }
}

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
    tb.innerHTML = m.slice(0,100).map(x => {
        const s = (x.status||'').toLowerCase();
        const live = s==='live'||s==='in';
        const ft = s==='finished'||s==='post';
        const tc = live?'tag-live':ft?'tag-ft':'tag-up';
        const tt = live?'LIVE':ft?'FT':x.time||'TBD';
        return `<tr>
            <td><span class="tag tag-sport">${em[x.sport]||'🏆'} ${x.sport}</span></td>
            <td>${x.team1?.name||'-'}</td>
            <td>${x.team2?.name||'-'}</td>
            <td>${x.score?.team1||'-'} - ${x.score?.team2||'-'}</td>
            <td>${x.league||'-'}</td>
            <td>${x.date||'-'}</td>
            <td><span class="tag ${tc}">${tt}</span></td>
        </tr>`;
    }).join('');
}

// ===== Settings =====
function loadSettings() {
    const k = localStorage.getItem('cricket_api_key') || '';
    const r = localStorage.getItem('refresh_interval') || '5';
    const ci = document.getElementById('setting-cricket-key');
    const ri = document.getElementById('setting-refresh');
    const di = document.getElementById('setting-date');
    if (ci) ci.value = k;
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
