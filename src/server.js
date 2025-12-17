/**
 * Political Party API Server
 * Main entry point - kept minimal by design
 */

// Load environment variables
// - Locally: use `.env` (dev) by default
// - Optionally: use `.env.production` when NODE_ENV=production (e.g. on a droplet)
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: envFile });

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const db = require('./config/db');
const routes = require('./routes');

const app = express();

// Behind DigitalOcean / proxies, trust X-Forwarded-* so rate limiting and IPs work correctly
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

// Serve uploaded files (e.g., news audio) under /uploads when enabled
app.use('/uploads', express.static(path.join(process.cwd(), config.uploads?.baseDir || 'uploads')));

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

