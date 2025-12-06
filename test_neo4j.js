/**
 * Neo4j Database Setup & Seed Script
 * Creates constraints and populates with sample data
 */

require('dotenv').config();
const neo4j = require('neo4j-driver');
const canadaData = require('./seed');

// Connection settings
const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD || 'Dwall123';
const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

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
    'CREATE CONSTRAINT adhocGroup_id IF NOT EXISTS FOR (ag:AdhocGroup) REQUIRE ag.id IS UNIQUE'
];

// ============================================
// SEED DATA
// ============================================
const USERS = [
    // Original users (now with Canadian locations) - some are candidates
    { id: 'u1', name: 'Alice Chen', region: 'Winnipeg', bio: 'Community organizer passionate about local governance', skills: ['public speaking', 'event planning'], experience: ['city council liaison'], interests: ['environment', 'education'], candidate: true, platform: 'Fighting for affordable housing and green energy in Winnipeg South Centre' },
    { id: 'u2', name: 'Marcus Johnson', region: 'Toronto', bio: 'Retired teacher advocating for youth programs', skills: ['teaching', 'writing'], experience: ['school board member'], interests: ['youth development', 'arts'], candidate: true, platform: 'Investing in education and youth opportunities across Toronto' },
    { id: 'u3', name: 'Sofia Rodriguez', region: 'Vancouver', bio: 'Small business owner focused on economic development', skills: ['business planning', 'networking'], experience: ['chamber of commerce'], interests: ['economy', 'small business'], candidate: false },
    { id: 'u4', name: 'James Wilson', region: 'Calgary', bio: 'Environmental scientist working on sustainability', skills: ['research', 'data analysis'], experience: ['EPA consultant'], interests: ['environment', 'sustainability'], candidate: true, platform: 'Science-based climate action and green jobs for Alberta' },
    { id: 'u5', name: 'Priya Patel', region: 'Edmonton', bio: 'Healthcare worker advocating for community health', skills: ['healthcare', 'community outreach'], experience: ['hospital administrator'], interests: ['healthcare', 'mental health'], candidate: true, platform: 'Universal healthcare access and mental health support for all Albertans' },
    { id: 'u6', name: 'David Kim', region: 'Ottawa', bio: 'Tech entrepreneur interested in civic innovation', skills: ['software development', 'project management'], experience: ['startup founder'], interests: ['technology', 'transparency'], candidate: true, platform: 'Open government, digital services, and tech sector growth' },
    
    // New Canadian users in various ridings - some are candidates
    { id: 'u7', name: 'Marie Tremblay', region: 'Montreal', bio: 'Cultural advocate promoting bilingual communities', skills: ['languages', 'arts management'], experience: ['festival organizer'], interests: ['culture', 'heritage'], candidate: true, platform: 'Celebrating our bilingual heritage and supporting the arts' },
    { id: 'u8', name: 'Robert MacKenzie', region: 'Halifax', bio: 'Fisheries expert advocating for coastal communities', skills: ['marine biology', 'policy'], experience: ['fisheries board'], interests: ['environment', 'economy'], candidate: true, platform: 'Sustainable fisheries and coastal community resilience' },
    { id: 'u9', name: 'Jennifer White Elk', region: 'Regina', bio: 'Indigenous rights advocate and community leader', skills: ['advocacy', 'traditional knowledge'], experience: ['First Nations council'], interests: ['reconciliation', 'education'], candidate: true, platform: 'Reconciliation, indigenous sovereignty, and equitable education' },
    { id: 'u10', name: 'Michael O\'Brien', region: 'St. John\'s', bio: 'Offshore energy transition specialist', skills: ['engineering', 'project management'], experience: ['energy sector'], interests: ['energy', 'jobs'], candidate: true, platform: 'Just transition from oil to renewable energy while protecting jobs' },
    { id: 'u11', name: 'Sarah Greenberg', region: 'Kitchener', bio: 'Tech sector worker focused on digital inclusion', skills: ['software', 'training'], experience: ['nonprofit tech'], interests: ['technology', 'equity'], candidate: false },
    { id: 'u12', name: 'Ahmed Hassan', region: 'Mississauga', bio: 'Healthcare administrator focused on immigrant services', skills: ['healthcare admin', 'multilingual'], experience: ['community health'], interests: ['healthcare', 'immigration'], candidate: true, platform: 'Welcoming newcomers and ensuring healthcare access for all' },
    { id: 'u13', name: 'Linda Thompson', region: 'Brandon', bio: 'Agricultural specialist promoting sustainable farming', skills: ['agriculture', 'research'], experience: ['ag extension'], interests: ['agriculture', 'environment'], candidate: true, platform: 'Supporting family farms and sustainable agriculture practices' },
    { id: 'u14', name: 'Pierre Gagnon', region: 'Quebec City', bio: 'Heritage preservation advocate', skills: ['history', 'architecture'], experience: ['preservation board'], interests: ['heritage', 'tourism'], candidate: false },
    { id: 'u15', name: 'Susan Wright', region: 'Victoria', bio: 'Retired public servant focused on senior services', skills: ['public policy', 'advocacy'], experience: ['government'], interests: ['seniors', 'healthcare'], candidate: true, platform: 'Dignity for seniors: better pensions and healthcare' },
    { id: 'u16', name: 'Daniel Blackwood', region: 'Saskatoon', bio: 'University researcher on rural development', skills: ['research', 'data analysis'], experience: ['academia'], interests: ['rural development', 'economy'], candidate: false },
    { id: 'u17', name: 'Emily Chen', region: 'Richmond', bio: 'Small business owner advocating for immigrant entrepreneurs', skills: ['business', 'community building'], experience: ['chamber of commerce'], interests: ['economy', 'immigration'], candidate: true, platform: 'Supporting immigrant entrepreneurs and small business growth' },
    { id: 'u18', name: 'Thomas Bear', region: 'Yellowknife', bio: 'Northern climate adaptation specialist', skills: ['environmental science', 'policy'], experience: ['territorial government'], interests: ['climate', 'indigenous rights'], candidate: true, platform: 'Climate adaptation and northern community infrastructure' }
];

