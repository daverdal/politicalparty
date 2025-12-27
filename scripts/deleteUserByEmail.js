/**
 * Delete User(s) by Email (SAFE, targeted operation)
 *
 * - Connects to Neo4j using NEO4J_* environment variables
 * - Deletes ONLY User nodes that match the specified email (case-insensitive)
 * - Also deletes all relationships from/to those nodes (DETACH DELETE)
 *
 * Usage (PowerShell example from project root):
 *   $env:TARGET_EMAIL="ddalgliesh@manitobachiefs.com"
 *   node scripts/deleteUserByEmail.js
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

const TARGET_EMAIL_RAW = process.env.TARGET_EMAIL;

if (!TARGET_EMAIL_RAW) {
    console.error('[delete-user-by-email] Please set TARGET_EMAIL in the environment.');
    process.exit(1);
}

const TARGET_EMAIL = TARGET_EMAIL_RAW.trim().toLowerCase();

async function deleteUserByEmail() {
    console.log(`[delete-user-by-email] Connecting to Neo4j to delete user(s) with email ${TARGET_EMAIL}...`);
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const result = await session.run(
            `
            MATCH (u:User)
            WHERE toLower(u.email) = $email
            WITH collect(u) AS users
            FOREACH (x IN users | DETACH DELETE x)
            RETURN size(users) AS deletedCount
        `,
            { email: TARGET_EMAIL }
        );

        const record = result.records[0];
        const deletedCount = record ? record.get('deletedCount').toNumber() : 0;

        if (deletedCount === 0) {
            console.log(`[delete-user-by-email] No users found with email ${TARGET_EMAIL}. Nothing deleted.`);
        } else {
            console.log(`[delete-user-by-email] ✓ Deleted ${deletedCount} user(s) with email ${TARGET_EMAIL}.`);
        }
    } catch (err) {
        console.error('[delete-user-by-email] ✗ Failed to delete user(s):', err.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
        console.log('[delete-user-by-email] Done.');
    }
}

deleteUserByEmail();


