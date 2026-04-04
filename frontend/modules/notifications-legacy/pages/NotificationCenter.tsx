import React, { useMemo, useState } from "react"
import { useNotifications, useMarkNotificationsRead, useUnreadNotifications } from "../hooks/useNotifications"

export default function NotificationCenter() {
  const { data: notifications = [], isLoading, error } = useNotifications()
  const { data: unread = [] } = useUnreadNotifications()
  const markRead = useMarkNotificationsRead()

  const [unreadOnly, setUnreadOnly] = useState(false)
  const [channel, setChannel] = useState<string>("all")
  const [page, setPage] = useState(0)
  const pageSize = 25

  const markAllRead = async () => {
    if (unread.length === 0) return
    await markRead.mutateAsync(unread.map((n: any) => n.id))
  }

  const source = unreadOnly ? unread : notifications
  const filtered = useMemo(() => {
    const base = source
    const byChannel = channel === "all" ? base : base.filter((n: any) => String((n as any).channel || "").toLowerCase() === channel)
    return byChannel
  }, [source, channel])

  const pageItems = useMemo(() => {
    const start = page * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page])

  const canPrev = page > 0
  const canNext = (page + 1) * pageSize < filtered.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-900">Notification Center</div>
          <div className="mt-1 text-sm text-slate-500">Recent notifications</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setUnreadOnly((v) => !v)
              setPage(0)
            }}
          >
            {unreadOnly ? "Showing: Unread" : "Showing: All"}
          </button>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value)
              setPage(0)
            }}
          >
            <option value="all">All channels</option>
            <option value="system">System</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={markAllRead}
            disabled={unread.length === 0}
          >
            Mark all as read
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {String((error as any)?.message || error)}
        </div>
      ) : null}

      {isLoading ? <div className="text-sm text-slate-500">Loading…</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {pageItems.map((n: any) => (
            <li key={n.id} className="px-4 py-4 hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{n.message}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    {new Date(n.created_at || n.createdAt).toLocaleString()} • {String(n.type || n.channel || "system")} •{" "}
                    {n.read === false ? "unread" : "read"}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  onClick={() => markRead.mutateAsync([n.id])}
                >
                  Mark read
                </button>
              </div>
            </li>
          ))}
          {pageItems.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">No notifications.</li>
          ) : null}
        </ul>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={!canPrev}
        >
          Prev
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          onClick={() => setPage((p) => p + 1)}
          disabled={!canNext}
        >
          Next
        </button>
      </div>
    </div>
  )
}

