import express, { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import logger from '../utils/logger';
import { requireSuperAdmin, authenticateCompanyUser, CompanyAuthRequest } from '../middleware/company-auth';

const router = (express as any).Router();

// ─── Validation Schemas ─────────────────────────────────────────────────────

const createCompanySchema = z.object({
  // Company fields
  companyName: z.string().min(1, 'Company name is required'),
  companyCode: z.string().min(2, 'Company code must be at least 2 characters')
    .max(20, 'Company code must be at most 20 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Company code may only contain letters, numbers, - and _'),
  companyEmail: z.string().email('Company email is required'),
  companyPassword: z.string().min(6, 'Company password must be at least 6 characters'),
  companyPhone: z.string().optional(),
  companyAddress: z.string().optional(),
  status: z.enum(['active', 'suspended']).default('active'),

  // Company settings
  currencyCode: z.string().default('PKR'),
  currencySymbol: z.string().default('Rs'),
  timezone: z.string().default('Asia/Karachi'),
  invoicePrefix: z.string().default('INV'),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /api/companies
 * Create a new company with settings and initial owner user.
 * SUPER ADMIN ONLY.
 */
router.post('/', requireSuperAdmin, async (req: CompanyAuthRequest, res: Response) => {
  try {
    const data = createCompanySchema.parse(req.body);

    // Check duplicate company code
    const existingCode = await prisma.company.findUnique({
      where: { companyCode: data.companyCode },
    });
    if (existingCode) {
      return res.status(409).json({ error: 'Company code already exists' });
    }

    // Check duplicate admin email in company users
    const existingEmail = await prisma.companyUser.findUnique({
      where: { email: data.companyEmail },
    });
    if (existingEmail) {
      return res.status(409).json({ error: 'A user with that company email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.companyPassword, 12);

    // Create company + settings + user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          companyName: data.companyName,
          companyCode: data.companyCode.toUpperCase(),
          companyEmail: data.companyEmail,
          companyPhone: data.companyPhone || null,
          companyAddress: data.companyAddress || null,
          status: data.status,
          createdBy: req.companyUser!.id,
        },
      });

      const settings = await tx.companySettings.create({
        data: {
          companyId: company.id,
          currencyCode: data.currencyCode,
          currencySymbol: data.currencySymbol,
          timezone: data.timezone,
          invoicePrefix: data.invoicePrefix,
        },
      });

      const user = await tx.companyUser.create({
        data: {
          companyId: company.id,
          name: `${data.companyName} Admin`,
          email: data.companyEmail,
          passwordHash,
          role: 'owner',
          isSuperAdmin: false,
          isActive: true,
        },
      });

      return { company, settings, user };
    });

    logger.info(`Company created: ${result.company.companyCode} by ${req.companyUser!.email}`);

    return res.status(201).json({
      success: true,
      company: {
        id: result.company.id,
        companyName: result.company.companyName,
        companyCode: result.company.companyCode,
        companyEmail: result.company.companyEmail,
        companyPhone: result.company.companyPhone,
        companyAddress: result.company.companyAddress,
        status: result.company.status,
        createdAt: result.company.createdAt,
        settings: result.settings,
        // Return initial user without password hash
        initialUser: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Create company error:', error);
    return res.status(500).json({ error: 'Failed to create company' });
  }
});

/**
 * GET /api/companies
 * List all companies with settings.
 * SUPER ADMIN ONLY.
 */
router.get('/', requireSuperAdmin, async (req: CompanyAuthRequest, res: Response) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        settings: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ companies });
  } catch (error) {
    logger.error('List companies error:', error);
    return res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

/**
 * GET /api/companies/:id
 * Get single company details.
 * SUPER ADMIN ONLY.
 */
router.get('/:id', requireSuperAdmin, async (req: CompanyAuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.params.id },
      include: {
        settings: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.json({ company });
  } catch (error) {
    logger.error('Get company error:', error);
    return res.status(500).json({ error: 'Failed to fetch company' });
  }
});

/**
 * PATCH /api/companies/:id/status
 * Activate or suspend a company.
 * SUPER ADMIN ONLY.
 */
router.patch('/:id/status', requireSuperAdmin, async (req: CompanyAuthRequest, res: Response) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);

    const company = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const updated = await prisma.company.update({
      where: { id: req.params.id },
      data: { status },
    });

    logger.info(`Company ${updated.companyCode} status changed to ${status} by ${req.companyUser!.email}`);

    return res.json({ success: true, company: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Update company status error:', error);
    return res.status(500).json({ error: 'Failed to update company status' });
  }
});

/**
 * GET /api/companies/my/profile
 * Get the current company profile (accessible to any authenticated company user).
 */
router.get('/my/profile', authenticateCompanyUser, async (req: CompanyAuthRequest, res: Response) => {
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.companyUser!.companyId },
      include: { settings: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    return res.json({ company });
  } catch (error) {
    logger.error('Get my company error:', error);
    return res.status(500).json({ error: 'Failed to fetch company profile' });
  }
});

export default router;
