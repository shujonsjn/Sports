import bcrypt from 'bcryptjs';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
const FALLBACK_PASS = 'admin123';

function generateToken(user) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ user, iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
    const data = `${header}.${payload}`;
    const sig = Buffer.from(data + JWT_SECRET).toString('base64url');
    return `${data}.${sig}`;
}

function verifyToken(token) {
    try {
        if (!token) return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const data = `${parts[0]}.${parts[1]}`;
        const expectedSig = Buffer.from(data + JWT_SECRET).toString('base64url');
        if (parts[2] !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (Date.now() > payload.exp) return null;
        return payload;
    } catch { return null; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, username, password, token } = req.body || {};

    if (action === 'verify') {
        const payload = verifyToken(token);
        if (!payload) return res.status(401).json({ valid: false });
        return res.json({ valid: true, user: payload.user });
    }

    if (action === 'login') {
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        if (username !== ADMIN_USER) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        let valid = false;
        if (ADMIN_HASH) {
            try {
                valid = await bcrypt.compare(password, ADMIN_HASH);
            } catch (e) {
                return res.status(500).json({ error: 'Auth system error' });
            }
        } else {
            valid = password === FALLBACK_PASS;
        }

        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(username);
        return res.json({ success: true, token });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
