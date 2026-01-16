/**
 * Ideas Routes
 * HTTP handlers for idea management
 * Business logic is delegated to ideaService
 */

const express = require('express');
const router = express.Router();
const ideaService = require('../services/ideaService');
const adminService = require('../services/adminService');

// GET /api/ideas - Get all ideas
router.get('/', async (req, res) => {
    try {
        const ideas = await ideaService.getAllIdeas();
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ideas/:id - Get idea by ID
router.get('/:id', async (req, res) => {
    try {
        const idea = await ideaService.getIdeaById(req.params.id);
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
        }
        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ideas - Create a new idea
router.post('/', async (req, res) => {
    try {
        const idea = await ideaService.createIdea(req.body);
        res.status(201).json(idea);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/ideas/:id - Update an idea
router.put('/:id', async (req, res) => {
    try {
        const idea = await ideaService.updateIdea(req.params.id, req.body);
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
        }
        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/ideas/:id - Delete an idea
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await ideaService.deleteIdea(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Idea not found' });
        }
        res.json({ message: 'Idea deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ideas/:id/support - Support an idea
router.post('/:id/support', async (req, res) => {
    try {
        // Respect global idea voting toggle (controlled via Admin page).
        const votingStatus = adminService.getIdeaVotingStatus
            ? adminService.getIdeaVotingStatus()
            : { open: true };

        if (!votingStatus.open) {
            return res.status(400).json({
                error:
                    'Idea liking is currently closed. The facilitator will open voting once all ideas are in.'
            });
        }

        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Simple fairness rule: members must contribute at least one idea
        // before they can like/support other ideas.
        const hasPosted = await ideaService.hasPostedAtLeastOneIdea(userId);
        if (!hasPosted) {
            return res.status(400).json({
                error: 'Please add at least one idea before liking or supporting others.'
            });
        }

        const success = await ideaService.supportIdea({
            userId,
            ideaId: req.params.id
        });
        if (!success) {
            return res.status(404).json({ error: 'User or idea not found' });
        }
        res.status(201).json({ message: 'Idea supported' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/ideas/:id/support - Remove support
router.delete('/:id/support', async (req, res) => {
    try {
        await ideaService.unsupportIdea({
            userId: req.body.userId,
            ideaId: req.params.id
        });
        res.json({ message: 'Support removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ideas/:id/related - Get related ideas
router.get('/:id/related', async (req, res) => {
    try {
        const related = await ideaService.getRelatedIdeas(req.params.id);
        res.json(related);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/ideas/:id/relate - Create relationship
router.post('/:id/relate', async (req, res) => {
    try {
        await ideaService.relateIdeas(req.params.id, req.body.relatedIdeaId);
        res.status(201).json({ message: 'Ideas related' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
