/**
 * CAPTCHA Service
 * Server-side verification of CAPTCHA tokens to block automated signups.
 */

const fetch = require('node-fetch');

let warnedMissingConfig = false;

async function verifyCaptcha(token, remoteIp) {
    const secret = process.env.CAPTCHA_SECRET;
    const verifyUrl = process.env.CAPTCHA_VERIFY_URL || 'https://hcaptcha.com/siteverify';

    if (!secret) {
        if (!warnedMissingConfig) {
            // eslint-disable-next-line no-console
            console.warn('[captcha] CAPTCHA_SECRET not set. CAPTCHA checks are currently disabled.');
            warnedMissingConfig = true;
        }
        // Do not block in development if CAPTCHA is not configured
        return true;
    }

    if (!token) {
        return false;
    }

    try {
        const params = new URLSearchParams();
        params.append('secret', secret);
        params.append('response', token);
        if (remoteIp) {
            params.append('remoteip', remoteIp);
        }

        const res = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!res.ok) {
            return false;
        }

        const data = await res.json();
        return !!data.success;
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[captcha] Verification failed:', err.message);
        // Fail closed on network errors to be safe
        return false;
    }
}

module.exports = {
    verifyCaptcha
};


