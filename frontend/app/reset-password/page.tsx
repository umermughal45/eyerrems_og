"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, ArrowLeft, Loader2, Building2, ShieldCheck, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

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
      title: "EyerREMS",
      description: "EyerREMS is a real estate management system created by Eyercall that helps manage properties, tenants, finances, and operations efficiently."
    },
    {
      title: "Smart Property Management",
      description: "Our platform helps you manage properties, tenants, finances, and operations from one powerful dashboard."
    }
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [slides.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Mock password reset - in production, this would call an API
    setTimeout(() => {
      setSent(true)
      setLoading(false)
    }, 1000)
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
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-wide text-white">EyerREMS</span>
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

          {/* Secure Access Portal Badge */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-neutral-300 tracking-wider">SECURE ACCESS PORTAL</span>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Reset Password</h1>
            <p className="text-neutral-400 text-sm">We'll help you recover your account.</p>
          </div>

          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300 font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@eyercall.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 focus:bg-neutral-900/80 rounded-lg transition-all"
                    required
                    disabled={loading}
                  />
                </div>
                <p className="text-sm text-neutral-500 mt-2">We'll send you a link to reset your password</p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-white font-medium text-base rounded-lg shadow-lg hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg backdrop-blur-md">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-300 font-medium mb-1">Email Sent Successfully</p>
                    <p className="text-sm text-green-400/80">
                      Password reset link has been sent to your email. Please check your inbox.
                    </p>
                  </div>
                </div>
              </div>
              <Button
                asChild
                className="w-full h-11 text-white font-medium text-base rounded-lg shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <Link href="/login">Return to Login</Link>
              </Button>
            </div>
          )}

          <div className="pt-4 text-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
