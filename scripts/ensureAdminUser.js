/**
 * Ensure Admin User Script (SAFE for production)
 *
 * - Does NOT clear or overwrite other data
 * - MERGEs a single User node by email and sets password + admin role
 *
 * Usage (PowerShell example):
 *   cd C:\apps\speakeasy
 *   $env:NEO4J_URI="bolt://134.122.44.248:7687"
 *   $env:NEO4J_USERNAME="neo4j"
 *   $env:NEO4J_PASSWORD="your-db-password"
 *   $env:NEO4J_DATABASE="neo4j"
 *   $env:ADMIN_EMAIL="you@example.com"
 *   $env:ADMIN_PASSWORD="someStrongPassword"
 *   node scripts/ensureAdminUser.js
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');
const bcrypt = require('bcryptjs');

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

const ADMIN_EMAIL_RAW = process.env.ADMIN_EMAIL || process.env.OWNER_EMAIL || 'admin@example.com';
const ADMIN_EMAIL = ADMIN_EMAIL_RAW.trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

async function ensureAdminUser() {
    console.log('Connecting to Neo4j to ensure admin user...');
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    const session = driver.session({ database: DATABASE });

    try {
        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
        const adminId =
            'admin-' + ADMIN_EMAIL.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        await session.run(
            `
            MERGE (u:User {email: $email})
            ON CREATE SET
                u.id = $id,
                u.name = $name,
                u.passwordHash = $passwordHash,
                u.role = 'admin',
                u.verifiedAt = datetime(),
                u.createdAt = datetime(),
                u.updatedAt = datetime()
            ON MATCH SET
                u.name = $name,
                u.passwordHash = $passwordHash,
                u.role = 'admin',
                u.verifiedAt = coalesce(u.verifiedAt, datetime()),
                u.updatedAt = datetime()
        `,
            {
                id: adminId,
                email: ADMIN_EMAIL,
                name: ADMIN_NAME,
                passwordHash
            }
        );

        console.log(
            `✓ Admin user ensured for ${ADMIN_EMAIL} (password: "${ADMIN_PASSWORD}" – change after login)`
        );
    } catch (err) {
        console.error('✗ Failed to ensure admin user:', err.message);
        process.exitCode = 1;
    } finally {
        await session.close();
        await driver.close();
    }
}

ensureAdminUser().then(() => {
    console.log('Done.');
});


