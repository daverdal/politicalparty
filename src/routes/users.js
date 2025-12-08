/**
 * User Routes
 * HTTP handlers for user management
 * Business logic is delegated to userService
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { getSession } = require('../config/db');
const { authenticate, requireVerifiedUser, requireAdmin } = require('../middleware/auth');

// GET /api/users - Get all users
router.get('/', async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function ensureSelfOrAdmin(req, res) {
    if (req.user && req.user.role === 'admin') {
        return true;
    }
    if (!req.user || req.user.id !== req.params.id) {
        res.status(403).json({ error: 'You can only modify your own profile' });
        return false;
    }
    return true;
}

// POST /api/users - Create a new user (admin only; normal users sign up via /api/auth/signup)
router.post('/', authenticate, requireAdmin, async (req, res) => {
    const session = getSession();
    const { id, name, region, bio, skills, experience, interests } = req.body;
    
    try {
        const result = await session.run(`
            CREATE (u:User {
                id: $id,
                name: $name,
                region: $region,
                bio: $bio,
                skills: $skills,
                experience: $experience,
                interests: $interests,
                createdAt: datetime(),
                updatedAt: datetime()
            })
            RETURN u
        `, { id, name, region, bio, skills: skills || [], experience: experience || [], interests: interests || [] });
        
        res.status(201).json(result.records[0].get('u').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/users/:id - Update a user
router.put('/:id', authenticate, requireVerifiedUser, async (req, res) => {
    const session = getSession();
    const { name, region, bio, skills, experience, interests } = req.body;
    
    try {
        if (!ensureSelfOrAdmin(req, res)) {
            return;
        }
        const result = await session.run(`
            MATCH (u:User {id: $id})
            SET u.name = $name,
                u.region = $region,
                u.bio = $bio,
                u.skills = $skills,
                u.experience = $experience,
                u.interests = $interests,
                u.updatedAt = datetime()
            RETURN u
        `, { id: req.params.id, name, region, bio, skills: skills || [], experience: experience || [], interests: interests || [] });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.records[0].get('u').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/users/:id - Delete a user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (u:User {id: $id}) DETACH DELETE u RETURN count(u) as deleted',
            { id: req.params.id }
        );
        const deleted = result.records[0].get('deleted').toNumber();
        if (deleted === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/users/:id/endorsements - Get endorsements for a user
router.get('/:id/endorsements', async (req, res) => {
    try {
        const endorsements = await userService.getEndorsements(req.params.id);
        res.json(endorsements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/users/:id/endorse - Endorse another user
router.post('/:id/endorse', authenticate, requireVerifiedUser, async (req, res) => {
    const { targetUserId, message } = req.body;
    
    try {
        if (!ensureSelfOrAdmin(req, res)) {
            return;
        }
        const result = await userService.endorseUser({
            fromUserId: req.user.id,
            toUserId: targetUserId,
            message
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/users/:id/location - Set user's single location
router.put('/:id/location', authenticate, requireVerifiedUser, async (req, res) => {
    const { locationId, locationType } = req.body;
    
    try {
        if (!ensureSelfOrAdmin(req, res)) {
            return;
        }
        const result = await userService.setUserLocation({
            userId: req.params.id,
            locationId,
            locationType
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT /api/users/:id/locations - Set multiple locations
router.put('/:id/locations', authenticate, requireVerifiedUser, async (req, res) => {
    const { locations } = req.body;
    
    if (!locations || !Array.isArray(locations)) {
        return res.status(400).json({ error: 'locations must be an array' });
    }
    
    try {
        if (!ensureSelfOrAdmin(req, res)) {
            return;
        }
        const result = await userService.setUserLocations({
            userId: req.params.id,
            locations
        });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE /api/users/:id/location - Remove user's location
router.delete('/:id/location', authenticate, requireVerifiedUser, async (req, res) => {
    try {
        if (!ensureSelfOrAdmin(req, res)) {
            return;
        }
        const result = await userService.removeUserLocation(req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
