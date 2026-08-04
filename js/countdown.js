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

// Check match status based on time
function getMatchStatus(match) {
    const matchTime = getMatchDateTime(match.date, match.time);
    const now = new Date();

    if (match.status === 'live') {
        return 'live';
    }

    if (matchTime > now) {
        return 'upcoming';
    }

    // Match was 3 hours ago, consider it finished
    const threeHoursLater = new Date(matchTime.getTime() + (3 * 60 * 60 * 1000));
    if (now > threeHoursLater) {
        return 'finished';
    }

    return 'live';
}

// Start countdown for a match
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
    const countdownEl = document.querySelector(`[data-match-id="${matchId}"] .match-countdown`);

    if (countdownEl) {
        if (remaining === null) {
            countdownEl.textContent = 'LIVE';
            countdownEl.classList.add('live');
        } else {
            countdownEl.textContent = formatCountdown(remaining);
            countdownEl.classList.remove('live');
        }
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
