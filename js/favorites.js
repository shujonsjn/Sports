/* ============================================
   Favorites + Auth + Notifications System
   ============================================ */

const Favorites = (() => {
    const STORAGE_KEY = 'ls_favorites';
    const AUTH_KEY = 'ls_auth';
    const NOTIF_KEY = 'ls_notifications';
    const CHECK_INTERVAL = 30000;

    let listeners = [];
    let checkTimer = null;

    /* ---- Auth ---- */
    function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function isPhone(v) { return /^\+?[\d\s\-()]{7,15}$/.test(v); }
    function normalizeContact(v) { return (v || '').trim().toLowerCase(); }

    function getUser() {
        try {
            const raw = localStorage.getItem(AUTH_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (data.expiresAt && Date.now() > data.expiresAt) {
                localStorage.removeItem(AUTH_KEY);
                return null;
            }
            return data;
        } catch { return null; }
    }

    function login(contact, password) {
        const c = normalizeContact(contact);
        const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
        const user = users.find(u => normalizeContact(u.contact) === c && u.password === password);
        if (!user) return { ok: false, error: 'Invalid email/phone or password' };
        const session = { contact: user.contact, name: user.name, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
        emit('auth-changed');
        return { ok: true };
    }

    function register(contact, password, confirmPassword, name) {
        const c = normalizeContact(contact);
        if (!contact || !c) return { ok: false, error: 'Enter email or phone number' };
        if (!isEmail(c) && !isPhone(c)) return { ok: false, error: 'Enter a valid email or phone number' };
        if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };
        if (password !== confirmPassword) return { ok: false, error: 'Passwords do not match' };
        const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
        if (users.find(u => normalizeContact(u.contact) === c)) return { ok: false, error: 'Account already exists with this email/phone' };
        return { ok: true, needOtp: true, contact: c };
    }

    async function generateOtp(contact) {
        try {
            const res = await fetch('/api/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate', contact })
            });
            const data = await res.json();
            if (data.success) {
                return { ok: true };
            }
            return { ok: false, error: data.error || 'Failed to generate OTP' };
        } catch (e) {
            return { ok: false, error: 'Connection error' };
        }
    }

    async function verifyOtpAndRegister(contact, password, name, otp) {
        const c = normalizeContact(contact);
        try {
            const res = await fetch('/api/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', contact: c, otp })
            });
            const data = await res.json();
            if (!data.success) {
                return { ok: false, error: data.error || 'Invalid OTP' };
            }
            const users = JSON.parse(localStorage.getItem('ls_users') || '[]');
            users.push({ contact, password, name: name || c });
            localStorage.setItem('ls_users', JSON.stringify(users));
            sessionStorage.removeItem('ls_pending_reg');
            return login(contact, password);
        } catch (e) {
            return { ok: false, error: 'Connection error' };
        }
    }

    function logout() {
        localStorage.removeItem(AUTH_KEY);
        emit('auth-changed');
    }

    /* ---- Favorites ---- */
    function getAll() {
        const user = getUser();
        if (!user) return [];
        try {
            const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return all[normalizeContact(user.contact)] || [];
        } catch { return []; }
    }

    function isFavorite(matchId) {
        return getAll().includes(String(matchId));
    }

    function toggle(matchId) {
        const user = getUser();
        if (!user) { showLoginModal(); return false; }
        const id = String(matchId);
        const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const key = normalizeContact(user.contact);
        const list = all[key] || [];
        const idx = list.indexOf(id);
        if (idx >= 0) {
            list.splice(idx, 1);
        } else {
            list.push(id);
        }
        all[key] = list;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        emit('favorites-changed');
        return idx < 0;
    }

    /* ---- Notifications ---- */
    function getNotifications() {
        const user = getUser();
        if (!user) return [];
        try {
            const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
            return all[normalizeContact(user.contact)] || [];
        } catch { return []; }
    }

    function getUnreadCount() {
        return getNotifications().filter(n => !n.read).length;
    }

    function addNotification(title, body, matchId) {
        const user = getUser();
        if (!user) return;
        const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
        const key = normalizeContact(user.contact);
        const list = all[key] || [];
        list.unshift({
            id: Date.now(),
            title,
            body,
            matchId,
            read: false,
            time: new Date().toISOString()
        });
        if (list.length > 50) list.length = 50;
        all[key] = list;
        localStorage.setItem(NOTIF_KEY, JSON.stringify(all));
        emit('notifications-changed');
    }

    function markAllRead() {
        const user = getUser();
        if (!user) return;
        const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
        const key = normalizeContact(user.contact);
        const list = all[key] || [];
        list.forEach(n => n.read = true);
        all[key] = list;
        localStorage.setItem(NOTIF_KEY, JSON.stringify(all));
        emit('notifications-changed');
    }

    function clearNotifications() {
        const user = getUser();
        if (!user) return;
        const all = JSON.parse(localStorage.getItem(NOTIF_KEY) || '{}');
        all[normalizeContact(user.contact)] = [];
        localStorage.setItem(NOTIF_KEY, JSON.stringify(all));
        emit('notifications-changed');
    }

    /* ---- Match Status Checker ---- */
    function checkFavoritedMatches() {
        const user = getUser();
        if (!user) return;
        const favIds = getAll();
        if (!favIds.length) return;
        const seen = new Set();

        (window.currentRenderedMatches || []).forEach(m => {
            if (!favIds.includes(String(m.id))) return;
            const key = `${m.id}_status`;
            const prev = seen.has(key) ? null : JSON.parse(localStorage.getItem('ls_fav_status') || '{}')[key];
            const status = typeof getMatchStatus === 'function' ? getMatchStatus(m) : 'unknown';

            if (!prev) {
                if (!localStorage.getItem('ls_fav_status')) localStorage.setItem('ls_fav_status', '{}');
                const stored = JSON.parse(localStorage.getItem('ls_fav_status'));
                stored[key] = status;
                localStorage.setItem('ls_fav_status', JSON.stringify(stored));
                seen.add(key);
                return;
            }

            if (prev !== status && status === 'live') {
                const t1 = m.team1?.name || 'Team 1';
                const t2 = m.team2?.name || 'Team 2';
                addNotification(
                    `${t1} vs ${t2} is LIVE!`,
                    `Your favorited match just started. Tap to view live scores.`,
                    m.id
                );
                if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    try { new Notification('Match LIVE!', { body: `${t1} vs ${t2} - Tap to watch`, icon: '/favicon.ico' }); } catch {}
                }
            }

            if (prev !== status && status === 'finished') {
                const t1 = m.team1?.name || 'Team 1';
                const t2 = m.team2?.name || 'Team 2';
                const s1 = m.score?.team1 || '-';
                const s2 = m.score?.team2 || '-';
                addNotification(
                    `${t1} vs ${t2} finished`,
                    `Final score: ${s1} - ${s2}`,
                    m.id
                );
            }

            const stored2 = JSON.parse(localStorage.getItem('ls_fav_status') || '{}');
            stored2[key] = status;
            localStorage.setItem('ls_fav_status', JSON.stringify(stored2));
            seen.add(key);
        });
    }

    function startChecker() {
        if (checkTimer) clearInterval(checkTimer);
        checkTimer = setInterval(checkFavoritedMatches, CHECK_INTERVAL);
    }

    /* ---- Events ---- */
    function on(event, fn) { listeners.push({ event, fn }); }
    function off(event, fn) { listeners = listeners.filter(l => !(l.event === event && l.fn === fn)); }
    function emit(event) { listeners.filter(l => l.event === event).forEach(l => l.fn()); }

    return {
        getUser, login, register, logout, generateOtp, verifyOtpAndRegister,
        getAll, isFavorite, toggle,
        getNotifications, getUnreadCount, addNotification, markAllRead, clearNotifications,
        startChecker, checkFavoritedMatches,
        _nc: normalizeContact,
        on, off
    };
})();

