// Admin match overrides API — persistent storage via Vercel KV.
// Admin edits survive: page refresh, logout/login, deployment, cold start, different device.

import { checkAuth, setCors, errorResponse } from './_lib/auth.js';
import {
    getAllOverrides, setOverride, deleteOverride,
    getAllCustoms, setCustom, deleteCustom, clearAllAdmin,
    storageStatus
} from './_lib/storage.js';

export default async function handler(req, res) {
    setCors(res, req, 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = checkAuth(req);
    if (!user) return errorResponse(res, 401, 'Unauthorized');

    const body = req.method === 'GET' ? (req.query || {}) : (req.body || {});
    const { action } = body;

    try {
        if (action === 'get-overrides') {
            const overrides = await getAllOverrides();
            return res.status(200).json({ overrides });
        }

        if (action === 'set-override') {
            const { matchId, data } = body;
            if (!matchId || !data) return errorResponse(res, 400, 'matchId and data required');
            await setOverride(matchId, data);
            return res.status(200).json({ success: true });
        }

        if (action === 'delete-override') {
            const { matchId } = body;
            if (!matchId) return errorResponse(res, 400, 'matchId required');
            await deleteOverride(matchId);
            return res.status(200).json({ success: true });
        }

        if (action === 'get-customs') {
            const customs = await getAllCustoms();
            return res.status(200).json({ customs });
        }

        if (action === 'add-custom') {
            const { matchData } = body;
            if (!matchData) return errorResponse(res, 400, 'matchData required');
            const id = matchData.id || 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            matchData.id = id;
            await setCustom(id, matchData);
            return res.status(200).json({ success: true, id });
        }

        if (action === 'delete-custom') {
            const { matchId } = body;
            if (!matchId) return errorResponse(res, 400, 'matchId required');
            await deleteCustom(matchId);
            return res.status(200).json({ success: true });
        }

        if (action === 'clear-all') {
            await clearAllAdmin();
            return res.status(200).json({ success: true });
        }

        if (action === 'storage-status') {
            return res.status(200).json(storageStatus());
        }

        return errorResponse(res, 400, 'Invalid action');
    } catch (e) {
        console.error('[admin-matches] Error:', e);
        return errorResponse(res, 500, 'Internal server error');
    }
}
