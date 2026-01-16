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

    const subject = 'Confirm your email for Assembly of Manitoba Chiefs planning';
    const text = [
        'You recently created an account on the Assembly of Manitoba Chiefs planning platform.',
        '',
        'To confirm that this email address belongs to you, please open the link below:',
        verifyUrl,
        '',
        'If you did not create an account, you can safely ignore this email and no changes will be made.'
    ].join('\n');

    const html = `
        <div style="background:#f5f5f5;padding:24px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e0e0e0;padding:20px;">
                <h2 style="margin-top:0;margin-bottom:12px;font-size:18px;color:#111827;">
                    Confirm your email address
                </h2>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#374151;">
                    You recently created an account on the <strong>Assembly of Manitoba Chiefs planning platform</strong>.
                </p>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">
                    To finish setting up your account, please confirm that this email address belongs to you by clicking the button below.
                </p>
                <p style="margin:0 0 18px;">
                    <a href="${verifyUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;">
                        Confirm my email
                    </a>
                </p>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b7280;">
                    If the button above doesn&apos;t work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 14px;font-size:11px;word-break:break-all;color:#4b5563;">
                    <a href="${verifyUrl}" style="color:#2563eb;text-decoration:underline;">${verifyUrl}</a>
                </p>
                <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6b7280;">
                    If you did not create an account, you can safely ignore this email and no changes will be made.
                </p>
                <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">
                    Assembly of Manitoba Chiefs – Planning Platform
                </p>
            </div>
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

    const subject = 'Reset your password for Assembly of Manitoba Chiefs planning';
    const text = [
        'You requested a password reset for your Assembly of Manitoba Chiefs planning account.',
        '',
        'If this was you, click the link below to set a new password:',
        resetUrl,
        '',
        'If you did NOT request this, you can safely ignore this email and your password will stay the same.'
    ].join('\n');

    const html = `
        <div style="background:#f5f5f5;padding:24px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;border:1px solid #e0e0e0;padding:20px;">
                <h2 style="margin-top:0;margin-bottom:12px;font-size:18px;color:#111827;">
                    Reset your password
                </h2>
                <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#374151;">
                    You requested a password reset for your <strong>Assembly of Manitoba Chiefs planning</strong> account.
                </p>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#374151;">
                    If this was you, click the button below to choose a new password.
                </p>
                <p style="margin:0 0 18px;">
                    <a href="${resetUrl}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;">
                        Reset password
                    </a>
                </p>
                <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b7280;">
                    If the button above doesn&apos;t work, copy and paste this link into your browser:
                </p>
                <p style="margin:0 0 14px;font-size:11px;word-break:break-all;color:#4b5563;">
                    <a href="${resetUrl}" style="color:#2563eb;text-decoration:underline;">${resetUrl}</a>
                </p>
                <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6b7280;">
                    If you did NOT request this, you can safely ignore this email and your password will remain unchanged.
                </p>
                <p style="margin:8px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">
                    Assembly of Manitoba Chiefs – Planning Platform
                </p>
            </div>
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


