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
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WITH race, riding, province, collect(candidate) as candidates
            RETURN race, riding, province.name as provinceName, 
                   size(candidates) as candidateCount,
                   [c in candidates | {id: c.id, name: c.name}] as candidateList
            ORDER BY province.name, riding.name
        `, { convId });
        
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
                 count(DISTINCT supporter) as points
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
 * Create a nomination (one user nominates another for a race)
 * RULE: Users can only be nominated for their own riding (where they live)
 */
async function createNomination({ nominatorId, nomineeId, raceId, ridingId, ridingType, convId, message }) {
    if (nominatorId === nomineeId) {
        throw new Error('You cannot nominate yourself! Ask someone else to nominate you.');
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if convention is in nominations phase
        const convCheck = await session.run(`
            MATCH (c:Convention {id: $convId})
            WHERE c.status CONTAINS 'nominations'
            RETURN c
        `, { convId });
        
        if (convCheck.records.length === 0) {
            throw new Error('Convention is not currently accepting nominations.');
        }
        
        // RULE: Get nominee's location and verify they can only be nominated for THEIR riding
        const nomineeLocation = await session.run(`
            MATCH (u:User {id: $nomineeId})-[:LOCATED_IN]->(loc)
            RETURN loc.id as locationId, labels(loc)[0] as locationType
        `, { nomineeId });
        
        if (nomineeLocation.records.length === 0) {
            throw new Error('This user has not set their riding. They must set their location in their Profile before they can be nominated.');
        }
        
        const nomineeRidingId = nomineeLocation.records[0].get('locationId');
        const nomineeRidingType = nomineeLocation.records[0].get('locationType');
        
        // If ridingId was provided, verify it matches the nominee's riding
        if (ridingId && ridingId !== nomineeRidingId) {
            throw new Error('Users can only be nominated for their own riding. This user lives in a different riding.');
        }
        
        // Use the nominee's riding (enforcing the rule)
        const actualRidingId = nomineeRidingId;
        const actualRidingType = nomineeRidingType;
        
        // Construct raceId from the nominee's riding
        const finalRaceId = raceId || `race-${convId.replace('conv-', '')}-${actualRidingId}`;
        
        // Check if nomination already exists
        const existingNom = await session.run(`
            MATCH (nominator:User {id: $nominatorId})-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $nomineeId})
            WHERE n.raceId = $raceId
            RETURN n
        `, { nominatorId, nomineeId, raceId: finalRaceId });
        
        if (existingNom.records.length > 0) {
            throw new Error('You have already nominated this person for this riding.');
        }
        
        // Create the race if it doesn't exist (using nominee's riding)
        await session.run(`
            MERGE (race:NominationRace {id: $raceId})
            ON CREATE SET race.status = 'open', race.currentRound = 0, race.createdAt = datetime()
            WITH race
            MATCH (conv:Convention {id: $convId})
            MERGE (conv)-[:HAS_RACE]->(race)
            WITH race
            MATCH (riding {id: $ridingId})
            MERGE (race)-[:FOR_RIDING]->(riding)
        `, { raceId: finalRaceId, convId, ridingId: actualRidingId });
        
        // Create the nomination
        await session.run(`
            MATCH (nominator:User {id: $nominatorId}), (nominee:User {id: $nomineeId})
            CREATE (nominator)-[:NOMINATED_FOR_RACE {
                raceId: $raceId,
                ridingId: $ridingId,
                conventionId: $convId,
                message: $message,
                createdAt: datetime()
            }]->(nominee)
        `, { nominatorId, nomineeId, raceId: finalRaceId, ridingId: actualRidingId, convId, message: message || '' });
        
        // Get nomination count
        const countResult = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $nomineeId})
            WHERE n.raceId = $raceId
            RETURN count(n) as nominationCount
        `, { nomineeId, raceId: finalRaceId });
        
        const nominationCount = toNumber(countResult.records[0].get('nominationCount'));
        
        return {
            success: true,
            raceId: finalRaceId,
            nominationCount,
            message: `Successfully nominated! They now have ${nominationCount} nomination(s) for this riding.`
        };
    } finally {
        await session.close();
    }
}

