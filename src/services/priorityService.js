/**
 * Priority Service
 * Business logic for community priorities
 */

const { getSession } = require('../config/db');

async function getAllPriorities() {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority)
            OPTIONAL MATCH (p)-[:DERIVED_FROM]->(i:Idea)
            RETURN p, i
            ORDER BY p.createdAt DESC
        `);
        
        return result.records.map(record => ({
            ...record.get('p').properties,
            derivedFrom: record.get('i')?.properties || null
        }));
    } finally {
        await session.close();
    }
}

async function getPriorityById(priorityId) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority {id: $id})
            OPTIONAL MATCH (p)-[:DERIVED_FROM]->(i:Idea)
            RETURN p, i
        `, { id: priorityId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        return {
            ...record.get('p').properties,
            derivedFrom: record.get('i')?.properties || null
        };
    } finally {
        await session.close();
    }
}

async function createPriority({ id, name, description, region, derivedFromId }) {
    const session = getSession();
    try {
        await session.run(`
            CREATE (p:CommunityPriority {
                id: $id,
                name: $name,
                description: $description,
                region: $region,
                createdAt: datetime()
            })
        `, { id, name, description, region });
        
        if (derivedFromId) {
            await session.run(`
                MATCH (p:CommunityPriority {id: $priorityId}), (i:Idea {id: $ideaId})
                CREATE (p)-[:DERIVED_FROM]->(i)
            `, { priorityId: id, ideaId: derivedFromId });
        }
        
        const result = await session.run('MATCH (p:CommunityPriority {id: $id}) RETURN p', { id });
        return result.records[0].get('p').properties;
    } finally {
        await session.close();
    }
}

async function updatePriority(priorityId, { name, description, region }) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority {id: $id})
            SET p.name = $name,
                p.description = $description,
                p.region = $region
            RETURN p
        `, { id: priorityId, name, description, region });
        
        if (result.records.length === 0) return null;
        return result.records[0].get('p').properties;
    } finally {
        await session.close();
    }
}

async function deletePriority(priorityId) {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (p:CommunityPriority {id: $id}) DETACH DELETE p RETURN count(p) as deleted',
            { id: priorityId }
        );
        return result.records[0].get('deleted').toNumber() > 0;
    } finally {
        await session.close();
    }
}

async function getPrioritiesByRegion(region) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (p:CommunityPriority {region: $region})
            OPTIONAL MATCH (p)-[:DERIVED_FROM]->(i:Idea)
            RETURN p, i
            ORDER BY p.createdAt DESC
        `, { region });
        
        return result.records.map(record => ({
            ...record.get('p').properties,
            derivedFrom: record.get('i')?.properties || null
        }));
    } finally {
        await session.close();
    }
}

module.exports = {
    getAllPriorities,
    getPriorityById,
    createPriority,
    updatePriority,
    deletePriority,
    getPrioritiesByRegion
};

