/**
 * Voting Service
 * Business logic for convention voting (multi-round elimination)
 */

const { getDriver, getDatabase } = require('../config/db');
const { toNumber, toISODate } = require('../utils/neo4jHelpers');

/**
 * Get voting status for a race
 */
async function getRaceVotingStatus(raceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            OPTIONAL MATCH (race)-[:HAS_ROUND]->(round:VotingRound)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WHERE NOT EXISTS { (candidate)-[:ELIMINATED_IN]->(:VotingRound)<-[:HAS_ROUND]-(race) }
            WITH race, 
                 collect(DISTINCT round) as rounds,
                 collect(DISTINCT candidate) as activeCandidates
            RETURN race, rounds, activeCandidates
        `, { raceId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        const race = record.get('race').properties;
        const rounds = record.get('rounds').map(r => r.properties);
        const activeCandidates = record.get('activeCandidates').map(c => c.properties);
        
        // Get current round (highest round number)
        const currentRound = rounds.length > 0 
            ? rounds.reduce((max, r) => toNumber(r.roundNumber) > toNumber(max.roundNumber) ? r : max, rounds[0])
            : null;
        
        return {
            race,
            currentRound,
            totalRounds: rounds.length,
            activeCandidates,
            isComplete: race.winnerId != null
        };
    } finally {
        await session.close();
    }
}

/**
 * Start voting for a race (create round 1)
 */
async function startVotingForRace(raceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Check if voting already started
        const existing = await session.run(`
            MATCH (race:NominationRace {id: $raceId})-[:HAS_ROUND]->(round:VotingRound)
            RETURN count(round) as count
        `, { raceId });
        
        if (toNumber(existing.records[0].get('count')) > 0) {
            return { success: false, message: 'Voting already started for this race' };
        }
        
        // Create round 1
        const roundId = `${raceId}-round-1`;
        await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            CREATE (round:VotingRound {
                id: $roundId,
                roundNumber: 1,
                startedAt: datetime(),
                status: 'active'
            })
            CREATE (race)-[:HAS_ROUND]->(round)
        `, { raceId, roundId });
        
        return { success: true, message: 'Voting started', roundId };
    } finally {
        await session.close();
    }
}

/**
 * Cast a vote
 */
async function castVote({ oderId, raceId, candidateId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get current active round
        const roundResult = await session.run(`
            MATCH (race:NominationRace {id: $raceId})-[:HAS_ROUND]->(round:VotingRound {status: 'active'})
            RETURN round
            ORDER BY round.roundNumber DESC
            LIMIT 1
        `, { raceId });
        
        if (roundResult.records.length === 0) {
            throw new Error('No active voting round for this race');
        }
        
        const round = roundResult.records[0].get('round').properties;
        const roundId = round.id;
        
        // Check if user already voted in this round
        const existingVote = await session.run(`
            MATCH (voter:User {id: $oderId})-[:VOTED_IN]->(round:VotingRound {id: $roundId})
            RETURN count(*) as count
        `, { oderId, roundId });
        
        if (toNumber(existingVote.records[0].get('count')) > 0) {
            throw new Error('You have already voted in this round');
        }
        
        // Check if candidate is still active (not eliminated)
        const candidateCheck = await session.run(`
            MATCH (candidate:User {id: $candidateId})-[:RUNNING_IN]->(race:NominationRace {id: $raceId})
            WHERE NOT EXISTS { 
                (candidate)-[:ELIMINATED_IN]->(:VotingRound)<-[:HAS_ROUND]-(race) 
            }
            RETURN candidate
        `, { candidateId, raceId });
        
        if (candidateCheck.records.length === 0) {
            throw new Error('Candidate is not active in this race');
        }
        
        // Cast the vote
        await session.run(`
            MATCH (voter:User {id: $oderId}), 
                  (candidate:User {id: $candidateId}),
                  (round:VotingRound {id: $roundId})
            CREATE (voter)-[:VOTED_FOR {votedAt: datetime()}]->(candidate)
            CREATE (voter)-[:VOTED_IN {votedAt: datetime()}]->(round)
        `, { oderId, candidateId, roundId });
        
        return { success: true, message: 'Vote cast successfully' };
    } finally {
        await session.close();
    }
}

/**
 * Get vote tallies for current round
 */
