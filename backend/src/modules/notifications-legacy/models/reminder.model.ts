import type { ReminderStatus } from '../types/notification.types';

export interface ReminderRecord {
  id: string;
  title: string;
  description: string | null;
  module_name: string;
  record_id: string;
  assigned_to_user: string;
  reminder_date: string;
  reminder_time: string;
  priority: string;
  status: ReminderStatus;
  created_by: string;
  created_at: string;
  updated_at: string | null;
}

