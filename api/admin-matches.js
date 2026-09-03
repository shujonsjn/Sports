// Admin match overrides API — persistent storage via Vercel KV.
// Admin edits survive: page refresh, logout/login, deployment, cold start, different device.

import { checkAuth, setCors, errorResponse } from './_lib/auth.js';
import {
    getAllOverrides, setOverride, deleteOverride,
    getAllCustoms, setCustom, deleteCustom, clearAllAdmin,
    storageStatus, invalidateMatchCache, StorageError, getOverride, getCustom
} from './_lib/storage.js';

// Whitelist of fields that admin overrides may contain
const OVERRIDE_FIELDS = new Set([
    'team1', 'team2', 'score', 'status', 'league', 'venue', 'result', 'time', 'overs', 'date', 'sport', 'statusText'
]);

function validateOverrideData(data) {
    if (!data || typeof data !== 'object') return 'Data must be an object';
    const cleaned = {};
    for (const key of Object.keys(data)) {
        if (OVERRIDE_FIELDS.has(key)) {
            cleaned[key] = data[key];
        }
    }
    // Validate status if provided
    if (cleaned.status && !['upcoming', 'live', 'finished'].includes(cleaned.status)) {
        return 'Status must be upcoming, live, or finished';
    }
    // Validate date if provided
    if (cleaned.date && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned.date)) {
        return 'Date must be YYYY-MM-DD format';
    }
    // Validate score if provided
    if (cleaned.score) {
        if (typeof cleaned.score !== 'object') return 'Score must be an object';
        if (cleaned.score.team1 !== undefined && cleaned.score.team1 !== null && typeof cleaned.score.team1 !== 'string') {
            return 'Score team1 must be a string';
        }
        if (cleaned.score.team2 !== undefined && cleaned.score.team2 !== null && typeof cleaned.score.team2 !== 'string') {
            return 'Score team2 must be a string';
        }
    }
    return null; // valid
}

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
            const validationError = validateOverrideData(data);
            if (validationError) return errorResponse(res, 400, validationError);
            await setOverride(matchId, data);
            try { await invalidateMatchCache(data.date); } catch (e) { console.error('[admin-matches] cache invalidation failed:', e.message); }
            return res.status(200).json({ success: true });
        }

        if (action === 'delete-override') {
            const { matchId } = body;
            if (!matchId) return errorResponse(res, 400, 'matchId required');
            const existing = await getOverride(matchId);
            await deleteOverride(matchId);
            const dateToInvalidate = existing?.date || new Date().toISOString().slice(0, 10);
            try { await invalidateMatchCache(dateToInvalidate); } catch (e) { console.error('[admin-matches] cache invalidation failed:', e.message); }
            return res.status(200).json({ success: true });
        }

        if (action === 'get-customs') {
            const customs = await getAllCustoms();
            return res.status(200).json({ customs });
        }

        if (action === 'add-custom') {
            const { matchData } = body;
            if (!matchData) return errorResponse(res, 400, 'matchData required');
            const validationError = validateOverrideData(matchData);
            if (validationError) return errorResponse(res, 400, validationError);
            const id = matchData.id || 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
            matchData.id = id;
            await setCustom(id, matchData);
            try { await invalidateMatchCache(matchData.date); } catch (e) { console.error('[admin-matches] cache invalidation failed:', e.message); }
            return res.status(200).json({ success: true, id });
        }

        if (action === 'delete-custom') {
            const { matchId } = body;
            if (!matchId) return errorResponse(res, 400, 'matchId required');
            const existing = await getCustom(matchId);
            await deleteCustom(matchId);
            const dateToInvalidate = existing?.date || new Date().toISOString().slice(0, 10);
            try { await invalidateMatchCache(dateToInvalidate); } catch (e) { console.error('[admin-matches] cache invalidation failed:', e.message); }
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
        if (e instanceof StorageError) {
            return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
        }
        return errorResponse(res, 500, 'Internal server error');
    }
}
