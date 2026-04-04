import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type {
  CreateNotificationInput,
  NotificationModel,
  NotificationStatus,
  NotificationChannel,
  RecipientType,
} from '../types/notification.types';
import { createNotificationQueue } from '../queue/notification.queue';

type SendResult = { ok: true; providerResponse?: Record<string, unknown> } | { ok: false; error: Error; providerResponse?: Record<string, unknown> };

function nowIso(v: any): string {
  return v?.toISOString ? v.toISOString() : String(v);
}

export class NotificationService {
  private readonly queue = createNotificationQueue();

  constructor(private readonly pool: Pool) {}

  async createNotification(input: CreateNotificationInput, createdBy?: string): Promise<NotificationModel> {
    const id = randomUUID();
    const status: NotificationStatus = input.scheduled_at ? 'pending' : 'queued';

    const q = `
      INSERT INTO notifications (id, reminder_id, recipient_type, recipient_id, channel, title, message, status, scheduled_at, sent_at, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,NOW())
      RETURNING id, reminder_id, recipient_type, recipient_id, channel, title, message, status, scheduled_at, sent_at, created_at
    `;

    const res = await this.pool.query(q, [
      id,
      input.reminder_id ?? null,
      input.recipient_type,
      input.recipient_id,
      input.channel,
      input.title,
      input.message,
      status,
      input.scheduled_at ?? null,
    ]);

    void createdBy;

    const notification = this.mapNotificationRow(res.rows[0]);

    if (!input.scheduled_at) {
      await this.queue.add(
        'send-notification',
        { notificationId: notification.id, channel: notification.channel, attempt: 0 },
        { jobId: notification.id }
      );
    }

    return notification;
  }

  async scheduleNotification(input: CreateNotificationInput, scheduledAt: string, createdBy?: string) {
    return this.createNotification({ ...input, scheduled_at: scheduledAt }, createdBy);
  }

  async sendNotification(notificationId: string, opts?: { attempt?: number }): Promise<void> {
    const n = await this.getNotificationById(notificationId);
    if (!n) throw new Error('Notification not found');

    if (n.scheduled_at) {
      const scheduled = new Date(n.scheduled_at).getTime();
      if (Number.isFinite(scheduled) && Date.now() < scheduled) {
        await this.queue.add(
          'send-notification',
          { notificationId: n.id, channel: n.channel, attempt: (opts?.attempt ?? 0) + 1 },
          { jobId: `${n.id}:${scheduled}`, delay: Math.max(0, scheduled - Date.now()) }
        );
        await this.setNotificationStatus(n.id, 'queued');
        await this.insertLog(n.id, n.channel, 'queued', opts?.attempt ?? 0, { delayed: true, scheduled_at: n.scheduled_at });
        return;
      }
    }

    const result = await this.dispatchToChannel(n.channel, n);

    if (result.ok) {
      await this.setNotificationSent(n.id, result.providerResponse);
      return;
    }

    await this.setNotificationStatus(n.id, 'failed');
    await this.insertLog(n.id, n.channel, 'failed', opts?.attempt ?? 0, {
      error: { message: result.error.message, name: result.error.name, stack: result.error.stack },
      provider: result.providerResponse ?? null,
    });

    throw result.error;
  }

  async retryFailedNotifications(limit = 200): Promise<{ retried: number }> {
    const q = `
      SELECT id, channel
      FROM notifications
      WHERE status = 'failed'
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const res = await this.pool.query(q, [limit]);
    let count = 0;
    for (const row of res.rows) {
      await this.setNotificationStatus(String(row.id), 'queued');
      await this.queue.add(
        'send-notification',
        { notificationId: String(row.id), channel: row.channel as NotificationChannel, attempt: 0 },
        { jobId: `${row.id}:${Date.now()}` }
      );
      count++;
    }
    return { retried: count };
  }

  async getUserNotifications(userId: string, opts?: { unreadOnly?: boolean; limit?: number }): Promise<NotificationModel[]> {
    const limit = opts?.limit ?? 50;
    if (!opts?.unreadOnly) {
      const q = `
        SELECT id, reminder_id, recipient_type, recipient_id, channel, title, message, status, scheduled_at, sent_at, created_at
        FROM notifications
        WHERE recipient_type = 'user' AND recipient_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      const res = await this.pool.query(q, [userId, limit]);
      return res.rows.map((r) => this.mapNotificationRow(r));
    }

