/**
 * Inspect a user's verification fields by email (production-safe read-only helper)
 *
 * Usage from project root (PowerShell example):
 *   $env:TARGET_EMAIL="user@example.com"
 *   node scripts/inspectUserByEmail.js
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

const TARGET_EMAIL_RAW = process.env.TARGET_EMAIL;

if (!TARGET_EMAIL_RAW) {
    console.error('[inspect-user-by-email] Please set TARGET_EMAIL in the environment.');
    process.exit(1);
}

const TARGET_EMAIL = TARGET_EMAIL_RAW.trim().toLowerCase();

async function inspectUserByEmail() {
    console.log(`[inspect-user-by-email] Connecting to Neo4j to inspect user with email ${TARGET_EMAIL}...`);
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const result = await session.run(
            `
            MATCH (u:User)
            WHERE toLower(u.email) = $email
            RETURN 
                u.email AS email,
                u.emailVerificationToken AS emailVerificationToken,
                u.emailVerificationExpiresAt AS emailVerificationExpiresAt,
                u.verifiedAt AS verifiedAt,
                u.createdAt AS createdAt,
                u.updatedAt AS updatedAt
        `,
            { email: TARGET_EMAIL }
        );

        if (!result.records.length) {
            console.log('[inspect-user-by-email] No user found.');
        } else {
            const record = result.records[0];
            console.log(
                '[inspect-user-by-email] User fields:',
                JSON.stringify(
                    {
                        email: record.get('email'),
                        emailVerificationToken: record.get('emailVerificationToken'),
                        emailVerificationExpiresAt: record.get('emailVerificationExpiresAt'),
                        verifiedAt: record.get('verifiedAt'),
                        createdAt: record.get('createdAt'),
                        updatedAt: record.get('updatedAt')
                    },
                    null,
                    2
                )
            );
        }
    } catch (err) {
        console.error('[inspect-user-by-email] ✗ Failed to inspect user:', err.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
        console.log('[inspect-user-by-email] Done.');
    }
}

inspectUserByEmail();


