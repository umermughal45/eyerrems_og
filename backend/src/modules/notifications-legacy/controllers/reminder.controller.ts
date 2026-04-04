import type { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { ReminderService } from '../services/reminder.service';

function requireUserId(req: Request): string {
  const u: any = (req as any).user;
  const id = u?.id || u?.userId;
  if (!id) throw new Error('Unauthorized');
  return String(id);
}

export class ReminderController {
  private readonly service: ReminderService;

  constructor(pool: Pool) {
    this.service = new ReminderService(pool);
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const reminder = await this.service.createReminder(req.body, userId);
      res.status(201).json({ data: reminder });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const moduleName = req.query.module_name ? String(req.query.module_name) : undefined;
      const recordId = req.query.record_id ? String(req.query.record_id) : undefined;

      if (moduleName) {
        const data = await this.service.getRemindersByModule(moduleName, recordId);
        res.json({ data });
        return;
      }

      const data = await this.service.getUserReminders(userId);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUserId(req);
      const reminder = await this.service.getReminderById(String(req.params.id));
      if (!reminder) return res.status(404).json({ error: 'Not found' });
      res.json({ data: reminder });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = requireUserId(req);
      const reminder = await this.service.updateReminder(String(req.params.id), req.body, userId);
      res.json({ data: reminder });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireUserId(req);
      await this.service.deleteReminder(String(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}

