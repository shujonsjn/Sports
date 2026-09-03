// ===== Centralized Date/Time Utilities =====
// All date comparisons use UTC. Display uses Asia/Dhaka.

const APP_TIMEZONE = 'Asia/Dhaka';

function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseProviderTimestamp(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
}

function getMatchDateInTimezone(date, time) {
    const dateStr = date || '';
    const timeStr = time || '00:00';
    if (!dateStr) return null;
    const dt = new Date(`${dateStr}T${timeStr}:00`);
    return isNaN(dt.getTime()) ? null : dt;
}

function formatMatchTime(dateStr, timeStr) {
    if (!timeStr || timeStr === '00:00') return 'TBA';
    return timeStr;
}

function isMatchOnDate(matchDate, targetDate) {
    return matchDate === targetDate;
}

function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function getYesterdayString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getDateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
