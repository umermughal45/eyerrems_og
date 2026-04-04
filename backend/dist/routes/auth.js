"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const client_1 = __importDefault(require("../prisma/client"));
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const deviceInfo_1 = require("../utils/deviceInfo");
const auth_1 = require("../middleware/auth");
const refresh_token_1 = require("../utils/refresh-token");
const csrf_1 = require("../middleware/csrf");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
// Validation schemas
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    deviceId: zod_1.z.string().optional(),
});
const roleLoginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, 'Username is required'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    deviceId: zod_1.z.string().optional(),
});
const inviteLoginSchema = zod_1.z.object({
    token: zod_1.z.string(),
    password: zod_1.z.string().min(6),
    username: zod_1.z.string().optional(),
    deviceId: zod_1.z.string().optional(),
});
// Test route to verify auth routes are working
router.get('/login', (_req, res) => {
    res.json({
        message: 'Auth route is working. Use POST method to login.',
        endpoint: '/api/auth/login',
        method: 'POST',
        requiredFields: ['email', 'password']
    });
});
// Admin login
router.post('/login', async (req, res) => {
    try {
        const { email, password, deviceId: clientDeviceId } = loginSchema.parse(req.body);
        // 1. Try to find internal User (Admin/Staff)
        const user = await client_1.default.user.findUnique({
            where: { email },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                    },
                },
            },
        });
        if (user) {
            // Check if user is Admin
            if (user.role.name !== 'Admin' && user.role.name !== 'admin') {
                return res.status(403).json({ error: 'Only Admin can login directly' });
            }
            // Verify password
            const isValid = await (0, password_1.comparePassword)(password, user.password);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const deviceInfo = (0, deviceInfo_1.extractDeviceInfo)(req);
            const finalDeviceId = clientDeviceId || deviceInfo.deviceId;
            const { accessToken, refreshToken } = await (0, refresh_token_1.generateTokenPair)({
                userId: user.id,
                username: user.username,
                email: user.email,
                roleId: user.roleId,
                deviceId: finalDeviceId,
            });
            const sessionId = crypto_1.default.randomBytes(16).toString('hex');
            const csrfToken = await (0, csrf_1.generateCsrfToken)(sessionId, finalDeviceId, user.id);
            return res.json({
                token: accessToken,
                refreshToken,
                csrfToken,
                sessionId,
                deviceId: finalDeviceId,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role.name,
                    roleId: user.roleId,
                    permissions: user.role.permissions || [],
                    isSuperAdmin: true, // Internal admins are treated as super admins for UI purposes
                },
            });
        }
        // 2. Try to find CompanyUser
        const companyUser = await client_1.default.companyUser.findUnique({
            where: { email },
            include: {
                company: {
                    select: {
                        id: true,
                        companyName: true,
                        companyCode: true,
                        status: true,
                        settings: {
                            select: {
                                logo: true,
                                currencyCode: true,
                                currencySymbol: true,
                            }
                        }
                    }
                }
            }
        });
        if (companyUser) {
            // Verify password
            const isValid = await (0, password_1.comparePassword)(password, companyUser.passwordHash);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            // Check isActive
            if (!companyUser.isActive) {
                return res.status(403).json({ error: 'User account is inactive' });
            }
            // Check company status
            if (companyUser.company.status !== 'active') {
                return res.status(403).json({ error: 'Company account is ' + companyUser.company.status });
            }
            const deviceInfo = (0, deviceInfo_1.extractDeviceInfo)(req);
            const finalDeviceId = clientDeviceId || deviceInfo.deviceId;
            // Generate a long-lived access token (since we don't have RefreshToken for CompanyUser yet)
            // We use a custom payload that includes company info
            const tokenPayload = {
                userId: companyUser.id,
                username: companyUser.email,
                email: companyUser.email,
                roleId: companyUser.role, // Use role string as roleId for now
                deviceId: finalDeviceId,
                companyId: companyUser.companyId,
                isSuperAdmin: companyUser.isSuperAdmin,
            };
            // Create a specific expiry for company users if needed, 
            // but generateToken uses JWT_EXPIRES_IN (usually 15m).
            // For now, let's just use generateToken.
            const accessToken = (0, jwt_1.generateToken)(tokenPayload);
            const sessionId = crypto_1.default.randomBytes(16).toString('hex');
            const csrfToken = await (0, csrf_1.generateCsrfToken)(sessionId, finalDeviceId, companyUser.id);
            // Update last login
            await client_1.default.companyUser.update({
                where: { id: companyUser.id },
                data: { lastLoginAt: new Date() },
            });
            return res.json({
                token: accessToken,
                refreshToken: null, // No refresh token for company users in this phase
                csrfToken,
                sessionId,
                deviceId: finalDeviceId,
                user: {
                    id: companyUser.id,
                    name: companyUser.name,
                    email: companyUser.email,
                    role: companyUser.role,
                    companyId: companyUser.companyId,
                    isSuperAdmin: companyUser.isSuperAdmin,
                    company: companyUser.company,
                },
            });
        }
        // Neither found
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        // Log full error details for debugging
        logger_1.default.error('Login error:', {
            error,
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : 'Unknown',
        });
        // Provide more detailed error information
        const errorMessage = error instanceof Error ? error.message : 'Login failed';
        const errorDetails = process.env.NODE_ENV === 'development'
            ? {
                message: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : 'Unknown',
            }
            : { message: 'Login failed. Please check your credentials and try again.' };
        // Always include error message in response for debugging
        const response = {
            error: 'Login failed',
            message: errorMessage,
        };
        // Include details in development
        if (process.env.NODE_ENV === 'development') {
            response.details = errorDetails;
            response.stack = error instanceof Error ? error.stack : undefined;
        }
        res.status(500).json(response);
    }
});
// Role login (username-based login for non-admin roles)
router.post('/role-login', async (req, res) => {
    try {
        const { username, password, deviceId: clientDeviceId } = roleLoginSchema.parse(req.body);
        // Find user by username
        // Use explicit select to avoid querying category column if it doesn't exist
        const user = await client_1.default.user.findUnique({
            where: { username },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                        // Don't select category - may not exist yet
                    },
                },
            },
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Check if user is Admin - Admin should use regular login
        if (user.role.name === 'Admin' || user.role.name === 'admin') {
            return res.status(403).json({ error: 'Admin users must use the admin login page' });
        }
        // Verify password
        const isValid = await (0, password_1.comparePassword)(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Extract device info and use client deviceId if provided
        const deviceInfo = (0, deviceInfo_1.extractDeviceInfo)(req);
        const finalDeviceId = clientDeviceId || deviceInfo.deviceId;
        // Generate access and refresh token pair
        const { accessToken, refreshToken } = await (0, refresh_token_1.generateTokenPair)({
            userId: user.id,
            username: user.username,
            email: user.email,
            roleId: user.roleId,
            deviceId: finalDeviceId,
        });
        // Generate CSRF token
        const sessionId = crypto_1.default.randomBytes(16).toString('hex');
        const csrfToken = await (0, csrf_1.generateCsrfToken)(sessionId, finalDeviceId, user.id);
        // Create login notification for all admin users
        const adminUsers = await client_1.default.user.findMany({
            where: {
                role: {
                    name: 'Admin',
                },
                id: {
                    not: user.id,
                },
            },
        });
        // Get current date and time
        const loginTime = new Date();
        const formattedTime = loginTime.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        // Create notifications for all admins about role login
        await Promise.all(adminUsers.map((admin) => client_1.default.notification.create({
            data: {
                userId: admin.id,
                title: 'Role User Login',
                message: `${user.role.name} user "${user.username}" logged in at ${formattedTime}`,
                type: 'info',
            },
        })));
        return res.json({
            token: accessToken,
            refreshToken,
            csrfToken,
            sessionId,
            deviceId: finalDeviceId,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role.name,
                roleId: user.roleId,
                permissions: user.role.permissions || [], // Include permissions, default to empty array if null
            },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger_1.default.warn('Validation error:', error.errors);
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors,
                message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            });
        }
        logger_1.default.error('Role login error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Role login failed';
        const errorDetails = process.env.NODE_ENV === 'development'
            ? { message: errorMessage, stack: error instanceof Error ? error.stack : undefined }
            : { message: 'Role login failed. Please check your credentials and try again.' };
        res.status(500).json({
            error: 'Role login failed',
            details: errorDetails
        });
    }
});
// Invite link login
router.post('/invite-login', async (req, res) => {
    try {
        const { token, password, username: providedUsername, deviceId: clientDeviceId } = inviteLoginSchema.parse(req.body);
        // Find invite link
        // Use explicit select to avoid querying category column if it doesn't exist
        const inviteLink = await client_1.default.roleInviteLink.findUnique({
            where: { token },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                        // Don't select category - may not exist yet
                    },
                },
            },
        });
        if (!inviteLink) {
            return res.status(404).json({ error: 'Invalid invite link' });
        }
        if (inviteLink.status !== 'pending') {
            return res.status(400).json({ error: 'Invite link already used or expired' });
        }
        // Check expiration
        if (inviteLink.expiresAt) {
            const expiresAt = new Date(inviteLink.expiresAt);
            if (expiresAt < new Date()) {
                await client_1.default.roleInviteLink.update({
                    where: { id: inviteLink.id },
                    data: { status: 'expired' },
                });
                return res.status(400).json({ error: 'Invite link expired' });
            }
        }
        // Verify username if provided
        if (providedUsername && providedUsername !== inviteLink.username) {
            return res.status(401).json({ error: 'Invalid username' });
        }
        // Verify password
        const isValid = await (0, password_1.comparePassword)(password, inviteLink.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        // Check if user already exists
        // Use explicit select to avoid querying category column if it doesn't exist
        let user = await client_1.default.user.findUnique({
            where: { email: inviteLink.email },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                        // Don't select category - may not exist yet
                    },
                },
            },
        });
        if (user) {
            // Update existing user
            user = await client_1.default.user.update({
                where: { id: user.id },
                data: {
                    password: inviteLink.password, // Already hashed
                    roleId: inviteLink.roleId,
                },
                include: {
                    role: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            permissions: true,
                            // Don't select category - may not exist yet
                        },
                    },
                },
            });
        }
        else {
            // Create new user
            user = await client_1.default.user.create({
                data: {
                    username: inviteLink.username,
                    email: inviteLink.email,
                    password: inviteLink.password, // Already hashed
                    roleId: inviteLink.roleId,
                },
                include: {
                    role: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            permissions: true,
                            // Don't select category - may not exist yet
                        },
                    },
                },
            });
        }
        // Mark invite link as used
        await client_1.default.roleInviteLink.update({
            where: { id: inviteLink.id },
            data: { status: 'used' },
        });
        // Extract device info and use client deviceId if provided
        const deviceInfo = (0, deviceInfo_1.extractDeviceInfo)(req);
        const finalDeviceId = clientDeviceId || deviceInfo.deviceId;
        // Generate access and refresh token pair
        const { accessToken, refreshToken } = await (0, refresh_token_1.generateTokenPair)({
            userId: user.id,
            username: user.username,
            email: user.email,
            roleId: user.roleId,
            deviceId: finalDeviceId,
        });
        // Generate CSRF token
        const sessionId = crypto_1.default.randomBytes(16).toString('hex');
        const csrfToken = await (0, csrf_1.generateCsrfToken)(sessionId, finalDeviceId, user.id);
        // Create login notification for all admin users (only for role-based users, not admin)
        if (user.role.name !== 'Admin' && user.role.name !== 'admin') {
            const adminUsers = await client_1.default.user.findMany({
                where: {
                    role: {
                        name: 'Admin',
                    },
                    id: {
                        not: user.id,
                    },
                },
            });
            // Get current date and time
            const loginTime = new Date();
            const formattedTime = loginTime.toLocaleString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
            // Create notifications for all admins about role login
            await Promise.all(adminUsers.map((admin) => client_1.default.notification.create({
                data: {
                    userId: admin.id,
                    title: 'Role User Login',
                    message: `${user.role.name} user "${user.username}" logged in at ${formattedTime}`,
                    type: 'info',
                },
            })));
        }
        return res.json({
            token: accessToken,
            refreshToken,
            csrfToken,
            sessionId,
            deviceId: finalDeviceId,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role.name,
                roleId: user.roleId,
                permissions: user.role.permissions || [], // Include permissions, default to empty array if null
            },
            message: inviteLink.message || `Welcome! Your role is ${user.role.name}`,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            logger_1.default.warn('Validation error:', error.errors);
            return res.status(400).json({
                error: 'Validation error',
                details: error.errors,
                message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            });
        }
        logger_1.default.error('Invite login error:', error);
        logger_1.default.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        const errorMessage = error instanceof Error ? error.message : 'Invite login failed';
        const errorDetails = process.env.NODE_ENV === 'development'
            ? { message: errorMessage, stack: error instanceof Error ? error.stack : undefined }
            : { message: 'Invite login failed. Please check your credentials and try again.' };
        res.status(500).json({
            error: 'Invite login failed',
            details: errorDetails
        });
    }
});
// Get current user
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const user = await client_1.default.user.findUnique({
            where: { id: req.user.id },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                        // Don't select category if column doesn't exist yet
                        // category: true,
                    },
                },
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role.name,
            roleId: user.roleId,
            permissions: user.role.permissions, // Include permissions
        });
    }
    catch (error) {
        logger_1.default.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
// Refresh token endpoint
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken: token } = zod_1.z.object({
            refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
        }).parse(req.body);
        const { verifyRefreshToken, generateTokenPair, revokeRefreshToken } = await Promise.resolve().then(() => __importStar(require('../utils/refresh-token')));
        const verification = await verifyRefreshToken(token);
        if (!verification.valid || !verification.userId) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        // Get user
        // Use explicit select to avoid querying category column if it doesn't exist
        const user = await client_1.default.user.findUnique({
            where: { id: verification.userId },
            include: {
                role: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        permissions: true,
                        // Don't select category - may not exist yet
                    },
                },
            },
        });
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        // Revoke old refresh token
        await revokeRefreshToken(token);
        // Generate new token pair
        const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair({
            userId: user.id,
            username: user.username,
            email: user.email,
            roleId: user.roleId,
            deviceId: verification.deviceId,
        });
        // Generate new CSRF token
        const sessionId = crypto_1.default.randomBytes(16).toString('hex');
        const csrfToken = await (0, csrf_1.generateCsrfToken)(sessionId, verification.deviceId, user.id);
        return res.json({
            token: accessToken,
            refreshToken: newRefreshToken,
            csrfToken,
            sessionId,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger_1.default.error('Refresh token error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});
// Logout endpoint (revoke refresh token)
router.post('/logout', auth_1.authenticate, async (req, res) => {
    try {
        const { refreshToken } = zod_1.z.object({
            refreshToken: zod_1.z.string().optional(),
        }).parse(req.body);
        if (refreshToken) {
            const { revokeRefreshToken } = await Promise.resolve().then(() => __importStar(require('../utils/refresh-token')));
            await revokeRefreshToken(refreshToken);
        }
        else {
            // Revoke all refresh tokens for user
            await (0, refresh_token_1.revokeAllUserRefreshTokens)(req.user.id);
        }
        return res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        logger_1.default.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map