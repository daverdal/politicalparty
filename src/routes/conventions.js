/**
 * Convention Routes
 * HTTP handlers for convention management, nomination races, and voting
 * Business logic is delegated to conventionService
 */

const express = require('express');
const router = express.Router();
const conventionService = require('../services/conventionService');
const { getDriver, getDatabase } = require('../config/db');
const { toNumber, toISODate } = require('../utils/neo4jHelpers');
const { authenticate, requireVerifiedUser, requireAdmin } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// GET /api/conventions - List all conventions
router.get('/', async (req, res) => {
    try {
        const conventions = await conventionService.getAllConventions();
        // Add waves info to each convention
        const withWaves = conventions.map(c => ({
            ...c,
            waves: conventionService.WAVES
        }));
        res.json(withWaves);
    } catch (error) {
        console.error('Error fetching conventions:', error);
        res.status(500).json({ error: 'Failed to fetch conventions' });
    }
});

// GET /api/conventions/:id - Get convention details
router.get('/:id', async (req, res) => {
    try {
        const convention = await conventionService.getConventionById(req.params.id);
        if (!convention) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        res.json({
            ...convention,
            waves: conventionService.WAVES
        });
    } catch (error) {
        console.error('Error fetching convention:', error);
        res.status(500).json({ error: 'Failed to fetch convention' });
    }
});

