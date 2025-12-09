/**
 * Notification Service
 * Stores and retrieves per-user notifications in Neo4j.
 */

const { getSession } = require('../config/db');
const crypto = require('crypto');

function generateId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Create a notification for a user.
 * @param {Object} options
 * @param {string} options.userId - recipient user id
 * @param {string} options.type - short machine type, e.g. 'NOMINATION', 'ENDORSEMENT', 'SYSTEM'
 * @param {string} options.title - short title for display
 * @param {string} [options.body] - optional longer message
 * @param {object} [options.payload] - optional extra data (serialized to JSON)
 */
async function createNotification({ userId, type, title, body, payload }) {
    const session = getSession();
    const id = generateId();
    const payloadJson = payload ? JSON.stringify(payload) : null;

    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})
            CREATE (n:Notification {
                id: $id,
                type: $type,
                title: $title,
                body: $body,
                payloadJson: $payloadJson,
                read: false,
                createdAt: datetime()
            })
            CREATE (u)-[:HAS_NOTIFICATION]->(n)
            RETURN n
        `,
            { userId, id, type, title, body: body || '', payloadJson }
        );

        if (!result.records.length) {
            return null;
        }
        return result.records[0].get('n').properties;
    } finally {
        await session.close();
    }
}

/**
 * List notifications for a user.
 * @param {string} userId
 * @param {Object} options
 * @param {boolean} [options.unreadOnly]
 * @param {number} [options.limit]
 */
async function listNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})-[:HAS_NOTIFICATION]->(n:Notification)
            WHERE $unreadOnly = false OR n.read = false
            RETURN n
            ORDER BY n.createdAt DESC
            LIMIT $limit
        `,
            { userId, unreadOnly: !!unreadOnly, limit: Number.isFinite(limit) ? Number(limit) : 50 }
        );

        return result.records.map((r) => r.get('n').properties);
    } finally {
        await session.close();
    }
}

/**
 * Mark a single notification as read for the current user.
 */
async function markNotificationRead(userId, notificationId) {
    const session = getSession();
    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $userId})-[:HAS_NOTIFICATION]->(n:Notification {id: $id})
            SET n.read = true
            RETURN n
        `,
            { userId, id: notificationId }
        );
        return result.records.length > 0;
    } finally {
        await session.close();
    }
}

/**
 * Mark all notifications as read for a user.
 */
async function markAllNotificationsRead(userId) {
    const session = getSession();
    try {
        await session.run(
            `
            MATCH (u:User {id: $userId})-[:HAS_NOTIFICATION]->(n:Notification)
            WHERE n.read = false
            SET n.read = true
        `,
            { userId }
        );
        return true;
    } finally {
        await session.close();
    }
}

module.exports = {
    createNotification,
    listNotifications,
    markNotificationRead,
    markAllNotificationsRead
};


