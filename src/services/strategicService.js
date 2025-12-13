/**
 * Strategic Planning Service
 * Business logic for StrategicSession entities (one active session per location)
 */

const { getDriver, getDatabase } = require('../config/db');
const { toISODate } = require('../utils/neo4jHelpers');

const ALLOWED_LOCATION_TYPES = [
    'Country',
    'Province',
    'FederalRiding',
    'ProvincialRiding',
    'Town',
    'FirstNation',
    'AdhocGroup'
];

// High-level lifecycle stages for a Strategic Plan (excluding final archival)
const PLAN_STAGES = ['draft', 'discussion', 'decision', 'review', 'completed'];

function safeParseJson(str, fallback) {
    if (!str || typeof str !== 'string') return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
}

// Simple in-memory cache for member names to reduce repeated DB scans
let cachedMemberNames = null;
let cachedNamesFetchedAt = 0;
const NAMES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Load all member display names from Neo4j (lightweight summary).
 */
async function getAllMemberNames() {
    const now = Date.now();
    if (cachedMemberNames && now - cachedNamesFetchedAt < NAMES_CACHE_TTL_MS) {
        return cachedMemberNames;
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (u:User)
            WHERE u.name IS NOT NULL AND trim(u.name) <> ''
            RETURN collect(DISTINCT trim(u.name)) as names
        `
        );

        const names = result.records[0]?.get('names') || [];
        cachedMemberNames = names;
        cachedNamesFetchedAt = now;
        return names;
    } finally {
        await session.close();
    }
}

/**
 * Very simple content moderation rule:
 * - Prevent mentioning other members by proper name in issues/comments.
 * - We approximate by checking for name tokens (length >= 3) as whole words.
 */
async function assertNoMemberNames(text) {
    if (!text || !text.trim()) return;

    const memberNames = await getAllMemberNames();
    if (!memberNames || !memberNames.length) return;

    const lower = text.toLowerCase();

    for (const fullName of memberNames) {
        const tokens = String(fullName)
            .split(/\s+/)
            .filter((t) => t && t.length >= 3);

        for (const token of tokens) {
            const pattern = new RegExp(`\\b${escapeRegExp(token.toLowerCase())}\\b`, 'i');
            if (pattern.test(lower)) {
                const err = new Error(
                    'For safety, please avoid naming individual members in issues or comments. Keep it about ideas, not people.'
                );
                err.code = 'NAME_MENTION_FORBIDDEN';
                throw err;
            }
        }
    }
}

function serializeSession(props) {
    if (!props) return null;
    const serialized = { ...props };
    if (serialized.createdAt) {
        serialized.createdAt = toISODate(serialized.createdAt);
    }
    if (serialized.updatedAt) {
        serialized.updatedAt = toISODate(serialized.updatedAt);
    }
    if (serialized.archivedAt) {
        serialized.archivedAt = toISODate(serialized.archivedAt);
    }
    if (serialized.stageStartedAt) {
        serialized.stageStartedAt = toISODate(serialized.stageStartedAt);
    }

    // Parse collaborative structures (stored as JSON strings) and strip identities for anonymity
    const rawIssues = safeParseJson(serialized.issuesJson, []);
    if (Array.isArray(rawIssues) && rawIssues.length) {
        serialized.issues = rawIssues.map((issue) => ({
            id: issue.id,
            title: issue.title,
            description: issue.description,
            createdAt: issue.createdAt,
            // Only expose aggregate vote count, not voter identities
            votes: Array.isArray(issue.voterIds) ? issue.voterIds.length : issue.votes || 0
        }));
    } else {
        serialized.issues = [];
    }

    const rawComments = safeParseJson(serialized.commentsJson, []);
    if (Array.isArray(rawComments) && rawComments.length) {
        serialized.comments = rawComments.map((comment) => ({
            id: comment.id,
            text: comment.text,
            createdAt: comment.createdAt,
            // Do not expose author identity for anonymity
            section: comment.section || 'session',
            sectionItemId: comment.sectionItemId || null
        }));
    } else {
        serialized.comments = [];
    }

    const rawActions = safeParseJson(serialized.actionsJson, []);
    if (Array.isArray(rawActions) && rawActions.length) {
        serialized.actions = rawActions.map((action) => ({
            id: action.id,
            description: action.description,
            status: action.status || 'proposed',
            dueDate: action.dueDate || null,
            createdAt: action.createdAt
        }));
    } else {
        serialized.actions = [];
    }

    delete serialized.issuesJson;
    delete serialized.commentsJson;
    delete serialized.actionsJson;

    return serialized;
}

/**
 * Get a single strategic session by ID.
 */
async function getSessionById(sessionId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            RETURN s
            LIMIT 1
        `,
            { sessionId }
        );

        if (!result.records.length) return null;

        return serializeSession(result.records[0].get('s').properties);
    } finally {
        await session.close();
    }
}

