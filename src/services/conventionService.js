/**
 * Convention Service
 * Business logic for conventions, nominations, races, and voting
 */

const { getDriver, getDatabase } = require('../config/db');
const { toISODate, toNumber } = require('../utils/neo4jHelpers');

// Convention wave definitions - West to East
const WAVES = [
    { wave: 1, name: 'Pacific', provinces: ['BC', 'YT'], color: '#00d4aa' },
    { wave: 2, name: 'Mountain', provinces: ['AB', 'NT'], color: '#00c4ff' },
    { wave: 3, name: 'Prairie', provinces: ['SK', 'MB', 'NU'], color: '#ffb347' },
    { wave: 4, name: 'Central', provinces: ['ON'], color: '#ff6b6b' },
    { wave: 5, name: 'Quebec', provinces: ['QC'], color: '#a855f7' },
    { wave: 6, name: 'Atlantic', provinces: ['NB', 'NS', 'PE', 'NL'], color: '#3b82f6' }
];

const WAVE_PROVINCES = {
    1: ['BC', 'YT'],
    2: ['AB', 'NT'],
    3: ['SK', 'MB', 'NU'],
    4: ['ON'],
    5: ['QC'],
    6: ['NB', 'NS', 'PE', 'NL']
};

const WAVE_NAMES = {
    1: 'Pacific (BC, Yukon)',
    2: 'Mountain (Alberta, NWT)',
    3: 'Prairie (SK, MB, Nunavut)',
    4: 'Central (Ontario)',
    5: 'Quebec',
    6: 'Atlantic (NB, NS, PE, NL)'
};

/**
 * Serialize convention properties from Neo4j to JSON-safe format
 */
function serializeConvention(props) {
    const serialized = { ...props };
    
    // Convert wave dates
    for (let i = 1; i <= 6; i++) {
        ['NominationStart', 'NominationEnd', 'VotingStart', 'VotingEnd'].forEach(suffix => {
            const key = `wave${i}${suffix}`;
            if (serialized[key]) {
                serialized[key] = toISODate(serialized[key]);
            }
        });
    }
    
    // Convert other dates
    ['startDate', 'endDate', 'createdAt'].forEach(key => {
        if (serialized[key]) {
            serialized[key] = toISODate(serialized[key]);
        }
    });
    
    // Convert integers
    ['year', 'currentWave'].forEach(key => {
        if (serialized[key]) {
            serialized[key] = toNumber(serialized[key]);
        }
    });
    
    return serialized;
}

/**
 * Get all conventions
 */
async function getAllConventions() {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention)
            OPTIONAL MATCH (c)-[:HAS_RACE]->(race:NominationRace)
            WITH c, count(race) as raceCount
            RETURN c, raceCount
            ORDER BY c.year DESC
        `);
        
        return result.records.map(record => ({
            ...serializeConvention(record.get('c').properties),
            raceCount: toNumber(record.get('raceCount'))
        }));
    } finally {
        await session.close();
    }
}

/**
 * Get a single convention by ID with details
 */
async function getConventionById(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})
            OPTIONAL MATCH (c)-[:FOR_COUNTRY]->(country:Country)
            OPTIONAL MATCH (c)-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WITH c, country, race, riding, count(candidate) as candidateCount
            RETURN c, country,
                   collect({
                       race: race,
                       riding: riding,
                       candidateCount: candidateCount
                   }) as races
        `, { convId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const convention = serializeConvention(record.get('c').properties);
        const country = record.get('country')?.properties;
        const racesData = record.get('races');
        
        return {
            ...convention,
            country,
            races: racesData
                .filter(r => r.race)
                .map(r => ({
                    ...r.race.properties,
                    riding: r.riding?.properties,
                    candidateCount: toNumber(r.candidateCount)
                }))
        };
    } finally {
        await session.close();
    }
}

/**
 * Get races for a convention (filtered by current wave)
 */
