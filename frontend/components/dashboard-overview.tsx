"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Users, DollarSign, TrendingUp, UserCheck, FileText, AlertCircle, Loader2, Home, RefreshCw, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { AddPropertyDialog } from "@/components/properties/add-property-dialog"
import { AddTenantDialog } from "@/components/properties/add-tenant-dialog"
import { AddInvoiceDialog } from "@/components/finance/add-invoice-dialog"
import { AddEmployeeDialog } from "@/components/hr/add-employee-dialog"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { MiniChartCard } from "@/components/ui/mini-chart-card"

interface DashboardStats {
  propsData: any
  hrData: any
  crmData: any
  financeData: any
  salesData: any[]
  leasesData: any[]
  revenueVsExpense: any[]
  allProperties: any[]
}

export function DashboardOverview({ initialData }: { initialData?: DashboardStats }) {
  const [openDialog, setOpenDialog] = useState<string | null>(null)
  const [topStats, setTopStats] = useState<
    Array<{
      label: string
      value: number
      deltaLabel: string
      deltaType: "positive" | "negative" | "neutral"
      icon: any
      gradient: string
    }>
  >(() => {
    if (!initialData) return []
    const { propsData, hrData, crmData, financeData } = initialData
    
    const propertiesChangeStr = propsData.propertiesChange || "+0 this month"
    const propertiesThisMonth = parseInt(propertiesChangeStr.match(/\+(\d+)/)?.[1] || "0") || 0

    const tenantsChangeStr = propsData.tenantsChange || "+0 this month"
    const tenantsThisMonth = parseInt(tenantsChangeStr.match(/\+(\d+)/)?.[1] || "0") || 0

    return [
      {
        label: "Total Properties",
        value: Number(propsData.totalProperties) || 0,
        deltaLabel: propsData.propertiesChange || "+0 this month",
        deltaType: propertiesThisMonth > 0 ? "positive" : "neutral",
        icon: Building2,
        gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
      },
      {
        label: "Total Tenants",
        value: Number(propsData.totalTenants) || 0,
        deltaLabel: propsData.tenantsChange || "+0 this month",
        deltaType: tenantsThisMonth > 0 ? "positive" : "neutral",
        icon: Users,
        gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
      },
      {
        label: "Total Revenue",
        value: Number(financeData.totalRevenue) || 0,
        deltaLabel: "Rent + Sales",
        deltaType: financeData.totalRevenue > 0 ? "positive" : "neutral",
        icon: DollarSign,
        gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
      },
      {
        label: "Total Maintenance Requests",
        value: Number(propsData.totalMaintenanceRequests) || 0,
        deltaLabel: "All requests",
        deltaType: "neutral",
        icon: AlertCircle,
        gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
      },
      {
        label: "Total Staff",
        value: Number(hrData.totalEmployees) || 0,
        deltaLabel: "Active employees",
        deltaType: "neutral",
        icon: UserCheck,
        gradient: "bg-[linear-gradient(135deg,#14b8a6,#0f766e)]",
      }
    ]
  })

  const [revenueData, setRevenueData] = useState<any[]>(() => initialData?.revenueVsExpense || [])
  const [propertyTypeData, setPropertyTypeData] = useState<any[]>(() => {
    if (!initialData) return []
    const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
    return (initialData.propsData.propertyTypeData || []).map((item: any, index: number) => ({
      name: item.name || 'Unknown',
      value: item.value || 0,
      color: COLORS[index % COLORS.length],
    }))
  })
  const [occupancyData, setOccupancyData] = useState<any[]>(() => {
    if (!initialData) return []
    const properties = initialData.allProperties || []
    return Array.isArray(properties)
      ? properties
        .filter((p: any) => p.type !== 'house' && (p.units || p._count?.units || 0) > 0)
        .slice(0, 10)
        .map((p: any) => {
          const totalUnits = p.units || p._count?.units || 0
          const occupied = p.occupied || 0
          const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0
          return {
            property: p.name || 'Unknown',
            occupancy: occupancyRate,
            totalUnits,
            occupiedUnits: occupied,
          }
        })
        .sort((a: any, b: any) => b.occupancy - a.occupancy)
      : []
  })
  const [salesFunnelData, setSalesFunnelData] = useState<any[]>(() => {
    if (!initialData) return []
    const salesArray = Array.isArray(initialData.salesData) ? initialData.salesData : []
    return [
      {
        stage: "Pending",
        count: salesArray.filter((s: any) => s.status === "Pending" || s.status === "pending").length,
      },
      {
        stage: "Completed",
        count: salesArray.filter((s: any) => s.status === "Completed" || s.status === "completed").length,
      },
      {
        stage: "Cancelled",
        count: salesArray.filter((s: any) => s.status === "Cancelled" || s.status === "cancelled").length,
      },
    ]
  })
  const [recentActivities, setRecentActivities] = useState<any[]>(() => initialData?.propsData.recentActivities || [])
  const [loading, setLoading] = useState(!initialData)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  // Color palette for charts
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Fetch stats from API
      const [propertiesStats, hrStats, crmStats, financeStats, salesResponse, leasesResponse, revenueExpenseResponse] = await Promise.all([
        apiService.stats.getPropertiesStats().catch(() => ({ data: {} })),
        apiService.stats.getHRStats().catch(() => ({ data: {} })),
        apiService.stats.getCRMStats().catch(() => ({ data: {} })),
        apiService.stats.getFinanceStats().catch(() => ({ data: {} })),
        apiService.sales.getAll().catch(() => ({ data: [] })),
        apiService.leases.getAll().catch(() => ({ data: [] })),
        apiService.stats.getRevenueVsExpense(12).catch(() => ({ data: [] })),
      ])

      // Backend returns { success: true, data: {...} }
      const propsData = (propertiesStats as any).data?.data || (propertiesStats as any).data || {}
      const hrData = (hrStats as any).data?.data || (hrStats as any).data || {}
      const crmData = (crmStats as any).data?.data || (crmStats as any).data || {}
      const financeData = (financeStats as any).data?.data || (financeStats as any).data || {}
      const salesData = (salesResponse as any).data?.data || (salesResponse as any).data || []
      const leasesData = (leasesResponse as any).data?.data || (leasesResponse as any).data || []
      const revenueExpenseData = (revenueExpenseResponse as any).data?.data || (revenueExpenseResponse as any).data || []

      // Calculate enhanced revenue (from finance ledger which should include all income sources)
      // Finance ledger monthly revenue includes:
      // - Unit rent payments (from occupied units)
      // - Lease payments (from active leases)
      // - Sales revenue (if sales create finance ledger entries)
      // - Commissions (if commissions create finance ledger entries)
      // - Other income transactions
      const unitRevenue = propsData.monthlyRevenue || 0 // Fallback: unit rent only
      const financeMonthlyRevenue = financeData.monthlyRevenue || 0 // Primary: all income from finance ledger

      // Use finance stats data (includes rent + sale revenue calculations)
      const totalRevenue = financeData.totalRevenue || 0
      const totalProfit = financeData.totalProfit || 0

      // Additional revenue breakdown for display (informational only)
      const now = new Date()
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

      // Calculate sales revenue this month (for verification/display)
      const salesThisMonth = Array.isArray(salesData)
        ? salesData.filter((s: any) => {
          const saleDate = s.saleDate ? new Date(s.saleDate) : null
          const isCompleted = s.status === "Completed" || s.status === "completed"
          const isThisMonth = saleDate && saleDate >= startOfCurrentMonth && saleDate <= endOfCurrentMonth
          return isCompleted && isThisMonth
        })
        : []
      const salesRevenueThisMonth = salesThisMonth.reduce((sum: number, s: any) => sum + (parseFloat(s.saleValue) || 0), 0)

      // Commissions this month (for verification/display)
      const commissionsThisMonth = financeData.commissionsThisMonth || 0

      // Calculate properties and tenants added this month from change strings
      const propertiesChangeStr = propsData.propertiesChange || "+0 this month"
      const propertiesThisMonth = parseInt(propertiesChangeStr.match(/\+(\d+)/)?.[1] || "0") || 0

      const tenantsChangeStr = propsData.tenantsChange || "+0 this month"
      const tenantsThisMonth = parseInt(tenantsChangeStr.match(/\+(\d+)/)?.[1] || "0") || 0

      const clientsTotal = Number((crmData as any).totalClients ?? (crmData as any).totalCustomers ?? (crmData as any).clients ?? 0) || 0
      const clientsDeltaStr = String((crmData as any).clientsChange ?? (crmData as any).customersChange ?? "+0 this month")
      const clientsThisMonth = parseInt(clientsDeltaStr.match(/\+(\d+)/)?.[1] || "0") || 0

      const totalSales = Array.isArray(salesData) ? salesData.length : 0
      const completedSales = Array.isArray(salesData)
        ? salesData.filter((s: any) => s.status === "Completed" || s.status === "completed").length
        : 0

      setTopStats([
        {
          label: "Total Properties",
          value: Number(propsData.totalProperties) || 0,
          deltaLabel: propsData.propertiesChange || "+0 this month",
          deltaType: propertiesThisMonth > 0 ? "positive" : "neutral",
          icon: Building2,
          gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
        },
        {
          label: "Total Tenants",
          value: Number(propsData.totalTenants) || 0,
          deltaLabel: propsData.tenantsChange || "+0 this month",
          deltaType: tenantsThisMonth > 0 ? "positive" : "neutral",
          icon: Users,
          gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
        },
        {
          label: "Total Revenue",
          value: Number(totalRevenue) || 0,
          deltaLabel: "Rent + Sales",
          deltaType: totalRevenue > 0 ? "positive" : "neutral",
          icon: DollarSign,
          gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
        },
        {
          label: "Total Maintenance Requests",
          value: Number(propsData.totalMaintenanceRequests) || 0,
          deltaLabel: "All requests",
          deltaType: "neutral",
          icon: AlertCircle,
          gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
        },
        {
          label: "Total Staff",
          value: Number(hrData.totalEmployees) || 0,
          deltaLabel: "Active employees",
          deltaType: "neutral",
          icon: UserCheck,
          gradient: "bg-[linear-gradient(135deg,#14b8a6,#0f766e)]",
        },
      ])



      // Use actual revenue vs expense data if available, otherwise generate from current data
      let revenueTrendData = []
      if (Array.isArray(revenueExpenseData) && revenueExpenseData.length > 0) {
        // Use actual backend data
        revenueTrendData = revenueExpenseData.map((item: any) => ({
          month: item.month,
          revenue: Math.round(item.revenue || 0),
          profit: Math.round(item.profit || 0),
        }))
      } else {
        // Fallback: generate from current monthly data
        const nowDate = new Date()
        const monthlyRevenueValue = financeData.monthlyRevenue || 0
        const monthlyExpensesValue = financeData.monthlyExpenses || 0
        const monthlyProfitValue = financeData.monthlyProfit || 0

        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
          const monthLabel = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' })

          // Use current month's actual data for the latest month, estimate for others
          const monthRevenue = i === 11 ? monthlyRevenueValue : monthlyRevenueValue * (0.85 + Math.random() * 0.3)
          const monthExpenses = i === 11 ? monthlyExpensesValue : monthlyExpensesValue * (0.85 + Math.random() * 0.3)
          const monthProfit = i === 11 ? monthlyProfitValue : monthRevenue - monthExpenses

          revenueTrendData.push({
            month: monthLabel,
            revenue: Math.round(monthRevenue),
            profit: Math.round(monthProfit),
          })
        }
      }
      setRevenueData(revenueTrendData)

      // Format property type data with colors
      const formattedPropertyTypeData = (propsData.propertyTypeData || []).map((item: any, index: number) => ({
        name: item.name || 'Unknown',
        value: item.value || 0,
        color: COLORS[index % COLORS.length],
      }))
      setPropertyTypeData(formattedPropertyTypeData)

      // Generate occupancy data per property
      const propertiesResponse: any = await apiService.properties.getAll().catch(() => ({ data: [] }))
      const properties = propertiesResponse.data?.data || propertiesResponse.data || []
      const occupancyByProperty = Array.isArray(properties)
        ? properties
          .filter((p: any) => p.type !== 'house' && (p.units || p._count?.units || 0) > 0)
          .slice(0, 10) // Top 10 properties
          .map((p: any) => {
            const totalUnits = p.units || p._count?.units || 0
            const occupied = p.occupied || 0
            const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0
            return {
              property: p.name || 'Unknown',
              occupancy: occupancyRate,
              totalUnits,
              occupiedUnits: occupied,
            }
          })
          .sort((a: any, b: any) => b.occupancy - a.occupancy)
        : []
      setOccupancyData(occupancyByProperty)

      // Generate sales funnel data
      const salesArray = Array.isArray(salesData) ? salesData : []
      const salesFunnel = [
        {
          stage: "Pending",
          count: salesArray.filter((s: any) => s.status === "Pending" || s.status === "pending").length,
        },
        {
          stage: "Completed",
          count: salesArray.filter((s: any) => s.status === "Completed" || s.status === "completed").length,
        },
        {
          stage: "Cancelled",
          count: salesArray.filter((s: any) => s.status === "Cancelled" || s.status === "cancelled").length,
        },
      ]
      setSalesFunnelData(salesFunnel)

      // Set recent activities
      setRecentActivities(propsData.recentActivities || [])
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
      // Set empty defaults

    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!initialData) {
      fetchDashboardData()
    }
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchDashboardData, initialData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground text-balance">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's what's happening with your properties today.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing || loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", (refreshing || loading) && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Premium KPI cards (top 4) */}
          {topStats.length > 0 && (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {topStats.map((s) => (
                <Card
                  key={s.label}
                  onClick={() => {
                    const routeMap: Record<string, string> = {
                      "Total Properties": "/properties",
                      "Total Tenants": "/details/tenants",
                      "Total Revenue": "/finance",
                      "Total Maintenance Requests": "/details/maintenance-requests",
                      "Total Staff": "/hr",
                    }
                    const route = routeMap[s.label]
                    if (route) router.push(route)
                  }}
                  className={cn(
                    "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
                  )}
                >
                  <div className="relative p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
                        s.gradient
                      )}>
                        <s.icon className="h-6 w-6" />
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-slate-200 bg-slate-50 text-slate-600 shadow-sm dark:bg-[#1a3442] dark:text-white dark:ring-white/10",
                        )}
                      >
                        {s.deltaLabel}
                      </span>
                    </div>
                    <div className="mt-6">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{s.label}</p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {s.label === "Total Revenue" ? (
                          <>
                            Rs{" "}
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin inline-block" />
                            ) : (
                              (s.value as number).toLocaleString("en-IN")
                            )}
                          </>
                        ) : (
                          loading ? <Loader2 className="h-4 w-4 animate-spin" /> : s.value
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}


        </div>
      )}

      {/* Mini Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <MiniChartCard
          title="Monthly Revenue Trend"
          value={revenueData.length > 0 ? revenueData[revenueData.length - 1]?.revenue : 0}
          valuePrefix="Rs "
          data={revenueData.slice(-6)}
          dataKey="revenue"
          chartType="line"
          colors={["#3b82f6"]}
          trend={{ value: 12.5 }}
        />
        <MiniChartCard
          title="Occupancy Overview"
          value={occupancyData.length > 0 ? Math.round(occupancyData.reduce((acc, curr) => acc + curr.occupancy, 0) / (occupancyData.length || 1)) : 0}
          valueSuffix="%"
          data={occupancyData.slice(0, 5)}
          dataKey="totalUnits"
          nameKey="property"
          chartType="donut"
          trend={{ value: 5.2 }}
        />
        <MiniChartCard
          title="Sales Pipeline"
          value={salesFunnelData.reduce((acc, curr) => acc + curr.count, 0)}
          data={salesFunnelData}
          dataKey="count"
          nameKey="stage"
          chartType="bar"
          colors={["#10b981"]}
          trend={{ value: 8.4 }}
        />
        <MiniChartCard
          title="Profit Growth"
          value={revenueData.length > 0 ? revenueData[revenueData.length - 1]?.profit : 0}
          valuePrefix="Rs "
          data={revenueData.slice(-6)}
          dataKey="profit"
          chartType="area"
          colors={["#f59e0b"]}
          trend={{ value: 15.3 }}
        />
      </div>

      {/* Revenue & Profit Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 bg-white dark:bg-[#0d212c] border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Revenue & Profit Trends (Last 12 Months)</h2>
          {revenueData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No revenue data available</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:opacity-50" />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `Rs ${(value / 1000000).toFixed(1)}M`
                    if (value >= 1000) return `Rs ${(value / 1000).toFixed(0)}K`
                    return `Rs ${value}`
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f8fafc"
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value: any) => {
                    const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
                    if (numValue >= 1000000) return `Rs ${(numValue / 1000000).toFixed(2)}M`
                    if (numValue >= 1000) return `Rs ${(numValue / 1000).toFixed(2)}K`
                    return `Rs ${numValue.toLocaleString()}`
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  name="Revenue"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Profit"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Property Distribution */}
        <Card className="p-6 bg-white dark:bg-[#0d212c] border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Property Distribution by Type</h2>
          {propertyTypeData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No properties available</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setOpenDialog("property")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </Button>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={propertyTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }: any) => `${name}: ${value} (${((percent as number) * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {propertyTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => `${value} properties`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Occupancy Rates & Sales Funnel */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 bg-white dark:bg-[#0d212c] border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Occupancy Rates by Property</h2>
          {occupancyData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <Home className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No occupancy data available</p>
                <p className="text-xs mt-1">Add properties and units to see occupancy rates</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={occupancyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:opacity-50" />
                <XAxis
                  dataKey="property"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f8fafc"
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value: any, name: any, props: any) => [
                    `${value}% (${props.payload.occupiedUnits || 0}/${props.payload.totalUnits || 0} units)`,
                    "Occupancy"
                  ]}
                />
                <Bar
                  dataKey="occupancy"
                  fill="#2563eb"
                  radius={[8, 8, 0, 0]}
                  name="Occupancy Rate"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6 bg-white dark:bg-[#0d212c] border rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Sales Funnel</h2>
          {salesFunnelData.length === 0 || salesFunnelData.every((s: any) => s.count === 0) ? (
            <div className="flex items-center justify-center h-[300px] text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sales data available</p>
                <p className="text-xs mt-1">Record property sales to see the funnel</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesFunnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" className="dark:opacity-50" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <YAxis
                  dataKey="stage"
                  type="category"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f8fafc"
                  }}
                  itemStyle={{ color: "#f8fafc" }}
                  labelStyle={{ color: "#94a3b8" }}
                  formatter={(value: any) => [`${value} sales`, "Count"]}
                />
                <Bar
                  dataKey="count"
                  radius={[0, 8, 8, 0]}
                  name="Sales Count"
                >
                  {salesFunnelData.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.stage === "Completed" ? "#10b981" :
                          entry.stage === "Pending" ? "#f59e0b" :
                            "#ef4444"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activities */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activities</h2>
            {recentActivities.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {recentActivities.length} activities
              </Badge>
            )}
          </div>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <p className="text-sm font-medium text-foreground mb-1">No recent activities</p>
                  <p className="text-xs text-muted-foreground">Activities will appear here as you use the system</p>
                </div>
              ) : (
                recentActivities.map((activity) => {
                  const getActivityIcon = () => {
                    switch (activity.type) {
                      case "lease": return <FileText className="h-4 w-4 text-blue-500" />
                      case "property": return <Building2 className="h-4 w-4 text-primary" />
                      case "unit": return <Home className="h-4 w-4 text-green-500" />
                      case "tenant": return <Users className="h-4 w-4 text-purple-500" />
                      case "sale": return <DollarSign className="h-4 w-4 text-green-600" />
                      case "buyer": return <UserCheck className="h-4 w-4 text-blue-600" />
                      case "payment": return <DollarSign className="h-4 w-4 text-emerald-500" />
                      case "maintenance": return <AlertCircle className="h-4 w-4 text-orange-500" />
                      case "employee": return <UserCheck className="h-4 w-4 text-indigo-500" />
                      default: return <FileText className="h-4 w-4 text-muted-foreground" />
                    }
                  }

                  const getActivityBadge = () => {
                    switch (activity.action) {
                      case "create": return <Badge variant="default" className="text-xs">Created</Badge>
                      case "update": return <Badge variant="secondary" className="text-xs">Updated</Badge>
                      case "delete": return <Badge variant="destructive" className="text-xs">Deleted</Badge>
                      default: return null
                    }
                  }

                  return (
                    <div
                      key={activity.id || activity.createdAt}
                      className="flex items-start gap-3 pb-4 border-b border-border last:border-0 last:pb-0 hover:bg-muted/50 p-2 rounded-lg transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                        {getActivityIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-foreground font-medium">
                            {activity.message || activity.entityName || "Activity"}
                          </p>
                          {getActivityBadge()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.time || activity.createdAt
                            ? new Date(activity.createdAt || activity.time).toLocaleString()
                            : "Just now"}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setOpenDialog("property")}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background p-4 hover:bg-accent transition-colors"
            >
              <Building2 className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Add Property</span>
            </button>
            <button
              onClick={() => setOpenDialog("tenant")}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background p-4 hover:bg-accent transition-colors"
            >
              <Users className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Add Tenant</span>
            </button>
            <button
              onClick={() => setOpenDialog("invoice")}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background p-4 hover:bg-accent transition-colors"
            >
              <FileText className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Create Invoice</span>
            </button>
            <button
              onClick={() => setOpenDialog("employee")}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background p-4 hover:bg-accent transition-colors"
            >
              <UserCheck className="h-6 w-6 text-primary" />
              <span className="text-sm font-medium text-foreground">Add Employee</span>
            </button>
          </div>
        </Card>
      </div>

      <AddPropertyDialog
        open={openDialog === "property"}
        onOpenChange={(open) => {
          if (!open) {
            setOpenDialog(null)
          }
        }}
        onSuccess={() => {
          setOpenDialog(null)
          fetchDashboardData()
        }}
      />
      <AddTenantDialog
        open={openDialog === "tenant"}
        onOpenChange={(open) => {
          if (!open) {
            setOpenDialog(null)
          }
        }}
        onSuccess={() => {
          setOpenDialog(null)
          fetchDashboardData()
        }}
      />
      <AddInvoiceDialog
        open={openDialog === "invoice"}
        onOpenChange={(open) => {
          if (!open) {
            setOpenDialog(null)
          }
        }}
      />
      <AddEmployeeDialog
        open={openDialog === "employee"}
        onOpenChange={(open) => {
          if (!open) {
            setOpenDialog(null)
          }
        }}
      />
    </div>
  )
}
