/**
 * Strategic Planning Service
 * Business logic for StrategicSession entities (one active session per location)
 */

const { getDriver, getDatabase } = require('../config/db');
const { toISODate } = require('../utils/neo4jHelpers');
const locationService = require('./locationService');
const notificationService = require('./notificationService');

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
    if (serialized.cycleStart) {
        serialized.cycleStart = toISODate(serialized.cycleStart);
    }
    if (serialized.cycleEnd) {
        serialized.cycleEnd = toISODate(serialized.cycleEnd);
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

    const rawGoals = safeParseJson(serialized.goalsJson, []);
    if (Array.isArray(rawGoals) && rawGoals.length) {
        serialized.goals = rawGoals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            description: goal.description,
            metric: goal.metric || '',
            dueDate: goal.dueDate || null,
            status: goal.status || 'not_started',
            currentValue: goal.currentValue || '',
            createdAt: goal.createdAt
        }));
    } else {
        serialized.goals = [];
    }

    // SWOT: strengths, weaknesses, opportunities, threats
    const defaultSwot = {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    };
    const rawSwot = safeParseJson(serialized.swotJson, defaultSwot) || defaultSwot;
    serialized.swot = {
        strengths: Array.isArray(rawSwot.strengths) ? rawSwot.strengths : [],
        weaknesses: Array.isArray(rawSwot.weaknesses) ? rawSwot.weaknesses : [],
        opportunities: Array.isArray(rawSwot.opportunities) ? rawSwot.opportunities : [],
        threats: Array.isArray(rawSwot.threats) ? rawSwot.threats : []
    };

    // PEST: political, economic, social, technological
    const defaultPest = {
        political: [],
        economic: [],
        social: [],
        technological: []
    };
    const rawPest = safeParseJson(serialized.pestJson, defaultPest) || defaultPest;
    serialized.pest = {
        political: Array.isArray(rawPest.political) ? rawPest.political : [],
        economic: Array.isArray(rawPest.economic) ? rawPest.economic : [],
        social: Array.isArray(rawPest.social) ? rawPest.social : [],
        technological: Array.isArray(rawPest.technological) ? rawPest.technological : []
    };

    delete serialized.issuesJson;
    delete serialized.commentsJson;
    delete serialized.actionsJson;
    delete serialized.goalsJson;
    delete serialized.swotJson;
    delete serialized.pestJson;
    delete serialized.reviewJson;

    return serialized;
}

/**
 * Award Strategic Planning points to a user.
 * - Uses u.strategicPoints (float) to keep planning contributions separate from idea likes.
 * - Callers should pass amounts in "idea-like units" (1.0 = one like, 0.1 = small participation).
 */
