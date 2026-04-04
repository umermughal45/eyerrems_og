"use client"

import dynamic from "next/dynamic"

const Logs = dynamic(
  () => import("@/modules/notifications-legacy/pages/NotificationLogs").then((m) => m.default),
  { ssr: false },
)

export default function LogsTab() {
  return <Logs />
}