async function getRacesForConvention(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // First get the current wave from the convention
        const convResult = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c.currentWave as currentWave
        `, { convId });
        
        const currentWave = toNumber(convResult.records[0]?.get('currentWave')) || 0;
        
        // Only return races for the current wave
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            WHERE race.wave = $currentWave
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WITH race, riding, province, collect(candidate) as candidates
            RETURN race, riding, province.name as provinceName, 
                   size(candidates) as candidateCount,
                   [c in candidates | {id: c.id, name: c.name}] as candidateList
            ORDER BY province.name, riding.name
        `, { convId, currentWave });
        
        return result.records.map(record => ({
            ...record.get('race').properties,
            riding: record.get('riding').properties,
            provinceName: record.get('provinceName'),
            candidateCount: toNumber(record.get('candidateCount')),
            candidates: record.get('candidateList')
        }));
    } finally {
        await session.close();
    }
}

/**
 * Get a single race with full candidate details
 */
async function getRaceById(raceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (race:NominationRace {id: $raceId})-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (race)<-[:HAS_RACE]-(conv:Convention)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            OPTIONAL MATCH (candidate:User)-[r:RUNNING_IN]->(race)
            OPTIONAL MATCH (candidate)<-[:ENDORSED]-(endorser:User)
            OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
            WITH race, riding, conv, province, candidate, r,
                 count(DISTINCT endorser) as endorsementCount,
                 count(DISTINCT supporter) as ideaPoints,
                 coalesce(candidate.strategicPoints, 0) as strategicPoints
            WITH race, riding, conv, province, candidate, r,
                 endorsementCount,
                 ideaPoints + strategicPoints as points
            ORDER BY points DESC, endorsementCount DESC
            WITH race, riding, conv, province, 
                 collect({
                     candidate: candidate,
                     nominatedAt: r.nominatedAt,
                     endorsementCount: endorsementCount,
                     points: points
                 }) as candidates
            RETURN race, riding, conv, province, candidates
        `, { raceId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const race = record.get('race').properties;
        const riding = record.get('riding').properties;
        const convention = record.get('conv')?.properties;
        const province = record.get('province')?.properties;
        const candidatesData = record.get('candidates');
        
        const candidates = candidatesData
            .filter(c => c.candidate)
            .map(c => ({
                ...c.candidate.properties,
                nominatedAt: toISODate(c.nominatedAt),
                endorsementCount: toNumber(c.endorsementCount),
                points: toNumber(c.points)
            }));
        
        return {
            ...race,
            riding,
            convention: convention ? serializeConvention(convention) : null,
            province,
            candidates
        };
    } finally {
        await session.close();
    }
}

/**
 * Create a nomination (one user nominates another)
 * 
 * NOMINATION RULES:
 * - Nominations are PERMANENT and never expire
 * - They are NOT tied to any specific convention
 * - They are informational for voters (who supports whom)
 * - Users do NOT need nominations to run - anyone can declare candidacy
 * - Nominations accumulate over time (lifetime count)
 */
async function createNomination({ nominatorId, nomineeId, message }) {
    if (nominatorId === nomineeId) {
        throw new Error('You cannot nominate yourself!');
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get nominee's location (nominations are tied to where they live)
        const nomineeLocation = await session.run(`
            MATCH (u:User {id: $nomineeId})-[:LOCATED_IN]->(loc)
            RETURN u.name as nomineeName, loc.id as locationId, loc.name as locationName, labels(loc)[0] as locationType
        `, { nomineeId });
        
        if (nomineeLocation.records.length === 0) {
            throw new Error('This user has not set their riding. They must set their location in their Profile first.');
        }
        
        const nomineeName = nomineeLocation.records[0].get('nomineeName');
        const ridingId = nomineeLocation.records[0].get('locationId');
        const ridingName = nomineeLocation.records[0].get('locationName');
        
        // Check if this person has already nominated this user (ever)
        const existingNom = await session.run(`
            MATCH (nominator:User {id: $nominatorId})-[n:NOMINATED]->(nominee:User {id: $nomineeId})
            RETURN n
        `, { nominatorId, nomineeId });
        
        if (existingNom.records.length > 0) {
            throw new Error(`You have already nominated ${nomineeName}. Nominations are permanent!`);
        }
        
        // Create the permanent nomination
        await session.run(`
            MATCH (nominator:User {id: $nominatorId}), (nominee:User {id: $nomineeId})
            CREATE (nominator)-[:NOMINATED {
                ridingId: $ridingId,
                message: $message,
                createdAt: datetime()
            }]->(nominee)
        `, { nominatorId, nomineeId, ridingId, message: message || '' });
        
        // Get total lifetime nomination count for this user
        const countResult = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED]->(nominee:User {id: $nomineeId})
            RETURN count(n) as nominationCount
        `, { nomineeId });
        
        const nominationCount = toNumber(countResult.records[0].get('nominationCount'));
        
        return {
            success: true,
            nominationCount,
            ridingName,
            message: `Successfully nominated ${nomineeName}! They now have ${nominationCount} lifetime nomination(s).`
        };
    } finally {
        await session.close();
    }
}