async function awardStrategicPoints(userId, amount) {
    if (!userId || !amount) return;

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        await session.run(
            `
            MATCH (u:User {id: $userId})
            SET u.strategicPoints = coalesce(u.strategicPoints, 0) + $amount
        `,
            { userId, amount }
        );
    } finally {
        await session.close();
    }
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
        const isAdhoc = locationType === 'AdhocGroup';
        const now = new Date();
        const currentYear = now.getFullYear();

        let record = null;

        if (isAdhoc) {
            // For Adhoc groups, keep original behavior: any non-archived plan
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
            record = result.records[0];
        } else {
            // For non-Adhoc locations, auto-cycle plans per year
            // 1) Try to find an active plan for this year
            let result = await session.run(
                `
                MATCH (s:StrategicSession {locationId: $locationId, locationType: $locationType})
                WHERE s.status <> 'archived' AND s.year = $year
                RETURN s
                ORDER BY s.createdAt DESC
                LIMIT 1
            `,
                { locationId, locationType, year: currentYear }
            );

            if (!result.records.length) {
                // 2) Archive any non-archived sessions from previous years
                await session.run(
                    `
                    MATCH (s:StrategicSession {locationId: $locationId, locationType: $locationType})
                    WHERE s.status <> 'archived' AND s.year < $year
                    SET s.status = 'archived',
                        s.archivedAt = datetime(),
                        s.cycleEnd = datetime(),
                        s.updatedAt = datetime()
                `,
                    { locationId, locationType, year: currentYear }
                );

                // 3) Lazily create a new plan for the current year
                const created = await createSessionForLocation({
                    locationId,
                    locationType,
                    title: null,
                    vision: '',
                    createdByUserId: null
                });

                // Re-load the freshly created node so we can reuse serialization logic below
                result = await session.run(
                    `
                    MATCH (s:StrategicSession {id: $id})
                    RETURN s
                    LIMIT 1
                `,
                    { id: created.id }
                );
                if (!result.records.length) return null;
                record = result.records[0];
            } else {
                record = result.records[0];
            }
        }

        let sessionProps = record.get('s').properties;
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

        // Attach anonymous participation metadata (counts and revealed names)
        const withMeta = await attachVisibilityMetadata(serialized);
        return withMeta;
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

        const sessions = result.records.map((record) =>
            serializeSession(record.get('s').properties)
        );

        const withMeta = [];
        for (const s of sessions) {
            withMeta.push(await attachVisibilityMetadata(s));
        }

        return withMeta;
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

        if (cnt > 0 && locationType === 'AdhocGroup') {
            const error = new Error(
                'This riding/location already has an active Strategic Plan. Archive it before starting a new one.'
            );
            error.code = 'ACTIVE_SESSION_EXISTS';
            throw error;
        }

        const id = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date();
        const nowIso = now.toISOString();
        const currentYear = now.getFullYear();

        // For non-Adhoc locations, treat plans as annual cycles
        const year = currentYear;
        const cycleStartDate = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0));
        const cycleStartIso = cycleStartDate.toISOString();

        const result = await session.run(
            `
            CREATE (s:StrategicSession {
                id: $id,
                locationId: $locationId,
                locationType: $locationType,
                title: coalesce($title, 'Strategic Plan'),
                vision: $vision,
                status: 'draft',
                createdAt: datetime($now),
                updatedAt: datetime($now),
                stageStartedAt: datetime($now),
                year: $year,
                cycleStart: datetime($cycleStart),
                createdByUserId: $createdByUserId
            })
            RETURN s
        `,
            {
                id,
                locationId,
                locationType,
                title: title || null,
                vision: vision || '',
                createdByUserId: createdByUserId || null,
                now: nowIso,
                year,
                cycleStart: cycleStartIso
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
    const existing = await getSessionById(sessionId);
    if (!existing) {
        return null;
    }

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

        const updated = serializeSession(result.records[0].get('s').properties);

        // If status changed (and is a real stage), notify riding members
        if (existing.status !== updated.status && PLAN_STAGES.includes(updated.status)) {
            try {
                await notifyStageChange(existing, updated);
            } catch (e) {
                // Notification failures should not break core plan update
            }

            // Milestone rewards: Decision and Completed stages
            try {
                if (updated.status === 'decision') {
                    await awardDecisionMilestonePoints(updated);
                } else if (updated.status === 'completed') {
                    await awardCompletionMilestonePoints(updated);
                }
            } catch (e) {
                // Points failures should not break core plan update
            }
        }

        return updated;
    } finally {
        await session.close();
    }
}

/**
 * Determine all participants in a session based on authored content and votes.
 * Returns a Set of userIds.
 */
async function getSessionParticipantIds(sessionId) {
    const session = await getSessionById(sessionId);
    if (!session) return new Set();

    const ids = new Set();

    const addId = (id) => {
        if (id) ids.add(id);
    };

    // Issues authors and voters
    (session.issues || []).forEach((iss) => {
        addId(iss.createdByUserId);
        (iss.voterIds || []).forEach(addId);
    });

    // Comments authors
    (session.comments || []).forEach((c) => addId(c.createdByUserId));

    // Actions authors
    (session.actions || []).forEach((a) => addId(a.createdByUserId));

    // Goals authors
    (session.goals || []).forEach((g) => addId(g.createdByUserId));

    // Plan creator
    addId(session.createdByUserId);

    return ids;
}

/**
 * Read the reveal preferences for a session and resolve opted-in participant names.
 */
