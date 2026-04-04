import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import logger from '../utils/logger';

export interface CompanyAuthRequest extends Request {
  companyUser?: {
    id: string;
    companyId: string;
    role: string;
    isSuperAdmin: boolean;
    name: string;
    email: string;
  };
  // Support multer uploads
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Middleware: Verify company JWT and populate req.companyUser
 * Used for company-specific protected routes.
 */
export const authenticateCompanyUser = async (
  req: CompanyAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader?.replace('Bearer ', '') || authHeader?.replace('bearer ', '');

    // Allow token via query parameter (for file downloads)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No authorization token provided.',
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';

    let decoded: {
      userId: string;
      companyId: string;
      role: string;
      isSuperAdmin: boolean;
    };

    try {
      decoded = jwt.verify(token, jwtSecret) as {
        userId: string;
        companyId: string;
        role: string;
        isSuperAdmin: boolean;
      };
    } catch (jwtError: any) {
      logger.warn('Company JWT verification failed', {
        path: req.path,
        method: req.method,
        error: jwtError?.message,
      });
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Ensure this is a company-specific token (has companyId)
    if (!decoded.companyId) {
      res.status(401).json({ error: 'Invalid token type. Only company-associated accounts allowed.' });
      return;
    }

    // Verify user still exists and is active
    const companyUser = await prisma.companyUser.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        role: true,
        isSuperAdmin: true,
        isActive: true,
        company: { select: { status: true } },
      },
    });

    if (!companyUser) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (!companyUser.isActive) {
      res.status(403).json({ error: 'Your account has been deactivated.' });
      return;
    }

    if (companyUser.company.status !== 'active') {
      res.status(403).json({
        error: 'Company account is suspended. Please contact support.',
      });
      return;
    }

    req.companyUser = {
      id: companyUser.id,
      companyId: companyUser.companyId,
      role: companyUser.role,
      isSuperAdmin: companyUser.isSuperAdmin,
      name: companyUser.name,
      email: companyUser.email,
    };

    next();
  } catch (error: any) {
    logger.error('Company authentication error:', error?.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware: Require super admin access.
 * Must be used AFTER authenticateCompanyUser.
 */
export const requireSuperAdmin = async (
  req: CompanyAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // First authenticate
  await authenticateCompanyUser(req, res, async () => {
    if (!req.companyUser?.isSuperAdmin) {
      res.status(403).json({
        error: 'Super admin access required',
        message: 'This action is restricted to the software owner.',
      });
      return;
    }
    next();
  });
};