const IDEAS = [
    // Original ideas
    { id: 'i1', title: 'Community Solar Program', description: 'Establish shared solar panels for apartment residents who cannot install their own', tags: ['environment', 'energy', 'equity'], region: 'Winnipeg', authorId: 'u1' },
    { id: 'i2', title: 'Youth Mentorship Network', description: 'Connect retired professionals with high school students for career guidance', tags: ['youth', 'education', 'community'], region: 'Toronto', authorId: 'u2' },
    { id: 'i3', title: 'Small Business Incubator', description: 'Create a shared workspace with resources for new entrepreneurs', tags: ['economy', 'small business', 'jobs'], region: 'Vancouver', authorId: 'u3' },
    { id: 'i4', title: 'Green Corridor Initiative', description: 'Plant native trees along main streets to reduce heat and improve air quality', tags: ['environment', 'urban planning', 'health'], region: 'Calgary', authorId: 'u4' },
    { id: 'i5', title: 'Mobile Health Clinics', description: 'Deploy mobile units to provide basic healthcare in underserved areas', tags: ['healthcare', 'equity', 'access'], region: 'Edmonton', authorId: 'u5' },
    { id: 'i6', title: 'Open Budget Dashboard', description: 'Create a public website showing real-time city spending and projects', tags: ['transparency', 'technology', 'government'], region: 'Ottawa', authorId: 'u6' },
    { id: 'i7', title: 'Expand Solar to Schools', description: 'Amendment to include public schools in the community solar program', tags: ['environment', 'education', 'energy'], region: 'Winnipeg', authorId: 'u4', amendsId: 'i1' },
    
    // New ideas from Canadian users
    { id: 'i8', title: 'Bilingual Cultural Exchange Program', description: 'Create exchange programs between French and English speaking communities to strengthen national unity', tags: ['culture', 'education', 'bilingualism'], region: 'Montreal', authorId: 'u7' },
    { id: 'i9', title: 'Sustainable Fisheries Initiative', description: 'Implement community-managed fishing quotas with real-time stock monitoring', tags: ['environment', 'economy', 'fisheries'], region: 'Halifax', authorId: 'u8' },
    { id: 'i10', title: 'Indigenous Language Preservation', description: 'Fund digital tools and school programs to preserve and teach indigenous languages', tags: ['reconciliation', 'education', 'heritage'], region: 'Regina', authorId: 'u9' },
    { id: 'i11', title: 'Offshore Wind Transition', description: 'Convert offshore oil infrastructure to wind energy platforms, preserving jobs', tags: ['energy', 'jobs', 'environment'], region: 'St. John\'s', authorId: 'u10' },
    { id: 'i12', title: 'Digital Literacy for Seniors', description: 'Free tech training programs for seniors at community centers and libraries', tags: ['technology', 'seniors', 'equity'], region: 'Kitchener', authorId: 'u11' },
    { id: 'i13', title: 'Newcomer Health Navigator', description: 'Multilingual health navigators to help immigrants access healthcare services', tags: ['healthcare', 'immigration', 'equity'], region: 'Mississauga', authorId: 'u12' },
    { id: 'i14', title: 'Regenerative Agriculture Grants', description: 'Provincial grants for farmers transitioning to regenerative practices', tags: ['agriculture', 'environment', 'economy'], region: 'Brandon', authorId: 'u13' },
    { id: 'i15', title: 'Heritage Building Adaptive Reuse', description: 'Tax incentives for converting heritage buildings to affordable housing', tags: ['heritage', 'housing', 'urban planning'], region: 'Quebec City', authorId: 'u14' },
    { id: 'i16', title: 'Age-Friendly Transit', description: 'On-demand transit service for seniors with mobility challenges', tags: ['seniors', 'transit', 'accessibility'], region: 'Victoria', authorId: 'u15' },
    { id: 'i17', title: 'Rural Broadband Cooperative', description: 'Community-owned broadband network for underserved rural areas', tags: ['technology', 'rural', 'economy'], region: 'Saskatoon', authorId: 'u16' },
    { id: 'i18', title: 'Immigrant Entrepreneur Accelerator', description: 'Business accelerator specifically supporting immigrant-owned startups', tags: ['economy', 'immigration', 'small business'], region: 'Richmond', authorId: 'u17' },
    { id: 'i19', title: 'Northern Climate Adaptation Fund', description: 'Emergency fund for northern communities adapting to permafrost thaw and infrastructure damage', tags: ['climate', 'infrastructure', 'indigenous rights'], region: 'Yellowknife', authorId: 'u18' },
    { id: 'i20', title: 'Prairie Water Conservation', description: 'Regional water sharing agreement between Manitoba, Saskatchewan, and Alberta', tags: ['water', 'environment', 'agriculture'], region: 'Winnipeg', authorId: 'u1' },
    { id: 'i21', title: 'National Pharmacare Pilot', description: 'Test universal pharmacare program in select ridings before national rollout', tags: ['healthcare', 'policy', 'equity'], region: 'Toronto', authorId: 'u2' },
    { id: 'i22', title: 'Electric Vehicle Infrastructure', description: 'Fast-charging network along Trans-Canada Highway', tags: ['transportation', 'environment', 'infrastructure'], region: 'Calgary', authorId: 'u4' },
    { id: 'i23', title: 'Mental Health First Responders', description: 'Specialized mental health crisis teams to respond instead of police', tags: ['healthcare', 'mental health', 'equity'], region: 'Edmonton', authorId: 'u5' },
    { id: 'i24', title: 'Open Source Government', description: 'All government software should be open source and publicly auditable', tags: ['technology', 'transparency', 'government'], region: 'Ottawa', authorId: 'u6' }
];

