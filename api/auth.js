// Auth API — login and token verification using shared auth utility.

import { getAdminCredentials, getJwtSecret, signJwt, verifyToken, verifyPassword, setCors, requireEnvVars } from './_lib/auth.js';

export default async function handler(req, res) {
    setCors(res, req, 'POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!requireEnvVars()) {
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    const { action, username, password, token } = req.body || {};

    if (action === 'verify') {
        const payload = verifyToken(token);
        if (!payload) return res.status(401).json({ valid: false });
        return res.status(200).json({ valid: true, user: payload.user });
    }

    if (action === 'login') {
        const { ADMIN_USER, ADMIN_HASH } = getAdminCredentials();
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (username !== ADMIN_USER) return res.status(401).json({ error: 'Invalid credentials' });

        let valid = false;
        try {
            valid = await verifyPassword(password, ADMIN_HASH);
        } catch (e) {
            console.error('[auth] bcrypt compare error:', e.message);
            return res.status(500).json({ error: 'Auth system error' });
        }
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const jwt = signJwt({ user: username, iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 });
        return res.status(200).json({ success: true, token: jwt });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
