import { apiService } from "@/lib/api"

export type NotificationChannel = "system" | "email" | "sms" | "whatsapp"

export interface NotificationDto {
  id: string
  reminder_id: string | null
  recipient_type: "user" | "client" | "dealer" | "tenant"
  recipient_id: string
  channel: NotificationChannel
  title: string
  message: string
  status: "pending" | "queued" | "sent" | "failed"
  scheduled_at: string | null
  sent_at: string | null
  created_at: string
}

export const notificationApi = {
  // Uses shared axios client which already:
  // - prefixes with /api
  // - attaches Authorization, CSRF, device headers, etc.
  list: async () => {
    const res = await apiService.get<{ data: NotificationDto[] }>("/notifications")
    return res.data
  },
  unread: async () => {
    const res = await apiService.get<{ data: NotificationDto[] }>("/notifications/unread")
    return res.data
  },
  markRead: async (ids: string[]) => {
    const res = await apiService.post<{ data: { marked: number } }>("/notifications/read", { ids })
    return res.data
  },
};

