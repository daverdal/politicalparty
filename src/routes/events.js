/**
 * Assembly Events Routes
 */

const express = require('express');
const router = express.Router();
const { getSession } = require('../config/db');

// GET /api/events - Get all events
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (a:AssemblyEvent)
            OPTIONAL MATCH (participant:User)-[:PARTICIPATED_IN]->(a)
            RETURN a, count(DISTINCT participant) as participantCount
            ORDER BY a.startTime DESC
        `);
        
        const events = result.records.map(record => ({
            ...record.get('a').properties,
            participantCount: record.get('participantCount').toNumber()
        }));
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (a:AssemblyEvent {id: $id})
            OPTIONAL MATCH (participant:User)-[:PARTICIPATED_IN]->(a)
            OPTIONAL MATCH (a)-[:HAS_VOTE]->(v:VoteSession)
            RETURN a, collect(DISTINCT participant) as participants, collect(DISTINCT v) as voteSessions
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        
        const record = result.records[0];
        res.json({
            ...record.get('a').properties,
            participants: record.get('participants').map(p => p.properties),
            voteSessions: record.get('voteSessions').map(v => v.properties)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/events - Create a new event
router.post('/', async (req, res) => {
    const session = getSession();
    const { id, title, description, type, region, startTime, endTime } = req.body;
    
    try {
        const result = await session.run(`
            CREATE (a:AssemblyEvent {
                id: $id,
                title: $title,
                description: $description,
                type: $type,
                region: $region,
                startTime: datetime($startTime),
                endTime: datetime($endTime),
                createdAt: datetime()
            })
            RETURN a
        `, { id, title, description, type, region, startTime, endTime });
        
        res.status(201).json(result.records[0].get('a').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/events/:id - Update an event
router.put('/:id', async (req, res) => {
    const session = getSession();
    const { title, description, type, region, startTime, endTime } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (a:AssemblyEvent {id: $id})
            SET a.title = $title,
                a.description = $description,
                a.type = $type,
                a.region = $region,
                a.startTime = datetime($startTime),
                a.endTime = datetime($endTime)
            RETURN a
        `, { id: req.params.id, title, description, type, region, startTime, endTime });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(result.records[0].get('a').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/events/:id - Delete an event
router.delete('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (a:AssemblyEvent {id: $id}) DETACH DELETE a RETURN count(a) as deleted',
            { id: req.params.id }
        );
        const deleted = result.records[0].get('deleted').toNumber();
        if (deleted === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/events/:id/participate - Join an event
router.post('/:id/participate', async (req, res) => {
    const session = getSession();
    const { userId } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (u:User {id: $userId}), (a:AssemblyEvent {id: $eventId})
            MERGE (u)-[p:PARTICIPATED_IN]->(a)
            ON CREATE SET p.createdAt = datetime()
            RETURN u, a
        `, { userId, eventId: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User or event not found' });
        }
        res.status(201).json({ message: 'Participation recorded' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/events/:id/participate - Leave an event
router.delete('/:id/participate', async (req, res) => {
    const session = getSession();
    const { userId } = req.body;
    
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[p:PARTICIPATED_IN]->(a:AssemblyEvent {id: $eventId})
            DELETE p
        `, { userId, eventId: req.params.id });
        
        res.json({ message: 'Participation removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;

