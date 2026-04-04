import { Worker } from 'bullmq';
import { Pool } from 'pg';
import { NotificationService } from '../services/notification.service';
import type { NotificationJobName, SendNotificationJobData } from './notification.queue';

export function startNotificationWorker() {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  };

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: process.env.PGPOOL_MAX ? Number(process.env.PGPOOL_MAX) : 20,
  });

  const notificationService = new NotificationService(pool);

  const worker = new Worker<SendNotificationJobData, void, NotificationJobName>(
    'notification-delivery',
    async (job) => {
      const { notificationId, attempt } = job.data;
      await notificationService.sendNotification(notificationId, { attempt });
    },
    { connection, concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 10) }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    try {
      await notificationService.recordFailure(job.data.notificationId, err, job.attemptsMade);
    } catch {
      // swallow
    }
  });

  return worker;
}

