/**
 * Delete a FirstNation node by name (production-safe, targeted)
 *
 * - Matches FirstNation nodes with the given name (exact match, case-sensitive)
 * - DETACH DELETE to remove all relationships for those nodes
 *
 * Usage from project root (PowerShell example):
 *   $env:TARGET_FN_NAME="Assembly of Manitoba Chiefs"
 *   node scripts/deleteFirstNationByName.js
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

const TARGET_FN_NAME = process.env.TARGET_FN_NAME;

if (!TARGET_FN_NAME) {
    console.error('[delete-firstnation-by-name] Please set TARGET_FN_NAME in the environment.');
    process.exit(1);
}

async function deleteFirstNationByName() {
    console.log(
        `[delete-firstnation-by-name] Connecting to Neo4j to delete FirstNation node(s) named "${TARGET_FN_NAME}"...`
    );
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const result = await session.run(
            `
            MATCH (fn:FirstNation {name: $name})
            WITH collect(fn) as nodes
            FOREACH (n IN nodes | DETACH DELETE n)
            RETURN size(nodes) as deletedCount
        `,
            { name: TARGET_FN_NAME }
        );

        const record = result.records[0];
        const deletedCount = record ? record.get('deletedCount').toNumber() : 0;

        if (deletedCount === 0) {
            console.log(
                `[delete-firstnation-by-name] No FirstNation nodes found with name "${TARGET_FN_NAME}". Nothing deleted.`
            );
        } else {
            console.log(
                `[delete-firstnation-by-name] ✓ Deleted ${deletedCount} FirstNation node(s) named "${TARGET_FN_NAME}".`
            );
        }
    } catch (err) {
        console.error('[delete-firstnation-by-name] ✗ Failed to delete FirstNation node(s):', err.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
        console.log('[delete-firstnation-by-name] Done.');
    }
}

deleteFirstNationByName();