const ASSEMBLY_EVENTS = [
    { id: 'a1', title: 'North District Town Hall', description: 'Monthly gathering to discuss community priorities', type: 'town_hall', region: 'North', startTime: '2024-01-15T18:00:00', endTime: '2024-01-15T20:00:00' },
    { id: 'a2', title: 'Regional Planning Summit', description: 'Cross-district meeting on shared infrastructure', type: 'summit', region: 'All', startTime: '2024-02-01T09:00:00', endTime: '2024-02-01T17:00:00' },
    { id: 'a3', title: 'Environment Committee', description: 'Working session on green initiatives', type: 'committee', region: 'West', startTime: '2024-01-20T14:00:00', endTime: '2024-01-20T16:00:00' }
];

const VOTE_SESSIONS = [
    { id: 'v1', question: 'Should we prioritize the Community Solar Program?', type: 'approval', assemblyId: 'a1' },
    { id: 'v2', question: 'Rank the top 3 environmental initiatives', type: 'ranked_choice', assemblyId: 'a3' }
];

const VOTE_RESULTS = [
    { id: 'r1', sessionId: 'v1', resultData: { yes: 45, no: 12, abstain: 3 } },
    { id: 'r2', sessionId: 'v2', resultData: { rankings: { 'i1': 1, 'i4': 2, 'i7': 3 } } }
];

