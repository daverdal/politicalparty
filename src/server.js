/**
 * Political Party API Server
 * Main entry point - kept minimal by design
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const config = require('./config');
const db = require('./config/db');
const routes = require('./routes');

const app = express();

// Middleware
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', routes);

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
});

// Start server
async function start() {
    // Verify database connection
    const connected = await db.verifyConnection();
    if (!connected) {
        console.error('Failed to connect to Neo4j. Exiting.');
        process.exit(1);
    }

    app.listen(config.port, () => {
        console.log(`\n🎤 Political Party API running on http://localhost:${config.port}`);
        console.log(`   Environment: ${config.env}`);
        console.log(`   Database: ${db.DATABASE}\n`);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await db.closeConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await db.closeConnection();
    process.exit(0);
});

start();

