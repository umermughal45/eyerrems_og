/**
 * JWT Refresh Token Utilities
 * Implements secure refresh token mechanism with database storage
 */

import crypto from 'crypto';
import prisma from '../prisma/client';
import logger from './logger';
import { generateToken, verifyToken, TokenPayload } from './jwt';
import { getEnv } from './env-validation';

/**
 * Generate refresh token
 */
export async function generateRefreshToken(
  userId: string,
  deviceId?: string
): Promise<string> {
  try {
    const token = crypto.randomBytes(64).toString('hex');
    const env = getEnv();
    const expiresIn = env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    // Parse expires in (e.g., "7d" = 7 days)
    const expiresInMs = parseExpiresIn(expiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    await prisma.refreshToken.create({
      data: {
        userId,
        token,
        deviceId: deviceId || null,
        expiresAt,
      },
    });

    logger.info(`Refresh token generated for user ${userId}`);
    return token;
  } catch (error) {
    logger.error('Failed to generate refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  deviceId?: string;
  error?: string;
}> {
  try {
    const refreshToken = await prisma.refreshToken.findUnique({
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
      await prisma.refreshToken.update({
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
  } catch (error) {
    logger.error('Failed to verify refresh token:', error);
    return { valid: false, error: 'Failed to verify refresh token' };
  }
}

/**
 * Revoke refresh token
 */
export async function revokeRefreshToken(token: string): Promise<boolean> {
  try {
    await prisma.refreshToken.update({
      where: { token },
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    logger.info(`Refresh token revoked: ${token.substring(0, 8)}...`);
    return true;
  } catch (error) {
    logger.error('Failed to revoke refresh token:', error);
    return false;
  }
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(userId: string, deviceId?: string): Promise<number> {
  try {
    const where: any = { userId, revoked: false };
    if (deviceId) {
      where.deviceId = deviceId;
    }

    const result = await prisma.refreshToken.updateMany({
      where,
      data: {
        revoked: true,
        revokedAt: new Date(),
      },
    });

    logger.info(`Revoked ${result.count} refresh tokens for user ${userId}`);
    return result.count;
  } catch (error) {
    logger.error('Failed to revoke user refresh tokens:', error);
    return 0;
  }
}

/**
 * Clean up expired refresh tokens
 */
export async function cleanupExpiredRefreshTokens(): Promise<number> {
  try {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revoked: true, revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Delete revoked tokens older than 30 days
        ],
      },
    });

    logger.debug(`Cleaned up ${result.count} expired/revoked refresh tokens`);
    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup expired refresh tokens:', error);
    return 0;
  }
}

/**
 * Generate new access and refresh token pair
 */
export async function generateTokenPair(
  payload: TokenPayload
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = generateToken(payload);
  const refreshToken = await generateRefreshToken(payload.userId, payload.deviceId);

  return { accessToken, refreshToken };
}

/**
 * Parse expires in string to milliseconds
 */
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // Default: 7 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || multipliers.d);
}

