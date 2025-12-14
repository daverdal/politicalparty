/**
 * Locations Routes
 * HTTP handlers for hierarchical location management
 * Business logic is delegated to locationService
 */

const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');
const { getSession } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

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

// POST /api/locations/adhoc-groups - Create a new adhoc group
router.post('/adhoc-groups', async (req, res) => {
    const session = getSession();
    const { id, name, description, provinceId } = req.body;
    
    try {
        await session.run(`
            CREATE (ag:AdhocGroup {id: $id, name: $name, description: $description, createdAt: datetime()})
        `, { id, name, description });
        
        await session.run(`
            MATCH (p:Province {id: $provinceId}), (ag:AdhocGroup {id: $groupId})
            CREATE (p)-[:HAS_ADHOC_GROUP]->(ag)
        `, { provinceId, groupId: id });
        
        const result = await session.run('MATCH (ag:AdhocGroup {id: $id}) RETURN ag', { id });
        res.status(201).json(result.records[0].get('ag').properties);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
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
