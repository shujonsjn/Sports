// Shared persistent storage layer for Vercel serverless.
// Production: Vercel KV REQUIRED. Falls back to in-memory ONLY for local development.
// If KV env vars are missing in production, all write operations throw configuration errors.

import { kv } from '@vercel/kv';

const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_AVAILABLE = !!(KV_REST_API_URL && KV_REST_API_TOKEN);

if (IS_PRODUCTION && !KV_AVAILABLE) {
    console.error('[storage] FATAL: Vercel KV not configured in production. Set KV_REST_API_URL and KV_REST_API_TOKEN.');
}

// In-memory fallback — LOCAL DEVELOPMENT ONLY. Never use in production.
const memStore = new Map();

function requireKV(operation) {
    if (IS_PRODUCTION && !KV_AVAILABLE) {
        throw new Error(`[storage] KV required in production for "${operation}". Configure KV_REST_API_URL and KV_REST_API_TOKEN.`);
    }
}

// --- Generic get/set ---

export async function storeGet(key) {
    if (KV_AVAILABLE) {
        try {
            return await kv.get(key);
        } catch (e) {
            console.error(`[storage] KV get failed for ${key}:`, e.message);
            return null;
        }
    }
    if (IS_PRODUCTION) {
        console.error(`[storage] KV unavailable in production for get: ${key}`);
        return null;
    }
    return memStore.get(key) ?? null;
}

export async function storeSet(key, value, ttlSeconds) {
    requireKV(`set(${key})`);
    if (KV_AVAILABLE) {
        try {
            if (ttlSeconds) {
                await kv.set(key, value, { ex: ttlSeconds });
            } else {
                await kv.set(key, value);
            }
            return;
        } catch (e) {
            console.error(`[storage] KV set failed for ${key}:`, e.message);
            return;
        }
    }
    memStore.set(key, value);
}

export async function storeDel(key) {
    requireKV(`del(${key})`);
    if (KV_AVAILABLE) {
        try {
            await kv.del(key);
            return;
        } catch (e) {
            console.error(`[storage] KV del failed for ${key}:`, e.message);
            return;
        }
    }
    memStore.delete(key);
}

// --- Match overrides (admin edits) ---

const OVERRIDES_PREFIX = 'override:';
const CUSTOMS_PREFIX = 'custom:';
const RATE_LIMIT_PREFIX = 'ratelimit:';
const OTP_PREFIX = 'otp:';
const MATCH_PREFIX = 'match:';
const MATCH_DATE_PREFIX = 'matchdate:';

export async function getOverride(matchId) {
    return storeGet(OVERRIDES_PREFIX + matchId);
}

export async function setOverride(matchId, data) {
    await storeSet(OVERRIDES_PREFIX + matchId, { ...data, updatedAt: Date.now() });
}

export async function deleteOverride(matchId) {
    await setOverride(matchId, { _deleted: true, updatedAt: Date.now() });
}

export async function getAllOverrides() {
    if (KV_AVAILABLE) {
        try {
            const keys = [];
            let cursor = 0;
            do {
                const result = await kv.scan(cursor, { match: OVERRIDES_PREFIX + '*', count: 100 });
                cursor = result[0];
                keys.push(...result[1]);
            } while (cursor !== 0);

            const overrides = {};
            for (const key of keys) {
                const val = await kv.get(key);
                if (val) {
                    overrides[key.slice(OVERRIDES_PREFIX.length)] = val;
                }
            }
            return overrides;
        } catch (e) {
            console.error('[storage] getAllOverrides scan failed:', e.message);
            return {};
        }
    }
    if (IS_PRODUCTION) return {};
    const overrides = {};
    memStore.forEach((val, key) => {
        if (key.startsWith(OVERRIDES_PREFIX)) {
            overrides[key.slice(OVERRIDES_PREFIX.length)] = val;
        }
    });
    return overrides;
}

export async function getCustom(customId) {
    return storeGet(CUSTOMS_PREFIX + customId);
}

export async function setCustom(customId, data) {
    await storeSet(CUSTOMS_PREFIX + customId, { ...data, createdAt: Date.now() });
}

export async function deleteCustom(customId) {
    await storeDel(CUSTOMS_PREFIX + customId);
}

export async function getAllCustoms() {
    if (KV_AVAILABLE) {
        try {
            const keys = [];
            let cursor = 0;
            do {
                const result = await kv.scan(cursor, { match: CUSTOMS_PREFIX + '*', count: 100 });
                cursor = result[0];
                keys.push(...result[1]);
            } while (cursor !== 0);

            const customs = [];
            for (const key of keys) {
                const val = await kv.get(key);
                if (val) customs.push(val);
            }
            return customs;
        } catch (e) {
            console.error('[storage] getAllCustoms scan failed:', e.message);
            return [];
        }
    }
    if (IS_PRODUCTION) return [];
    const customs = [];
    memStore.forEach((val, key) => {
        if (key.startsWith(CUSTOMS_PREFIX)) customs.push(val);
    });
    return customs;
}