async function getRevealInfo(sessionId) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $id})
            RETURN s.revealUserIdsJson as revealUserIdsJson
        `,
            { id: sessionId }
        );

        if (!result.records.length) {
            return { ids: new Set(), participants: [] };
        }

        const jsonVal = result.records[0].get('revealUserIdsJson');
        const raw = safeParseJson(jsonVal, []);
        const idArray = Array.isArray(raw) ? raw.filter((id) => !!id) : [];
        const ids = new Set(idArray);

        if (!idArray.length) {
            return { ids, participants: [] };
        }

        const usersResult = await session.run(
            `
            MATCH (u:User)
            WHERE u.id IN $ids
            RETURN u
        `,
            { ids: idArray }
        );

        const participants = usersResult.records.map((r) => {
            const u = r.get('u').properties;
            return {
                id: u.id,
                name: u.name || u.email || 'Member'
            };
        });

        return { ids, participants };
    } finally {
        await session.close();
    }
}

/**
 * Attach anonymous participation metadata to a serialized session:
 * - participantCount: how many people contributed in any way
 * - revealedParticipants: list of users who opted to show their name (only when completed)
 */
async function attachVisibilityMetadata(session) {
    if (!session) return null;

    const participantIds = await getSessionParticipantIds(session.id);
    let revealedParticipants = [];

    if (session.status === 'completed') {
        const revealInfo = await getRevealInfo(session.id);
        revealedParticipants = revealInfo.participants;
    }

    return {
        ...session,
        participantCount: participantIds.size,
        revealedParticipants
    };
}

/**
 * Milestone reward: when a plan enters the Decision stage.
 * Each participant gets +2.0 Strategic points once per session.
 */
async function awardDecisionMilestonePoints(session) {
    const driver = getDriver();
    const neoSession = driver.session({ database: getDatabase() });

    try {
        const result = await neoSession.run(
            `
            MATCH (s:StrategicSession {id: $id})
            WITH s, coalesce(s.decisionRewardGiven, false) as alreadyGiven
            WHERE alreadyGiven = false
            SET s.decisionRewardGiven = true
            RETURN s.id as id
        `,
            { id: session.id }
        );

        if (!result.records.length) {
            // Reward already given or session not found
            return;
        }
    } finally {
        await neoSession.close();
    }

    const participantIds = await getSessionParticipantIds(session.id);
    await Promise.all(
        Array.from(participantIds).map((userId) => awardStrategicPoints(userId, 2.0))
    );
}

/**
 * Milestone reward: when a plan is marked Completed AND has at least one action.
 * Each participant gets +2.0 Strategic points once per session.
 */
async function awardCompletionMilestonePoints(session) {
    const hasActions = Array.isArray(session.actions) && session.actions.length > 0;
    if (!hasActions) return;

    const driver = getDriver();
    const neoSession = driver.session({ database: getDatabase() });

    try {
        const result = await neoSession.run(
            `
            MATCH (s:StrategicSession {id: $id})
            WITH s, coalesce(s.completionRewardGiven, false) as alreadyGiven
            WHERE alreadyGiven = false
            SET s.completionRewardGiven = true
            RETURN s.id as id
        `,
            { id: session.id }
        );

        if (!result.records.length) {
            // Reward already given or session not found
            return;
        }
    } finally {
        await neoSession.close();
    }

    const participantIds = await getSessionParticipantIds(session.id);
    await Promise.all(
        Array.from(participantIds).map((userId) => awardStrategicPoints(userId, 2.0))
    );
}

/**
 * Check whether a given user participated in a session and whether they have chosen to reveal.
 */
async function getParticipationForUser(sessionId, userId) {
    const participantIds = await getSessionParticipantIds(sessionId);
    const participated = participantIds.has(userId);

    if (!participated) {
        return { participated: false, revealed: false };
    }

    const revealInfo = await getRevealInfo(sessionId);
    const revealed = revealInfo.ids.has(userId);

    return { participated: true, revealed };
}

/**
 * Set a user's reveal preference for a session (opt in/out of being named on the plan).
 * - Only allowed if the user actually participated in the session.
 * - Staying anonymous is the default; reveal is always opt-in.
 */
async function setRevealPreference({ sessionId, userId, reveal }) {
    const participantIds = await getSessionParticipantIds(sessionId);
    if (!participantIds.has(userId)) {
        const err = new Error('Only participants in this plan can change visibility.');
        err.statusCode = 403;
        throw err;
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $id})
            RETURN s.revealUserIdsJson as revealUserIdsJson
        `,
            { id: sessionId }
        );

        if (!result.records.length) {
            const err = new Error('Session not found');
            err.statusCode = 404;
            throw err;
        }

        const jsonVal = result.records[0].get('revealUserIdsJson');
        const raw = safeParseJson(jsonVal, []);
        let ids = Array.isArray(raw) ? raw.filter((id) => !!id) : [];

        if (reveal) {
            if (!ids.includes(userId)) {
                ids.push(userId);
            }
        } else {
            ids = ids.filter((id) => id !== userId);
        }

        const newJson = JSON.stringify(ids);

        await session.run(
            `
            MATCH (s:StrategicSession {id: $id})
            SET s.revealUserIdsJson = $json
        `,
            { id: sessionId, json: newJson }
        );

        return { success: true, reveal: !!reveal };
    } finally {
        await session.close();
    }
}

