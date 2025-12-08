/**
 * Auth Routes
 * Email+password signup, login, logout, current user and email verification.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const captchaService = require('../services/captchaService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

// Rate limiting
const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-up attempts from this IP, please try again later.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts from this IP, please try again later.' }
});

function setAuthCookie(res, token) {
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    res.cookie('token', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: maxAgeMs
    });
}

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req, res) => {
    const { email, password, name, captchaToken } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    if (typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const captchaOk = await captchaService.verifyCaptcha(captchaToken, req.ip);
    if (!captchaOk) {
        return res.status(400).json({ error: 'CAPTCHA verification failed. Please try again.' });
    }

    try {
        const existing = await authService.findUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'An account with that email already exists.' });
        }

        const user = await authService.createUserWithEmail({ email, password, name });

        try {
            if (user.emailVerificationToken) {
                await emailService.sendVerificationEmail({
                    to: user.email,
                    token: user.emailVerificationToken
                });
            }
        } catch (err) {
            // Log but do not expose internal error
            // eslint-disable-next-line no-console
            console.error('[auth] Failed to send verification email:', err.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Account created. Please check your email to verify your address before signing in.'
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] Signup error:', err);
        return res.status(500).json({ error: 'Unable to sign up right now. Please try again later.' });
    }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        const user = await authService.findUserByEmail(email);
        const valid = await authService.validatePassword(user, password);

        if (!user || !valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = authService.createJwtForUser(user);
        setAuthCookie(res, token);

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                verified: !!user.verifiedAt
            }
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] Login error:', err);
        return res.status(500).json({ error: 'Unable to log in right now. Please try again later.' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax'
    });
    return res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await authService.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            verified: !!user.verifiedAt
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] /me error:', err);
        return res.status(500).json({ error: 'Unable to load user profile.' });
    }
});

// GET /api/auth/verify-email?token=...
router.get('/verify-email', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send('<h1>Verification error</h1><p>Missing verification token.</p>');
    }

    try {
        const user = await authService.verifyEmailByToken(token);
        if (!user) {
            return res
                .status(400)
                .send('<h1>Verification error</h1><p>This verification link is invalid or has expired.</p>');
        }

        const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        return res.send(
            `<h1>Email verified</h1><p>Your email has been verified. You can now close this window and return to <a href="${appUrl}">${appUrl}</a>.</p>`
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] Verify email error:', err);
        return res.status(500).send('<h1>Verification error</h1><p>Something went wrong. Please try again later.</p>');
    }
});

module.exports = router;


