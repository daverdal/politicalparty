/**
 * Idea Service
 * Business logic for idea management
 */

const { getSession } = require('../config/db');

async function getAllIdeas() {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea)
            OPTIONAL MATCH (author:User)-[:POSTED]->(i)
            OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
            RETURN i, author, count(DISTINCT supporter) as supportCount
            ORDER BY i.createdAt DESC
        `);
        
        return result.records.map(record => ({
            ...record.get('i').properties,
            author: record.get('author')?.properties || null,
            supportCount: record.get('supportCount').toNumber()
        }));
    } finally {
        await session.close();
    }
}

async function getIdeaById(ideaId) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea {id: $id})
            OPTIONAL MATCH (author:User)-[:POSTED]->(i)
            OPTIONAL MATCH (supporter:User)-[:SUPPORTED]->(i)
            OPTIONAL MATCH (i)-[:AMENDS]->(amended:Idea)
            RETURN i, author, collect(DISTINCT supporter) as supporters, amended
        `, { id: ideaId });
        
        if (result.records.length === 0) return null;
        
        const record = result.records[0];
        return {
            ...record.get('i').properties,
            author: record.get('author')?.properties || null,
            supporters: record.get('supporters').map(s => s.properties),
            amends: record.get('amended')?.properties || null
        };
    } finally {
        await session.close();
    }
}

async function createIdea({ id, title, description, tags, region, authorId, amendsId }) {
    const session = getSession();
    try {
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
        `, { id, title, description, tags: tags || [], region });
        
        if (authorId) {
            await session.run(`
                MATCH (u:User {id: $authorId}), (i:Idea {id: $ideaId})
                CREATE (u)-[:POSTED {createdAt: datetime()}]->(i)
            `, { authorId, ideaId: id });
        }
        
        if (amendsId) {
            await session.run(`
                MATCH (i1:Idea {id: $ideaId}), (i2:Idea {id: $amendsId})
                CREATE (i1)-[:AMENDS]->(i2)
            `, { ideaId: id, amendsId });
        }
        
        const result = await session.run('MATCH (i:Idea {id: $id}) RETURN i', { id });
        return result.records[0].get('i').properties;
    } finally {
        await session.close();
    }
}

async function updateIdea(ideaId, { title, description, tags, region }) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea {id: $id})
            SET i.title = $title,
                i.description = $description,
                i.tags = $tags,
                i.region = $region,
                i.updatedAt = datetime()
            RETURN i
        `, { id: ideaId, title, description, tags: tags || [], region });
        
        if (result.records.length === 0) return null;
        return result.records[0].get('i').properties;
    } finally {
        await session.close();
    }
}

async function deleteIdea(ideaId) {
    const session = getSession();
    try {
        const result = await session.run(
            'MATCH (i:Idea {id: $id}) DETACH DELETE i RETURN count(i) as deleted',
            { id: ideaId }
        );
        return result.records[0].get('deleted').toNumber() > 0;
    } finally {
        await session.close();
    }
}

// Check whether a user has posted at least one idea anywhere in the system.
async function hasPostedAtLeastOneIdea(userId) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})-[:POSTED]->(:Idea)
            RETURN count(*) AS cnt
        `,
            { userId }
        );

        if (!result.records.length) return false;
        const raw = result.records[0].get('cnt');
        const count = typeof raw?.toNumber === 'function' ? raw.toNumber() : Number(raw || 0);
        return count > 0;
    } finally {
        await session.close();
    }
}

async function supportIdea({ userId, ideaId }) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (u:User {id: $userId}), (i:Idea {id: $ideaId})
            MERGE (u)-[s:SUPPORTED]->(i)
            ON CREATE SET s.createdAt = datetime()
            RETURN u, i
        `, { userId, ideaId });
        
        return result.records.length > 0;
    } finally {
        await session.close();
    }
}

async function unsupportIdea({ userId, ideaId }) {
    const session = getSession();
    try {
        await session.run(`
            MATCH (u:User {id: $userId})-[s:SUPPORTED]->(i:Idea {id: $ideaId})
            DELETE s
        `, { userId, ideaId });
        return true;
    } finally {
        await session.close();
    }
}

async function getRelatedIdeas(ideaId) {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (i:Idea {id: $id})-[:RELATED_TO]-(related:Idea)
            RETURN related
        `, { id: ideaId });
        
        return result.records.map(record => record.get('related').properties);
    } finally {
        await session.close();
    }
}

async function relateIdeas(ideaId, relatedIdeaId) {
    const session = getSession();
    try {
        await session.run(`
            MATCH (i1:Idea {id: $id1}), (i2:Idea {id: $id2})
            MERGE (i1)-[:RELATED_TO]-(i2)
        `, { id1: ideaId, id2: relatedIdeaId });
        return true;
    } finally {
        await session.close();
    }
}

module.exports = {
    getAllIdeas,
    getIdeaById,
    createIdea,
    updateIdea,
    deleteIdea,
    hasPostedAtLeastOneIdea,
    supportIdea,
    unsupportIdea,
    getRelatedIdeas,
    relateIdeas
};

