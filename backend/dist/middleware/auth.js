"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = exports.requireAdmin = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("../utils/logger"));
const compatibility_resolver_1 = require("../services/permissions/compatibility-resolver");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        let token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');
        const requestDeviceId = req.headers['x-device-id'];
        // Allow token via query parameter (for images/downloads)
        if (!token && req.query.token) {
            token = req.query.token;
        }
        if (!token) {
            logger_1.default.warn('Authentication failed: No token provided', {
                path: req.path,
                method: req.method,
                hasAuthHeader: !!authHeader,
                authHeaderValue: authHeader ? 'present' : 'missing',
                allHeaders: Object.keys(req.headers),
            });
            res.status(401).json({
                error: 'Authentication required',
                message: 'No authorization token provided. Please log in again.',
            });
            return;
        }
        // SECURITY: Require JWT_SECRET in production
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            if (process.env.NODE_ENV === 'production') {
                logger_1.default.error('JWT_SECRET not set in production');
                res.status(500).json({ error: 'Server configuration error' });
                return;
            }
            logger_1.default.warn('⚠️  WARNING: JWT_SECRET not set. Using default for development only.');
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, jwtSecret || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY');
        }
        catch (jwtError) {
            logger_1.default.warn('JWT verification failed', {
                path: req.path,
                method: req.method,
                error: jwtError?.message || 'Unknown JWT error',
                name: jwtError?.name,
            });
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Verify user still exists
        let user = await client_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, username: true, email: true, roleId: true, deviceApprovalStatus: true },
        });
        let isCompanyUser = false;
        let companyUserObj = null;
        if (!user) {
            // Try finding in CompanyUser table
            companyUserObj = await client_1.default.companyUser.findUnique({
                where: { id: decoded.userId },
                include: { company: true }
            });
            if (companyUserObj) {
                if (!companyUserObj.isActive || companyUserObj.company.status !== 'active') {
                    res.status(403).json({ error: 'Account is inactive or company suspended' });
                    return;
                }
                isCompanyUser = true;
            }
        }
        if (!user && !isCompanyUser) {
            logger_1.default.warn('Authentication failed: User not found', {
                path: req.path,
                method: req.method,
                userId: decoded.userId,
            });
            res.status(401).json({ error: 'User not found' });
            return;
        }
        // Validate deviceId if present in token
        if (decoded.deviceId && requestDeviceId) {
            if (decoded.deviceId !== requestDeviceId) {
                logger_1.default.warn('Device ID mismatch', {
                    path: req.path,
                    method: req.method,
                    tokenDeviceId: decoded.deviceId,
                    requestDeviceId,
                });
                res.status(403).json({
                    error: 'Device ID mismatch',
                    message: 'Session device ID does not match request device ID',
                });
                return;
            }
        }
        if (user) {
            req.user = {
                id: user.id,
                username: user.username,
                email: user.email,
                roleId: user.roleId,
            };
        }
        else {
            // Populate req.user from companyUser data for compatibility
            req.user = {
                id: companyUserObj.id,
                username: companyUserObj.email, // Use email as username for company users
                email: companyUserObj.email,
                roleId: companyUserObj.role, // Use role string as roleId string
            };
        }
        next();
    }
    catch (error) {
        logger_1.default.error('Authentication error:', {
            error: error?.message || 'Unknown error',
            stack: error?.stack,
            name: error?.name,
            path: req.path,
            method: req.method,
        });
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        // Use explicit select to avoid querying category column if it doesn't exist
        const role = await client_1.default.role.findUnique({
            where: { id: req.user.roleId },
            select: {
                id: true,
                name: true,
                status: true,
                // Don't select category - may not exist yet
            },
        });
        // Case-insensitive check for Admin role
        const isAdmin = role?.name?.toLowerCase() === 'admin';
        if (!role || !isAdmin) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.default.error('Error checking admin status:', error);
        res.status(500).json({ error: 'Error checking admin status' });
    }
};
exports.requireAdmin = requireAdmin;
/**
 * Legacy checkPermission - DEPRECATED
 * Use requirePermission from rbac.ts instead
 * This is kept for backward compatibility but should be migrated
 */
const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            // Use explicit select to avoid querying category column if it doesn't exist
            const role = await client_1.default.role.findUnique({
                where: { id: req.user.roleId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    permissions: true,
                    // Don't select category - may not exist yet
                    rolePermissions: {
                        where: {
                            granted: true,
                        },
                    },
                },
            });
            if (!role) {
                res.status(403).json({ error: 'Role not found' });
                return;
            }
            // Get legacy permissions for compatibility
            let legacyPermissions = [];
            if (role.permissions) {
                if (Array.isArray(role.permissions)) {
                    legacyPermissions = role.permissions;
                }
                else if (typeof role.permissions === 'string') {
                    legacyPermissions = [role.permissions];
                }
            }
            // Resolve to explicit permissions (with auto-conversion)
            const explicitPermissions = await (0, compatibility_resolver_1.resolveRolePermissions)(role.id, legacyPermissions);
            // Check if permission is in explicit list
            const hasPermission = explicitPermissions.includes(requiredPermission);
            if (!hasPermission) {
                res.status(403).json({ error: 'Insufficient permissions' });
                return;
            }
            next();
        }
        catch (error) {
            logger_1.default.error('Error checking permissions:', error);
            res.status(500).json({ error: 'Error checking permissions' });
        }
    };
};
exports.checkPermission = checkPermission;
//# sourceMappingURL=auth.js.map