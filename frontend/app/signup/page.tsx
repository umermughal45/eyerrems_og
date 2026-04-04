"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ShieldAlert, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export default function SignupPage() {
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
              <div className="absolute top-0 left-0 w-full transition-all duration-700 ease-in-out opacity-100 translate-y-0">
                <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight mb-6 max-w-xl">
                  Smart Property Management
                </h1>
                <p className="text-xl text-white/80 max-w-xl leading-relaxed mb-8">
                  Our platform helps you manage properties, tenants, finances, and operations from one powerful dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel (narrow) — Content only */}
      <div className="flex-1 w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10 bg-[#0B0F19] relative overflow-y-auto">
        {/* Subtle background glow effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-900/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-[400px] space-y-8 bg-white/5 backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-2xl shadow-2xl relative z-10 text-center">
          <div className="flex justify-center lg:hidden mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20">
              <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">Registration Restricted</h2>
            <p className="text-neutral-400 text-sm">
              You cannot create a new account without permission from the administrator.
            </p>
          </div>

          <p className="text-sm text-neutral-500">
            Please contact your system administrator to request access to the platform.
          </p>

          <div className="pt-4 w-full">
            <Link href="/login">
              <Button type="button" className="w-full h-11 text-white font-medium text-base rounded-lg shadow-lg hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 transition-all duration-300">
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
