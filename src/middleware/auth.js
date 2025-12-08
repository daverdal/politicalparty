/**
 * Auth Middleware
 * Parses JWT from cookies or Authorization header and attaches user context.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

function getTokenFromRequest(req) {
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }

    const authHeader = req.headers.authorization || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        return authHeader.slice(7).trim();
    }

    return null;
}

function authenticate(req, res, next) {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            verified: payload.verified
        };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function requireVerifiedUser(req, res, next) {
    if (!req.user || !req.user.verified) {
        return res.status(403).json({ error: 'Email must be verified to access this resource' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required' });
    }
    next();
}

module.exports = {
    authenticate,
    requireVerifiedUser,
    requireAdmin
};

