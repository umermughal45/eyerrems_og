"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("erp-user") : null
      
      // Only redirect if we're truly not authenticated (no token AND no user)
      if (!isAuthenticated && !user && !token && !storedUser) {
        // Check if user was previously a role-based user
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser)
            if (parsedUser.role?.toLowerCase() !== "admin") {
              router.push("/roles/login")
              return
            }
          } catch (e) {
            // If parsing fails, default to admin login
          }
        }
        router.push("/login")
        return
      }
      
      // If we have token but no user yet, wait (auth context is still initializing)
      if (token && storedUser && !user) {
        return
      }

      if (user && requireAdmin && user.role !== "admin") {
        router.push("/")
        return
      }
    }
  }, [user, loading, isAuthenticated, router, requireAdmin])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  if (requireAdmin && user.role !== "admin") {
    return null
  }

  return <>{children}</>
}

