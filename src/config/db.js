/**
 * Neo4j Database Connection
 */

const neo4j = require('neo4j-driver');

const URI = process.env.NEO4J_URI || 'neo4j://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

let driver = null;

function getDriver() {
    if (!driver) {
        driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    }
    return driver;
}

function getSession() {
    return getDriver().session({ database: DATABASE });
}

async function verifyConnection() {
    try {
        const d = getDriver();
        await d.verifyConnectivity();
        console.log(`✓ Connected to Neo4j (${DATABASE})`);
        return true;
    } catch (error) {
        console.error('✗ Neo4j connection failed:', error.message);
        return false;
    }
}

async function closeConnection() {
    if (driver) {
        await driver.close();
        driver = null;
    }
}

module.exports = {
    getDriver,
    getSession,
    verifyConnection,
    closeConnection,
    DATABASE
};