/**
 * Notify all members of a location that a plan has entered a new stage.
 */
async function notifyStageChange(previous, current) {
    const locationId = current.locationId;
    const locationType = current.locationType;

    if (!locationId || !locationType) return;

    const stageLabelMap = {
        draft: 'Draft',
        discussion: 'Discussion',
        decision: 'Decision',
        review: 'Review',
        completed: 'Completed'
    };

    const stageLabel = stageLabelMap[current.status] || current.status || 'Plan';

    // Look up a friendly location name
    let locationName = locationType;
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    try {
        const result = await session.run(
            `
            MATCH (loc:${locationType} {id: $locationId})
            RETURN loc.name as name
            LIMIT 1
        `,
            { locationId }
        );
        const record = result.records[0];
        if (record) {
            locationName = record.get('name') || locationName;
        }
    } catch (e) {
        // Ignore lookup errors; fall back to type/id
    } finally {
        await session.close();
    }

    // Find all members in this location (using existing helper)
    let members = [];
    try {
        members = await locationService.getUsersForLocation({ locationId, locationType });
    } catch (e) {
        members = [];
    }

    if (!members || !members.length) return;

    const title =
        `Strategic Plan: ${stageLabel} stage for ${locationName}`;
    const body =
        `The Strategic Plan for ${locationName} has moved from “${previous.status || 'unknown'}” to “${stageLabel}” stage.`;

    // Fire-and-forget notifications for each member
    await Promise.all(
        members.map((m) =>
            notificationService.createNotification({
                userId: m.id,
                type: 'STRATEGIC_PLAN_STAGE',
                title,
                body,
                payload: {
                    sessionId: current.id,
                    stage: current.status,
                    locationId,
                    locationType
                }
            }).catch(() => null)
        )
    );
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

        // Participation reward: +0.3 points for adding an Issue
        if (userId) {
            await awardStrategicPoints(userId, 0.3);
        }

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

    // Suppress likes/support in the first phase (Start / draft)
    const sessionMeta = await getSessionById(sessionId);
    if (!sessionMeta) {
        throw new Error('Session not found');
    }
    if (sessionMeta.status === 'draft') {
        const err = new Error(
            'Supporting issues is only available after the Start phase (once the plan leaves draft).'
        );
        err.statusCode = 400;
        throw err;
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

        // Participation reward: +0.1 points for supporting an Issue
        await awardStrategicPoints(userId, 0.1);

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

        // Participation reward: +0.1 points for adding a Comment
        if (userId) {
            await awardStrategicPoints(userId, 0.1);
        }

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

        // Participation reward: +0.2 points for adding an Action
        if (userId) {
            await awardStrategicPoints(userId, 0.2);
        }

        return updated.actions.find((a) => a.id === actionId);
    } finally {
        await session.close();
    }
}

/**
 * Add a goal/objective to a session.
 * Goals are higher-level outcomes (often SMART) linked to the plan.
 */
