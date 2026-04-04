import type { NotificationChannel } from '../types/notification.types';

export interface NotificationLogRecord {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  delivery_status: string;
  retry_count: number;
  provider_response: Record<string, unknown> | null;
  created_at: string;
}

