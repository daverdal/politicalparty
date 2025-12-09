/**
 * Route Aggregator
 * Central place to register all API routes
 */

const express = require('express');
const router = express.Router();

const authRouter = require('./auth');
const usersRouter = require('./users');
const ideasRouter = require('./ideas');
const eventsRouter = require('./events');
const votesRouter = require('./votes');
const prioritiesRouter = require('./priorities');
const locationsRouter = require('./locations');
const conventionsRouter = require('./conventions');
const adminRouter = require('./admin');
const votingRouter = require('./voting');
const notificationsRouter = require('./notifications');
const pointsRouter = require('./points');

// Register all routes
router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/ideas', ideasRouter);
router.use('/events', eventsRouter);
router.use('/votes', votesRouter);
router.use('/priorities', prioritiesRouter);
router.use('/locations', locationsRouter);
router.use('/conventions', conventionsRouter);
router.use('/admin', adminRouter);
router.use('/voting', votingRouter);
router.use('/notifications', notificationsRouter);
router.use('/points', pointsRouter);

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

