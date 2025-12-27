/**
 * Auth Routes
 * Email+password signup, login, logout, current user and email verification.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const emailService = require('../services/emailService');
const captchaService = require('../services/captchaService');
const { authenticate, requireVerifiedUser } = require('../middleware/auth');

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

        if (!user.verifiedAt) {
            return res.status(403).json({
                error:
                    'Please verify your email address before signing in. Check your inbox for the verification link or request a new one.'
            });
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
        const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';

        if (!user) {
            return res
                .status(400)
                .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Verification error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b; /* VT100 green */
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 {
            margin: 0 0 8px;
            font-size: 1.4rem;
        }
        p {
            margin: 0 0 10px;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .btn {
            display: inline-block;
            margin-top: 10px;
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid #3bff3b;
            background: transparent;
            color: #3bff3b;
            text-decoration: none;
            font-size: 0.9rem;
        }
        .btn:active {
            transform: translateY(1px);
        }
        .cursor {
            display: inline-block;
            width: 8px;
            height: 1.1em;
            background: #3bff3b;
            margin-left: 4px;
            animation: blink 1s steps(1, start) infinite;
            vertical-align: bottom;
        }
        @keyframes blink {
            50% { opacity: 0; }
        }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Verification error</h1>
        <p>This verification link is invalid or has expired.</p>
        <p>If you already verified your email, you can safely close this window and return to the app.</p>
        <p>If not, try requesting a new verification link from the sign-in screen.</p>
        <a class="btn" href="${appUrl}">Return to Political Party</a>
        <div class="cursor"></div>
    </main>
</body>
</html>`);
        }

        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Email verified – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b; /* VT100 green */
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 {
            margin: 0 0 8px;
            font-size: 1.4rem;
        }
        p {
            margin: 0 0 10px;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .btn {
            display: inline-block;
            margin-top: 10px;
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid #3bff3b;
            background: transparent;
            color: #3bff3b;
            text-decoration: none;
            font-size: 0.9rem;
        }
        .btn:active {
            transform: translateY(1px);
        }
        .cursor {
            display: inline-block;
            width: 8px;
            height: 1.1em;
            background: #3bff3b;
            margin-left: 4px;
            animation: blink 1s steps(1, start) infinite;
            vertical-align: bottom;
        }
        @keyframes blink {
            50% { opacity: 0; }
        }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Email verified</h1>
        <p>Your email has been verified successfully.</p>
        <p>You can now close this window and return to the Political Party app.</p>
        <a class="btn" href="${appUrl}">Return to Political Party</a>
        <div class="cursor"></div>
    </main>
</body>
</html>`);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] Verify email error:', err);
        return res
            .status(500)
            .send(
                '<h1>Verification error</h1><p>Something went wrong. Please try again later or sign in to request a new link.</p>'
            );
    }
});

