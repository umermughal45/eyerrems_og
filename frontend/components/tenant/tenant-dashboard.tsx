"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  DollarSign, 
  Calendar, 
  AlertCircle, 
  Home, 
  FileText, 
  Wrench,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Bell
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface DashboardStats {
  currentRent: number
  overdueRent: number
  nextDueDate: string | null
  outstandingBalance: number
  leaseExpiryDays: number | null
  pendingTickets: number
  lastInvoices: any[]
  paymentStatusTimeline: any[]
}

export function TenantDashboard({ tenantData, leaseData }: { tenantData: any; leaseData: any }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>({
    currentRent: 0,
    overdueRent: 0,
    nextDueDate: null,
    outstandingBalance: 0,
    leaseExpiryDays: null,
    pendingTickets: 0,
    lastInvoices: [],
    paymentStatusTimeline: []
  })
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [propertyManager, setPropertyManager] = useState<any>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [tenantData, leaseData])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      if (!tenantData?.id) return

      // Try to fetch from tenant portal API first
      try {
        const dashboardRes = await apiService.tenantPortal.getDashboard(tenantData.id)
        const dashboardData = (dashboardRes as any)?.data?.data || (dashboardRes as any)?.data
        
        if (dashboardData) {
          setStats({
            currentRent: dashboardData.stats?.currentRent || 0,
            overdueRent: dashboardData.stats?.overdueRent || 0,
            nextDueDate: dashboardData.stats?.nextDueDate || null,
            outstandingBalance: dashboardData.stats?.outstandingBalance || 0,
            leaseExpiryDays: dashboardData.stats?.leaseExpiryDays || null,
            pendingTickets: dashboardData.stats?.pendingTickets || 0,
            lastInvoices: dashboardData.lastInvoices || [],
            paymentStatusTimeline: dashboardData.paymentStatusTimeline || []
          })
          setAnnouncements(dashboardData.announcements || [])
          setLoading(false)
          return
        }
      } catch (e) {
        console.warn("Tenant portal API not available, falling back to manual fetch:", e)
      }

      // Fallback: Fetch invoices manually
      const invoicesRes = await apiService.invoices.getAll()
      const allInvoices = Array.isArray((invoicesRes as any)?.data?.data)
        ? (invoicesRes as any).data.data
        : Array.isArray((invoicesRes as any)?.data)
          ? (invoicesRes as any).data
          : []
      
      const tenantInvoices = allInvoices.filter((inv: any) => inv.tenantId === tenantData.id)
      
      // Calculate current rent (from active lease)
      const currentRent = leaseData?.rent || 0
      
      // Find overdue invoices
      const now = new Date()
      const overdueInvoices = tenantInvoices.filter((inv: any) => {
        const dueDate = new Date(inv.dueDate)
        return dueDate < now && inv.status !== "paid" && inv.status !== "Paid"
      })
      const overdueRent = overdueInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.totalAmount || inv.amount || 0) - Number(inv.remainingAmount || 0)), 0)
      
      // Find next due date
      const upcomingInvoices = tenantInvoices
        .filter((inv: any) => {
          const dueDate = new Date(inv.dueDate)
          return dueDate >= now && inv.status !== "paid" && inv.status !== "Paid"
        })
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      
      const nextDueDate = upcomingInvoices.length > 0 ? upcomingInvoices[0].dueDate : null
      
      // Calculate outstanding balance
      const unpaidInvoices = tenantInvoices.filter((inv: any) => 
        inv.status !== "paid" && inv.status !== "Paid"
      )
      const outstandingBalance = unpaidInvoices.reduce((sum: number, inv: any) => 
        sum + Number(inv.remainingAmount || inv.totalAmount || inv.amount || 0), 0
      )
      
      // Calculate lease expiry
      let leaseExpiryDays = null
      if (leaseData?.leaseEnd) {
        const leaseEnd = new Date(leaseData.leaseEnd)
        const daysDiff = Math.ceil((leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        leaseExpiryDays = daysDiff
      }
      
      // Fetch maintenance tickets
      try {
        const ticketsRes = await apiService.maintenanceTickets?.getAll?.() || { data: { data: [] } }
        const allTickets = Array.isArray((ticketsRes as any)?.data?.data)
          ? (ticketsRes as any).data.data
          : Array.isArray((ticketsRes as any)?.data)
            ? (ticketsRes as any).data
            : []
        const pendingTickets = allTickets.filter((t: any) => 
          t.tenantId === tenantData.id && 
          (t.status === "open" || t.status === "in-progress")
        ).length
      } catch (e) {
        console.warn("Could not fetch tickets:", e)
      }
      
      // Get last 3 invoices
      const lastInvoices = tenantInvoices
        .sort((a: any, b: any) => new Date(b.billingDate || b.dueDate).getTime() - new Date(a.billingDate || a.dueDate).getTime())
        .slice(0, 3)
      
      // Payment status timeline (last 6 months)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const recentInvoices = tenantInvoices
        .filter((inv: any) => new Date(inv.billingDate || inv.dueDate) >= sixMonthsAgo)
        .sort((a: any, b: any) => new Date(a.billingDate || a.dueDate).getTime() - new Date(b.billingDate || b.dueDate).getTime())
        .slice(0, 6)
      
      setStats({
        currentRent,
        overdueRent,
        nextDueDate,
        outstandingBalance,
        leaseExpiryDays,
        pendingTickets: 0, // Will be updated when tickets API is ready
        lastInvoices,
        paymentStatusTimeline: recentInvoices
      })
      
      // Fetch announcements
      try {
        const announcementsRes = await apiService.announcements?.getAll?.() || { data: { data: [] } }
        const allAnnouncements = Array.isArray((announcementsRes as any)?.data?.data)
          ? (announcementsRes as any).data.data
          : Array.isArray((announcementsRes as any)?.data)
            ? (announcementsRes as any).data
            : []
        
        // Filter active announcements for this tenant
        const activeAnnouncements = allAnnouncements.filter((ann: any) => {
          if (!ann.isActive) return false
          if (ann.expiresAt && new Date(ann.expiresAt) < new Date()) return false
          if (ann.targetAudience === "all") return true
          if (ann.targetAudience === "specific-tenants") {
            const targetIds = Array.isArray(ann.targetTenantIds) ? ann.targetTenantIds : []
            return targetIds.includes(tenantData.id)
          }
          return false
        })
        setAnnouncements(activeAnnouncements.slice(0, 5))
      } catch (e) {
        console.warn("Could not fetch announcements:", e)
      }
      
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Announcements */}
      {announcements.length > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Announcements</h3>
              <div className="space-y-2">
                {announcements.map((ann: any) => (
                  <div key={ann.id} className="text-sm">
                    <p className="font-medium text-foreground">{ann.title}</p>
                    <p className="text-muted-foreground mt-1">{ann.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Current Rent</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(stats.currentRent)}
            </p>
            {leaseData && (
              <p className="text-xs text-muted-foreground mt-1">
                Due on {new Date(leaseData.leaseStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Overdue Rent</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(stats.overdueRent)}
            </p>
            {stats.overdueRent > 0 && (
              <Badge variant="destructive" className="mt-2">Action Required</Badge>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Next Due Date</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.nextDueDate 
                ? new Date(stats.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : "N/A"
              }
            </p>
            {stats.nextDueDate && (
              <p className="text-xs text-muted-foreground mt-1">
                {Math.ceil((new Date(stats.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <TrendingUp className="h-6 w-6 text-warning" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Outstanding Balance</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatCurrency(stats.outstandingBalance)}
            </p>
            {stats.outstandingBalance > 0 && (
              <Link href="/tenant?tab=payments">
                <Button variant="link" size="sm" className="mt-2 p-0 h-auto">
                  View Details →
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>

      {/* Lease Expiry & Unit Details */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Lease Expiry</h3>
          </div>
          {leaseData ? (
            <div>
              <p className="text-3xl font-bold text-foreground">
                {stats.leaseExpiryDays !== null 
                  ? `${stats.leaseExpiryDays} days`
                  : "N/A"
                }
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Lease ends on {new Date(leaseData.leaseEnd).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
              {stats.leaseExpiryDays !== null && stats.leaseExpiryDays < 30 && (
                <Badge variant="outline" className="mt-3 border-warning text-warning">Renewal Required Soon</Badge>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No active lease</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Home className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Unit Details</h3>
          </div>
          {tenantData?.unit ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Unit</p>
                <p className="font-medium text-foreground">{tenantData.unit.unitName}</p>
              </div>
              {tenantData.unit.property && (
                <div>
                  <p className="text-sm text-muted-foreground">Property</p>
                  <p className="font-medium text-foreground">{tenantData.unit.property.name}</p>
                </div>
              )}
              <Link href="/tenant?tab=unit">
                <Button variant="link" size="sm" className="mt-2 p-0 h-auto">
                  View Full Details →
                </Button>
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground">No unit assigned</p>
          )}
        </Card>
      </div>

      {/* Pending Maintenance & Last Invoices */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Pending Maintenance</h3>
            </div>
            <Link href="/tenant?tab=maintenance">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-muted-foreground">
              {stats.pendingTickets > 0 
                ? `${stats.pendingTickets} pending ticket${stats.pendingTickets > 1 ? 's' : ''}`
                : "No pending tickets"
              }
            </p>
            <Link href="/tenant?tab=maintenance">
              <Button variant="outline" className="mt-4">
                Submit Request
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Recent Invoices</h3>
            </div>
            <Link href="/tenant?tab=payments">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          {stats.lastInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices found</p>
          ) : (
            <div className="space-y-3">
              {stats.lastInvoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-foreground">
                      {inv.invoiceNumber || `Invoice #${inv.id.slice(0, 8)}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(inv.billingDate || inv.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {formatCurrency(inv.totalAmount || inv.amount || 0)}
                    </p>
                    <Badge 
                      variant={
                        inv.status === "paid" || inv.status === "Paid" 
                          ? "default" 
                          : inv.status === "overdue"
                          ? "destructive"
                          : "outline"
                      }
                      className="mt-1"
                    >
                      {inv.status || "unpaid"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Payment Status Timeline */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Payment Status Timeline</h3>
        {stats.paymentStatusTimeline.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No payment history available</p>
        ) : (
          <div className="space-y-4">
            {stats.paymentStatusTimeline.map((inv: any, index: number) => {
              const isPaid = inv.status === "paid" || inv.status === "Paid"
              const isOverdue = new Date(inv.dueDate) < new Date() && !isPaid
              
              return (
                <div key={inv.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      isPaid ? "bg-success/10" : isOverdue ? "bg-destructive/10" : "bg-muted"
                    }`}>
                      {isPaid ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : isOverdue ? (
                        <XCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {index < stats.paymentStatusTimeline.length - 1 && (
                      <div className="h-12 w-0.5 bg-border mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(inv.billingDate || inv.dueDate).toLocaleDateString('en-US', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(inv.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          {formatCurrency(inv.totalAmount || inv.amount || 0)}
                        </p>
                        <Badge 
                          variant={isPaid ? "default" : isOverdue ? "destructive" : "outline"}
                          className="mt-1"
                        >
                          {isPaid ? "Paid" : isOverdue ? "Overdue" : "Pending"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

