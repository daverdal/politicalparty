/**
 * Route Aggregator
 * Central place to register all API routes
 */

const express = require('express');
const router = express.Router();

const usersRouter = require('./users');
const ideasRouter = require('./ideas');
const eventsRouter = require('./events');
const votesRouter = require('./votes');
const prioritiesRouter = require('./priorities');
const locationsRouter = require('./locations');

// Register all routes
router.use('/users', usersRouter);
router.use('/ideas', ideasRouter);
router.use('/events', eventsRouter);
router.use('/votes', votesRouter);
router.use('/priorities', prioritiesRouter);
router.use('/locations', locationsRouter);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

