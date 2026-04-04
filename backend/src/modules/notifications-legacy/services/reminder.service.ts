import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type {
  CreateReminderInput,
  ReminderModel,
  UpdateReminderInput,
  ReminderStatus,
  NotificationChannel,
} from '../types/notification.types';
import { NotificationService } from './notification.service';

function nowIso(v: any): string {
  return v?.toISOString ? v.toISOString() : String(v);
}

export class ReminderService {
  private readonly notificationService: NotificationService;

  constructor(private readonly pool: Pool) {
    this.notificationService = new NotificationService(pool);
  }

  async createReminder(input: CreateReminderInput, createdBy: string): Promise<ReminderModel> {
    const id = randomUUID();
    const status: ReminderStatus = 'pending';

    const q = `
      INSERT INTO reminders (
        id, title, description, module_name, record_id, assigned_to_user,
        reminder_date, reminder_time, priority, status, created_by, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING
        id, title, description, module_name, record_id, assigned_to_user,
        reminder_date, reminder_time, priority, status, created_by, created_at, updated_at
    `;

    const res = await this.pool.query(q, [
      id,
      input.title,
      input.description ?? null,
      input.module_name,
      input.record_id,
      input.assigned_to_user,
      input.reminder_date,
      input.reminder_time,
      input.priority,
      status,
      createdBy,
    ]);

    const reminder = this.mapReminderRow(res.rows[0]);

    if (input.notification_channel) {
      const channel: NotificationChannel = input.notification_channel;
      const title = input.notification_title ?? `Reminder: ${reminder.title}`;
      const message =
        input.notification_message ??
        `${reminder.title}${reminder.description ? ` - ${reminder.description}` : ''} (${reminder.module_name} ${reminder.record_id})`;

      if (input.scheduled_notification_at) {
        await this.notificationService.scheduleNotification(
          {
            reminder_id: reminder.id,
            recipient_type: 'user',
            recipient_id: reminder.assigned_to_user,
            channel,
            title,
            message,
          },
          input.scheduled_notification_at,
          createdBy
        );
      } else {
        await this.notificationService.createNotification(
          {
            reminder_id: reminder.id,
            recipient_type: 'user',
            recipient_id: reminder.assigned_to_user,
            channel,
            title,
            message,
          },
          createdBy
        );
      }
    }

    return reminder;
  }

  async updateReminder(id: string, input: UpdateReminderInput, updatedBy: string): Promise<ReminderModel> {
    const existing = await this.getReminderById(id);
    if (!existing) throw new Error('Reminder not found');

    const merged = {
      title: input.title ?? existing.title,
      description: input.description !== undefined ? input.description : existing.description,
      module_name: input.module_name ?? existing.module_name,
      record_id: input.record_id ?? existing.record_id,
      assigned_to_user: input.assigned_to_user ?? existing.assigned_to_user,
      reminder_date: input.reminder_date ?? existing.reminder_date,
      reminder_time: input.reminder_time ?? existing.reminder_time,
      priority: input.priority ?? existing.priority,
      status: input.status ?? existing.status,
    };

    const q = `
      UPDATE reminders
      SET title=$2, description=$3, module_name=$4, record_id=$5, assigned_to_user=$6,
          reminder_date=$7, reminder_time=$8, priority=$9, status=$10,
          updated_at=NOW()
      WHERE id=$1
      RETURNING
        id, title, description, module_name, record_id, assigned_to_user,
        reminder_date, reminder_time, priority, status, created_by, created_at, updated_at
    `;

    const res = await this.pool.query(q, [
      id,
      merged.title,
      merged.description ?? null,
      merged.module_name,
      merged.record_id,
      merged.assigned_to_user,
      merged.reminder_date,
      merged.reminder_time,
      merged.priority,
      merged.status,
    ]);

    void updatedBy;
    return this.mapReminderRow(res.rows[0]);
  }

  async deleteReminder(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM reminders WHERE id = $1`, [id]);
  }

  async completeReminder(id: string, updatedBy: string): Promise<ReminderModel> {
    return this.updateReminder(id, { status: 'completed' }, updatedBy);
  }

  async getUserReminders(userId: string, opts?: { status?: string; limit?: number }): Promise<ReminderModel[]> {
    const limit = opts?.limit ?? 100;
    if (opts?.status) {
      const q = `
        SELECT id, title, description, module_name, record_id, assigned_to_user, reminder_date, reminder_time,
               priority, status, created_by, created_at, updated_at
        FROM reminders
        WHERE assigned_to_user = $1 AND status = $2
        ORDER BY reminder_date ASC, reminder_time ASC
        LIMIT $3
      `;
      const res = await this.pool.query(q, [userId, opts.status, limit]);
      return res.rows.map((r) => this.mapReminderRow(r));
    }

    const q = `
      SELECT id, title, description, module_name, record_id, assigned_to_user, reminder_date, reminder_time,
             priority, status, created_by, created_at, updated_at
      FROM reminders
      WHERE assigned_to_user = $1
      ORDER BY reminder_date ASC, reminder_time ASC
      LIMIT $2
    `;
    const res = await this.pool.query(q, [userId, limit]);
    return res.rows.map((r) => this.mapReminderRow(r));
  }

  async getRemindersByModule(moduleName: string, recordId?: string, opts?: { limit?: number }): Promise<ReminderModel[]> {
    const limit = opts?.limit ?? 200;
    if (recordId) {
      const q = `
        SELECT id, title, description, module_name, record_id, assigned_to_user, reminder_date, reminder_time,
               priority, status, created_by, created_at, updated_at
        FROM reminders
        WHERE module_name = $1 AND record_id = $2
        ORDER BY reminder_date ASC, reminder_time ASC
        LIMIT $3
      `;
      const res = await this.pool.query(q, [moduleName, recordId, limit]);
      return res.rows.map((r) => this.mapReminderRow(r));
    }

    const q = `
      SELECT id, title, description, module_name, record_id, assigned_to_user, reminder_date, reminder_time,
             priority, status, created_by, created_at, updated_at
      FROM reminders
      WHERE module_name = $1
      ORDER BY reminder_date ASC, reminder_time ASC
      LIMIT $2
    `;
    const res = await this.pool.query(q, [moduleName, limit]);
    return res.rows.map((r) => this.mapReminderRow(r));
  }

  async getReminderById(id: string): Promise<ReminderModel | null> {
    const q = `
      SELECT id, title, description, module_name, record_id, assigned_to_user, reminder_date, reminder_time,
             priority, status, created_by, created_at, updated_at
      FROM reminders
      WHERE id = $1
      LIMIT 1
    `;
    const res = await this.pool.query(q, [id]);
    if (res.rowCount === 0) return null;
    return this.mapReminderRow(res.rows[0]);
  }

  private mapReminderRow(row: any): ReminderModel {
    return {
      id: String(row.id),
      title: String(row.title),
      description: row.description !== null && row.description !== undefined ? String(row.description) : null,
      module_name: String(row.module_name),
      record_id: String(row.record_id),
      assigned_to_user: String(row.assigned_to_user),
      reminder_date: row.reminder_date?.toISOString ? row.reminder_date.toISOString().slice(0, 10) : String(row.reminder_date),
      reminder_time: String(row.reminder_time),
      priority: String(row.priority),
      status: row.status,
      created_by: String(row.created_by),
      created_at: nowIso(row.created_at),
      updated_at: row.updated_at ? nowIso(row.updated_at) : null,
    };
  }
}

