/**
 * Voting Routes
 * HTTP handlers for convention voting
 */

const express = require('express');
const router = express.Router();
const votingService = require('../services/votingService');

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

// POST /api/voting/race/:raceId/start - Start voting (create round 1)
router.post('/race/:raceId/start', async (req, res) => {
    try {
        const result = await votingService.startVotingForRace(req.params.raceId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /api/voting/race/:raceId/vote - Cast a vote
router.post('/race/:raceId/vote', async (req, res) => {
    const { oderId, candidateId } = req.body;
    
    if (!oderId || !candidateId) {
        return res.status(400).json({ error: 'oderId and candidateId are required' });
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

// POST /api/voting/race/:raceId/close-round - Close round and advance
router.post('/race/:raceId/close-round', async (req, res) => {
    try {
        const result = await votingService.closeRoundAndAdvance(req.params.raceId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /api/voting/race/:raceId/has-voted/:userId - Check if user voted
router.get('/race/:raceId/has-voted/:userId', async (req, res) => {
    try {
        const result = await votingService.hasUserVoted({
            oderId: req.params.userId,
            raceId: req.params.raceId
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

