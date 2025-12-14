/**
 * Strategic Planning Routes
 * HTTP handlers for StrategicSession entities
 */

const express = require('express');
const router = express.Router();

const strategicService = require('../services/strategicService');
const { authenticate } = require('../middleware/auth');

const typeMap = {
    countries: 'Country',
    provinces: 'Province',
    'federal-ridings': 'FederalRiding',
    'provincial-ridings': 'ProvincialRiding',
    towns: 'Town',
    'first-nations': 'FirstNation',
    'adhoc-groups': 'AdhocGroup'
};

function resolveLocationType(type) {
    const locationType = typeMap[type];
    if (!locationType) {
        const err = new Error('Invalid location type');
        err.statusCode = 400;
        throw err;
    }
    return locationType;
}

// GET /api/strategic-sessions/location/:type/:id/active
router.get('/location/:type/:id/active', async (req, res) => {
    try {
        const locationType = resolveLocationType(req.params.type);
        const session = await strategicService.getActiveSessionForLocation({
            locationId: req.params.id,
            locationType
        });
        res.json(session || null);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// GET /api/strategic-sessions/location/:type/:id/history
router.get('/location/:type/:id/history', async (req, res) => {
    try {
        const locationType = resolveLocationType(req.params.type);
        const limit = req.query.limit ? parseInt(req.query.limit, 10) || 20 : 20;
        const sessions = await strategicService.getSessionHistoryForLocation({
            locationId: req.params.id,
            locationType,
            limit
        });
        res.json(sessions);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/location/:type/:id
// Create a new session for a location (requires authentication)
router.post('/location/:type/:id', authenticate, async (req, res) => {
    try {
        const locationType = resolveLocationType(req.params.type);
        const { title, vision } = req.body || {};

        const session = await strategicService.createSessionForLocation({
            locationId: req.params.id,
            locationType,
            title,
            vision,
            createdByUserId: req.user?.id
        });

        res.status(201).json(session);
    } catch (error) {
        const status =
            error.code === 'ACTIVE_SESSION_EXISTS'
                ? 400
                : error.statusCode || 500;
        res.status(status).json({ error: error.message, code: error.code });
    }
});

// PUT /api/strategic-sessions/:id
// Update basic fields (title, vision, status)
router.put('/:id', authenticate, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res
                .status(403)
                .json({ error: 'Only admins can modify Strategic Plans.' });
        }

        const { title, vision, status } = req.body || {};
        const updated = await strategicService.updateSession(req.params.id, {
            title,
            vision,
            status
        });
        res.json(updated);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/archive
router.post('/:id/archive', authenticate, async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res
                .status(403)
                .json({ error: 'Only admins can archive Strategic Plans.' });
        }

        const archived = await strategicService.archiveSession(req.params.id);
        res.json(archived);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/issues - add an issue/priority
router.post('/:id/issues', authenticate, async (req, res) => {
    try {
        const { title, description } = req.body || {};
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required.' });
        }
        const issue = await strategicService.addIssue({
            sessionId: req.params.id,
            title: title.trim(),
            description: (description || '').trim(),
            userId: req.user?.id
        });
        res.status(201).json(issue);
    } catch (error) {
        const status =
            error.code === 'NAME_MENTION_FORBIDDEN'
                ? 400
                : error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/issues/:issueId/vote - support an issue
router.post('/:id/issues/:issueId/vote', authenticate, async (req, res) => {
    try {
        const updatedIssue = await strategicService.voteOnIssue({
            sessionId: req.params.id,
            issueId: req.params.issueId,
            userId: req.user?.id
        });
        res.json(updatedIssue);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/comments - add a comment
router.post('/:id/comments', authenticate, async (req, res) => {
    try {
        const { text, section, sectionItemId } = req.body || {};
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Comment text is required.' });
        }
        const comment = await strategicService.addComment({
            sessionId: req.params.id,
            text: text.trim(),
            section,
            sectionItemId,
            userId: req.user?.id
        });
        res.status(201).json(comment);
    } catch (error) {
        const status =
            error.code === 'NAME_MENTION_FORBIDDEN'
                ? 400
                : error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/actions - add an action/decision
router.post('/:id/actions', authenticate, async (req, res) => {
    try {
        const { description, dueDate } = req.body || {};
        if (!description || !description.trim()) {
            return res.status(400).json({ error: 'Description is required.' });
        }
        const action = await strategicService.addAction({
            sessionId: req.params.id,
            description: description.trim(),
            dueDate: dueDate || null,
            userId: req.user?.id
        });
        res.status(201).json(action);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/goals - add a goal/objective
router.post('/:id/goals', authenticate, async (req, res) => {
    try {
        const { title, description, metric, dueDate } = req.body || {};
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required.' });
        }
        const goal = await strategicService.addGoal({
            sessionId: req.params.id,
            title: title.trim(),
            description: (description || '').trim(),
            metric: (metric || '').trim(),
            dueDate: dueDate || null,
            userId: req.user?.id
        });
        res.status(201).json(goal);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// PUT /api/strategic-sessions/:id/swot - update SWOT analysis
router.put('/:id/swot', authenticate, async (req, res) => {
    try {
        const { swot } = req.body || {};
        if (!swot || typeof swot !== 'object') {
            return res.status(400).json({ error: 'SWOT object is required.' });
        }
        const updated = await strategicService.updateSwot({
            sessionId: req.params.id,
            swot
        });
        res.json(updated);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// PUT /api/strategic-sessions/:id/pest - update PEST analysis
router.put('/:id/pest', authenticate, async (req, res) => {
    try {
        const { pest } = req.body || {};
        if (!pest || typeof pest !== 'object') {
            return res.status(400).json({ error: 'PEST object is required.' });
        }
        const updated = await strategicService.updatePest({
            sessionId: req.params.id,
            pest
        });
        res.json(updated);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// POST /api/strategic-sessions/:id/goals/:goalId/progress - update goal status/progress
router.post('/:id/goals/:goalId/progress', authenticate, async (req, res) => {
    try {
        const { status, currentValue } = req.body || {};
        const updated = await strategicService.updateGoalProgress({
            sessionId: req.params.id,
            goalId: req.params.goalId,
            status,
            currentValue
        });
        res.json(updated);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// PUT /api/strategic-sessions/:id/review - update review/lessons
router.put('/:id/review', authenticate, async (req, res) => {
    try {
        const { review } = req.body || {};
        if (!review || typeof review !== 'object') {
            return res.status(400).json({ error: 'Review object is required.' });
        }
        const updated = await strategicService.updateReview({
            sessionId: req.params.id,
            review
        });
        res.json(updated);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

module.exports = router;


