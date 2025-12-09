/**
 * Referendum Service
 * Business logic for referendum questions and arguments.
 */

const { getSession } = require('../config/db');
const { toNumber, toISODate } = require('../utils/neo4jHelpers');
const crypto = require('crypto');

function generateId(prefix) {
    const base = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    return prefix ? `${prefix}-${base}` : base;
}

// -------------------------------
// Referendum Questions
// -------------------------------

async function createReferendumQuestion({ title, body, scope, locationId, opensAt, closesAt, authorId }) {
    const session = getSession();
    const id = generateId('ref');

    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $authorId})
            OPTIONAL MATCH (loc {id: $locationId})
            CREATE (q:ReferendumQuestion {
                id: $id,
                title: $title,
                body: $body,
                scope: $scope,
                status: 'open',
                opensAt: $opensAt,
                closesAt: $closesAt,
                createdAt: datetime()
            })
            MERGE (u)-[:POSTED]->(q)
            FOREACH (_ IN CASE WHEN loc IS NULL THEN [] ELSE [1] END |
                MERGE (q)-[:FOR_LOCATION]->(loc)
                SET q.locationName = coalesce(loc.name, q.locationName)
            )
            RETURN q
        `,
            {
                id,
                title,
                body: body || '',
                scope: scope || 'global',
                locationId: locationId || null,
                opensAt: opensAt || null,
                closesAt: closesAt || null,
                authorId
            }
        );

        return result.records[0].get('q').properties;
    } finally {
        await session.close();
    }
}

async function listReferendums() {
    const session = getSession();
    try {
        const result = await session.run(`
            MATCH (q:ReferendumQuestion)
            OPTIONAL MATCH (author:User)-[:POSTED]->(q)
            OPTIONAL MATCH (q)-[:FOR_LOCATION]->(loc)
            OPTIONAL MATCH (q)-[:HAS_ARGUMENT]->(arg:Argument)
            RETURN q, author, loc, count(DISTINCT arg) as argumentCount
            ORDER BY q.opensAt DESC, q.createdAt DESC
        `);

        return result.records.map((r) => {
            const q = r.get('q').properties;
            const author = r.get('author')?.properties || null;
            const loc = r.get('loc')?.properties || null;
            return {
                ...q,
                createdAt: q.createdAt ? toISODate(q.createdAt) : null,
                author: author
                    ? {
                          id: author.id,
                          name: author.name || null
                      }
                    : null,
                locationName: q.locationName || (loc ? loc.name : null),
                argumentCount: toNumber(r.get('argumentCount'))
            };
        });
    } finally {
        await session.close();
    }
}

async function getReferendumById(id) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (q:ReferendumQuestion {id: $id})
            OPTIONAL MATCH (author:User)-[:POSTED]->(q)
            OPTIONAL MATCH (q)-[:FOR_LOCATION]->(loc)
            RETURN q, author, loc
        `,
            { id }
        );

        if (!result.records.length) return null;

        const record = result.records[0];
        const q = record.get('q').properties;
        const author = record.get('author')?.properties || null;
        const loc = record.get('loc')?.properties || null;

        return {
            ...q,
            createdAt: q.createdAt ? toISODate(q.createdAt) : null,
            author: author
                ? {
                      id: author.id,
                      name: author.name || null
                  }
                : null,
            locationName: q.locationName || (loc ? loc.name : null)
        };
    } finally {
        await session.close();
    }
}

// -------------------------------
// Arguments (with privacy modes)
// -------------------------------

function computeDisplayName({ visibility, userName }) {
    if (visibility === 'ANON') {
        return 'Anonymous member';
    }
    if (visibility === 'PSEUDO') {
        if (!userName) return 'Community member';
        const parts = userName.split(' ').filter(Boolean);
        if (parts.length === 0) return 'Community member';
        if (parts.length === 1) return `${parts[0]} (member)`;
        return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
    }
    // PUBLIC
    return userName || 'Member';
}

async function createArgument({ referId, userId, side, body, visibility }) {
    const session = getSession();
    const id = generateId('arg');
    const normalizedSide = ['pro', 'con', 'neutral'].includes(side) ? side : 'pro';
    const normalizedVisibility = ['PUBLIC', 'PSEUDO', 'ANON'].includes(visibility) ? visibility : 'PUBLIC';

    try {
        const result = await session.run(
            `
            MATCH (q:ReferendumQuestion {id: $referId})
            MATCH (u:User {id: $userId})
            WITH q, u,
                 $id as id,
                 $body as body,
                 $side as side,
                 $visibility as visibility,
                 u.name as userName
            WITH q, u, id, body, side, visibility,
                 CASE
                    WHEN visibility = 'ANON' THEN 'Anonymous member'
                    WHEN visibility = 'PSEUDO' THEN
                        CASE
                            WHEN userName IS NULL OR userName = '' THEN 'Community member'
                            ELSE
                                coalesce(
                                    apoc.text.capitalize(split(userName, ' ')[0]) +
                                    ' ' +
                                    substring(split(userName, ' ')[1], 0, 1) + '.',
                                    'Community member'
                                )
                        END
                    ELSE coalesce(userName, 'Member')
                 END as displayName
            CREATE (a:Argument {
                id: id,
                body: body,
                side: side,
                visibility: visibility,
                displayName: displayName,
                createdAt: datetime()
            })
            MERGE (u)-[:WROTE]->(a)
            MERGE (a)-[:FOR_QUESTION]->(q)
            MERGE (q)-[:HAS_ARGUMENT]->(a)
            RETURN a
        `,
            {
                referId,
                userId,
                id,
                body: body || '',
                side: normalizedSide,
                visibility: normalizedVisibility
            }
        );

        return result.records[0].get('a').properties;
    } finally {
        await session.close();
    }
}

async function listArguments(referId) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (q:ReferendumQuestion {id: $referId})-[:HAS_ARGUMENT]->(a:Argument)
            OPTIONAL MATCH (voter:User)-[:UPVOTED]->(a)
            RETURN a, count(DISTINCT voter) as votes
            ORDER BY a.side, votes DESC, a.createdAt ASC
        `,
            { referId }
        );

        return result.records.map((r) => {
            const a = r.get('a').properties;
            return {
                id: a.id,
                body: a.body,
                side: a.side,
                visibility: a.visibility || 'PUBLIC',
                displayName: a.displayName || 'Member',
                createdAt: a.createdAt ? toISODate(a.createdAt) : null,
                votes: toNumber(r.get('votes'))
            };
        });
    } finally {
        await session.close();
    }
}

async function upvoteArgument({ userId, argumentId }) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId}), (a:Argument {id: $argumentId})
            MERGE (u)-[:UPVOTED]->(a)
            RETURN a
        `,
            { userId, argumentId }
        );
        return result.records.length > 0;
    } finally {
        await session.close();
    }
}

module.exports = {
    createReferendumQuestion,
    listReferendums,
    getReferendumById,
    createArgument,
    listArguments,
    upvoteArgument
};


