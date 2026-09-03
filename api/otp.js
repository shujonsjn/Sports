import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const OTP_EXPIRY = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 60 * 1000;

// NOTE: In-memory Map is lost between Vercel serverless invocations.
// OTP will NOT work in production without a shared store (Redis, KV, DB).
// This is a known limitation — requires external storage for multi-invocation persistence.
const otpStore = new Map();
const rateLimit = new Map();

function generateOtp() {
    const bytes = crypto.randomBytes(3);
    const num = parseInt(bytes.toString('hex'), 16) % 900000 + 100000;
    return String(num);
}

function hashOtp(otp) {
    return bcrypt.hashSync(otp, 10);
}

function verifyOtp(input, hash) {
    return bcrypt.compareSync(input, hash);
}

function checkRateLimit(ip) {
    const now = Date.now();
    const record = rateLimit.get(ip);
    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
        rateLimit.set(ip, { windowStart: now, attempts: 1 });
        return true;
    }
    record.attempts++;
    return record.attempts <= 5;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

function setCors(res, req) {
    const origin = req.headers?.origin || '';
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (ALLOWED_ORIGINS.length === 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
}

export default async function handler(req, res) {
    setCors(res, req);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { action, contact, otp } = req.body || {};

    if (action === 'generate') {
        if (!contact || typeof contact !== 'string' || contact.trim().length < 3) {
            return res.status(400).json({ error: 'Valid contact required' });
        }

        const code = generateOtp();
        const hash = hashOtp(code);
        const normalizedContact = contact.trim().toLowerCase();

        otpStore.set(normalizedContact, {
            hash,
            expires: Date.now() + OTP_EXPIRY,
            attempts: 0
        });

        // OTP sent — do NOT log or return plaintext in production
        // In production, integrate with SMS/email provider here
        return res.json({ success: true, message: 'OTP sent successfully' });
    }

    if (action === 'verify') {
        if (!contact || !otp || typeof otp !== 'string') {
            return res.status(400).json({ error: 'Contact and OTP required' });
        }

        const normalizedContact = contact.trim().toLowerCase();
        const stored = otpStore.get(normalizedContact);

        if (!stored) {
            return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
        }

        if (Date.now() > stored.expires) {
            otpStore.delete(normalizedContact);
            return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
        }

        stored.attempts++;
        if (stored.attempts > MAX_ATTEMPTS) {
            otpStore.delete(normalizedContact);
            return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
        }

        if (!verifyOtp(otp.trim(), stored.hash)) {
            return res.status(400).json({ error: `Invalid OTP. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.` });
        }

        otpStore.delete(normalizedContact);
        return res.json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
