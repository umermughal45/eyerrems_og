export type ReminderStatus = 'pending' | 'completed' | 'cancelled';
export type ReminderPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationChannel = 'system' | 'email' | 'sms' | 'whatsapp';
export type NotificationStatus = 'pending' | 'queued' | 'sent' | 'failed';

export type RecipientType = 'user' | 'client' | 'dealer' | 'tenant';

export interface ReminderModel {
  id: string;
  title: string;
  description: string | null;
  module_name: string;
  record_id: string;
  assigned_to_user: string;
  reminder_date: string; // YYYY-MM-DD
  reminder_time: string; // HH:mm:ss
  priority: string;
  status: ReminderStatus;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

export interface NotificationModel {
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

export interface NotificationTemplateModel {
  id: string;
  name: string;
  channel: NotificationChannel;
  module_name: string;
  template_text: string;
  variables: Record<string, unknown> | null;
  status: string;
  created_at: string;
}

export interface NotificationLogModel {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  delivery_status: string;
  retry_count: number;
  provider_response: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateReminderInput {
  title: string;
  description?: string | null;
  module_name: string;
  record_id: string;
  assigned_to_user: string;
  reminder_date: string;
  reminder_time: string;
  priority: string;
  notification_channel?: NotificationChannel;
  notification_title?: string;
  notification_message?: string;
  scheduled_notification_at?: string | null;
}

export interface UpdateReminderInput {
  title?: string;
  description?: string | null;
  module_name?: string;
  record_id?: string;
  assigned_to_user?: string;
  reminder_date?: string;
  reminder_time?: string;
  priority?: string;
  status?: ReminderStatus;
}

export interface CreateNotificationInput {
  reminder_id?: string | null;
  recipient_type: RecipientType;
  recipient_id: string;
  channel: NotificationChannel;
  title: string;
  message: string;
  scheduled_at?: string | null;
}

export interface CreateTemplateInput {
  name: string;
  channel: NotificationChannel;
  module_name: string;
  template_text: string;
  variables?: Record<string, unknown> | null;
  status?: string;
}

export interface TemplateRenderResult {
  text: string;
  missingVariables: string[];
}

