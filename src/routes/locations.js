/**
 * Locations Routes
 * HTTP handlers for hierarchical location management
 * Business logic is delegated to locationService
 */

const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');
const { getSession } = require('../config/db');
const { authenticate, requireAdmin, requireVerifiedUser } = require('../middleware/auth');
const moderatorService = require('../services/moderatorService');
const crypto = require('crypto');

const MIN_ADHOC_GROUP_MEMBERSHIP_DAYS = 7;
const MAX_ADHOC_GROUPS_PER_PROVINCE_PER_USER = 1;

function generateAdhocGroupId(provinceId, name) {
    const safeProv = String(provinceId || 'xx')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '');
    const base = String(name || 'group')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'group';
    const rand = crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : crypto.randomBytes(4).toString('hex');
    return `ag-${safeProv}-${base}-${rand}`;
}

function normalizeEmailDomain(raw) {
    if (!raw) return null;
    let domain = String(raw).trim().toLowerCase();
    if (!domain) return null;
    if (domain.startsWith('@')) {
        domain = domain.slice(1);
    }
    // Very lightweight validation: must contain a dot and at least 3 chars.
    if (domain.length < 3 || !domain.includes('.')) {
        return null;
    }
    return domain;
}

// GET /api/locations - Get full location hierarchy
router.get('/', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Planet)-[:HAS_COUNTRY]->(c:Country)
            OPTIONAL MATCH (c)-[:HAS_PROVINCE]->(prov:Province)
            RETURN p, c, collect(DISTINCT prov) as provinces
            ORDER BY c.name
        `);
        
        const data = result.records.map(record => ({
            planet: record.get('p')?.properties,
            country: record.get('c').properties,
            provinces: record.get('provinces').map(p => p.properties).sort((a, b) => a.name.localeCompare(b.name))
        }));
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/planets - Get all planets
router.get('/planets', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run('MATCH (p:Planet) RETURN p ORDER BY p.name');
        res.json(result.records.map(r => r.get('p').properties));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/planets/:id/countries - Get countries for a planet
router.get('/planets/:id/countries', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Planet {id: $planetId})-[:HAS_COUNTRY]->(c:Country)
            RETURN c ORDER BY c.name
        `, { planetId: req.params.id });
        res.json(result.records.map(r => r.get('c').properties));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/countries - Get all countries
