"use strict";
/**
 * JWT Refresh Token Utilities
 * Implements secure refresh token mechanism with database storage
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRefreshToken = generateRefreshToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.revokeRefreshToken = revokeRefreshToken;
exports.revokeAllUserRefreshTokens = revokeAllUserRefreshTokens;
exports.cleanupExpiredRefreshTokens = cleanupExpiredRefreshTokens;
exports.generateTokenPair = generateTokenPair;
const crypto_1 = __importDefault(require("crypto"));
const client_1 = __importDefault(require("../prisma/client"));
const logger_1 = __importDefault(require("./logger"));
const jwt_1 = require("./jwt");
const env_validation_1 = require("./env-validation");
/**
 * Generate refresh token
 */
async function generateRefreshToken(userId, deviceId) {
    try {
        const token = crypto_1.default.randomBytes(64).toString('hex');
        const env = (0, env_validation_1.getEnv)();
        const expiresIn = env.JWT_REFRESH_EXPIRES_IN || '7d';
        // Parse expires in (e.g., "7d" = 7 days)
        const expiresInMs = parseExpiresIn(expiresIn);
        const expiresAt = new Date(Date.now() + expiresInMs);
        await client_1.default.refreshToken.create({
            data: {
                userId,
                token,
                deviceId: deviceId || null,
                expiresAt,
            },
        });
        logger_1.default.info(`Refresh token generated for user ${userId}`);
        return token;
    }
    catch (error) {
        logger_1.default.error('Failed to generate refresh token:', error);
        throw new Error('Failed to generate refresh token');
    }
}
/**
 * Verify refresh token
 */
async function verifyRefreshToken(token) {
    try {
        const refreshToken = await client_1.default.refreshToken.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!refreshToken) {
            return { valid: false, error: 'Refresh token not found' };
        }
        // Check if token is revoked
        if (refreshToken.revoked) {
            return { valid: false, error: 'Refresh token has been revoked' };
        }
        // Check expiration
        if (refreshToken.expiresAt < new Date()) {
            // Mark as revoked
            await client_1.default.refreshToken.update({
                where: { id: refreshToken.id },
                data: { revoked: true, revokedAt: new Date() },
            });
            return { valid: false, error: 'Refresh token expired' };
        }
        // Verify user still exists
        if (!refreshToken.user) {
            return { valid: false, error: 'User not found' };
        }
        return {
            valid: true,
            userId: refreshToken.userId,
            deviceId: refreshToken.deviceId || undefined,
        };
    }
    catch (error) {
        logger_1.default.error('Failed to verify refresh token:', error);
        return { valid: false, error: 'Failed to verify refresh token' };
    }
}
/**
 * Revoke refresh token
 */
async function revokeRefreshToken(token) {
    try {
        await client_1.default.refreshToken.update({
            where: { token },
            data: {
                revoked: true,
                revokedAt: new Date(),
            },
        });
        logger_1.default.info(`Refresh token revoked: ${token.substring(0, 8)}...`);
        return true;
    }
    catch (error) {
        logger_1.default.error('Failed to revoke refresh token:', error);
        return false;
    }
}
/**
 * Revoke all refresh tokens for a user
 */
async function revokeAllUserRefreshTokens(userId, deviceId) {
    try {
        const where = { userId, revoked: false };
        if (deviceId) {
            where.deviceId = deviceId;
        }
        const result = await client_1.default.refreshToken.updateMany({
            where,
            data: {
                revoked: true,
                revokedAt: new Date(),
            },
        });
        logger_1.default.info(`Revoked ${result.count} refresh tokens for user ${userId}`);
        return result.count;
    }
    catch (error) {
        logger_1.default.error('Failed to revoke user refresh tokens:', error);
        return 0;
    }
}
/**
 * Clean up expired refresh tokens
 */
async function cleanupExpiredRefreshTokens() {
    try {
        const result = await client_1.default.refreshToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { revoked: true, revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Delete revoked tokens older than 30 days
                ],
            },
        });
        logger_1.default.debug(`Cleaned up ${result.count} expired/revoked refresh tokens`);
        return result.count;
    }
    catch (error) {
        logger_1.default.error('Failed to cleanup expired refresh tokens:', error);
        return 0;
    }
}
/**
 * Generate new access and refresh token pair
 */
async function generateTokenPair(payload) {
    const accessToken = (0, jwt_1.generateToken)(payload);
    const refreshToken = await generateRefreshToken(payload.userId, payload.deviceId);
    return { accessToken, refreshToken };
}
/**
 * Parse expires in string to milliseconds
 */
function parseExpiresIn(expiresIn) {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
        return 7 * 24 * 60 * 60 * 1000; // Default: 7 days
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] || multipliers.d);
}
//# sourceMappingURL=refresh-token.js.map