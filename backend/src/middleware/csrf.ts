/**
 * CSRF Protection Middleware
 * Implements CSRF token validation for all state-changing routes (POST, PUT, DELETE, PATCH)
 * Uses database storage for CSRF tokens (can be switched to Redis)
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { getEnv } from '../utils/env-validation';

// Methods that require CSRF protection
const PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Methods that are safe and don't need CSRF protection
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

interface CsrfRequest extends Request {
   csrfToken?: string;
 }

/**
 * Generate a new CSRF token
 */
export async function generateCsrfToken(
  sessionId: string,
  deviceId?: string,
  userId?: string
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
    await prisma.csrfToken.create({
      data: {
        token,
        sessionId,
        deviceId: deviceId || null,
        userId: userId || null,
        expiresAt,
      },
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate CSRF token:', error);
    throw new Error('Failed to generate CSRF token');
  }
}

/**
 * Verify CSRF token
 */
async function verifyCsrfToken(
  token: string,
  sessionId: string,
  deviceId?: string
): Promise<boolean> {
  try {
    const csrfToken = await prisma.csrfToken.findUnique({
      where: { token },
    });

    if (!csrfToken) {
      return false;
    }

    // Check expiration
    if (csrfToken.expiresAt < new Date()) {
      // Clean up expired token
      await prisma.csrfToken.delete({ where: { id: csrfToken.id } }).catch(() => {});
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
  } catch (error) {
    logger.error('Failed to verify CSRF token:', error);
    return false;
  }
}

/**
 * Clean up expired CSRF tokens (run periodically)
 */
export async function cleanupExpiredCsrfTokens(): Promise<void> {
  try {
    const result = await prisma.csrfToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    logger.debug(`Cleaned up ${result.count} expired CSRF tokens`);
  } catch (error) {
    logger.error('Failed to cleanup expired CSRF tokens:', error);
  }
}

/**
 * CSRF Protection Middleware
 * Validates CSRF token for state-changing requests
 */
export const csrfProtection = async (
  req: CsrfRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip CSRF protection for safe methods
  if (req.method && SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Skip CSRF protection for unprotected routes (e.g., health checks)
  const unprotectedPaths = ['/api/health', '/api/auth/login', '/api/auth/role-login', '/api/auth/invite-login'];
  if (req.path && unprotectedPaths.some((path) => req.path!.startsWith(path))) {
    return next();
  }

  try {
    // Get session ID from header or cookie (case-insensitive header check)
    const sessionId = 
      (req.headers['x-session-id'] as string) || 
      (req.headers['X-Session-Id'] as string) ||
      req.cookies?.sessionId;
    const deviceId = 
      (req.headers['x-device-id'] as string) || 
      (req.headers['X-Device-Id'] as string);
    const csrfToken = 
      (req.headers['x-csrf-token'] as string) || 
      (req.headers['X-CSRF-Token'] as string);

    logger.info('CSRF protection check', {
      method: req.method,
      path: req.path,
      hasSessionId: !!sessionId,
      hasCsrfToken: !!csrfToken,
      hasDeviceId: !!deviceId,
    });

    if (!sessionId) {
      logger.warn('CSRF protection failed: No session ID', {
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
      logger.warn('CSRF protection failed: No CSRF token', {
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
      logger.warn('CSRF protection failed: Invalid token', {
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

    logger.info('CSRF protection passed', {
      method: req.method,
      path: req.path,
    });

    // Attach token to request for potential reuse
    req.csrfToken = csrfToken;
    next();
  } catch (error) {
    logger.error('CSRF protection error:', error);
    res.status(500).json({
      error: 'CSRF protection: Internal error',
      message: 'Failed to verify CSRF token',
    });
  }
};

/**
 * Middleware to generate and attach CSRF token to response
 * Should be used on routes that need to return a CSRF token to the client
 */
export const attachCsrfToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sessionId = req.headers['x-session-id'] as string || req.cookies?.sessionId || crypto.randomBytes(16).toString('hex');
    const deviceId = req.headers['x-device-id'] as string;
    const userId = (req as any).user?.id;

    const token = await generateCsrfToken(sessionId, deviceId, userId);

    // Attach token to response header
    res.setHeader('X-CSRF-Token', token);
    res.setHeader('X-Session-Id', sessionId);

    // Also attach to response body if it's a JSON response
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (typeof body === 'object' && body !== null) {
        body.csrfToken = token;
        body.sessionId = sessionId;
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.error('Failed to attach CSRF token:', error);
    next(); // Don't block request if token generation fails
  }
};

