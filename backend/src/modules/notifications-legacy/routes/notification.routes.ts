import { Router } from 'express';
import { Pool } from 'pg';
import { NotificationController } from '../controllers/notification.controller';

function requirePermission(permission: string) {
  return (req: any, res: any, next: any) => {
    const perms: string[] | undefined = req.user?.permissions;
    if (Array.isArray(perms) && perms.includes(permission)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

export function buildNotificationRoutes(pool: Pool) {
  const router = Router();
  const controller = new NotificationController(pool);

  router.get('/api/notifications', requirePermission('notification.view'), controller.list);
  router.get('/api/notifications/unread', requirePermission('notification.view'), controller.unread);
  router.post('/api/notifications/read', requirePermission('notification.manage'), controller.markRead);

  return router;
}

