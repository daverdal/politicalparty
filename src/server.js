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

// Simple in-memory health flag for database connectivity
let isDatabaseHealthy = true;

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

// Database health guard for all API routes
app.use('/api', (req, res, next) => {
    if (!isDatabaseHealthy) {
        // User-friendly message when the database is unavailable
        return res.status(503).json({
            ok: false,
            message: 'Our community data service is temporarily unavailable. Please try again in a few minutes.',
        });
    }
    next();
});

// API Routes
app.use('/api', routes);

// Public resume share page - accessible to anyone with the link
app.get('/resumes/:token', async (req, res) => {
    const token = req.params.token;

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    let session;
    try {
        const driver = db.getDriver();
        session = driver.session({ database: db.getDatabase() });

        const result = await session.run(
            `
            MATCH (u:User {resumePublicToken: $token})
            WHERE coalesce(u.resumePublic, false) = true
              AND u.resume IS NOT NULL
              AND u.resume <> ''
            RETURN 
                u.name AS name,
                u.resume AS resume,
                u.region AS region
        `,
            { token }
        );

        if (!result.records.length) {
            return res
                .status(404)
                .send('<h1>Resume not found</h1><p>This resume link is invalid or has been turned off.</p>');
        }

        const record = result.records[0];
        const name = record.get('name') || 'Member';
        const resume = record.get('resume') || '';
        const region = record.get('region') || '';

        const escapedResume = escapeHtml(resume);
        const escapedName = escapeHtml(name);
        const escapedRegion = escapeHtml(region);

        return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Resume – ${escapedName}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
        body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            margin: 0;
            padding: 24px;
            background: #050816;
            color: #e5e7eb;
        }
        .wrapper {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(15, 23, 42, 0.98);
            border-radius: 12px;
            border: 1px solid rgba(148, 163, 184, 0.4);
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.9);
            padding: 24px 28px 28px;
        }
        h1 {
            margin: 0 0 4px;
            font-size: 1.6rem;
        }
        .meta {
            font-size: 0.9rem;
            color: #9ca3af;
            margin-bottom: 18px;
        }
        .pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            border-radius: 999px;
            background: rgba(22, 163, 74, 0.12);
            color: #a3e635;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 8px;
        }
        .resume-body {
            white-space: pre-wrap;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        footer {
            margin-top: 24px;
            font-size: 0.8rem;
            color: #6b7280;
        }
        a {
            color: #38bdf8;
        }
    </style>
</head>
<body>
    <main class="wrapper">
        <div class="pill">Public Resume</div>
        <h1>${escapedName}</h1>
        ${escapedRegion ? `<div class="meta">📍 ${escapedRegion}</div>` : ''}
        <section class="resume-body">${escapedResume}</section>
        <footer>
            <p>This page is visible to anyone with the link. To turn it off, update your profile settings.</p>
        </footer>
    </main>
</body>
</html>
        `);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error rendering public resume:', err);
        return res.status(500).send('<h1>Error</h1><p>Unable to load resume right now.</p>');
    } finally {
        if (session) {
            await session.close();
        }
    }
});

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
        console.error('Failed to connect to Neo4j at startup. Continuing with limited functionality.');
        isDatabaseHealthy = false;
    } else {
        isDatabaseHealthy = true;
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

