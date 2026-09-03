// Shared JWT auth utility for all API endpoints.
// Single source of truth for sign/verify — eliminates duplication.

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

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

// CORS for protected endpoints — requires ALLOWED_ORIGINS in production.
// Never falls back to * for protected APIs.
export function setCorsHeaders(res, req) {
    const origin = req.headers?.origin || '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (ALLOWED_ORIGINS.length === 0 && !IS_PRODUCTION) {
        // Dev-only: allow all origins
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    // Production with no ALLOWED_ORIGINS → no CORS header set (rejects cross-origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;

export function requireEnvVars() {
    if (!JWT_SECRET || !ADMIN_USER || !ADMIN_HASH) {
        return false;
    }
    return true;
}

export { ALLOWED_ORIGINS };