async function getVoteTallies(raceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get current round
        const roundResult = await session.run(`
            MATCH (race:NominationRace {id: $raceId})-[:HAS_ROUND]->(round:VotingRound)
            RETURN round
            ORDER BY round.roundNumber DESC
            LIMIT 1
        `, { raceId });
        
        if (roundResult.records.length === 0) {
            return { round: null, tallies: [], totalVotes: 0 };
        }
        
        const round = roundResult.records[0].get('round').properties;
        
        // Get vote counts for active candidates in this round
        const result = await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WHERE NOT EXISTS { 
                (candidate)-[:ELIMINATED_IN]->(:VotingRound)<-[:HAS_ROUND]-(race) 
            }
            OPTIONAL MATCH (voter:User)-[:VOTED_IN]->(round:VotingRound {id: $roundId})
            OPTIONAL MATCH (voter)-[:VOTED_FOR]->(candidate)
            WITH candidate, count(DISTINCT voter) as votes
            RETURN candidate, votes
            ORDER BY votes DESC
        `, { raceId, roundId: round.id });
        
        const tallies = result.records.map(record => ({
            candidate: record.get('candidate').properties,
            votes: toNumber(record.get('votes'))
        }));
        
        const totalVotes = tallies.reduce((sum, t) => sum + t.votes, 0);
        
        return {
            round,
            tallies,
            totalVotes
        };
    } finally {
        await session.close();
    }
}

/**
 * Close current round and eliminate lowest candidate (or declare winner)
 */
async function closeRoundAndAdvance(raceId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const { round, tallies, totalVotes } = await getVoteTallies(raceId);
        
        if (!round || tallies.length === 0) {
            throw new Error('No active round or candidates');
        }
        
        // Check for winner (>50% of votes)
        const winner = tallies.find(t => totalVotes > 0 && (t.votes / totalVotes) > 0.5);
        
        if (winner || tallies.length <= 2) {
            // Declare winner (highest votes)
            const finalWinner = winner || tallies[0];
            
            await session.run(`
                MATCH (race:NominationRace {id: $raceId})
                MATCH (round:VotingRound {id: $roundId})
                SET race.winnerId = $winnerId,
                    race.status = 'completed',
                    round.status = 'completed',
                    round.closedAt = datetime()
            `, { raceId, roundId: round.id, winnerId: finalWinner.candidate.id });
            
            return {
                success: true,
                result: 'winner',
                winner: finalWinner.candidate,
                votes: finalWinner.votes,
                totalVotes
            };
        }
        
        // Eliminate lowest candidate
        const lowestCandidate = tallies[tallies.length - 1];
        
        await session.run(`
            MATCH (candidate:User {id: $candidateId}), (round:VotingRound {id: $roundId})
            CREATE (candidate)-[:ELIMINATED_IN {eliminatedAt: datetime(), votes: $votes}]->(round)
        `, { 
            candidateId: lowestCandidate.candidate.id, 
            roundId: round.id,
            votes: lowestCandidate.votes
        });
        
        // Close current round
        await session.run(`
            MATCH (round:VotingRound {id: $roundId})
            SET round.status = 'completed', round.closedAt = datetime()
        `, { roundId: round.id });
        
        // Create next round
        const nextRoundNum = toNumber(round.roundNumber) + 1;
        const nextRoundId = `${raceId}-round-${nextRoundNum}`;
        
        await session.run(`
            MATCH (race:NominationRace {id: $raceId})
            CREATE (round:VotingRound {
                id: $roundId,
                roundNumber: $roundNum,
                startedAt: datetime(),
                status: 'active'
            })
            CREATE (race)-[:HAS_ROUND]->(round)
        `, { raceId, roundId: nextRoundId, roundNum: nextRoundNum });
        
        return {
            success: true,
            result: 'elimination',
            eliminated: lowestCandidate.candidate,
            eliminatedVotes: lowestCandidate.votes,
            nextRound: nextRoundNum,
            remainingCandidates: tallies.length - 1
        };
    } finally {
        await session.close();
    }
}

/**
 * Check if user has voted in current round
 */
async function hasUserVoted({ oderId, raceId }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (race:NominationRace {id: $raceId})-[:HAS_ROUND]->(round:VotingRound {status: 'active'})
            OPTIONAL MATCH (voter:User {id: $oderId})-[:VOTED_IN]->(round)
            RETURN round, voter
            ORDER BY round.roundNumber DESC
            LIMIT 1
        `, { raceId, oderId });
        
        if (result.records.length === 0) {
            return { hasActiveRound: false, hasVoted: false };
        }
        
        const voter = result.records[0].get('voter');
        return { 
            hasActiveRound: true, 
            hasVoted: voter !== null 
        };
    } finally {
        await session.close();
    }
}

/**
 * Get all races in voting phase for a convention
 */
async function getVotingRaces(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (conv:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            MATCH (riding)-[:LOCATED_IN]->(prov:Province)
            WHERE conv.status CONTAINS '-voting'
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            WHERE NOT EXISTS { (candidate)-[:ELIMINATED_IN]->(:VotingRound)<-[:HAS_ROUND]-(race) }
            OPTIONAL MATCH (race)-[:HAS_ROUND]->(round:VotingRound)
            WITH race, riding, prov, 
                 collect(DISTINCT candidate) as candidates,
                 max(round.roundNumber) as currentRound
            RETURN race, riding, prov, candidates, currentRound
            ORDER BY prov.name, riding.name
        `, { convId });
        
        return result.records.map(record => ({
            race: record.get('race').properties,
            riding: record.get('riding').properties,
            province: record.get('prov').properties,
            candidates: record.get('candidates').map(c => c.properties),
            currentRound: toNumber(record.get('currentRound')) || 0
        }));
    } finally {
        await session.close();
    }
}

module.exports = {
    getRaceVotingStatus,
    startVotingForRace,
    castVote,
    getVoteTallies,
    closeRoundAndAdvance,
    hasUserVoted,
    getVotingRaces
};