/**
 * Declare candidacy (user decides to run in a specific riding/location)
 * No nominations required - anyone can run!
 *
 * If locationId is provided, the user will run in that exact location,
 * as long as they have LOCATED_IN to it. Otherwise, we fall back to the
 * first LOCATED_IN location (backward compatibility).
 */
async function declareCandidacy({ userId, convId, locationId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check convention exists and is active
        const convCheck = await session.run(`
            MATCH (c:Convention {id: $convId})
            WHERE c.status <> 'completed'
            RETURN c.currentWave as currentWave
        `, { convId });
        
        if (convCheck.records.length === 0) {
            throw new Error('No active convention found.');
        }
        
        // Get user's location
        let userLocation;
        if (locationId) {
            // Use the specific location the user chose (must already be LOCATED_IN)
            userLocation = await session.run(
                `
                MATCH (u:User {id: $userId})-[:LOCATED_IN]->(loc {id: $locationId})
                RETURN u.name as userName,
                       loc.id as locationId,
                       loc.name as locationName,
                       labels(loc)[0] as locationType
                `,
                { userId, locationId }
            );
        } else {
            // Backward compat: use the first LOCATED_IN location
            userLocation = await session.run(
                `
                MATCH (u:User {id: $userId})-[:LOCATED_IN]->(loc)
                RETURN u.name as userName,
                       loc.id as locationId,
                       loc.name as locationName,
                       labels(loc)[0] as locationType
                `,
                { userId }
            );
        }
        
        if (userLocation.records.length === 0) {
            if (locationId) {
                throw new Error('You must set this riding in your Profile before you can run.');
            }
            throw new Error('You must set your riding in your Profile before you can run.');
        }

        const userName = userLocation.records[0].get('userName');
        const ridingId = userLocation.records[0].get('locationId');
        const ridingName = userLocation.records[0].get('locationName');
        const locationType = userLocation.records[0].get('locationType');

        // Ensure the chosen location is a valid type for running
        const allowedTypes = ['FederalRiding', 'ProvincialRiding', 'Town', 'FirstNation'];
        if (!allowedTypes.includes(locationType)) {
            throw new Error('You can only run in a federal riding, provincial riding, town, or First Nation.');
        }
        
        // Check if already running in this convention
        const existingRace = await session.run(`
            MATCH (u:User {id: $userId})-[:RUNNING_IN]->(race:NominationRace)<-[:HAS_RACE]-(c:Convention {id: $convId})
            RETURN race
        `, { userId, convId });
        
        if (existingRace.records.length > 0) {
            throw new Error('You are already running in this convention.');
        }
        
        // Create the race if it doesn't exist
        const raceId = `race-${convId.replace('conv-', '')}-${ridingId}`;
        
        await session.run(`
            MERGE (race:NominationRace {id: $raceId})
            ON CREATE SET race.status = 'open', race.currentRound = 0, race.createdAt = datetime()
            WITH race
            MATCH (conv:Convention {id: $convId})
            MERGE (conv)-[:HAS_RACE]->(race)
            WITH race
            MATCH (riding {id: $ridingId})
            MERGE (race)-[:FOR_RIDING]->(riding)
        `, { raceId, convId, ridingId });
        
        // Add user to the race
        await session.run(`
            MATCH (u:User {id: $userId}), (race:NominationRace {id: $raceId})
            MERGE (u)-[:RUNNING_IN]->(race)
            SET u.candidate = true
        `, { userId, raceId });
        
        // Get nomination count
        const nomCount = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED]->(u:User {id: $userId})
            RETURN count(n) as count
        `, { userId });
        
        const nominationCount = toNumber(nomCount.records[0]?.get('count') || 0);
        
        return {
            success: true,
            raceId,
            ridingName,
            nominationCount,
            message: `${userName} is now running in ${ridingName}! You have ${nominationCount} nomination(s) supporting you.`
        };
    } finally {
        await session.close();
    }
}

/**
 * Get a user's nomination history (who nominated them and who they nominated)
 */
async function getUserNominations(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get nominations received
        const receivedResult = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED]->(u:User {id: $userId})
            RETURN nominator.id as nominatorId, nominator.name as nominatorName,
                   n.message as message, n.createdAt as createdAt, n.ridingId as ridingId
            ORDER BY n.createdAt DESC
        `, { userId });
        
        // Get nominations given
        const givenResult = await session.run(`
            MATCH (u:User {id: $userId})-[n:NOMINATED]->(nominee:User)
            RETURN nominee.id as nomineeId, nominee.name as nomineeName,
                   n.message as message, n.createdAt as createdAt, n.ridingId as ridingId
            ORDER BY n.createdAt DESC
        `, { userId });
        
        return {
            received: receivedResult.records.map(r => ({
                nominatorId: r.get('nominatorId'),
                nominatorName: r.get('nominatorName'),
                message: r.get('message'),
                createdAt: toISODate(r.get('createdAt')),
                ridingId: r.get('ridingId')
            })),
            given: givenResult.records.map(r => ({
                nomineeId: r.get('nomineeId'),
                nomineeName: r.get('nomineeName'),
                message: r.get('message'),
                createdAt: toISODate(r.get('createdAt')),
                ridingId: r.get('ridingId')
            })),
            receivedCount: receivedResult.records.length,
            givenCount: givenResult.records.length
        };
    } finally {
        await session.close();
    }
}

