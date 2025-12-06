/**
 * Event Service
 * Business logic for assembly events
 */

const { getSession } = require('../config/db');

async function getAllEvents() {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (a:AssemblyEvent)
            OPTIONAL MATCH (participant:User)-[:PARTICIPATED_IN]->(a)
            RETURN a, count(DISTINCT participant) as participantCount
            ORDER BY a.startTime DESC
        `);
        
        return result.records.map(record => ({
            ...record.get('a').properties,
            participantCount: record.get('participantCount').toNumber()
        }));
    } finally {
        await session.close();
    }
}

async function getEventById(eventId) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (a:AssemblyEvent {id: $id})
            OPTIONAL MATCH (participant:User)-[:PARTICIPATED_IN]->(a)
            OPTIONAL MATCH (a)-[:HAS_VOTE]->(v:VoteSession)
            RETURN a, collect(DISTINCT participant) as participants, collect(DISTINCT v) as voteSessions
        `, { id: eventId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        return {
            ...record.get('a').properties,
            participants: record.get('participants').map(p => p.properties),
            voteSessions: record.get('voteSessions').map(v => v.properties)
        };
    } finally {
        await session.close();
    }
}

async function createEvent({ id, title, description, type, region, startTime, endTime }) {
    const session = getSession();
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
        
        return result.records[0].get('a').properties;
    } finally {
        await session.close();
    }
}

async function updateEvent(eventId, { title, description, type, region, startTime, endTime }) {
    const session = getSession();
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
        `, { id: eventId, title, description, type, region, startTime, endTime });
        
        if (result.records.length === 0) return null;
        return result.records[0].get('a').properties;
    } finally {
        await session.close();
    }
}

async function deleteEvent(eventId) {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (a:AssemblyEvent {id: $id}) DETACH DELETE a RETURN count(a) as deleted',
            { id: eventId }
        );
        return result.records[0].get('deleted').toNumber() > 0;
    } finally {
        await session.close();
    }
}

async function participateInEvent({ userId, eventId }) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (u:User {id: $userId}), (a:AssemblyEvent {id: $eventId})
            MERGE (u)-[p:PARTICIPATED_IN]->(a)
            ON CREATE SET p.createdAt = datetime()
            RETURN u, a
        `, { userId, eventId });
        
        return result.records.length > 0;
    } finally {
        await session.close();
    }
}

async function leaveEvent({ userId, eventId }) {
    const session = getSession();
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[p:PARTICIPATED_IN]->(a:AssemblyEvent {id: $eventId})
            DELETE p
        `, { userId, eventId });
        return true;
    } finally {
        await session.close();
    }
}

module.exports = {
    getAllEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    participateInEvent,
    leaveEvent
};

