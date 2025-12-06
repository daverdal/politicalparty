/**
 * Vote Sessions & Results Routes
 */

const express = require('express');
const router = express.Router();
const { getSession } = require('../config/db');

// GET /api/votes - Get all vote sessions
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (v:VoteSession)
            OPTIONAL MATCH (a:AssemblyEvent)-[:HAS_VOTE]->(v)
            OPTIONAL MATCH (v)-[:HAS_RESULT]->(r:VoteResult)
            RETURN v, a, r
            ORDER BY v.createdAt DESC
        `);
        
        const votes = result.records.map(record => ({
            ...record.get('v').properties,
            event: record.get('a')?.properties || null,
            result: record.get('r')?.properties || null
        }));
        res.json(votes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/votes/:id - Get vote session by ID
router.get('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (v:VoteSession {id: $id})
            OPTIONAL MATCH (a:AssemblyEvent)-[:HAS_VOTE]->(v)
            OPTIONAL MATCH (v)-[:HAS_RESULT]->(r:VoteResult)
            RETURN v, a, r
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Vote session not found' });
        }
        
        const record = result.records[0];
        const voteResult = record.get('r')?.properties || null;
        
        res.json({
            ...record.get('v').properties,
            event: record.get('a')?.properties || null,
            result: voteResult ? {
                ...voteResult,
                resultData: JSON.parse(voteResult.resultData || '{}')
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/votes - Create a new vote session
router.post('/', async (req, res) => {
    const session = getSession();
    const { id, question, type, eventId } = req.body;
    
    try {
        await session.run(`
            CREATE (v:VoteSession {
                id: $id,
                question: $question,
                type: $type,
                createdAt: datetime()
            })
        `, { id, question, type });
        
        // Link to event if provided
        if (eventId) {
            await session.run(`
                MATCH (a:AssemblyEvent {id: $eventId}), (v:VoteSession {id: $voteId})
                CREATE (a)-[:HAS_VOTE]->(v)
            `, { eventId, voteId: id });
        }
        
        const result = await session.run(
            'MATCH (v:VoteSession {id: $id}) RETURN v',
            { id }
        );
        res.status(201).json(result.records[0].get('v').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/votes/:id - Update a vote session
router.put('/:id', async (req, res) => {
    const session = getSession();
    const { question, type } = req.body;
    
    try {
        const result = await session.run(`
            MATCH (v:VoteSession {id: $id})
            SET v.question = $question,
                v.type = $type
            RETURN v
        `, { id: req.params.id, question, type });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Vote session not found' });
        }
        res.json(result.records[0].get('v').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/votes/:id - Delete a vote session
router.delete('/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (v:VoteSession {id: $id}) DETACH DELETE v RETURN count(v) as deleted',
            { id: req.params.id }
        );
        const deleted = result.records[0].get('deleted').toNumber();
        if (deleted === 0) {
            return res.status(404).json({ error: 'Vote session not found' });
        }
        res.json({ message: 'Vote session deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/votes/:id/result - Add result to a vote session
router.post('/:id/result', async (req, res) => {
    const session = getSession();
    const { resultId, resultData } = req.body;
    
    try {
        await session.run(`
            CREATE (r:VoteResult {
                id: $resultId,
                resultData: $resultData,
                createdAt: datetime()
            })
        `, { resultId, resultData: JSON.stringify(resultData) });
        
        await session.run(`
            MATCH (v:VoteSession {id: $voteId}), (r:VoteResult {id: $resultId})
            CREATE (v)-[:HAS_RESULT]->(r)
        `, { voteId: req.params.id, resultId });
        
        res.status(201).json({ message: 'Result recorded', resultId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;

