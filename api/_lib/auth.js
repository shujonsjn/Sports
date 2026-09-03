// Shared JWT auth utility for all API endpoints.
// Single source of truth for sign/verify — eliminates duplication.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;

export function getJwtSecret() {
    return JWT_SECRET;
}

export function getAdminCredentials() {
    return { ADMIN_USER, ADMIN_HASH };
}

export function signJwt(payload) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${header}.${body}`;
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

export function verifyToken(token) {
    try {
        if (!token || !JWT_SECRET) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const data = `${parts[0]}.${parts[1]}`;
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
        if (!crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expectedSig))) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (!payload.exp || Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

export function checkAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyToken(authHeader.slice(7));
}

export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// CORS for protected endpoints — canonical implementation.
// Requires ALLOWED_ORIGINS in production. Dev mode allows *.
export function setCors(res, req, methods = 'GET, POST, OPTIONS') {
    const origin = req.headers?.origin || '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    } else if (ALLOWED_ORIGINS.length === 0 && !IS_PRODUCTION) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// JSON response helpers — re-exported here so protected endpoints can import from one place
export function jsonResponse(res, status, data) {
    res.setHeader('Content-Type', 'application/json');
    return res.status(status).json(data);
}

export function errorResponse(res, status, message) {
    return jsonResponse(res, status, { error: message });
}

export function requireEnvVars() {
    if (!JWT_SECRET || !ADMIN_USER || !ADMIN_HASH) {
        return false;
    }
    return true;
}

export { ALLOWED_ORIGINS };
