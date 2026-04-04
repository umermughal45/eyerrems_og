"use client"

import dynamic from "next/dynamic"

const ReminderDashboard = dynamic(
  () => import("@/modules/notifications-legacy/pages/ReminderDashboard").then((m) => m.default),
  { ssr: false },
)

export default function Dashboard() {
  return <ReminderDashboard />
}

