/**
 * Admin Routes
 * HTTP handlers for admin operations
 * Business logic is delegated to adminService
 */

const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');

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

module.exports = router;
