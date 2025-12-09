/**
 * Points Routes
 * Exposes local/global points for the current user and leaderboards by location.
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const pointsService = require('../services/pointsService');

// GET /api/points/me - requires auth, returns local/global points for current user
router.get('/me', authenticate, async (req, res) => {
    try {
        const summary = await pointsService.getUserPointsSummary(req.user.id);
        if (!summary) {
            return res.status(400).json({
                error: 'User has no home location set. Please set your riding/location in your profile first.'
            });
        }
        res.json(summary);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[points] me error:', err);
        res.status(500).json({ error: 'Failed to load points summary' });
    }
});

// GET /api/points/leaderboard?locationId=...&locationType=Province&limit=10
router.get('/leaderboard', async (req, res) => {
    const { locationId, locationType } = req.query;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;

    if (!locationId || !locationType) {
        return res.status(400).json({ error: 'locationId and locationType are required' });
    }

    try {
        const leaderboard = await pointsService.getLocationLeaderboard({
            locationId,
            locationType,
            limit
        });
        res.json(leaderboard);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[points] leaderboard error:', err);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

module.exports = router;


