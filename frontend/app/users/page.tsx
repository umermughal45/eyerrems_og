"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { DashboardLayout } from "@/components/dashboard-layout"
import { UsersView } from "@/components/users/users-view"
import { Loader2 } from "lucide-react"

export default function UsersPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">Authentication required</h2>
          <p className="text-sm text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    )
  }

  // Check if user is admin
  const isAdmin = user.role?.toLowerCase() === "admin"
  
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-2xl font-semibold">Access restricted</h2>
          <p className="text-sm text-muted-foreground">Only administrators can view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-4">
        <UsersView />
      </div>
    </DashboardLayout>
  )
}
