/**
 * Assembly Events Routes
 * HTTP handlers for event management
 * Business logic is delegated to eventService
 */

const express = require('express');
const router = express.Router();
const eventService = require('../services/eventService');
const { authenticate, requireVerifiedUser, requireAdmin } = require('../middleware/auth');

// GET /api/events - Get all events
router.get('/', async (req, res) => {
    try {
        const events = await eventService.getAllEvents();
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', async (req, res) => {
    try {
        const event = await eventService.getEventById(req.params.id);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events - Create a new event (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const event = await eventService.createEvent(req.body);
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/events/:id - Update an event (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const event = await eventService.updateEvent(req.params.id, req.body);
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/events/:id - Delete an event (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    try {
        const deleted = await eventService.deleteEvent(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/events/:id/participate - Join an event
router.post('/:id/participate', authenticate, requireVerifiedUser, async (req, res) => {
    try {
        const success = await eventService.participateInEvent({
            userId: req.user.id,
            eventId: req.params.id
        });
        if (!success) {
            return res.status(404).json({ error: 'User or event not found' });
        }
        res.status(201).json({ message: 'Participation recorded' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/events/:id/participate - Leave an event
router.delete('/:id/participate', authenticate, requireVerifiedUser, async (req, res) => {
    try {
        await eventService.leaveEvent({
            userId: req.user.id,
            eventId: req.params.id
        });
        res.json({ message: 'Participation removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
