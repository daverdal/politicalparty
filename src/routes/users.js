/**
 * User Routes
 */

const express = require('express');
const router = express.Router();
const { getSession } = require('../config/db');

// GET /api/users - Get all users with points (calculated from idea supports)
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (u:User)
            OPTIONAL MATCH (u)-[:LOCATED_IN]->(loc)
            OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
            WITH u, loc, labels(loc) as locLabels, count(DISTINCT supporter) as points
            RETURN u, loc, locLabels, points
            ORDER BY u.name
        `);
        const users = result.records.map(record => {
            const loc = record.get('loc');
            const locLabels = record.get('locLabels');
            return {
                ...record.get('u').properties,
                points: record.get('points').toNumber(),
                location: loc ? {
                    ...loc.properties,
                    type: locLabels ? locLabels.find(l => l !== 'Node') : null
                } : null
            };
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/users/:id - Get user by ID with points
router.get('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (u:User {id: $id})
            OPTIONAL MATCH (u)-[:LOCATED_IN]->(loc)
            OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
            WITH u, loc, labels(loc) as locLabels, count(DISTINCT supporter) as points
            RETURN u, loc, locLabels, points
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const record = result.records[0];
        const loc = record.get('loc');
        const locLabels = record.get('locLabels');
        
        res.json({
            ...record.get('u').properties,
            points: record.get('points').toNumber(),
            location: loc ? {
                ...loc.properties,
                type: locLabels ? locLabels.find(l => l !== 'Node') : null
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/users - Create a new user
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
    const session = getSession();
    const { name, region, bio, skills, experience, interests } = req.body;
    
    try {
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

// DELETE /api/users/:id - Delete a user
router.delete('/:id', async (req, res) => {
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

// GET /api/users/:id/nominations - Get nominations for a user
router.get('/:id/nominations', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED]->(u:User {id: $id})
            RETURN nominator, n.message as message, n.createdAt as createdAt
        `, { id: req.params.id });
        
        const nominations = result.records.map(record => ({
            nominator: record.get('nominator').properties,
            message: record.get('message'),
            createdAt: record.get('createdAt')
        }));
        res.json(nominations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/users/:id/nominate - Nominate another user
router.post('/:id/nominate', async (req, res) => {
    const session = getSession();
    const { targetUserId, message } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (u1:User {id: $fromId}), (u2:User {id: $toId})
            CREATE (u1)-[n:NOMINATED {message: $message, createdAt: datetime()}]->(u2)
            RETURN u1, u2, n
        `, { fromId: req.params.id, toId: targetUserId, message });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'One or both users not found' });
        }
        res.status(201).json({ message: 'Nomination created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/users/:id/endorsements - Get endorsements for a user
router.get('/:id/endorsements', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (endorser:User)-[e:ENDORSED]->(u:User {id: $id})
            RETURN endorser, e.message as message, e.createdAt as createdAt
        `, { id: req.params.id });
        
        const endorsements = result.records.map(record => ({
            endorser: record.get('endorser').properties,
            message: record.get('message'),
            createdAt: record.get('createdAt')
        }));
        res.json(endorsements);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/users/:id/endorse - Endorse another user
router.post('/:id/endorse', async (req, res) => {
    const session = getSession();
    const { targetUserId, message } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (u1:User {id: $fromId}), (u2:User {id: $toId})
            CREATE (u1)-[e:ENDORSED {message: $message, createdAt: datetime()}]->(u2)
            RETURN u1, u2, e
        `, { fromId: req.params.id, toId: targetUserId, message });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'One or both users not found' });
        }
        res.status(201).json({ message: 'Endorsement created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/users/:id/location - Set user's location
router.put('/:id/location', async (req, res) => {
    const session = getSession();
    const { locationId, locationType } = req.body;
    
    // Valid location types
    const validTypes = ['Town', 'FederalRiding', 'ProvincialRiding', 'FirstNation', 'AdhocGroup'];
    if (!validTypes.includes(locationType)) {
        return res.status(400).json({ error: `Invalid location type. Must be one of: ${validTypes.join(', ')}` });
    }
    
    try {
        // Remove existing location relationship
        await session.run(`
            MATCH (u:User {id: $userId})-[r:LOCATED_IN]->()
            DELETE r
        `, { userId: req.params.id });
        
        // Create new location relationship
        const result = await session.run(`
            MATCH (u:User {id: $userId}), (loc:${locationType} {id: $locationId})
            CREATE (u)-[:LOCATED_IN {createdAt: datetime()}]->(loc)
            RETURN u, loc
        `, { userId: req.params.id, locationId });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User or location not found' });
        }
        
        res.json({ message: 'Location updated', location: result.records[0].get('loc').properties });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/users/:id/location - Remove user's location
router.delete('/:id/location', async (req, res) => {
    const session = getSession();
    
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[r:LOCATED_IN]->()
            DELETE r
        `, { userId: req.params.id });
        
        res.json({ message: 'Location removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;

