import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { notificationLogsApi } from "../services/notificationLogsApi"

export default function NotificationLogs() {
  const [page, setPage] = useState(0)
  const pageSize = 50

  const { data, isLoading, error } = useQuery({
    queryKey: ["notification-logs", page],
    queryFn: async () => (await notificationLogsApi.list({ limit: pageSize, offset: page * pageSize })).data,
  })

  const rows = data ?? []

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }))

  const canPrev = page > 0
  const canNext = rows.length === pageSize

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xl font-semibold text-slate-900">Notification Logs</div>
          <div className="mt-1 text-sm text-slate-500">Delivery audit trail</div>
        </div>
        <div className="flex items-center gap-2">
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

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {String((error as any)?.message || error)}
        </div>
      ) : null}
      {isLoading ? <div className="text-sm text-slate-500">Loading…</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Notification ID</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Delivery Status</th>
              <th className="px-4 py-3">Retry Count</th>
              <th className="px-4 py-3">Provider Response</th>
              <th className="px-4 py-3">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.notificationId}</td>
                <td className="px-4 py-3 text-slate-700">{r.channel}</td>
                <td className="px-4 py-3 text-slate-700">{r.deliveryStatus}</td>
                <td className="px-4 py-3 text-slate-700">{r.retryCount}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    onClick={() => toggle(r.id)}
                  >
                    {expanded[r.id] ? "Hide" : "View"}
                  </button>
                  {expanded[r.id] ? (
                    <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-950 p-3 text-[11px] text-slate-50">
                      {JSON.stringify(r.providerResponse ?? {}, null, 2)}
                    </pre>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No logs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

