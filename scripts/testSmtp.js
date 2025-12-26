/**
 * Simple SMTP connectivity test using current environment variables.
 *
 * This does NOT send a real email by default; it just asks the SMTP server
 * if the credentials and TLS settings are acceptable (nodemailer.verify()).
 *
 * Usage (from project root):
 *   node scripts/testSmtp.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_SECURE } = process.env;

    if (!SMTP_HOST || !SMTP_PORT) {
        console.log('[smtp-test] SMTP_HOST or SMTP_PORT not set. Check your environment variables.');
        return;
    }

    console.log('[smtp-test] Testing SMTP configuration:');
    console.log(`  host   = ${SMTP_HOST}`);
    console.log(`  port   = ${SMTP_PORT}`);
    console.log(`  secure = ${SMTP_SECURE}`);
    console.log(`  user   = ${SMTP_USER || '(none)'}`);

    const transport = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === 'true',
        auth: SMTP_USER
            ? {
                  user: SMTP_USER,
                  pass: process.env.SMTP_PASS
              }
            : undefined
    });

    try {
        await transport.verify();
        console.log('[smtp-test] ✅ SMTP connection and credentials look OK.');
    } catch (err) {
        console.error('[smtp-test] ❌ SMTP verification failed:');
        console.error('  Message:', err.message);
        if (err.code) {
            console.error('  Code   :', err.code);
        }
        if (err.response) {
            console.error('  Response:', err.response);
        }
    } finally {
        transport.close();
    }
}

main();


