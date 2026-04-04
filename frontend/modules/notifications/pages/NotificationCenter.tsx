"use client"

import dynamic from "next/dynamic"

const NotificationCenter = dynamic(
  () => import("@/modules/notifications-legacy/pages/NotificationCenter").then((m) => m.default),
  { ssr: false },
)

export default function NotificationCenterTab() {
  return <NotificationCenter />
}

