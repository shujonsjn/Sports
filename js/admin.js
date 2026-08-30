// ===== Admin Dashboard — SVG Spec =====

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
    refreshDashboard();
    loadAdminMatches();
    drawChart();
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
    const t = { dashboard: 'Dashboard', matches: 'Matches', settings: 'Settings', apis: 'API Status', leagues: 'Leagues', teams: 'Teams', streams: 'Streams', news: 'News', users: 'Users', analytics: 'Analytics' };
    document.getElementById('page-title').textContent = t[page] || 'Dashboard';
    if (page === 'settings') loadSettings();
    if (page === 'teams') { scanMissingLogos(); renderCustomLogosList(); }
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

        const live = all.filter(m => ['live', 'in'].includes((m.status || '').toLowerCase())).length;

        document.getElementById('stat-total').textContent = all.length.toLocaleString();
        document.getElementById('stat-live').textContent = live;

        addLog(`Loaded: ${all.length} matches, ${live} live`);
    } catch (e) {
        addLog(`Error: ${e.message}`, 'err');
    }
}

// ===== Chart =====
function drawChart() {
    var canvas = document.getElementById('visitors-chart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.parentElement.offsetWidth - 32;
    var h = 200;
    canvas.height = h;

    var data = [85, 92, 78, 105, 98, 120, 110];
    var labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var maxVal = Math.max(...data) * 1.2;
    var padL = 40, padR = 20, padT = 20, padB = 30;
    var chartW = w - padL - padR;
    var chartH = h - padT - padB;

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
        var y = padT + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }

    // X labels
    ctx.fillStyle = '#737984';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (var i = 0; i < labels.length; i++) {
        var x = padL + (chartW / (labels.length - 1)) * i;
        ctx.fillText(labels[i], x, h - 8);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#F22D55';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (var i = 0; i < data.length; i++) {
        var x = padL + (chartW / (data.length - 1)) * i;
        var y = padT + chartH - (data[i] / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Dots
    for (var i = 0; i < data.length; i++) {
        var x = padL + (chartW / (data.length - 1)) * i;
        var y = padT + chartH - (data[i] / maxVal) * chartH;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#F22D55'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
}

// ===== Matches =====
function filterAdminMatches() {
    var f = document.getElementById('match-sport-filter')?.value || 'all';
    var m = f === 'all' ? allAdminMatches : allAdminMatches.filter(x => x.sport === f);
    renderMatchTable(m, 'matches-tbody-full');
    renderMatchTable(m.slice(0, 4), 'matches-tbody');
}

function renderMatchTable(matches, tbodyId) {
    var tb = document.getElementById(tbodyId);
    if (!tb) return;
    if (!matches.length) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem;">No matches</td></tr>';
        return;
    }
    var isFull = tbodyId === 'matches-tbody-full';
    tb.innerHTML = matches.map((x, i) => {
        var s = (x.status || '').toLowerCase();
        var live = s === 'live' || s === 'in';
        var ft = s === 'finished' || s === 'post';
        var tc = live ? 'tag-live' : ft ? 'tag-ft' : 'tag-up';
        var tt = live ? 'LIVE' : ft ? 'FINISHED' : 'UPCOMING';
        var timeOrScore = live ? (x.time || 'LIVE') : ft ? (x.score?.team1 || '-') + ' - ' + (x.score?.team2 || '-') : (x.time || 'TBD');
        var origIdx = allAdminMatches.indexOf(x);
        var sportEmoji = {football:'⚽',cricket:'🏏',basketball:'🏀',tennis:'🎾',mma:'🥊',ufc:'🥋',nfl:'🏈'}[x.sport] || '🏟️';
        var cols = isFull
            ? `<td>${sportEmoji} ${x.sport || '-'}</td><td>${x.team1?.name || '-'}</td><td>${x.team2?.name || '-'}</td><td>${x.score?.team1 || '-'} - ${x.score?.team2 || '-'}</td><td>${x.league || '-'}</td><td>${x.date || '-'}</td>`
            : `<td>${x.team1?.name || '-'} vs ${x.team2?.name || '-'}</td><td>${x.league || '-'}</td>`;
        return `<tr>
            ${cols}
            <td><span class="tag ${tc}">${tt}</span></td>
            <td>${isFull ? (x.date || '-') : timeOrScore}</td>
            <td><button class="action-btn" onclick="editMatch(${origIdx})">Edit</button> <button class="action-btn del" onclick="deleteMatch(${origIdx})">Delete</button></td>
        </tr>`;
    }).join('');
}

// ===== Settings =====
function loadSettings() {
    var r = localStorage.getItem('refresh_interval') || '5';
    var ri = document.getElementById('setting-refresh');
    var di = document.getElementById('setting-date');
    if (ri) ri.value = r;
    if (di) di.value = new Date().toISOString().split('T')[0];
    updateStorageInfo();
}

function saveSetting(key, id) {
    var el = document.getElementById(id);
    if (!el) return;
    localStorage.setItem(key, el.value);
    addLog(`Saved: ${key} = ${el.value}`);
}

function updateStorageInfo() {
    var total = 0;
    for (var k in localStorage) {
        if (localStorage.hasOwnProperty(k)) total += localStorage.getItem(k).length * 2;
    }
    var kb = (total / 1024).toFixed(1);
    var pct = Math.min((total / (5120 * 1024)) * 100, 100);
    var fill = document.getElementById('storage-fill');
    var info = document.getElementById('storage-info');
    if (fill) fill.style.width = pct + '%';
    if (info) info.textContent = kb + ' KB used (' + Object.keys(localStorage).length + ' keys)';
}

function clearAllStorage() {
    if (confirm('Clear ALL local data?')) {
        localStorage.clear();
        addLog('Storage cleared', 'warn');
        updateStorageInfo();
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
    var m = allAdminMatches[idx];
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
    var idx = document.getElementById('edit-match-idx').value;
    var sport = document.getElementById('edit-sport').value;
    var status = document.getElementById('edit-status').value;
    var matchData = {
        sport: sport,
        team1: { name: document.getElementById('edit-team1').value.trim() },
        team2: { name: document.getElementById('edit-team2').value.trim() },
        score: { team1: document.getElementById('edit-score1').value.trim() || '-', team2: document.getElementById('edit-score2').value.trim() || '-' },
        date: document.getElementById('edit-date').value,
        time: document.getElementById('edit-time').value || '19:00',
        league: document.getElementById('edit-league').value.trim(),
        venue: document.getElementById('edit-venue').value.trim(),
        status: status,
        result: document.getElementById('edit-result').value.trim() || undefined
    };

    if (idx === 'new') {
        matchData.id = 'admin_' + Date.now();
        var customs = getCustomMatches();
        customs.push(matchData);
        saveCustomMatches(customs);
        addLog('NEW MATCH: ' + matchData.team1.name + ' vs ' + matchData.team2.name + ' (' + sport + ')');
    } else {
        var orig = allAdminMatches[idx];
        if (orig) {
            var overrides = getOverrides();
            var matchId = orig.id || 'override_' + idx;
            overrides[matchId] = matchData;
            saveOverrides(overrides);
            addLog('EDIT MATCH: ' + matchData.team1.name + ' vs ' + matchData.team2.name);
        }
    }
    closeEditModal();
    loadAdminMatches();
}

function deleteMatch(idx) {
    if (!confirm('Delete this match?')) return;
    var m = allAdminMatches[idx];
    if (m && m.id && m.id.startsWith('admin_')) {
        var customs = getCustomMatches().filter(c => c.id !== m.id);
        saveCustomMatches(customs);
    } else if (m) {
        var overrides = getOverrides();
        overrides[m.id] = { _deleted: true };
        saveOverrides(overrides);
    }
    addLog('DELETE MATCH: ' + (m?.team1?.name || '') + ' vs ' + (m?.team2?.name || ''));
    loadAdminMatches();
}

async function loadAdminMatches() {
    addLog('Loading matches...');
    try {
        var result = await autoFetchMatches();
        allAdminMatches = [
            ...(result.football || []).map(m => ({ ...m, sport: 'football' })),
            ...(result.cricket || []).map(m => ({ ...m, sport: 'cricket' })),
            ...(result.basketball || []).map(m => ({ ...m, sport: 'basketball' })),
            ...(result.tennis || []).map(m => ({ ...m, sport: 'tennis' })),
            ...(result.mma || []).map(m => ({ ...m, sport: 'mma' })),
            ...(result.ufc || []).map(m => ({ ...m, sport: 'ufc' })),
            ...(result.nfl || []).map(m => ({ ...m, sport: 'nfl' }))
        ];
        var customs = getCustomMatches();
        if (customs.length > 0) allAdminMatches.push(...customs);
        filterAdminMatches();
        addLog('Loaded ' + allAdminMatches.length + ' matches');
    } catch (e) {
        addLog('Error: ' + e.message, 'err');
    }
}

// ===== API Status Check =====
async function checkAllAPIs() {
    var container = document.getElementById('api-list');
    if (!container) return;
    container.innerHTML = '<div class="status-row"><span class="status-name">Checking APIs...</span></div>';
    var endpoints = [
        { name: 'SportSRC (Football)', url: '/api/sportsrc?category=football&limit=1' },
        { name: 'ESPN Scores (Football)', url: '/api/espn-scores?sport=football' },
        { name: 'ESPN Scores (Basketball)', url: '/api/espn-scores?sport=basketball' },
        { name: 'ESPN Scores (NFL)', url: '/api/espn-scores?sport=nfl' },
        { name: 'CricketData.org', url: '/api/cricketdata' },
        { name: 'nfldata.org', url: '/api/nfldata?season=2026&season_type=2' },
        { name: 'TheSportsDB (Logos)', url: '/api/thesportsdb?path=searchteams.php&t=Arsenal' },
        { name: 'Admin Auth', url: '/api/admin?action=status' }
    ];
    var results = [];
    for (var ep of endpoints) {
        var start = Date.now();
        try {
            var r = await fetch(ep.url, { signal: AbortSignal.timeout(8000) });
            var ms = Date.now() - start;
            results.push({ name: ep.name, ok: r.ok, status: r.status, ms: ms });
        } catch (e) {
            results.push({ name: ep.name, ok: false, status: 'Error', ms: Date.now() - start, error: e.message });
        }
    }
    container.innerHTML = results.map(r => {
        var cls = r.ok ? 'green' : 'red';
        var label = r.ok ? `${r.status} (${r.ms}ms)` : `${r.status} ${r.error || ''}`;
        return `<div class="status-row"><span class="status-dot ${cls}"></span><span class="status-name">${r.name}</span><span class="status-val ${cls}">${label}</span></div>`;
    }).join('');
    addLog('API check complete: ' + results.filter(r => r.ok).length + '/' + results.length + ' OK');
}

// ===== Logo Management =====

async function scanMissingLogos() {
    addLog('Scanning for missing logos...');
    if (!allAdminMatches || allAdminMatches.length === 0) {
        addLog('Loading match data first...');
        await loadAdminMatches();
    }
    const allMatches = allAdminMatches || [];
    const custom = getCustomLogos();
    const seen = new Set();
    const missing = [];

    allMatches.forEach(m => {
        [m.team1, m.team2].forEach(t => {
            const name = (t?.name || '').trim();
            if (!name || name === '-' || name === 'TBA') return;
            const key = name.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            const logo = fetchTeamLogo(name);
            if (!logo) {
                missing.push({ name, sport: m.sport || 'football' });
            }
        });
    });

    const tbody = document.getElementById('missing-logos-tbody');
    const emptyEl = document.getElementById('missing-logos-empty');
    if (!tbody) return;

    if (missing.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = missing.map(t => {
        const escName = t.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `<tr>
            <td><strong>${t.name}</strong></td>
            <td>${t.sport}</td>
            <td><span style="color:#747A84">No logo</span></td>
            <td><input type="url" class="form-input input-sm" id="logo-url-${escName}" placeholder="Paste logo URL..."></td>
            <td><div id="logo-preview-${escName}" style="width:36px;height:36px;border-radius:50%;border:1px solid #E4E7EB;display:flex;align-items:center;justify-content:center;background:#f5f6f8"><span style="color:#aaa">?</span></div></td>
            <td><button class="btn btn-sm btn-accent" onclick="saveMissingLogo('${escName}')">Save</button></td>
        </tr>`;
    }).join('');

    missing.forEach(t => {
        const input = document.getElementById('logo-url-' + t.name);
        const preview = document.getElementById('logo-preview-' + t.name);
        if (input && preview) {
            input.addEventListener('input', function() {
                const url = this.value.trim();
                if (url) {
                    preview.innerHTML = `<img src="${url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" onload="this.style.display='';this.nextElementSibling.style.display='none'"><span style="display:none;color:#aaa">?</span>`;
                } else {
                    preview.innerHTML = '<span style="color:#aaa">?</span>';
                }
            });
        }
    });

    addLog('Scanned: ' + missing.length + ' teams missing logos');
}

function saveMissingLogo(teamName) {
    const input = document.getElementById('logo-url-' + teamName);
    if (!input) return;
    const url = input.value.trim();
    if (!url) { alert('Please paste a logo URL'); return; }
    setCustomLogo(teamName, url);
    input.value = '';
    addLog('Logo saved for: ' + teamName);
    scanMissingLogos();
    renderCustomLogosList();
}

function renderCustomLogosList() {
    const custom = getCustomLogos();
    const keys = Object.keys(custom);
    const tbody = document.getElementById('custom-logos-tbody');
    const emptyEl = document.getElementById('custom-logos-empty');
    if (!tbody) return;

    if (keys.length === 0) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    tbody.innerHTML = keys.map(key => {
        const url = custom[key];
        return `<tr>
            <td><strong>${key}</strong></td>
            <td><span style="font-size:0.75rem;color:#747A84;word-break:break-all">${url}</span></td>
            <td><img src="${url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1px solid #E4E7EB" onerror="this.style.display='none'" onload="this.style.display=''"></td>
            <td><button class="btn btn-sm btn-red" onclick="deleteCustomLogoAdmin('${key}')">Delete</button></td>
        </tr>`;
    }).join('');

    addLog('Custom logos: ' + keys.length + ' entries');
}

function deleteCustomLogoAdmin(teamName) {
    if (!confirm('Delete logo for "' + teamName + '"?')) return;
    removeCustomLogo(teamName);
    addLog('Deleted custom logo: ' + teamName);
    renderCustomLogosList();
    scanMissingLogos();
}

function addCustomLogo() {
    const nameInput = document.getElementById('add-logo-team');
    const urlInput = document.getElementById('add-logo-url');
    if (!nameInput || !urlInput) return;
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name) { alert('Enter team name'); return; }
    if (!url) { alert('Enter logo URL'); return; }
    setCustomLogo(name, url);
    nameInput.value = '';
    urlInput.value = '';
    document.getElementById('add-logo-preview').innerHTML = '<span style="color:#747A84;font-size:1.2rem">?</span>';
    addLog('Custom logo added: ' + name);
    renderCustomLogosList();
    scanMissingLogos();
}

function exportCustomLogos() {
    const custom = getCustomLogos();
    const blob = new Blob([JSON.stringify(custom, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'custom-logos.json';
    a.click();
    addLog('Exported custom logos');
}

// Live preview for "Add Custom Logo" form
document.addEventListener('DOMContentLoaded', function() {
    const urlInput = document.getElementById('add-logo-url');
    const preview = document.getElementById('add-logo-preview');
    if (urlInput && preview) {
        urlInput.addEventListener('input', function() {
            const url = this.value.trim();
            if (url) {
                preview.innerHTML = `<img src="${url}" style="width:48px;height:48px;border-radius:50%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" onload="this.style.display='';this.nextElementSibling.style.display='none'"><span style="display:none;color:#747A84;font-size:1.2rem">?</span>`;
            } else {
                preview.innerHTML = '<span style="color:#747A84;font-size:1.2rem">?</span>';
            }
        });
    }
    renderCustomLogosList();
});
