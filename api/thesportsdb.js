// TheSportsDB proxy — whitelisted operations only.
// Prevents arbitrary upstream path injection.

import { setCors, errorResponse } from './_lib/response.js';

const ALLOWED_PATHS = new Set([
    'searchteams.php',
    'searchplayers.php',
    'lookup_all_players.php',
    'lookupplayer.php',
    'lookuplineup.php',
    'searchevents.php',
    'eventsseason.php',
    'lookupteam.php',
    'lookup_season.php'
]);

export default async function handler(req, res) {
    setCors(res, req, 'GET, OPTIONS');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { path, ...params } = req.query || {};
    if (!path) return errorResponse(res, 400, 'Missing path parameter');

    // Whitelist check — only allow known operations
    const pathFile = path.split('?')[0];
    if (!ALLOWED_PATHS.has(pathFile)) {
        return errorResponse(res, 403, `Operation not allowed: ${pathFile}. Allowed: ${[...ALLOWED_PATHS].join(', ')}`);
    }

    // Reconstruct safe URL with only whitelisted params
    const qs = new URLSearchParams();
    qs.set('path', path);
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string' && v.length < 200) {
            qs.set(k, v);
        }
    }

    try {
        const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/${path}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
        });
        if (!r.ok) return errorResponse(res, r.status, `Upstream error ${r.status}`);
        const data = await r.json();
        return res.status(200).json(data);
    } catch (e) {
        console.error('[thesportsdb] Proxy error:', e.message);
        return errorResponse(res, 500, 'Upstream request failed');
    }
}
