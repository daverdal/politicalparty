/**
 * Vote Service
 * Business logic for vote sessions and results
 */

const { getSession } = require('../config/db');

async function getAllVoteSessions() {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (v:VoteSession)
            OPTIONAL MATCH (a:AssemblyEvent)-[:HAS_VOTE]->(v)
            OPTIONAL MATCH (v)-[:HAS_RESULT]->(r:VoteResult)
            RETURN v, a, r
            ORDER BY v.createdAt DESC
        `);
        
        return result.records.map(record => ({
            ...record.get('v').properties,
            event: record.get('a')?.properties || null,
            result: record.get('r')?.properties || null
        }));
    } finally {
        await session.close();
    }
}

async function getVoteSessionById(voteId) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (v:VoteSession {id: $id})
            OPTIONAL MATCH (a:AssemblyEvent)-[:HAS_VOTE]->(v)
            OPTIONAL MATCH (v)-[:HAS_RESULT]->(r:VoteResult)
            RETURN v, a, r
        `, { id: voteId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const voteResult = record.get('r')?.properties || null;
        
        return {
            ...record.get('v').properties,
            event: record.get('a')?.properties || null,
            result: voteResult ? {
                ...voteResult,
                resultData: JSON.parse(voteResult.resultData || '{}')
            } : null
        };
    } finally {
        await session.close();
    }
}

async function createVoteSession({ id, question, type, eventId }) {
    const session = getSession();
    try {
        await session.run(`
            CREATE (v:VoteSession {
                id: $id,
                question: $question,
                type: $type,
                createdAt: datetime()
            })
        `, { id, question, type });
        
        if (eventId) {
            await session.run(`
                MATCH (a:AssemblyEvent {id: $eventId}), (v:VoteSession {id: $voteId})
                CREATE (a)-[:HAS_VOTE]->(v)
            `, { eventId, voteId: id });
        }
        
        const result = await session.run('MATCH (v:VoteSession {id: $id}) RETURN v', { id });
        return result.records[0].get('v').properties;
    } finally {
        await session.close();
    }
}

async function updateVoteSession(voteId, { question, type }) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (v:VoteSession {id: $id})
            SET v.question = $question,
                v.type = $type
            RETURN v
        `, { id: voteId, question, type });
        
        if (result.records.length === 0) return null;
        return result.records[0].get('v').properties;
    } finally {
        await session.close();
    }
}

async function deleteVoteSession(voteId) {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (v:VoteSession {id: $id}) DETACH DELETE v RETURN count(v) as deleted',
            { id: voteId }
        );
        return result.records[0].get('deleted').toNumber() > 0;
    } finally {
        await session.close();
    }
}

async function addVoteResult(voteId, { resultId, resultData }) {
    const session = getSession();
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
        `, { voteId, resultId });
        
        return { resultId };
    } finally {
        await session.close();
    }
}

module.exports = {
    getAllVoteSessions,
    getVoteSessionById,
    createVoteSession,
    updateVoteSession,
    deleteVoteSession,
    addVoteResult
};