async function addGoal({ sessionId, title, description, metric, dueDate, userId }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        const goalId = `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const rawGoals = safeParseJson(existing.goalsJson, []);
        const goalsArr = Array.isArray(rawGoals) ? rawGoals : [];

        goalsArr.push({
            id: goalId,
            title,
            description,
            metric: metric || '',
            dueDate: dueDate || null,
            status: 'not_started',
            currentValue: '',
            createdAt: now,
            createdByUserId: userId || null
        });

        const goalsJson = JSON.stringify(goalsArr);

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.goalsJson = $goalsJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, goalsJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        const updated = serializeSession(result.records[0].get('s').properties);

        // Participation reward: +0.3 points for adding a Goal
        if (userId) {
            await awardStrategicPoints(userId, 0.3);
        }

        return updated.goals.find((g) => g.id === goalId);
    } finally {
        await session.close();
    }
}

/**
 * Update progress/status for a single goal.
 */
async function updateGoalProgress({ sessionId, goalId, status, currentValue }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    const allowedStatuses = ['not_started', 'on_track', 'at_risk', 'off_track', 'completed'];
    if (status && !allowedStatuses.includes(status)) {
        const err = new Error('Invalid goal status');
        err.statusCode = 400;
        throw err;
    }

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const rawGoals = safeParseJson(existing.goalsJson, []);
        const goalsArr = Array.isArray(rawGoals) ? rawGoals : [];
        const idx = goalsArr.findIndex((g) => g.id === goalId);
        if (idx === -1) {
            const err = new Error('Goal not found');
            err.statusCode = 404;
            throw err;
        }

        const goal = goalsArr[idx];
        if (status) {
            goal.status = status;
        }
        if (currentValue !== undefined) {
            goal.currentValue = String(currentValue || '');
        }

        const goalsJson = JSON.stringify(goalsArr);
        const now = new Date().toISOString();

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.goalsJson = $goalsJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, goalsJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        const updated = serializeSession(result.records[0].get('s').properties);

        // Participation reward: +0.2 points for updating Goal progress
        if (goal && goal.createdByUserId) {
            await awardStrategicPoints(goal.createdByUserId, 0.2);
        }

        return updated.goals.find((g) => g.id === goalId);
    } finally {
        await session.close();
    }
}

/**
 * Replace SWOT content for a session.
 * swot: { strengths: string[], weaknesses: string[], opportunities: string[], threats: string[] }
 */
async function updateSwot({ sessionId, swot }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    const normalizeList = (arr) =>
        Array.isArray(arr)
            ? arr
                  .map((s) => String(s || '').trim())
                  .filter((s) => s.length > 0)
            : [];

    const cleaned = {
        strengths: normalizeList(swot.strengths),
        weaknesses: normalizeList(swot.weaknesses),
        opportunities: normalizeList(swot.opportunities),
        threats: normalizeList(swot.threats)
    };

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        const swotJson = JSON.stringify(cleaned);

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.swotJson = $swotJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, swotJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        return serializeSession(result.records[0].get('s').properties).swot;
    } finally {
        await session.close();
    }
}

/**
 * Replace PEST content for a session.
 * pest: { political: string[], economic: string[], social: string[], technological: string[] }
 */
async function updatePest({ sessionId, pest }) {
    const existing = await getSessionById(sessionId);
    if (!existing) {
        throw new Error('Session not found');
    }

    const normalizeList = (arr) =>
        Array.isArray(arr)
            ? arr
                  .map((s) => String(s || '').trim())
                  .filter((s) => s.length > 0)
            : [];

    const cleaned = {
        political: normalizeList(pest.political),
        economic: normalizeList(pest.economic),
        social: normalizeList(pest.social),
        technological: normalizeList(pest.technological)
    };

    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const now = new Date().toISOString();
        const pestJson = JSON.stringify(cleaned);

        const result = await session.run(
            `
            MATCH (s:StrategicSession {id: $sessionId})
            SET s.pestJson = $pestJson,
                s.updatedAt = datetime($now)
            RETURN s
        `,
            { sessionId, pestJson, now }
        );

        if (!result.records.length) {
            throw new Error('Session not found');
        }

        return serializeSession(result.records[0].get('s').properties).pest;
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
    addGoal,
    updateGoalProgress,
    updateSwot,
    updatePest,
    getParticipationForUser,
    setRevealPreference,
    ALLOWED_LOCATION_TYPES
};


