"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, TrendingUp, DollarSign, User, Building, Loader2 } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddSaleDialog } from "./add-sale-dialog"
import { apiService } from "@/lib/api"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { useToast } from "@/hooks/use-toast"

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
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const salesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setSales(Array.isArray(salesData) ? salesData : [])
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch sales")
      setSales([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSales = (sales || []).filter((sale) => {
    const propertyName = sale.propertyName || sale.property?.name || ""
    const buyerName = sale.buyer || (sale.buyers && sale.buyers.length > 0 ? sale.buyers[0].name : "") || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      propertyName.toLowerCase().includes(searchLower) ||
      buyerName.toLowerCase().includes(searchLower)

    const saleStatus = activeFilters.saleStatus
    const ssVal = Array.isArray(saleStatus) ? saleStatus : saleStatus ? [String(saleStatus)] : []
    const matchesStatus = !ssVal.length || ssVal.some((s: string) => (sale.status || "").toLowerCase() === s.toLowerCase())

    const propId = activeFilters.propertyId
    const matchesProperty = !propId || (sale.propertyId || sale.property?.id) === propId

    const agentId = activeFilters.agentId
    const matchesAgent = !agentId || (sale.dealerId || sale.dealer?.id || sale.agentId || sale.agent?.id) === agentId

    const valMin = activeFilters.saleValue_min as number | undefined
    const valMax = activeFilters.saleValue_max as number | undefined
    const val = sale.saleValue ?? sale.salePrice ?? 0
    const matchesValue = (valMin == null || val >= valMin) && (valMax == null || val <= valMax)

    return matchesSearch && matchesStatus && matchesProperty && matchesAgent && matchesValue
  })

  const totalSales = filteredSales.reduce((sum, sale) => sum + (sale.saleValue || sale.salePrice || 0), 0)
  const totalCommission = filteredSales.reduce((sum, sale) => sum + (sale.commission || 0), 0)

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/details/sales")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-2xl font-bold text-foreground">{filteredSales.length}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/details/sales-value")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sales Value</p>
              <p className="text-2xl font-bold text-foreground">Rs {(totalSales / 1000000).toFixed(1)}M</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => router.push("/details/commission")}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Commission</p>
              <p className="text-2xl font-bold text-foreground">Rs {(totalCommission / 1000).toFixed(0)}K</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg. Price</p>
              <p className="text-2xl font-bold text-foreground">
                Rs {filteredSales.length > 0 ? (totalSales / filteredSales.length / 1000).toFixed(0) : 0}K
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
              <Building className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

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

      {/* Sales Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Buyer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Dealer/Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sale Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sale Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-destructive">{error}</td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No sales found</td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-foreground">{sale.propertyName || sale.property?.name || "N/A"}</div>
                      <div className="text-sm text-muted-foreground">{sale.property?.type || sale.propertyType || "-"}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground">
                        {sale.buyers && sale.buyers.length > 0 
                          ? sale.buyers.map((b: any) => b.name).join(", ")
                          : sale.buyer || "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">-</td>
                  <td className="px-6 py-4 text-sm font-medium text-foreground">
                    Rs {(sale.saleValue || sale.salePrice || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-green-600 font-medium">
                    Rs {(sale.commission || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={
                        sale.status === "Completed" || sale.status === "completed"
                          ? "default"
                          : sale.status === "Pending" || sale.status === "pending"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {sale.status || "N/A"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/details/sale/${sale.id}`)}>
                      View Details
                    </Button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddSaleDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchSales} />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="sale"
        module="sales"
        entityDisplayName="Sales"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
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
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}
