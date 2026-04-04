import cron from 'node-cron';
import prisma from '../../../prisma/client';
import logger from '../../../utils/logger';
import { enqueueReminderJob, isReminderQueueEnabled } from '../queue/reminderQueue';
import { NotificationChannel } from '../types/reminderTypes';
import { sendNotificationForReminder } from '../services/notificationService';

let started = false;

function buildDefaultMessage(reminder: { title: string; description: string | null }) {
  return reminder.description
    ? `${reminder.title} - ${reminder.description}`
    : reminder.title;
}

async function processReminderSynchronously(reminder: { id: string; assignedToUser: string | null; title: string; description: string | null }) {
  if (!reminder.assignedToUser) return;

  await prisma.reminder.update({
    where: { id: reminder.id },
    data: { status: 'processing' },
  });

  try {
    await sendNotificationForReminder({
      reminderId: reminder.id,
      recipientId: reminder.assignedToUser,
      channel: 'system' as NotificationChannel,
      message: buildDefaultMessage(reminder),
      retryAttempt: 1,
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'completed' },
    });
  } catch (error: any) {
    logger.error('Failed to process reminder synchronously', {
      reminderId: reminder.id,
      error: error?.message || String(error),
    });

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { status: 'failed' },
    });
  }
}

export function startReminderScheduler() {
  if (started) return;
  started = true;

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      const dueReminders = await prisma.reminder.findMany({
        where: {
          status: 'pending',
          triggerTime: {
            lte: now,
          },
        },
        take: 200,
      });

      if (!dueReminders.length) return;

      const queueEnabled = isReminderQueueEnabled();

      for (const reminder of dueReminders) {
        if (!reminder.assignedToUser) continue;

        if (!queueEnabled) {
          logger.warn('Redis queue disabled — processing reminder synchronously (development mode)', {
            reminderId: reminder.id,
          });
          await processReminderSynchronously(reminder as any);
          continue;
        }

        await enqueueReminderJob({
          reminderId: reminder.id,
          recipientId: reminder.assignedToUser,
          channel: 'system' as NotificationChannel,
          message: buildDefaultMessage(reminder),
        });

        await prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'queued' },
        });
      }
    } catch (error: any) {
      logger.error('Error in Reminder Engine scheduler', {
        error: error?.message || String(error),
      });
    }
  });
}

