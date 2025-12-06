/**
 * Convention Routes
 * Handles convention management, nomination races, and voting
 */

const express = require('express');
const router = express.Router();
const { getDriver, getDatabase } = require('../config/db');

// Helper to convert Neo4j DateTime to ISO string
function toISODate(neo4jDate) {
    if (!neo4jDate) return null;
    if (typeof neo4jDate === 'string') return neo4jDate;
    if (neo4jDate.toStandardDate) {
        return neo4jDate.toStandardDate().toISOString();
    }
    // Handle raw integer year
    if (typeof neo4jDate === 'object' && neo4jDate.year) {
        const year = neo4jDate.year.low || neo4jDate.year;
        const month = (neo4jDate.month?.low || neo4jDate.month || 1);
        const day = (neo4jDate.day?.low || neo4jDate.day || 1);
        const hour = (neo4jDate.hour?.low || neo4jDate.hour || 0);
        const minute = (neo4jDate.minute?.low || neo4jDate.minute || 0);
        const second = (neo4jDate.second?.low || neo4jDate.second || 0);
        return new Date(year, month - 1, day, hour, minute, second).toISOString();
    }
    return null;
}

// Helper to convert Neo4j Integer to number
function toNumber(neo4jInt) {
    if (neo4jInt === null || neo4jInt === undefined) return 0;
    if (typeof neo4jInt === 'number') return neo4jInt;
    if (neo4jInt.toNumber) return neo4jInt.toNumber();
    if (neo4jInt.low !== undefined) return neo4jInt.low;
    return parseInt(neo4jInt) || 0;
}

// Convention wave definitions
const WAVES = [
    { wave: 1, name: 'Pacific', provinces: ['BC', 'YT'], color: '#00d4aa' },
    { wave: 2, name: 'Mountain', provinces: ['AB', 'NT'], color: '#00c4ff' },
    { wave: 3, name: 'Prairie', provinces: ['SK', 'MB', 'NU'], color: '#ffb347' },
    { wave: 4, name: 'Central', provinces: ['ON'], color: '#ff6b6b' },
    { wave: 5, name: 'Quebec', provinces: ['QC'], color: '#a855f7' },
    { wave: 6, name: 'Atlantic', provinces: ['NB', 'NS', 'PE', 'NL'], color: '#3b82f6' }
];

// Helper to serialize convention properties
function serializeConvention(props) {
    return {
        id: props.id,
        name: props.name,
        year: toNumber(props.year),
        status: props.status,
        currentWave: toNumber(props.currentWave) || 0,
        description: props.description,
        // Each wave has nomination + voting periods
        wave1NominationStart: toISODate(props.wave1NominationStart),
        wave1NominationEnd: toISODate(props.wave1NominationEnd),
        wave1VotingStart: toISODate(props.wave1VotingStart),
        wave1VotingEnd: toISODate(props.wave1VotingEnd),
        wave2NominationStart: toISODate(props.wave2NominationStart),
        wave2NominationEnd: toISODate(props.wave2NominationEnd),
        wave2VotingStart: toISODate(props.wave2VotingStart),
        wave2VotingEnd: toISODate(props.wave2VotingEnd),
        wave3NominationStart: toISODate(props.wave3NominationStart),
        wave3NominationEnd: toISODate(props.wave3NominationEnd),
        wave3VotingStart: toISODate(props.wave3VotingStart),
        wave3VotingEnd: toISODate(props.wave3VotingEnd),
        wave4NominationStart: toISODate(props.wave4NominationStart),
        wave4NominationEnd: toISODate(props.wave4NominationEnd),
        wave4VotingStart: toISODate(props.wave4VotingStart),
        wave4VotingEnd: toISODate(props.wave4VotingEnd),
        wave5NominationStart: toISODate(props.wave5NominationStart),
        wave5NominationEnd: toISODate(props.wave5NominationEnd),
        wave5VotingStart: toISODate(props.wave5VotingStart),
        wave5VotingEnd: toISODate(props.wave5VotingEnd),
        wave6NominationStart: toISODate(props.wave6NominationStart),
        wave6NominationEnd: toISODate(props.wave6NominationEnd),
        wave6VotingStart: toISODate(props.wave6VotingStart),
        wave6VotingEnd: toISODate(props.wave6VotingEnd),
        createdAt: toISODate(props.createdAt),
        waves: WAVES
    };
}

