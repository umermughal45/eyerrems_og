"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Building2, Lock, User, Loader2, AlertCircle, ShieldCheck, PieChart } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

import { useSettingsStore } from "@/lib/store/settings-store"

export default function RoleLoginPage() {
  const { companyName, companyLogo, initialize } = useSettingsStore()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleName, setRoleName] = useState<string | null>(null)
  const router = useRouter()
  const { roleLogin } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const token = urlParams.get("token")

      if (token) {
        // Handle invite link token
        const fetchInviteDetails = async () => {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL 
              ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '').replace(/\/api$/, '') 
              : "http://localhost:5000"
              
            const response = await fetch(`${baseUrl}/api/roles/invite/${token}`)
            if (response.ok) {
              const data = await response.json()
              if (data.username) setUsername(data.username)
              if (data.roleName) setRoleName(data.roleName)
              
              // Check sessionStorage for temporarily stored password if Admin directly copied the link
              const storedPassword = sessionStorage.getItem(`invite_password_${token}`)
              if (storedPassword) {
                setPassword(storedPassword)
              }
            }
          } catch (err) {
            console.error("Failed to fetch invite token details", err)
          }
        }
        fetchInviteDetails()
      } else {
        // Load remembered credentials
        const rememberedUsername = localStorage.getItem("remembered-role-username")
        const rememberedPassword = localStorage.getItem("remembered-role-password")
        if (rememberedUsername) {
          setUsername(rememberedUsername)
          setRememberMe(true)
        }
        if (rememberedPassword && rememberedUsername) {
          setPassword(rememberedPassword)
        }
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError("Please enter both username and password")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await roleLogin(username, password)
      
      // Handle remember me
      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("remembered-role-username", username)
        localStorage.setItem("remembered-role-password", password)
      } else if (typeof window !== "undefined") {
        localStorage.removeItem("remembered-role-username")
        localStorage.removeItem("remembered-role-password")
      }
      
      toast({
        title: "Success",
        description: "Login successful",
      })

      router.push("/")
    } catch (err: any) {
      console.error("Role login failed:", err)
      
      // Handle device approval pending error
      if (err.message && err.message.includes("Device approval")) {
        setError(err.message)
        toast({
          title: "Device Approval Required",
          description: err.message,
          variant: "default",
        })
        return
      }
      
      const errorMessage =
        err.response?.data?.message || err.response?.data?.error || err.message || "Login failed"
      setError(errorMessage)
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Info Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-neutral-50 border-r border-neutral-200">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 mb-8">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo" className="h-12 w-12 object-contain" />
            ) : (
              <Building2 className="h-12 w-12 text-primary" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-neutral-900 mb-4">{companyName || "Real Estate ERP"}</h2>
          <p className="text-neutral-600 max-w-md text-lg leading-relaxed">
            Streamline your property management, payroll, and HR operations with our comprehensive enterprise solution.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col items-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-neutral-900">Secure Access</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col items-center">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <PieChart className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-neutral-900">Analytics</span>
            </div>
          </div>
        </div>
        
        {/* Decorative Pattern */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/50 to-transparent" />
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Role Login</h1>
            <p className="mt-2 text-neutral-500">
              {roleName 
                ? `Sign in to access your ${roleName} portal`
                : "Sign in to your account with your role credentials"}
            </p>
          </div>

          {error && (
            <Alert 
              variant={error.includes("Device approval") || error.includes("pending") ? "default" : "destructive"} 
              className="mb-4"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {error.includes("Device approval") || error.includes("pending") 
                  ? "Device Approval Required" 
                  : "Error"}
              </AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-neutral-700 font-medium">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 border-neutral-200 focus:border-primary focus:ring-primary/20 transition-all bg-white"
                    required
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-700 font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 border-neutral-200 focus:border-primary focus:ring-primary/20 transition-all bg-white"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked: boolean | "indeterminate") => setRememberMe(checked === true)}
                disabled={loading}
                className="border-neutral-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal text-neutral-600 cursor-pointer select-none"
              >
                Remember username and password
              </Label>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 text-white font-medium text-base shadow-sm transition-all" 
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-neutral-500">
            Admin?{" "}
            <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
              Login here
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

