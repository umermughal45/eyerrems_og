import { Router } from 'express';
import { Pool } from 'pg';
import { ReminderController } from '../controllers/reminder.controller';

function requirePermission(permission: string) {
  return (req: any, res: any, next: any) => {
    const perms: string[] | undefined = req.user?.permissions;
    if (Array.isArray(perms) && perms.includes(permission)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
}

export function buildReminderRoutes(pool: Pool) {
  const router = Router();
  const controller = new ReminderController(pool);

  router.post('/api/reminders', requirePermission('reminder.create'), controller.create);
  router.get('/api/reminders', requirePermission('reminder.view'), controller.list);
  router.get('/api/reminders/:id', requirePermission('reminder.view'), controller.getById);
  router.put('/api/reminders/:id', requirePermission('reminder.update'), controller.update);
  router.delete('/api/reminders/:id', requirePermission('reminder.update'), controller.remove);

  return router;
}