    const q = `
      SELECT n.id, n.reminder_id, n.recipient_type, n.recipient_id, n.channel, n.title, n.message, n.status, n.scheduled_at, n.sent_at, n.created_at
      FROM notifications n
      WHERE n.recipient_type = 'user'
        AND n.recipient_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM notification_logs l
          WHERE l.notification_id = n.id
            AND l.delivery_status = 'read'
        )
      ORDER BY n.created_at DESC
      LIMIT $2
    `;
    const res = await this.pool.query(q, [userId, limit]);
    return res.rows.map((r) => this.mapNotificationRow(r));
  }

  async markNotificationsRead(userId: string, notificationIds: string[]): Promise<{ marked: number }> {
    if (notificationIds.length === 0) return { marked: 0 };

    const q = `
      SELECT id, channel
      FROM notifications
      WHERE recipient_type = 'user'
        AND recipient_id = $1
        AND id = ANY($2::uuid[])
    `;
    const res = await this.pool.query(q, [userId, notificationIds]);
    let marked = 0;
    for (const row of res.rows) {
      await this.insertLog(String(row.id), row.channel as NotificationChannel, 'read', 0, { read: true });
      marked++;
    }
    return { marked };
  }

  async recordFailure(notificationId: string, err: unknown, retryCount: number) {
    const n = await this.getNotificationById(notificationId);
    if (!n) return;
    await this.setNotificationStatus(notificationId, 'failed');
    await this.insertLog(notificationId, n.channel, 'failed', retryCount, {
      error: err instanceof Error ? { message: err.message, name: err.name, stack: err.stack } : { value: String(err) },
    });
  }

  private async getNotificationById(id: string): Promise<NotificationModel | null> {
    const q = `
      SELECT id, reminder_id, recipient_type, recipient_id, channel, title, message, status, scheduled_at, sent_at, created_at
      FROM notifications
      WHERE id = $1
      LIMIT 1
    `;
    const res = await this.pool.query(q, [id]);
    if (res.rowCount === 0) return null;
    return this.mapNotificationRow(res.rows[0]);
  }

  private async setNotificationStatus(id: string, status: NotificationStatus) {
    const q = `UPDATE notifications SET status = $2 WHERE id = $1`;
    await this.pool.query(q, [id, status]);
  }

  private async setNotificationSent(id: string, providerResponse?: Record<string, unknown>) {
    const q = `UPDATE notifications SET status = 'sent', sent_at = NOW() WHERE id = $1`;
    await this.pool.query(q, [id]);
    const n = await this.getNotificationById(id);
    if (n) {
      await this.insertLog(id, n.channel, 'sent', 0, providerResponse ?? { ok: true });
    }
  }

  private async insertLog(
    notificationId: string,
    channel: NotificationChannel,
    deliveryStatus: string,
    retryCount: number,
    providerResponse: Record<string, unknown> | null
  ) {
    const q = `
      INSERT INTO notification_logs (id, notification_id, channel, delivery_status, retry_count, provider_response, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,NOW())
    `;
    await this.pool.query(q, [
      randomUUID(),
      notificationId,
      channel,
      deliveryStatus,
      retryCount,
      providerResponse ? JSON.stringify(providerResponse) : null,
    ]);
  }

  private async dispatchToChannel(channel: NotificationChannel, n: NotificationModel): Promise<SendResult> {
    switch (channel) {
      case 'system':
        return { ok: true, providerResponse: { channel: 'system', delivered: true } };
      case 'email':
        return this.sendEmail(n);
      case 'sms':
        return this.sendSms(n);
      case 'whatsapp':
        return this.sendWhatsapp(n);
      default:
        return { ok: false, error: new Error(`Unsupported channel: ${channel}`) };
    }
  }

  private async sendEmail(n: NotificationModel): Promise<SendResult> {
    void n;
    // Integrate with your provider (SES/SendGrid/SMTP) in production.
    return { ok: true, providerResponse: { provider: 'email', accepted: true } };
  }

  private async sendSms(n: NotificationModel): Promise<SendResult> {
    void n;
    // Integrate with your provider (Twilio/etc) in production.
    return { ok: true, providerResponse: { provider: 'sms', accepted: true } };
  }

  private async sendWhatsapp(n: NotificationModel): Promise<SendResult> {
    void n;
    // Integrate with your provider (Twilio WhatsApp/etc) in production.
    return { ok: true, providerResponse: { provider: 'whatsapp', accepted: true } };
  }

  private mapNotificationRow(row: any): NotificationModel {
    return {
      id: String(row.id),
      reminder_id: row.reminder_id ? String(row.reminder_id) : null,
      recipient_type: row.recipient_type as RecipientType,
      recipient_id: String(row.recipient_id),
      channel: row.channel as NotificationChannel,
      title: String(row.title),
      message: String(row.message),
      status: row.status as NotificationStatus,
      scheduled_at: row.scheduled_at ? nowIso(row.scheduled_at) : null,
      sent_at: row.sent_at ? nowIso(row.sent_at) : null,
      created_at: nowIso(row.created_at),
    };
  }
}

