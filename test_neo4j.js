/**
 * Neo4j Database Setup & Seed Script
 * Creates constraints and populates with sample data
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const neo4j = require('neo4j-driver');
const bcrypt = require('bcryptjs');
const canadaData = require('./seed');

// Connection settings
const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

// Admin seed user (for auth system)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'daverdal@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';

// ============================================
// CONSTRAINTS
// ============================================
const CONSTRAINTS = [
    // Original constraints
    'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
    'CREATE CONSTRAINT idea_id IF NOT EXISTS FOR (i:Idea) REQUIRE i.id IS UNIQUE',
    'CREATE CONSTRAINT assembly_id IF NOT EXISTS FOR (a:AssemblyEvent) REQUIRE a.id IS UNIQUE',
    'CREATE CONSTRAINT voteSession_id IF NOT EXISTS FOR (v:VoteSession) REQUIRE v.id IS UNIQUE',
    'CREATE CONSTRAINT voteResult_id IF NOT EXISTS FOR (r:VoteResult) REQUIRE r.id IS UNIQUE',
    'CREATE CONSTRAINT priority_id IF NOT EXISTS FOR (p:CommunityPriority) REQUIRE p.id IS UNIQUE',
    // Location constraints
    'CREATE CONSTRAINT planet_id IF NOT EXISTS FOR (p:Planet) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT country_id IF NOT EXISTS FOR (c:Country) REQUIRE c.id IS UNIQUE',
    'CREATE CONSTRAINT province_id IF NOT EXISTS FOR (p:Province) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT federalRiding_id IF NOT EXISTS FOR (fr:FederalRiding) REQUIRE fr.id IS UNIQUE',
    'CREATE CONSTRAINT provincialRiding_id IF NOT EXISTS FOR (pr:ProvincialRiding) REQUIRE pr.id IS UNIQUE',
    'CREATE CONSTRAINT town_id IF NOT EXISTS FOR (t:Town) REQUIRE t.id IS UNIQUE',
    'CREATE CONSTRAINT firstNation_id IF NOT EXISTS FOR (fn:FirstNation) REQUIRE fn.id IS UNIQUE',
    'CREATE CONSTRAINT adhocGroup_id IF NOT EXISTS FOR (ag:AdhocGroup) REQUIRE ag.id IS UNIQUE',
    // Convention constraints
    'CREATE CONSTRAINT convention_id IF NOT EXISTS FOR (c:Convention) REQUIRE c.id IS UNIQUE',
    'CREATE CONSTRAINT nominationRace_id IF NOT EXISTS FOR (nr:NominationRace) REQUIRE nr.id IS UNIQUE',
    'CREATE CONSTRAINT votingRound_id IF NOT EXISTS FOR (vr:VotingRound) REQUIRE vr.id IS UNIQUE',
    'CREATE CONSTRAINT membership_id IF NOT EXISTS FOR (m:Membership) REQUIRE m.id IS UNIQUE',
    // Only ONE active convention allowed at a time (property exists only on active convention)
    'CREATE CONSTRAINT convention_active IF NOT EXISTS FOR (c:Convention) REQUIRE c.isActive IS UNIQUE'
];

// ============================================
// SEED DATA
// ============================================
const USERS = [
    // All users start as regular members - they become candidates when they accept a nomination
    { id: 'u1', name: 'Ayla Redsky', region: 'Winnipeg', bio: 'Anishinaabe organizer building local lodges for community decision-making', skills: ['public speaking', 'circle facilitation'], experience: ['urban Indigenous council'], interests: ['environment', 'education'] },
    { id: 'u2', name: 'Noah Kîsik', region: 'Toronto', bio: 'Cree educator mentoring youth in land-based learning and leadership', skills: ['teaching', 'youth work'], experience: ['friendship centre youth programs'], interests: ['youth development', 'arts'] },
    { id: 'u3', name: 'Sienna Clearwater', region: 'Vancouver', bio: 'Secwépemc small business owner supporting Indigenous entrepreneurs', skills: ['business planning', 'networking'], experience: ['community marketplace co-op'], interests: ['economy', 'small business'] },
    { id: 'u4', name: 'Elias Whitecloud', region: 'Calgary', bio: 'Dakota environmental guardian tracking water and wildlife health', skills: ['research', 'data analysis'], experience: ['watershed monitoring'], interests: ['environment', 'sustainability'] },
    { id: 'u5', name: 'Taya Medicine Lodge', region: 'Edmonton', bio: 'Cree-Métis health worker supporting community wellness circles', skills: ['healthcare', 'community outreach'], experience: ['community clinic'], interests: ['healthcare', 'mental health'] },
    { id: 'u6', name: 'Jace Thunderbird', region: 'Ottawa', bio: 'Algonquin technologist building digital tools for nation-to-nation democracy', skills: ['software development', 'project management'], experience: ['civic tech collective'], interests: ['technology', 'transparency'] },
    { id: 'u7', name: 'Élodie Wabanonik', region: 'Montreal', bio: 'Atikamekw and French cultural worker weaving languages, stories, and song', skills: ['languages', 'arts management'], experience: ['cultural festival organizer'], interests: ['culture', 'heritage'] },
    { id: 'u8', name: 'Jonas Doucette-Paul', region: 'Halifax', bio: 'Mi\'kmaq fisheries steward defending the rights of coastal communities', skills: ['marine knowledge', 'policy'], experience: ['rights-based fishery'], interests: ['environment', 'economy'] },
    { id: 'u9', name: 'Jennifer White Elk', region: 'Regina', bio: 'Nakoda-Saulteaux rights advocate and community leader', skills: ['advocacy', 'traditional knowledge'], experience: ['First Nations council'], interests: ['reconciliation', 'education'] },
    { id: 'u10', name: 'Rowan K\'jipuktuk', region: 'St. John\'s', bio: 'Mi\'kmaq energy worker planning a just transition for offshore families', skills: ['engineering', 'project management'], experience: ['energy sector'], interests: ['energy', 'jobs'] },
    { id: 'u11', name: 'Maya Fox-Walker', region: 'Kitchener', bio: 'Urban Indigenous tech worker focused on digital access for Elders and youth', skills: ['software', 'training'], experience: ['nonprofit tech lab'], interests: ['technology', 'equity'] },
    { id: 'u12', name: 'Sahir Greywolf', region: 'Mississauga', bio: 'Anishinaabe health navigator supporting new families in the city', skills: ['healthcare admin', 'multilingual'], experience: ['community health centre'], interests: ['healthcare', 'immigration'] },
    { id: 'u13', name: 'Autumn Standingbuffalo', region: 'Brandon', bio: 'Dakota agronomist helping farmers return to prairie-friendly growing', skills: ['agriculture', 'research'], experience: ['land-based extension'], interests: ['agriculture', 'environment'] },
    { id: 'u14', name: 'Louis-Pascal Manitowabi', region: 'Quebec City', bio: 'Wendat heritage defender protecting stories, language, and old places', skills: ['history', 'architecture'], experience: ['heritage advisory circle'], interests: ['heritage', 'tourism'] },
    { id: 'u15', name: 'Evelyn Cedar Bay', region: 'Victoria', bio: 'Nuu-chah-nulth Elder-in-training advocating for strong supports for seniors', skills: ['public policy', 'advocacy'], experience: ['Elders council'], interests: ['seniors', 'healthcare'] },
    { id: 'u16', name: 'Caleb Ironquill', region: 'Saskatoon', bio: 'Métis researcher lifting up rural and northern community plans', skills: ['research', 'data analysis'], experience: ['university-community partnership'], interests: ['rural development', 'economy'] },
    { id: 'u17', name: 'Kaya Riverstone', region: 'Richmond', bio: 'Haida and Chinese small business owner building bridges between trading partners', skills: ['business', 'community building'], experience: ['chamber of commerce'], interests: ['economy', 'immigration'] },
    { id: 'u18', name: 'Thomas Bear', region: 'Yellowknife', bio: 'Dene climate adaptation worker helping communities respond to thawing lands', skills: ['environmental science', 'policy'], experience: ['territorial government'], interests: ['climate', 'indigenous rights'] }
];

// For production-style installs, we start with no ideas/assemblies/votes/priorities.
const IDEAS = [];

const ASSEMBLY_EVENTS = [];

const VOTE_SESSIONS = [];

const VOTE_RESULTS = [];

const COMMUNITY_PRIORITIES = [];

// Relationships to create
const NOMINATIONS = [
    { from: 'u1', to: 'u2', message: 'Marcus has been a tireless advocate for our youth' },
    { from: 'u3', to: 'u1', message: 'Alice brings people together like no one else' },
    { from: 'u4', to: 'u5', message: 'Priya understands community health needs deeply' },
    { from: 'u2', to: 'u6', message: 'David brings fresh ideas and technical expertise' }
];

const ENDORSEMENTS = [
    { from: 'u5', to: 'u1', message: 'Strong leadership skills' },
    { from: 'u6', to: 'u3', message: 'Great business acumen' },
    { from: 'u1', to: 'u4', message: 'Environmental expertise we need' }
];

const IDEA_SUPPORTS = [];

// User locations - maps users to specific Canadian locations
// Format: { userId, locationType, locationId }
// ID format: fr-{province-code}-{riding-name-slugified} for Federal Ridings
const USER_LOCATIONS = [
    // Manitoba (code: mb)
    { userId: 'u1', locationType: 'FederalRiding', locationId: 'fr-mb-winnipeg-south-centre' },
    { userId: 'u13', locationType: 'FederalRiding', locationId: 'fr-mb-brandon-souris' },
    
    // Ontario (code: on)
    { userId: 'u2', locationType: 'FederalRiding', locationId: 'fr-on-toronto-centre' },
    { userId: 'u11', locationType: 'FederalRiding', locationId: 'fr-on-kitchener-centre' },
    { userId: 'u12', locationType: 'FederalRiding', locationId: 'fr-on-mississauga-east-cooksville' },
    { userId: 'u6', locationType: 'FederalRiding', locationId: 'fr-on-ottawa-centre' },
    
    // British Columbia (code: bc)
    { userId: 'u3', locationType: 'FederalRiding', locationId: 'fr-bc-vancouver-centre' },
    { userId: 'u15', locationType: 'FederalRiding', locationId: 'fr-bc-victoria' },
    { userId: 'u17', locationType: 'FederalRiding', locationId: 'fr-bc-richmond' },
    
    // Alberta (code: ab)
    { userId: 'u4', locationType: 'FederalRiding', locationId: 'fr-ab-calgary-centre' },
    { userId: 'u5', locationType: 'FederalRiding', locationId: 'fr-ab-edmonton-centre' },
    
    // Quebec (code: qc)
    { userId: 'u7', locationType: 'FederalRiding', locationId: 'fr-qc-papineau' },
    { userId: 'u14', locationType: 'FederalRiding', locationId: 'fr-qc-louis-h-bert' },
    
    // Atlantic - Nova Scotia (code: ns), Newfoundland (code: nl)
    { userId: 'u8', locationType: 'FederalRiding', locationId: 'fr-ns-halifax' },
    { userId: 'u10', locationType: 'FederalRiding', locationId: 'fr-nl-st-john-s-east' },
    
    // Saskatchewan (code: sk)
    { userId: 'u9', locationType: 'FederalRiding', locationId: 'fr-sk-regina-qu-appelle' },
    { userId: 'u16', locationType: 'FederalRiding', locationId: 'fr-sk-saskatoon-university' },
    
    // Territories - Northwest Territories (code: nt)
    { userId: 'u18', locationType: 'FederalRiding', locationId: 'fr-nt-northwest-territories' }
];

const EVENT_PARTICIPANTS = [
    { userId: 'u1', eventId: 'a1' },
    { userId: 'u5', eventId: 'a1' },
    { userId: 'u1', eventId: 'a2' },
    { userId: 'u2', eventId: 'a2' },
    { userId: 'u3', eventId: 'a2' },
    { userId: 'u4', eventId: 'a2' },
    { userId: 'u4', eventId: 'a3' },
    { userId: 'u1', eventId: 'a3' }
];

// ============================================
// CONVENTION SYSTEM DATA
// ============================================

// Convention Waves - West to East across Canada
const CONVENTION_WAVES = [
    { wave: 1, name: 'Pacific', provinces: ['bc', 'yt'], color: '#00d4aa' },
    { wave: 2, name: 'Mountain', provinces: ['ab', 'nt'], color: '#00c4ff' },
    { wave: 3, name: 'Prairie', provinces: ['sk', 'mb', 'nu'], color: '#ffb347' },
    { wave: 4, name: 'Central', provinces: ['on'], color: '#ff6b6b' },
    { wave: 5, name: 'Quebec', provinces: ['qc'], color: '#a855f7' },
    { wave: 6, name: 'Atlantic', provinces: ['nb', 'ns', 'pe', 'nl'], color: '#3b82f6' }
];

// Convention - Annual party convention with regional waves
// DATES SHIFTED FOR TESTING - Wave 1 starts Dec 1, 2024!
const CONVENTIONS = [
    {
        id: 'conv-2025',
        name: '2025 National Convention',
        year: 2025,
        countryId: 'ca',
        status: 'upcoming', // Use Admin page to change this!
        currentWave: 0,
        // Wave 1 - Pacific (BC, Yukon) - HAPPENING NOW!
        wave1NominationStart: '2024-12-01T00:00:00',
        wave1NominationEnd: '2024-12-14T23:59:59',
        wave1VotingStart: '2024-12-15T00:00:00',
        wave1VotingEnd: '2024-12-28T23:59:59',
        // Wave 2 - Mountain (Alberta, NWT)
        wave2NominationStart: '2025-01-01T00:00:00',
        wave2NominationEnd: '2025-01-14T23:59:59',
        wave2VotingStart: '2025-01-15T00:00:00',
        wave2VotingEnd: '2025-01-28T23:59:59',
        // Wave 3 - Prairie (SK, MB, Nunavut)
        wave3NominationStart: '2025-01-22T00:00:00',
        wave3NominationEnd: '2025-02-04T23:59:59',
        wave3VotingStart: '2025-02-05T00:00:00',
        wave3VotingEnd: '2025-02-19T23:59:59',
        // Wave 4 - Central (Ontario) - "Super Saturday"
        wave4NominationStart: '2025-02-12T00:00:00',
        wave4NominationEnd: '2025-02-25T23:59:59',
        wave4VotingStart: '2025-02-26T00:00:00',
        wave4VotingEnd: '2025-03-10T23:59:59',
        // Wave 5 - Quebec
        wave5NominationStart: '2025-03-03T00:00:00',
        wave5NominationEnd: '2025-03-16T23:59:59',
        wave5VotingStart: '2025-03-17T00:00:00',
        wave5VotingEnd: '2025-03-31T23:59:59',
        // Wave 6 - Atlantic (NB, NS, PE, NL)
        wave6NominationStart: '2025-03-24T00:00:00',
        wave6NominationEnd: '2025-04-06T23:59:59',
        wave6VotingStart: '2025-04-07T00:00:00',
        wave6VotingEnd: '2025-04-21T23:59:59',
        description: '🎮 TEST MODE - Wave 1 nominations open NOW!'
    },
    {
        id: 'conv-2024',
        name: '2024 National Convention',
        year: 2024,
        countryId: 'ca',
        status: 'completed',
        currentWave: 6,
        wave1NominationStart: '2024-02-01T00:00:00',
        wave1NominationEnd: '2024-02-15T23:59:59',
        wave1VotingStart: '2024-02-22T00:00:00',
        wave1VotingEnd: '2024-03-08T23:59:59',
        wave2NominationStart: '2024-03-01T00:00:00',
        wave2NominationEnd: '2024-03-14T23:59:59',
        wave2VotingStart: '2024-03-15T00:00:00',
        wave2VotingEnd: '2024-03-29T23:59:59',
        wave3NominationStart: '2024-03-22T00:00:00',
        wave3NominationEnd: '2024-04-04T23:59:59',
        wave3VotingStart: '2024-04-05T00:00:00',
        wave3VotingEnd: '2024-04-19T23:59:59',
        wave4NominationStart: '2024-04-12T00:00:00',
        wave4NominationEnd: '2024-04-25T23:59:59',
        wave4VotingStart: '2024-04-26T00:00:00',
        wave4VotingEnd: '2024-05-10T23:59:59',
        wave5NominationStart: '2024-05-03T00:00:00',
        wave5NominationEnd: '2024-05-16T23:59:59',
        wave5VotingStart: '2024-05-17T00:00:00',
        wave5VotingEnd: '2024-05-31T23:59:59',
        wave6NominationStart: '2024-05-24T00:00:00',
        wave6NominationEnd: '2024-06-06T23:59:59',
        wave6VotingStart: '2024-06-07T00:00:00',
        wave6VotingEnd: '2024-06-21T23:59:59',
        description: 'Annual convention - West to East regional waves with local nominations'
    }
];

// Memberships - Users must be members to vote or run
const MEMBERSHIPS = [
    // All our users are members for 2025
    { id: 'mem-u1-2025', userId: 'u1', year: 2025, status: 'active', votingRidingId: 'fr-mb-winnipeg-south-centre' },
    { id: 'mem-u2-2025', userId: 'u2', year: 2025, status: 'active', votingRidingId: 'fr-on-toronto-centre' },
    { id: 'mem-u3-2025', userId: 'u3', year: 2025, status: 'active', votingRidingId: 'fr-bc-vancouver-centre' },
    { id: 'mem-u4-2025', userId: 'u4', year: 2025, status: 'active', votingRidingId: 'fr-ab-calgary-centre' },
    { id: 'mem-u5-2025', userId: 'u5', year: 2025, status: 'active', votingRidingId: 'fr-ab-edmonton-centre' },
    { id: 'mem-u6-2025', userId: 'u6', year: 2025, status: 'active', votingRidingId: 'fr-on-ottawa-centre' },
    { id: 'mem-u7-2025', userId: 'u7', year: 2025, status: 'active', votingRidingId: 'fr-qc-papineau' },
    { id: 'mem-u8-2025', userId: 'u8', year: 2025, status: 'active', votingRidingId: 'fr-ns-halifax' },
    { id: 'mem-u9-2025', userId: 'u9', year: 2025, status: 'active', votingRidingId: 'fr-sk-regina-qu-appelle' },
    { id: 'mem-u10-2025', userId: 'u10', year: 2025, status: 'active', votingRidingId: 'fr-nl-st-john-s-east' },
    { id: 'mem-u11-2025', userId: 'u11', year: 2025, status: 'active', votingRidingId: 'fr-on-kitchener-centre' },
    { id: 'mem-u12-2025', userId: 'u12', year: 2025, status: 'active', votingRidingId: 'fr-on-mississauga-east-cooksville' },
    { id: 'mem-u13-2025', userId: 'u13', year: 2025, status: 'active', votingRidingId: 'fr-mb-brandon-souris' },
    { id: 'mem-u14-2025', userId: 'u14', year: 2025, status: 'active', votingRidingId: 'fr-qc-louis-h-bert' },
    { id: 'mem-u15-2025', userId: 'u15', year: 2025, status: 'active', votingRidingId: 'fr-bc-victoria' },
    { id: 'mem-u16-2025', userId: 'u16', year: 2025, status: 'active', votingRidingId: 'fr-sk-saskatoon-university' },
    { id: 'mem-u17-2025', userId: 'u17', year: 2025, status: 'active', votingRidingId: 'fr-bc-richmond' },
    { id: 'mem-u18-2025', userId: 'u18', year: 2025, status: 'active', votingRidingId: 'fr-nt-northwest-territories' }
];

// Nomination Races - Wave 1 (BC) is OPEN for testing!
const NOMINATION_RACES = [
    // Wave 1 - BC races (nominations open Dec 1-14)
    { id: 'race-2025-fr-bc-vancouver-centre', conventionId: 'conv-2025', ridingId: 'fr-bc-vancouver-centre', ridingType: 'FederalRiding', status: 'open', currentRound: 0, wave: 1 },
    { id: 'race-2025-fr-bc-victoria', conventionId: 'conv-2025', ridingId: 'fr-bc-victoria', ridingType: 'FederalRiding', status: 'open', currentRound: 0, wave: 1 },
    { id: 'race-2025-fr-bc-richmond', conventionId: 'conv-2025', ridingId: 'fr-bc-richmond', ridingType: 'FederalRiding', status: 'open', currentRound: 0, wave: 1 },
    { id: 'race-2025-fr-bc-burnaby-north-seymour', conventionId: 'conv-2025', ridingId: 'fr-bc-burnaby-north-seymour', ridingType: 'FederalRiding', status: 'open', currentRound: 0, wave: 1 },
    { id: 'race-2025-fr-bc-north-vancouver', conventionId: 'conv-2025', ridingId: 'fr-bc-north-vancouver', ridingType: 'FederalRiding', status: 'open', currentRound: 0, wave: 1 }
];

// Candidates who have ACCEPTED nominations (already running)
// CLEARED - we want to test the nomination flow manually
const RACE_CANDIDATES = [];

// Vancouver Centre is CONTESTED - multiple candidates!
// CLEARED - we want to test the nomination flow manually  
const ADDITIONAL_CANDIDATES = [];

// Grassroots nominations - PENDING (nominee hasn't accepted yet)
// CLEARED - we want to test the nomination flow manually
const GRASSROOTS_NOMINATIONS = [];

// ============================================
// LOCATION SEED DATA
// ============================================
// Location data is now loaded from ./seed/ directory
// See seed/index.js for all province data

// ============================================
// SETUP FUNCTIONS
// ============================================

async function testConnection(driver) {
    console.log('[1] Testing Connection...');
    try {
        await driver.verifyConnectivity();
        console.log('✓ Connected to Neo4j!');
        
        const session = driver.session({ database: DATABASE });
        try {
            const result = await session.run('CALL dbms.components() YIELD name, versions, edition');
            const record = result.records[0];
            console.log(`  Version: ${record.get('versions')[0]} (${record.get('edition')})`);
        } finally {
            await session.close();
        }
        return true;
    } catch (error) {
        console.log(`✗ Connection failed: ${error.message}`);
        return false;
    }
}

async function createConstraints(driver) {
    console.log('\n[2] Creating Constraints...');
    const session = driver.session({ database: DATABASE });
    
    try {
        for (const constraint of CONSTRAINTS) {
            await session.run(constraint);
        }
        console.log(`✓ Created ${CONSTRAINTS.length} constraints`);
    } finally {
        await session.close();
    }
}

async function clearExistingData(driver) {
    console.log('\n[3] Clearing Existing Data...');
    const session = driver.session({ database: DATABASE });
    
    try {
        await session.run('MATCH (n) DETACH DELETE n');
        console.log('✓ Cleared all existing nodes and relationships');
    } finally {
        await session.close();
    }
}

async function seedUsers(driver) {
    console.log('\n[4] Seeding Users...');
    const session = driver.session({ database: DATABASE });
    
    try {
        for (const user of USERS) {
            await session.run(`
                CREATE (u:User {
                    id: $id,
                    name: $name,
                    region: $region,
                    bio: $bio,
                    skills: $skills,
                    experience: $experience,
                    interests: $interests,
                    candidate: $candidate,
                    platform: $platform,
                    createdAt: datetime(),
                    updatedAt: datetime()
                })
            `, {
                ...user,
                candidate: user.candidate || false,
                platform: user.platform || null
            });
        }
        const candidateCount = USERS.filter(u => u.candidate).length;
        console.log(`✓ Created ${USERS.length} users (${candidateCount} candidates)`);
    } finally {
        await session.close();
    }
}

async function seedAdminUser(driver) {
    console.log('\n[4b] Seeding Admin Auth User...');
    const session = driver.session({ database: DATABASE });

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const adminId = 'admin-' + ADMIN_EMAIL.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    try {
        await session.run(
            `
            MERGE (u:User {email: $email})
            ON CREATE SET
                u.id = $id,
                u.name = $name,
                u.passwordHash = $passwordHash,
                u.role = 'admin',
                u.verifiedAt = datetime(),
                u.createdAt = datetime(),
                u.updatedAt = datetime()
            ON MATCH SET
                u.name = $name,
                u.passwordHash = $passwordHash,
                u.role = 'admin',
                u.verifiedAt = coalesce(u.verifiedAt, datetime()),
                u.updatedAt = datetime()
        `,
            {
                id: adminId,
                email: ADMIN_EMAIL.trim().toLowerCase(),
                name: ADMIN_NAME,
                passwordHash
            }
        );

        console.log(`✓ Admin auth user ensured for ${ADMIN_EMAIL} (default password: "${ADMIN_PASSWORD}")`);
    } finally {
        await session.close();
    }
}

async function seedIdeas(driver) {
    console.log('\n[5] Seeding Ideas...');
    const session = driver.session({ database: DATABASE });
    
    try {
        for (const idea of IDEAS) {
            // Create the idea
            await session.run(`
                CREATE (i:Idea {
                    id: $id,
                    title: $title,
                    description: $description,
                    tags: $tags,
                    region: $region,
                    createdAt: datetime(),
                    updatedAt: datetime()
                })
            `, idea);
            
            // Link to author
            await session.run(`
                MATCH (u:User {id: $authorId}), (i:Idea {id: $ideaId})
                CREATE (u)-[:POSTED {createdAt: datetime()}]->(i)
            `, { authorId: idea.authorId, ideaId: idea.id });
            
            // Create AMENDS relationship if applicable
            if (idea.amendsId) {
                await session.run(`
                    MATCH (i1:Idea {id: $ideaId}), (i2:Idea {id: $amendsId})
                    CREATE (i1)-[:AMENDS]->(i2)
                `, { ideaId: idea.id, amendsId: idea.amendsId });
            }
        }
        console.log(`✓ Created ${IDEAS.length} ideas with author relationships`);
    } finally {
        await session.close();
    }
}

async function seedAssemblyEvents(driver) {
    console.log('\n[6] Seeding Assembly Events...');
    const session = driver.session({ database: DATABASE });
    
    try {
        for (const event of ASSEMBLY_EVENTS) {
            await session.run(`
                CREATE (a:AssemblyEvent {
                    id: $id,
                    title: $title,
                    description: $description,
                    type: $type,
                    region: $region,
                    startTime: datetime($startTime),
                    endTime: datetime($endTime),
                    createdAt: datetime()
                })
            `, event);
        }
        console.log(`✓ Created ${ASSEMBLY_EVENTS.length} assembly events`);
    } finally {
        await session.close();
    }
}

async function seedVoteSessions(driver) {
    console.log('\n[7] Seeding Vote Sessions & Results...');
    const session = driver.session({ database: DATABASE });
    
    try {
        for (const vote of VOTE_SESSIONS) {
            await session.run(`
                CREATE (v:VoteSession {
                    id: $id,
                    question: $question,
                    type: $type,
                    createdAt: datetime()
                })
            `, vote);
            
            // Link to assembly event
            await session.run(`
                MATCH (a:AssemblyEvent {id: $assemblyId}), (v:VoteSession {id: $voteId})
                CREATE (a)-[:HAS_VOTE]->(v)
            `, { assemblyId: vote.assemblyId, voteId: vote.id });
        }
        
        for (const result of VOTE_RESULTS) {
            await session.run(`
                CREATE (r:VoteResult {
                    id: $id,
                    resultData: $resultData,
                    createdAt: datetime()
                })
            `, { id: result.id, resultData: JSON.stringify(result.resultData) });
            
            await session.run(`
                MATCH (v:VoteSession {id: $sessionId}), (r:VoteResult {id: $resultId})
                CREATE (v)-[:HAS_RESULT]->(r)
            `, { sessionId: result.sessionId, resultId: result.id });
        }
        
        console.log(`✓ Created ${VOTE_SESSIONS.length} vote sessions and ${VOTE_RESULTS.length} results`);
    } finally {
        await session.close();
    }
}

async function seedCommunityPriorities(driver) {
    console.log('\n[8] Seeding Community Priorities...');
    const session = driver.session({ database: DATABASE });
    
    try {
        for (const priority of COMMUNITY_PRIORITIES) {
            await session.run(`
                CREATE (p:CommunityPriority {
                    id: $id,
                    name: $name,
                    description: $description,
                    region: $region,
                    createdAt: datetime()
                })
            `, priority);
            
            await session.run(`
                MATCH (p:CommunityPriority {id: $priorityId}), (i:Idea {id: $ideaId})
                CREATE (p)-[:DERIVED_FROM]->(i)
            `, { priorityId: priority.id, ideaId: priority.derivedFromId });
        }
        console.log(`✓ Created ${COMMUNITY_PRIORITIES.length} community priorities`);
    } finally {
        await session.close();
    }
}

async function seedRelationships(driver) {
    console.log('\n[9] Seeding User Relationships...');
    const session = driver.session({ database: DATABASE });
    
    try {
        // Nominations
        for (const nom of NOMINATIONS) {
            await session.run(`
                MATCH (u1:User {id: $from}), (u2:User {id: $to})
                CREATE (u1)-[:NOMINATED {message: $message, createdAt: datetime()}]->(u2)
            `, nom);
        }
        console.log(`  ✓ Created ${NOMINATIONS.length} nominations`);
        
        // Endorsements
        for (const end of ENDORSEMENTS) {
            await session.run(`
                MATCH (u1:User {id: $from}), (u2:User {id: $to})
                CREATE (u1)-[:ENDORSED {message: $message, createdAt: datetime()}]->(u2)
            `, end);
        }
        console.log(`  ✓ Created ${ENDORSEMENTS.length} endorsements`);
        
        // Idea supports
        for (const support of IDEA_SUPPORTS) {
            await session.run(`
                MATCH (u:User {id: $userId}), (i:Idea {id: $ideaId})
                CREATE (u)-[:SUPPORTED {createdAt: datetime()}]->(i)
            `, support);
        }
        console.log(`  ✓ Created ${IDEA_SUPPORTS.length} idea supports`);
        
        // Event participation
        for (const part of EVENT_PARTICIPANTS) {
            await session.run(`
                MATCH (u:User {id: $userId}), (a:AssemblyEvent {id: $eventId})
                CREATE (u)-[:PARTICIPATED_IN {createdAt: datetime()}]->(a)
            `, part);
        }
        console.log(`  ✓ Created ${EVENT_PARTICIPANTS.length} event participations`);
        
    } finally {
        await session.close();
    }
}

async function seedUserLocations(driver) {
    console.log('\n[11] Seeding User Locations...');
    const session = driver.session({ database: DATABASE });
    
    try {
        let created = 0;
        for (const loc of USER_LOCATIONS) {
            try {
                await session.run(`
                    MATCH (u:User {id: $userId}), (loc:${loc.locationType} {id: $locationId})
                    MERGE (u)-[:LOCATED_IN {createdAt: datetime()}]->(loc)
                `, { userId: loc.userId, locationId: loc.locationId });
                created++;
            } catch (err) {
                console.log(`  ⚠ Could not link user ${loc.userId} to ${loc.locationId}: ${err.message}`);
            }
        }
        console.log(`  ✓ Created ${created} user location relationships`);
    } finally {
        await session.close();
    }
}

async function seedConventions(driver) {
    console.log('\n[12] Seeding Convention System...');
    const session = driver.session({ database: DATABASE });
    
    try {
        // First, update provinces with their wave assignments
        console.log('  Assigning provinces to waves...');
        for (const wave of CONVENTION_WAVES) {
            for (const provCode of wave.provinces) {
                await session.run(`
                    MATCH (p:Province {code: $code})
                    SET p.wave = $wave, p.waveName = $waveName, p.waveColor = $color
                `, { code: provCode.toUpperCase(), wave: wave.wave, waveName: wave.name, color: wave.color });
            }
        }
        console.log(`  ✓ Assigned ${CONVENTION_WAVES.length} waves to provinces`);
        
        // Create Conventions
        console.log('  Creating conventions...');
        for (const conv of CONVENTIONS) {
            await session.run(`
                CREATE (c:Convention {
                    id: $id,
                    name: $name,
                    year: $year,
                    status: $status,
                    currentWave: $currentWave,
                    wave1NominationStart: datetime($wave1NominationStart),
                    wave1NominationEnd: datetime($wave1NominationEnd),
                    wave1VotingStart: datetime($wave1VotingStart),
                    wave1VotingEnd: datetime($wave1VotingEnd),
                    wave2NominationStart: datetime($wave2NominationStart),
                    wave2NominationEnd: datetime($wave2NominationEnd),
                    wave2VotingStart: datetime($wave2VotingStart),
                    wave2VotingEnd: datetime($wave2VotingEnd),
                    wave3NominationStart: datetime($wave3NominationStart),
                    wave3NominationEnd: datetime($wave3NominationEnd),
                    wave3VotingStart: datetime($wave3VotingStart),
                    wave3VotingEnd: datetime($wave3VotingEnd),
                    wave4NominationStart: datetime($wave4NominationStart),
                    wave4NominationEnd: datetime($wave4NominationEnd),
                    wave4VotingStart: datetime($wave4VotingStart),
                    wave4VotingEnd: datetime($wave4VotingEnd),
                    wave5NominationStart: datetime($wave5NominationStart),
                    wave5NominationEnd: datetime($wave5NominationEnd),
                    wave5VotingStart: datetime($wave5VotingStart),
                    wave5VotingEnd: datetime($wave5VotingEnd),
                    wave6NominationStart: datetime($wave6NominationStart),
                    wave6NominationEnd: datetime($wave6NominationEnd),
                    wave6VotingStart: datetime($wave6VotingStart),
                    wave6VotingEnd: datetime($wave6VotingEnd),
                    description: $description,
                    createdAt: datetime()
                })
            `, conv);
            
            // Link to country
            await session.run(`
                MATCH (conv:Convention {id: $convId}), (c:Country {id: $countryId})
                CREATE (conv)-[:FOR_COUNTRY]->(c)
            `, { convId: conv.id, countryId: conv.countryId });
        }
        console.log(`  ✓ Created ${CONVENTIONS.length} conventions`);
        
        // Create Memberships
        console.log('  Creating memberships...');
        for (const mem of MEMBERSHIPS) {
            await session.run(`
                CREATE (m:Membership {
                    id: $id,
                    year: $year,
                    status: $status,
                    createdAt: datetime()
                })
            `, mem);
            
            // Link membership to user
            await session.run(`
                MATCH (u:User {id: $userId}), (m:Membership {id: $memId})
                CREATE (u)-[:HAS_MEMBERSHIP]->(m)
            `, { userId: mem.userId, memId: mem.id });
            
            // Link membership to voting riding (where they can vote)
            await session.run(`
                MATCH (m:Membership {id: $memId}), (r:FederalRiding {id: $ridingId})
                CREATE (m)-[:VOTES_IN]->(r)
            `, { memId: mem.id, ridingId: mem.votingRidingId });
        }
        console.log(`  ✓ Created ${MEMBERSHIPS.length} memberships`);
        
        // Create Nomination Races
        console.log('  Creating nomination races...');
        for (const race of NOMINATION_RACES) {
            await session.run(`
                CREATE (nr:NominationRace {
                    id: $id,
                    status: $status,
                    currentRound: $currentRound,
                    createdAt: datetime()
                })
            `, race);
            
            // Link to convention
            await session.run(`
                MATCH (conv:Convention {id: $convId}), (nr:NominationRace {id: $raceId})
                CREATE (conv)-[:HAS_RACE]->(nr)
            `, { convId: race.conventionId, raceId: race.id });
            
            // Link to riding
            await session.run(`
                MATCH (nr:NominationRace {id: $raceId}), (r:${race.ridingType} {id: $ridingId})
                CREATE (nr)-[:FOR_RIDING]->(r)
            `, { raceId: race.id, ridingId: race.ridingId });
        }
        console.log(`  ✓ Created ${NOMINATION_RACES.length} nomination races`);
        
        // Add candidates to races
        console.log('  Adding candidates to races...');
        const allCandidates = [...RACE_CANDIDATES, ...ADDITIONAL_CANDIDATES];
        for (const cand of allCandidates) {
            try {
                await session.run(`
                    MATCH (u:User {id: $userId}), (nr:NominationRace {id: $raceId})
                    CREATE (u)-[:RUNNING_IN {nominatedAt: datetime($nominatedAt)}]->(nr)
                `, { userId: cand.candidateId, raceId: cand.raceId, nominatedAt: cand.nominatedAt });
            } catch (err) {
                console.log(`    ⚠ Could not add candidate ${cand.candidateId} to race: ${err.message}`);
            }
        }
        console.log(`  ✓ Added ${allCandidates.length} candidates to races`);
        
        // Add grassroots nominations (people nominating others)
        console.log('  Adding grassroots nominations...');
        for (const nom of GRASSROOTS_NOMINATIONS) {
            try {
                // Create the race if it doesn't exist
                await session.run(`
                    MERGE (nr:NominationRace {id: $raceId})
                    ON CREATE SET nr.status = 'open', nr.currentRound = 0, nr.createdAt = datetime()
                    WITH nr
                    MATCH (conv:Convention {id: 'conv-2025'})
                    MERGE (conv)-[:HAS_RACE]->(nr)
                    WITH nr
                    MATCH (r:FederalRiding {id: $ridingId})
                    MERGE (nr)-[:FOR_RIDING]->(r)
                `, { raceId: nom.raceId, ridingId: nom.ridingId });
                
                // Create the nomination relationship
                await session.run(`
                    MATCH (nominator:User {id: $nominatorId}), (nominee:User {id: $nomineeId})
                    CREATE (nominator)-[:NOMINATED_FOR_RACE {
                        raceId: $raceId,
                        ridingId: $ridingId,
                        conventionId: 'conv-2025',
                        message: $message,
                        createdAt: datetime()
                    }]->(nominee)
                `, nom);
            } catch (err) {
                console.log(`    ⚠ Could not create nomination: ${err.message}`);
            }
        }
        console.log(`  ✓ Added ${GRASSROOTS_NOMINATIONS.length} grassroots nominations`);
        
    } finally {
        await session.close();
    }
}

// Helper to generate ID from name
function generateId(prefix, name) {
    return prefix + '-' + name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
}

// ============================================
// FIRST NATION COORDINATES (canadaFNs GeoJSON)
// ============================================

let firstNationCoordsIndex = null;
let firstNationCoordsFeatures = null; // flat list with lat/lon for bbox queries

function canonicalFirstNationName(name) {
    if (!name) return '';
    let n = String(name).toLowerCase();
    // Remove common suffixes like "First Nation", "First Nations", "Nation"
    n = n.replace(/\bfirst nations?\b/g, '');
    n = n.replace(/\bnations?\b/g, '');
    // Collapse whitespace and trim
    n = n.replace(/\s+/g, ' ').trim();
    return n;
}

function loadFirstNationCoordsIndex() {
    if (firstNationCoordsIndex !== null) return firstNationCoordsIndex;

    const filePath = path.join(__dirname, 'Documents', 'canadaFNs');
    const index = {};
    const featuresForBbox = [];

    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const geo = JSON.parse(raw);
        const features = Array.isArray(geo.features) ? geo.features : [];

        for (const feature of features) {
            if (!feature || !feature.properties || !feature.geometry) continue;
            const bandName = feature.properties.BAND_NAME;
            if (!bandName) continue;
            const coords = feature.geometry.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            const [lon, lat] = coords;
            if (typeof lat !== 'number' || typeof lon !== 'number') continue;

            const key = canonicalFirstNationName(bandName);
            if (!key) continue;

            // For name lookup, only keep the first occurrence for a given canonical name
            if (!index[key]) {
                index[key] = { lat, lon, bandName };
            }

            // For bbox queries, keep every feature as-is
            featuresForBbox.push({ name: bandName, lat, lon });
        }

        console.log(`[seed] Loaded First Nation coordinates from canadaFNs (unique names: ${Object.keys(index).length})`);
    } catch (err) {
        console.log(`[seed] Could not load Documents/canadaFNs: ${err.message}`);
    }

    firstNationCoordsFeatures = featuresForBbox;
    firstNationCoordsIndex = index;
    return firstNationCoordsIndex;
}

function getAllFirstNationFeatures() {
    if (!firstNationCoordsFeatures) {
        loadFirstNationCoordsIndex();
    }
    return firstNationCoordsFeatures || [];
}

// Rough geographic bounding boxes for provinces/territories that
// do NOT yet have explicit firstNation seed lists.
// These are approximate but good enough for visual maps.
const PROVINCE_BBOXES = {
    ON: { // Ontario
        minLat: 41.5, maxLat: 57.5,
        minLon: -95.5, maxLon: -74.0
    },
    QC: { // Quebec
        minLat: 44.5, maxLat: 62.5,
        minLon: -79.5, maxLon: -57.0
    },
    NB: { // New Brunswick
        minLat: 44.0, maxLat: 48.5,
        minLon: -69.5, maxLon: -63.0
    },
    NS: { // Nova Scotia
        minLat: 43.0, maxLat: 47.5,
        minLon: -66.5, maxLon: -59.0
    },
    PE: { // Prince Edward Island
        minLat: 45.8, maxLat: 47.2,
        minLon: -64.8, maxLon: -61.0
    },
    NL: { // Newfoundland & Labrador
        minLat: 46.0, maxLat: 61.0,
        minLon: -67.5, maxLon: -52.0
    },
    NT: { // Northwest Territories
        minLat: 60.0, maxLat: 70.5,
        minLon: -136.0, maxLon: -102.0
    },
    NU: { // Nunavut (very large)
        minLat: 60.0, maxLat: 84.0,
        minLon: -112.0, maxLon: -60.0
    },
    YT: { // Yukon
        minLat: 59.0, maxLat: 70.5,
        minLon: -141.5, maxLon: -123.0
    }
};

function getFirstNationsForProvinceByBbox(provinceCode) {
    const code = String(provinceCode || '').toUpperCase();
    const box = PROVINCE_BBOXES[code];
    if (!box) return [];

    const all = getAllFirstNationFeatures();
    const { minLat, maxLat, minLon, maxLon } = box;

    return all.filter(f =>
        f.lat >= minLat && f.lat <= maxLat &&
        f.lon >= minLon && f.lon <= maxLon
    );
}

async function seedLocations(driver) {
    console.log('\n[10] Seeding Locations (using MERGE - only creates if not exists)...');
    const session = driver.session({ database: DATABASE });
    const coordsIndex = loadFirstNationCoordsIndex();
    
    // Get all provinces from seed files
    const allProvinces = canadaData.getAllProvinces();
    
    // Counters
    let stats = {
        planets: 0,
        countries: 0,
        provinces: 0,
        federalRidings: 0,
        provincialRidings: 0,
        towns: 0,
        firstNations: 0,
        adhocGroups: 0
    };
    
    try {
        // Create Earth
        await session.run(`
            MERGE (p:Planet {id: 'earth'})
            ON CREATE SET p.name = 'Earth', p.createdAt = datetime()
        `);
        stats.planets++;
        console.log('  ✓ Planet: Earth');
        
        // Create Canada
        await session.run(`
            MERGE (c:Country {id: 'ca'})
            ON CREATE SET c.name = 'Canada', c.code = 'CA', c.createdAt = datetime()
        `);
        await session.run(`
            MATCH (p:Planet {id: 'earth'}), (c:Country {id: 'ca'})
            MERGE (p)-[:HAS_COUNTRY]->(c)
        `);
        stats.countries++;
        console.log('  ✓ Country: Canada');
        
        // Process each province
        for (const provData of allProvinces) {
            const prov = provData.province;
            console.log(`\n  Processing ${prov.name}...`);
            
            // Create Province
            await session.run(`
                MERGE (p:Province {id: $id})
                ON CREATE SET p.name = $name, p.code = $code, p.createdAt = datetime()
            `, { id: prov.id, name: prov.name, code: prov.code });
            
            await session.run(`
                MATCH (c:Country {id: 'ca'}), (p:Province {id: $provinceId})
                MERGE (c)-[:HAS_PROVINCE]->(p)
            `, { provinceId: prov.id });
            stats.provinces++;
            
            // Federal Ridings
            if (provData.federalRidings && provData.federalRidings.length > 0) {
                for (const name of provData.federalRidings) {
                    const id = generateId('fr-' + prov.code.toLowerCase(), name);
                    await session.run(`
                        MERGE (fr:FederalRiding {id: $id})
                        ON CREATE SET fr.name = $name, fr.createdAt = datetime()
                    `, { id, name });
                    await session.run(`
                        MATCH (p:Province {id: $provinceId}), (fr:FederalRiding {id: $ridingId})
                        MERGE (p)-[:HAS_FEDERAL_RIDING]->(fr)
                    `, { provinceId: prov.id, ridingId: id });
                    stats.federalRidings++;
                }
                console.log(`    ✓ ${provData.federalRidings.length} federal ridings`);
            }
            
            // Provincial Ridings
            if (provData.provincialRidings && provData.provincialRidings.length > 0) {
                for (const name of provData.provincialRidings) {
                    const id = generateId('pr-' + prov.code.toLowerCase(), name);
                    await session.run(`
                        MERGE (pr:ProvincialRiding {id: $id})
                        ON CREATE SET pr.name = $name, pr.createdAt = datetime()
                    `, { id, name });
                    await session.run(`
                        MATCH (p:Province {id: $provinceId}), (pr:ProvincialRiding {id: $ridingId})
                        MERGE (p)-[:HAS_PROVINCIAL_RIDING]->(pr)
                    `, { provinceId: prov.id, ridingId: id });
                    stats.provincialRidings++;
                }
                console.log(`    ✓ ${provData.provincialRidings.length} provincial ridings`);
            }
            
            // Towns
            if (provData.towns && provData.towns.length > 0) {
                for (const name of provData.towns) {
                    const id = generateId('town-' + prov.code.toLowerCase(), name);
                    await session.run(`
                        MERGE (t:Town {id: $id})
                        ON CREATE SET t.name = $name, t.createdAt = datetime()
                    `, { id, name });
                    await session.run(`
                        MATCH (p:Province {id: $provinceId}), (t:Town {id: $townId})
                        MERGE (p)-[:HAS_TOWN]->(t)
                    `, { provinceId: prov.id, townId: id });
                    stats.towns++;
                }
                console.log(`    ✓ ${provData.towns.length} towns`);
            }
            
            // First Nations - primary source is per-province seed lists
            if (provData.firstNations && provData.firstNations.length > 0) {
                for (const entry of provData.firstNations) {
                    const name = typeof entry === 'string' ? entry : entry.name;

                    let lat = (entry && typeof entry === 'object' && entry.lat != null) ? Number(entry.lat) : null;
                    let lon = (entry && typeof entry === 'object' && entry.lon != null) ? Number(entry.lon) : null;

                    // If no explicit lat/lon in the seed data, try to look it up from the canadaFNs GeoJSON
                    if ((lat == null || Number.isNaN(lat) || lon == null || Number.isNaN(lon)) && coordsIndex) {
                        const key = canonicalFirstNationName(name);
                        const match = coordsIndex[key];
                        if (match) {
                            lat = match.lat;
                            lon = match.lon;
                        }
                    }

                    const id = generateId('fn-' + prov.code.toLowerCase(), name);
                    await session.run(`
                        MERGE (fn:FirstNation {id: $id})
                        ON CREATE SET fn.name = $name, fn.createdAt = datetime()
                        SET fn.lat = $lat, fn.lon = $lon
                    `, { id, name, lat, lon });
                    await session.run(`
                        MATCH (p:Province {id: $provinceId}), (fn:FirstNation {id: $fnId})
                        MERGE (p)-[:HAS_FIRST_NATION]->(fn)
                    `, { provinceId: prov.id, fnId: id });
                    stats.firstNations++;
                }
                console.log(`    ✓ ${provData.firstNations.length} First Nations (seed lists)`);
            } else {
                // If the province/territory doesn't yet have a manual list,
                // fall back to canadaFNs + rough bounding box so every region gets a map.
                const autoFNs = getFirstNationsForProvinceByBbox(prov.code);
                if (autoFNs.length > 0) {
                    for (const fn of autoFNs) {
                        const name = fn.name;
                        const lat = fn.lat;
                        const lon = fn.lon;
                        const id = generateId('fn-' + prov.code.toLowerCase(), name);

                        await session.run(`
                            MERGE (fn:FirstNation {id: $id})
                            ON CREATE SET fn.name = $name, fn.createdAt = datetime()
                            SET fn.lat = $lat, fn.lon = $lon
                        `, { id, name, lat, lon });
                        await session.run(`
                            MATCH (p:Province {id: $provinceId}), (fn:FirstNation {id: $fnId})
                            MERGE (p)-[:HAS_FIRST_NATION]->(fn)
                        `, { provinceId: prov.id, fnId: id });
                        stats.firstNations++;
                    }
                    console.log(`    ✓ ${autoFNs.length} First Nations (from canadaFNs bbox)`);
                } else {
                    console.log('    • No First Nations seed data or bbox matches for this province/territory yet');
                }
            }
            
            // Adhoc Groups
            if (provData.adhocGroups && provData.adhocGroups.length > 0) {
                for (const name of provData.adhocGroups) {
                    const id = generateId('ag-' + prov.code.toLowerCase(), name);
                    await session.run(`
                        MERGE (ag:AdhocGroup {id: $id})
                        ON CREATE SET ag.name = $name, ag.createdAt = datetime()
                    `, { id, name });
                    await session.run(`
                        MATCH (p:Province {id: $provinceId}), (ag:AdhocGroup {id: $groupId})
                        MERGE (p)-[:HAS_ADHOC_GROUP]->(ag)
                    `, { provinceId: prov.id, groupId: id });
                    stats.adhocGroups++;
                }
                console.log(`    ✓ ${provData.adhocGroups.length} adhoc groups`);
            }
        }
        
        console.log('\n  ─────────────────────────────────────');
        console.log(`  Location Seeding Complete:`);
        console.log(`    Planets: ${stats.planets}`);
        console.log(`    Countries: ${stats.countries}`);
        console.log(`    Provinces: ${stats.provinces}`);
        console.log(`    Federal Ridings: ${stats.federalRidings}`);
        console.log(`    Provincial Ridings: ${stats.provincialRidings}`);
        console.log(`    Towns: ${stats.towns}`);
        console.log(`    First Nations: ${stats.firstNations}`);
        console.log(`    Adhoc Groups: ${stats.adhocGroups}`);
        
    } finally {
        await session.close();
    }
}

async function showSummary(driver) {
    console.log('\n[13] Database Summary...');
    const session = driver.session({ database: DATABASE });
    
    try {
        const counts = await session.run(`
            MATCH (u:User) WITH count(u) as users
            MATCH (i:Idea) WITH users, count(i) as ideas
            MATCH (a:AssemblyEvent) WITH users, ideas, count(a) as events
            MATCH (v:VoteSession) WITH users, ideas, events, count(v) as votes
            MATCH (p:CommunityPriority) WITH users, ideas, events, votes, count(p) as priorities
            MATCH (c:Country) WITH users, ideas, events, votes, priorities, count(c) as countries
            MATCH (prov:Province) WITH users, ideas, events, votes, priorities, countries, count(prov) as provinces
            MATCH (fr:FederalRiding) WITH users, ideas, events, votes, priorities, countries, provinces, count(fr) as fedRidings
            MATCH (pr:ProvincialRiding) WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, count(pr) as provRidings
            MATCH (t:Town) WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, count(t) as towns
            MATCH (fn:FirstNation) WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, count(fn) as firstNations
            MATCH (conv:Convention) WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, count(conv) as conventions
            MATCH (nr:NominationRace) WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, conventions, count(nr) as races
            MATCH (m:Membership) WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, conventions, races, count(m) as memberships
            MATCH ()-[r]->() WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, conventions, races, memberships, count(r) as relationships
            RETURN users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, conventions, races, memberships, relationships
        `);
        
        const record = counts.records[0];
        console.log('┌─────────────────────────────────────┐');
        console.log('│         DATABASE POPULATED          │');
        console.log('├─────────────────────────────────────┤');
        console.log(`│  Users:              ${String(record.get('users')).padStart(10)}   │`);
        console.log(`│  Ideas:              ${String(record.get('ideas')).padStart(10)}   │`);
        console.log(`│  Assembly Events:    ${String(record.get('events')).padStart(10)}   │`);
        console.log(`│  Vote Sessions:      ${String(record.get('votes')).padStart(10)}   │`);
        console.log('├─────────────────────────────────────┤');
        console.log('│  LOCATIONS                          │');
        console.log(`│  Countries:          ${String(record.get('countries')).padStart(10)}   │`);
        console.log(`│  Provinces:          ${String(record.get('provinces')).padStart(10)}   │`);
        console.log(`│  Federal Ridings:    ${String(record.get('fedRidings')).padStart(10)}   │`);
        console.log(`│  Provincial Ridings: ${String(record.get('provRidings')).padStart(10)}   │`);
        console.log(`│  Towns/Cities:       ${String(record.get('towns')).padStart(10)}   │`);
        console.log(`│  First Nations:      ${String(record.get('firstNations')).padStart(10)}   │`);
        console.log('├─────────────────────────────────────┤');
        console.log('│  CONVENTION SYSTEM                  │');
        console.log(`│  Conventions:        ${String(record.get('conventions')).padStart(10)}   │`);
        console.log(`│  Nomination Races:   ${String(record.get('races')).padStart(10)}   │`);
        console.log(`│  Memberships:        ${String(record.get('memberships')).padStart(10)}   │`);
        console.log('├─────────────────────────────────────┤');
        console.log(`│  Total Relationships:${String(record.get('relationships')).padStart(10)}   │`);
        console.log('└─────────────────────────────────────┘');
        
    } finally {
        await session.close();
    }
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('═'.repeat(50));
    console.log('  POLITICAL PARTY - Neo4j Database Setup');
    console.log(`  Database: ${DATABASE}`);
    console.log('═'.repeat(50));
    
    const driver = neo4j.driver(URI, neo4j.auth.basic(USERNAME, PASSWORD));
    
    try {
        const connected = await testConnection(driver);
        if (!connected) {
            console.log('\n⚠️  Cannot proceed without database connection.');
            return;
        }
        
        await createConstraints(driver);
        await clearExistingData(driver);
        await seedUsers(driver);
        await seedAdminUser(driver);
        await seedIdeas(driver);
        await seedAssemblyEvents(driver);
        await seedVoteSessions(driver);
        await seedCommunityPriorities(driver);
        await seedRelationships(driver);
        await seedLocations(driver);
        await seedUserLocations(driver);
        await seedConventions(driver);
        await showSummary(driver);
        
        console.log('\n═'.repeat(50));
        console.log('  ✓ Setup complete! Your database is ready.');
        console.log('═'.repeat(50));
        
    } finally {
        await driver.close();
    }
}

main().catch(console.error);