router.get('/countries', async (req, res) => {
    try {
        const countries = await locationService.getAllCountries();
        res.json(countries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/locations/countries - Create or update a country (admin only)
router.post('/countries', authenticate, requireAdmin, async (req, res) => {
    const session = getSession();
    const { id, name, code } = req.body || {};

    if (!id || !name) {
        return res.status(400).json({ error: 'id and name are required' });
    }

    const normalizedCode = (code || String(id)).toUpperCase();

    try {
        // Ensure the planet exists
        await session.run(`
            MERGE (p:Planet {id: 'earth'})
            ON CREATE SET p.name = 'Earth', p.createdAt = datetime()
        `);

        // Create or update the country
        await session.run(`
            MERGE (c:Country {id: $id})
            ON CREATE SET 
                c.name = $name,
                c.code = $code,
                c.createdAt = datetime()
            ON MATCH SET
                c.name = $name,
                c.code = $code
        `, { id, name, code: normalizedCode });

        // Ensure the relationship from planet to country exists
        await session.run(`
            MATCH (p:Planet {id: 'earth'}), (c:Country {id: $id})
            MERGE (p)-[:HAS_COUNTRY]->(c)
        `, { id });

        const result = await session.run(`
            MATCH (c:Country {id: $id})
            OPTIONAL MATCH (c)-[:HAS_PROVINCE]->(p:Province)
            WITH c, count(p) as provinceCount
            RETURN c, provinceCount
        `, { id });

        const record = result.records[0];
        const country = record.get('c').properties;
        const provinceCount = record.get('provinceCount');

        res.status(201).json({
            ...country,
            provinceCount: typeof provinceCount?.toNumber === 'function'
                ? provinceCount.toNumber()
                : Number(provinceCount) || 0
        });
    } catch (error) {
        console.error('Error creating country:', error);
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/countries/:id/provinces - Get provinces for a country
router.get('/countries/:id/provinces', async (req, res) => {
    try {
        const provinces = await locationService.getProvincesForCountry(req.params.id);
        res.json(provinces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/provinces - Get all provinces
router.get('/provinces', async (req, res) => {
    try {
        const provinces = await locationService.getAllProvinces();
        res.json(provinces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/provinces/:id - Get a province with all its locations
router.get('/provinces/:id', async (req, res) => {
    try {
        const province = await locationService.getProvinceById(req.params.id);
        if (!province) {
            return res.status(404).json({ error: 'Province not found' });
        }
        res.json(province);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/provinces/:id/ridings - Get ALL ridings (combined)
router.get('/provinces/:id/ridings', async (req, res) => {
    try {
        const ridings = await locationService.getRidingsForProvince(req.params.id);
        res.json(ridings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/provinces/:id/federal-ridings
router.get('/provinces/:id/federal-ridings', async (req, res) => {
    try {
        const ridings = await locationService.getFederalRidings(req.params.id);
        res.json(ridings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/provinces/:id/provincial-ridings
router.get('/provinces/:id/provincial-ridings', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_PROVINCIAL_RIDING]->(pr:ProvincialRiding)
            RETURN pr ORDER BY pr.name
        `, { provinceId: req.params.id });
        res.json(result.records.map(r => r.get('pr').properties));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/towns
router.get('/provinces/:id/towns', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_TOWN]->(t:Town)
            RETURN t ORDER BY t.name
        `, { provinceId: req.params.id });
        res.json(result.records.map(r => r.get('t').properties));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/first-nations
router.get('/provinces/:id/first-nations', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_FIRST_NATION]->(fn:FirstNation)
            RETURN fn ORDER BY fn.name
        `, { provinceId: req.params.id });
        res.json(result.records.map(r => r.get('fn').properties));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/adhoc-groups
router.get('/provinces/:id/adhoc-groups', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_ADHOC_GROUP]->(ag:AdhocGroup)
            RETURN ag ORDER BY ag.name
        `, { provinceId: req.params.id });
        res.json(result.records.map(r => r.get('ag').properties));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/:type/:id/ideas - Get ideas for a location (with hierarchy bubbling)
// Optional query param: ?limit=10 to get only the top N ideas by support
router.get('/:type/:id/ideas', async (req, res) => {
    const { type, id } = req.params;
    const { limit } = req.query;
    
    const typeMap = {
        'countries': 'Country',
        'provinces': 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        'towns': 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };
    
    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }
    
    try {
        const numericLimit = limit ? parseInt(limit, 10) : undefined;
        const ideas = await locationService.getIdeasForLocation({
            locationId: id,
            locationType,
            limit: Number.isFinite(numericLimit) ? numericLimit : undefined
        });
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/:type/:id/candidates - Get candidates for a location (with hierarchy bubbling)
router.get('/:type/:id/candidates', async (req, res) => {
    const { type, id } = req.params;
    
    const typeMap = {
        'countries': 'Country',
        'provinces': 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        'towns': 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };
    
    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }
    
    try {
        const candidates = await locationService.getCandidatesForLocation({ locationId: id, locationType });
        res.json(candidates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/:type/:id/users - Get all users/members for a location
router.get('/:type/:id/users', async (req, res) => {
    const { type, id } = req.params;
    
    const typeMap = {
        'countries': 'Country',
        'provinces': 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        'towns': 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };
    
    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }
    
    try {
        const users = await locationService.getUsersForLocation({ locationId: id, locationType });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/locations/:type/:id/events - Get events for a location
router.get('/:type/:id/events', async (req, res) => {
    const { type, id } = req.params;
    
    const typeMap = {
        'countries': 'Country',
        'provinces': 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        'towns': 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };
    
    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }
    
    try {
        const events = await locationService.getEventsForLocation({ locationId: id, locationType });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/locations/towns - Create a new town
router.post('/towns', async (req, res) => {
    const session = getSession();
    const { id, name, type, provinceId } = req.body;
    
    try {
        await session.run(`
            CREATE (t:Town {id: $id, name: $name, type: $type, createdAt: datetime()})
        `, { id, name, type: type || 'town' });
        
        await session.run(`
            MATCH (p:Province {id: $provinceId}), (t:Town {id: $townId})
            CREATE (p)-[:HAS_TOWN]->(t)
        `, { provinceId, townId: id });
        
        const result = await session.run('MATCH (t:Town {id: $id}) RETURN t', { id });
        res.status(201).json(result.records[0].get('t').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// POST /api/locations/adhoc-groups - Create a new adhoc group (verified users can create)
router.post('/adhoc-groups', authenticate, requireVerifiedUser, async (req, res) => {
    const session = getSession();
    const { id: providedId, name, description, provinceId, allowedEmailDomain: rawDomain } =
        req.body || {};

    if (!name || !provinceId) {
        return res.status(400).json({ error: 'Both name and provinceId are required.' });
    }

    const userId = req.user.id;

    const allowedEmailDomain = normalizeEmailDomain(rawDomain);
    if (rawDomain && !allowedEmailDomain) {
        await session.close();
        return res
            .status(400)
            .json({ error: 'Invalid email domain. Use a value like "@example.org" or "example.org".' });
    }

    try {
        // Require the user to be LOCATED_IN this province (or one of its child locations)
        // for at least MIN_ADHOC_GROUP_MEMBERSHIP_DAYS before creating a group.
        const membershipResult = await session.run(
            `
            MATCH (u:User {id: $userId})-[rel:LOCATED_IN]->(loc)
            MATCH (p:Province {id: $provinceId})
            WHERE
                (loc:Province AND loc.id = p.id) OR
                (loc:FederalRiding AND (p)-[:HAS_FEDERAL_RIDING]->(loc)) OR
                (loc:ProvincialRiding AND (p)-[:HAS_PROVINCIAL_RIDING]->(loc)) OR
                (loc:Town AND (p)-[:HAS_TOWN]->(loc)) OR
                (loc:FirstNation AND (p)-[:HAS_FIRST_NATION]->(loc)) OR
                (loc:AdhocGroup AND (p)-[:HAS_ADHOC_GROUP]->(loc))
            WITH collect(rel) AS rels
            RETURN
                size(rels) > 0 AS isMemberOfProvince,
                any(r IN rels WHERE r.createdAt IS NULL OR duration.between(r.createdAt, datetime()).days >= $minDays)
                    AS hasEnoughTenure
        `,
            { userId, provinceId, minDays: MIN_ADHOC_GROUP_MEMBERSHIP_DAYS }
        );

        if (!membershipResult.records.length || !membershipResult.records[0].get('isMemberOfProvince')) {
            return res.status(403).json({
                error:
                    'You need to have this province (or a riding/town/First Nation in it) set as a home location before creating a group.'
            });
        }

        const hasEnoughTenure = membershipResult.records[0].get('hasEnoughTenure');
        if (!hasEnoughTenure) {
            return res.status(403).json({
                error: `You must have been a member of this province for at least ${MIN_ADHOC_GROUP_MEMBERSHIP_DAYS} days before creating an Ad-hoc Group.`
            });
        }

        // Limit: one Ad-hoc Group per province per creator
        const existingResult = await session.run(
            `
            MATCH (p:Province {id: $provinceId})-[:HAS_ADHOC_GROUP]->(ag:AdhocGroup)
            WHERE ag.createdByUserId = $userId
            RETURN ag
            LIMIT $limit
        `,
            { provinceId, userId, limit: MAX_ADHOC_GROUPS_PER_PROVINCE_PER_USER }
        );

        if (existingResult.records.length >= MAX_ADHOC_GROUPS_PER_PROVINCE_PER_USER) {
            return res.status(400).json({
                error: 'You already created an Ad-hoc Group in this province. Delete it before creating another.'
            });
        }
    } catch (error) {
        await session.close();
        return res.status(500).json({ error: error.message });
    }

    const id = providedId || generateAdhocGroupId(provinceId, name);

    try {
        await session.run(
            `
            CREATE (ag:AdhocGroup {
                id: $id,
                name: $name,
                description: $description,
                allowedEmailDomain: $allowedEmailDomain,
                createdAt: datetime(),
                createdByUserId: $createdByUserId
            })
        `,
            { id, name, description, allowedEmailDomain, createdByUserId: userId }
        );

        await session.run(
            `
            MATCH (p:Province {id: $provinceId}), (ag:AdhocGroup {id: $groupId})
            CREATE (p)-[:HAS_ADHOC_GROUP]->(ag)
        `,
            { provinceId, groupId: id }
        );

        // Automatically make the creator a moderator of this adhoc group (via service)
        try {
            await moderatorService.assignModerator({
                userId,
                locationId: id,
                locationType: 'AdhocGroup'
            });
        } catch (e) {
            // Best-effort; log but don't fail group creation
            // eslint-disable-next-line no-console
            console.warn('[locations] Failed to assign moderator for adhoc group:', e.message || e);
        }

        const result = await session.run('MATCH (ag:AdhocGroup {id: $id}) RETURN ag', { id });
        res.status(201).json(result.records[0].get('ag').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// DELETE /api/locations/adhoc-groups/:id - Delete an adhoc group (only by its creator)
router.delete('/adhoc-groups/:id', authenticate, requireVerifiedUser, async (req, res) => {
    const session = getSession();
    const { id } = req.params;
    const userId = req.user.id;

    try {
        // Ensure this group exists, was created by the current user, and
        // is not currently used as the location for a Strategic Plan.
        const checkResult = await session.run(
            `
            MATCH (ag:AdhocGroup {id: $id, createdByUserId: $userId})
            OPTIONAL MATCH (s:StrategicSession {locationId: $id, locationType: 'AdhocGroup'})
            RETURN ag, CASE WHEN count(s) > 0 THEN true ELSE false END AS hasSessions
        `,
            { id, userId }
        );

        if (!checkResult.records.length) {
            return res
                .status(403)
                .json({ error: 'You can only delete Ad-hoc Groups that you created.' });
        }

        const hasSessions = checkResult.records[0].get('hasSessions');
        if (hasSessions) {
            return res.status(400).json({
                error:
                    'This Ad-hoc Group is used in a Strategic Plan and cannot be deleted. Archive or move the plan first.'
            });
        }

        await session.run(
            `
            MATCH (ag:AdhocGroup {id: $id, createdByUserId: $userId})
            DETACH DELETE ag
        `,
            { id, userId }
        );

        return res.json({ success: true, message: 'Ad-hoc Group deleted.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// PUT /api/locations/adhoc-groups/:id/domain - Update email domain restriction (creator or admin)
router.put(
    '/adhoc-groups/:id/domain',
    authenticate,
    requireVerifiedUser,
    async (req, res) => {
        const session = getSession();
        const { id } = req.params;
        const userId = req.user.id;
        const rawDomain = (req.body && req.body.allowedEmailDomain) || '';

        const allowedEmailDomain = normalizeEmailDomain(rawDomain);
        if (rawDomain && !allowedEmailDomain) {
            await session.close();
            return res.status(400).json({
                error: 'Invalid email domain. Use a value like "@example.org" or "example.org".'
            });
        }

        try {
            const checkResult = await session.run(
                `
                MATCH (ag:AdhocGroup {id: $id})
                RETURN ag.createdByUserId AS createdByUserId
            `,
                { id }
            );

            if (!checkResult.records.length) {
                await session.close();
                return res.status(404).json({ error: 'Ad-hoc Group not found.' });
            }

            const createdByUserId = checkResult.records[0].get('createdByUserId');

            if (createdByUserId !== userId && req.user.role !== 'admin') {
                await session.close();
                return res
                    .status(403)
                    .json({ error: 'Only the creator or an admin can update this group.' });
            }

            await session.run(
                `
                MATCH (ag:AdhocGroup {id: $id})
                SET ag.allowedEmailDomain = $allowedEmailDomain
                RETURN ag
            `,
                { id, allowedEmailDomain }
            );

            const result = await session.run('MATCH (ag:AdhocGroup {id: $id}) RETURN ag', { id });
            return res.json(result.records[0].get('ag').properties);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        } finally {
            await session.close();
        }
    }
);

// ============================================
// Moderator management (admin only)
// ============================================

// POST /api/locations/:type/:id/moderators - assign a moderator to a location
router.post('/:type/:id/moderators', authenticate, requireAdmin, async (req, res) => {
    const { type, id } = req.params;
    const { userId } = req.body || {};

    if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
    }

    const typeMap = {
        countries: 'Country',
        provinces: 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        towns: 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };

    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }

    try {
        const result = await moderatorService.assignModerator({
            userId,
            locationId: id,
            locationType
        });
        res.status(201).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// DELETE /api/locations/:type/:id/moderators/:userId - remove a moderator from a location
router.delete('/:type/:id/moderators/:userId', authenticate, requireAdmin, async (req, res) => {
    const { type, id, userId } = req.params;

    const typeMap = {
        countries: 'Country',
        provinces: 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        towns: 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };

    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }

    try {
        const { removed } = await moderatorService.removeModerator({
            userId,
            locationId: id,
            locationType
        });
        res.json({ removed });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// GET /api/locations/:type/:id/moderators - list moderators for a location
router.get('/:type/:id/moderators', authenticate, requireAdmin, async (req, res) => {
    const { type, id } = req.params;

    const typeMap = {
        countries: 'Country',
        provinces: 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        towns: 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };

    const locationType = typeMap[type];
    if (!locationType) {
        return res.status(400).json({ error: 'Invalid location type' });
    }

    try {
        const mods = await moderatorService.listModeratorsForLocation({
            locationId: id,
            locationType
        });
        res.json(mods);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

// GET /api/locations/search - Search all locations
router.get('/search', async (req, res) => {
    const session = getSession();
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return res.json([]);
    }
    
    try {
        const result = await session.run(`
            CALL {
                MATCH (t:Town) WHERE toLower(t.name) CONTAINS toLower($query)
                RETURN t.id as id, t.name as name, 'Town' as type
                UNION
                MATCH (fr:FederalRiding) WHERE toLower(fr.name) CONTAINS toLower($query)
                RETURN fr.id as id, fr.name as name, 'FederalRiding' as type
                UNION
                MATCH (pr:ProvincialRiding) WHERE toLower(pr.name) CONTAINS toLower($query)
                RETURN pr.id as id, pr.name as name, 'ProvincialRiding' as type
                UNION
                MATCH (fn:FirstNation) WHERE toLower(fn.name) CONTAINS toLower($query)
                RETURN fn.id as id, fn.name as name, 'FirstNation' as type
            }
            RETURN id, name, type ORDER BY name LIMIT 20
        `, { query: q });
        
        res.json(result.records.map(r => ({
            id: r.get('id'),
            name: r.get('name'),
            type: r.get('type')
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;
