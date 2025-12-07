/**
 * Admin Service
 * Business logic for admin operations and convention management
 */

const { getDriver, getDatabase } = require('../config/db');

// ============================================
// WAVE CONFIGURATION
// ============================================

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

const VALID_STATUSES = [
    'upcoming',
    'wave1-nominations', 'wave1-voting',
    'wave2-nominations', 'wave2-voting',
    'wave3-nominations', 'wave3-voting',
    'wave4-nominations', 'wave4-voting',
    'wave5-nominations', 'wave5-voting',
    'wave6-nominations', 'wave6-voting',
    'completed'
];

// ============================================
// AUTO-MODE STATE
// ============================================

let autoModeEnabled = false;
let schedulerInterval = null;
let lastCheck = null;
let lastAction = null;

// ============================================
// HELPERS
// ============================================

function toNumber(neo4jInt) {
    if (neo4jInt === null || neo4jInt === undefined) return 0;
    if (typeof neo4jInt === 'number') return neo4jInt;
    if (neo4jInt.toNumber) return neo4jInt.toNumber();
    if (neo4jInt.low !== undefined) return neo4jInt.low;
    return parseInt(neo4jInt) || 0;
}

// ============================================
// RACE CREATION
// ============================================

async function createRacesForWave(session, convId, wave) {
    const provinces = WAVE_PROVINCES[wave];
    if (!provinces) return { racesCreated: 0, debug: 'Invalid wave' };
    
    // Debug: Check how many ridings exist for these provinces
    const debugResult = await session.run(`
        MATCH (p:Province)-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
        WHERE p.code IN $provinces
        RETURN p.code as province, count(fr) as ridings
    `, { provinces });
    
    const debugInfo = debugResult.records.map(r => 
        `${r.get('province')}: ${toNumber(r.get('ridings'))} ridings`
    );
    console.log('Debug - Ridings found:', debugInfo);
    
    if (debugResult.records.length === 0) {
        return { 
            racesCreated: 0, 
            provinces,
            waveName: WAVE_NAMES[wave],
            debug: `No provinces found matching codes: ${provinces.join(', ')}. Did you run "node test_neo4j.js" to seed the database?`
        };
    }
    
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
}

// ============================================
// AUTO-MODE SCHEDULER
// ============================================

function startScheduler() {
    if (schedulerInterval) return;
    
    console.log('🤖 Auto-mode scheduler started (checking every hour)');
    
    checkAndAdvance();
    schedulerInterval = setInterval(checkAndAdvance, 60 * 60 * 1000); // 1 hour
}

function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('🛑 Auto-mode scheduler stopped');
    }
}

async function checkAndAdvance() {
    if (!autoModeEnabled) return;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    lastCheck = new Date().toISOString();
    
    try {
        const result = await session.run(`
            MATCH (c:Convention)
            WHERE c.status <> 'completed'
            RETURN c
            ORDER BY c.year DESC
            LIMIT 1
        `);
        
        if (result.records.length === 0) return;
        
        const conv = result.records[0].get('c').properties;
        const now = new Date();
        const currentStatus = conv.status;
        
        for (let wave = 1; wave <= 6; wave++) {
            const nomStart = conv[`wave${wave}NominationStart`];
            const nomEnd = conv[`wave${wave}NominationEnd`];
            const voteStart = conv[`wave${wave}VotingStart`];
            const voteEnd = conv[`wave${wave}VotingEnd`];
            
            const nomStartDate = nomStart ? new Date(nomStart.toString()) : null;
            const nomEndDate = nomEnd ? new Date(nomEnd.toString()) : null;
            const voteStartDate = voteStart ? new Date(voteStart.toString()) : null;
            const voteEndDate = voteEnd ? new Date(voteEnd.toString()) : null;
            
            if (nomStartDate && nomEndDate && now >= nomStartDate && now <= nomEndDate) {
                const expectedStatus = `wave${wave}-nominations`;
                if (currentStatus !== expectedStatus && !currentStatus.includes(`wave${wave}`)) {
                    await autoAdvanceTo(session, conv.id, expectedStatus, wave);
                    return;
                }
            }
            
            if (voteStartDate && voteEndDate && now >= voteStartDate && now <= voteEndDate) {
                const expectedStatus = `wave${wave}-voting`;
                if (currentStatus !== expectedStatus) {
                    await autoAdvanceTo(session, conv.id, expectedStatus, wave);
                    return;
                }
            }
        }
        
        const wave6VoteEnd = conv.wave6VotingEnd;
        if (wave6VoteEnd) {
            const wave6EndDate = new Date(wave6VoteEnd.toString());
            if (now > wave6EndDate && currentStatus !== 'completed') {
                await autoAdvanceTo(session, conv.id, 'completed', 6);
            }
        }
        
    } catch (error) {
        console.error('Auto-mode check error:', error.message);
    } finally {
        await session.close();
    }
}

