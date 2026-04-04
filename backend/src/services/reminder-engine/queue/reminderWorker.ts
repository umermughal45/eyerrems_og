import { Worker, Job, type ConnectionOptions } from 'bullmq';
import prisma from '../../../prisma/client';
import logger from '../../../utils/logger';
import { ReminderJobPayload } from '../types/reminderTypes';
import { REMINDER_QUEUE_NAME } from './reminderQueue';
import { sendNotificationForReminder } from '../services/notificationService';
import { isReminderQueueEnabled } from './reminderQueue';

let worker: Worker<ReminderJobPayload> | null = null;

function getBullMqConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is required for the Reminder Engine worker. Please configure Redis.'
    );
  }

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      tls: parsed.protocol === 'rediss:' ? ({} as any) : undefined,
    } as ConnectionOptions;
  } catch (err) {
    logger.error('Invalid REDIS_URL for Reminder Engine worker', { err, url });
    throw err;
  }
}

async function processJob(job: Job<ReminderJobPayload>) {
  const { reminderId, recipientId, channel, message } = job.data;

  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
  });

  if (!reminder) {
    logger.warn('Reminder not found for job', { reminderId });
    return;
  }

  await prisma.reminder.update({
    where: { id: reminderId },
    data: { status: 'processing' },
  });

  try {
    await sendNotificationForReminder({
      reminderId,
      recipientId,
      channel,
      message,
      retryAttempt: job.attemptsMade + 1,
    });

    await prisma.reminder.update({
      where: { id: reminderId },
      data: { status: 'completed' },
    });
  } catch (error: any) {
    logger.error('Failed to process reminder notification', {
      reminderId,
      error: error?.message || String(error),
    });

    if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      await prisma.reminder.update({
        where: { id: reminderId },
        data: { status: 'failed' },
      });
    }

    throw error;
  }
}

export function startReminderWorker() {
  if (worker) return worker;

  if (!isReminderQueueEnabled()) {
    logger.warn('Worker disabled because Redis queue is OFF (USE_REDIS_QUEUE != "true" or REDIS_URL missing)');
    return null;
  }

  worker = new Worker<ReminderJobPayload>(
    REMINDER_QUEUE_NAME,
    async (job: Job<ReminderJobPayload>) => {
      await processJob(job);
    },
    {
      connection: getBullMqConnection(),
    }
  );

  worker.on('completed', (job: Job<ReminderJobPayload>) => {
    logger.info('Reminder job completed', { jobId: job.id });
  });

  worker.on('failed', (job: Job<ReminderJobPayload> | undefined, err: Error) => {
    logger.error('Reminder job failed', {
      jobId: job?.id,
      err: err?.message || String(err),
    });
  });

  return worker;
}

