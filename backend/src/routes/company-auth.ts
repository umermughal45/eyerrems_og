import express, { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { generateCsrfToken } from '../middleware/csrf';
import { authenticateCompanyUser, CompanyAuthRequest } from '../middleware/company-auth';
import crypto from 'crypto';
import { extractDeviceInfo } from '../utils/deviceInfo';

const router = (express as any).Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/company-auth/login
 * Authenticates a CompanyUser and returns a signed JWT.
 * The JWT payload includes: companyUserId, companyId, role, isSuperAdmin
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const companyUser = await prisma.companyUser.findUnique({
      where: { email },
      include: {
        company: {
          select: { id: true, companyName: true, companyCode: true, status: true },
        },
      },
    });

    if (!companyUser) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check active status
    if (!companyUser.isActive) {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    // Check company status (suspended companies cannot log in)
    if (!companyUser.isSuperAdmin && companyUser.company.status !== 'active') {
      return res.status(403).json({
        error: 'Company account is suspended. Please contact support.',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, companyUser.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign JWT
    const jwtSecret = process.env.JWT_SECRET || 'CHANGE-THIS-IN-PRODUCTION-DEVELOPMENT-ONLY';
    const token = jwt.sign(
      {
        companyUserId: companyUser.id,
        companyId: companyUser.companyId,
        role: companyUser.role,
        isSuperAdmin: companyUser.isSuperAdmin,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    // Update last login timestamp
    await prisma.companyUser.update({
      where: { id: companyUser.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`Company user logged in: ${companyUser.email} (company: ${companyUser.company.companyCode})`);

    // Generate CSRF token
    const deviceInfo = extractDeviceInfo(req);
    const sessionId = crypto.randomBytes(16).toString('hex');
    const csrfToken = await generateCsrfToken(sessionId, deviceInfo.deviceId, companyUser.id);

    return res.json({
      token,
      csrfToken,
      sessionId,
      user: {
        id: companyUser.id,
        name: companyUser.name,
        email: companyUser.email,
        role: companyUser.role,
        isSuperAdmin: companyUser.isSuperAdmin,
        companyId: companyUser.companyId,
        company: {
          id: companyUser.company.id,
          companyName: companyUser.company.companyName,
          companyCode: companyUser.company.companyCode,
          status: companyUser.company.status,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Company login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * GET /api/company-auth/me
 * Returns the current logged-in company user's details.
 */
router.get('/me', authenticateCompanyUser, async (req: CompanyAuthRequest, res: Response) => {
  try {
    const companyUser = await prisma.companyUser.findUnique({
      where: { id: req.companyUser!.id },
      include: {
        company: {
          include: { settings: true },
        },
      },
    });

    if (!companyUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: companyUser.id,
      name: companyUser.name,
      email: companyUser.email,
      role: companyUser.role,
      isSuperAdmin: companyUser.isSuperAdmin,
      companyId: companyUser.companyId,
      company: {
        id: companyUser.company.id,
        companyName: companyUser.company.companyName,
        companyCode: companyUser.company.companyCode,
        companyEmail: companyUser.company.companyEmail,
        companyPhone: companyUser.company.companyPhone,
        companyAddress: companyUser.company.companyAddress,
        status: companyUser.company.status,
        settings: companyUser.company.settings,
      },
    });
  } catch (error) {
    logger.error('Company /me error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
