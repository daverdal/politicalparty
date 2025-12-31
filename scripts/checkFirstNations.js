/**
 * Quick check script to see if FirstNation nodes are present in Neo4j.
 *
 * Usage (from project root):
 *   node scripts/checkFirstNations.js
 *
 * It uses the same default connection settings as the other scripts:
 * - NEO4J_URI (default: bolt://127.0.0.1:7687)
 * - NEO4J_USERNAME (default: neo4j)
 * - NEO4J_PASSWORD (default: Dwall123)
 * - NEO4J_DATABASE (default: neo4j)
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

async function checkFirstNations() {
    console.log('Connecting to Neo4j to check FirstNation nodes...');
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const result = await session.run(
            `
            MATCH (fn:FirstNation)
            RETURN count(fn) AS count
        `
        );

        const count = result.records[0].get('count').toNumber
            ? result.records[0].get('count').toNumber()
            : Number(result.records[0].get('count'));

        console.log(`FirstNation node count: ${count}`);

        const sampleResult = await session.run(
            `
            MATCH (fn:FirstNation)
            RETURN fn.name AS name
            ORDER BY name
            LIMIT 5
        `
        );

        console.log('Sample FirstNation names (up to 5):');
        if (!sampleResult.records.length) {
            console.log('  (none)');
        } else {
            sampleResult.records.forEach((rec, idx) => {
                console.log(`  ${idx + 1}. ${rec.get('name')}`);
            });
        }
    } catch (err) {
        console.error('Error checking FirstNation nodes:', err.message || err);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
    }
}

checkFirstNations().then(() => {
    console.log('Done.');
});


