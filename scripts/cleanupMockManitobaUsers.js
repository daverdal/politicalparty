/**
 * Cleanup Mock Manitoba Users (and their Ideas)
 *
 * - Connects to Neo4j using NEO4J_* environment variables.
 * - Finds users located in Manitoba (Province id 'ca-mb' and its child locations)
 *   whose email does NOT end with the configured AMC domain (KEEP_EMAIL_DOMAIN).
 * - Deletes those users and any ideas they posted.
 *
 * Usage example (PowerShell from project root, against the target Neo4j):
 *   $env:KEEP_EMAIL_DOMAIN="manitobachiefs.com"
 *   node scripts/cleanupMockManitobaUsers.js
 *
 * IMPORTANT: This is destructive. Make sure you point NEO4J_URI / credentials
 * at the correct database (dev vs production) before running.
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

// Email domain to KEEP (real AMC staff). All other domains are treated as mock/test.
const KEEP_EMAIL_DOMAIN = (process.env.KEEP_EMAIL_DOMAIN || 'manitobachiefs.com')
    .trim()
    .toLowerCase();

// Province id for Manitoba from seed/manitoba.js
const MANITOBA_PROVINCE_ID = 'ca-mb';

async function cleanupMockManitobaUsers() {
    console.log(
        `[cleanup-mock-mb] Connecting to Neo4j at ${URI} (db=${DATABASE}), keeping domain "*@${KEEP_EMAIL_DOMAIN}"…`
    );

    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const result = await session.run(
            `
            // Find Manitoba province and its immediate child locations
            MATCH (prov:Province {id: $provinceId})
            OPTIONAL MATCH (prov)-[]->(childLoc)
            WITH prov, collect(DISTINCT childLoc) AS children
            WITH [prov] + [loc IN children WHERE loc IS NOT NULL] AS allLocs

            // Find users located in Manitoba or any of its child locations
            UNWIND allLocs AS loc
            MATCH (u:User)-[:LOCATED_IN]->(loc)
            // Treat any user whose email is NULL or does NOT end with the AMC domain
            // as a mock/test user that can be safely removed.
            WHERE u.email IS NULL
               OR NOT toLower(u.email) ENDS WITH $keepDomain

            // Collect users and any ideas they have posted
            OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)
            WITH collect(DISTINCT u) AS users, collect(DISTINCT idea) AS ideas

            // Delete ideas first, then users
            FOREACH (i IN ideas | DETACH DELETE i)
            FOREACH (x IN users | DETACH DELETE x)

            RETURN size(users) AS deletedUsers, size(ideas) AS deletedIdeas
        `,
            {
                provinceId: MANITOBA_PROVINCE_ID,
                keepDomain: KEEP_EMAIL_DOMAIN
            }
        );

        const record = result.records[0];
        const deletedUsers = record ? record.get('deletedUsers').toNumber() : 0;
        const deletedIdeas = record ? record.get('deletedIdeas').toNumber() : 0;

        console.log(
            `[cleanup-mock-mb] ✓ Deleted ${deletedUsers} user(s) and ${deletedIdeas} idea(s) associated with Manitoba for non-${KEEP_EMAIL_DOMAIN} emails.`
        );
    } catch (err) {
        console.error('[cleanup-mock-mb] ✗ Failed to clean up mock Manitoba users:', err.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
        console.log('[cleanup-mock-mb] Done.');
    }
}

cleanupMockManitobaUsers();


