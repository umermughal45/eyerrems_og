import { apiService } from "@/lib/api"

export type ReminderStatus = "pending" | "completed" | "cancelled"

export interface ReminderDto {
  id: string
  title: string
  description: string | null
  module_name: string
  record_id: string
  assigned_to_user: string
  reminder_date: string
  reminder_time: string
  priority: string
  status: ReminderStatus
  created_by: string
  created_at: string
  updated_at: string | null
}

export interface CreateReminderPayload {
  title: string
  description?: string | null
  module_name: string
  record_id: string
  assigned_to_user: string
  reminder_date: string
  reminder_time: string
  priority: string
  notification_channel?: "system" | "email" | "sms" | "whatsapp"
}

export const reminderApi = {
  list: async () => {
    const res = await apiService.get<{ data: ReminderDto[] }>("/reminders")
    return res.data
  },
  getById: async (id: string) => {
    const res = await apiService.get<{ data: ReminderDto }>(`/reminders/${encodeURIComponent(id)}`)
    return res.data
  },
  create: async (payload: CreateReminderPayload) => {
    const res = await apiService.post<{ data: ReminderDto }>("/reminders", payload)
    return res.data
  },
  update: async (id: string, payload: Partial<CreateReminderPayload> & { status?: ReminderStatus }) => {
    const res = await apiService.put<{ data: ReminderDto }>(`/reminders/${encodeURIComponent(id)}`, payload)
    return res.data
  },
  remove: async (id: string) => {
    await apiService.delete<void>(`/reminders/${encodeURIComponent(id)}`)
  },
};

