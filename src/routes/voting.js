/**
 * Voting Routes
 * HTTP handlers for convention voting
 */

const express = require('express');
const router = express.Router();
const votingService = require('../services/votingService');
const { authenticate, requireVerifiedUser, requireAdmin } = require('../middleware/auth');

// GET /api/voting/races/:convId - Get all races in voting phase
router.get('/races/:convId', async (req, res) => {
    try {
        const races = await votingService.getVotingRaces(req.params.convId);
        res.json(races);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/voting/race/:raceId/status - Get voting status for a race
router.get('/race/:raceId/status', async (req, res) => {
    try {
        const status = await votingService.getRaceVotingStatus(req.params.raceId);
        if (!status) {
            return res.status(404).json({ error: 'Race not found' });
        }
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/voting/race/:raceId/tallies - Get current vote tallies
router.get('/race/:raceId/tallies', async (req, res) => {
    try {
        const tallies = await votingService.getVoteTallies(req.params.raceId);
        res.json(tallies);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/voting/race/:raceId/start - Start voting (create round 1) - admin only
router.post('/race/:raceId/start', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await votingService.startVotingForRace(req.params.raceId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/voting/race/:raceId/vote - Cast a vote
router.post('/race/:raceId/vote', authenticate, requireVerifiedUser, async (req, res) => {
    const { candidateId } = req.body;
    const oderId = req.user.id;
    
    if (!candidateId) {
        return res.status(400).json({ error: 'candidateId is required' });
    }
    
    try {
        const result = await votingService.castVote({
            oderId,
            raceId: req.params.raceId,
            candidateId
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/voting/race/:raceId/close-round - Close round and advance (admin only)
router.post('/race/:raceId/close-round', authenticate, requireAdmin, async (req, res) => {
    try {
        const result = await votingService.closeRoundAndAdvance(req.params.raceId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/voting/race/:raceId/has-voted/:userId - Check if user voted
router.get('/race/:raceId/has-voted/:userId', authenticate, requireVerifiedUser, async (req, res) => {
    try {
        if (req.params.userId !== req.user.id) {
            return res.status(403).json({ error: 'Cannot check vote status for another user' });
        }

        const result = await votingService.hasUserVoted({
            oderId: req.user.id,
            raceId: req.params.raceId
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;