/**
 * Get the currently active strategic session for a location (if any).
 */
async function getActiveSessionForLocation({ locationId, locationType }) {
    if (!ALLOWED_LOCATION_TYPES.includes(locationType)) {
        throw new Error('Invalid location type');
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (s:StrategicSession {locationId: $locationId, locationType: $locationType})
            WHERE s.status <> 'archived'
            RETURN s
            ORDER BY s.createdAt DESC
            LIMIT 1
        `,
            { locationId, locationType }
        );

        if (!result.records.length) return null;

        let sessionProps = result.records[0].get('s').properties;
        let serialized = serializeSession(sessionProps);

        // Lazy auto-advance based on stage duration (14 days per stage)
        try {
            const stageIndex = PLAN_STAGES.indexOf(serialized.status || 'draft');
            if (stageIndex >= 0 && serialized.status !== 'completed') {
                const startedAtStr = serialized.stageStartedAt || serialized.createdAt;
                if (startedAtStr) {
                    const startedAt = new Date(startedAtStr);
                    const now = new Date();
                    const diffMs = now.getTime() - startedAt.getTime();
                    const days = diffMs / (1000 * 60 * 60 * 24);
                    const increments = Math.floor(days / 14);
                    if (increments > 0) {
                        const newIndex = Math.min(
                            stageIndex + increments,
                            PLAN_STAGES.length - 1
                        );
                        const newStatus = PLAN_STAGES[newIndex];
                        if (newStatus !== serialized.status) {
                            const updated = await updateSession(serialized.id, {
                                status: newStatus
                            });
                            if (updated) {
                                serialized = updated;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // Failing auto-advance should not break the page; log on server if desired.
        }

        return serialized;
    } finally {
        await session.close();
    }
}

/**
 * Get archived sessions for a location (history), newest first.
 */
async function getSessionHistoryForLocation({ locationId, locationType, limit = 20 }) {
    if (!ALLOWED_LOCATION_TYPES.includes(locationType)) {
        throw new Error('Invalid location type');
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (s:StrategicSession {locationId: $locationId, locationType: $locationType})
            WHERE s.status = 'archived'
            RETURN s
            ORDER BY s.createdAt DESC
            LIMIT 20
        `,
            { locationId, locationType }
        );

        return result.records.map((record) => serializeSession(record.get('s').properties));
    } finally {
        await session.close();
    }
}

/**
 * Create a new strategic session for a location.
 * Enforces one non-archived session per (locationType, locationId).
 */
async function createSessionForLocation({
    locationId,
    locationType,
    title,
    vision,
    createdByUserId
}) {
    if (!ALLOWED_LOCATION_TYPES.includes(locationType)) {
        throw new Error('Invalid location type');
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        // Check for existing active session
        const existingResult = await session.run(
            `
            MATCH (s:StrategicSession {locationId: $locationId, locationType: $locationType})
            WHERE s.status <> 'archived'
            RETURN count(s) as cnt
        `,
            { locationId, locationType }
        );

        const cnt = existingResult.records[0].get('cnt').toNumber
            ? existingResult.records[0].get('cnt').toNumber()
            : existingResult.records[0].get('cnt');

        if (cnt > 0) {
            const error = new Error(
                'This riding/location already has an active Strategic Plan. Archive it before starting a new one.'
            );
            error.code = 'ACTIVE_SESSION_EXISTS';
            throw error;
        }

        const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        const result = await session.run(
            `
            CREATE (s:StrategicSession {
                id: $id,
                locationId: $locationId,
                locationType: $locationType,
                title: $title,
                vision: $vision,
                status: 'draft',
                createdAt: datetime($now),
                updatedAt: datetime($now),
                stageStartedAt: datetime($now),
                createdByUserId: $createdByUserId
            })
            RETURN s
        `,
            {
                id,
                locationId,
                locationType,
                title: title || 'Strategic Plan',
                vision: vision || '',
                createdByUserId: createdByUserId || null,
                now
            }
        );

        return serializeSession(result.records[0].get('s').properties);
    } finally {
        await session.close();
    }
}

/**
 * Update basic fields on a strategic session (e.g. vision, title, status).
 */
