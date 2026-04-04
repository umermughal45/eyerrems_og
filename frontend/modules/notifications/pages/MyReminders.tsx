"use client"

import dynamic from "next/dynamic"

const MyReminders = dynamic(
  () => import("@/modules/notifications-legacy/pages/MyReminders").then((m) => m.default),
  { ssr: false },
)

export default function MyRemindersTab() {
  return <MyReminders />
}