/**
 * Accept a nomination / Enter a race (legacy support - redirects to declareCandidacy)
 * NOTE: With the new system, users don't need to "accept" nominations.
 * They simply declare candidacy. Nominations are informational only.
 */
async function acceptNomination({ userId, raceId, convId }) {
    // Get the riding from the raceId and call declareCandidacy
    return await declareCandidacy({ userId, convId });
}

/**
 * Withdraw from a race
 */
async function withdrawFromRace({ userId, raceId, convId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[r:RUNNING_IN]->(race:NominationRace {id: $raceId})
            DELETE r
        `, { userId, raceId });
        
        // Check if user is still running in any race
        const stillRunning = await session.run(`
            MATCH (u:User {id: $userId})-[:RUNNING_IN]->(race:NominationRace)
            RETURN count(race) as count
        `, { userId });
        
        const runningCount = toNumber(stillRunning.records[0]?.get('count') || 0);
        
        if (runningCount === 0) {
            await session.run(`
                MATCH (u:User {id: $userId})
                SET u.candidate = false
            `, { userId });
        }
        
        return { success: true, message: 'Successfully withdrawn from the race.' };
    } finally {
        await session.close();
    }
}

/**
 * Get candidacy status for a user (which races they're running in)
 */
async function getCandidacyStatus({ userId, convId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get races user is running in for this convention
        const racesResult = await session.run(`
            MATCH (u:User {id: $userId})-[:RUNNING_IN]->(race:NominationRace)<-[:HAS_RACE]-(c:Convention {id: $convId})
            MATCH (race)-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            RETURN race, riding, province
        `, { userId, convId });
        
        // Get user's location
        const locationResult = await session.run(`
            MATCH (u:User {id: $userId})-[:LOCATED_IN]->(loc)
            RETURN loc.id as locationId, loc.name as locationName, labels(loc)[0] as locationType
        `, { userId });
        
        // Get lifetime nomination count
        const nomResult = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED]->(u:User {id: $userId})
            RETURN count(n) as nominationCount
        `, { userId });
        
        const location = locationResult.records.length > 0 ? {
            id: locationResult.records[0].get('locationId'),
            name: locationResult.records[0].get('locationName'),
            type: locationResult.records[0].get('locationType')
        } : null;
        
        return {
            isRunning: racesResult.records.length > 0,
            races: racesResult.records.map(r => ({
                race: r.get('race').properties,
                riding: r.get('riding').properties,
                province: r.get('province')?.properties
            })),
            location,
            nominationCount: toNumber(nomResult.records[0]?.get('nominationCount') || 0)
        };
    } finally {
        await session.close();
    }
}