const COMMUNITY_PRIORITIES = [
    { id: 'p1', name: 'Clean Energy Transition', description: 'Community commitment to renewable energy sources', region: 'North', derivedFromId: 'i1' },
    { id: 'p2', name: 'Youth Empowerment', description: 'Investing in the next generation of leaders', region: 'South', derivedFromId: 'i2' }
];

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

const IDEA_SUPPORTS = [
    // Original supports
    { userId: 'u2', ideaId: 'i1' },
    { userId: 'u4', ideaId: 'i1' },
    { userId: 'u5', ideaId: 'i1' },
    { userId: 'u1', ideaId: 'i2' },
    { userId: 'u3', ideaId: 'i2' },
    { userId: 'u1', ideaId: 'i4' },
    { userId: 'u5', ideaId: 'i4' },
    { userId: 'u2', ideaId: 'i5' },
    { userId: 'u3', ideaId: 'i6' },
    { userId: 'u4', ideaId: 'i6' },
    // New supports for Canadian ideas (making some ideas very popular)
    { userId: 'u7', ideaId: 'i8' }, { userId: 'u14', ideaId: 'i8' }, { userId: 'u2', ideaId: 'i8' },
    { userId: 'u10', ideaId: 'i9' }, { userId: 'u8', ideaId: 'i11' }, { userId: 'u15', ideaId: 'i9' },
    { userId: 'u1', ideaId: 'i10' }, { userId: 'u13', ideaId: 'i10' }, { userId: 'u16', ideaId: 'i10' }, { userId: 'u18', ideaId: 'i10' }, { userId: 'u7', ideaId: 'i10' },
    { userId: 'u8', ideaId: 'i11' }, { userId: 'u15', ideaId: 'i11' }, { userId: 'u4', ideaId: 'i11' },
    { userId: 'u15', ideaId: 'i12' }, { userId: 'u6', ideaId: 'i12' }, { userId: 'u2', ideaId: 'i12' },
    { userId: 'u5', ideaId: 'i13' }, { userId: 'u11', ideaId: 'i13' }, { userId: 'u7', ideaId: 'i13' }, { userId: 'u17', ideaId: 'i13' },
    { userId: 'u16', ideaId: 'i14' }, { userId: 'u4', ideaId: 'i14' }, { userId: 'u1', ideaId: 'i14' },
    { userId: 'u7', ideaId: 'i15' }, { userId: 'u3', ideaId: 'i15' },
    { userId: 'u12', ideaId: 'i16' }, { userId: 'u5', ideaId: 'i16' }, { userId: 'u11', ideaId: 'i16' }, { userId: 'u2', ideaId: 'i16' },
    { userId: 'u13', ideaId: 'i17' }, { userId: 'u18', ideaId: 'i17' }, { userId: 'u9', ideaId: 'i17' },
    { userId: 'u3', ideaId: 'i18' }, { userId: 'u12', ideaId: 'i18' }, { userId: 'u11', ideaId: 'i18' },
    { userId: 'u9', ideaId: 'i19' }, { userId: 'u4', ideaId: 'i19' }, { userId: 'u13', ideaId: 'i19' }, { userId: 'u16', ideaId: 'i19' }, { userId: 'u1', ideaId: 'i19' },
    { userId: 'u13', ideaId: 'i20' }, { userId: 'u16', ideaId: 'i20' }, { userId: 'u4', ideaId: 'i20' },
    { userId: 'u5', ideaId: 'i21' }, { userId: 'u12', ideaId: 'i21' }, { userId: 'u11', ideaId: 'i21' }, { userId: 'u15', ideaId: 'i21' }, { userId: 'u1', ideaId: 'i21' }, { userId: 'u7', ideaId: 'i21' },
    { userId: 'u1', ideaId: 'i22' }, { userId: 'u3', ideaId: 'i22' }, { userId: 'u18', ideaId: 'i22' },
    { userId: 'u2', ideaId: 'i23' }, { userId: 'u11', ideaId: 'i23' }, { userId: 'u9', ideaId: 'i23' }, { userId: 'u12', ideaId: 'i23' }, { userId: 'u15', ideaId: 'i23' }, { userId: 'u7', ideaId: 'i23' }, { userId: 'u1', ideaId: 'i23' },
    { userId: 'u11', ideaId: 'i24' }, { userId: 'u3', ideaId: 'i24' }, { userId: 'u4', ideaId: 'i24' }
];

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