/* ---- UI Functions ---- */
function switchLoginTab(tab) {
    const loginTab = document.getElementById('login-tab');
    const regTab = document.getElementById('reg-tab');
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const regStep1 = document.getElementById('reg-step1');
    const regStep2 = document.getElementById('reg-step2');
    if (tab === 'login') {
        loginTab.classList.add('active');
        regTab.classList.remove('active');
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
    } else {
        regTab.classList.add('active');
        loginTab.classList.remove('active');
        regForm.style.display = 'block';
        loginForm.style.display = 'none';
        if (regStep1) regStep1.style.display = 'block';
        if (regStep2) regStep2.style.display = 'none';
        document.getElementById('reg-error').textContent = '';
    }
}

function showLoginModal() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('login-tab').click();
}

function hideLoginModal() {
    document.getElementById('login-overlay').style.display = 'none';
}

function handleLogin() {
    const c = document.getElementById('login-contact').value.trim();
    const p = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    if (!c || !p) { err.textContent = 'Please fill all fields'; return; }
    const result = Favorites.login(c, p);
    if (result.ok) {
        hideLoginModal();
        updateAuthUI();
        if (typeof renderMatchList === 'function') renderMatchList(currentRenderedMatches || []);
    } else {
        err.textContent = result.error;
    }
}

