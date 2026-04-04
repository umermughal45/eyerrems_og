import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { NotificationService } from '../services/notification.service';

function requireUserId(req: Request): string {
  const u: any = (req as any).user;
  const id = u?.id || u?.userId;
  if (!id) throw new Error('Unauthorized');
  return String(id);
}

export class NotificationController {
  private readonly service: NotificationService;

  constructor(pool: Pool) {
    this.service = new NotificationService(pool);
  }

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const data = await this.service.getUserNotifications(userId, { unreadOnly: false, limit: 100 });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  unread = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const data = await this.service.getUserNotifications(userId, { unreadOnly: true, limit: 100 });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const ids: unknown = req.body?.ids;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
      const result = await this.service.markNotificationsRead(userId, ids.map(String));
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

