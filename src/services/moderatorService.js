/**
 * Moderator Service
 * Handles relationships between users and locations they moderate.
 */

const { getSession } = require('../config/db');

// Valid Neo4j labels we allow moderation over
const LOCATION_LABELS = new Set([
    'Country',
    'Province',
    'FederalRiding',
    'ProvincialRiding',
    'Town',
    'FirstNation',
    'AdhocGroup'
]);

function assertValidLocationType(locationType) {
    if (!LOCATION_LABELS.has(locationType)) {
        const err = new Error('Invalid location type for moderator assignment');
        err.statusCode = 400;
        throw err;
    }
}

async function assignModerator({ userId, locationId, locationType }) {
    assertValidLocationType(locationType);

    const session = getSession();
    try {
        const cypher = `
            MATCH (u:User {id: $userId}), (loc:${locationType} {id: $locationId})
            MERGE (u)-[r:MODERATES]->(loc)
            ON CREATE SET r.createdAt = datetime()
            RETURN u, loc, r
        `;

        const result = await session.run(cypher, { userId, locationId });
        if (!result.records.length) {
            const err = new Error('User or location not found');
            err.statusCode = 404;
            throw err;
        }

        return {
            userId,
            locationId,
            locationType
        };
    } finally {
        await session.close();
    }
}

async function removeModerator({ userId, locationId, locationType }) {
    assertValidLocationType(locationType);

    const session = getSession();
    try {
        const cypher = `
            MATCH (u:User {id: $userId})-[r:MODERATES]->(loc:${locationType} {id: $locationId})
            DELETE r
            RETURN count(r) as removed
        `;

        const result = await session.run(cypher, { userId, locationId });
        const removed = result.records[0].get('removed').toNumber();

        return { removed };
    } finally {
        await session.close();
    }
}

async function listModeratorsForLocation({ locationId, locationType }) {
    assertValidLocationType(locationType);

    const session = getSession();
    try {
        const cypher = `
            MATCH (u:User)-[:MODERATES]->(loc:${locationType} {id: $locationId})
            RETURN u
            ORDER BY coalesce(u.name, u.email) ASC
        `;

        const result = await session.run(cypher, { locationId });
        return result.records.map((r) => {
            const u = r.get('u').properties;
            return {
                id: u.id,
                name: u.name || u.email || 'Member',
                email: u.email || null
            };
        });
    } finally {
        await session.close();
    }
}

async function listLocationsForModerator(userId) {
    const session = getSession();
    try {
        const cypher = `
            MATCH (u:User {id: $userId})-[r:MODERATES]->(loc)
            RETURN loc, labels(loc) as labels, r
            ORDER BY loc.name
        `;

        const result = await session.run(cypher, { userId });
        return result.records.map((r) => {
            const loc = r.get('loc').properties;
            const labels = r.get('labels');
            const primaryLabel = Array.isArray(labels) && labels.length ? labels[0] : 'Location';
            return {
                id: loc.id,
                name: loc.name,
                type: primaryLabel
            };
        });
    } finally {
        await session.close();
    }
}

module.exports = {
    assignModerator,
    removeModerator,
    listModeratorsForLocation,
    listLocationsForModerator
};