// GET /api/conventions/:id/races - Get all races for a convention
router.get('/:id/races', async (req, res) => {
    try {
        const races = await conventionService.getRacesForConvention(req.params.id);
        res.json(races);
    } catch (error) {
        console.error('Error fetching races:', error);
        res.status(500).json({ error: 'Failed to fetch races' });
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
                candidateCount: toNumber(r.candidateCount),
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
    try {
        const race = await conventionService.getRaceById(req.params.raceId);
        if (!race) {
            return res.status(404).json({ error: 'Race not found' });
        }
        res.json(race);
    } catch (error) {
        console.error('Error fetching race:', error);
        res.status(500).json({ error: 'Failed to fetch race' });
    }
});

// POST /api/conventions/:convId/nominate - Nominate someone (permanent, not convention-tied)
router.post('/:convId/nominate', authenticate, requireVerifiedUser, async (req, res) => {
    const { nomineeId, message } = req.body;
    const nominatorId = req.user.id;
    
    if (!nomineeId) {
        return res.status(400).json({ error: 'nomineeId is required' });
    }
    
    try {
        const result = await conventionService.createNomination({
            nominatorId,
            nomineeId,
            message
        });

        // Notify nominee of new nomination
        try {
            await notificationService.createNotification({
                userId: nomineeId,
                type: 'NOMINATION',
                title: 'You received a new nomination',
                body: result.message,
                payload: {
                    nominatorId,
                    nomineeId,
                    ridingName: result.ridingName,
                    nominationCount: result.nominationCount
                }
            });
        } catch (notifyErr) {
            // Best-effort: log but do not fail the main request
            // eslint-disable-next-line no-console
            console.error('[notifications] failed to create nomination notification:', notifyErr);
        }

        res.json(result);
    } catch (error) {
        console.error('Error nominating:', error);
        res.status(400).json({ error: error.message || 'Failed to nominate' });
    }
});

// POST /api/conventions/:convId/declare-candidacy - User declares they want to run
router.post('/:convId/declare-candidacy', authenticate, requireVerifiedUser, async (req, res) => {
    const convId = req.params.convId;
    const userId = req.user.id;
    const { locationId } = req.body || {};
    
    try {
        const result = await conventionService.declareCandidacy({ userId, convId, locationId });
        res.json(result);
    } catch (error) {
        console.error('Error declaring candidacy:', error);
        res.status(400).json({ error: error.message || 'Failed to declare candidacy' });
    }
});

// GET /api/conventions/:convId/candidacy/:userId - Get user's candidacy status
router.get('/:convId/candidacy/:userId', async (req, res) => {
    try {
        const status = await conventionService.getCandidacyStatus({
            userId: req.params.userId,
            convId: req.params.convId
        });
        res.json(status);
    } catch (error) {
        console.error('Error fetching candidacy status:', error);
        res.status(500).json({ error: 'Failed to fetch candidacy status' });
    }
});

// GET /api/users/:userId/nominations - Get a user's nomination history
router.get('/users/:userId/nominations', async (req, res) => {
    try {
        const nominations = await conventionService.getUserNominations(req.params.userId);
        res.json(nominations);
    } catch (error) {
        console.error('Error fetching nominations:', error);
        res.status(500).json({ error: 'Failed to fetch nominations' });
    }
});

// GET /api/conventions/:convId/nominations/:userId - Get all nominations for a user
router.get('/:convId/nominations/:userId', async (req, res) => {
    try {
        const nominations = await conventionService.getNominationsForUser({
            convId: req.params.convId,
            userId: req.params.userId
        });
        res.json(nominations);
    } catch (error) {
        console.error('Error fetching nominations:', error);
        res.status(500).json({ error: 'Failed to fetch nominations' });
    }
});

// POST /api/conventions/:convId/accept-nomination - Accept a nomination
router.post('/:convId/accept-nomination', authenticate, requireVerifiedUser, async (req, res) => {
    const { raceId } = req.body;
    const userId = req.user.id;
    
    if (!raceId) {
        return res.status(400).json({ error: 'raceId is required' });
    }
    
    try {
        const result = await conventionService.acceptNomination({
            userId,
            raceId,
            convId: req.params.convId
        });
        res.json(result);
    } catch (error) {
        console.error('Error accepting nomination:', error);
        res.status(400).json({ error: error.message || 'Failed to accept nomination' });
    }
});

// POST /api/conventions/:convId/decline-nomination - Decline a nomination
router.post('/:convId/decline-nomination', authenticate, requireVerifiedUser, async (req, res) => {
    const { raceId } = req.body;
    const userId = req.user.id;
    
    if (!raceId) {
        return res.status(400).json({ error: 'raceId is required' });
    }
    
    try {
        const result = await conventionService.declineNomination({ userId, raceId });
        res.json(result);
    } catch (error) {
        console.error('Error declining nomination:', error);
        res.status(500).json({ error: 'Failed to decline nomination' });
    }
});

// POST /api/conventions/:convId/withdraw - Withdraw from a race
router.post('/:convId/withdraw', authenticate, requireVerifiedUser, async (req, res) => {
    const { raceId } = req.body;
    const convId = req.params.convId;
    const userId = req.user.id;
    
    if (!raceId) {
        return res.status(400).json({ error: 'raceId is required' });
    }
    
    try {
        const result = await conventionService.withdrawFromRace({ userId, raceId, convId });
        res.json(result);
    } catch (error) {
        console.error('Error withdrawing:', error);
        res.status(500).json({ error: 'Failed to withdraw' });
    }
});

// POST /api/conventions/races/:raceId/vote - Cast a vote
router.post('/races/:raceId/vote', authenticate, requireVerifiedUser, async (req, res) => {
    const { candidateId, round } = req.body;
    const raceId = req.params.raceId;
    const voterId = req.user.id;
    
    if (!candidateId) {
        return res.status(400).json({ error: 'candidateId is required' });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if race is in voting phase
        const raceCheck = await session.run(`
            MATCH (race:NominationRace {id: $raceId})<-[:HAS_RACE]-(conv:Convention)
            WHERE conv.status CONTAINS 'voting'
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
                round: toNumber(r.round),
                results: r.results.map(c => ({
                    candidate: c.candidate.properties,
                    votes: toNumber(c.votes)
                }))
            }));
        
        res.json({ race, results });
    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    } finally {
        await session.close();
    }
});

// POST /api/conventions/races/:raceId/advance-round - Admin: Advance voting round
router.post('/races/:raceId/advance-round', async (req, res) => {
    const { eliminateBelow } = req.body;
    const raceId = req.params.raceId;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get current round
        const raceResult = await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            RETURN race.currentRound as currentRound
        `, { raceId });
        
        const currentRound = toNumber(raceResult.records[0]?.get('currentRound')) || 0;
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
        const totalVotes = toNumber(record.get('totalVotes'));
        const candidateVotes = record.get('candidateVotes');
        
        // Eliminate candidates below threshold
        const threshold = (eliminateBelow || 5) / 100;
        const eliminated = candidateVotes.filter(c => 
            toNumber(c.votes) / totalVotes < threshold
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
            runningIn: race ? { race, riding, nominatedAt: runningIn?.nominatedAt } : null,
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