async function autoAdvanceTo(session, convId, newStatus, wave) {
    console.log(`🤖 Auto-advancing to: ${newStatus}`);
    
    await session.run(`
        MATCH (c:Convention {id: $convId})
        SET c.status = $newStatus, c.currentWave = $wave
    `, { convId, newStatus, wave });
    
    if (newStatus.endsWith('-nominations')) {
        const raceInfo = await createRacesForWave(session, convId, wave);
        lastAction = `${new Date().toISOString()}: Advanced to ${newStatus}, created ${raceInfo.racesCreated} races`;
        console.log(`🏁 Auto-created ${raceInfo.racesCreated} races for Wave ${wave}`);
    } else {
        lastAction = `${new Date().toISOString()}: Advanced to ${newStatus}`;
    }
}

// ============================================
// PUBLIC API
// ============================================

function getAutoModeStatus() {
    return {
        enabled: autoModeEnabled,
        lastCheck,
        lastAction,
        schedulerRunning: !!schedulerInterval
    };
}

function toggleAutoMode(enabled) {
    autoModeEnabled = !!enabled;
    
    if (autoModeEnabled) {
        startScheduler();
    } else {
        stopScheduler();
    }
    
    return {
        success: true,
        enabled: autoModeEnabled,
        message: autoModeEnabled 
            ? '🤖 Auto-mode enabled! System will check dates every hour.' 
            : '🎮 Manual mode enabled. Use buttons to control phases.'
    };
}

async function getConventionAdminInfo(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $id})
            RETURN c
        `, { id: convId });
        
        if (result.records.length === 0) return null;
        
        const conv = result.records[0].get('c').properties;
        return {
            id: conv.id,
            name: conv.name,
            status: conv.status,
            currentWave: toNumber(conv.currentWave)
        };
    } finally {
        await session.close();
    }
}

async function setConventionPhase({ convId, status, currentWave }) {
    if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status. Valid: ${VALID_STATUSES.join(', ')}`);
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        await session.run(`
            MATCH (c:Convention {id: $convId})
            SET c.status = $status, c.currentWave = $currentWave
            RETURN c
        `, { convId, status, currentWave: currentWave || 0 });
        
        let raceInfo = null;
        let message = `Convention set to: ${status}`;
        
        if (status.endsWith('-nominations')) {
            const wave = currentWave || parseInt(status.replace('wave', '').replace('-nominations', ''));
            raceInfo = await createRacesForWave(session, convId, wave);
            
            message = raceInfo.racesCreated > 0
                ? `✅ Set to ${status}\n🏁 Auto-created ${raceInfo.racesCreated} races for Wave ${wave}: ${raceInfo.waveName}`
                : `✅ Set to ${status}\n📋 Races already exist for Wave ${wave}`;
        }
        
        return { 
            success: true, 
            message,
            status,
            currentWave,
            racesCreated: raceInfo?.racesCreated || 0,
            waveName: raceInfo?.waveName || null
        };
    } finally {
        await session.close();
    }
}

