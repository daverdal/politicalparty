/**
 * Dashboard Routes
 * Lightweight summary endpoints used by the Dashboard page so we don't
 * need to load full user/idea/event/vote lists on every visit.
 */

const express = require('express');
const router = express.Router();
const { getDriver, getDatabase } = require('../config/db');

// GET /api/dashboard/summary
// Returns simple aggregate counts for key entities.
router.get('/summary', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (u:User) WITH count(u) as users
            MATCH (i:Idea) WITH users, count(i) as ideas
            MATCH (a:AssemblyEvent) WITH users, ideas, count(a) as events
            MATCH (v:VoteSession) WITH users, ideas, events, count(v) as votes
            RETURN users, ideas, events, votes
        `
        );

        if (!result.records.length) {
            return res.json({
                users: 0,
                ideas: 0,
                events: 0,
                votes: 0
            });
        }

        const record = result.records[0];
        return res.json({
            users: record.get('users').toNumber ? record.get('users').toNumber() : Number(record.get('users')) || 0,
            ideas: record.get('ideas').toNumber ? record.get('ideas').toNumber() : Number(record.get('ideas')) || 0,
            events: record.get('events').toNumber ? record.get('events').toNumber() : Number(record.get('events')) || 0,
            votes: record.get('votes').toNumber ? record.get('votes').toNumber() : Number(record.get('votes')) || 0
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[dashboard] Failed to load summary:', err);
        return res.status(500).json({ error: 'Unable to load dashboard summary.' });
    } finally {
        await session.close();
    }
});

module.exports = router;



