/**
 * Reset a user's password by email (SAFE).
 *
 * - Does NOT delete or reseed any data.
 * - Only updates passwordHash (and updatedAt) for a single User node.
 *
 * Usage from project root (PowerShell example):
 *   $env:TARGET_EMAIL="user@example.com"
 *   $env:NEW_PASSWORD="changeme123"
 *   node scripts/resetUserPasswordByEmail.js
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');
const bcrypt = require('bcryptjs');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

const TARGET_EMAIL_RAW = process.env.TARGET_EMAIL;
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'changeme123';

if (!TARGET_EMAIL_RAW) {
    console.error('[reset-user-password] Please set TARGET_EMAIL in the environment.');
    process.exit(1);
}

const TARGET_EMAIL = TARGET_EMAIL_RAW.trim().toLowerCase();

async function resetPassword() {
    console.log(`[reset-user-password] Connecting to Neo4j to reset password for ${TARGET_EMAIL}...`);
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

        const result = await session.run(
            `
            MATCH (u:User {email: $email})
            SET u.passwordHash = $passwordHash,
                u.updatedAt = datetime()
            RETURN u.email AS email
        `,
            {
                email: TARGET_EMAIL,
                passwordHash
            }
        );

        if (!result.records.length) {
            console.error('[reset-user-password] No user found with that email.');
            process.exitCode = 1;
            return;
        }

        console.log(
            `[reset-user-password] ✓ Password updated for ${TARGET_EMAIL} (new password: "${NEW_PASSWORD}" – change after login)`
        );
    } catch (err) {
        console.error('[reset-user-password] ✗ Failed to reset password:', err.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
    }
}

resetPassword().then(() => {
    console.log('[reset-user-password] Done.');
});


