// OTP API — persistent storage via Vercel KV.
// OTPs survive across serverless cold starts when Vercel KV is configured.

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { setCors, errorResponse } from './_lib/auth.js';
import { getOtp, setOtp, deleteOtp, getRateLimit, setRateLimit, StorageError } from './_lib/storage.js';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60;

function generateOtp() {
    const bytes = crypto.randomBytes(3);
    const num = parseInt(bytes.toString('hex'), 16) % 900000 + 100000;
    return String(num);
}

export default async function handler(req, res) {
    setCors(res, req, 'POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed');

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL_ENV;

    try {
        // Rate limiting — fail closed in production
        try {
            const rl = await getRateLimit(ip);
            if (rl && rl.attempts >= RATE_LIMIT_MAX) {
                return errorResponse(res, 429, 'Too many requests. Please try again later.');
            }
        } catch (e) {
            if (e instanceof StorageError) {
                if (isProduction) {
                    console.error('[otp] Storage unavailable for rate limit check — failing closed:', e.message);
                    return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
                }
                console.error('[otp] Rate limit check failed (dev, non-fatal):', e.message);
            }
        }

    const { action, contact, otp } = req.body || {};

    if (action === 'generate') {
        if (!contact || typeof contact !== 'string' || contact.trim().length < 3) {
            return errorResponse(res, 400, 'Valid contact required');
        }

        const code = generateOtp();
        const hash = bcrypt.hashSync(code, 10);
        const normalizedContact = contact.trim().toLowerCase();

        try {
            await setOtp(normalizedContact, {
                hash,
                expires: Date.now() + OTP_EXPIRY_SECONDS * 1000,
                attempts: 0
            }, OTP_EXPIRY_SECONDS);
        } catch (e) {
            if (e instanceof StorageError) {
                if (isProduction) {
                    return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
                }
                console.error('[otp] OTP storage failed (dev):', e.message);
            } else {
                throw e;
            }
        }

        // Update rate limit
        try {
            const rl = await getRateLimit(ip);
            const now = Date.now();
            if (!rl || now - rl.windowStart > RATE_LIMIT_WINDOW_SECONDS * 1000) {
                await setRateLimit(ip, { windowStart: now, attempts: 1 }, RATE_LIMIT_WINDOW_SECONDS);
            } else {
                await setRateLimit(ip, { ...rl, attempts: rl.attempts + 1 }, RATE_LIMIT_WINDOW_SECONDS);
            }
        } catch (e) {
            if (e instanceof StorageError && isProduction) {
                return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
            }
            console.error('[otp] Rate limit update failed:', e.message);
        }

        return res.status(200).json({ success: true, message: 'OTP sent successfully' });
    }

    if (action === 'verify') {
        if (!contact || !otp || typeof otp !== 'string') {
            return errorResponse(res, 400, 'Contact and OTP required');
        }

        const normalizedContact = contact.trim().toLowerCase();
        let stored;
        try {
            stored = await getOtp(normalizedContact);
        } catch (e) {
            if (e instanceof StorageError) {
                if (isProduction) {
                    return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
                }
                console.error('[otp] OTP storage read failed (dev):', e.message);
                stored = null;
            } else {
                throw e;
            }
        }

        if (!stored) {
            return errorResponse(res, 400, 'OTP expired or not found. Please request a new one.');
        }

        if (Date.now() > stored.expires) {
            try { await deleteOtp(normalizedContact); } catch (e) { /* best effort */ }
            return errorResponse(res, 400, 'OTP expired. Please request a new one.');
        }

        stored.attempts++;
        if (stored.attempts > MAX_ATTEMPTS) {
            try { await deleteOtp(normalizedContact); } catch (e) { /* best effort */ }
            return errorResponse(res, 429, 'Too many failed attempts. Please request a new OTP.');
        }

        // Update attempt count
        try {
            await setOtp(normalizedContact, stored, OTP_EXPIRY_SECONDS);
        } catch (e) {
            if (e instanceof StorageError && isProduction) {
                return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
            }
        }

        let valid = false;
        try {
            valid = await bcrypt.compare(otp.trim(), stored.hash);
        } catch (e) {
            console.error('[otp] bcrypt compare failed:', e.message);
            return errorResponse(res, 500, 'Verification system error');
        }

        if (!valid) {
            return errorResponse(res, 400, `Invalid OTP. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.`);
        }

        // OTP verified — delete it (one-time use)
        try { await deleteOtp(normalizedContact); } catch (e) { /* best effort */ }
        return res.status(200).json({ success: true });
    }

    return errorResponse(res, 400, 'Invalid action');
    } catch (e) {
        console.error('[otp] Handler error:', e);
        if (e instanceof StorageError) {
            return errorResponse(res, 503, 'Storage service unavailable. Please try again later.');
        }
        return errorResponse(res, 500, 'Internal server error');
    }
}
