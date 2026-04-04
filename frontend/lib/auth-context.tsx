"use client"

import * as React from "react"
import { apiService } from "@/lib/api"

type UserRole = "admin" | "dealer" | "accountant" | "hr_manager" | "property_manager" | string

type User = {
  id: string
  name: string
  username?: string
  email: string
  role: UserRole
  roleId?: string
  permissions?: string[] // Permissions array from role
  avatar?: string
  // Company isolation fields (populated for company users)
  isSuperAdmin?: boolean
  companyId?: string
  companyRole?: string
  company?: {
    id: string
    companyName: string
    companyCode: string
    status: string
    settings?: {
      logo?: string
      currencyCode?: string
      currencySymbol?: string
    }
  }
}

// Generate or retrieve unique deviceId for this tab/session
const getOrCreateDeviceId = (): string => {
  if (typeof window === "undefined") return ""
  
  let deviceId = sessionStorage.getItem("deviceId")
  if (!deviceId) {
    // Generate a unique deviceId for this tab
    deviceId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    sessionStorage.setItem("deviceId", deviceId)
  }
  return deviceId
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  roleLogin: (username: string, password: string) => Promise<void>
  inviteLogin: (token: string, password: string, username?: string) => Promise<{ message: string }>
  companyLogin: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  loading: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [mounted, setMounted] = React.useState(false)

  const refreshUser = React.useCallback(async () => {
    try {
      const response = await apiService.auth.getMe()
      const userData = response.data as any
      const updatedUser: User = {
        id: userData.id,
        name: userData.name || userData.username || userData.email.split("@")[0],
        username: userData.username,
        email: userData.email,
        role: userData.role,
        roleId: userData.roleId,
        permissions: userData.permissions || [],
        companyId: userData.companyId,
        isSuperAdmin: userData.isSuperAdmin,
        company: userData.company,
      }
      setUser(updatedUser)
      // Use localStorage for persistence across page reloads
      // Only access localStorage after mount to avoid hydration issues
      if (typeof window !== "undefined") {
        localStorage.setItem("erp-user", JSON.stringify(updatedUser))
      }
    } catch (error: any) {
      console.error("Error refreshing user:", error)
      // Only clear session if we get a 401 (unauthorized) - token is actually invalid
      // For other errors (network issues, etc.), keep the user logged in with stored data
      if (error?.response?.status === 401) {
        // Token is invalid, clear everything
        if (typeof window !== "undefined") {
          localStorage.removeItem("token")
          localStorage.removeItem("erp-user")
          localStorage.removeItem("loginTime")
          sessionStorage.removeItem("deviceId")
          sessionStorage.removeItem("lastActivity")
        }
        setUser(null)
      } else {
        // For other errors, keep the stored user data
        // This allows the user to stay logged in even if there's a temporary network issue
        const storedUser = typeof window !== "undefined" ? localStorage.getItem("erp-user") : null
        if (storedUser && storedUser.trim() !== '' && storedUser !== 'null' && storedUser !== 'undefined') {
          try {
            const parsedUser = JSON.parse(storedUser)
            if (parsedUser && typeof parsedUser === 'object') {
              setUser(parsedUser)
            }
          } catch (e) {
            console.error("Error parsing stored user:", e)
            // Clear invalid stored user
            if (typeof window !== "undefined") {
              localStorage.removeItem("erp-user")
            }
          }
        }
      }
    }
  }, [])

  // Mark component as mounted to avoid hydration issues
  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    // Only run after component is mounted (client-side only)
    if (!mounted) {
      setLoading(false)
      return
    }

    // Initialize deviceId for this tab
    getOrCreateDeviceId()
    
    // Check if user is already logged in (using localStorage for persistence)
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("erp-user")
    const loginTime = localStorage.getItem("loginTime")

    // Check for 24-hour session expiration (from login time, not inactivity)
    if (loginTime) {
      const loginTimestamp = parseInt(loginTime, 10)
      const now = Date.now()
      const hoursSinceLogin = (now - loginTimestamp) / (1000 * 60 * 60)
      
      // If 24 hours have passed since login, clear session
      if (hoursSinceLogin >= 24) {
        // Check if user was a role-based user before clearing
        const storedUser = localStorage.getItem("erp-user")
        const isRoleBasedUser = storedUser ? (() => {
          try {
            const parsedUser = JSON.parse(storedUser)
            return parsedUser.role?.toLowerCase() !== "admin"
          } catch {
            return false
          }
        })() : false
        
        localStorage.removeItem("token")
        localStorage.removeItem("erp-user")
        localStorage.removeItem("loginTime")
        sessionStorage.removeItem("deviceId")
        sessionStorage.removeItem("lastActivity")
        setUser(null)
        setLoading(false)
        
        // Redirect based on user type
        if (isRoleBasedUser) {
          window.location.href = "/roles/login"
        } else {
          window.location.href = "/login"
        }
        return
      }
    }

    if (token && storedUser && storedUser.trim() !== '' && storedUser !== 'null' && storedUser !== 'undefined') {
      try {
        const parsedUser = JSON.parse(storedUser)
        // Set user immediately from stored data to avoid redirect on reload
        if (parsedUser && typeof parsedUser === 'object') {
          setUser(parsedUser)
        }
        // Update last activity on mount
        sessionStorage.setItem("lastActivity", Date.now().toString())
        // Set loading to false immediately so components can render
        // Verify token is still valid in the background (non-blocking)
        setLoading(false)
        // Verify token in background - if it fails, refreshUser will handle it
        refreshUser().catch(() => {
          // Error already handled in refreshUser
        })
      } catch (error) {
        console.error("Error parsing stored user:", error)
        // Clear invalid data
        if (typeof window !== "undefined") {
          localStorage.removeItem("token")
          localStorage.removeItem("erp-user")
          localStorage.removeItem("loginTime")
          sessionStorage.removeItem("deviceId")
          sessionStorage.removeItem("lastActivity")
        }
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [mounted, refreshUser])

  // Periodic check for inactivity expiration (every 5 minutes)
  React.useEffect(() => {
    if (!mounted) return

    const checkSessionExpiry = () => {
      const loginTime = localStorage.getItem("loginTime")
      if (loginTime) {
        const loginTimestamp = parseInt(loginTime, 10)
        const now = Date.now()
        const hoursSinceLogin = (now - loginTimestamp) / (1000 * 60 * 60)
        
        // If 24 hours have passed since login, clear session and redirect
        if (hoursSinceLogin >= 24) {
          // Check if user was a role-based user before clearing
          const storedUser = localStorage.getItem("erp-user")
          const isRoleBasedUser = storedUser ? (() => {
            try {
              const parsedUser = JSON.parse(storedUser)
              return parsedUser.role?.toLowerCase() !== "admin"
            } catch {
              return false
            }
          })() : false
          
          localStorage.removeItem("token")
          localStorage.removeItem("erp-user")
          localStorage.removeItem("loginTime")
          sessionStorage.removeItem("deviceId")
          sessionStorage.removeItem("lastActivity")
          setUser(null)
          
          // Redirect based on user type
          if (isRoleBasedUser) {
            window.location.href = "/roles/login"
          } else {
            window.location.href = "/login"
          }
        }
      }
    }

    // Check immediately
    checkSessionExpiry()

    // Check every 5 minutes
    const interval = setInterval(checkSessionExpiry, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [mounted])


  const login = async (email: string, password: string) => {
    try {
      // Only access sessionStorage on client-side
      if (typeof window === "undefined") {
        throw new Error("Login can only be performed on client-side")
      }

      // Get or create deviceId for this tab
      const deviceId = getOrCreateDeviceId()
      
      const response = await apiService.auth.login({ email, password, deviceId })
      const data = response.data as any
      const { token, user: userData, deviceId: returnedDeviceId, csrfToken, sessionId } = data

      // Store deviceId if returned from server
      if (returnedDeviceId) {
        sessionStorage.setItem("deviceId", returnedDeviceId)
      }

      // Store CSRF token and session ID for CSRF protection
      if (csrfToken) {
        sessionStorage.setItem("csrfToken", csrfToken)
      }
      if (sessionId) {
        sessionStorage.setItem("sessionId", sessionId)
      }

      // Store token in localStorage for persistence across reloads
      localStorage.setItem("token", token)
      
      // Store login time for 24-hour session expiration
      localStorage.setItem("loginTime", Date.now().toString())
      
      // Store last activity timestamp (for activity tracking)
      sessionStorage.setItem("lastActivity", Date.now().toString())

      // Store user data in localStorage for persistence
      const userObj: User = {
        id: userData.id,
        name: userData.name || userData.username || userData.email.split("@")[0],
        username: userData.username,
        email: userData.email,
        role: userData.role,
        roleId: userData.roleId,
        permissions: userData.permissions || [],
        companyId: userData.companyId,
        isSuperAdmin: userData.isSuperAdmin,
        company: userData.company,
      }
      setUser(userObj)
      localStorage.setItem("erp-user", JSON.stringify(userObj))

    } catch (error: any) {
      throw error
    }
  }

  const inviteLogin = async (token: string, password: string, username?: string): Promise<{ message: string }> => {
    try {
      // Only access sessionStorage on client-side
      if (typeof window === "undefined") {
        throw new Error("Invite login can only be performed on client-side")
      }

      // Get or create deviceId for this tab
      const deviceId = getOrCreateDeviceId()
      
      const response = await apiService.auth.inviteLogin({ token, password, username, deviceId })
      const data = response.data as any
      const { token: jwtToken, user: userData, message, deviceId: returnedDeviceId, csrfToken, sessionId } = data

      // Store deviceId if returned from server
      if (returnedDeviceId) {
        sessionStorage.setItem("deviceId", returnedDeviceId)
      }

      // Store CSRF token and session ID for CSRF protection
      if (csrfToken) {
        sessionStorage.setItem("csrfToken", csrfToken)
      }
      if (sessionId) {
        sessionStorage.setItem("sessionId", sessionId)
      }

      // Store token in localStorage for persistence across reloads
      localStorage.setItem("token", jwtToken)
      
      // Store login time for 24-hour session expiration
      localStorage.setItem("loginTime", Date.now().toString())
      
      // Store last activity timestamp (for activity tracking)
      sessionStorage.setItem("lastActivity", Date.now().toString())
      
      // Store user data in localStorage for persistence
      const userObj: User = {
        id: userData.id,
        name: userData.username || userData.email.split("@")[0],
        username: userData.username,
        email: userData.email,
        role: userData.role,
        roleId: userData.roleId,
        permissions: userData.permissions || [], // Include permissions
      }
      setUser(userObj)
      localStorage.setItem("erp-user", JSON.stringify(userObj))

      return { message }
    } catch (error: any) {
      throw error
    }
  }

  const roleLogin = async (username: string, password: string) => {
    try {
      // Only access sessionStorage on client-side
      if (typeof window === "undefined") {
        throw new Error("Role login can only be performed on client-side")
      }

      // Get or create deviceId for this tab
      const deviceId = getOrCreateDeviceId()
      
      const response = await apiService.auth.roleLogin({ username, password, deviceId })
      const data = response.data as any
      const { token, user: userData, deviceId: returnedDeviceId, csrfToken, sessionId } = data

      // Store deviceId if returned from server
      if (returnedDeviceId) {
        sessionStorage.setItem("deviceId", returnedDeviceId)
      }

      // Store CSRF token and session ID for CSRF protection
      if (csrfToken) {
        sessionStorage.setItem("csrfToken", csrfToken)
      }
      if (sessionId) {
        sessionStorage.setItem("sessionId", sessionId)
      }

      // Store token in localStorage for persistence across reloads
      localStorage.setItem("token", token)
      
      // Store login time for 24-hour session expiration
      localStorage.setItem("loginTime", Date.now().toString())
      
      // Store last activity timestamp (for activity tracking)
      sessionStorage.setItem("lastActivity", Date.now().toString())

      // Store user data in localStorage for persistence
      const userObj: User = {
        id: userData.id,
        name: userData.username || userData.email.split("@")[0],
        username: userData.username,
        email: userData.email,
        role: userData.role,
        roleId: userData.roleId,
        permissions: userData.permissions || [], // Include permissions
      }
      setUser(userObj)
      localStorage.setItem("erp-user", JSON.stringify(userObj))

    } catch (error: any) {
      throw error
    }
  }

  // Redundant - unified login handles both now
  const companyLogin = async (email: string, password: string) => {
    return login(email, password);
  }

  const logout = () => {
    // Clear localStorage and sessionStorage (only on client-side)
    if (typeof window !== "undefined") {
      const currentUser = user
      localStorage.removeItem("token")
      localStorage.removeItem("erp-user")
      localStorage.removeItem("loginTime")
      const authType = localStorage.getItem("auth-type")
      localStorage.removeItem("auth-type")
      sessionStorage.removeItem("deviceId")
      sessionStorage.removeItem("lastActivity")
      setUser(null)
      
      // Redirect based on user type
      if (currentUser?.companyId) {
        // Company users go to standard login now
        window.location.href = "/login"
      } else if (currentUser && currentUser.role?.toLowerCase() !== "admin") {
        window.location.href = "/roles/login"
      } else {
        window.location.href = "/login"
      }
    } else {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        roleLogin,
        inviteLogin,
        companyLogin,
        logout,
        isAuthenticated: !!user,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
