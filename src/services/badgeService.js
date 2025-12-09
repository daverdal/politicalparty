/**
 * Badge Service
 * Awards and reads local/global points-based badges for users.
 *
 * Badges are derived from points (computed by pointsService) and stored so
 * they can be displayed quickly and trigger notifications when first earned.
 */

const { getDriver, getDatabase } = require('../config/db');
const { toNumber } = require('../utils/neo4jHelpers');
const pointsService = require('./pointsService');
const notificationService = require('./notificationService');

// Simple thresholds for now – can be made configurable later
const LOCAL_THRESHOLDS = [
    { level: 'bronze', min: 10 },
    { level: 'silver', min: 50 },
    { level: 'gold', min: 200 }
];

const GLOBAL_THRESHOLDS = [
    { level: 'bronze', min: 25 },
    { level: 'silver', min: 100 },
    { level: 'gold', min: 400 }
];

function computeTargetBadges({ localPoints, globalPoints }) {
    const badges = [];

    for (const def of LOCAL_THRESHOLDS) {
        if (localPoints >= def.min) {
            badges.push({
                scope: 'local',
                level: def.level,
                key: `points:local:${def.level}`
            });
        }
    }

    for (const def of GLOBAL_THRESHOLDS) {
        if (globalPoints >= def.min) {
            badges.push({
                scope: 'global',
                level: def.level,
                key: `points:global:${def.level}`
            });
        }
    }

    return badges;
}

/**
 * Ensure a user's points-based badges are up to date.
 * Returns full badge list and an array of newly awarded badges.
 */
async function recalcBadgesForUser(userId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const summary = await pointsService.getUserPointsSummary(userId);
        if (!summary) {
            return { badges: [], newBadges: [] };
        }

        const { localPoints, globalPoints } = summary;
        const target = computeTargetBadges({ localPoints, globalPoints });

        // Load existing badges
        const existingRes = await session.run(
            `
            MATCH (u:User {id: $userId})-[:HAS_BADGE]->(b:Badge)
            RETURN b
        `,
            { userId }
        );

        const existing = existingRes.records.map((r) => r.get('b').properties);
        const existingKeys = new Set(existing.map((b) => b.key));

        const newBadges = [];

        // Create any missing badges
        for (const t of target) {
            if (existingKeys.has(t.key)) continue;

            const createRes = await session.run(
                `
                MATCH (u:User {id: $userId})
                CREATE (b:Badge {
                    id: randomUUID(),
                    userId: u.id,
                    key: $key,
                    scope: $scope,
                    level: $level,
                    type: 'points',
                    createdAt: datetime()
                })
                CREATE (u)-[:HAS_BADGE]->(b)
                RETURN b
            `,
                {
                    userId,
                    key: t.key,
                    scope: t.scope,
                    level: t.level
                }
            );

            if (createRes.records.length) {
                const b = createRes.records[0].get('b').properties;
                newBadges.push(b);
                existing.push(b);
            }
        }

        // Notify for newly earned badges
        for (const b of newBadges) {
            try {
                const scopeLabel = b.scope === 'local' ? 'Local' : 'Global';
                const levelLabel = b.level.charAt(0).toUpperCase() + b.level.slice(1);
                await notificationService.createNotification({
                    userId,
                    type: 'BADGE',
                    title: `You earned a ${scopeLabel} ${levelLabel} badge`,
                    body:
                        b.scope === 'local'
                            ? `You reached a new milestone for support from your local riding.`
                            : `You reached a new milestone for support across the whole network.`,
                    payload: {
                        badgeKey: b.key,
                        scope: b.scope,
                        level: b.level
                    }
                });
            } catch (err) {
                // Best-effort only – don't fail badge calculation on notification issues
                // eslint-disable-next-line no-console
                console.error('[badges] failed to send badge notification:', err);
            }
        }

        // Normalize output
        const badges = existing.map((b) => ({
            id: b.id,
            key: b.key,
            scope: b.scope,
            level: b.level,
            type: b.type,
            createdAt: b.createdAt && b.createdAt.toString ? b.createdAt.toString() : b.createdAt
        }));

        return { badges, newBadges };
    } finally {
        await session.close();
    }
}

/**
 * Public helper: get badges for a user (recalculating thresholds first).
 */
async function getBadgesForUser(userId) {
    const { badges } = await recalcBadgesForUser(userId);
    return badges;
}

module.exports = {
    getBadgesForUser,
    recalcBadgesForUser
};


