// Admin API — login, verify, and session management using shared auth utility.

import { getAdminCredentials, signJwt, checkAuth, setCors, requireEnvVars } from './_lib/auth.js';

export default async function handler(req, res) {
    setCors(res, req, 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!requireEnvVars()) {
        return res.status(500).json({ error: 'Server configuration error. Contact administrator.' });
    }

    const action = req.query?.action || req.body?.action;

    if (action === 'login') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const { username, password } = req.body || {};
        const { ADMIN_USER, ADMIN_HASH } = getAdminCredentials();
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
        if (username !== ADMIN_USER) return res.status(401).json({ error: 'Invalid credentials' });

        let valid = false;
        try {
            const bcrypt = (await import('bcryptjs')).default;
            valid = await bcrypt.compare(password, ADMIN_HASH);
        } catch (e) {
            console.error('[admin] bcrypt compare error:', e.message);
            return res.status(500).json({ error: 'Auth system error' });
        }
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = signJwt({ user: username, iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 });
        return res.status(200).json({ success: true, token });
    }

    const user = checkAuth(req);
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized. Admin login required.' });
    }

    if (action === 'verify') {
        return res.status(200).json({ valid: true, user: user.user });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
