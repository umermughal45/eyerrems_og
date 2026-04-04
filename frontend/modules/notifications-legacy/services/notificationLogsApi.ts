export interface NotificationLogDto {
  id: string
  notificationId: string
  channel: string
  deliveryStatus: string
  retryCount: number
  providerResponse: any
  createdAt: string
}

const API_BASE_RAW = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
const API_BASE = API_BASE_RAW.replace(/\/+$/, "")

function isProbablyHtml(contentType: string | null, bodyText: string) {
  if (contentType?.includes("text/html")) return true
  const t = bodyText.trimStart().slice(0, 64).toLowerCase()
  return t.startsWith("<!doctype html") || t.startsWith("<html") || t.includes("<head")
}

async function request<T>(path: string): Promise<T> {
  let p = path
  // Avoid double-prefix when env base already includes "/api"
  if (API_BASE.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4)
  const url = p.startsWith("http") ? p : `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`
  const res = await fetch(url, { credentials: "include" })
  const contentType = res.headers.get("content-type")
  const raw = await res.text().catch(() => "")

  if (isProbablyHtml(contentType, raw)) throw new Error("Backend API not connected.")
  if (!res.ok && res.status === 404) throw new Error("Reminder service unavailable")
  if (!res.ok) throw new Error(raw || `Request failed: ${res.status}`)

  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error("Backend API not connected.")
  }
}

export const notificationLogsApi = {
  list: async (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit != null) qs.set("limit", String(params.limit))
    if (params?.offset != null) qs.set("offset", String(params.offset))
    const url = "/api/notification-logs" + (qs.toString() ? `?${qs.toString()}` : "")
    return request<{ data: NotificationLogDto[] }>(url)
  },
}

