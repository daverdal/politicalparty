/**
 * Notification Routes
 * All routes require authentication and operate on the current user.
 */

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Require authentication for all notification routes
router.use(authenticate);

// GET /api/notifications?unreadOnly=true&limit=50
router.get('/', async (req, res) => {
    try {
        const unreadOnly = req.query.unreadOnly === 'true';
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const notifications = await notificationService.listNotifications(req.user.id, {
            unreadOnly,
            limit
        });
        res.json(
            notifications.map((n) => ({
                ...n,
                // if payloadJson exists, parse it into payload
                payload: n.payloadJson ? safeParseJson(n.payloadJson) : null
            }))
        );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifications] list error:', err);
        res.status(500).json({ error: 'Failed to load notifications' });
    }
});

// POST /api/notifications/:id/read - mark a single notification as read
router.post('/:id/read', async (req, res) => {
    try {
        const ok = await notificationService.markNotificationRead(req.user.id, req.params.id);
        if (!ok) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ success: true });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifications] mark read error:', err);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', async (req, res) => {
    try {
        await notificationService.markAllNotificationsRead(req.user.id);
        res.json({ success: true });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[notifications] mark all read error:', err);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

function safeParseJson(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

module.exports = router;


