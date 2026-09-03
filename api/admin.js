import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_USER || !ADMIN_HASH || !JWT_SECRET) {
    console.error('FATAL: Missing required env vars: ADMIN_USER, ADMIN_PASSWORD_HASH, JWT_SECRET');
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

function signJwt(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${header}.${body}`;
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function verifyToken(token) {
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
    } catch { return null; }
}

function checkAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyToken(authHeader.slice(7));
}

function setCorsHeaders(res, req) {
    const origin = req.headers?.origin || '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (ALLOWED_ORIGINS.length === 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

export default async function handler(req, res) {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!ADMIN_USER || !ADMIN_HASH || !JWT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error. Contact administrator.' });
    }

    const action = req.query?.action || req.body?.action;

    if (action === 'login') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (username !== ADMIN_USER) return res.status(401).json({ error: 'Invalid credentials' });

        let valid = false;
        try {
            valid = await bcrypt.compare(password, ADMIN_HASH);
        } catch {
            return res.status(500).json({ error: 'Auth system error' });
        }
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = signJwt({ user: username, iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 });
        return res.json({ success: true, token });
    }

    const user = checkAuth(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }

    if (action === 'verify') {
        return res.json({ valid: true, user: user.user });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
