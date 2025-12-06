/**
 * Ideas Routes
 */

const express = require('express');
const router = express.Router();
const { getSession } = require('../config/db');

// GET /api/ideas - Get all ideas
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea)
            OPTIONAL MATCH (author:User)-[:POSTED]->(i)
            OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
            RETURN i, author, count(DISTINCT supporter) as supportCount
            ORDER BY i.createdAt DESC
        `);
        
        const ideas = result.records.map(record => ({
            ...record.get('i').properties,
            author: record.get('author')?.properties || null,
            supportCount: record.get('supportCount').toNumber()
        }));
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/ideas/:id - Get idea by ID
router.get('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea {id: $id})
            OPTIONAL MATCH (author:User)-[:POSTED]->(i)
            OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
            OPTIONAL MATCH (i)-[:AMENDS]->(amended:Idea)
            RETURN i, author, collect(DISTINCT supporter) as supporters, amended
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Idea not found' });
        }
        
        const record = result.records[0];
        res.json({
            ...record.get('i').properties,
            author: record.get('author')?.properties || null,
            supporters: record.get('supporters').map(s => s.properties),
            amends: record.get('amended')?.properties || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/ideas - Create a new idea
router.post('/', async (req, res) => {
    const session = getSession();
    const { id, title, description, tags, region, authorId, amendsId } = req.body;
    
    try {
        // Create the idea
        await session.run(`
            CREATE (i:Idea {
                id: $id,
                title: $title,
                description: $description,
                tags: $tags,
                region: $region,
                createdAt: datetime(),
                updatedAt: datetime()
            })
        `, { id, title, description, tags: tags || [], region });
        
        // Link to author
        if (authorId) {
            await session.run(`
                MATCH (u:User {id: $authorId}), (i:Idea {id: $ideaId})
                CREATE (u)-[:POSTED {createdAt: datetime()}]->(i)
            `, { authorId, ideaId: id });
        }
        
        // Create AMENDS relationship if applicable
        if (amendsId) {
            await session.run(`
                MATCH (i1:Idea {id: $ideaId}), (i2:Idea {id: $amendsId})
                CREATE (i1)-[:AMENDS]->(i2)
            `, { ideaId: id, amendsId });
        }
        
        const result = await session.run(
            'MATCH (i:Idea {id: $id}) RETURN i',
            { id }
        );
        res.status(201).json(result.records[0].get('i').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/ideas/:id - Update an idea
router.put('/:id', async (req, res) => {
    const session = getSession();
    const { title, description, tags, region } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (i:Idea {id: $id})
            SET i.title = $title,
                i.description = $description,
                i.tags = $tags,
                i.region = $region,
                i.updatedAt = datetime()
            RETURN i
        `, { id: req.params.id, title, description, tags: tags || [], region });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Idea not found' });
        }
        res.json(result.records[0].get('i').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/ideas/:id - Delete an idea
router.delete('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (i:Idea {id: $id}) DETACH DELETE i RETURN count(i) as deleted',
            { id: req.params.id }
        );
        const deleted = result.records[0].get('deleted').toNumber();
        if (deleted === 0) {
            return res.status(404).json({ error: 'Idea not found' });
        }
        res.json({ message: 'Idea deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/ideas/:id/support - Support an idea
router.post('/:id/support', async (req, res) => {
    const session = getSession();
    const { userId } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (u:User {id: $userId}), (i:Idea {id: $ideaId})
            MERGE (u)-[s:SUPPORTED]->(i)
            ON CREATE SET s.createdAt = datetime()
            RETURN u, i
        `, { userId, ideaId: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User or idea not found' });
        }
        res.status(201).json({ message: 'Idea supported' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/ideas/:id/support - Remove support from an idea
router.delete('/:id/support', async (req, res) => {
    const session = getSession();
    const { userId } = req.body;
    
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[s:SUPPORTED]->(i:Idea {id: $ideaId})
            DELETE s
        `, { userId, ideaId: req.params.id });
        
        res.json({ message: 'Support removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/ideas/:id/related - Get related ideas
router.get('/:id/related', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea {id: $id})-[:RELATED_TO]-(related:Idea)
            RETURN related
        `, { id: req.params.id });
        
        const related = result.records.map(record => record.get('related').properties);
        res.json(related);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/ideas/:id/relate - Create relationship between ideas
router.post('/:id/relate', async (req, res) => {
    const session = getSession();
    const { relatedIdeaId } = req.body;
    
    try {
        await session.run(`
            MATCH (i1:Idea {id: $id1}), (i2:Idea {id: $id2})
            MERGE (i1)-[:RELATED_TO]-(i2)
        `, { id1: req.params.id, id2: relatedIdeaId });
        
        res.status(201).json({ message: 'Ideas related' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;

