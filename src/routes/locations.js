/**
 * Locations Routes
 * Hierarchical location management: Planet > Country > Province > Various location types
 */

const express = require('express');
const router = express.Router();
const { getSession } = require('../config/db');

// GET /api/locations - Get full location hierarchy (for tree view)
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
        const result = await session.run(`
            MATCH (p:Planet)
            RETURN p
            ORDER BY p.name
        `);
        const planets = result.records.map(record => record.get('p').properties);
        res.json(planets);
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
            RETURN c
            ORDER BY c.name
        `, { planetId: req.params.id });
        const countries = result.records.map(record => record.get('c').properties);
        res.json(countries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/countries - Get all countries
router.get('/countries', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (c:Country)
            RETURN c
            ORDER BY c.name
        `);
        const countries = result.records.map(record => record.get('c').properties);
        res.json(countries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/countries/:id/provinces - Get provinces for a country
router.get('/countries/:id/provinces', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (c:Country {id: $countryId})-[:HAS_PROVINCE]->(p:Province)
            RETURN p
            ORDER BY p.name
        `, { countryId: req.params.id });
        const provinces = result.records.map(record => record.get('p').properties);
        res.json(provinces);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id - Get a province with all its locations
router.get('/provinces/:id', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})
            OPTIONAL MATCH (p)-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            OPTIONAL MATCH (p)-[:HAS_PROVINCIAL_RIDING]->(pr:ProvincialRiding)
            OPTIONAL MATCH (p)-[:HAS_TOWN]->(t:Town)
            OPTIONAL MATCH (p)-[:HAS_FIRST_NATION]->(fn:FirstNation)
            OPTIONAL MATCH (p)-[:HAS_ADHOC_GROUP]->(ag:AdhocGroup)
            RETURN p,
                collect(DISTINCT fr) as federalRidings,
                collect(DISTINCT pr) as provincialRidings,
                collect(DISTINCT t) as towns,
                collect(DISTINCT fn) as firstNations,
                collect(DISTINCT ag) as adhocGroups
        `, { provinceId: req.params.id });
        
        if (result.records.length === 0) {
            return res.status(404).json({ error: 'Province not found' });
        }
        
        const record = result.records[0];
        res.json({
            ...record.get('p').properties,
            federalRidings: record.get('federalRidings').map(r => r.properties).sort((a, b) => a.name.localeCompare(b.name)),
            provincialRidings: record.get('provincialRidings').map(r => r.properties).sort((a, b) => a.name.localeCompare(b.name)),
            towns: record.get('towns').map(t => t.properties).sort((a, b) => a.name.localeCompare(b.name)),
            firstNations: record.get('firstNations').map(fn => fn.properties).sort((a, b) => a.name.localeCompare(b.name)),
            adhocGroups: record.get('adhocGroups').map(ag => ag.properties).sort((a, b) => a.name.localeCompare(b.name))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/towns - Get towns for a province
router.get('/provinces/:id/towns', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_TOWN]->(t:Town)
            RETURN t
            ORDER BY t.name
        `, { provinceId: req.params.id });
        const towns = result.records.map(record => record.get('t').properties);
        res.json(towns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/federal-ridings - Get federal ridings for a province
router.get('/provinces/:id/federal-ridings', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_FEDERAL_RIDING]->(fr:FederalRiding)
            RETURN fr
            ORDER BY fr.name
        `, { provinceId: req.params.id });
        const ridings = result.records.map(record => record.get('fr').properties);
        res.json(ridings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/provincial-ridings - Get provincial ridings
router.get('/provinces/:id/provincial-ridings', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_PROVINCIAL_RIDING]->(pr:ProvincialRiding)
            RETURN pr
            ORDER BY pr.name
        `, { provinceId: req.params.id });
        const ridings = result.records.map(record => record.get('pr').properties);
        res.json(ridings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/first-nations - Get first nations for a province
router.get('/provinces/:id/first-nations', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_FIRST_NATION]->(fn:FirstNation)
            RETURN fn
            ORDER BY fn.name
        `, { provinceId: req.params.id });
        const firstNations = result.records.map(record => record.get('fn').properties);
        res.json(firstNations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/provinces/:id/adhoc-groups - Get adhoc groups for a province
router.get('/provinces/:id/adhoc-groups', async (req, res) => {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:Province {id: $provinceId})-[:HAS_ADHOC_GROUP]->(ag:AdhocGroup)
            RETURN ag
            ORDER BY ag.name
        `, { provinceId: req.params.id });
        const groups = result.records.map(record => record.get('ag').properties);
        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/:type/:id/ideas - Get ideas for any location type (with hierarchy bubbling)
router.get('/:type/:id/ideas', async (req, res) => {
    const session = getSession();
    const { type, id } = req.params;
    
    // Map URL type to Neo4j label
    const typeMap = {
        'countries': 'Country',
        'provinces': 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        'towns': 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };
    
    const label = typeMap[type];
    if (!label) {
        return res.status(400).json({ error: 'Invalid location type' });
    }
    
    try {
        let query;
        
        // Different queries based on location type to traverse hierarchy
        if (type === 'countries') {
            // Country: Get ideas from users in ANY location under this country
            // Traverse: Country -> Province -> Child locations -> Users -> Ideas
            query = `
                MATCH (c:Country {id: $locationId})-[:HAS_PROVINCE]->(prov:Province)-[]->(childLoc)<-[:LOCATED_IN]-(author:User)-[:POSTED]->(i:Idea)
                OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
                WITH DISTINCT i, author, count(DISTINCT supporter) as supportCount
                RETURN i, author, supportCount
                ORDER BY supportCount DESC, i.createdAt DESC
            `;
        } else if (type === 'provinces') {
            // Province: Get ideas from users in any child location of this province
            // Use relationship pattern matching for efficiency
            query = `
                MATCH (prov:Province {id: $locationId})-[]->(childLoc)<-[:LOCATED_IN]-(author:User)-[:POSTED]->(i:Idea)
                OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
                WITH DISTINCT i, author, count(DISTINCT supporter) as supportCount
                RETURN i, author, supportCount
                ORDER BY supportCount DESC, i.createdAt DESC
            `;
        } else {
            // Leaf locations (ridings, towns, etc.): Direct match only
            query = `
                MATCH (loc:${label} {id: $locationId})
                MATCH (author:User)-[:LOCATED_IN]->(loc)
                MATCH (author)-[:POSTED]->(i:Idea)
                OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
                WITH DISTINCT i, author, count(DISTINCT supporter) as supportCount
                RETURN i, author, supportCount
                ORDER BY supportCount DESC, i.createdAt DESC
            `;
        }
        
        const result = await session.run(query, { locationId: id });
        
        const ideas = result.records.map(record => ({
            ...record.get('i').properties,
            author: record.get('author')?.properties || null,
            supportCount: record.get('supportCount').toNumber()
        }));
        
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

// GET /api/locations/:type/:id/candidates - Get candidates for any location type (with hierarchy bubbling)
router.get('/:type/:id/candidates', async (req, res) => {
    const session = getSession();
    const { type, id } = req.params;
    
    // Map URL type to Neo4j label
    const typeMap = {
        'countries': 'Country',
        'provinces': 'Province',
        'federal-ridings': 'FederalRiding',
        'provincial-ridings': 'ProvincialRiding',
        'towns': 'Town',
        'first-nations': 'FirstNation',
        'adhoc-groups': 'AdhocGroup'
    };
    
    const label = typeMap[type];
    if (!label) {
        return res.status(400).json({ error: 'Invalid location type' });
    }
    
    try {
        let query;
        
        // Different queries based on location type to traverse hierarchy
        // Each query also calculates points (from idea supports)
        if (type === 'countries') {
            // Country: Get candidates in ANY location under this country
            query = `
                MATCH (c:Country {id: $locationId})-[:HAS_PROVINCE]->(prov:Province)-[]->(childLoc)<-[:LOCATED_IN]-(candidate:User {candidate: true})
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(candidate)
                OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
                WITH DISTINCT candidate, count(DISTINCT endorser) as endorsementCount, count(DISTINCT supporter) as points
                RETURN candidate, endorsementCount, points
                ORDER BY points DESC, endorsementCount DESC, candidate.name ASC
            `;
        } else if (type === 'provinces') {
            // Province: Get candidates in any child location of this province
            query = `
                MATCH (prov:Province {id: $locationId})-[]->(childLoc)<-[:LOCATED_IN]-(candidate:User {candidate: true})
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(candidate)
                OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
                WITH DISTINCT candidate, count(DISTINCT endorser) as endorsementCount, count(DISTINCT supporter) as points
                RETURN candidate, endorsementCount, points
                ORDER BY points DESC, endorsementCount DESC, candidate.name ASC
            `;
        } else {
            // Leaf locations (ridings, towns, etc.): Direct match only
            query = `
                MATCH (loc:${label} {id: $locationId})<-[:LOCATED_IN]-(candidate:User {candidate: true})
                OPTIONAL MATCH (endorser:User)-[:ENDORSED]->(candidate)
                OPTIONAL MATCH (candidate)-[:POSTED]->(idea:Idea)<-[:SUPPORTED]-(supporter:User)
                WITH DISTINCT candidate, count(DISTINCT endorser) as endorsementCount, count(DISTINCT supporter) as points
                RETURN candidate, endorsementCount, points
                ORDER BY points DESC, endorsementCount DESC, candidate.name ASC
            `;
        }
        
        const result = await session.run(query, { locationId: id });
        
        const candidates = result.records.map(record => ({
            ...record.get('candidate').properties,
            endorsementCount: record.get('endorsementCount').toNumber(),
            points: record.get('points').toNumber()
        }));
        
        res.json(candidates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
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

// GET /api/locations/search - Search all locations by name
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
                UNION
                MATCH (ag:AdhocGroup) WHERE toLower(ag.name) CONTAINS toLower($query)
                RETURN ag.id as id, ag.name as name, 'AdhocGroup' as type
            }
            RETURN id, name, type
            ORDER BY name
            LIMIT 20
        `, { query: q });
        
        const locations = result.records.map(record => ({
            id: record.get('id'),
            name: record.get('name'),
            type: record.get('type')
        }));
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        await session.close();
    }
});

module.exports = router;
