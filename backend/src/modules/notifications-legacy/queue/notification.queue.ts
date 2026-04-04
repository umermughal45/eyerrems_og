import { Queue } from 'bullmq';
import type { NotificationChannel } from '../types/notification.types';

export type NotificationJobName = 'send-notification';

export interface SendNotificationJobData {
  notificationId: string;
  channel: NotificationChannel;
  attempt: number;
}

export function createNotificationQueue() {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  };

  return new Queue<SendNotificationJobData, unknown, NotificationJobName>('notification-delivery', {
    connection,
    defaultJobOptions: {
      removeOnComplete: 5000,
      removeOnFail: 20000,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10_000 },
    },
  });
}

