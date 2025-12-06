/**
 * User Service
 * Business logic for user management
 */

const { getDriver, getDatabase } = require('../config/db');
const { toNumber } = require('../utils/neo4jHelpers');

/**
 * Get all users with their points and location
 */
async function getAllUsers() {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (u:User)
            OPTIONAL MATCH (u)-[:LOCATED_IN]->(loc)
            OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
            WITH u, loc, count(DISTINCT supporter) as points
            RETURN u, loc, points
            ORDER BY u.name
        `);
        
        return result.records.map(record => {
            const user = record.get('u').properties;
            const location = record.get('loc')?.properties;
            const points = toNumber(record.get('points'));
            
            return {
                ...user,
                location,
                points
            };
        });
    } finally {
        await session.close();
    }
}

/**
 * Get a single user by ID with full details
 */
async function getUserById(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (u:User {id: $userId})
            OPTIONAL MATCH (u)-[:LOCATED_IN]->(loc)
            OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
            OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(u)
            WITH u, loc, 
                 count(DISTINCT supporter) as points,
                 count(DISTINCT endorser) as endorsementCount
            RETURN u, loc, points, endorsementCount
        `, { userId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const user = record.get('u').properties;
        const location = record.get('loc')?.properties;
        
        return {
            ...user,
            location,
            points: toNumber(record.get('points')),
            endorsementCount: toNumber(record.get('endorsementCount'))
        };
    } finally {
        await session.close();
    }
}

/**
 * Update a user's location
 */
async function setUserLocation({ userId, locationId, locationType }) {
    const validTypes = ['Town', 'FederalRiding', 'ProvincialRiding', 'FirstNation', 'AdhocGroup'];
    
    if (!validTypes.includes(locationType)) {
        throw new Error(`Invalid location type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Remove existing location relationship
        await session.run(`
            MATCH (u:User {id: $userId})-[r:LOCATED_IN]->()
            DELETE r
        `, { userId });
        
        // Create new location relationship
        const result = await session.run(`
            MATCH (u:User {id: $userId}), (loc:${locationType} {id: $locationId})
            CREATE (u)-[:LOCATED_IN {createdAt: datetime()}]->(loc)
            RETURN u, loc
        `, { userId, locationId });
        
        if (result.records.length === 0) {
            throw new Error('User or location not found');
        }
        
        const location = result.records[0].get('loc').properties;
        
        return {
            success: true,
            message: 'Location updated',
            location: {
                ...location,
                type: locationType
            }
        };
    } finally {
        await session.close();
    }
}

/**
 * Remove a user's location
 */
async function removeUserLocation(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[r:LOCATED_IN]->()
            DELETE r
        `, { userId });
        
        return { success: true, message: 'Location removed' };
    } finally {
        await session.close();
    }
}

/**
 * Create an endorsement
 */
async function endorseUser({ fromUserId, toUserId, message }) {
    if (fromUserId === toUserId) {
        throw new Error('Cannot endorse yourself');
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if already endorsed
        const existing = await session.run(`
            MATCH (u1:User {id: $fromId})-[e:ENDORSED]->(u2:User {id: $toId})
            RETURN e
        `, { fromId: fromUserId, toId: toUserId });
        
        if (existing.records.length > 0) {
            throw new Error('You have already endorsed this user');
        }
        
        await session.run(`
            MATCH (u1:User {id: $fromId}), (u2:User {id: $toId})
            CREATE (u1)-[:ENDORSED {message: $message, createdAt: datetime()}]->(u2)
        `, { fromId: fromUserId, toId: toUserId, message: message || '' });
        
        return { success: true, message: 'Endorsement created' };
    } finally {
        await session.close();
    }
}

/**
 * Get endorsements for a user
 */
async function getEndorsements(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (endorser:User)-[e:ENDORSED]->(u:User {id: $userId})
            RETURN endorser, e.message as message, e.createdAt as createdAt
            ORDER BY e.createdAt DESC
        `, { userId });
        
        return result.records.map(record => ({
            endorser: record.get('endorser').properties,
            message: record.get('message'),
            createdAt: record.get('createdAt')
        }));
    } finally {
        await session.close();
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    setUserLocation,
    removeUserLocation,
    endorseUser,
    getEndorsements
};

