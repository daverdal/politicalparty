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
    const finalScope = scope || 'national';

    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $authorId})
            OPTIONAL MATCH (explicitLoc {id: $locationId})
            OPTIONAL MATCH (u)-[:LOCATED_IN]->(userLoc)
            WITH u, explicitLoc, userLoc,
                 $scope AS sc,
                 CASE
                    WHEN $scope = 'riding' AND explicitLoc IS NULL THEN userLoc
                    ELSE explicitLoc
                 END AS loc
            // If riding-scoped but no location, block creation
            CALL apoc.util.validate(
                sc = 'riding' AND loc IS NULL,
                'You must set your riding in your profile before creating a riding-level referendum.',
                []
            )
            CREATE (q:ReferendumQuestion {
                id: $id,
                title: $title,
                body: $body,
                scope: sc,
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
                scope: finalScope,
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
// Eligibility helper
// -------------------------------

async function ensureUserEligibleForReferendum(referId, userId) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (q:ReferendumQuestion {id: $referId})
            OPTIONAL MATCH (q)-[:FOR_LOCATION]->(loc)
            OPTIONAL MATCH (u:User {id: $userId})-[:LOCATED_IN]->(userLoc)
            RETURN q.scope as scope,
                   loc.id as locationId,
                   loc.name as locationName,
                   userLoc.id as userLocId,
                   userLoc.name as userLocName
        `,
            { referId, userId }
        );

        if (!result.records.length) {
            throw new Error('Referendum not found.');
        }

        const record = result.records[0];
        const scope = record.get('scope');
        const locationId = record.get('locationId');
        const locationName = record.get('locationName');
        const userLocId = record.get('userLocId');

        if (scope === 'riding' && locationId && (!userLocId || userLocId !== locationId)) {
            const name = locationName || 'this riding';
            throw new Error(`This referendum is limited to members from ${name}.`);
        }
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
    await ensureUserEligibleForReferendum(referId, userId);

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
        // Find referendum for this argument and check eligibility
        const refResult = await session.run(
            `
            MATCH (a:Argument {id: $argumentId})-[:FOR_QUESTION]->(q:ReferendumQuestion)
            RETURN q.id as referId
        `,
            { argumentId }
        );

        if (!refResult.records.length) {
            return false;
        }

        const referId = refResult.records[0].get('referId');

        await ensureUserEligibleForReferendum(referId, userId);

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


