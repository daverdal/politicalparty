/**
 * Location Service
 * Business logic for location hierarchy (countries, provinces, ridings, etc.)
 */

const { getDriver, getDatabase } = require('../config/db');
const { toNumber } = require('../utils/neo4jHelpers');

/**
 * Get all countries
 */
async function getAllCountries() {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Country)
            OPTIONAL MATCH (c)-[:HAS_PROVINCE]->(p:Province)
            WITH c, count(p) as provinceCount
            RETURN c, provinceCount
            ORDER BY c.name
        `);
        
        return result.records.map(record => ({
            ...record.get('c').properties,
            provinceCount: toNumber(record.get('provinceCount'))
        }));
    } finally {
        await session.close();
    }
}

/**
 * Get all provinces
 */
async function getAllProvinces() {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (p:Province)
            RETURN p
            ORDER BY p.name
        `);
        
        return result.records.map(record => record.get('p').properties);
    } finally {
        await session.close();
    }
}

/**
 * Get provinces for a country
 */
async function getProvincesForCountry(countryId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Country {id: $countryId})-[:HAS_PROVINCE]->(p:Province)
            RETURN p
            ORDER BY p.name
        `, { countryId });
        
        return result.records.map(record => record.get('p').properties);
    } finally {
        await session.close();
    }
}

/**
 * Get a province with all its locations
 */
async function getProvinceById(provinceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})
            OPTIONAL MATCH (p)-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            OPTIONAL MATCH (p)-[:HAS_PROVINCIAL_RIDING]->(pr:ProvincialRiding)
            OPTIONAL MATCH (p)-[:HAS_TOWN]->(t:Town)
            OPTIONAL MATCH (p)-[:HAS_FIRST_NATION]->(fn:FirstNation)
            OPTIONAL MATCH (p)-[:HAS_ADHOC_GROUP]->(ag:AdhocGroup)
            RETURN p,
                collect(DISTINCT fr) as federalRidings,
                collect(DISTINCT pr) as provincialRidings,
                collect(DISTINCT t) as towns,
                collect(DISTINCT fn) as firstNations,
                collect(DISTINCT ag) as adhocGroups
        `, { provinceId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const province = record.get('p').properties;
        
        return {
            ...province,
            federalRidings: record.get('federalRidings').filter(n => n).map(n => n.properties),
            provincialRidings: record.get('provincialRidings').filter(n => n).map(n => n.properties),
            towns: record.get('towns').filter(n => n).map(n => n.properties),
            firstNations: record.get('firstNations').filter(n => n).map(n => n.properties),
            adhocGroups: record.get('adhocGroups').filter(n => n).map(n => n.properties)
        };
    } finally {
        await session.close();
    }
}

/**
 * Get all ridings for a province (federal, provincial, first nations combined)
 */
async function getRidingsForProvince(provinceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})
            OPTIONAL MATCH (p)-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            OPTIONAL MATCH (p)-[:HAS_PROVINCIAL_RIDING]->(pr:ProvincialRiding)
            OPTIONAL MATCH (p)-[:HAS_FIRST_NATION]->(fn:FirstNation)
            WITH p,
                 collect(DISTINCT {id: fr.id, name: fr.name, type: 'FederalRiding'}) as federal,
                 collect(DISTINCT {id: pr.id, name: pr.name, type: 'ProvincialRiding'}) as provincial,
                 collect(DISTINCT {id: fn.id, name: fn.name, type: 'FirstNation'}) as firstNations
            RETURN federal, provincial, firstNations
        `, { provinceId });
        
        if (result.records.length === 0) return [];
        
        const record = result.records[0];
        const federal = record.get('federal').filter(r => r.id);
        const provincial = record.get('provincial').filter(r => r.id);
        const firstNations = record.get('firstNations').filter(r => r.id);
        
        // Combine and sort all ridings with category labels
        return [
            ...federal.map(r => ({ ...r, category: '🗳️ Federal' })),
            ...provincial.map(r => ({ ...r, category: '📋 Provincial' })),
            ...firstNations.map(r => ({ ...r, category: '🪶 First Nation' }))
        ].sort((a, b) => a.name.localeCompare(b.name));
    } finally {
        await session.close();
    }
}

/**
 * Get federal ridings for a province
 */
async function getFederalRidings(provinceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            RETURN fr
            ORDER BY fr.name
        `, { provinceId });
        
        return result.records.map(record => record.get('fr').properties);
    } finally {
        await session.close();
    }
}

