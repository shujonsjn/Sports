// Admin match overrides persistence API
// NOTE: Uses in-memory Map. For production, replace with Vercel KV/Postgres.
// On Vercel serverless, this resets between cold starts. Documented limitation.

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;

// In-memory store — survives within same serverless instance
let matchOverrides = new Map();
let customMatches = new Map();

function verifyToken(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    try {
        const token = auth.slice(7);
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!JWT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { action } = req.query || req.body || {};

    if (action === 'get-overrides') {
        const overrides = {};
        matchOverrides.forEach((v, k) => { overrides[k] = v; });
        return res.json({ overrides });
    }

    if (action === 'set-override') {
        const { matchId, data } = req.body || {};
        if (!matchId || !data) return res.status(400).json({ error: 'matchId and data required' });
        matchOverrides.set(matchId, { ...data, updatedAt: Date.now() });
        return res.json({ success: true });
    }

    if (action === 'delete-override') {
        const { matchId } = req.body || {};
        if (!matchId) return res.status(400).json({ error: 'matchId required' });
        matchOverrides.set(matchId, { _deleted: true, updatedAt: Date.now() });
        return res.json({ success: true });
    }

    if (action === 'get-customs') {
        const customs = [];
        customMatches.forEach((v) => { customs.push(v); });
        return res.json({ customs });
    }

    if (action === 'add-custom') {
        const { matchData } = req.body || {};
        if (!matchData) return res.status(400).json({ error: 'matchData required' });
        const id = matchData.id || 'admin_' + Date.now();
        matchData.id = id;
        matchData.createdAt = Date.now();
        customMatches.set(id, matchData);
        return res.json({ success: true, id });
    }

    if (action === 'delete-custom') {
        const { matchId } = req.body || {};
        if (!matchId) return res.status(400).json({ error: 'matchId required' });
        customMatches.delete(matchId);
        return res.json({ success: true });
    }

    if (action === 'clear-all') {
        matchOverrides.clear();
        customMatches.clear();
        return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
