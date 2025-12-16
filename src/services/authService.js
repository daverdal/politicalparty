/**
 * Auth Service
 * User creation, lookup and verification helpers for authentication.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDriver, getDatabase } = require('../config/db');
const { toNumber } = require('../utils'); // re-exported neo4jHelpers

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const OWNER_EMAIL = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase() || null;

if (JWT_SECRET === 'dev_jwt_secret_change_me') {
    // eslint-disable-next-line no-console
    console.warn('[auth] Using default JWT secret. Set JWT_SECRET in your environment for production.');
}

function generateId() {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return crypto.randomBytes(16).toString('hex');
}

function generateEmailVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
}

function generatePasswordResetToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createUserWithEmail({ email, password, name }) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const id = generateId();
    const verificationToken = generateEmailVerificationToken();

    try {
        const result = await session.run(
            `
            CREATE (u:User {
                id: $id,
                email: $email,
                passwordHash: $passwordHash,
                name: $name,
                role: 'member',
                createdAt: datetime(),
                updatedAt: datetime(),
                verifiedAt: null,
                emailVerificationToken: $verificationToken,
                emailVerificationExpiresAt: datetime() + duration('PT24H')
            })
            RETURN u
        `,
            {
                id,
                email: normalizedEmail,
                passwordHash,
                name: name || normalizedEmail,
                verificationToken
            }
        );

        const userNode = result.records[0].get('u');
        return mapUser(userNode);
    } finally {
        await session.close();
    }
}

async function findUserByEmail(email) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const result = await session.run(
            `
            MATCH (u:User {email: $email})
            RETURN u
        `,
            { email: normalizedEmail }
        );

        if (!result.records.length) return null;
        return mapUser(result.records[0].get('u'));
    } finally {
        await session.close();
    }
}

async function findUserById(id) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (u:User {id: $id})
            RETURN u
        `,
            { id }
        );

        if (!result.records.length) return null;
        return mapUser(result.records[0].get('u'));
    } finally {
        await session.close();
    }
}

async function verifyEmailByToken(token) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });

    try {
        const result = await session.run(
            `
            MATCH (u:User {emailVerificationToken: $token})
            WHERE u.emailVerificationExpiresAt IS NULL
               OR u.emailVerificationExpiresAt > datetime()
            SET u.verifiedAt = datetime(),
                u.emailVerificationToken = null,
                u.emailVerificationExpiresAt = null,
                u.updatedAt = datetime()
            RETURN u
        `,
            { token }
        );

        if (!result.records.length) return null;
        return mapUser(result.records[0].get('u'));
    } finally {
        await session.close();
    }
}

async function createOrRefreshEmailVerificationToken(email) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    const normalizedEmail = email.trim().toLowerCase();
    const token = generateEmailVerificationToken();

    try {
        const result = await session.run(
            `
            MATCH (u:User {email: $email})
            WHERE u.verifiedAt IS NULL
            SET u.emailVerificationToken = $token,
                u.emailVerificationExpiresAt = datetime() + duration('PT24H'),
                u.updatedAt = datetime()
            RETURN u, $token AS token
        `,
            { email: normalizedEmail, token }
        );

        if (!result.records.length) return null;
        return {
            user: mapUser(result.records[0].get('u')),
            token: result.records[0].get('token')
        };
    } finally {
        await session.close();
    }
}

async function validatePassword(user, password) {
    if (!user || !user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
}

function createJwtForUser(user) {
    let role = user.role || 'member';

    // Protect the configured owner email: always treat as admin
    if (OWNER_EMAIL && user.email && user.email.toLowerCase() === OWNER_EMAIL) {
        role = 'admin';
    }

    const payload = {
        sub: user.id,
        email: user.email,
        role,
        verified: !!user.verifiedAt
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

async function createPasswordResetToken(email) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    const normalizedEmail = email.trim().toLowerCase();
    const token = generatePasswordResetToken();

    try {
        const result = await session.run(
            `
            MATCH (u:User {email: $email})
            SET u.passwordResetToken = $token,
                u.passwordResetExpiresAt = datetime() + duration('PT1H'),
                u.updatedAt = datetime()
            RETURN u
        `,
            { email: normalizedEmail, token }
        );

        if (!result.records.length) return null;
        return token;
    } finally {
        await session.close();
    }
}

async function resetPasswordByToken(token, newPassword) {
    const driver = getDriver();
    const session = driver.session({ database: getDatabase() });
    const passwordHash = await bcrypt.hash(newPassword, 10);

    try {
        const result = await session.run(
            `
            MATCH (u:User {passwordResetToken: $token})
            WHERE u.passwordResetExpiresAt IS NULL
               OR u.passwordResetExpiresAt > datetime()
            SET u.passwordHash = $passwordHash,
                u.passwordResetToken = null,
                u.passwordResetExpiresAt = null,
                u.updatedAt = datetime()
            RETURN u
        `,
            { token, passwordHash }
        );

        if (!result.records.length) return null;
        return mapUser(result.records[0].get('u'));
    } finally {
        await session.close();
    }
}

function mapUser(node) {
    const props = node.properties;
    // Cast numeric fields if any are present later
    const user = {
        ...props
    };

    if (user.points && typeof user.points === 'object') {
        user.points = toNumber(user.points);
    }

    return user;
}

module.exports = {
    createUserWithEmail,
    findUserByEmail,
    findUserById,
    verifyEmailByToken,
    createOrRefreshEmailVerificationToken,
    validatePassword,
    createJwtForUser,
    createPasswordResetToken,
    resetPasswordByToken
};


