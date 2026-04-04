"use strict";
/**
 * CSRF Protection Middleware
 * Implements CSRF token validation for all state-changing routes (POST, PUT, DELETE, PATCH)
 * Uses database storage for CSRF tokens (can be switched to Redis)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachCsrfToken = exports.csrfProtection = void 0;
exports.generateCsrfToken = generateCsrfToken;
exports.cleanupExpiredCsrfTokens = cleanupExpiredCsrfTokens;
const crypto_1 = __importDefault(require("crypto"));
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];
// Methods that are safe and don't need CSRF protection
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
/**
 * Generate a new CSRF token
 */
async function generateCsrfToken(sessionId, deviceId, userId) {
    const token = crypto_1.default.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    try {
        await client_1.default.csrfToken.create({
            data: {
                token,
                sessionId,
                deviceId: deviceId || null,
                userId: userId || null,
                expiresAt,
            },
        });
        return token;
    }
    catch (error) {
        logger_1.default.error('Failed to generate CSRF token:', error);
        throw new Error('Failed to generate CSRF token');
    }
}
/**
 * Verify CSRF token
 */
async function verifyCsrfToken(token, sessionId, deviceId) {
    try {
        const csrfToken = await client_1.default.csrfToken.findUnique({
            where: { token },
        });
        if (!csrfToken) {
            return false;
        }
        // Check expiration
        if (csrfToken.expiresAt < new Date()) {
            // Clean up expired token
            await client_1.default.csrfToken.delete({ where: { id: csrfToken.id } }).catch(() => { });
            return false;
        }
        // Verify session ID matches
        if (csrfToken.sessionId !== sessionId) {
            return false;
        }
        // Verify device ID if provided
        if (deviceId && csrfToken.deviceId && csrfToken.deviceId !== deviceId) {
            return false;
        }
        return true;
    }
    catch (error) {
        logger_1.default.error('Failed to verify CSRF token:', error);
        return false;
    }
}
/**
 * Clean up expired CSRF tokens (run periodically)
 */
async function cleanupExpiredCsrfTokens() {
    try {
        const result = await client_1.default.csrfToken.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        });
        logger_1.default.debug(`Cleaned up ${result.count} expired CSRF tokens`);
    }
    catch (error) {
        logger_1.default.error('Failed to cleanup expired CSRF tokens:', error);
    }
}
/**
 * CSRF Protection Middleware
 * Validates CSRF token for state-changing requests
 */
const csrfProtection = async (req, res, next) => {
    // Skip CSRF protection for safe methods
    if (req.method && SAFE_METHODS.includes(req.method)) {
        return next();
    }
    // Skip CSRF protection for unprotected routes (e.g., health checks)
    const unprotectedPaths = ['/api/health', '/api/auth/login', '/api/auth/role-login', '/api/auth/invite-login'];
    if (req.path && unprotectedPaths.some((path) => req.path.startsWith(path))) {
        return next();
    }
    try {
        // Get session ID from header or cookie (case-insensitive header check)
        const sessionId = req.headers['x-session-id'] ||
            req.headers['X-Session-Id'] ||
            req.cookies?.sessionId;
        const deviceId = req.headers['x-device-id'] ||
            req.headers['X-Device-Id'];
        const csrfToken = req.headers['x-csrf-token'] ||
            req.headers['X-CSRF-Token'];
        logger_1.default.info('CSRF protection check', {
            method: req.method,
            path: req.path,
            hasSessionId: !!sessionId,
            hasCsrfToken: !!csrfToken,
            hasDeviceId: !!deviceId,
        });
        if (!sessionId) {
            logger_1.default.warn('CSRF protection failed: No session ID', {
                method: req.method,
                path: req.path,
            });
            res.status(403).json({
                error: 'CSRF protection: Session ID required',
                message: 'Session ID must be provided in X-Session-Id header',
            });
            return;
        }
        if (!csrfToken) {
            logger_1.default.warn('CSRF protection failed: No CSRF token', {
                method: req.method,
                path: req.path,
            });
            res.status(403).json({
                error: 'CSRF protection: Token required',
                message: 'CSRF token must be provided in X-CSRF-Token header',
            });
            return;
        }
        // Verify token
        const isValid = await verifyCsrfToken(csrfToken, sessionId, deviceId);
        if (!isValid) {
            logger_1.default.warn('CSRF protection failed: Invalid token', {
                method: req.method,
                path: req.path,
                sessionId: sessionId?.substring(0, 8) + '...',
            });
            res.status(403).json({
                error: 'CSRF protection: Invalid token',
                message: 'CSRF token is invalid or expired',
            });
            return;
        }
        logger_1.default.info('CSRF protection passed', {
            method: req.method,
            path: req.path,
        });
        // Attach token to request for potential reuse
        req.csrfToken = csrfToken;
        next();
    }
    catch (error) {
        logger_1.default.error('CSRF protection error:', error);
        res.status(500).json({
            error: 'CSRF protection: Internal error',
            message: 'Failed to verify CSRF token',
        });
    }
};
exports.csrfProtection = csrfProtection;
/**
 * Middleware to generate and attach CSRF token to response
 * Should be used on routes that need to return a CSRF token to the client
 */
const attachCsrfToken = async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId || crypto_1.default.randomBytes(16).toString('hex');
        const deviceId = req.headers['x-device-id'];
        const userId = req.user?.id;
        const token = await generateCsrfToken(sessionId, deviceId, userId);
        // Attach token to response header
        res.setHeader('X-CSRF-Token', token);
        res.setHeader('X-Session-Id', sessionId);
        // Also attach to response body if it's a JSON response
        const originalJson = res.json.bind(res);
        res.json = function (body) {
            if (typeof body === 'object' && body !== null) {
                body.csrfToken = token;
                body.sessionId = sessionId;
            }
            return originalJson(body);
        };
        next();
    }
    catch (error) {
        logger_1.default.error('Failed to attach CSRF token:', error);
        next(); // Don't block request if token generation fails
    }
};
exports.attachCsrfToken = attachCsrfToken;
//# sourceMappingURL=csrf.js.map