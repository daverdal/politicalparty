/**
 * Admin Routes
 * HTTP handlers for admin operations
 * Business logic is delegated to adminService
 */

const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All admin routes require an authenticated admin user
router.use(authenticate, requireAdmin);

// GET /api/admin/auto-mode - Get auto-mode status
router.get('/auto-mode', (req, res) => {
    res.json(adminService.getAutoModeStatus());
});

// POST /api/admin/auto-mode - Toggle auto-mode
router.post('/auto-mode', (req, res) => {
    const { enabled } = req.body;
    res.json(adminService.toggleAutoMode(enabled));
});

// GET /api/admin/convention/:id - Get convention admin info
router.get('/convention/:id', async (req, res) => {
    try {
        const conv = await adminService.getConventionAdminInfo(req.params.id);
        if (!conv) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        res.json(conv);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch convention' });
    }
});

// POST /api/admin/convention/:id/set-phase - Manually set convention phase
router.post('/convention/:id/set-phase', async (req, res) => {
    const { status, currentWave } = req.body;
    
    try {
        const result = await adminService.setConventionPhase({
            convId: req.params.id,
            status,
            currentWave
        });
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(400).json({ 
            error: error.message,
            validStatuses: adminService.VALID_STATUSES 
        });
    }
});

// POST /api/admin/convention/:id/advance - Advance to next phase
router.post('/convention/:id/advance', async (req, res) => {
    try {
        const result = await adminService.advanceConventionPhase(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to advance convention' });
    }
});

// POST /api/admin/convention/:id/create-wave-races - Create races for current wave
router.post('/convention/:id/create-wave-races', async (req, res) => {
    try {
        const result = await adminService.createRacesForCurrentWave(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error creating races:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/admin/convention/:id/stats - Get convention statistics
router.get('/convention/:id/stats', async (req, res) => {
    try {
        const stats = await adminService.getConventionStats(req.params.id);
        if (!stats) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get convention stats' });
    }
});

// POST /api/admin/convention/:id/reset - Reset convention to initial state
router.post('/convention/:id/reset', async (req, res) => {
    try {
        const result = await adminService.resetConvention(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error resetting convention:', error);
        res.status(500).json({ error: 'Failed to reset convention' });
    }
});

// POST /api/admin/convention/:id/schedule - Update convention schedule
router.post('/convention/:id/schedule', async (req, res) => {
    const { schedule } = req.body;
    
    if (!schedule || typeof schedule !== 'object') {
        return res.status(400).json({ error: 'Schedule object is required' });
    }
    
    try {
        const result = await adminService.updateConventionSchedule(req.params.id, schedule);
        res.json(result);
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

// GET /api/admin/conventions - Get all conventions
router.get('/conventions', async (req, res) => {
    try {
        const conventions = await adminService.getAllConventions();
        res.json(conventions);
    } catch (error) {
        console.error('Error getting conventions:', error);
        res.status(500).json({ error: 'Failed to get conventions' });
    }
});

// POST /api/admin/conventions - Create a new convention
router.post('/conventions', async (req, res) => {
    const { name, year, startDate } = req.body;
    
    if (!name || !year) {
        return res.status(400).json({ error: 'Name and year are required' });
    }
    
    try {
        const result = await adminService.createConvention({ 
            name, 
            year: parseInt(year),
            startDate // Optional: defaults to Jan 15 of convention year
        });
        res.json(result);
    } catch (error) {
        console.error('Error creating convention:', error);
        res.status(400).json({ error: error.message });
    }
});

// GET /api/admin/convention/:id/results - Get convention results
router.get('/convention/:id/results', async (req, res) => {
    try {
        const results = await adminService.getConventionResults(req.params.id);
        if (!results) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        res.json(results);
    } catch (error) {
        console.error('Error getting results:', error);
        res.status(500).json({ error: 'Failed to get convention results' });
    }
});

// DELETE /api/admin/convention/:id - Delete a convention
router.delete('/convention/:id', async (req, res) => {
    try {
        const result = await adminService.deleteConvention(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Error deleting convention:', error);
        res.status(500).json({ error: 'Failed to delete convention' });
    }
});

module.exports = router;
