import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { resolveRolePermissions } from '../services/permissions/compatibility-resolver';

export interface AuthRequest extends Request {
   user?: {
     id: string;
     username: string;
     email: string;
     roleId: string;
   };
   // Support multer uploads
   file?: Express.Multer.File;
   files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
 }

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');
    const requestDeviceId = req.headers['x-device-id'] as string;

    // Allow token via query parameter (for images/downloads)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      logger.warn('Authentication failed: No token provided', {
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
        logger.error('JWT_SECRET not set in production');
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }
      logger.warn('⚠️  WARNING: JWT_SECRET not set. Using default for development only.');
    }

    let decoded: {
      userId: string;
      username: string;
      email: string;
      roleId: string;
      deviceId?: string;
    };

    try {
      decoded = jwt.verify(token, jwtSecret || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY') as {
        userId: string;
        username: string;
        email: string;
        roleId: string;
        deviceId?: string;
      };
    } catch (jwtError: any) {
      logger.warn('JWT verification failed', {
        path: req.path,
        method: req.method,
        error: jwtError?.message || 'Unknown JWT error',
        name: jwtError?.name,
      });
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Verify user still exists
    let user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, email: true, roleId: true, deviceApprovalStatus: true },
    });

    let isCompanyUser = false;
    let companyUserObj: any = null;

    if (!user) {
      // Try finding in CompanyUser table
      companyUserObj = await prisma.companyUser.findUnique({
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
      logger.warn('Authentication failed: User not found', {
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
        logger.warn('Device ID mismatch', {
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
    } else {
      // Populate req.user from companyUser data for compatibility
      req.user = {
        id: companyUserObj.id,
        username: companyUserObj.email, // Use email as username for company users
        email: companyUserObj.email,
        roleId: companyUserObj.role, // Use role string as roleId string
      };
    }

    next();
  } catch (error: any) {
    logger.error('Authentication error:', {
      error: error?.message || 'Unknown error',
      stack: error?.stack,
      name: error?.name,
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Use explicit select to avoid querying category column if it doesn't exist
    const role = await prisma.role.findUnique({
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
  } catch (error) {
    logger.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Error checking admin status' });
  }
};

/**
 * Legacy checkPermission - DEPRECATED
 * Use requirePermission from rbac.ts instead
 * This is kept for backward compatibility but should be migrated
 */
export const checkPermission = (requiredPermission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Use explicit select to avoid querying category column if it doesn't exist
      const role = await prisma.role.findUnique({
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
      let legacyPermissions: string[] = [];
      if (role.permissions) {
        if (Array.isArray(role.permissions)) {
          legacyPermissions = role.permissions as string[];
        } else if (typeof role.permissions === 'string') {
          legacyPermissions = [role.permissions];
        }
      }
      
      // Resolve to explicit permissions (with auto-conversion)
      const explicitPermissions = await resolveRolePermissions(role.id, legacyPermissions);
      
      // Check if permission is in explicit list
      const hasPermission = explicitPermissions.includes(requiredPermission);
      
      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    } catch (error: any) {
      logger.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Error checking permissions' });
    }
  };
};

