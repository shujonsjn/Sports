// Centralized date/time utility for backend use.
// All timestamps stored in UTC, converted to Asia/Dhaka only for display.

const TIMEZONE = 'Asia/Dhaka';
const TZ_OFFSET_HOURS = 6; // Asia/Dhaka is UTC+6

// Get today's date string in YYYY-MM-DD (UTC, NOT browser timezone)
export function getTodayString() {
    return new Date().toISOString().slice(0, 10);
}

// Get yesterday's date string in YYYY-MM-DD (UTC)
export function getYesterdayString() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

// Get N-day offset from today in YYYY-MM-DD (UTC)
export function getDateOffset(days) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// Parse a provider timestamp to a Date object in UTC
export function parseProviderTimestamp(ts) {
    if (!ts) return null;
    if (typeof ts === 'number') return new Date(ts);
    return new Date(ts);
}

// Format a UTC date for display in Asia/Dhaka timezone
export function formatMatchTime(utcDate) {
    if (!utcDate) return '00:00';
    return utcDate.toLocaleTimeString('en-GB', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Format a UTC date for display in Asia/Dhaka timezone (full date)
export function formatMatchDate(utcDate) {
    if (!utcDate) return '';
    return utcDate.toLocaleDateString('en-GB', {
        timeZone: TIMEZONE,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Check if a match date (YYYY-MM-DD) is on a given target date
// Uses UTC comparison to avoid timezone issues
export function isMatchOnDate(matchDateStr, targetDateStr) {
    if (!matchDateStr || !targetDateStr) return false;
    return matchDateStr.slice(0, 10) === targetDateStr.slice(0, 10);
}

// Validate a date string format
export function isValidDateString(str) {
    return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str + 'T00:00:00Z'));
}

// Get the ESPN date format (YYYYMMDD) from YYYY-MM-DD
export function toESPNDate(dateStr) {
    return (dateStr || '').replace(/-/g, '');
}
