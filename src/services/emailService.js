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
        <div style="background:#000000;color:#3bff3b;padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <h2 style="margin-top:0;margin-bottom:8px;font-size:18px;">Welcome to the Political Party engagement platform</h2>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">
                Please verify your email address by clicking the button below:
            </p>
            <p style="margin:0 0 12px;">
                <a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;border:1px solid #3bff3b;background:transparent;color:#3bff3b;text-decoration:none;font-size:14px;">
                    Verify email
                </a>
            </p>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.4;">
                If the button above doesn&apos;t work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 10px;font-size:11px;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#3bff3b;text-decoration:underline;">${verifyUrl}</a>
            </p>
            <p style="margin:0;font-size:12px;opacity:0.9;">
                If you did not request this, you can safely ignore this email.
            </p>
        </div>
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
    // Structured log for debugging SMTP sends
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'email.send.start',
            type: 'verification',
            to,
            host: process.env.SMTP_HOST,
            verifyUrl
        })
    );

    try {
        const info = await tx.sendMail({
            from,
            to,
            subject,
            text,
            html
        });
        // eslint-disable-next-line no-console
        console.log(
            JSON.stringify({
                event: 'email.send.success',
                type: 'verification',
                to,
                host: process.env.SMTP_HOST,
                messageId: info && info.messageId ? info.messageId : null,
                accepted: info && info.accepted ? info.accepted : [],
                rejected: info && info.rejected ? info.rejected : [],
                response: info && info.response ? info.response : null
            })
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
            JSON.stringify({
                event: 'email.send.error',
                type: 'verification',
                to,
                host: process.env.SMTP_HOST,
                message: err && err.message ? err.message : String(err),
                code: err && err.code ? err.code : null,
                response: err && err.response ? err.response : null
            })
        );
        throw err;
    }
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
        <div style="background:#000000;color:#3bff3b;padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <h2 style="margin-top:0;margin-bottom:8px;font-size:18px;">Reset your Political Party password</h2>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">
                You requested a password reset for your account. If this was you, click the button below to set a new password.
            </p>
            <p style="margin:0 0 12px;">
                <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;border:1px solid #3bff3b;background:transparent;color:#3bff3b;text-decoration:none;font-size:14px;">
                    Reset password
                </a>
            </p>
            <p style="margin:0 0 6px;font-size:12px;line-height:1.4;">
                If the button above doesn&apos;t work, copy and paste this link into your browser:
            </p>
            <p style="margin:0 0 10px;font-size:11px;word-break:break-all;">
                <a href="${resetUrl}" style="color:#3bff3b;text-decoration:underline;">${resetUrl}</a>
            </p>
            <p style="margin:0;font-size:12px;opacity:0.9;">
                If you did NOT request this, you can safely ignore this email.
            </p>
        </div>
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
    // Structured log for debugging SMTP sends
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'email.send.start',
            type: 'password_reset',
            to,
            host: process.env.SMTP_HOST
        })
    );

    try {
        const info = await tx.sendMail({
            from,
            to,
            subject,
            text,
            html
        });
        // eslint-disable-inline-line no-console
        console.log(
            JSON.stringify({
                event: 'email.send.success',
                type: 'password_reset',
                to,
                host: process.env.SMTP_HOST,
                messageId: info && info.messageId ? info.messageId : null,
                accepted: info && info.accepted ? info.accepted : [],
                rejected: info && info.rejected ? info.rejected : [],
                response: info && info.response ? info.response : null
            })
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
            JSON.stringify({
                event: 'email.send.error',
                type: 'password_reset',
                to,
                host: process.env.SMTP_HOST,
                message: err && err.message ? err.message : String(err),
                code: err && err.code ? err.code : null,
                response: err && err.response ? err.response : null
            })
        );
        throw err;
    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail
};