// GET /api/conventions - List all conventions
router.get('/', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention)
            OPTIONAL MATCH (c)-[:FOR_COUNTRY]->(country:Country)
            OPTIONAL MATCH (c)-[:HAS_RACE]->(race:NominationRace)
            WITH c, country, count(race) as raceCount
            RETURN c, country.name as countryName, raceCount
            ORDER BY c.year DESC
        `);
        
        const conventions = result.records.map(record => {
            const c = record.get('c').properties;
            return {
                ...serializeConvention(c),
                countryName: record.get('countryName'),
                raceCount: toNumber(record.get('raceCount'))
            };
        });
        
        res.json(conventions);
    } catch (error) {
        console.error('Error fetching conventions:', error);
        res.status(500).json({ error: 'Failed to fetch conventions' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/:id - Get convention details
router.get('/:id', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $id})
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
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        
        const record = result.records[0];
        const convention = record.get('c').properties;
        const country = record.get('country')?.properties;
        const racesData = record.get('races');
        
        const races = racesData
            .filter(r => r.race)
            .map(r => ({
                ...r.race.properties,
                riding: r.riding?.properties,
                candidateCount: r.candidateCount.toNumber()
            }));
        
        res.json({
            ...convention,
            country,
            races
        });
    } catch (error) {
        console.error('Error fetching convention:', error);
        res.status(500).json({ error: 'Failed to fetch convention' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/:id/races - Get all races for a convention
router.get('/:id/races', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $id})-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WITH race, riding, province, collect(candidate) as candidates
            RETURN race, riding, province.name as provinceName, 
                   size(candidates) as candidateCount,
                   [c in candidates | {id: c.id, name: c.name}] as candidateList
            ORDER BY province.name, riding.name
        `, { id: req.params.id });
        
        const races = result.records.map(record => ({
            ...record.get('race').properties,
            riding: record.get('riding').properties,
            provinceName: record.get('provinceName'),
            candidateCount: record.get('candidateCount').toNumber(),
            candidates: record.get('candidateList')
        }));
        
        res.json(races);
    } catch (error) {
        console.error('Error fetching races:', error);
        res.status(500).json({ error: 'Failed to fetch races' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/:id/races/by-province - Get races grouped by province
router.get('/:id/races/by-province', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $id})-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WITH province, race, riding, collect(candidate) as candidates
            ORDER BY riding.name
            WITH province, collect({
                race: race,
                riding: riding,
                candidateCount: size(candidates),
                candidates: [c in candidates | {id: c.id, name: c.name}]
            }) as races
            RETURN province, races
            ORDER BY province.name
        `, { id: req.params.id });
        
        const byProvince = result.records.map(record => ({
            province: record.get('province')?.properties,
            races: record.get('races').map(r => ({
                ...r.race.properties,
                riding: r.riding.properties,
                candidateCount: r.candidateCount.toNumber(),
                candidates: r.candidates
            }))
        }));
        
        res.json(byProvince);
    } catch (error) {
        console.error('Error fetching races by province:', error);
        res.status(500).json({ error: 'Failed to fetch races' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/races/:raceId - Get single race details with candidates
router.get('/races/:raceId', async (req, res) => {
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
        `, { raceId: req.params.raceId });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Race not found' });
        }
        
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
                nominatedAt: c.nominatedAt,
                endorsementCount: c.endorsementCount.toNumber(),
                points: c.points.toNumber()
            }));
        
        res.json({
            ...race,
            riding,
            convention,
            province,
            candidates
        });
    } catch (error) {
        console.error('Error fetching race:', error);
        res.status(500).json({ error: 'Failed to fetch race' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/:convId/nominate - Nominate SOMEONE ELSE for a race (grassroots nominations)
router.post('/:convId/nominate', async (req, res) => {
    const { nominatorId, nomineeId, ridingId, ridingType, raceId: providedRaceId, message } = req.body;
    const convId = req.params.convId;
    
    // Support both raceId directly OR ridingId+ridingType
    if (!nominatorId || !nomineeId) {
        return res.status(400).json({ error: 'nominatorId and nomineeId are required' });
    }
    
    if (!providedRaceId && (!ridingId || !ridingType)) {
        return res.status(400).json({ error: 'Either raceId OR (ridingId and ridingType) are required' });
    }
    
    if (nominatorId === nomineeId) {
        return res.status(400).json({ error: 'You cannot nominate yourself! Ask someone else to nominate you.' });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if convention is in a nominations phase (supports wave-specific statuses)
        const convCheck = await session.run(`
            MATCH (c:Convention {id: $convId})
            WHERE c.status CONTAINS 'nominations'
            RETURN c
        `, { convId });
        
        if (convCheck.records.length === 0) {
            return res.status(400).json({ error: 'Convention is not currently accepting nominations. Check the Admin panel.' });
        }
        
        // Use provided raceId or construct from ridingId
        const raceId = providedRaceId || `race-${convId.replace('conv-', '')}-${ridingId}`;
        
        // If raceId provided, verify it exists
        if (providedRaceId) {
            const raceCheck = await session.run(`
                MATCH (race:NominationRace {id: $raceId})
                RETURN race
            `, { raceId });
            
            if (raceCheck.records.length === 0) {
                return res.status(400).json({ error: 'Race not found. Make sure races have been created for this wave.' });
            }
        } else {
            // Create race from riding
            await session.run(`
                MERGE (race:NominationRace {id: $raceId})
                ON CREATE SET race.status = 'open', race.currentRound = 0, race.createdAt = datetime()
                WITH race
                MATCH (conv:Convention {id: $convId})
                MERGE (conv)-[:HAS_RACE]->(race)
                WITH race
                MATCH (riding:${ridingType} {id: $ridingId})
                MERGE (race)-[:FOR_RIDING]->(riding)
            `, { raceId, convId, ridingId });
        }
        
        // Check if this nomination already exists
        const existingNom = await session.run(`
            MATCH (nominator:User {id: $nominatorId})-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $nomineeId})
            WHERE n.raceId = $raceId
            RETURN n
        `, { nominatorId, nomineeId, raceId });
        
        if (existingNom.records.length > 0) {
            return res.status(400).json({ error: 'You have already nominated this person for this riding' });
        }
        
        // Get ridingId from race if not provided
        let actualRidingId = ridingId;
        if (!actualRidingId && providedRaceId) {
            const ridingResult = await session.run(`
                MATCH (race:NominationRace {id: $raceId})-[:FOR_RIDING]->(riding)
                RETURN riding.id as ridingId
            `, { raceId });
            actualRidingId = ridingResult.records[0]?.get('ridingId') || raceId;
        }
        
        // Create the nomination
        await session.run(`
            MATCH (nominator:User {id: $nominatorId}), (nominee:User {id: $nomineeId})
            CREATE (nominator)-[:NOMINATED_FOR_RACE {
                raceId: $raceId,
                ridingId: $actualRidingId,
                conventionId: $convId,
                message: $message,
                createdAt: datetime()
            }]->(nominee)
        `, { nominatorId, nomineeId, raceId, actualRidingId, convId, message: message || '' });
        
        // Get nomination count for this person in this race
        const countResult = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $nomineeId})
            WHERE n.raceId = $raceId
            RETURN count(n) as nominationCount
        `, { nomineeId, raceId });
        
        const nominationCount = toNumber(countResult.records[0].get('nominationCount'));
        
        res.json({ 
            success: true, 
            message: `Successfully nominated! They now have ${nominationCount} nomination(s) for this riding.`,
            raceId,
            nominationCount
        });
    } catch (error) {
        console.error('Error nominating:', error);
        res.status(500).json({ error: 'Failed to nominate' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/:convId/nominations/:userId - Get all nominations for a user
router.get('/:convId/nominations/:userId', async (req, res) => {
    const { convId, userId } = req.params;
    
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
        
        const pendingNominations = result.records.map(record => ({
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
        
        res.json(pendingNominations);
    } catch (error) {
        console.error('Error fetching nominations:', error);
        res.status(500).json({ error: 'Failed to fetch nominations' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/:convId/accept-nomination - Accept a nomination and become a candidate
router.post('/:convId/accept-nomination', async (req, res) => {
    const { userId, raceId } = req.body;
    const convId = req.params.convId;
    
    if (!userId || !raceId) {
        return res.status(400).json({ error: 'userId and raceId are required' });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if user is already running in another race this convention
        const existingRace = await session.run(`
            MATCH (u:User {id: $userId})-[:RUNNING_IN]->(race:NominationRace)<-[:HAS_RACE]-(c:Convention {id: $convId})
            RETURN race
        `, { userId, convId });
        
        if (existingRace.records.length > 0) {
            return res.status(400).json({ 
                error: 'Already running in another race',
                message: 'You can only accept one nomination per convention. Decline your current race first.'
            });
        }
        
        // Check if user actually has nominations for this race
        const nominationCheck = await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $userId})
            WHERE n.raceId = $raceId
            RETURN count(n) as count
        `, { userId, raceId });
        
        const nominationCount = toNumber(nominationCheck.records[0].get('count'));
        if (nominationCount === 0) {
            return res.status(400).json({ error: 'You have not been nominated for this race' });
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
            RETURN riding.name as ridingName
        `, { raceId });
        
        const ridingName = ridingInfo.records[0]?.get('ridingName') || 'Unknown';
        
        res.json({ 
            success: true, 
            message: `Congratulations! You are now a candidate for ${ridingName}!`,
            raceId,
            nominationCount
        });
    } catch (error) {
        console.error('Error accepting nomination:', error);
        res.status(500).json({ error: 'Failed to accept nomination' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/:convId/decline-nomination - Decline a nomination
router.post('/:convId/decline-nomination', async (req, res) => {
    const { userId, raceId } = req.body;
    const convId = req.params.convId;
    
    if (!userId || !raceId) {
        return res.status(400).json({ error: 'userId and raceId are required' });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Remove all nominations for this user in this race
        await session.run(`
            MATCH (nominator:User)-[n:NOMINATED_FOR_RACE]->(nominee:User {id: $userId})
            WHERE n.raceId = $raceId
            DELETE n
        `, { userId, raceId });
        
        res.json({ 
            success: true, 
            message: 'Nomination declined'
        });
    } catch (error) {
        console.error('Error declining nomination:', error);
        res.status(500).json({ error: 'Failed to decline nomination' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/:convId/withdraw - Withdraw from a race (after accepting)
router.post('/:convId/withdraw', async (req, res) => {
    const { userId, raceId } = req.body;
    const convId = req.params.convId;
    
    if (!userId || !raceId) {
        return res.status(400).json({ error: 'userId and raceId are required' });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Remove RUNNING_IN relationship
        await session.run(`
            MATCH (u:User {id: $userId})-[r:RUNNING_IN]->(race:NominationRace {id: $raceId})
            DELETE r
        `, { userId, raceId });
        
        res.json({ 
            success: true, 
            message: 'Successfully withdrew from the race. You can now accept a different nomination.'
        });
    } catch (error) {
        console.error('Error withdrawing:', error);
        res.status(500).json({ error: 'Failed to withdraw' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/races/:raceId/vote - Cast a vote (with round support)
router.post('/races/:raceId/vote', async (req, res) => {
    const { voterId, candidateId, round } = req.body;
    const raceId = req.params.raceId;
    
    if (!voterId || !candidateId) {
        return res.status(400).json({ error: 'voterId and candidateId are required' });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if race is in voting phase
        const raceCheck = await session.run(`
            MATCH (race:NominationRace {id: $raceId})<-[:HAS_RACE]-(conv:Convention)
            WHERE conv.status = 'voting'
            RETURN race
        `, { raceId });
        
        if (raceCheck.records.length === 0) {
            return res.status(400).json({ error: 'Race is not accepting votes' });
        }
        
        // Check if voter has already voted in this round
        const currentRound = round || 1;
        const existingVote = await session.run(`
            MATCH (voter:User {id: $voterId})-[v:VOTED_FOR]->(candidate:User)-[:RUNNING_IN]->(:NominationRace {id: $raceId})
            WHERE v.round = $round
            RETURN v
        `, { voterId, raceId, round: currentRound });
        
        if (existingVote.records.length > 0) {
            return res.status(400).json({ error: 'Already voted in this round' });
        }
        
        // Cast vote
        await session.run(`
            MATCH (voter:User {id: $voterId}), (candidate:User {id: $candidateId})
            CREATE (voter)-[:VOTED_FOR {round: $round, votedAt: datetime()}]->(candidate)
        `, { voterId, candidateId, round: currentRound });
        
        res.json({ success: true, message: 'Vote recorded' });
    } catch (error) {
        console.error('Error voting:', error);
        res.status(500).json({ error: 'Failed to record vote' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/races/:raceId/results - Get voting results
router.get('/races/:raceId/results', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            MATCH (candidate:User)-[:RUNNING_IN]->(race)
            OPTIONAL MATCH (voter:User)-[v:VOTED_FOR]->(candidate)
            WITH race, candidate, v.round as round, count(voter) as voteCount
            ORDER BY round, voteCount DESC
            WITH race, round, collect({candidate: candidate, votes: voteCount}) as roundResults
            RETURN race, collect({round: round, results: roundResults}) as allResults
        `, { raceId: req.params.raceId });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Race not found' });
        }
        
        const record = result.records[0];
        const race = record.get('race').properties;
        const allResults = record.get('allResults');
        
        const results = allResults
            .filter(r => r.round !== null)
            .map(r => ({
                round: r.round.toNumber(),
                results: r.results.map(c => ({
                    candidate: c.candidate.properties,
                    votes: c.votes.toNumber()
                }))
            }));
        
        res.json({
            race,
            results
        });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/races/:raceId/advance-round - Admin: Advance to next voting round
router.post('/races/:raceId/advance-round', async (req, res) => {
    const { eliminateBelow } = req.body; // percentage threshold
    const raceId = req.params.raceId;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get current round
        const raceResult = await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            RETURN race.currentRound as currentRound
        `, { raceId });
        
        const currentRound = raceResult.records[0]?.get('currentRound')?.toNumber() || 0;
        const newRound = currentRound + 1;
        
        // Get vote counts for current round
        const votesResult = await session.run(`
            MATCH (candidate:User)-[:RUNNING_IN]->(race:NominationRace {id: $raceId})
            OPTIONAL MATCH (voter:User)-[v:VOTED_FOR {round: $round}]->(candidate)
            WITH candidate, count(voter) as votes
            RETURN sum(votes) as totalVotes,
                   collect({candidateId: candidate.id, votes: votes}) as candidateVotes
        `, { raceId, round: currentRound });
        
        const record = votesResult.records[0];
        const totalVotes = record.get('totalVotes').toNumber();
        const candidateVotes = record.get('candidateVotes');
        
        // Eliminate candidates below threshold
        const threshold = (eliminateBelow || 5) / 100;
        const eliminated = candidateVotes.filter(c => 
            c.votes.toNumber() / totalVotes < threshold
        );
        
        // Mark eliminated candidates
        for (const c of eliminated) {
            await session.run(`
                MATCH (u:User {id: $candidateId})-[r:RUNNING_IN]->(race:NominationRace {id: $raceId})
                SET r.eliminated = true, r.eliminatedRound = $round
            `, { candidateId: c.candidateId, raceId, round: currentRound });
        }
        
        // Update race round
        await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            SET race.currentRound = $newRound
        `, { raceId, newRound });
        
        res.json({
            success: true,
            newRound,
            eliminated: eliminated.map(c => c.candidateId)
        });
    } catch (error) {
        console.error('Error advancing round:', error);
        res.status(500).json({ error: 'Failed to advance round' });
    } finally {
        await session.close();
    }
});

