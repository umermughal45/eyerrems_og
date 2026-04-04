"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import NotificationModule from "@/modules/notifications"

export default function NotificationsPage() {
  return (
    <DashboardLayout>
      <NotificationModule />
    </DashboardLayout>
  )
}

