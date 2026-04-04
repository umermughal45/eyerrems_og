"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Users,
  DollarSign,
  Home,
  Filter,
  MoreVertical,
  Edit,
  FileText,
  Trash2,
  Eye,
  ShoppingCart,
  KeyRound,
  Loader2,
  Download,
} from "lucide-react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { AddPropertyDialog } from "./add-property-dialog"
import { PropertyDeleteDialog } from "./property-delete-dialog"
import { EditStatusDialog } from "./edit-status-dialog"
import { PropertyStructureSetupDialog } from "./property-structure-setup-dialog"
import { UnitsView } from "./units-view"
import { TenantsView } from "./tenants-view"
import { LeasesView } from "./leases-view"
import { SalesView } from "./sales-view"
import { BuyersView } from "./buyers-view"
import { SellersView } from "./sellers-view"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toSimpleFilters, toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { apiService } from "@/lib/api"
import { PropertyToasts, handleApiError } from "@/lib/toast-utils"
import { AnimatedCounter } from "@/components/ui/animated-counter"
import { formatCurrency, cn } from "@/lib/utils"
import { getPropertyImageSrc } from "@/lib/property-image-utils"
import { MiniChartCard } from "@/components/ui/mini-chart-card"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/permissions"

export function PropertiesView() {
  const { user } = useAuth()
  const canCreate = hasPermission(user?.permissions, user?.isSuperAdmin, user?.role, "properties", "create")
  const canEdit = hasPermission(user?.permissions, user?.isSuperAdmin, user?.role, "properties", "edit")
  const canDelete = hasPermission(user?.permissions, user?.isSuperAdmin, user?.role, "properties", "delete")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", undefined) || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingPropertyId, setEditingPropertyId] = useState<number | string | null>(null)
  const [editingStatusProperty, setEditingStatusProperty] = useState<any | null>(null)
  const [deletingProperty, setDeletingProperty] = useState<any | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [propertyStats, setPropertyStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [occupancyChartData, setOccupancyChartData] = useState<any[]>([])
  const [typeChartData, setTypeChartData] = useState<any[]>([])
  const [rentCollectionData, setRentCollectionData] = useState<any[]>([])
  const [activeTab, setActiveTabState] = useState("properties")
  const [hasInitializedTab, setHasInitializedTab] = useState(false)
  const tabStorageKey = "properties-active-tab"
  const [showStructureDialog, setShowStructureDialog] = useState(false)
  const [structurePropertyId, setStructurePropertyId] = useState<string | null>(null)
  const [structurePropertyName, setStructurePropertyName] = useState<string>("")
  const [reportLoading, setReportLoading] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const updateActiveTab = useCallback(
    (value: string, { shouldPersistQuery = true }: { shouldPersistQuery?: boolean } = {}) => {
      if (value !== activeTab) {
        setActiveTabState(value)
      }

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(tabStorageKey, value)
        } catch {
          // Ignore storage errors (private mode, etc.)
        }
      }

      if (shouldPersistQuery) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        const query = params.toString()
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
      }
    },
    [activeTab, pathname, router, searchParams, tabStorageKey],
  )

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab")
    if (tabFromQuery && tabFromQuery !== activeTab) {
      updateActiveTab(tabFromQuery, { shouldPersistQuery: false })
      if (!hasInitializedTab) {
        setHasInitializedTab(true)
      }
      return
    }

    if (!hasInitializedTab) {
      let storedTab: string | null = null
      if (typeof window !== "undefined") {
        try {
          storedTab = sessionStorage.getItem(tabStorageKey)
        } catch {
          storedTab = null
        }
      }

      if (storedTab && storedTab !== activeTab) {
        updateActiveTab(storedTab)
      } else if (!tabFromQuery) {
        updateActiveTab(activeTab)
      }

      setHasInitializedTab(true)
    }
  }, [activeTab, hasInitializedTab, searchParams, updateActiveTab])

  const handleTabChange = useCallback(
    (value: string) => {
      updateActiveTab(value)
    },
    [updateActiveTab],
  )

  useEffect(() => {
    const urlSearch = searchParams.get("search")
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch)
    }
    fetchStats()
  }, [searchParams])

  useEffect(() => {
    fetchProperties()
  }, [currentPage, itemsPerPage, searchQuery])

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const filters = toSimpleFilters(activeFilters)
      const statusVal = filters.status
      const typeVal = filters.type
      const response = await apiService.properties.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery,
        status: statusVal ? (Array.isArray(statusVal) ? (statusVal[0] as string) : (statusVal as string)) : undefined,
        type: typeVal ? (Array.isArray(typeVal) ? (typeVal[0] as string) : (typeVal as string)) : undefined,
      })

      const responseData = response.data
      if (responseData?.success || Array.isArray(responseData?.data) || Array.isArray(responseData)) {
        const data = responseData?.data || responseData
        setProperties(Array.isArray(data) ? data : [])
        const pagination = responseData?.pagination || {}
        setTotalPages(pagination.pages || 1)
        setTotalItems(pagination.total || 0)
      } else {
        setProperties([])
        setTotalPages(1)
        setTotalItems(0)
      }
    } catch (err: any) {
      console.error("Failed to fetch properties:", err)
      setError(err.message || "Failed to load properties")
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, itemsPerPage, searchQuery, activeFilters])

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const response: any = await apiService.stats.getPropertiesStats()
      // Backend returns { success: true, data: {...} }
      const responseData = response.data as any
      const data = responseData?.data || responseData || {}

      // Generate chart data based on stats
      setOccupancyChartData([
        { name: "Occupied", value: parseInt(data.occupiedUnits) || 0 },
        { name: "Vacant", value: parseInt(data.vacantUnits) || 0 }
      ])

      setTypeChartData((data.propertyTypeData || []).map((d: any) => ({
        type: d.name, count: d.value
      })))

      const propertiesAddedTrend = data.propertiesAddedTrend || [];
      const trendData = propertiesAddedTrend.length > 0 ? propertiesAddedTrend : Array.from({ length: 6 }).map((_, i) => ({
        month: `M${i + 1}`,
        amount: 0
      }));
      setRentCollectionData(trendData)

      // Always set stats boxes, even if data is empty
      setPropertyStats([
        {
          name: "Total Properties",
          value: data.totalProperties?.toString() || "0",
          change: data.propertiesChange || "+0 this month",
          icon: Building2,
          gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
          href: "/details/properties",
        },
        {
          name: "Active Properties",
          value: data.activeProperties?.toString() || "0",
          change: "Currently active",
          icon: Building2,
          gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
          href: "/details/properties",
        },
          {
            name: "Properties for Sale",
            value: data.propertiesForSale?.toString() || "0",
            change: data.saleValue ? `${formatCurrency(data.saleValue, undefined, 'compact')} total value` : `${formatCurrency(0)} total value`,
            icon: ShoppingCart,
            gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
            href: "/details/properties-for-sale",
          },
        {
          name: "Total Units",
          value: data.totalUnits?.toString() || "0",
          change: "Across all properties",
          icon: Home,
          gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
          href: "/details/units",
        },
        {
          name: "Occupied Units",
          value: data.occupiedUnits?.toString() || "0",
          change: data.occupancyRate ? `${data.occupancyRate}% occupancy` : "0% occupancy",
          icon: KeyRound,
          gradient: "bg-[linear-gradient(135deg,#10b981,#059669)]",
          href: "/details/occupied-units",
        },
        {
          name: "Vacant Units",
          value: data.vacantUnits?.toString() || "0",
          change: data.vacancyRate ? `${data.vacancyRate}% vacancy` : "0% vacancy",
          icon: Home,
          gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
          href: "/details/vacant-units",
        },
        {
          name: "Monthly Revenue",
          value: data.monthlyRevenue ? formatCurrency(data.monthlyRevenue, undefined, 'compact') : formatCurrency(0),
          change: "From occupied units",
          icon: DollarSign,
          gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
          href: "/details/revenue",
        },
        {
          name: "Total Tenants",
          value: data.totalTenants?.toLocaleString() || "0",
          change: data.tenantsChange || "+0 this month",
          icon: Users,
          gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
          href: "/details/tenants",
        },
      ])
    } catch (err: any) {
      // Don't log timeout errors
      if (err?.code !== 'ECONNABORTED' && !err?.message?.includes('timeout')) {
        console.error("Failed to fetch property stats:", err)
      }
      // Even on error, show boxes with default values
      setPropertyStats([
        {
          name: "Total Properties",
          value: "0",
          change: "+0 this month",
          icon: Building2,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/properties",
        },
        {
          name: "Active Properties",
          value: "0",
          change: "Currently active",
          icon: Building2,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/properties",
        },
        {
          name: "Properties for Sale",
          value: "0",
          change: "Rs 0 total value",
          icon: ShoppingCart,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/properties-for-sale",
        },
        {
          name: "Total Units",
          value: "0",
          change: "Across all properties",
          icon: Home,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/units",
        },
        {
          name: "Occupied Units",
          value: "0",
          change: "0% occupancy",
          icon: KeyRound,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/occupied-units",
        },
        {
          name: "Vacant Units",
          value: "0",
          change: "0% vacancy",
          icon: Home,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/vacant-units",
        },
        {
          name: "Monthly Revenue",
          value: "Rs 0",
          change: "From occupied units",
          icon: DollarSign,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/revenue",
        },
        {
          name: "Total Tenants",
          value: "0",
          change: "+0 this month",
          icon: Users,
          gradient: "bg-[linear-gradient(135deg,#315341,#4a7c61)]",
          href: "/details/tenants",
        },
      ])
    } finally {
      setStatsLoading(false)
    }
  }

  const handleGeneratePropertyReport = async (property: any) => {
    try {
      setReportLoading(true)

      // Fetch full property details with deals and payment plan
      const response: any = await apiService.properties.getById(String(property.id))
      const propertyData = response?.data?.data || response?.data || property

      // Prepare data for unified report
      const unitsValue = typeof propertyData.units === "number" ? propertyData.units : propertyData._count?.units ?? (Array.isArray(propertyData.units) ? propertyData.units.length : 0)
      const totalAreaValue = typeof propertyData.totalArea === "number" ? propertyData.totalArea : typeof propertyData.totalArea === "string" ? parseFloat(propertyData.totalArea.replace(/[^0-9.]/g, "")) || 0 : 0

      // Get payment plan from first deal that has one
      const reportPaymentPlan = propertyData?.deals ? (() => {
        for (const deal of propertyData.deals) {
          if (deal.paymentPlan) {
            const plan = deal.paymentPlan
            const installments = plan.installments || []
            const totalInstallments = installments.length
            const installmentAmount = totalInstallments > 0 ? installments[0].amount || 0 : 0

            // Calculate duration (months)
            let duration = "N/A"
            if (installments.length > 0) {
              const firstDate = new Date(installments[0].dueDate || Date.now())
              const lastDate = new Date(installments[installments.length - 1].dueDate || Date.now())
              const months = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
              duration = `${months} Months`
            }

            return {
              totalAmount: plan.totalAmount || 0,
              downPayment: plan.downPayment || 0,
              installments: totalInstallments,
              installmentAmount: installmentAmount,
              duration: duration,
              schedule: installments.map((inst: any, idx: number) => {
                let dateStr = "N/A"
                if (inst.dueDate) {
                  const date = new Date(inst.dueDate)
                  const day = String(date.getDate()).padStart(2, "0")
                  const month = date.toLocaleDateString("en-US", { month: "short" })
                  const year = date.getFullYear()
                  dateStr = `${day} ${month} ${year}`
                }
                return {
                  no: inst.installmentNumber || idx + 1,
                  date: dateStr,
                  amount: formatCurrency(inst.amount || 0),
                  status: inst.status === "paid" ? "Paid" : inst.status === "overdue" ? "Overdue" : "Pending",
                }
              }),
            }
          }
        }
        return null
      })() : null

      // Prepare deals data
      const reportDeals = propertyData?.deals ? propertyData.deals.map((deal: any) => {
        const totalReceived = deal.payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0
        const dealAmount = deal.dealAmount || deal.amount || 0
        return {
          title: deal.title || "N/A",
          client: deal.contactName || deal.client?.name || "N/A",
          amount: dealAmount,
          received: totalReceived,
          pending: Math.max(0, dealAmount - totalReceived),
          stage: deal.stage || "N/A",
        }
      }) : []

      const reportData = {
        title: "Property Report",
        systemId: propertyData.propertyCode ? `PROP-${propertyData.propertyCode}` : `PROP-${propertyData.id}`,
        generatedOn: new Date().toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        sections: [
          {
            title: "Basic Information",
            data: {
              "Property Name": propertyData.tid || "N/A",
              "Type": propertyData.type || "N/A",
              "Status": propertyData.status || "N/A",
              "Year Built": propertyData.yearBuilt || "N/A",
              "Area": (() => {
                if (!totalAreaValue) return "N/A"
                if (totalAreaValue >= 5445) {
                  const kanal = Math.floor(totalAreaValue / 5445)
                  const remainingMarla = Math.round((totalAreaValue % 5445) / 272.25)
                  return remainingMarla > 0 ? `${kanal} Kanal ${remainingMarla} Marla (${totalAreaValue.toLocaleString()} sq ft)` : `${kanal} Kanal (${totalAreaValue.toLocaleString()} sq ft)`
                }
                const marla = Math.round(totalAreaValue / 272.25)
                return `${marla} Marla (${totalAreaValue.toLocaleString()} sq ft)`
              })(),
              "Units": `${propertyData.occupied || 0} / ${unitsValue}`,
              "Sale Price": propertyData.salePrice ? `Rs ${Number(propertyData.salePrice).toLocaleString("en-IN")}` : "Rs 0",
              "Address": propertyData.address || "N/A"
            }
          },
          {
            title: "Finance Summary",
            data: {
              "Total Received": `Rs ${Number(propertyData.financeSummary?.totalReceived || 0).toLocaleString("en-IN")}`,
              "Total Expenses": `Rs ${Number(propertyData.financeSummary?.totalExpenses || 0).toLocaleString("en-IN")}`,
              "Pending Amount": `Rs ${Number(propertyData.financeSummary?.pendingAmount || 0).toLocaleString("en-IN")}`,
              "Active Deals": propertyData.financeSummary?.entryCount || propertyData.financeRecords?.length || 0
            }
          },
          ...(reportPaymentPlan ? [{
            title: "Payment Plan Summary",
            data: {
              "Total Amount": formatCurrency(reportPaymentPlan.totalAmount || 0),
              "Down Payment": formatCurrency(reportPaymentPlan.downPayment || 0),
              "Installments": reportPaymentPlan.installments || 0,
              "Installment Amount": formatCurrency(reportPaymentPlan.installmentAmount || 0),
              "Duration": reportPaymentPlan.duration || "N/A"
            }
          },
          {
            title: "Payment Schedule",
            tableData: reportPaymentPlan.schedule.map((s: any) => ({
              no: s.no,
              date: s.date,
              amount: s.amount,
              status: s.status
            })),
            tableColumns: [
              { key: 'no', label: '#', type: 'number' as 'number' },
              { key: 'date', label: 'Due Date', type: 'date' as 'date' },
              { key: 'amount', label: 'Amount', type: 'currency' as 'currency' },
              { key: 'status', label: 'Status' }
            ]
          }] : []),
          ...(reportDeals.length > 0 ? [{
            title: "Active Deals",
            tableData: reportDeals.map((deal: any) => ({
              title: deal.title,
              client: deal.client,
              amount: deal.amount,
              received: deal.received,
              pending: deal.pending,
              stage: deal.stage
            })),
            tableColumns: [
              { key: 'title', label: 'Deal Title' },
              { key: 'client', label: 'Client' },
              { key: 'amount', label: 'Amount', type: 'currency' as 'currency' },
              { key: 'received', label: 'Received', type: 'currency' as 'currency' },
              { key: 'pending', label: 'Pending', type: 'currency' as 'currency' },
              { key: 'stage', label: 'Stage' }
            ]
          }] : [])
        ]
      }

      // Open in new tab
      const { openReportInNewTab } = await import("@/components/reports/report-utils")
      openReportInNewTab(reportData)
    } catch (error: any) {
      console.error("Failed to fetch property details for report", error)
      handleApiError(error, "Failed to load property details")
    } finally {
      setReportLoading(false)
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground text-balance">Property Management</h1>
          <p className="text-muted-foreground mt-1">Manage all your properties, units, and tenants</p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          )}
        </div>
      </div>

      {/* Stats Boxes - Always show, even if empty */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {propertyStats.length > 0 ? (
            propertyStats.map((stat) => (
              <Card
                key={stat.name}
                className={cn(
                  "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
                )}
                onClick={() => router.push(stat.href)}
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
                      {stat.change}
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
            ))
          ) : (
            // Default boxes if stats array is empty
            [
              { name: "Total Properties", value: "0", change: "+0 this month", icon: Building2, gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]", href: "/details/properties" },
              { name: "Active Properties", value: "0", change: "Currently active", icon: Building2, gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]", href: "/details/properties" },
              { name: "Properties for Sale", value: "0", change: "Rs 0 total value", icon: ShoppingCart, gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]", href: "/details/properties-for-sale" },
              { name: "Total Units", value: "0", change: "Across all properties", icon: Home, gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]", href: "/details/units" },
              { name: "Occupied Units", value: "0", change: "0% occupancy", icon: KeyRound, gradient: "bg-[linear-gradient(135deg,#10b981,#059669)]", href: "/details/occupied-units" },
              { name: "Vacant Units", value: "0", change: "0% vacancy", icon: Home, gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]", href: "/details/vacant-units" },
              { name: "Monthly Revenue", value: "Rs 0", change: "From occupied units", icon: DollarSign, gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]", href: "/details/revenue" },
              { name: "Total Tenants", value: "0", change: "+0 this month", icon: Users, gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]", href: "/details/tenants" },
            ].map((stat) => (
              <Card
                key={stat.name}
                className={cn(
                  "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#2e2e2e] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
                )}
                onClick={() => router.push(stat.href)}
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
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-slate-200 bg-slate-50 text-slate-600 shadow-sm",
                      )}
                    >
                      {stat.change}
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
            ))
          )}
        </div>
      )}

      {/* Mini Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <MiniChartCard
          title="Occupied vs Vacant Units"
          value={occupancyChartData.find(d => d.name === "Occupied")?.value || 0}
          valueSuffix={` / ${(occupancyChartData.find(d => d.name === "Occupied")?.value || 0) + (occupancyChartData.find(d => d.name === "Vacant")?.value || 0)}`}
          data={occupancyChartData}
          dataKey="value"
          nameKey="name"
          chartType="donut"
          colors={["#10b981", "#ef4444"]}
        />
        <MiniChartCard
          title="Property Types"
          value={typeChartData.reduce((acc, curr) => acc + curr.count, 0)}
          data={typeChartData}
          dataKey="count"
          nameKey="type"
          chartType="bar"
          colors={["#8b5cf6"]}
        />
        <MiniChartCard
          title="Properties Added Per Month"
          value={rentCollectionData.length > 0 ? rentCollectionData[rentCollectionData.length - 1]?.amount : 0}
          data={rentCollectionData}
          dataKey="amount"
          chartType="line"
          colors={["#3b82f6"]}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="leases">Leases</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="buyers">Buyers</TabsTrigger>
          <TabsTrigger value="sellers">Seller</TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="space-y-4">
          <ListToolbar
            searchPlaceholder="Search by TID, title, location…"
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            onFilterClick={() => setShowFilterDrawer(true)}
            activeFilterCount={countActiveFilters(activeFilters)}
            onDownloadClick={() => setShowDownloadDialog(true)}
          />

          {/* Properties Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : properties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No properties found</div>
          ) : (
            <>
              <Card className="p-0">
                <div className="p-4 border-b">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{properties.length}</span> of <span className="font-semibold text-foreground">{totalItems}</span> properties
                  </p>
                </div>
                <DataTableFromRegistry
                  entity="property"
                  data={properties}
                  loading={loading}
                  error={error}
                  emptyMessage="No properties found"
                  onRowClick={(p) => router.push(`/property/${p.id}`)}
                  renderCell={(col, value, row) => {
                    if (col.key === "name") {
                      return (
                        <div className="flex items-center gap-3">
                          {row.imageUrl ? (
                            <div className="h-10 w-10 rounded overflow-hidden flex-shrink-0">
                              <img src={getPropertyImageSrc(row.id, row.imageUrl)} alt={row.tid || "Property"} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold">{row.name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground">{row.propertyCode || "No Code"}</div>
                          </div>
                        </div>
                      )
                    }
                    if (col.key === "status") return <Badge variant={row.status === "Active" ? "default" : row.status === "Maintenance" ? "destructive" : row.status === "For Sale" ? "secondary" : "outline"} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditingStatusProperty({ id: row.id, status: row.status || "Active", name: row.tid }) }}>{row.status || "—"}</Badge>
                    if (col.key === "address") return <div className="flex items-center gap-1 text-sm text-muted-foreground max-w-[200px]"><MapPin className="h-3 w-3 flex-shrink-0" /><span className="truncate">{row.address || row.location || "—"}</span></div>
                    if (col.key === "unitsDisplay") return <div className="flex items-center gap-1"><Home className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{row.occupied ?? 0}/{row.units ?? row._count?.units ?? 0}</span></div>
                    if (col.key === "occupiedDisplay") { const u = row.units ?? row._count?.units ?? 0; const o = row.occupied ?? 0; return <div className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{u > 0 ? `${Math.round((o / u) * 100)}%` : "—"}</span></div> }
                    if (col.key === "salePrice") return row.salePrice != null ? <span className="font-semibold">{formatCurrency(row.salePrice)}</span> : "—"
                    if (col.key === "revenue") return <div className="flex items-center gap-1"><DollarSign className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{formatCurrency(row.revenue || 0)}</span></div>
                    if (col.key === "tid") return <span className="font-mono text-xs">{row.tid || "—"}</span>
                    if (col.key === "type") return row.type || "—"
                    return undefined
                  }}
                  renderActions={(property) => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/property/${property.id}`)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/ledger/property/${property.id}`)}><FileText className="h-4 w-4 mr-2" />Open Ledger</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleGeneratePropertyReport(property)}><FileText className="h-4 w-4 mr-2" />Generate Report</DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem onClick={() => { setEditingPropertyId(property.id); setShowAddDialog(true) }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem onClick={() => { setStructurePropertyId(String(property.id)); setStructurePropertyName(property.tid || ""); setShowStructureDialog(true) }}><Building2 className="h-4 w-4 mr-2" />Create Structure</DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingProperty({ id: property.id, name: property.tid, propertyCode: property.propertyCode })}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                />
              </Card>
              {totalPages > 1 && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>

                      <PaginationItem>
                        <span className="flex h-9 min-w-[2rem] items-center justify-center text-sm font-medium">
                          Page {currentPage} of {totalPages}
                        </span>
                      </PaginationItem>

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  <p className="text-xs text-muted-foreground">
                    Total {totalItems} properties
                  </p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Units Tab */}
        <TabsContent value="units">
          <UnitsView />
        </TabsContent>

        {/* Tenants Tab */}
        <TabsContent value="tenants">
          <TenantsView />
        </TabsContent>

        {/* Leases Tab */}
        <TabsContent value="leases">
          <LeasesView />
        </TabsContent>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <SalesView />
        </TabsContent>

        {/* Buyers Tab */}
        <TabsContent value="buyers">
          <BuyersView />
        </TabsContent>

        {/* Seller Tab */}
        <TabsContent value="sellers">
          <SellersView />
        </TabsContent>
      </Tabs>

      {deletingProperty && (
        <PropertyDeleteDialog
          open={!!deletingProperty}
          propertyId={deletingProperty.id}
          propertyName={deletingProperty.tid}
          propertyCode={deletingProperty.propertyCode}
          onOpenChange={(open) => {
            if (!open) setDeletingProperty(null)
          }}
          onDeleted={() => {
            fetchProperties()
            fetchStats()
            setDeletingProperty(null)
          }}
        />
      )}
      <AddPropertyDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) {
            setEditingPropertyId(null)
          }
        }}
        propertyId={editingPropertyId}
        onSuccess={() => {
          fetchProperties()
          fetchStats()
          setEditingPropertyId(null)
        }}
      />
      {editingStatusProperty && (
        <EditStatusDialog
          open={!!editingStatusProperty}
          onOpenChange={(open) => !open && setEditingStatusProperty(null)}
          onSuccess={() => {
            fetchProperties()
            fetchStats()
            setEditingStatusProperty(null)
          }}
          entityType="property"
          entityId={editingStatusProperty.id}
          currentStatus={editingStatusProperty.status}
          entityName={editingStatusProperty.name}
        />
      )}

      {/* Structure Setup Dialog */}
      {structurePropertyId && (
        <PropertyStructureSetupDialog
          open={showStructureDialog}
          onOpenChange={(open) => {
            setShowStructureDialog(open)
            if (!open) {
              setStructurePropertyId(null)
              setStructurePropertyName("")
            }
          }}
          propertyId={structurePropertyId}
          propertyName={structurePropertyName}
          onComplete={() => {
            // Refresh properties list
            fetchProperties()
          }}
        />
      )}

      {/* Structure Setup Dialog */}
      {structurePropertyId && (
        <PropertyStructureSetupDialog
          open={showStructureDialog}
          onOpenChange={(open) => {
            setShowStructureDialog(open)
            if (!open) {
              setStructurePropertyId(null)
              setStructurePropertyName("")
            }
          }}
          propertyId={structurePropertyId}
          propertyName={structurePropertyName}
          onComplete={() => {
            // Refresh properties list
            fetchProperties()
          }}
        />
      )}

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="property"
        module="properties"
        entityDisplayName="Properties"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
        pagination={
          activeTab === "properties"
            ? { page: currentPage, pageSize: itemsPerPage }
            : undefined
        }
      />

      {activeTab === "properties" && (
        <UnifiedFilterDrawer
          open={showFilterDrawer}
          onOpenChange={setShowFilterDrawer}
          entity="properties"
          initialFilters={activeFilters}
          onApply={(filters) => {
            setActiveFilters(filters)
            saveFilters("properties", undefined, filters)
          }}
        />
      )}
    </div>
  )
}