async function updateSession(sessionId, { title, vision, status }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        let newStatus = status;

        if (newStatus !== undefined) {
            // Only allow known non-archived stages here; archival uses archiveSession
            if (!PLAN_STAGES.includes(newStatus) && newStatus !== 'archived') {
                const err = new Error('Invalid plan status');
                err.statusCode = 400;
                throw err;
            }
        }

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.updatedAt = datetime($now)
            ${title !== undefined ? ', s.title = $title' : ''}
            ${vision !== undefined ? ', s.vision = $vision' : ''}
            ${newStatus !== undefined ? ', s.status = $status, s.stageStartedAt = datetime($now)' : ''}
            RETURN s
        `,
            {
                sessionId,
                now,
                title,
                vision,
                status: newStatus
            }
        );

        if (!result.records.length) {
            return null;
        }

        return serializeSession(result.records[0].get('s').properties);
    } finally {
        await session.close();
    }
}

/**
 * Archive a session (marks status and archivedAt).
 */
async function archiveSession(sessionId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.status = 'archived',
                s.archivedAt = datetime($now),
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, now }
        );

        if (!result.records.length) {
            return null;
        }

        return serializeSession(result.records[0].get('s').properties);
    } finally {
        await session.close();
    }
}

/**
 * Add an issue / priority to a session.
 * Any authenticated, verified user can add issues; identities are not exposed in the API.
 */
async function addIssue({ sessionId, title, description, userId }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    // Enforce anonymity-friendly rule: no member names in issue text
    await assertNoMemberNames(`${title || ''} ${description || ''}`);

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        const issueId = `iss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const currentIssues = Array.isArray(existing.issues) ? existing.issues : [];

        // We keep a parallel raw structure that can include voterIds and internal metadata.
        const rawIssues = currentIssues.map((i) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            createdAt: i.createdAt,
            voterIds: [],
            createdByUserId: null
        }));

        rawIssues.push({
            id: issueId,
            title,
            description,
            createdAt: now,
            voterIds: [],
            createdByUserId: userId || null
        });

        const issuesJson = JSON.stringify(rawIssues);

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.issuesJson = $issuesJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, issuesJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        const updated = serializeSession(result.records[0].get('s').properties);
        // Return just the new issue from the serialized structure
        return updated.issues.find((i) => i.id === issueId);
    } finally {
        await session.close();
    }
}

/**
 * Vote (support) an issue. We track unique voterIds but only expose counts.
 */
async function voteOnIssue({ sessionId, issueId, userId }) {
    if (!userId) {
        throw new Error('User ID required for voting');
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        // Load raw JSON directly to preserve voterIds
        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            RETURN s.issuesJson as issuesJson
        `,
            { sessionId }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        const issuesJson = result.records[0].get('issuesJson');
        const rawIssues = safeParseJson(issuesJson, []);

        const updatedIssues = Array.isArray(rawIssues) ? rawIssues : [];
        const idx = updatedIssues.findIndex((i) => i.id === issueId);
        if (idx === -1) {
            throw new Error('Issue not found');
        }

        const issue = updatedIssues[idx];
        issue.voterIds = Array.isArray(issue.voterIds) ? issue.voterIds : [];

        if (!issue.voterIds.includes(userId)) {
            issue.voterIds.push(userId);
        }

        const newIssuesJson = JSON.stringify(updatedIssues);
        const now = new Date().toISOString();

        const writeResult = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.issuesJson = $issuesJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, issuesJson: newIssuesJson, now }
        );

        if (!writeResult.records.length) {
            throw new Error('Session not found after vote');
        }

        const updated = serializeSession(writeResult.records[0].get('s').properties);
        return updated.issues.find((i) => i.id === issueId);
    } finally {
        await session.close();
    }
}

/**
 * Add a comment to a session (or later to a specific issue/goal).
 * Authors are stored but not exposed for anonymity.
 */
async function addComment({ sessionId, text, section = 'session', sectionItemId = null, userId }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    // Enforce anonymity-friendly rule: no member names in comment text
    await assertNoMemberNames(text);

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const rawComments = safeParseJson(existing.commentsJson, []);
        const commentsArr = Array.isArray(rawComments) ? rawComments : [];

        commentsArr.push({
            id: commentId,
            text,
            createdAt: now,
            section,
            sectionItemId,
            createdByUserId: userId || null
        });

        const commentsJson = JSON.stringify(commentsArr);

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.commentsJson = $commentsJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, commentsJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        const updated = serializeSession(result.records[0].get('s').properties);
        return updated.comments.find((c) => c.id === commentId);
    } finally {
        await session.close();
    }
}

/**
 * Add an action/decision item to a session.
 */
async function addAction({ sessionId, description, dueDate, userId }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        const actionId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const rawActions = safeParseJson(existing.actionsJson, []);
        const actionsArr = Array.isArray(rawActions) ? rawActions : [];

        actionsArr.push({
            id: actionId,
            description,
            status: 'proposed',
            dueDate: dueDate || null,
            createdAt: now,
            createdByUserId: userId || null
        });

        const actionsJson = JSON.stringify(actionsArr);

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.actionsJson = $actionsJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, actionsJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        const updated = serializeSession(result.records[0].get('s').properties);
        return updated.actions.find((a) => a.id === actionId);
    } finally {
        await session.close();
    }
}

module.exports = {
    getSessionById,
    getActiveSessionForLocation,
    getSessionHistoryForLocation,
    createSessionForLocation,
    updateSession,
    archiveSession,
    addIssue,
    voteOnIssue,
    addComment,
    addAction,
    ALLOWED_LOCATION_TYPES
};