async function advanceConventionPhase(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c.status as status, c.currentWave as currentWave
        `, { convId });
        
        if (result.records.length === 0) {
            throw new Error('Convention not found');
        }
        
        const currentStatus = result.records[0].get('status');
        const currentWave = toNumber(result.records[0].get('currentWave'));
        
        let newStatus, newWave;
        
        if (currentStatus === 'upcoming') {
            newStatus = 'wave1-nominations';
            newWave = 1;
        } else if (currentStatus.endsWith('-nominations')) {
            newStatus = currentStatus.replace('-nominations', '-voting');
            newWave = currentWave;
        } else if (currentStatus.endsWith('-voting')) {
            if (currentWave >= 6) {
                newStatus = 'completed';
                newWave = 6;
            } else {
                newStatus = `wave${currentWave + 1}-nominations`;
                newWave = currentWave + 1;
            }
        } else {
            return { message: 'Convention already completed', status: currentStatus };
        }
        
        await session.run(`
            MATCH (c:Convention {id: $convId})
            SET c.status = $newStatus, c.currentWave = $newWave
        `, { convId, newStatus, newWave });
        
        let raceInfo = null;
        let message = `⏩ Advanced: ${currentStatus} → ${newStatus}`;
        
        if (newStatus.endsWith('-nominations')) {
            raceInfo = await createRacesForWave(session, convId, newWave);
            
            message = raceInfo.racesCreated > 0
                ? `⏩ Advanced to ${newStatus}\n🏁 Auto-created ${raceInfo.racesCreated} races for Wave ${newWave}: ${raceInfo.waveName}`
                : `⏩ Advanced to ${newStatus}\n📋 Races already exist for Wave ${newWave}`;
        }
        
        return { 
            success: true, 
            previousStatus: currentStatus,
            newStatus,
            currentWave: newWave,
            message,
            racesCreated: raceInfo?.racesCreated || 0
        };
    } finally {
        await session.close();
    }
}

async function createRacesForCurrentWave(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const convResult = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c.currentWave as currentWave
        `, { convId });
        
        const currentWave = toNumber(convResult.records[0]?.get('currentWave'));
        if (!currentWave || currentWave < 1 || currentWave > 6) {
            throw new Error('Invalid wave or convention not in active phase. Set to a nominations phase first.');
        }
        
        const raceInfo = await createRacesForWave(session, convId, currentWave);
        
        return {
            success: true,
            wave: currentWave,
            provinces: raceInfo.provinces,
            racesCreated: raceInfo.racesCreated,
            debug: raceInfo.debug,
            message: raceInfo.racesCreated === 0 && raceInfo.debug
                ? `⚠️ ${raceInfo.debug}`
                : `✅ Created ${raceInfo.racesCreated} races for Wave ${currentWave}: ${raceInfo.waveName}`
        };
    } finally {
        await session.close();
    }
}

// ============================================
// CONVENTION STATS
// ============================================

