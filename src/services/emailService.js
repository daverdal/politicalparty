/**
 * Email Service
 * Handles sending transactional emails such as verification links.
 */

const nodemailer = require('nodemailer');

let transporter = null;
let transportChecked = false;

function getTransporter() {
    if (transportChecked) {
        return transporter;
    }

    transportChecked = true;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

    if (!SMTP_HOST || !SMTP_PORT) {
        // eslint-disable-next-line no-console
        console.warn('[email] SMTP not fully configured. Verification emails will be logged to the console.');
        transporter = null;
        return transporter;
    }

    transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === 'true',
        auth: SMTP_USER
            ? {
                  user: SMTP_USER,
                  pass: SMTP_PASS
              }
            : undefined
    });

    return transporter;
}

async function sendVerificationEmail({ to, token }) {
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const from = process.env.EMAIL_FROM || 'no-reply@political-party.local';

    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

    const subject = 'Verify your email for Political Party';
    const text = [
        'Welcome to the Political Party engagement platform.',
        '',
        'Please verify your email address by clicking the link below:',
        verifyUrl,
        '',
        'If you did not request this, you can safely ignore this email.'
    ].join('\n');

    const html = `
        <p>Welcome to the Political Party engagement platform.</p>
        <p>Please verify your email address by clicking the button below:</p>
        <p>
            <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#1f7a8c;color:#ffffff;text-decoration:none;border-radius:4px;">
                Verify Email
            </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p><code>${verifyUrl}</code></p>
        <p>If you did not request this, you can safely ignore this email.</p>
    `;

    const tx = getTransporter();

    if (!tx) {
        // Fallback for development: log the URL so it can be clicked manually
        // eslint-disable-next-line no-console
        console.log(`[email] Verification email for ${to}: ${verifyUrl}`);
        return;
    }

    // eslint-disable-next-line no-console
    console.log(`[email] Sending verification email via SMTP to ${to} using host ${process.env.SMTP_HOST}`);

    await tx.sendMail({
        from,
        to,
        subject,
        text,
        html
    });
}

async function sendPasswordResetEmail({ to, token }) {
    const appUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const from = process.env.EMAIL_FROM || 'no-reply@political-party.local';

    const resetUrl = `${appUrl}/api/auth/reset-password?token=${encodeURIComponent(token)}`;

    const subject = 'Reset your password for Political Party';
    const text = [
        'You requested a password reset for your Political Party account.',
        '',
        'If this was you, click the link below to set a new password:',
        resetUrl,
        '',
        'If you did NOT request this, you can safely ignore this email.'
    ].join('\n');

    const html = `
        <p>You requested a password reset for your Political Party account.</p>
        <p>If this was you, click the button below to set a new password:</p>
        <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#1f7a8c;color:#ffffff;text-decoration:none;border-radius:4px;">
                Reset Password
            </a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p><code>${resetUrl}</code></p>
        <p>If you did NOT request this, you can safely ignore this email.</p>
    `;

    const tx = getTransporter();

    // Always log the reset URL so it can be used even if email delivery is misconfigured
    // eslint-disable-next-line no-console
    console.log(`[email] Password reset email for ${to}: ${resetUrl}`);

    if (!tx) {
        // Fallback for development: only log the URL
        return;
    }

    // eslint-disable-next-line no-console
    console.log(`[email] Sending password reset email via SMTP to ${to} using host ${process.env.SMTP_HOST}`);

    await tx.sendMail({
        from,
        to,
        subject,
        text,
        html
    });
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};


