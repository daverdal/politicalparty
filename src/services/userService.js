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
            WITH u,
                 collect(DISTINCT {node: loc, labels: labels(loc)}) as locations,
                 count(DISTINCT supporter) as points
            RETURN u, locations, points
            ORDER BY coalesce(u.name, u.email) ASC
        `);

        return result.records.map(record => {
            const userNode = record.get('u');
            const rawLocations = record.get('locations') || [];
            const points = toNumber(record.get('points'));

            const user = userNode.properties;

            // Process locations with their types (same logic as getUserById)
            const locations = rawLocations
                .filter(loc => loc.node)
                .map(loc => {
                    const labels = loc.labels || [];
                    const type = labels.find(l =>
                        ['FederalRiding', 'ProvincialRiding', 'Town', 'FirstNation', 'AdhocGroup'].includes(l)
                    ) || 'Unknown';
                    return {
                        ...loc.node.properties,
                        type
                    };
                });

            const primaryLocation = locations[0] || null;

            return {
                ...user,
                location: primaryLocation,
                locations,
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
            OPTIONAL MATCH (nominator:User)-[:NOMINATED]->(u)
            WITH u, collect(DISTINCT {node: loc, labels: labels(loc)}) as locations,
                 count(DISTINCT supporter) as points,
                 count(DISTINCT endorser) as endorsementCount,
                 count(DISTINCT nominator) as nominationCount
            RETURN u, locations, points, endorsementCount, nominationCount
        `, { userId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const user = record.get('u').properties;
        const rawLocations = record.get('locations');
        
        // Process locations with their types
        const locations = rawLocations
            .filter(loc => loc.node)
            .map(loc => {
                const labels = loc.labels || [];
                // Find the specific location type (not generic labels)
                const type = labels.find(l => 
                    ['FederalRiding', 'ProvincialRiding', 'Town', 'FirstNation', 'AdhocGroup'].includes(l)
                ) || 'Unknown';
                return {
                    ...loc.node.properties,
                    type
                };
            });
        
        // Keep backward compatibility with single location
        const primaryLocation = locations[0] || null;
        
        return {
            ...user,
            location: primaryLocation,  // backward compat
            locations,                  // all locations
            points: toNumber(record.get('points')),
            endorsementCount: toNumber(record.get('endorsementCount')),
            nominationCount: toNumber(record.get('nominationCount'))
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
 * Set multiple locations for a user (one of each type)
 */
async function setUserLocations({ userId, locations }) {
    const validTypes = ['Town', 'FederalRiding', 'ProvincialRiding', 'FirstNation', 'AdhocGroup'];
    
    // Validate all location types
    for (const loc of locations) {
        if (!validTypes.includes(loc.type)) {
            throw new Error(`Invalid location type: ${loc.type}`);
        }
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Remove ALL existing location relationships
        await session.run(`
            MATCH (u:User {id: $userId})-[r:LOCATED_IN]->()
            DELETE r
        `, { userId });
        
        // Create new relationships for each location
        const savedLocations = [];
        
        for (const loc of locations) {
            const result = await session.run(`
                MATCH (u:User {id: $userId}), (location:${loc.type} {id: $locationId})
                CREATE (u)-[:LOCATED_IN {createdAt: datetime()}]->(location)
                RETURN location
            `, { userId, locationId: loc.id });
            
            if (result.records.length > 0) {
                const savedLoc = result.records[0].get('location').properties;
                savedLocations.push({
                    ...savedLoc,
                    type: loc.type
                });
            }
        }
        
        return {
            success: true,
            message: `Saved ${savedLocations.length} location(s)`,
            locations: savedLocations
        };
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
    setUserLocations,
    removeUserLocation,
    endorseUser,
    getEndorsements
};