async function getConventionStats(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})
            OPTIONAL MATCH (c)-[:HAS_RACE]->(race:NominationRace)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            OPTIONAL MATCH (race)<-[:FOR_RACE]-(nom:Nomination)
            OPTIONAL MATCH (race)<-[:VOTE_FOR_RACE]-(vote:Vote)
            WITH c, 
                 count(DISTINCT race) as totalRaces,
                 count(DISTINCT candidate) as totalCandidates,
                 count(DISTINCT nom) as totalNominations,
                 count(DISTINCT vote) as totalVotes
            OPTIONAL MATCH (c)-[:HAS_RACE]->(openRace:NominationRace {status: 'open'})
            OPTIONAL MATCH (c)-[:HAS_RACE]->(votingRace:NominationRace {status: 'voting'})
            OPTIONAL MATCH (c)-[:HAS_RACE]->(closedRace:NominationRace {status: 'closed'})
            RETURN c.status as status,
                   c.currentWave as currentWave,
                   totalRaces,
                   totalCandidates,
                   totalNominations,
                   totalVotes,
                   count(DISTINCT openRace) as openRaces,
                   count(DISTINCT votingRace) as votingRaces,
                   count(DISTINCT closedRace) as closedRaces
        `, { convId });
        
        if (result.records.length === 0) return null;
        
        const r = result.records[0];
        return {
            status: r.get('status'),
            currentWave: toNumber(r.get('currentWave')),
            totalRaces: toNumber(r.get('totalRaces')),
            totalCandidates: toNumber(r.get('totalCandidates')),
            totalNominations: toNumber(r.get('totalNominations')),
            totalVotes: toNumber(r.get('totalVotes')),
            openRaces: toNumber(r.get('openRaces')),
            votingRaces: toNumber(r.get('votingRaces')),
            closedRaces: toNumber(r.get('closedRaces'))
        };
    } finally {
        await session.close();
    }
}

// ============================================
// RESET CONVENTION
// ============================================

async function resetConvention(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get stats before reset for the message
        const stats = await getConventionStats(convId);
        
        // Delete all votes for this convention's races
        await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)
            OPTIONAL MATCH (race)<-[:VOTE_FOR_RACE]-(vote:Vote)
            DETACH DELETE vote
        `, { convId });
        
        // Delete all nominations for this convention's races
        await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)
            OPTIONAL MATCH (race)<-[:FOR_RACE]-(nom:Nomination)
            DETACH DELETE nom
        `, { convId });
        
        // Remove RUNNING_IN relationships
        await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)
            OPTIONAL MATCH (u:User)-[r:RUNNING_IN]->(race)
            DELETE r
        `, { convId });
        
        // Delete all races for this convention
        await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)
            DETACH DELETE race
        `, { convId });
        
        // Reset convention status
        await session.run(`
            MATCH (c:Convention {id: $convId})
            SET c.status = 'upcoming', c.currentWave = 0
        `, { convId });
        
        return {
            success: true,
            message: `🔄 Convention Reset Complete!\n` +
                     `Deleted: ${stats?.totalRaces || 0} races, ${stats?.totalCandidates || 0} candidates, ` +
                     `${stats?.totalNominations || 0} nominations, ${stats?.totalVotes || 0} votes\n` +
                     `Status reset to: upcoming`
        };
    } finally {
        await session.close();
    }
}

// ============================================
// CREATE NEW CONVENTION
// ============================================

async function createConvention({ name, year, countryId = 'ca' }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Generate ID from year
        const convId = `conv-${year}`;
        
        // Check if convention already exists
        const existing = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c
        `, { convId });
        
        if (existing.records.length > 0) {
            throw new Error(`Convention for ${year} already exists`);
        }
        
        // Create the convention
        const result = await session.run(`
            MATCH (country:Country {id: $countryId})
            CREATE (c:Convention {
                id: $convId,
                name: $name,
                year: $year,
                status: 'upcoming',
                currentWave: 0,
                createdAt: datetime()
            })
            CREATE (c)-[:FOR_COUNTRY]->(country)
            RETURN c
        `, { convId, name, year, countryId });
        
        if (result.records.length === 0) {
            throw new Error('Failed to create convention. Make sure the country exists.');
        }
        
        const conv = result.records[0].get('c').properties;
        
        return {
            success: true,
            convention: {
                id: conv.id,
                name: conv.name,
                year: toNumber(conv.year),
                status: conv.status
            },
            message: `✅ Created "${name}" convention for ${year}`
        };
    } finally {
        await session.close();
    }
}

// ============================================
// GET ALL CONVENTIONS
// ============================================

