import bcrypt from 'bcryptjs';

const OTP_EXPIRY = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW = 60 * 1000;
const otpStore = new Map();
const rateLimit = new Map();

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

        // In production: send OTP via email/SMS provider here
        // For development: log to server only, never return in response
        console.log(`OTP for ${normalizedContact}: ${code}`);

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
