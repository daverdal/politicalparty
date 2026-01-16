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

let autoModeEnabled = true; // Enabled by default
let schedulerInterval = null;
let lastCheck = null;
let lastAction = null;

// ============================================
// IDEA VOTING TOGGLE (GLOBAL)
// ============================================

// Simple in-memory flag that controls whether idea "likes"/supports
// are allowed. This is intentionally global (not per-location) and
// defaults to CLOSED so an admin can explicitly open voting for a
// brainstorming session.
let ideaVotingOpen = false;

// Start the scheduler automatically when this module loads
setTimeout(() => {
    if (autoModeEnabled && !schedulerInterval) {
        console.log('🤖 Auto-mode starting automatically...');
        startScheduler();
    }
}, 2000); // Small delay to let the server fully initialize

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

// ============================================
// IDEA VOTING TOGGLE (GLOBAL) API
// ============================================

function getIdeaVotingStatus() {
    return {
        open: !!ideaVotingOpen
    };
}

function setIdeaVotingStatus(open) {
    ideaVotingOpen = !!open;
    return {
        success: true,
        open: ideaVotingOpen
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
    // Block manual phase changes when Auto Mode is on
    if (autoModeEnabled) {
        throw new Error('Cannot manually change phases while Auto Mode is enabled. Disable Auto Mode first, or let the system advance automatically based on the schedule.');
    }
    
    if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status. Valid: ${VALID_STATUSES.join(', ')}`);
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Update status and handle isActive flag
        if (status === 'completed') {
            await session.run(`
                MATCH (c:Convention {id: $convId})
                SET c.status = $status, c.currentWave = $currentWave
                REMOVE c.isActive
                RETURN c
            `, { convId, status, currentWave: currentWave || 0 });
        } else {
            await session.run(`
                MATCH (c:Convention {id: $convId})
                SET c.status = $status, c.currentWave = $currentWave, c.isActive = true
                RETURN c
            `, { convId, status, currentWave: currentWave || 0 });
        }
        
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
    // Block manual advancement when Auto Mode is on
    if (autoModeEnabled) {
        throw new Error('Cannot manually advance phases while Auto Mode is enabled. Disable Auto Mode first, or let the system advance automatically based on the schedule.');
    }
    
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
        
        // Update convention status (remove isActive if completed)
        if (newStatus === 'completed') {
            await session.run(`
                MATCH (c:Convention {id: $convId})
                SET c.status = $newStatus, c.currentWave = $newWave
                REMOVE c.isActive
            `, { convId, newStatus, newWave });
        } else {
            await session.run(`
                MATCH (c:Convention {id: $convId})
                SET c.status = $newStatus, c.currentWave = $newWave
            `, { convId, newStatus, newWave });
        }
        
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
    // Block reset when Auto Mode is on
    if (autoModeEnabled) {
        throw new Error('Cannot reset convention while Auto Mode is enabled. Disable Auto Mode first.');
    }
    
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
// UPDATE CONVENTION SCHEDULE
// ============================================

async function updateConventionSchedule(convId, schedule) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Build the SET clause dynamically based on provided dates
        const setStatements = [];
        const params = { convId };
        
        for (let wave = 1; wave <= 6; wave++) {
            const fields = [
                `wave${wave}NominationStart`,
                `wave${wave}NominationEnd`,
                `wave${wave}VotingStart`,
                `wave${wave}VotingEnd`
            ];
            
            for (const field of fields) {
                if (schedule[field]) {
                    const paramName = `w${wave}${field.includes('Nomination') ? 'n' : 'v'}${field.includes('Start') ? 's' : 'e'}`;
                    setStatements.push(`c.${field} = datetime($${paramName})`);
                    params[paramName] = new Date(schedule[field]).toISOString();
                }
            }
        }
        
        if (setStatements.length === 0) {
            throw new Error('No valid dates provided');
        }
        
        const query = `
            MATCH (c:Convention {id: $convId})
            SET ${setStatements.join(', ')}
            RETURN c.name as name
        `;
        
        const result = await session.run(query, params);
        
        if (result.records.length === 0) {
            throw new Error('Convention not found');
        }
        
        const convName = result.records[0].get('name');
        
        return {
            success: true,
            message: `Schedule updated for ${convName}`
        };
    } finally {
        await session.close();
    }
}

// ============================================
// CREATE NEW CONVENTION
// ============================================

/**
 * Generate schedule dates for all 6 waves
 * Each wave: 2 weeks nomination + 1 week voting = 3 weeks
 * Total convention duration: ~18 weeks (4.5 months)
 */
function generateConventionSchedule(startDate) {
    const schedule = {};
    let currentDate = new Date(startDate);
    
    for (let wave = 1; wave <= 6; wave++) {
        // Nomination period: 2 weeks
        schedule[`wave${wave}NominationStart`] = new Date(currentDate).toISOString();
        currentDate.setDate(currentDate.getDate() + 14); // +2 weeks
        schedule[`wave${wave}NominationEnd`] = new Date(currentDate).toISOString();
        
        // Voting period: 1 week
        schedule[`wave${wave}VotingStart`] = new Date(currentDate).toISOString();
        currentDate.setDate(currentDate.getDate() + 7); // +1 week
        schedule[`wave${wave}VotingEnd`] = new Date(currentDate).toISOString();
        
        // 1 day gap before next wave
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return schedule;
}

async function createConvention({ name, year, countryId = 'ca', startDate }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Generate ID from year
        const convId = `conv-${year}`;
        
        // Check if convention already exists for this year
        const existing = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c
        `, { convId });
        
        if (existing.records.length > 0) {
            throw new Error(`Convention for ${year} already exists`);
        }
        
        // Check if there's already an active convention (not completed)
        const activeConv = await session.run(`
            MATCH (c:Convention)
            WHERE c.status <> 'completed'
            RETURN c.name as name, c.year as year, c.status as status
        `);
        
        if (activeConv.records.length > 0) {
            const active = activeConv.records[0];
            throw new Error(`Cannot create new convention. "${active.get('name')}" (${active.get('year')}) is still active with status: ${active.get('status')}. Complete or delete it first.`);
        }
        
        // Generate schedule dates (default: January 15 of convention year)
        const defaultStart = startDate || `${year}-01-15`;
        const schedule = generateConventionSchedule(defaultStart);
        
        // Create the convention with isActive flag and schedule
        const result = await session.run(`
            MATCH (country:Country {id: $countryId})
            CREATE (c:Convention {
                id: $convId,
                name: $name,
                year: $year,
                status: 'upcoming',
                currentWave: 0,
                isActive: true,
                createdAt: datetime(),
                wave1NominationStart: datetime($w1ns),
                wave1NominationEnd: datetime($w1ne),
                wave1VotingStart: datetime($w1vs),
                wave1VotingEnd: datetime($w1ve),
                wave2NominationStart: datetime($w2ns),
                wave2NominationEnd: datetime($w2ne),
                wave2VotingStart: datetime($w2vs),
                wave2VotingEnd: datetime($w2ve),
                wave3NominationStart: datetime($w3ns),
                wave3NominationEnd: datetime($w3ne),
                wave3VotingStart: datetime($w3vs),
                wave3VotingEnd: datetime($w3ve),
                wave4NominationStart: datetime($w4ns),
                wave4NominationEnd: datetime($w4ne),
                wave4VotingStart: datetime($w4vs),
                wave4VotingEnd: datetime($w4ve),
                wave5NominationStart: datetime($w5ns),
                wave5NominationEnd: datetime($w5ne),
                wave5VotingStart: datetime($w5vs),
                wave5VotingEnd: datetime($w5ve),
                wave6NominationStart: datetime($w6ns),
                wave6NominationEnd: datetime($w6ne),
                wave6VotingStart: datetime($w6vs),
                wave6VotingEnd: datetime($w6ve)
            })
            CREATE (c)-[:FOR_COUNTRY]->(country)
            RETURN c
        `, { 
            convId, name, year, countryId,
            w1ns: schedule.wave1NominationStart,
            w1ne: schedule.wave1NominationEnd,
            w1vs: schedule.wave1VotingStart,
            w1ve: schedule.wave1VotingEnd,
            w2ns: schedule.wave2NominationStart,
            w2ne: schedule.wave2NominationEnd,
            w2vs: schedule.wave2VotingStart,
            w2ve: schedule.wave2VotingEnd,
            w3ns: schedule.wave3NominationStart,
            w3ne: schedule.wave3NominationEnd,
            w3vs: schedule.wave3VotingStart,
            w3ve: schedule.wave3VotingEnd,
            w4ns: schedule.wave4NominationStart,
            w4ne: schedule.wave4NominationEnd,
            w4vs: schedule.wave4VotingStart,
            w4ve: schedule.wave4VotingEnd,
            w5ns: schedule.wave5NominationStart,
            w5ne: schedule.wave5NominationEnd,
            w5vs: schedule.wave5VotingStart,
            w5ve: schedule.wave5VotingEnd,
            w6ns: schedule.wave6NominationStart,
            w6ne: schedule.wave6NominationEnd,
            w6vs: schedule.wave6VotingStart,
            w6ve: schedule.wave6VotingEnd
        });
        
        if (result.records.length === 0) {
            throw new Error('Failed to create convention. Make sure the country exists.');
        }
        
        const conv = result.records[0].get('c').properties;
        
        // Format schedule for response
        const scheduleDisplay = `
Wave 1: ${new Date(schedule.wave1NominationStart).toLocaleDateString()} - ${new Date(schedule.wave1VotingEnd).toLocaleDateString()}
Wave 2: ${new Date(schedule.wave2NominationStart).toLocaleDateString()} - ${new Date(schedule.wave2VotingEnd).toLocaleDateString()}
Wave 3: ${new Date(schedule.wave3NominationStart).toLocaleDateString()} - ${new Date(schedule.wave3VotingEnd).toLocaleDateString()}
Wave 4: ${new Date(schedule.wave4NominationStart).toLocaleDateString()} - ${new Date(schedule.wave4VotingEnd).toLocaleDateString()}
Wave 5: ${new Date(schedule.wave5NominationStart).toLocaleDateString()} - ${new Date(schedule.wave5VotingEnd).toLocaleDateString()}
Wave 6: ${new Date(schedule.wave6NominationStart).toLocaleDateString()} - ${new Date(schedule.wave6VotingEnd).toLocaleDateString()}`;
        
        return {
            success: true,
            convention: {
                id: conv.id,
                name: conv.name,
                year: toNumber(conv.year),
                status: conv.status
            },
            schedule,
            message: `✅ Created "${name}" convention for ${year}\n\n📅 Auto-generated schedule:\n${scheduleDisplay}\n\nEnable Auto-Mode to automatically advance phases!`
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
            
            // Helper to convert Neo4j datetime to ISO string
            const toDateStr = (val) => {
                if (!val) return null;
                if (val.toString) return val.toString();
                return val;
            };
            
            return {
                id: conv.id,
                name: conv.name,
                year: toNumber(conv.year),
                status: conv.status,
                currentWave: toNumber(conv.currentWave),
                totalRaces: toNumber(r.get('totalRaces')),
                totalCandidates: toNumber(r.get('totalCandidates')),
                winnersDecided: toNumber(r.get('winnersDecided')),
                // Include all wave schedule dates
                wave1NominationStart: toDateStr(conv.wave1NominationStart),
                wave1NominationEnd: toDateStr(conv.wave1NominationEnd),
                wave1VotingStart: toDateStr(conv.wave1VotingStart),
                wave1VotingEnd: toDateStr(conv.wave1VotingEnd),
                wave2NominationStart: toDateStr(conv.wave2NominationStart),
                wave2NominationEnd: toDateStr(conv.wave2NominationEnd),
                wave2VotingStart: toDateStr(conv.wave2VotingStart),
                wave2VotingEnd: toDateStr(conv.wave2VotingEnd),
                wave3NominationStart: toDateStr(conv.wave3NominationStart),
                wave3NominationEnd: toDateStr(conv.wave3NominationEnd),
                wave3VotingStart: toDateStr(conv.wave3VotingStart),
                wave3VotingEnd: toDateStr(conv.wave3VotingEnd),
                wave4NominationStart: toDateStr(conv.wave4NominationStart),
                wave4NominationEnd: toDateStr(conv.wave4NominationEnd),
                wave4VotingStart: toDateStr(conv.wave4VotingStart),
                wave4VotingEnd: toDateStr(conv.wave4VotingEnd),
                wave5NominationStart: toDateStr(conv.wave5NominationStart),
                wave5NominationEnd: toDateStr(conv.wave5NominationEnd),
                wave5VotingStart: toDateStr(conv.wave5VotingStart),
                wave5VotingEnd: toDateStr(conv.wave5VotingEnd),
                wave6NominationStart: toDateStr(conv.wave6NominationStart),
                wave6NominationEnd: toDateStr(conv.wave6NominationEnd),
                wave6VotingStart: toDateStr(conv.wave6VotingStart),
                wave6VotingEnd: toDateStr(conv.wave6VotingEnd)
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
    // Block delete when Auto Mode is on
    if (autoModeEnabled) {
        throw new Error('Cannot delete convention while Auto Mode is enabled. Disable Auto Mode first.');
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // First reset to clean up related data (skip auto-mode check since we already checked)
        const tempAutoMode = autoModeEnabled;
        autoModeEnabled = false;
        await resetConvention(convId);
        autoModeEnabled = tempAutoMode;
        
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
    updateConventionSchedule,
    
    // Convention CRUD
    createConvention,
    getAllConventions,
    getConventionResults,
    deleteConvention,
    
    // Constants
    WAVE_PROVINCES,
    WAVE_NAMES,
    VALID_STATUSES,

    // Idea voting toggle
    getIdeaVotingStatus,
    setIdeaVotingStatus
};

