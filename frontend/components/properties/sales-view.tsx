"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, TrendingUp, DollarSign, User, Building, Loader2, Calendar, Target, CheckCircle, XCircle, Clock } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddSaleDialog } from "./add-sale-dialog"
import { apiService } from "@/lib/api"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const saleStats = [
  {
    name: "Total Sales",
    value: 0,
    icon: TrendingUp,
    href: "/details/sales",
  },
  {
    name: "Total Revenue",
    value: 0,
    icon: DollarSign,
    href: "/details/sales",
    format: (v: number) => formatCurrency(v),
  },
  {
    name: "Total Commission",
    value: 0,
    icon: Target,
    href: "/details/sales",
    format: (v: number) => formatCurrency(v),
  },
  {
    name: "Completed Deals",
    value: 0,
    icon: CheckCircle,
    href: "/details/sales?status=completed",
  },
]

export function SalesView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", "sales") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchSales()
  }, [])

  const fetchSales = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.sales.getAll()
      const responseData = response.data as any
      const salesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setSales(salesData)

      // Update stats
      const totalSales = salesData.length
      const totalRevenue = salesData.reduce((sum: number, sale: any) => sum + (sale.salePrice || 0), 0)
      const totalCommission = salesData.reduce((sum: number, sale: any) => sum + (sale.commission || 0), 0)
      const completedDeals = salesData.filter((sale: any) => sale.status === 'Completed').length

      saleStats[0].value = totalSales
      saleStats[1].value = totalRevenue
      saleStats[2].value = totalCommission
      saleStats[3].value = completedDeals
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch sales")
      setSales([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = (sales || []).filter((sale) => {
    const propertyTitle = sale.property?.title || sale.property?.address || ""
    const buyerName = sale.buyer?.fullName || sale.buyer?.name || ""
    const sellerName = sale.seller?.fullName || sale.seller?.name || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      propertyTitle.toLowerCase().includes(searchLower) ||
      buyerName.toLowerCase().includes(searchLower) ||
      sellerName.toLowerCase().includes(searchLower)

    const status = activeFilters.status
    const matchesStatus = !status || sale.status === status

    const propertyType = activeFilters.propertyType
    const matchesType = !propertyType || sale.property?.type === propertyType

    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800'
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      case 'Cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed': return CheckCircle
      case 'Pending': return Clock
      case 'Cancelled': return XCircle
      default: return Clock
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {saleStats.map((stat, index) => (
          <Card
            key={index}
            className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(stat.href)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.format ? stat.format(stat.value) : stat.value}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <ListToolbar
        searchPlaceholder="Search sales…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Sale
          </Button>
        }
      />

      {/* Sales Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-center text-red-600">{error}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSales.map((sale) => {
            const StatusIcon = getStatusIcon(sale.status)
            return (
              <Card key={sale.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => router.push(`/properties/sales/${sale.id}`)}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg line-clamp-1">
                        {sale.property?.title || sale.property?.address || "Property"}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className="h-4 w-4" />
                        <Badge className={getStatusColor(sale.status)}>
                          {sale.status}
                        </Badge>
                      </div>
                    </div>
                    <Building className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span className="text-muted-foreground">Buyer:</span>
                      <span className="font-medium">{sale.buyer?.fullName || sale.buyer?.name || "N/A"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="text-muted-foreground">Seller:</span>
                      <span className="font-medium">{sale.seller?.fullName || sale.seller?.name || "N/A"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="text-muted-foreground">Date:</span>
                      <span>{sale.dealDate ? new Date(sale.dealDate).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Sale Price:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(sale.salePrice || 0)}
                      </span>
                    </div>

                    {sale.commission && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Commission:</span>
                        <span className="font-medium text-blue-600">
                          {formatCurrency(sale.commission)}
                        </span>
                      </div>
                    )}

                    {sale.commissionPercentage && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Commission %:</span>
                        <span className="text-sm">{sale.commissionPercentage}%</span>
                      </div>
                    )}
                  </div>

                  {sale.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2 border-t pt-2">
                      {sale.notes}
                    </p>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialogs */}
      <AddSaleDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          fetchSales()
          setShowAddDialog(false)
        }}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="properties"
        tab="sales"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("properties", "sales", filters)
        }}
      />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="sale"
        module="sales"
        entityDisplayName="Sales"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
      />
    </div>
  )
}
