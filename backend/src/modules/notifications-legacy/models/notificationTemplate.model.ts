import type { NotificationChannel } from '../types/notification.types';

export interface NotificationTemplateRecord {
  id: string;
  name: string;
  channel: NotificationChannel;
  module_name: string;
  template_text: string;
  variables: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