/**
 * Get nominations for a user (legacy format for profile page)
 * Now returns lifetime nominations, not convention-specific
 */
async function getNominationsForUser({ convId, userId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get all lifetime nominations for this user
        const result = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED]->(nominee:User {id: $userId})
            RETURN nominator.id as nominatorId, nominator.name as nominatorName,
                   n.message as message, n.createdAt as createdAt, n.ridingId as ridingId
            ORDER BY n.createdAt DESC
        `, { userId });
        
        // Get user's current riding
        const ridingResult = await session.run(`
            MATCH (u:User {id: $userId})-[:LOCATED_IN]->(riding)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            RETURN riding, province
        `, { userId });
        
        // Check if user is running in this convention
        const runningResult = await session.run(`
            MATCH (u:User {id: $userId})-[:RUNNING_IN]->(race:NominationRace)<-[:HAS_RACE]-(c:Convention {id: $convId})
            RETURN race
        `, { userId, convId });
        
        const nominations = result.records.map(r => ({
            nominatorId: r.get('nominatorId'),
            nominatorName: r.get('nominatorName'),
            message: r.get('message'),
            createdAt: toISODate(r.get('createdAt'))
        }));
        
        const riding = ridingResult.records[0]?.get('riding')?.properties;
        const province = ridingResult.records[0]?.get('province')?.properties;
        
        // Return in a format compatible with existing UI
        if (nominations.length === 0 && !riding) {
            return [];
        }
        
        return [{
            riding: riding || { name: 'No riding set' },
            province: province,
            nominations: nominations,
            nominationCount: nominations.length,
            hasAccepted: runningResult.records.length > 0
        }];
    } finally {
        await session.close();
    }
}

/**
 * Create races for a wave
 */
async function createRacesForWave(convId, wave) {
    const provinces = WAVE_PROVINCES[wave];
    if (!provinces) {
        return { racesCreated: 0, debug: 'Invalid wave' };
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Debug: Check how many ridings exist
        const debugResult = await session.run(`
            MATCH (p:Province)-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            WHERE p.code IN $provinces
            RETURN p.code as province, count(fr) as ridings
        `, { provinces });
        
        const debugInfo = debugResult.records.map(r => 
            `${r.get('province')}: ${toNumber(r.get('ridings'))} ridings`
        );
        
        if (debugResult.records.length === 0) {
            return { 
                racesCreated: 0, 
                provinces,
                waveName: WAVE_NAMES[wave],
                debug: `No provinces found matching codes: ${provinces.join(', ')}. Did you run "node test_neo4j.js" to seed the database?`
            };
        }
        
        // Create races
        const result = await session.run(`
            MATCH (p:Province)-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            WHERE p.code IN $provinces
            WITH fr, p
            MERGE (race:NominationRace {id: 'race-' + $convId + '-' + fr.id})
            ON CREATE SET race.status = 'open', race.currentRound = 0, race.wave = $wave, race.createdAt = datetime()
            WITH race, fr
            MATCH (conv:Convention {id: $fullConvId})
            MERGE (conv)-[:HAS_RACE]->(race)
            MERGE (race)-[:FOR_RIDING]->(fr)
            RETURN count(DISTINCT race) as racesCreated
        `, { 
            convId: convId.replace('conv-', ''), 
            fullConvId: convId,
            provinces, 
            wave 
        });
        
        return { 
            racesCreated: toNumber(result.records[0]?.get('racesCreated')),
            provinces,
            waveName: WAVE_NAMES[wave],
            debug: debugInfo.join(', ')
        };
    } finally {
        await session.close();
    }
}

module.exports = {
    // Constants
    WAVES,
    WAVE_PROVINCES,
    WAVE_NAMES,
    
    // Convention operations
    getAllConventions,
    getConventionById,
    getRacesForConvention,
    getRaceById,
    createRacesForWave,
    serializeConvention,
    
    // Nomination operations (permanent, not tied to conventions)
    createNomination,
    getUserNominations,
    
    // Candidacy operations
    declareCandidacy,
    withdrawFromRace,
    getCandidacyStatus,
    
    // Legacy support
    acceptNomination,
    getNominationsForUser
};

