import { Queue, type ConnectionOptions } from 'bullmq';
import logger from '../../../utils/logger';
import { ReminderJobPayload } from '../types/reminderTypes';

export const REMINDER_QUEUE_NAME = 'reminder-queue';
export const REMINDER_JOB_NAME = 'send-reminder-notification' as const;

let queueInstance:
  | Queue<ReminderJobPayload, void, typeof REMINDER_JOB_NAME>
  | null = null;

export function isReminderQueueEnabled(): boolean {
  return process.env.USE_REDIS_QUEUE === 'true' && !!process.env.REDIS_URL;
}

function getBullMqConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      'REDIS_URL is required for the Reminder Engine queue. Please configure Redis.'
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
    logger.error('Invalid REDIS_URL for Reminder Engine', { err, url });
    throw err;
  }
}

export function getReminderQueue() {
  if (!isReminderQueueEnabled()) {
    throw new Error('Reminder queue is disabled (USE_REDIS_QUEUE is not "true").');
  }

  if (!queueInstance) {
    queueInstance = new Queue<ReminderJobPayload, void, typeof REMINDER_JOB_NAME>(
      REMINDER_QUEUE_NAME,
      { connection: getBullMqConnection() }
    );
    queueInstance.on('error', (err: Error) => {
      logger.error('Reminder queue error', { err });
    });
  }
  return queueInstance;
}

export async function enqueueReminderJob(payload: ReminderJobPayload) {
  if (!isReminderQueueEnabled()) {
    logger.warn('Redis queue disabled — running in development mode; enqueueReminderJob is a no-op.');
    return;
  }

  const queue = getReminderQueue();
  await queue.add(
    REMINDER_JOB_NAME,
    payload,
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}