/**
 * Get ideas for a location (with hierarchy bubbling)
 * Optionally limit the number of returned ideas (already sorted by supportCount DESC).
 */
async function getIdeasForLocation({ locationId, locationType, limit }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        let query;
        
        // Different queries based on location type for hierarchy bubbling
        if (locationType === 'Country') {
            query = `
                MATCH (c:Country {id: $locationId})-[:HAS_PROVINCE]->(prov:Province)-[]->(childLoc)<-[:LOCATED_IN]-(u:User)
                MATCH (u)-[:POSTED]->(idea:Idea)
                OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(idea)
                WITH idea, u, count(DISTINCT supporter) as supportCount
                RETURN DISTINCT idea, u as author, supportCount
                ORDER BY supportCount DESC
            `;
        } else if (locationType === 'Province') {
            query = `
                MATCH (prov:Province {id: $locationId})-[]->(childLoc)<-[:LOCATED_IN]-(u:User)
                MATCH (u)-[:POSTED]->(idea:Idea)
                OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(idea)
                WITH idea, u, count(DISTINCT supporter) as supportCount
                RETURN DISTINCT idea, u as author, supportCount
                ORDER BY supportCount DESC
            `;
        } else {
            // Leaf node - direct match
            query = `
                MATCH (loc:${locationType} {id: $locationId})<-[:LOCATED_IN]-(u:User)
                MATCH (u)-[:POSTED]->(idea:Idea)
                OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(idea)
                WITH idea, u, count(DISTINCT supporter) as supportCount
                RETURN idea, u as author, supportCount
                ORDER BY supportCount DESC
            `;
        }

        // Apply a LIMIT (e.g. for "top 10 ideas") if requested
        if (limit && Number.isFinite(limit)) {
            query += `\nLIMIT $limit`;
        }
        
        const params = { locationId };
        if (limit && Number.isFinite(limit)) {
            params.limit = Math.max(1, Math.floor(limit));
        }

        const result = await session.run(query, params);
        
        return result.records.map(record => ({
            ...record.get('idea').properties,
            author: record.get('author').properties,
            supportCount: toNumber(record.get('supportCount'))
        }));
    } finally {
        await session.close();
    }
}

/**
 * Get candidates for a location (with hierarchy bubbling)
 */
async function getCandidatesForLocation({ locationId, locationType }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        let query;

        if (locationType === 'Country') {
            query = `
                MATCH (c:Country {id: $locationId})-[:HAS_PROVINCE]->(prov:Province)-[]->(childLoc)<-[:LOCATED_IN]-(candidate:User {candidate: true})
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(candidate)
                OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
                WITH DISTINCT candidate, childLoc,
                     count(DISTINCT endorser) as endorsementCount,
                     count(DISTINCT supporter) as ideaPoints,
                     coalesce(candidate.strategicPoints, 0) as strategicPoints
                WITH candidate, childLoc as location, endorsementCount,
                     ideaPoints + strategicPoints as points
                RETURN candidate, location, endorsementCount, points
                ORDER BY points DESC
            `;
        } else if (locationType === 'Province') {
            query = `
                MATCH (prov:Province {id: $locationId})-[]->(childLoc)<-[:LOCATED_IN]-(candidate:User {candidate: true})
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(candidate)
                OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
                WITH DISTINCT candidate, childLoc,
                     count(DISTINCT endorser) as endorsementCount,
                     count(DISTINCT supporter) as ideaPoints,
                     coalesce(candidate.strategicPoints, 0) as strategicPoints
                WITH candidate, childLoc as location, endorsementCount,
                     ideaPoints + strategicPoints as points
                RETURN candidate, location, endorsementCount, points
                ORDER BY points DESC
            `;
        } else {
            query = `
                MATCH (loc:${locationType} {id: $locationId})<-[:LOCATED_IN]-(candidate:User {candidate: true})
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(candidate)
                OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
                WITH candidate, loc,
                     count(DISTINCT endorser) as endorsementCount,
                     count(DISTINCT supporter) as ideaPoints,
                     coalesce(candidate.strategicPoints, 0) as strategicPoints
                WITH candidate, loc as location, endorsementCount,
                     ideaPoints + strategicPoints as points
                RETURN candidate, location, endorsementCount, points
                ORDER BY points DESC
            `;
        }

        const result = await session.run(query, { locationId });

        return result.records.map(record => ({
            ...record.get('candidate').properties,
            location: record.get('location')?.properties,
            endorsementCount: toNumber(record.get('endorsementCount')),
            points: toNumber(record.get('points'))
        }));
    } finally {
        await session.close();
    }
}