export async function clearAllAdmin() {
    requireKV('clearAllAdmin');
    if (KV_AVAILABLE) {
        try {
            let cursor = 0;
            do {
                const result = await kv.scan(cursor, { match: OVERRIDES_PREFIX + '*', count: 100 });
                cursor = result[0];
                for (const key of result[1]) await kv.del(key);
            } while (cursor !== 0);
            cursor = 0;
            do {
                const result = await kv.scan(cursor, { match: CUSTOMS_PREFIX + '*', count: 100 });
                cursor = result[0];
                for (const key of result[1]) await kv.del(key);
            } while (cursor !== 0);
        } catch (e) {
            console.error('[storage] clearAllAdmin scan failed:', e.message);
        }
    } else {
        const keysToDelete = [];
        memStore.forEach((val, key) => {
            if (key.startsWith(OVERRIDES_PREFIX) || key.startsWith(CUSTOMS_PREFIX)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(k => memStore.delete(k));
    }
}

// --- OTP ---

export async function getOtp(contact) {
    return storeGet(OTP_PREFIX + contact);
}

export async function setOtp(contact, data, ttlSeconds) {
    await storeSet(OTP_PREFIX + contact, data, ttlSeconds || 300);
}

export async function deleteOtp(contact) {
    await storeDel(OTP_PREFIX + contact);
}

// --- Rate limiting ---

export async function getRateLimit(ip) {
    return storeGet(RATE_LIMIT_PREFIX + ip);
}

export async function setRateLimit(ip, data, ttlSeconds) {
    await storeSet(RATE_LIMIT_PREFIX + ip, data, ttlSeconds || 60);
}

// --- Persistent normalized match storage ---

// Each match is stored as: match:{source}_{externalId}
// Date index: matchdate:{date} → Set of match IDs for that date

export async function persistMatch(match) {
    const id = match.id || `${match.source}_${match.externalId}`;
    if (!id) return;
    const record = {
        ...match,
        id,
        source: match.source,
        externalId: match.externalId || null,
        sport: match.sport,
        league: match.league || '',
        team1: { name: match.team1?.name, short: match.team1?.short, logo: match.team1?.logo, flag: match.team1?.flag },
        team2: { name: match.team2?.name, short: match.team2?.short, logo: match.team2?.logo, flag: match.team2?.flag },
        date: match.date,
        time: match.time || '00:00',
        startTimeUtc: match.startTimeUtc || null,
        status: match.status || 'upcoming',
        statusText: match.statusText || '',
        score: { team1: match.score?.team1 ?? null, team2: match.score?.team2 ?? null },
        overs: match.overs || null,
        innings: match.innings || null,
        venue: match.venue || '',
        metadata: match.metadata || null,
        updatedAt: Date.now()
    };
    await storeSet(MATCH_PREFIX + id, record);
    // Update date index
    if (match.date) {
        const dateKey = MATCH_DATE_PREFIX + match.date;
        let ids = await storeGet(dateKey);
        if (!ids || !Array.isArray(ids)) ids = [];
        if (!ids.includes(id)) {
            ids.push(id);
            await storeSet(dateKey, ids, 86400 * 7); // 7-day TTL for date index
        }
    }
}

export async function getPersistedMatch(matchId) {
    return storeGet(MATCH_PREFIX + matchId);
}

export async function getPersistedMatchesByDate(dateStr) {
    const ids = await storeGet(MATCH_DATE_PREFIX + dateStr);
    if (!ids || !Array.isArray(ids)) return [];
    const matches = [];
    for (const id of ids) {
        const m = await storeGet(MATCH_PREFIX + id);
        if (m) matches.push(m);
    }
    return matches;
}

export async function invalidateMatchCache(dateStr) {
    // Invalidate the server-side match cache for a specific date
    const cacheKeys = [
        `matches:${dateStr}_all`,
        `matches:${dateStr}_football`,
        `matches:${dateStr}_cricket`,
        `matches:${dateStr}_basketball`,
        `matches:${dateStr}_nfl`,
        `matches:${dateStr}_tennis`,
        `matches:${dateStr}_mma`,
        `matches:${dateStr}_ufc`
    ];
    for (const key of cacheKeys) {
        await storeDel(key);
    }
}

// --- Match cache (per-date, server-side) ---

const MATCH_CACHE_TTL = 30; // 30 seconds for live data

export async function getCachedMatches(dateStr, sport) {
    return storeGet(`matches:${dateStr}_${sport || 'all'}`);
}

export async function setCachedMatches(dateStr, matches, sport) {
    await storeSet(`matches:${dateStr}_${sport || 'all'}`, matches, MATCH_CACHE_TTL);
}

// --- Status ---

export function storageStatus() {
    return {
        backend: KV_AVAILABLE ? 'vercel-kv' : (IS_PRODUCTION ? 'ERROR: KV NOT CONFIGURED' : 'in-memory (development only)'),
        kvAvailable: KV_AVAILABLE,
        isProduction: IS_PRODUCTION,
        warning: IS_PRODUCTION && !KV_AVAILABLE
            ? 'CRITICAL: Vercel KV not configured. Data will NOT persist. Set KV_REST_API_URL and KV_REST_API_TOKEN env vars.'
            : (!IS_PRODUCTION && !KV_AVAILABLE ? 'Using in-memory storage (development mode). KV not configured.' : null)
    };
}
