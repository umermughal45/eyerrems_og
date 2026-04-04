"use client"

import React, { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Dashboard from "./pages/Dashboard"
import MyReminders from "./pages/MyReminders"
import NotificationCenter from "./pages/NotificationCenter"
import Templates from "./pages/Templates"
import Logs from "./pages/Logs"

type TabKey = "dashboard" | "reminders" | "center" | "templates" | "logs"

const TAB_LABELS: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reminders", label: "My Reminders" },
  { key: "center", label: "Notification Center" },
  { key: "templates", label: "Templates" },
  { key: "logs", label: "Notification Logs" },
]

function normalizeTab(input: string | null): TabKey {
  const t = String(input || "").toLowerCase()
  if (t === "dashboard") return "dashboard"
  if (t === "reminders") return "reminders"
  if (t === "center") return "center"
  if (t === "templates") return "templates"
  if (t === "logs") return "logs"
  return "dashboard"
}

export function NotificationModule() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const current = useMemo<TabKey>(() => normalizeTab(searchParams.get("tab")), [searchParams])
  const [value, setValue] = useState<TabKey>(current)

  useEffect(() => {
    setValue(current)
  }, [current])

  const onChange = (next: string) => {
    const tab = normalizeTab(next)
    setValue(tab)
    const sp = new URLSearchParams(searchParams.toString())
    sp.set("tab", tab)
    router.replace(`${pathname}?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-semibold text-slate-900">Reminder & Notifications</div>
            <div className="mt-1 text-sm text-slate-500">Manage reminders, channels, templates, and delivery logs</div>
          </div>
        </div>

        <Tabs value={value} onValueChange={onChange} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto">
            {TAB_LABELS.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="whitespace-nowrap">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={value} onValueChange={onChange}>
        <TabsContent value="dashboard">
          <Dashboard />
        </TabsContent>
        <TabsContent value="reminders">
          <MyReminders />
        </TabsContent>
        <TabsContent value="center">
          <NotificationCenter />
        </TabsContent>
        <TabsContent value="templates">
          <Templates />
        </TabsContent>
        <TabsContent value="logs">
          <Logs />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default NotificationModule

