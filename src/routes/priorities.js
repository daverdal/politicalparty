/**
 * Community Priorities Routes
 * HTTP handlers for priority management
 * Business logic is delegated to priorityService
 */

const express = require('express');
const router = express.Router();
const priorityService = require('../services/priorityService');

// GET /api/priorities - Get all community priorities
router.get('/', async (req, res) => {
    try {
        const priorities = await priorityService.getAllPriorities();
        res.json(priorities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/priorities/:id - Get priority by ID
router.get('/:id', async (req, res) => {
    try {
        const priority = await priorityService.getPriorityById(req.params.id);
        if (!priority) {
            return res.status(404).json({ error: 'Priority not found' });
        }
        res.json(priority);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/priorities - Create a new priority
router.post('/', async (req, res) => {
    try {
        const priority = await priorityService.createPriority(req.body);
        res.status(201).json(priority);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/priorities/:id - Update a priority
router.put('/:id', async (req, res) => {
    try {
        const priority = await priorityService.updatePriority(req.params.id, req.body);
        if (!priority) {
            return res.status(404).json({ error: 'Priority not found' });
        }
        res.json(priority);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/priorities/:id - Delete a priority
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await priorityService.deletePriority(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Priority not found' });
        }
        res.json({ message: 'Priority deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/priorities/region/:region - Get priorities by region
router.get('/region/:region', async (req, res) => {
    try {
        const priorities = await priorityService.getPrioritiesByRegion(req.params.region);
        res.json(priorities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