// GET /api/conventions/:convId/user/:userId/status - Get user's convention status
router.get('/:convId/user/:userId/status', async (req, res) => {
    const { convId, userId } = req.params;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (u:User {id: $userId})
            OPTIONAL MATCH (u)-[:HAS_MEMBERSHIP]->(m:Membership {year: toInteger(substring($convId, 5))})
            OPTIONAL MATCH (u)-[r:RUNNING_IN]->(race:NominationRace)<-[:HAS_RACE]-(conv:Convention {id: $convId})
            OPTIONAL MATCH (race)-[:FOR_RIDING]->(riding)
            RETURN u, m, race, riding, r
        `, { userId, convId });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const record = result.records[0];
        const user = record.get('u').properties;
        const membership = record.get('m')?.properties;
        const race = record.get('race')?.properties;
        const riding = record.get('riding')?.properties;
        const runningIn = record.get('r')?.properties;
        
        res.json({
            user: { id: user.id, name: user.name },
            isMember: !!membership,
            membership,
            isRunning: !!race,
            runningIn: race ? {
                race,
                riding,
                nominatedAt: runningIn?.nominatedAt
            } : null,
            canNominate: !!membership && !race
        });
    } catch (error) {
        console.error('Error fetching user status:', error);
        res.status(500).json({ error: 'Failed to fetch user status' });
    } finally {
        await session.close();
    }
});

module.exports = router;