async function handleRegister() {
    const c = document.getElementById('reg-contact').value.trim();
    const p = document.getElementById('reg-password').value;
    const cp = document.getElementById('reg-confirm-password').value;
    const n = document.getElementById('reg-name').value.trim();
    const err = document.getElementById('reg-error');
    const step1Btn = document.querySelector('#reg-step1 .login-btn');
    
    if (!c || !p || !cp) { err.textContent = 'Please fill all fields'; return; }
    const result = Favorites.register(c, p, cp, n);
        if (result.ok && result.needOtp) {
            if (step1Btn) { step1Btn.disabled = true; step1Btn.textContent = 'Sending OTP...'; }
            const otpResult = await Favorites.generateOtp(c);
            if (step1Btn) { step1Btn.disabled = false; step1Btn.textContent = 'Send OTP'; }
            
            if (otpResult.ok) {
                sessionStorage.setItem('ls_pending_reg', JSON.stringify({ contact: c, password: p, name: n }));
                document.getElementById('reg-step1').style.display = 'none';
                document.getElementById('reg-step2').style.display = 'block';
                document.getElementById('otp-display').textContent = c;
                document.getElementById('otp-target').textContent = c;
                err.textContent = '';
            } else {
                err.textContent = otpResult.error;
            }
    } else if (!result.ok) {
        err.textContent = result.error;
    }
}

async function handleVerifyOtp() {
    const otp = document.getElementById('otp-input').value.trim();
    const err = document.getElementById('otp-error');
    const step2Btn = document.querySelector('#reg-step2 .login-btn');
    
    if (!otp || otp.length !== 6) { err.textContent = 'Enter 6-digit OTP'; return; }
    
    if (step2Btn) { step2Btn.disabled = true; step2Btn.textContent = 'Verifying...'; }
    
    const pending = JSON.parse(sessionStorage.getItem('ls_pending_reg') || '{}');
    const result = await Favorites.verifyOtpAndRegister(pending.contact, pending.password, pending.name, otp);
    
    if (step2Btn) { step2Btn.disabled = false; step2Btn.textContent = 'Verify & Create Account'; }
    
    if (result.ok) {
        hideLoginModal();
        updateAuthUI();
        if (typeof renderMatchList === 'function') renderMatchList(currentRenderedMatches || []);
    } else {
        err.textContent = result.error;
    }
}

async function resendOtp() {
    const pending = JSON.parse(sessionStorage.getItem('ls_pending_reg') || '{}');
    if (!pending.contact) return;
    
    const result = await Favorites.generateOtp(pending.contact);
    if (result.ok) {
        document.getElementById('otp-display').textContent = pending.contact;
        document.getElementById('otp-resend-msg').textContent = 'OTP resent!';
    } else {
        document.getElementById('otp-resend-msg').textContent = 'Failed to resend OTP';
    }
    setTimeout(() => { const el = document.getElementById('otp-resend-msg'); if (el) el.textContent = ''; }, 3000);
}

function backToRegister() {
    document.getElementById('reg-step2').style.display = 'none';
    document.getElementById('reg-step1').style.display = 'block';
}

