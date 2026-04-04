"use client"

import { MailView } from "@/components/mail/mail-view"
import { DashboardLayout } from "@/components/dashboard-layout"

export default function MailPage() {
  return (
    <DashboardLayout>
      <div className="flex h-full flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Internal Mail</h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage your communications and system notifications.</p>
        </div>
        <MailView />
      </div>
    </DashboardLayout>
  )
}
