/**
 * Vote Sessions & Results Routes
 * HTTP handlers for voting
 * Business logic is delegated to voteService
 */

const express = require('express');
const router = express.Router();
const voteService = require('../services/voteService');

// GET /api/votes - Get all vote sessions
router.get('/', async (req, res) => {
    try {
        const votes = await voteService.getAllVoteSessions();
        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/votes/:id - Get vote session by ID
router.get('/:id', async (req, res) => {
    try {
        const vote = await voteService.getVoteSessionById(req.params.id);
        if (!vote) {
            return res.status(404).json({ error: 'Vote session not found' });
        }
        res.json(vote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/votes - Create a new vote session
router.post('/', async (req, res) => {
    try {
        const vote = await voteService.createVoteSession(req.body);
        res.status(201).json(vote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/votes/:id - Update a vote session
router.put('/:id', async (req, res) => {
    try {
        const vote = await voteService.updateVoteSession(req.params.id, req.body);
        if (!vote) {
            return res.status(404).json({ error: 'Vote session not found' });
        }
        res.json(vote);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/votes/:id - Delete a vote session
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await voteService.deleteVoteSession(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Vote session not found' });
        }
        res.json({ message: 'Vote session deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/votes/:id/result - Add result to a vote session
router.post('/:id/result', async (req, res) => {
    try {
        const result = await voteService.addVoteResult(req.params.id, req.body);
        res.status(201).json({ message: 'Result recorded', ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
