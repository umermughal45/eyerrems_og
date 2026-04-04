"use client"

import { useMemo, useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Home, Receipt, Wrench, FileText, Loader2, Users, Mail, Phone, Search } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { MyUnitView } from "./my-unit-view"
import { PaymentsView } from "./payments-view"
import { MaintenanceView } from "./maintenance-view"
import { DocumentsView } from "./documents-view"
import { MessagesView } from "./messages-view"
import { TenantDashboard } from "./tenant-dashboard"
import { PaymentHistoryView } from "./payment-history-view"
import { OnlinePaymentView } from "./online-payment-view"
import { TenantLedgerView } from "./tenant-ledger-view"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { apiService } from "@/lib/api"
import { useSearchParams } from "next/navigation"

const DEFAULT_STATS = {
  currentRent: "Rs 0",
  currentRentDesc: "No active lease",
  nextPayment: "N/A",
  nextPaymentDesc: "No upcoming payments",
  maintenanceCount: 0,
  maintenanceDesc: "No requests",
  leaseExpiry: "N/A",
  leaseExpiryDesc: "No active lease",
}

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "Rs 0"
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`
}

export function TenantPortalView() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tenantIdFromQuery = searchParams?.get("tenantId") || null

  const [loading, setLoading] = useState(true)
  const [tenantData, setTenantData] = useState<any>(null)
  const [leaseData, setLeaseData] = useState<any>(null)
  const [stats, setStats] = useState(DEFAULT_STATS)
  const [allTenants, setAllTenants] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const load = async () => {
      await fetchTenantData(tenantIdFromQuery)
      // Also fetch all tenants for the table when no tenant is selected
      if (!tenantIdFromQuery) {
        await fetchAllTenants()
      }
    }
    load()

    const interval = setInterval(() => {
      fetchTenantData(tenantIdFromQuery)
    }, 30000)

    return () => clearInterval(interval)
  }, [tenantIdFromQuery, user])

  const fetchAllTenants = async () => {
    try {
      const tenantsRes = await apiService.tenants.getAll()
      const tenants = Array.isArray((tenantsRes as any)?.data?.data)
        ? (tenantsRes as any).data.data
        : Array.isArray((tenantsRes as any)?.data)
          ? (tenantsRes as any).data
          : []
      setAllTenants(tenants)
    } catch (error) {
      console.error("Error fetching all tenants:", error)
      setAllTenants([])
    }
  }

  const fetchTenantData = async (targetTenantId?: string | null) => {
    try {
      setLoading(true)

      let tenant: any = null

      if (targetTenantId) {
        try {
          const tenantRes = (await apiService.tenants.getById(targetTenantId)) as any
          tenant = tenantRes?.data?.data || tenantRes?.data || null
        } catch (error) {
          console.warn("Unable to fetch tenant by id", error)
        }
      }

      if (!tenant) {
        const tenantsRes = await apiService.tenants.getAll()
        const tenants = Array.isArray((tenantsRes as any)?.data?.data)
          ? (tenantsRes as any).data.data
          : Array.isArray((tenantsRes as any)?.data)
            ? (tenantsRes as any).data
            : []
        if (targetTenantId) {
          tenant = tenants.find((t: any) => String(t.id) === String(targetTenantId))
        }
        if (!tenant && user?.email) {
          tenant = tenants.find((t: any) => (t.email || "").toLowerCase() === (user.email || "").toLowerCase())
        }
      }

      if (!tenant) {
        console.warn("No tenant found for user:", user?.email)
        setTenantData(null)
        setLeaseData(null)
        setStats(DEFAULT_STATS)
        setLoading(false)
        return
      }

      console.log("Tenant found:", tenant.id, tenant.name)

      if (!tenant.unit && tenant.unitId) {
        try {
          const unitRes = (await apiService.units.getById(tenant.unitId)) as any
          const unit = unitRes?.data?.data || unitRes?.data || null
          if (unit) {
            tenant = { ...tenant, unit }
          }
        } catch (error) {
          console.warn("Unable to load tenant unit", error)
        }
      }

      // Fetch tenant-specific data including leases, invoices, and maintenance requests
      try {
        const [leasesRes, invoicesRes, messagesRes] = await Promise.all([
          apiService.leases.getAll(),
          apiService.invoices.getAll(),
          apiService.chat.getMessages()
        ])

        const leases = Array.isArray((leasesRes as any)?.data?.data)
          ? (leasesRes as any).data.data
          : Array.isArray((leasesRes as any)?.data)
            ? (leasesRes as any).data
            : []
        const tenantLeases = leases.filter((l: any) => String(l.tenantId) === String(tenant.id))
        const activeLease =
          tenantLeases.find((l: any) => (l.status || "").toLowerCase() === "active") ||
          tenantLeases.sort(
            (a: any, b: any) => new Date(b.leaseStart || 0).getTime() - new Date(a.leaseStart || 0).getTime()
          )[0]

        const invoices = Array.isArray((invoicesRes as any)?.data?.data)
          ? (invoicesRes as any).data.data
          : Array.isArray((invoicesRes as any)?.data)
            ? (invoicesRes as any).data
            : []
        const tenantInvoices = invoices.filter(
          (inv: any) => String(inv.tenantId || inv.tenant?.id) === String(tenant.id)
        )

        // Filter maintenance requests for this specific tenant
        const allMessages = Array.isArray((messagesRes as any)?.data?.data)
          ? (messagesRes as any).data.data
          : Array.isArray((messagesRes as any)?.data)
            ? (messagesRes as any).data
            : []

        const tenantMaintenanceRequests = allMessages.filter((msg: any) => {
          const content = msg.content || ""
          if (!content.startsWith("[MAINTENANCE]")) return false

          // Enhanced tenant identification for maintenance requests
          const tenantName = (tenant.name || "").toLowerCase()
          const tenantEmail = (tenant.email || "").toLowerCase()
          const tenantUnit = (tenant.unit?.unitName || "").toLowerCase()

          const messageText = content.replace("[MAINTENANCE]", "").toLowerCase()

          return messageText.includes(tenantName) ||
            messageText.includes(tenantEmail) ||
            messageText.includes(tenantUnit) ||
            // Also check if the sender matches the tenant
            (msg.senderEmail && msg.senderEmail.toLowerCase() === tenantEmail)
        })

        const upcomingInvoice = tenantInvoices
          .filter((inv: any) => inv.dueDate && new Date(inv.dueDate).getTime() >= Date.now())
          .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

        const rentValue = Number(
          activeLease?.rent ??
          tenant.unit?.monthlyRent ??
          tenant.unit?.rent ??
          tenantInvoices?.[0]?.amount ??
          tenant.rent ??
          0
        )
        const nextDueDate = upcomingInvoice?.dueDate
          ? new Date(upcomingInvoice.dueDate)
          : activeLease?.leaseStart
            ? new Date(activeLease.leaseStart)
            : null

        const daysUntilDue =
          nextDueDate && Number.isFinite(nextDueDate.getTime())
            ? Math.ceil((nextDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null

        const leaseEndDate = activeLease?.leaseEnd ? new Date(activeLease.leaseEnd) : null
        const monthsRemaining =
          leaseEndDate && Number.isFinite(leaseEndDate.getTime())
            ? Math.max(0, Math.ceil((leaseEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
            : null

        // Count maintenance requests by status for this tenant
        const pendingMaintenance = tenantMaintenanceRequests.filter((req: any) =>
          !req.content.includes("[COMPLETED]") && !req.content.includes("[IN-PROGRESS]")
        ).length
        const inProgressMaintenance = tenantMaintenanceRequests.filter((req: any) =>
          req.content.includes("[IN-PROGRESS]")
        ).length
        const completedMaintenance = tenantMaintenanceRequests.filter((req: any) =>
          req.content.includes("[COMPLETED]")
        ).length

        setTenantData(tenant)
        setLeaseData(activeLease || null)

        setStats({
          currentRent: formatCurrency(rentValue),
          currentRentDesc:
            nextDueDate && Number.isFinite(nextDueDate.getTime())
              ? `Due on ${nextDueDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}`
              : "No upcoming due date",
          nextPayment:
            upcomingInvoice && upcomingInvoice.dueDate
              ? new Date(upcomingInvoice.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
              : "N/A",
          nextPaymentDesc:
            daysUntilDue === null
              ? "No scheduled payments"
              : daysUntilDue > 0
                ? `${daysUntilDue} days remaining`
                : daysUntilDue === 0
                  ? "Due today"
                  : `Overdue by ${Math.abs(daysUntilDue)} days`,
          maintenanceCount: pendingMaintenance,
          maintenanceDesc: tenantMaintenanceRequests.length === 0
            ? "No requests"
            : `${pendingMaintenance} pending, ${completedMaintenance} completed`,
          leaseExpiry:
            leaseEndDate && Number.isFinite(leaseEndDate.getTime())
              ? leaseEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "N/A",
          leaseExpiryDesc:
            monthsRemaining !== null ? `${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"} remaining` : "No lease",
        })
      } catch (dataError) {
        console.error("Error fetching tenant-specific data:", dataError)
        // Set basic stats if data fetching fails
        setTenantData(tenant)
        setLeaseData(null)
        setStats(DEFAULT_STATS)
      }
    } catch (error) {
      console.error("Error fetching tenant data:", error)
      setTenantData(null)
      setLeaseData(null)
      setStats(DEFAULT_STATS)
    } finally {
      setLoading(false)
    }
  }

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th'
    switch (day % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  const tenantStats = [
    {
      name: "Current Rent",
      value: stats.currentRent,
      description: stats.currentRentDesc,
      icon: Home,
      gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
      href: "/details/current-rent",
    },
    {
      name: "Next Payment",
      value: stats.nextPayment,
      description: stats.nextPaymentDesc,
      icon: Receipt,
      gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
      href: "/details/next-payment",
    },
    {
      name: "Maintenance Requests",
      value: stats.maintenanceCount.toString(),
      description: stats.maintenanceDesc,
      icon: Wrench,
      gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
      href: "/details/maintenance-requests",
    },
    {
      name: "Lease Expiry",
      value: stats.leaseExpiry,
      description: stats.leaseExpiryDesc,
      icon: FileText,
      gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
      href: "/details/lease-expiry",
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const filteredTenants = allTenants.filter((tenant) => {
    const name = (tenant.name || "").toLowerCase()
    const email = (tenant.email || "").toLowerCase()
    const phone = (tenant.phone || "").toLowerCase()
    const unitName = (tenant.unit?.unitName || tenant.unit?.unitNumber || "").toLowerCase()
    const propertyName = (tenant.unit?.property?.name || tenant.property?.name || "").toLowerCase()
    const searchLower = searchQuery.toLowerCase()

    return (
      name.includes(searchLower) ||
      email.includes(searchLower) ||
      phone.includes(searchLower) ||
      unitName.includes(searchLower) ||
      propertyName.includes(searchLower)
    )
  })

  const handleTenantClick = (tenantId: string) => {
    router.push(`/tenant?tenantId=${tenantId}`)
  }

  if (!tenantData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground text-balance">Tenant Portal</h1>
          <p className="text-muted-foreground mt-1">
            Select a tenant from the table below to view their details, or sign in with a tenant account.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tenants by name, email, phone, unit, or property..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* All Tenants Table */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">All Tenants</h2>
              <Badge variant="outline">{filteredTenants.length} tenant{filteredTenants.length !== 1 ? 's' : ''}</Badge>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {allTenants.length === 0 ? "No tenants found" : "No tenants match your search"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((tenant) => (
                      <TableRow
                        key={tenant.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleTenantClick(tenant.id)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                              {tenant.name
                                ?.split(" ")
                                .map((n: string) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase() || "?"}
                            </div>
                            <span className="text-foreground">{tenant.name || "N/A"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{tenant.email || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{tenant.phone || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {tenant.unit?.unitName || tenant.unit?.unitNumber || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tenant.unit?.property?.name || tenant.property?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                            {tenant.status || "active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground text-balance">Tenant Portal</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {tenantData?.name || user?.name || "Tenant"}! Manage your rental information and requests.
        </p>
      </div>

      {/* Tenant Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {tenantStats.map((stat) => (
          <Link key={stat.name} href={stat.href}>
            <Card
              className={cn(
                "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
              )}
            >
              <div className="relative p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
                    stat.gradient
                  )}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-slate-200 bg-slate-50 text-slate-600 shadow-sm dark:bg-[#1a3442] dark:text-white dark:ring-white/10",
                    )}
                  >
                    {stat.description}
                  </span>
                </div>
                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.name}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={searchParams?.get("tab") || "dashboard"} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="pay-online">Pay Online</TabsTrigger>
          <TabsTrigger value="payment-history">History</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="unit">My Unit</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <TenantDashboard tenantData={tenantData} leaseData={leaseData} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsView tenantData={tenantData} leaseData={leaseData} />
        </TabsContent>

        <TabsContent value="pay-online">
          <OnlinePaymentView tenantData={tenantData} leaseData={leaseData} />
        </TabsContent>

        <TabsContent value="payment-history">
          <PaymentHistoryView tenantData={tenantData} />
        </TabsContent>

        <TabsContent value="ledger">
          <TenantLedgerView tenantData={tenantData} />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenanceView tenantData={tenantData} onUpdateCount={(count, desc) => {
            setStats(prev => ({ ...prev, maintenanceCount: count, maintenanceDesc: desc }))
          }} />
        </TabsContent>

        <TabsContent value="unit">
          <MyUnitView tenantData={tenantData} leaseData={leaseData} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsView tenantData={tenantData} leaseData={leaseData} />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesView tenantData={tenantData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
