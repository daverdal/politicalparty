/**
 * Referendum Routes
 * Referendum questions and arguments with basic privacy modes.
 */

const express = require('express');
const router = express.Router();

const { authenticate, requireVerifiedUser, requireAdmin } = require('../middleware/auth');
const referendumService = require('../services/referendumService');

// GET /api/referendums - list all questions
router.get('/', async (req, res) => {
    try {
        const refs = await referendumService.listReferendums();
        res.json(refs);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[referendums] list error:', err);
        res.status(500).json({ error: 'Failed to load referendums' });
    }
});

// POST /api/referendums - create a new question (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
    const { title, body, scope, locationId, opensAt, closesAt } = req.body;
    if (!title || !body) {
        return res.status(400).json({ error: 'Title and body are required' });
    }

    try {
        const q = await referendumService.createReferendumQuestion({
            title,
            body,
            scope,
            locationId,
            opensAt,
            closesAt,
            authorId: req.user.id
        });
        res.status(201).json(q);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[referendums] create error:', err);
        res.status(400).json({ error: err.message || 'Failed to create referendum' });
    }
});

// GET /api/referendums/:id - single question details
router.get('/:id', async (req, res) => {
    try {
        const ref = await referendumService.getReferendumById(req.params.id);
        if (!ref) {
            return res.status(404).json({ error: 'Referendum not found' });
        }
        res.json(ref);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[referendums] get error:', err);
        res.status(500).json({ error: 'Failed to load referendum' });
    }
});

// GET /api/referendums/:id/arguments - list arguments for a question
router.get('/:id/arguments', async (req, res) => {
    try {
        const args = await referendumService.listArguments(req.params.id);
        res.json(args);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[referendums] list args error:', err);
        res.status(500).json({ error: 'Failed to load arguments' });
    }
});

// POST /api/referendums/:id/arguments - create argument (verified users)
router.post('/:id/arguments', authenticate, requireVerifiedUser, async (req, res) => {
    const { side, body, visibility } = req.body;
    if (!body || body.trim().length === 0) {
        return res.status(400).json({ error: 'Perspective text is required' });
    }

    try {
        const arg = await referendumService.createArgument({
            referId: req.params.id,
            userId: req.user.id,
            side,
            body,
            visibility
        });
        res.status(201).json(arg);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[referendums] create arg error:', err);
        res.status(400).json({ error: err.message || 'Failed to create perspective' });
    }
});

// POST /api/referendums/:id/arguments/:argId/upvote - support an argument
router.post('/:id/arguments/:argId/upvote', authenticate, requireVerifiedUser, async (req, res) => {
    try {
        const ok = await referendumService.upvoteArgument({
            userId: req.user.id,
            argumentId: req.params.argId
        });
        if (!ok) {
            return res.status(404).json({ error: 'Perspective not found' });
        }
        res.json({ success: true });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[referendums] upvote arg error:', err);
        res.status(400).json({ error: err.message || 'Failed to support perspective' });
    }
});

module.exports = router;


