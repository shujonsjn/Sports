import bcrypt from 'bcryptjs';

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

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

function checkAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyToken(authHeader.slice(7));
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = checkAuth(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }

    const { action } = req.query || req.body || {};

    if (action === 'login') {
        const { username, password } = req.body || {};
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (username !== ADMIN_USER) return res.status(401).json({ error: 'Invalid credentials' });
        if (!ADMIN_HASH) return res.status(500).json({ error: 'Admin password not configured' });
        const valid = await bcrypt.compare(password, ADMIN_HASH);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ user: username, iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
        const data = `${header}.${payload}`;
        const sig = Buffer.from(data + JWT_SECRET).toString('base64url');
        const token = `${data}.${sig}`;

        return res.json({ success: true, token });
    }

    if (action === 'verify') {
        return res.json({ valid: true, user: user.user });
    }

    return res.status(400).json({ error: 'Invalid action. Use ?action=login for auth.' });
}
