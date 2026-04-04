"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Building2, Lock, User, Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { apiService } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useSettingsStore } from "@/lib/store/settings-store"

function RoleLoginForm() {
  const { companyName, companyLogo, initialize } = useSettingsStore()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const authContext = useAuth()
  const { toast } = useToast()

  // Carousel logic
  const [currentSlide, setCurrentSlide] = useState(0)
  const slides = [
    {
      title: "Eyercall",
      description: "Eyercall is a web conferencing platform for online meetings, collaboration, and virtual communication.",
      buttonText: "Check out Eyercall",
      buttonLink: "https://eyercall.com"
    },
    {
      title: companyName || "EyerREMS",
      description: `${companyName || "EyerREMS"} is a real estate management system created by Eyercall that helps manage properties, tenants, finances, and operations efficiently.`
    },
    {
      title: "Smart Property Management",
      description: "Our platform helps you manage properties, tenants, finances, and operations from one powerful dashboard."
    }
  ]

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  // Prevent redirects - allow users to stay on login page even if not authenticated
  // This is a login page, so we should not redirect unauthenticated users

  useEffect(() => {
    // Check if token is present in URL (invite link)
    const tokenParam = searchParams.get("token")
    if (tokenParam) {
      setToken(tokenParam)
      
      // Fetch invite link details to auto-fill username and password
      const fetchInviteDetails = async () => {
        try {
          const response = await apiService.auth.getInviteLinkByToken(tokenParam)
          const inviteData = response.data as any
          if (inviteData?.username) {
            setUsername(inviteData.username)
          }
          
          // Check if temporary password is stored in sessionStorage for auto-fill
          // This is stored when admin generates the invite link
          const tempPassword = sessionStorage.getItem(`invite_password_${tokenParam}`)
          if (tempPassword) {
            setPassword(tempPassword)
            // Remove from sessionStorage after first use
            sessionStorage.removeItem(`invite_password_${tokenParam}`)
          }
        } catch (error) {
          console.error("Failed to fetch invite link details:", error)
          // If fetch fails, user can still enter username manually
        }
      }
      
      fetchInviteDetails()
    }

    // Load remembered username and password from localStorage (only if no token)
    if (typeof window !== "undefined" && !tokenParam) {
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
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError("Please enter both username and password")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // If token is present, use invite login, otherwise use role login
      if (token) {
        const result = await authContext.inviteLogin(token, password, username)
        
        toast({
          title: "Success",
          description: result.message || "Login successful",
        })
      } else {
        await authContext.roleLogin(username, password)
        
        toast({
          title: "Success",
          description: "Login successful",
        })
      }
      
      // Handle remember me
      if (rememberMe && typeof window !== "undefined") {
        localStorage.setItem("remembered-role-username", username)
        localStorage.setItem("remembered-role-password", password)
      } else if (typeof window !== "undefined") {
        localStorage.removeItem("remembered-role-username")
        localStorage.removeItem("remembered-role-password")
      }

      router.push("/")
    } catch (err: any) {
      console.error("Login failed:", err)
      
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
      {/* Left Panel (wide) — EYERCALL branding & product information */}
      <div
        className={cn(
          "hidden lg:flex w-1/2 relative overflow-hidden bg-neutral-900"
        )}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out"
          style={{
            backgroundImage: `url('/login-bg.png')`,
          }}
        />
        {/* Dark gradient overlay for readability and premium feel */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-indigo-950/60 to-purple-900/40 opacity-90" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-20 w-full h-full text-white">
          <div>
            <div className="flex items-center gap-3 mb-[20vh]">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                {companyLogo ? (
                  <img src={companyLogo} alt="Logo" className="w-8 h-8 object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-white" />
                )}
              </div>
              <span className="text-2xl font-bold tracking-wide text-white">{companyName || "EyerREMS"}</span>
            </div>

            <div className="relative h-64">
              {slides.map((slide, index) => (
                <div
                  key={index}
                  className={cn(
                    "absolute top-0 left-0 w-full transition-all duration-700 ease-in-out",
                    currentSlide === index
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-4 pointer-events-none"
                  )}
                >
                  <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-6 max-w-xl">
                    {slide.title}
                  </h1>
                  <p className="text-xl text-white/80 max-w-xl leading-relaxed mb-8">
                    {slide.description}
                  </p>

                  {slide.buttonText && slide.buttonLink && (
                    <a
                      href={slide.buttonLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-6 py-3 border border-white/20 hover:border-white/50 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg text-white font-medium transition-all duration-300"
                    >
                      {slide.buttonText}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  currentSlide === index ? "w-8 bg-white" : "w-4 bg-white/30 hover:bg-white/50"
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel (narrow) — Content only */}
      <div className="flex-1 w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-[#0B0F19] relative overflow-y-auto">
        {/* Subtle background glow effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-900/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[400px] space-y-8 bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-2xl shadow-2xl relative z-10">
          <div className="flex justify-center lg:hidden mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome</h1>
            <p className="text-neutral-400 text-sm">
              {token ? "Sign in with your invite link" : "Sign in to your account"}
            </p>
          </div>

          {error && (
            <Alert
              variant="destructive"
              className="bg-red-500/10 border-red-500/50 text-red-200"
            >
              <AlertCircle className="h-4 w-4 text-red-400" />
              <AlertTitle className="text-red-200 font-semibold">Error</AlertTitle>
              <AlertDescription className="text-red-300">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-neutral-300 font-medium">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 focus:bg-neutral-900/80 rounded-lg transition-all"
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300 font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 focus:bg-neutral-900/80 rounded-lg transition-all"
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-1 pb-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked: boolean | "indeterminate") => setRememberMe(checked === true)}
                disabled={loading}
                className="border-white/20 bg-neutral-900/50 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
              />
              <Label
                htmlFor="remember"
                className="text-sm font-medium leading-none text-neutral-400 cursor-pointer"
              >
                Remember username and password
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-white font-medium text-base rounded-lg shadow-lg hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
              disabled={loading || !username || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function RoleLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex bg-white">
          <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-neutral-900">
             <div className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-in-out" style={{ backgroundImage: `url('/login-bg.png')` }} />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-indigo-950/60 to-purple-900/40 opacity-90" />
          </div>
          <div className="flex-1 w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-[#0B0F19] relative overflow-y-auto">
             <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        </div>
      }
    >
      <RoleLoginForm />
    </Suspense>
  )
}

