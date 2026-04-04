import type { NotificationChannel, NotificationStatus, RecipientType } from '../types/notification.types';

export interface NotificationRecord {
  id: string;
  reminder_id: string | null;
  recipient_type: RecipientType;
  recipient_id: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

