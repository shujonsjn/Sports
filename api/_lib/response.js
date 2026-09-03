// Shared CORS and response utilities.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;

// CORS for public read-only endpoints.
// In production, still restricts to ALLOWED_ORIGINS when configured.
// Public endpoints (matches, news, stats) may use broader CORS only when necessary.
export function setCors(res, req, methods = 'GET, POST, OPTIONS') {
    const origin = req.headers?.origin || '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!IS_PRODUCTION) {
        // Dev-only: allow all origins for easier testing
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function jsonResponse(res, status, data) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json(data);
}

export function errorResponse(res, status, message) {
    return jsonResponse(res, status, { error: message });
}
