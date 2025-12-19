/**
 * Points Service
 * Computes local and global contribution points using Idea support relationships.
 *
 * "Support" is modeled as (supporter:User)-[:SUPPORTED]->(idea:Idea)
 * and authorship as (author:User)-[:POSTED]->(idea:Idea).
 *
 * Local points = supporters who share the same LOCATED_IN location as the author.
 * Global points = all supporters regardless of location.
 */

const { getDriver, getDatabase } = require('../config/db');
const { toNumber } = require('../utils/neo4jHelpers');

/**
 * Get local/global points summary for a single user, based on their home location.
 */
async function getUserPointsSummary(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})-[:LOCATED_IN]->(loc)
            OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
            OPTIONAL MATCH (supporter)-[:LOCATED_IN]->(sLoc)
            WITH u, loc,
                 count(DISTINCT supporter) as globalPoints,
                 count(DISTINCT CASE WHEN sLoc.id = loc.id THEN supporter END) as localPoints
            RETURN u, loc, globalPoints, localPoints
        `,
            { userId }
        );

        if (!result.records.length) {
            return null;
        }

        const record = result.records[0];
        const locNode = record.get('loc');
        const locProps = locNode.properties;
        const labels = locNode.labels || [];

        return {
            userId,
            localPoints: toNumber(record.get('localPoints')),
            globalPoints: toNumber(record.get('globalPoints')),
            location: {
                id: locProps.id,
                name: locProps.name,
                type: labels[0] || 'Location'
            }
        };
    } finally {
        await session.close();
    }
}

/**
 * Leaderboard of users for a specific location, ordered by local points.
 * locationType is a node label, e.g. 'Country', 'Province', 'FederalRiding'.
 */
async function getLocationLeaderboard({ locationId, locationType, limit = 10 }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    // Defensive check
    if (!locationId || !locationType) {
        throw new Error('locationId and locationType are required');
    }

    // Build query with dynamic label for the location
    const query = `
        MATCH (loc:${locationType} {id: $locationId})
        MATCH (u:User)-[:LOCATED_IN]->(loc)
        OPTIONAL MATCH (u)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
        OPTIONAL MATCH (supporter)-[:LOCATED_IN]->(sLoc)
        WITH u, loc,
             count(DISTINCT supporter) as globalPoints,
             count(DISTINCT CASE WHEN sLoc.id = loc.id THEN supporter END) as localPoints
        RETURN u, loc, globalPoints, localPoints
        ORDER BY localPoints DESC, globalPoints DESC, u.name
        LIMIT $limit
    `;

    const numericLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 10;

    try {
        const result = await session.run(query, {
            locationId,
            limit: numericLimit
        });

        if (!result.records.length) {
            return [];
        }

        const firstLoc = result.records[0].get('loc');
        const locProps = firstLoc.properties;
        const labels = firstLoc.labels || [];

        return {
            location: {
                id: locProps.id,
                name: locProps.name,
                type: labels[0] || locationType
            },
            users: result.records.map((r) => {
                const u = r.get('u').properties;
                return {
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    candidate: u.candidate || false,
                    localPoints: toNumber(r.get('localPoints')),
                    globalPoints: toNumber(r.get('globalPoints'))
                };
            })
        };
    } finally {
        await session.close();
    }
}

module.exports = {
    getUserPointsSummary,
    getLocationLeaderboard
};


