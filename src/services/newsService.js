/**
 * News Service
 * Handles user news posts and activity feeds (posts, ideas, plans).
 */

const { getDriver, getDatabase } = require('../config/db');
const { toISODate } = require('../utils/neo4jHelpers');

function serializePost(node, author) {
    const props = node.properties;
    return {
        id: props.id,
        body: props.body,
        createdAt: toISODate(props.createdAt),
        type: props.type || 'post',
        author: author
            ? {
                  id: author.properties.id,
                  name: author.properties.name || author.properties.email || 'Member'
              }
            : null
    };
}

/**
 * Create a user-authored news post.
 */
async function createPost({ authorId, body }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const id = `news_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        const result = await session.run(
            `
            MATCH (u:User {id: $authorId})
            CREATE (p:NewsPost {
                id: $id,
                body: $body,
                type: 'post',
                createdAt: datetime($now)
            })
            CREATE (u)-[:POSTED_NEWS {createdAt: datetime($now)}]->(p)
            RETURN p, u
        `,
            { authorId, id, body, now }
        );

        if (!result.records.length) {
            throw new Error('Author not found');
        }

        const record = result.records[0];
        return serializePost(record.get('p'), record.get('u'));
    } finally {
        await session.close();
    }
}

/**
 * Follow or unfollow another user.
 */
async function setFollow({ userId, targetUserId, follow }) {
    if (userId === targetUserId) {
        const err = new Error('You cannot follow yourself.');
        err.statusCode = 400;
        throw err;
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        if (follow) {
            await session.run(
                `
                MATCH (u:User {id: $userId}), (t:User {id: $targetUserId})
                MERGE (u)-[:FOLLOWS]->(t)
            `,
                { userId, targetUserId }
            );
        } else {
            await session.run(
                `
                MATCH (u:User {id: $userId})-[r:FOLLOWS]->(t:User {id: $targetUserId})
                DELETE r
            `,
                { userId, targetUserId }
            );
        }

        return { success: true, following: !!follow };
    } finally {
        await session.close();
    }
}

/**
 * Get list of users that the given user is following.
 */
async function getFollowing(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})-[:FOLLOWS]->(f:User)
            RETURN f
            ORDER BY coalesce(f.name, f.email) ASC
        `,
            { userId }
        );

        return result.records.map((r) => {
            const u = r.get('f').properties;
            return {
                id: u.id,
                name: u.name || u.email || 'Member',
                email: u.email || null
            };
        });
    } finally {
        await session.close();
    }
}

/**
 * Get a news feed for a user.
 * Includes:
 *  - posts from followed users (and self)
 *  - ideas authored by followed users (optional)
 *  - strategic plans for the user's locations (optional)
 */
async function getFeedForUser({
    userId,
    limit = 50,
    includePosts = true,
    includeIdeas = true,
    includePlans = true
}) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);

        const result = await session.run(
            `
            MATCH (me:User {id: $userId})
            // Collect followed users + self
            OPTIONAL MATCH (me)-[:FOLLOWS]->(f:User)
            WITH me, collect(DISTINCT f) + me AS followedUsers

            // Posts from followed users
            CALL {
                WITH followedUsers
                UNWIND (CASE WHEN $includePosts = true THEN followedUsers ELSE [] END) AS author
                MATCH (author)-[:POSTED_NEWS]->(p:NewsPost)
                RETURN collect({
                    kind: 'post',
                    createdAt: p.createdAt,
                    node: p,
                    author: author,
                    location: null
                }) AS posts
            }

            // Ideas authored by followed users
            CALL {
                WITH followedUsers
                UNWIND (CASE WHEN $includeIdeas = true THEN followedUsers ELSE [] END) AS author
                MATCH (author)-[:POSTED]->(idea:Idea)
                RETURN collect({
                    kind: 'idea',
                    createdAt: idea.createdAt,
                    node: idea,
                    author: author,
                    location: null
                }) AS ideas
            }

            // Strategic plans for my locations
            CALL {
                WITH me
                UNWIND (CASE WHEN $includePlans = true THEN [1] ELSE [] END) AS _
                OPTIONAL MATCH (me)-[:LOCATED_IN]->(loc)
                WITH me, collect(DISTINCT loc) as locs
                UNWIND locs AS l
                MATCH (s:StrategicSession {locationId: l.id})
                RETURN collect({
                    kind: 'plan',
                    // Use stageStartedAt so plans bubble to the top when they enter a new stage
                    createdAt: coalesce(s.stageStartedAt, s.createdAt),
                    node: s,
                    author: null,
                    location: l
                }) AS plans
            }

            WITH posts + ideas + plans AS allItems
            UNWIND allItems AS item
            WITH item
            WHERE item.node IS NOT NULL
            RETURN item
            ORDER BY item.createdAt DESC
            LIMIT ${maxLimit}
        `,
            {
                userId,
                includePosts: !!includePosts,
                includeIdeas: !!includeIdeas,
                includePlans: !!includePlans
            }
        );

        return result.records.map((r) => {
            const item = r.get('item');
            const kind = item.kind;
            const createdAt = toISODate(item.createdAt);

            if (kind === 'post') {
                return {
                    kind: 'post',
                    id: item.node.properties.id,
                    createdAt,
                    body: item.node.properties.body,
                    author: {
                        id: item.author.properties.id,
                        name:
                            item.author.properties.name ||
                            item.author.properties.email ||
                            'Member'
                    }
                };
            }

            if (kind === 'idea') {
                return {
                    kind: 'idea',
                    id: item.node.properties.id,
                    createdAt,
                    title: item.node.properties.title,
                    description: item.node.properties.description,
                    author: {
                        id: item.author.properties.id,
                        name:
                            item.author.properties.name ||
                            item.author.properties.email ||
                            'Member'
                    }
                };
            }

            // plan
            return {
                kind: 'plan',
                id: item.node.properties.id,
                createdAt,
                status: item.node.properties.status,
                location: item.location
                    ? {
                          id: item.location.properties.id,
                          name: item.location.properties.name,
                          type: (item.location.labels && item.location.labels[0]) || 'Location'
                      }
                    : null
            };
        });
    } finally {
        await session.close();
    }
}

module.exports = {
    createPost,
    setFollow,
    getFollowing,
    getFeedForUser
};


