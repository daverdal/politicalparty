/**
 * Community Priorities Routes
 */

const express = require('express');
const router = express.Router();
const { getSession } = require('../config/db');

// GET /api/priorities - Get all community priorities
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority)
            OPTIONAL MATCH (p)-[:DERIVED_FROM]->(i:Idea)
            RETURN p, i
            ORDER BY p.createdAt DESC
        `);
        
        const priorities = result.records.map(record => ({
            ...record.get('p').properties,
            derivedFrom: record.get('i')?.properties || null
        }));
        res.json(priorities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/priorities/:id - Get priority by ID
router.get('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority {id: $id})
            OPTIONAL MATCH (p)-[:DERIVED_FROM]->(i:Idea)
            RETURN p, i
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Priority not found' });
        }
        
        const record = result.records[0];
        res.json({
            ...record.get('p').properties,
            derivedFrom: record.get('i')?.properties || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/priorities - Create a new priority
router.post('/', async (req, res) => {
    const session = getSession();
    const { id, name, description, region, derivedFromId } = req.body;
    
    try {
        await session.run(`
            CREATE (p:CommunityPriority {
                id: $id,
                name: $name,
                description: $description,
                region: $region,
                createdAt: datetime()
            })
        `, { id, name, description, region });
        
        // Link to derived idea if provided
        if (derivedFromId) {
            await session.run(`
                MATCH (p:CommunityPriority {id: $priorityId}), (i:Idea {id: $ideaId})
                CREATE (p)-[:DERIVED_FROM]->(i)
            `, { priorityId: id, ideaId: derivedFromId });
        }
        
        const result = await session.run(
            'MATCH (p:CommunityPriority {id: $id}) RETURN p',
            { id }
        );
        res.status(201).json(result.records[0].get('p').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/priorities/:id - Update a priority
router.put('/:id', async (req, res) => {
    const session = getSession();
    const { name, description, region } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority {id: $id})
            SET p.name = $name,
                p.description = $description,
                p.region = $region
            RETURN p
        `, { id: req.params.id, name, description, region });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Priority not found' });
        }
        res.json(result.records[0].get('p').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/priorities/:id - Delete a priority
router.delete('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (p:CommunityPriority {id: $id}) DETACH DELETE p RETURN count(p) as deleted',
            { id: req.params.id }
        );
        const deleted = result.records[0].get('deleted').toNumber();
        if (deleted === 0) {
            return res.status(404).json({ error: 'Priority not found' });
        }
        res.json({ message: 'Priority deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/priorities/region/:region - Get priorities by region
router.get('/region/:region', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority {region: $region})
            OPTIONAL MATCH (p)-[:DERIVED_FROM]->(i:Idea)
            RETURN p, i
            ORDER BY p.createdAt DESC
        `, { region: req.params.region });
        
        const priorities = result.records.map(record => ({
            ...record.get('p').properties,
            derivedFrom: record.get('i')?.properties || null
        }));
        res.json(priorities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;

