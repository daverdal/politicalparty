/**
 * Admin Routes
 * Super admin controls for testing and managing the convention
 */

const express = require('express');
const router = express.Router();
const { getDriver, getDatabase } = require('../config/db');

// ============================================
// AUTO-MODE SCHEDULER
// ============================================

let autoModeEnabled = false;
let schedulerInterval = null;
let lastCheck = null;
let lastAction = null;

// Start the auto-mode scheduler
function startScheduler() {
    if (schedulerInterval) return; // Already running
    
    console.log('🤖 Auto-mode scheduler started (checking every hour)');
    
    // Check immediately, then every hour
    checkAndAdvance();
    schedulerInterval = setInterval(checkAndAdvance, 60 * 60 * 1000); // 1 hour
}

// Stop the scheduler
function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('🛑 Auto-mode scheduler stopped');
    }
}

// Check dates and advance if needed
async function checkAndAdvance() {
    if (!autoModeEnabled) return;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    lastCheck = new Date().toISOString();
    
    try {
        // Get active convention
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
        
        // Check each wave's dates
        for (let wave = 1; wave <= 6; wave++) {
            const nomStart = conv[`wave${wave}NominationStart`];
            const nomEnd = conv[`wave${wave}NominationEnd`];
            const voteStart = conv[`wave${wave}VotingStart`];
            const voteEnd = conv[`wave${wave}VotingEnd`];
            
            // Convert Neo4j dates to JS dates
            const nomStartDate = nomStart ? new Date(nomStart.toString()) : null;
            const nomEndDate = nomEnd ? new Date(nomEnd.toString()) : null;
            const voteStartDate = voteStart ? new Date(voteStart.toString()) : null;
            const voteEndDate = voteEnd ? new Date(voteEnd.toString()) : null;
            
            // Should we be in nominations for this wave?
            if (nomStartDate && nomEndDate && now >= nomStartDate && now <= nomEndDate) {
                const expectedStatus = `wave${wave}-nominations`;
                if (currentStatus !== expectedStatus && !currentStatus.includes(`wave${wave}`)) {
                    await autoAdvanceTo(session, conv.id, expectedStatus, wave);
                    return;
                }
            }
            
            // Should we be in voting for this wave?
            if (voteStartDate && voteEndDate && now >= voteStartDate && now <= voteEndDate) {
                const expectedStatus = `wave${wave}-voting`;
                if (currentStatus !== expectedStatus) {
                    await autoAdvanceTo(session, conv.id, expectedStatus, wave);
                    return;
                }
            }
        }
        
        // Check if all waves are done
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

// Auto-advance to a specific phase
async function autoAdvanceTo(session, convId, newStatus, wave) {
    console.log(`🤖 Auto-advancing to: ${newStatus}`);
    
    await session.run(`
        MATCH (c:Convention {id: $convId})
        SET c.status = $newStatus, c.currentWave = $wave
    `, { convId, newStatus, wave });
    
    // Create races if entering nominations
    if (newStatus.endsWith('-nominations')) {
        const raceInfo = await createRacesForWave(session, convId, wave);
        lastAction = `${new Date().toISOString()}: Advanced to ${newStatus}, created ${raceInfo.racesCreated} races`;
        console.log(`🏁 Auto-created ${raceInfo.racesCreated} races for Wave ${wave}`);
    } else {
        lastAction = `${new Date().toISOString()}: Advanced to ${newStatus}`;
    }
}

// GET /api/admin/auto-mode - Get auto-mode status
router.get('/auto-mode', (req, res) => {
    res.json({
        enabled: autoModeEnabled,
        lastCheck,
        lastAction,
        schedulerRunning: !!schedulerInterval
    });
});

// POST /api/admin/auto-mode - Toggle auto-mode
router.post('/auto-mode', (req, res) => {
    const { enabled } = req.body;
    
    autoModeEnabled = !!enabled;
    
    if (autoModeEnabled) {
        startScheduler();
    } else {
        stopScheduler();
    }
    
    res.json({
        success: true,
        enabled: autoModeEnabled,
        message: autoModeEnabled ? '🤖 Auto-mode enabled! System will check dates every hour.' : '🎮 Manual mode enabled. Use buttons to control phases.'
    });
});

// ============================================
// END AUTO-MODE SCHEDULER
// ============================================

// Helper to convert Neo4j Integer to number
function toNumber(neo4jInt) {
    if (neo4jInt === null || neo4jInt === undefined) return 0;
    if (typeof neo4jInt === 'number') return neo4jInt;
    if (neo4jInt.toNumber) return neo4jInt.toNumber();
    if (neo4jInt.low !== undefined) return neo4jInt.low;
    return parseInt(neo4jInt) || 0;
}

// GET /api/admin/convention/:id - Get convention admin info
router.get('/convention/:id', async (req, res) => {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        const result = await session.run(`
            MATCH (c:Convention {id: $id})
            RETURN c
        `, { id: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        
        const conv = result.records[0].get('c').properties;
        res.json({
            id: conv.id,
            name: conv.name,
            status: conv.status,
            currentWave: toNumber(conv.currentWave)
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch convention' });
    } finally {
        await session.close();
    }
});

// Wave to province mapping
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

// Helper to create races for a wave
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

// POST /api/admin/convention/:id/set-phase - Manually set convention phase
router.post('/convention/:id/set-phase', async (req, res) => {
    const { status, currentWave } = req.body;
    const convId = req.params.id;
    
    // Valid statuses
    const validStatuses = [
        'upcoming',
        'wave1-nominations', 'wave1-voting',
        'wave2-nominations', 'wave2-voting',
        'wave3-nominations', 'wave3-voting',
        'wave4-nominations', 'wave4-voting',
        'wave5-nominations', 'wave5-voting',
        'wave6-nominations', 'wave6-voting',
        'completed'
    ];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
            error: 'Invalid status',
            validStatuses 
        });
    }
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Update the convention status
        await session.run(`
            MATCH (c:Convention {id: $convId})
            SET c.status = $status, c.currentWave = $currentWave
            RETURN c
        `, { convId, status, currentWave: currentWave || 0 });
        
        let raceInfo = null;
        let message = `Convention set to: ${status}`;
        
        // AUTO-CREATE RACES if entering a nominations phase
        if (status.endsWith('-nominations')) {
            const wave = currentWave || parseInt(status.replace('wave', '').replace('-nominations', ''));
            raceInfo = await createRacesForWave(session, convId, wave);
            
            if (raceInfo.racesCreated > 0) {
                message = `✅ Set to ${status}\n🏁 Auto-created ${raceInfo.racesCreated} races for Wave ${wave}: ${raceInfo.waveName}`;
            } else {
                message = `✅ Set to ${status}\n📋 Races already exist for Wave ${wave}`;
            }
        }
        
        res.json({ 
            success: true, 
            message,
            status,
            currentWave,
            racesCreated: raceInfo?.racesCreated || 0,
            waveName: raceInfo?.waveName || null
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update convention' });
    } finally {
        await session.close();
    }
});

// POST /api/admin/convention/:id/advance - Advance to next phase
router.post('/convention/:id/advance', async (req, res) => {
    const convId = req.params.id;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get current status
        const result = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c.status as status, c.currentWave as currentWave
        `, { convId });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Convention not found' });
        }
        
        const currentStatus = result.records[0].get('status');
        const currentWave = toNumber(result.records[0].get('currentWave'));
        
        // Determine next phase
        let newStatus, newWave;
        
        if (currentStatus === 'upcoming') {
            newStatus = 'wave1-nominations';
            newWave = 1;
        } else if (currentStatus.endsWith('-nominations')) {
            // Move from nominations to voting
            newStatus = currentStatus.replace('-nominations', '-voting');
            newWave = currentWave;
        } else if (currentStatus.endsWith('-voting')) {
            // Move to next wave or complete
            if (currentWave >= 6) {
                newStatus = 'completed';
                newWave = 6;
            } else {
                newStatus = `wave${currentWave + 1}-nominations`;
                newWave = currentWave + 1;
            }
        } else {
            return res.json({ message: 'Convention already completed', status: currentStatus });
        }
        
        // Update
        await session.run(`
            MATCH (c:Convention {id: $convId})
            SET c.status = $newStatus, c.currentWave = $newWave
        `, { convId, newStatus, newWave });
        
        let raceInfo = null;
        let message = `⏩ Advanced: ${currentStatus} → ${newStatus}`;
        
        // AUTO-CREATE RACES if entering a nominations phase
        if (newStatus.endsWith('-nominations')) {
            raceInfo = await createRacesForWave(session, convId, newWave);
            
            if (raceInfo.racesCreated > 0) {
                message = `⏩ Advanced to ${newStatus}\n🏁 Auto-created ${raceInfo.racesCreated} races for Wave ${newWave}: ${raceInfo.waveName}`;
            } else {
                message = `⏩ Advanced to ${newStatus}\n📋 Races already exist for Wave ${newWave}`;
            }
        }
        
        res.json({ 
            success: true, 
            previousStatus: currentStatus,
            newStatus,
            currentWave: newWave,
            message,
            racesCreated: raceInfo?.racesCreated || 0
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to advance convention' });
    } finally {
        await session.close();
    }
});

// POST /api/admin/convention/:id/create-wave-races - Create races for current wave
router.post('/convention/:id/create-wave-races', async (req, res) => {
    const convId = req.params.id;
    
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    
    try {
        // Get current wave
        const convResult = await session.run(`
            MATCH (c:Convention {id: $convId})
            RETURN c.currentWave as currentWave
        `, { convId });
        
        const currentWave = toNumber(convResult.records[0]?.get('currentWave'));
        if (!currentWave || currentWave < 1 || currentWave > 6) {
            return res.status(400).json({ 
                error: 'Invalid wave or convention not in active phase. Set to a nominations phase first.',
                currentWave
            });
        }
        
        // Use the helper function (which has proper debugging)
        const raceInfo = await createRacesForWave(session, convId, currentWave);
        
        res.json({
            success: true,
            wave: currentWave,
            provinces: raceInfo.provinces,
            racesCreated: raceInfo.racesCreated,
            debug: raceInfo.debug,
            message: raceInfo.racesCreated === 0 && raceInfo.debug
                ? `⚠️ ${raceInfo.debug}`
                : `✅ Created ${raceInfo.racesCreated} races for Wave ${currentWave}: ${raceInfo.waveName}`
        });
    } catch (error) {
        console.error('Error creating races:', error);
        res.status(500).json({ error: 'Failed to create races: ' + error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;

