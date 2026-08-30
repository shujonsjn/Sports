// ===== Countdown Timer Module =====

let countdownIntervals = {};

// Calculate remaining time
function calculateRemaining(matchDateTime) {
    const now = new Date();
    const matchTime = new Date(matchDateTime);
    const diff = matchTime - now;

    if (diff <= 0) {
        return null;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
        hours: padZero(hours),
        minutes: padZero(minutes),
        seconds: padZero(seconds),
        total: diff
    };
}

// Pad number with leading zero
function padZero(num) {
    return String(num).padStart(2, '0');
}

// Format countdown display
function formatCountdown(remaining) {
    if (!remaining) {
        return 'Started';
    }
    return `${remaining.hours}:${remaining.minutes}:${remaining.seconds}`;
}

// Get match date time
function getMatchDateTime(date, time) {
    return new Date(`${date}T${time}:00`);
}

// Provider status takes priority. No arbitrary time rules.
function getMatchStatus(match) {
    if (!match) return 'upcoming';
    const explicit = String(match.status || '').toLowerCase();
    const text = String(match.statusText || '').toLowerCase();
    if (['cancelled','canceled'].includes(explicit) || /\b(cancelled|canceled)\b/.test(text)) return 'finished';
    if (['finished','final','post'].includes(explicit) || /\b(final|finished|ft|ended)\b/.test(text)) return 'finished';
    if (['live','in','in_progress','in-progress','suspended','halftime'].includes(explicit) || /\b(live|in progress|halftime|quarter|period)\b/.test(text)) {
        const hasInnings = match.innings && match.innings.length >= 2 && match.innings.some(arr => arr && arr.length > 0 && arr.some(i => i && i.runs && i.runs !== '-'));
        const s1 = String(match.score?.team1 || '').trim();
        const s2 = String(match.score?.team2 || '').trim();
        const hasScores = (s1 && s1 !== '-' && s2 && s2 !== '-') || hasInnings;
        if (hasScores) return 'live';
    }
    const dt = getMatchDateTime(match.date, match.time);
    const now = new Date();
    if (!dt || isNaN(dt.getTime())) return 'upcoming';
    if (dt > now) return 'upcoming';
    const todayStr = now.toISOString().split('T')[0];
    if (match.date < todayStr) return 'finished';
    if (now > new Date(dt.getTime() + 24 * 60 * 60 * 1000)) return 'finished';
    const hasInnings = match.innings && match.innings.length >= 2 && match.innings.some(arr => arr && arr.length > 0 && arr.some(i => i && i.runs && i.runs !== '-'));
    const s1 = String(match.score?.team1 || '').trim();
    const s2 = String(match.score?.team2 || '').trim();
    const hasScores = (s1 && s1 !== '-' && s2 && s2 !== '-') || hasInnings;
    if (hasScores) return 'finished';
    return 'upcoming';
}

// Real-time football match minute calculator
const _liveMinuteState = {};

function getLiveMinute(match) {
    if (!match || !match.sport) return null;
    if (match.sport !== 'football') return null;

    const status = getMatchStatus(match);
    if (status !== 'live') return null;

    // Try ESPN displayClock first (e.g. "45'" or "2'")  
    if (match.displayClock) {
        const clock = String(match.displayClock).trim();
        const parsed = parseInt(clock);
        if (!isNaN(parsed) && parsed > 0) {
            const period = match.period || 1;
            const base = (period >= 3) ? 90 : (period >= 2) ? 45 : 0;
            const minute = base + parsed;
            _liveMinuteState[match.id] = { minute: minute, ts: Date.now(), period: period };
            return minute + "'";
        }
    }

    // Fallback: calculate from kickoff time
    if (match.kickoff) {
        const kickoff = new Date(match.kickoff);
        const now = new Date();
        const elapsedMs = now - kickoff;
        if (elapsedMs < 0) return null;
        let elapsedMin = Math.floor(elapsedMs / 60000);
        // Account for ~15 min halftime break after 45 min
        if (elapsedMin > 45) elapsedMin = Math.min(elapsedMin, 45) + Math.max(0, elapsedMin - 60);
        if (elapsedMin > 110) elapsedMin = 110;
        _liveMinuteState[match.id] = { minute: elapsedMin, ts: Date.now(), period: 1 };
        return elapsedMin + "'";
    }

    // Check cache for last known minute
    const cached = _liveMinuteState[match.id];
    if (cached) {
        const diff = Math.floor((Date.now() - cached.ts) / 60000);
        return (cached.minute + diff) + "'";
    }

    return null;
}

function startCountdown(matchId, date, time) {
    const matchDateTime = getMatchDateTime(date, time);

    // Clear existing interval for this match
    if (countdownIntervals[matchId]) {
        clearInterval(countdownIntervals[matchId]);
    }

    // Update immediately
    updateCountdownDisplay(matchId, matchDateTime);

    // Set interval for updates
    countdownIntervals[matchId] = setInterval(() => {
        updateCountdownDisplay(matchId, matchDateTime);
    }, 1000);
}

// Update countdown display
function updateCountdownDisplay(matchId, matchDateTime) {
    const remaining = calculateRemaining(matchDateTime);
    const countdownEl = document.querySelector(`[data-match-id="${matchId}"] .mc-countdown`);

    if (countdownEl) {
        if (remaining === null) {
            countdownEl.textContent = 'LIVE';
            countdownEl.classList.add('live');
            // Clear interval when match goes live to prevent memory leak
            stopCountdown(matchId);
        } else {
            countdownEl.textContent = formatCountdown(remaining);
            countdownEl.classList.remove('live');
        }
    } else {
        // Element not found, clear interval
        stopCountdown(matchId);
    }
}

// Stop all countdowns
function stopAllCountdowns() {
    Object.values(countdownIntervals).forEach(interval => {
        clearInterval(interval);
    });
    countdownIntervals = {};
}

// Stop countdown for a specific match
function stopCountdown(matchId) {
    if (countdownIntervals[matchId]) {
        clearInterval(countdownIntervals[matchId]);
        delete countdownIntervals[matchId];
    }
}
