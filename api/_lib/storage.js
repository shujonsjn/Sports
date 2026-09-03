// Shared persistent storage layer for Vercel serverless.
// Uses Vercel KV (Redis) when available, falls back to in-memory with documented limitations.

import { kv } from '@vercel/kv';

const KV_AVAILABLE = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// In-memory fallback (documented: does NOT persist across cold starts)
const memStore = new Map();

// --- Generic get/set ---

export async function storeGet(key) {
    if (KV_AVAILABLE) {
        try {
            return await kv.get(key);
        } catch (e) {
            console.error(`[storage] KV get failed for ${key}:`, e.message);
        }
    }
    return memStore.get(key) ?? null;
}

export async function storeSet(key, value, ttlSeconds) {
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
        }
    }
    memStore.set(key, value);
}

export async function storeDel(key) {
    if (KV_AVAILABLE) {
        try {
            await kv.del(key);
            return;
        } catch (e) {
            console.error(`[storage] KV del failed for ${key}:`, e.message);
        }
    }
    memStore.delete(key);
}

// --- Match overrides (admin edits) ---

const OVERRIDES_PREFIX = 'override:';
const CUSTOMS_PREFIX = 'custom:';
const RATE_LIMIT_PREFIX = 'ratelimit:';
const OTP_PREFIX = 'otp:';

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
    const customs = [];
    memStore.forEach((val, key) => {
        if (key.startsWith(CUSTOMS_PREFIX)) customs.push(val);
    });
    return customs;
}

export async function clearAllAdmin() {
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

// --- Match cache (per-date, server-side) ---

const MATCH_CACHE_PREFIX = 'matches:';
const MATCH_CACHE_TTL = 30; // 30 seconds for live data

export async function getCachedMatches(dateStr) {
    return storeGet(MATCH_CACHE_PREFIX + dateStr);
}

export async function setCachedMatches(dateStr, matches) {
    await storeSet(MATCH_CACHE_PREFIX + dateStr, matches, MATCH_CACHE_TTL);
}

// --- Status ---

export function storageStatus() {
    return {
        backend: KV_AVAILABLE ? 'vercel-kv' : 'in-memory (NOT persistent)',
        kvAvailable: KV_AVAILABLE,
        warning: KV_AVAILABLE ? null : 'Data will NOT persist across cold starts. Set KV_REST_API_URL and KV_REST_API_TOKEN env vars.'
    };
}