/**
 * Get all users/members for a location (with hierarchy bubbling)
 */
async function getUsersForLocation({ locationId, locationType }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        let query;
        
        if (locationType === 'Country') {
            query = `
                MATCH (c:Country {id: $locationId})-[:HAS_PROVINCE]->(prov:Province)-[]->(childLoc)<-[:LOCATED_IN]-(user:User)
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(user)
                WITH DISTINCT user, childLoc,
                     count(DISTINCT endorser) as endorsementCount
                RETURN user, childLoc as location, endorsementCount
                ORDER BY user.name
            `;
        } else if (locationType === 'Province') {
            query = `
                MATCH (prov:Province {id: $locationId})-[]->(childLoc)<-[:LOCATED_IN]-(user:User)
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(user)
                WITH DISTINCT user, childLoc,
                     count(DISTINCT endorser) as endorsementCount
                RETURN user, childLoc as location, endorsementCount
                ORDER BY user.name
            `;
        } else {
            query = `
                MATCH (loc:${locationType} {id: $locationId})<-[:LOCATED_IN]-(user:User)
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(user)
                WITH user, loc,
                     count(DISTINCT endorser) as endorsementCount
                RETURN user, loc as location, endorsementCount
                ORDER BY user.name
            `;
        }
        
        const result = await session.run(query, { locationId });
        
        return result.records.map(record => ({
            ...record.get('user').properties,
            location: record.get('location')?.properties,
            endorsementCount: toNumber(record.get('endorsementCount'))
        }));
    } finally {
        await session.close();
    }
}

/**
 * Get events for a location (with hierarchy bubbling)
 */
async function getEventsForLocation({ locationId, locationType }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        let query;
        
        if (locationType === 'Country') {
            // Get all events in the country (match by region containing province names or 'All')
            query = `
                MATCH (c:Country {id: $locationId})-[:HAS_PROVINCE]->(prov:Province)
                WITH collect(prov.name) as provinceNames
                MATCH (event:AssemblyEvent)
                WHERE event.region IN provinceNames OR event.region = 'All' OR event.region = $locationId
                OPTIONAL MATCH (participant:User)-[:PARTICIPATES_IN]->(event)
                WITH event, count(DISTINCT participant) as participantCount
                RETURN event, participantCount
                ORDER BY event.startTime DESC
            `;
        } else if (locationType === 'Province') {
            // Get events for this province
            query = `
                MATCH (prov:Province {id: $locationId})
                WITH prov.name as provinceName
                MATCH (event:AssemblyEvent)
                WHERE event.region = provinceName OR event.region = 'All'
                OPTIONAL MATCH (participant:User)-[:PARTICIPATES_IN]->(event)
                WITH event, count(DISTINCT participant) as participantCount
                RETURN event, participantCount
                ORDER BY event.startTime DESC
            `;
        } else {
            // Leaf locations - match by region name or get events linked to users in this location
            query = `
                MATCH (loc:${locationType} {id: $locationId})
                WITH loc.name as locationName
                OPTIONAL MATCH (event:AssemblyEvent)
                WHERE event.region = locationName OR event.region = 'All'
                OPTIONAL MATCH (participant:User)-[:PARTICIPATES_IN]->(event)
                WITH event, count(DISTINCT participant) as participantCount
                WHERE event IS NOT NULL
                RETURN event, participantCount
                ORDER BY event.startTime DESC
            `;
        }
        
        const result = await session.run(query, { locationId });
        
        return result.records
            .filter(record => record.get('event') !== null)
            .map(record => ({
                ...record.get('event').properties,
                participantCount: toNumber(record.get('participantCount'))
            }));
    } finally {
        await session.close();
    }
}

module.exports = {
    getAllCountries,
    getAllProvinces,
    getProvincesForCountry,
    getProvinceById,
    getRidingsForProvince,
    getFederalRidings,
    getIdeasForLocation,
    getCandidatesForLocation,
    getUsersForLocation,
    getEventsForLocation
};

