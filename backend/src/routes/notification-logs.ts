import express, { Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/rbac';

const router = (express as any).Router();

const isDev = process.env.NODE_ENV === 'development';

const requireAuthOrDevBypass = isDev
  ? (req: AuthenticatedRequest, _res: Response, next: NextFunction) => next()
  : requireAuth;

const requirePermissionOrDevBypass = (permission: string) =>
  isDev
    ? (req: AuthenticatedRequest, _res: Response, next: NextFunction) => next()
    : requirePermission(permission);

router.get(
  '/',
  requireAuthOrDevBypass,
  requirePermissionOrDevBypass('notification.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { limit = '100', offset = '0' } = req.query as any;
    const take = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
    const skip = Math.max(0, parseInt(String(offset), 10) || 0);

    const rows = await prisma.notificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    res.json({ data: rows });
  }
);

export default router;