function handleLogout() {
    Favorites.logout();
    updateAuthUI();
    if (typeof renderMatchList === 'function') renderMatchList(currentRenderedMatches || []);
}

function updateAuthUI() {
    const user = Favorites.getUser();
    const profileName = document.querySelector('.profile-name');
    const profileAvatar = document.querySelector('.profile-avatar');
    const authItem = document.getElementById('auth-menu-item');
    const logoutItem = document.getElementById('logout-menu-item');
    if (user) {
        if (profileName) profileName.textContent = user.name || user.username;
        if (profileAvatar) profileAvatar.textContent = user.name ? user.name[0].toUpperCase() : '👤';
        if (authItem) authItem.style.display = 'none';
        if (logoutItem) logoutItem.style.display = 'block';
    } else {
        if (profileName) profileName.textContent = 'Guest User';
        if (profileAvatar) profileAvatar.textContent = '👤';
        if (authItem) authItem.style.display = 'block';
        if (logoutItem) logoutItem.style.display = 'none';
    }
    updateFavButtons();
    updateNotifBadge();
}

function updateFavButtons() {
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const id = btn.dataset.matchId;
        const isFav = Favorites.isFavorite(id);
        btn.classList.toggle('active', isFav);
        btn.title = isFav ? 'Remove from Favorites' : 'Add to Favorites';
        btn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
    });
}

function toggleFavorite(matchId, event) {
    if (event) event.stopPropagation();
    const added = Favorites.toggle(matchId);
    updateFavButtons();
}

/* ---- Notification UI ---- */
function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const count = Favorites.getUnreadCount();
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (panel.style.display === 'block') {
        panel.style.display = 'none';
    } else {
        renderNotifList();
        panel.style.display = 'block';
    }
}

function renderNotifList() {
    const container = document.getElementById('notif-list');
    const notifs = Favorites.getNotifications();
    if (!notifs.length) {
        container.innerHTML = '<div class="notif-empty-state"><div class="empty-icon">🔔</div><p>No notifications yet</p></div>';
        return;
    }
    container.innerHTML = notifs.map(n => {
        const time = n.time ? new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const ago = n.time ? getTimeAgo(new Date(n.time)) : '';
        return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="handleNotifClick(${n.matchId})">
            <div class="notif-icon">${n.title.includes('LIVE') ? '🔴' : '✅'}</div>
            <div class="notif-content">
                <div class="notif-title">${escHtml ? escHtml(n.title) : n.title}</div>
                <div class="notif-body">${escHtml ? escHtml(n.body) : n.body}</div>
                <div class="notif-time">${ago || time}</div>
            </div>
        </div>`;
    }).join('');
}

function getTimeAgo(date) {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

function handleNotifClick(matchId) {
    const user = Favorites.getUser();
    if (!user) return;
    const all = JSON.parse(localStorage.getItem('ls_notifications') || '{}');
    const key = Favorites._nc(user.contact);
    const list = all[key] || [];
    const notif = list.find(n => String(n.matchId) === String(matchId) && !n.read);
    if (notif) notif.read = true;
    all[key] = list;
    localStorage.setItem('ls_notifications', JSON.stringify(all));
    updateNotifBadge();
    renderNotifList();
    if (matchId && typeof selectMatch === 'function') {
        selectMatch(matchId);
    }
}

function markAllNotifsRead() {
    Favorites.markAllRead();
    updateNotifBadge();
    renderNotifList();
}

function clearAllNotifs() {
    Favorites.clearNotifications();
    updateNotifBadge();
    renderNotifList();
}

function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/* ---- Events ---- */
Favorites.on('auth-changed', () => { updateAuthUI(); });
Favorites.on('favorites-changed', () => { updateFavButtons(); });
Favorites.on('notifications-changed', () => { updateNotifBadge(); });

document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    Favorites.startChecker();
    requestNotifPermission();
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('notif-panel');
        const btn = document.querySelector('.notif-btn');
        if (panel && panel.style.display === 'block' && !panel.contains(e.target) && !btn.contains(e.target)) {
            panel.style.display = 'none';
        }
    });
});
