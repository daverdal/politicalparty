/**
 * Quick script to verify the admin@example.com password hash in Neo4j.
 *
 * Usage from project root:
 *   node scripts/checkAdminPassword.js
 *
 * It will:
 *  - Look up User with email admin@example.com
 *  - Print whether bcrypt.compare('changeme123') returns true or false
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');
const bcrypt = require('bcryptjs');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

async function checkAdminPassword() {
    console.log('Connecting to Neo4j to check admin@example.com password...');
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const result = await session.run(
            `
            MATCH (u:User)
            WHERE toLower(u.email) = $email
            RETURN u.passwordHash AS passwordHash
        `,
            { email: 'admin@example.com' }
        );

        if (!result.records.length) {
            console.log('No user found with email admin@example.com');
            return;
        }

        const passwordHash = result.records[0].get('passwordHash');
        console.log('Stored passwordHash:', passwordHash ? String(passwordHash).slice(0, 20) + '...' : '(none)');

        const ok = await bcrypt.compare('changeme123', passwordHash);
        console.log('Does "changeme123" match the stored hash?', ok);
    } catch (err) {
        console.error('Error checking admin password:', err.message || err);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
    }
}

checkAdminPassword().then(() => {
    console.log('Done.');
});


