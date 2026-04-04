"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import {
  Building2, Plus, Shield, Globe, Phone, MapPin, Mail,
  CheckCircle2, XCircle, ChevronRight, X, Eye, EyeOff,
  Users, Settings, Loader2, AlertCircle, RefreshCw
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanySettings {
  currencyCode: string
  currencySymbol: string
  timezone: string
  invoicePrefix: string
  logo?: string | null
}

interface CompanyUserRow {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  lastLoginAt: string | null
}

interface Company {
  id: string
  companyName: string
  companyCode: string
  companyEmail: string | null
  companyPhone: string | null
  companyAddress: string | null
  status: "active" | "suspended"
  createdAt: string
  settings?: CompanySettings | null
  users: CompanyUserRow[]
}

// ─── API helper ──────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '').replace(/\/api$/, '')
  : "http://localhost:5000"

async function apiCall(path: string, options?: RequestInit) {
  const token = localStorage.getItem("token") || ""
  const csrfToken = sessionStorage.getItem("csrfToken") || ""
  const sessionId = sessionStorage.getItem("sessionId") || ""
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
  
  if (csrfToken) headers["x-csrf-token"] = csrfToken
  if (sessionId) headers["X-Session-Id"] = sessionId
  
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers ?? {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Request failed")
  return data
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "suspended" }) {
  return status === "active" ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5">
      <XCircle className="w-3 h-3" /> Suspended
    </span>
  )
}

// ─── Add Company Modal ────────────────────────────────────────────────────────

function AddCompanyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPw, setShowPw] = useState(false)

  const [form, setForm] = useState({
    // Step 1 – Company info
    companyName: "", companyCode: "", companyEmail: "",
    companyPassword: "", 
    companyPhone: "", companyAddress: "", status: "active",
    // Step 2 – Settings
    currencyCode: "PKR", currencySymbol: "Rs",
    timezone: "Asia/Karachi", invoicePrefix: "INV",
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError("")
    setLoading(true)
    try {
      await apiCall("/api/companies", {
        method: "POST",
        body: JSON.stringify(form),
      })
      onSuccess()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full bg-slate-900/60 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all"
  const labelCls = "block text-xs font-medium text-slate-400 mb-1"

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-semibold text-white">Add New Company</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-slate-700/50">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all ${step === s ? "bg-violet-600 text-white" : step > s ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-700 text-slate-500"}`}>
                {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs ${step === s ? "text-white" : "text-slate-500"}`}>
                {s === 1 ? "Company Details" : "Financial Settings"}
              </span>
              {s < 2 && <ChevronRight className="w-3 h-3 text-slate-600" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Company Name *</label>
                  <input id="add-company-name" className={inputCls} placeholder="Acme Corp" value={form.companyName} onChange={e => set("companyName", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Company Code *</label>
                  <input id="add-company-code" className={inputCls} placeholder="ACME" value={form.companyCode} onChange={e => set("companyCode", e.target.value.toUpperCase())} />
                  <p className="text-xs text-slate-500 mt-1">Unique slug</p>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={form.status} onChange={e => set("status", e.target.value)}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Company Account Email *</label>
                  <input className={inputCls} type="email" placeholder="admin@company.com" value={form.companyEmail} onChange={e => set("companyEmail", e.target.value)} />
                  <p className="text-xs text-slate-500 mt-1">This will be the initial login email</p>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Company Account Password *</label>
                  <div className="relative">
                    <input
                      className={inputCls + " pr-10"}
                      type={showPw ? "text" : "password"}
                      placeholder="Initial admin password"
                      value={form.companyPassword}
                      onChange={e => set("companyPassword", e.target.value)}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input className={inputCls} placeholder="+92 300 0000000" value={form.companyPhone} onChange={e => set("companyPhone", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Address</label>
                  <input className={inputCls} placeholder="123 Main St, Karachi" value={form.companyAddress} onChange={e => set("companyAddress", e.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Currency Code</label>
                  <input className={inputCls} placeholder="PKR" value={form.currencyCode} onChange={e => set("currencyCode", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Currency Symbol</label>
                  <input className={inputCls} placeholder="Rs" value={form.currencySymbol} onChange={e => set("currencySymbol", e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Timezone</label>
                  <select className={inputCls} value={form.timezone} onChange={e => set("timezone", e.target.value)}>
                    <option value="Asia/Karachi">Asia/Karachi (PKT +5)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST +4)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Invoice Prefix</label>
                  <input className={inputCls} placeholder="INV" value={form.invoicePrefix} onChange={e => set("invoicePrefix", e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as 1 | 2) : onClose()}
            className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-slate-700"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 1 | 2)}
              disabled={!form.companyName || !form.companyCode || !form.companyEmail || !form.companyPassword}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-5 py-2 transition-all"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              id="add-company-submit"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-5 py-2 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? "Creating…" : "Create Company"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [statusLoading, setStatusLoading] = useState<string | null>(null)

  // Guard: only super admin can access this page
  useEffect(() => {
    if (user && !user.isSuperAdmin) {
      router.replace("/")
    }
  }, [user, router])

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiCall("/api/companies")
      setCompanies(data.companies || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.isSuperAdmin) {
      fetchCompanies()
    }
  }, [user, fetchCompanies])

  const toggleStatus = async (company: Company) => {
    const newStatus = company.status === "active" ? "suspended" : "active"
    setStatusLoading(company.id)
    try {
      await apiCall(`/api/companies/${company.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      })
      setCompanies(prev =>
        prev.map(c => c.id === company.id ? { ...c, status: newStatus as "active" | "suspended" } : c)
      )
    } catch (e: any) {
      alert("Failed to update status: " + e.message)
    } finally {
      setStatusLoading(null)
    }
  }

  // Don't render at all if not super admin
  if (!user?.isSuperAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Companies</h1>
              <p className="text-xs text-slate-400">Manage client companies</p>
            </div>
            <span className="ml-2 inline-flex items-center gap-1 bg-violet-500/10 text-violet-400 border border-violet-500/20 text-xs font-medium rounded-full px-2 py-0.5">
              <Shield className="w-3 h-3" /> Super Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCompanies}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              id="add-company-button"
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-all shadow-lg shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Company
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Companies", value: companies.length, icon: Building2, color: "violet" },
            { label: "Active", value: companies.filter(c => c.status === "active").length, icon: CheckCircle2, color: "emerald" },
            { label: "Suspended", value: companies.filter(c => c.status === "suspended").length, icon: XCircle, color: "red" },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <div className={`w-9 h-9 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && companies.length === 0 && (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">No companies yet.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 text-violet-400 hover:text-violet-300 text-sm underline-offset-2 underline transition-colors">
              Add your first company
            </button>
          </div>
        )}

        {/* Company cards */}
        {!loading && !error && companies.length > 0 && (
          <div className="grid gap-4">
            {companies.map(company => (
              <div key={company.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-violet-400">
                        {company.companyCode.slice(0, 2)}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm">{company.companyName}</h3>
                        <span className="text-xs font-mono bg-slate-700/60 text-slate-400 rounded px-1.5 py-0.5">{company.companyCode}</span>
                        <StatusBadge status={company.status} />
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-slate-400">
                        {company.companyEmail && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{company.companyEmail}</span>
                        )}
                        {company.companyPhone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{company.companyPhone}</span>
                        )}
                        {company.companyAddress && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{company.companyAddress}</span>
                        )}
                        {company.settings && (
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3" />
                            {company.settings.currencySymbol} {company.settings.currencyCode} · {company.settings.timezone}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {company.users.length} user{company.users.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Settings className="w-3 h-3" />
                          Prefix: {company.settings?.invoicePrefix ?? "INV"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => toggleStatus(company)}
                      disabled={statusLoading === company.id}
                      className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-all flex items-center gap-1.5 ${
                        company.status === "active"
                          ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                          : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      } disabled:opacity-50`}
                    >
                      {statusLoading === company.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : company.status === "active" ? (
                        <><XCircle className="w-3 h-3" /> Suspend</>
                      ) : (
                        <><CheckCircle2 className="w-3 h-3" /> Activate</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Users table */}
                {company.users.length > 0 && (
                  <div className="mt-4 border-t border-slate-700/50 pt-4">
                    <p className="text-xs font-medium text-slate-500 mb-2">Users</p>
                    <div className="grid gap-1">
                      {company.users.map(u => (
                        <div key={u.id} className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 rounded-lg px-3 py-1.5">
                          <span className="font-medium text-slate-300">{u.name}</span>
                          <span className="text-slate-500">{u.email}</span>
                          <span className="capitalize bg-slate-700/50 rounded px-2 py-0.5">{u.role}</span>
                          <span className={u.isActive ? "text-emerald-400" : "text-red-400"}>
                            {u.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddCompanyModal
          onClose={() => setShowAdd(false)}
          onSuccess={fetchCompanies}
        />
      )}
    </div>
  )
}
