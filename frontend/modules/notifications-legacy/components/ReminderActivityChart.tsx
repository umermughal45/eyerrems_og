import React, { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ReminderDto } from "../services/reminderApi"

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function ReminderActivityChart({ reminders }: { reminders: ReminderDto[] }) {
  const data = useMemo(() => {
    const today = new Date()
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (13 - i))
      return ymd(d)
    })
    const counts = new Map<string, { date: string; total: number; completed: number }>()
    for (const day of days) counts.set(day, { date: day.slice(5), total: 0, completed: 0 })

    for (const r of reminders) {
      const key = r.reminder_date
      const slot = counts.get(key)
      if (!slot) continue
      slot.total += 1
      if (r.status === "completed") slot.completed += 1
    }
    return Array.from(counts.values())
  }, [reminders])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-700">Reminder Activity (Last 14 days)</div>
      <div className="mt-3 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="total" fill="#6366F1" radius={[6, 6, 0, 0]} />
            <Bar dataKey="completed" fill="#10B981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

