"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AdvancedOptionsPage } from "@/components/admin/advanced-options-page"
import { Loader2 } from "lucide-react"

export default function AdvancedOptionsRoute() {
  const { user, loading } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    if (!user) return
    const normalizedRole = user.role?.toLowerCase()
    const hasPermission =
      user.permissions?.includes("*") ||
      user.permissions?.some((permission) => permission.startsWith("advanced")) ||
      false
    setHasAccess(normalizedRole === "admin" || !!hasPermission)
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">Access restricted</h2>
          <p className="text-sm text-muted-foreground">Only administrators and staff with the advanced permissions can view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-4">
        <AdvancedOptionsPage />
      </div>
    </DashboardLayout>
  )
}