async function getAllConventions() {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention)
            OPTIONAL MATCH (c)-[:HAS_RACE]->(race:NominationRace)
            OPTIONAL MATCH (candidate:User)-[:RUNNING_IN]->(race)
            OPTIONAL MATCH (race)-[:HAS_WINNER]->(winner:User)
            WITH c, 
                 count(DISTINCT race) as totalRaces,
                 count(DISTINCT candidate) as totalCandidates,
                 count(DISTINCT winner) as winnersDecided
            RETURN c, totalRaces, totalCandidates, winnersDecided
            ORDER BY c.year DESC
        `);
        
        return result.records.map(r => {
            const conv = r.get('c').properties;
            return {
                id: conv.id,
                name: conv.name,
                year: toNumber(conv.year),
                status: conv.status,
                currentWave: toNumber(conv.currentWave),
                totalRaces: toNumber(r.get('totalRaces')),
                totalCandidates: toNumber(r.get('totalCandidates')),
                winnersDecided: toNumber(r.get('winnersDecided'))
            };
        });
    } finally {
        await session.close();
    }
}

// ============================================
// GET CONVENTION RESULTS
// ============================================

async function getConventionResults(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get convention info
        const convResult = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c
        `, { convId });
        
        if (convResult.records.length === 0) return null;
        
        const conv = convResult.records[0].get('c').properties;
        
        // Get all races with their winners
        const racesResult = await session.run(`
            MATCH (c:Convention {id: $convId})-[:HAS_RACE]->(race:NominationRace)-[:FOR_RIDING]->(riding)
            OPTIONAL MATCH (race)-[:HAS_WINNER]->(winner:User)
            OPTIONAL MATCH (riding)<-[:HAS_FEDERAL_RIDING|HAS_PROVINCIAL_RIDING|HAS_FIRST_NATION]-(province:Province)
            RETURN race, riding, winner, province.name as provinceName, province.code as provinceCode
            ORDER BY race.wave, province.name, riding.name
        `, { convId });
        
        const racesByWave = {};
        
        racesResult.records.forEach(r => {
            const race = r.get('race').properties;
            const riding = r.get('riding').properties;
            const winner = r.get('winner')?.properties;
            const wave = toNumber(race.wave) || 1;
            
            if (!racesByWave[wave]) {
                racesByWave[wave] = {
                    waveName: WAVE_NAMES[wave],
                    races: []
                };
            }
            
            racesByWave[wave].races.push({
                raceId: race.id,
                ridingName: riding.name,
                provinceName: r.get('provinceName'),
                provinceCode: r.get('provinceCode'),
                status: race.status,
                winner: winner ? { id: winner.id, name: winner.name } : null
            });
        });
        
        return {
            id: conv.id,
            name: conv.name,
            year: toNumber(conv.year),
            status: conv.status,
            waves: racesByWave
        };
    } finally {
        await session.close();
    }
}

// ============================================
// DELETE CONVENTION
// ============================================

async function deleteConvention(convId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // First reset to clean up related data
        await resetConvention(convId);
        
        // Now delete the convention itself
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})
            WITH c, c.name as name
            DETACH DELETE c
            RETURN name
        `, { convId });
        
        if (result.records.length === 0) {
            throw new Error('Convention not found');
        }
        
        const name = result.records[0].get('name');
        
        return {
            success: true,
            message: `🗑️ Deleted convention: ${name}`
        };
    } finally {
        await session.close();
    }
}

module.exports = {
    // Auto-mode
    getAutoModeStatus,
    toggleAutoMode,
    
    // Convention management
    getConventionAdminInfo,
    setConventionPhase,
    advanceConventionPhase,
    createRacesForCurrentWave,
    getConventionStats,
    resetConvention,
    
    // Convention CRUD
    createConvention,
    getAllConventions,
    getConventionResults,
    deleteConvention,
    
    // Constants
    WAVE_PROVINCES,
    WAVE_NAMES,
    VALID_STATUSES
};