/**
 * Accept a nomination (user becomes a candidate in a race)
 */
async function acceptNomination({ userId, raceId, convId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if user is already running in another race this convention
        const existingRace = await session.run(`
            MATCH (u:User {id: $userId})-[:RUNNING_IN]->(race:NominationRace)<-[:HAS_RACE]-(c:Convention {id: $convId})
            RETURN race
        `, { userId, convId });
        
        if (existingRace.records.length > 0) {
            throw new Error('You are already running in another race this convention. Withdraw first to accept a different nomination.');
        }
        
        // Get nomination count for this user in this race
        const nomResult = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(u:User {id: $userId})
            WHERE n.raceId = $raceId
            RETURN count(n) as nominationCount
        `, { userId, raceId });
        
        const nominationCount = toNumber(nomResult.records[0]?.get('nominationCount') || 0);
        
        if (nominationCount === 0) {
            throw new Error('No nominations found for this race.');
        }
        
        // Accept the nomination - add user to race
        await session.run(`
            MATCH (u:User {id: $userId}), (race:NominationRace {id: $raceId})
            MERGE (u)-[:RUNNING_IN {nominatedAt: datetime(), nominationCount: $nominationCount}]->(race)
            SET u.candidate = true
        `, { userId, raceId, nominationCount });
        
        // Get riding info for response
        const ridingInfo = await session.run(`
            MATCH (race:NominationRace {id: $raceId})-[:FOR_RIDING]->(riding)
            RETURN riding
        `, { raceId });
        
        const riding = ridingInfo.records[0]?.get('riding')?.properties;
        
        return {
            success: true,
            message: `You are now a candidate for ${riding?.name || 'this riding'}!`,
            riding
        };
    } finally {
        await session.close();
    }
}

/**
 * Decline a nomination
 */
async function declineNomination({ userId, raceId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Remove all nominations for this user in this race
        await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(u:User {id: $userId})
            WHERE n.raceId = $raceId
            DELETE n
        `, { userId, raceId });
        
        return { success: true, message: 'Nomination declined.' };
    } finally {
        await session.close();
    }
}

/**
 * Withdraw from a race
 */
async function withdrawFromRace({ userId, raceId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[r:RUNNING_IN]->(race:NominationRace {id: $raceId})
            DELETE r
        `, { userId, raceId });
        
        return { success: true, message: 'Successfully withdrawn from the race.' };
    } finally {
        await session.close();
    }
}

/**
 * Get nominations for a user
 */
async function getNominationsForUser({ convId, userId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $userId})
            WHERE n.conventionId = $convId
            WITH n.raceId as raceId, collect({
                nominatorId: nominator.id,
                nominatorName: nominator.name,
                message: n.message,
                createdAt: n.createdAt
            }) as nominations
            MATCH (race:NominationRace {id: raceId})-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            OPTIONAL MATCH (nominee:User {id: $userId})-[r:RUNNING_IN]->(race)
            RETURN race, riding, province, nominations, r IS NOT NULL as hasAccepted
            ORDER BY size(nominations) DESC
        `, { convId, userId });
        
        return result.records.map(record => ({
            race: record.get('race').properties,
            riding: record.get('riding').properties,
            province: record.get('province')?.properties,
            nominations: record.get('nominations').map(n => ({
                ...n,
                createdAt: toISODate(n.createdAt)
            })),
            nominationCount: record.get('nominations').length,
            hasAccepted: record.get('hasAccepted')
        }));
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
    
    // Nomination operations
    createNomination,
    acceptNomination,
    declineNomination,
    withdrawFromRace,
    getNominationsForUser
};

