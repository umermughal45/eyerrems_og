
import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { FraudDetectionService } from '../services/fraud-detection-service';
import { successResponse } from '../utils/error-handler';
import logger from '../utils/logger';
import prisma from '../prisma/client';

const router = (express as any).Router();

/**
 * GET /api/fraud-detection/red-flags
 * Generate Red Flags Report
 */
router.get('/red-flags', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Check if user has permission (Admin or Finance Manager)
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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

    if (!user || !user.role || (user.role.name !== 'Admin' && user.role.name !== 'Finance Manager')) {
       // Allow if they have specific permission 'finance.reports.view'
       const hasPermission = user?.role?.permissions && Array.isArray(user.role.permissions) 
        ? (user.role.permissions as string[]).includes('finance.reports.view') || (user.role.permissions as string[]).includes('*')
        : false;

       if (!hasPermission) {
         return res.status(403).json({ error: 'Unauthorized access to fraud detection reports' });
       }
    }

    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const report = await FraudDetectionService.generateRedFlagsReport(start, end);

    return successResponse(res, {
      count: report.length,
      entries: report,
      period: {
        startDate: start,
        endDate: end,
      },
    });
  } catch (error) {
    logger.error('Generate red flags report error:', error);
    res.status(500).json({
      error: 'Failed to generate red flags report',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