// POST /api/auth/request-password-reset
router.post('/request-password-reset', loginLimiter, async (req, res) => {
    const { email } = req.body || {};

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    try {
        const user = await authService.findUserByEmail(normalizedEmail);
        if (!user) {
            // Do not reveal whether the email exists – always respond with success
            // eslint-disable-next-line no-console
            console.log(`[auth] request-password-reset: no user found for email ${normalizedEmail}`);
            return res.json({
                success: true,
                message: 'If that email is registered, a password reset link has been sent.'
            });
        }

        const token = await authService.createPasswordResetToken(normalizedEmail);
        if (!token) {
            // eslint-disable-next-line no-console
            console.error(`[auth] request-password-reset: failed to create password reset token for ${normalizedEmail}`);
            return res.status(500).json({ error: 'Unable to start password reset right now. Please try again later.' });
        }

        await emailService.sendPasswordResetEmail({ to: normalizedEmail, token });

        return res.json({
            success: true,
            message: 'If that email is registered, a password reset link has been sent.'
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] request-password-reset error:', err);
        return res.status(500).json({ error: 'Unable to process password reset right now. Please try again later.' });
    }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', signupLimiter, async (req, res) => {
    const { email } = req.body || {};

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const normalizedEmail = String(email).trim().toLowerCase();

        // Always respond with success to avoid leaking which emails exist or are verified
        try {
            const result = await authService.createOrRefreshEmailVerificationToken(normalizedEmail);
            if (result && result.user && result.token) {
                await emailService.sendVerificationEmail({
                    to: normalizedEmail,
                    token: result.token
                });
            }
        } catch (innerErr) {
            // Log but do not leak details to the client
            // eslint-disable-next-line no-console
            console.error('[auth] resend-verification error:', innerErr);
        }

        return res.json({
            success: true,
            message: 'If that email is registered and not yet verified, a verification link has been sent.'
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] resend-verification outer error:', err);
        return res.status(500).json({ error: 'Unable to resend verification right now.' });
    }
});

// GET /api/auth/reset-password?token=...
router.get('/reset-password', (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res
            .status(400)
            .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password reset error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b; /* VT100 green */
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 {
            margin: 0 0 8px;
            font-size: 1.4rem;
        }
        p {
            margin: 0 0 10px;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .cursor {
            display: inline-block;
            width: 8px;
            height: 1.1em;
            background: #3bff3b;
            margin-left: 4px;
            animation: blink 1s steps(1, start) infinite;
            vertical-align: bottom;
        }
        @keyframes blink {
            50% { opacity: 0; }
        }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password reset error</h1>
        <p>Missing or invalid reset token.</p>
        <div class="cursor"></div>
    </main>
</body>
</html>`);
    }

    const safeToken = String(token).replace(/"/g, '&quot;');

    // VT100-styled HTML form to set a new password
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset your password – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b; /* VT100 green */
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 {
            margin: 0 0 12px;
            font-size: 1.4rem;
        }
        label {
            font-size: 0.9rem;
        }
        input[type="password"] {
            width: 100%;
            margin-top: 4px;
            padding: 8px 10px;
            border-radius: 6px;
            border: 1px solid #3bff3b;
            background: #000000;
            color: #3bff3b;
            box-sizing: border-box;
        }
        .field {
            margin-bottom: 10px;
        }
        .btn {
            display: inline-block;
            margin-top: 10px;
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid #3bff3b;
            background: transparent;
            color: #3bff3b;
            text-decoration: none;
            font-size: 0.9rem;
            cursor: pointer;
        }
        .btn:active {
            transform: translateY(1px);
        }
        .cursor {
            display: inline-block;
            width: 8px;
            height: 1.1em;
            background: #3bff3b;
            margin-left: 4px;
            animation: blink 1s steps(1, start) infinite;
            vertical-align: bottom;
        }
        @keyframes blink {
            50% { opacity: 0; }
        }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Reset your password</h1>
        <form method="POST" action="/api/auth/reset-password">
            <input type="hidden" name="token" value="${safeToken}" />
            <div class="field">
                <label>New password<br/>
                    <input type="password" name="password" minlength="8" required />
                </label>
            </div>
            <div class="field">
                <label>Confirm password<br/>
                    <input type="password" name="confirmPassword" minlength="8" required />
                </label>
            </div>
            <button class="btn" type="submit">Set new password</button>
        </form>
        <div class="cursor"></div>
    </main>
</body>
</html>`);
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    const { token, password, confirmPassword } = req.body || {};

    if (!token || !password) {
        return res
            .status(400)
            .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password reset error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.5; }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password reset error</h1>
        <p>Missing token or password.</p>
    </main>
</body>
</html>`);
    }

    if (password !== confirmPassword) {
        return res
            .status(400)
            .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password reset error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.5; }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password reset error</h1>
        <p>Passwords do not match.</p>
    </main>
</body>
</html>`);
    }

    if (typeof password !== 'string' || password.length < 8) {
        return res
            .status(400)
            .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password reset error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.5; }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password reset error</h1>
        <p>Password must be at least 8 characters long.</p>
    </main>
</body>
</html>`);
    }

    try {
        const user = await authService.resetPasswordByToken(token, password);
        if (!user) {
            return res
                .status(400)
                .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password reset error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.5; }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password reset error</h1>
        <p>This reset link is invalid or has expired.</p>
    </main>
</body>
</html>`);
        }

        const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password updated – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.5; }
        .btn {
            display: inline-block;
            margin-top: 10px;
            padding: 10px 16px;
            border-radius: 999px;
            border: 1px solid #3bff3b;
            background: transparent;
            color: #3bff3b;
            text-decoration: none;
            font-size: 0.9rem;
        }
        .btn:active { transform: translateY(1px); }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password updated</h1>
        <p>Your password has been changed successfully.</p>
        <a class="btn" href="${appUrl}">Return to sign in</a>
    </main>
</body>
</html>`);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] reset-password error:', err);
        return res
            .status(500)
            .send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Password reset error – Political Party</title>
    <style>
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: #3bff3b;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .shell {
            max-width: 480px;
            margin: 16px;
            padding: 20px 24px;
            border-radius: 12px;
            border: 1px solid #3bff3b;
            background: radial-gradient(circle at top, rgba(0, 255, 0, 0.08), rgba(0, 0, 0, 0.96));
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.9);
        }
        h1 { margin: 0 0 8px; font-size: 1.4rem; }
        p { margin: 0 0 10px; font-size: 0.95rem; line-height: 1.5; }
    </style>
</head>
<body>
    <main class="shell">
        <h1>Password reset error</h1>
        <p>Something went wrong. Please try again later.</p>
    </main>
</body>
</html>`);
    }
});

// POST /api/auth/change-password (logged-in users)
router.post('/change-password', authenticate, requireVerifiedUser, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Current password, new password, and confirmation are required.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    try {
        const user = await authService.findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const valid = await authService.validatePassword(user, currentPassword);
        if (!valid) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        const updated = await authService.changePassword(req.user.id, newPassword);
        if (!updated) {
            return res.status(500).json({ error: 'Unable to update password right now.' });
        }

        return res.json({ success: true, message: 'Password updated successfully.' });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[auth] change-password error:', err);
        return res.status(500).json({ error: 'Unable to change password right now. Please try again later.' });
    }
});

module.exports = router;


