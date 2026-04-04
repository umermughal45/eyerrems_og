import express, { Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { requireAuth, requirePermission, type AuthenticatedRequest } from '../middleware/rbac';
import { computeTriggerTime } from '../services/reminder-engine/services/reminderService';

const router = (express as any).Router();

const isDev = process.env.NODE_ENV === 'development';

const requireAuthOrDevBypass = isDev
  ? (req: AuthenticatedRequest, _res: Response, next: NextFunction) => next()
  : requireAuth;

const requirePermissionOrDevBypass = (permission: string) =>
  isDev
    ? (req: AuthenticatedRequest, _res: Response, next: NextFunction) => next()
    : requirePermission(permission);

router.post(
  '/',
  requireAuthOrDevBypass,
  requirePermissionOrDevBypass('reminder.create'),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id || 'dev-user';
    const body: any = req.body || {};

    const reminderDate = new Date(String(body.reminder_date || body.reminderDate));
    const reminderTime = new Date(
      `1970-01-01T${String(body.reminder_time || body.reminderTime || '00:00')}:00.000Z`
    );
    const triggerTime = computeTriggerTime(reminderDate, reminderTime);

    const reminder = await prisma.reminder.create({
      data: {
        title: String(body.title || ''),
        description: body.description != null ? String(body.description) : null,
        moduleName: String(body.module_name || body.moduleName || ''),
        recordId: String(body.record_id || body.recordId || ''),
        assignedToUser: String(body.assigned_to_user || body.assignedToUser || userId),
        reminderDate,
        reminderTime,
        triggerTime,
        priority: String(body.priority || 'medium'),
        status: String(body.status || 'pending'),
        createdBy: userId,
        updatedAt: new Date(),
      },
    });

    if (body.notification_channel) {
      await prisma.notification.create({
        data: {
          userId: String(reminder.assignedToUser),
          title: `Reminder: ${reminder.title}`,
          message: `${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''}`,
          type: `channel:${String(body.notification_channel)}`,
          read: false,
        },
      });
    }

    res.status(201).json({ data: reminder });
  }
);

router.get(
  '/',
  requireAuthOrDevBypass,
  requirePermissionOrDevBypass('reminder.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.id;
    const { module_name, record_id } = req.query as any;

    const reminders = await prisma.reminder.findMany({
      where: module_name
        ? { moduleName: String(module_name), ...(record_id ? { recordId: String(record_id) } : {}) }
        : userId
          ? { assignedToUser: userId }
          : {},
      orderBy: [{ reminderDate: 'asc' }, { reminderTime: 'asc' }],
      take: 500,
    });

    res.json({ data: reminders });
  }
);

router.get(
  '/:id',
  requireAuthOrDevBypass,
  requirePermissionOrDevBypass('reminder.view'),
  async (req: AuthenticatedRequest, res: Response) => {
    const reminder = await prisma.reminder.findUnique({ where: { id: String(req.params.id) } });
    if (!reminder) return res.status(404).json({ error: 'Not found' });
    res.json({ data: reminder });
  }
);

router.put(
  '/:id',
  requireAuthOrDevBypass,
  requirePermissionOrDevBypass('reminder.update'),
  async (req: AuthenticatedRequest, res: Response) => {
    const body: any = req.body || {};
    const updatedReminder = await prisma.reminder.update({
      where: { id: String(req.params.id) },
      data: {
        title: body.title != null ? String(body.title) : undefined,
        description:
          body.description !== undefined
            ? body.description == null
              ? null
              : String(body.description)
            : undefined,
        moduleName: body.module_name != null ? String(body.module_name) : undefined,
        recordId: body.record_id != null ? String(body.record_id) : undefined,
        assignedToUser:
          body.assigned_to_user != null ? String(body.assigned_to_user) : undefined,
        reminderDate: body.reminder_date ? new Date(String(body.reminder_date)) : undefined,
        reminderTime: body.reminder_time
          ? new Date(`1970-01-01T${String(body.reminder_time).slice(0, 5)}:00.000Z`)
          : undefined,
        priority: body.priority != null ? String(body.priority) : undefined,
        status: body.status != null ? String(body.status) : undefined,
        updatedAt: new Date(),
      },
    });

    // Ensure triggerTime stays in sync when date/time are updated
    if (body.reminder_date || body.reminder_time) {
      const effectiveDate = body.reminder_date
        ? new Date(String(body.reminder_date))
        : (updatedReminder.reminderDate as any as Date);
      const effectiveTime = body.reminder_time
        ? new Date(`1970-01-01T${String(body.reminder_time).slice(0, 5)}:00.000Z`)
        : (updatedReminder.reminderTime as any as Date);

      const triggerTime = computeTriggerTime(effectiveDate, effectiveTime);
      await prisma.reminder.update({
        where: { id: updatedReminder.id },
        data: { triggerTime },
      });
    }
    res.json({ data: updatedReminder });
  }
);

router.delete(
  '/:id',
  requireAuthOrDevBypass,
  requirePermissionOrDevBypass('reminder.delete'),
  async (req: AuthenticatedRequest, res: Response) => {
    await prisma.reminder.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
  }
);

export default router;