// Helper to generate ID from name
function generateId(prefix, name) {
    return prefix + '-' + name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
}

async function seedLocations(driver) {
    console.log('\n[10] Seeding Locations (using MERGE - only creates if not exists)...');
    const session = driver.session({ database: DATABASE });
    
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
            
            // First Nations
            if (provData.firstNations && provData.firstNations.length > 0) {
                for (const name of provData.firstNations) {
                    const id = generateId('fn-' + prov.code.toLowerCase(), name);
                    await session.run(`
                        MERGE (fn:FirstNation {id: $id})
                        ON CREATE SET fn.name = $name, fn.createdAt = datetime()
                    `, { id, name });
                    await session.run(`
                        MATCH (p:Province {id: $provinceId}), (fn:FirstNation {id: $fnId})
                        MERGE (p)-[:HAS_FIRST_NATION]->(fn)
                    `, { provinceId: prov.id, fnId: id });
                    stats.firstNations++;
                }
                console.log(`    ✓ ${provData.firstNations.length} First Nations`);
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
    console.log('\n[11] Database Summary...');
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
            MATCH ()-[r]->() WITH users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, count(r) as relationships
            RETURN users, ideas, events, votes, priorities, countries, provinces, fedRidings, provRidings, towns, firstNations, relationships
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
    console.log('  SPEAKEASY - Neo4j Database Setup');
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
        await seedIdeas(driver);
        await seedAssemblyEvents(driver);
        await seedVoteSessions(driver);
        await seedCommunityPriorities(driver);
        await seedRelationships(driver);
        await seedLocations(driver);
        await seedUserLocations(driver);
        await showSummary(driver);
        
        console.log('\n═'.repeat(50));
        console.log('  ✓ Setup complete! Your database is ready.');
        console.log('═'.repeat(50));
        
    } finally {
        await driver.close();
    }
}

main().catch(console.error);
