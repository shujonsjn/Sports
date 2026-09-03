// Shared CORS and response utilities.

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

export function setCors(res, req, methods = 'GET, POST, OPTIONS') {
    const origin = req.headers?.origin || '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (ALLOWED_ORIGINS.length === 0) {
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
