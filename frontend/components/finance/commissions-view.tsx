"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DollarSign, TrendingUp, Calendar, Loader2 } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"

export function CommissionsView() {
  const { toast } = useToast()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("finance", "commissions") || {})
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCommissions()
  }, [])

  const fetchCommissions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.commissions.getAll()
      const responseData = response.data as any
      const data = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      const mapped = data.map((c: any) => ({
        id: c.id,
        dealerName: c.dealer?.name || c.dealerId || "—",
        dealerId: c.dealerId || "—",
        transactionType: "sale",
        propertyName: c.sale?.property?.name || c.sale?.propertyId || "—",
        saleAmount: c.sale?.saleValue || 0,
        commissionRate: c.rate ?? 0,
        commissionAmount: c.amount ?? 0,
        date: c.createdAt,
        status: c.status || "paid",
      }))
      setCommissions(mapped)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch commissions")
      setCommissions([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCommissions = useMemo(() => {
    let list = commissions.filter((c) =>
      (c.dealerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.propertyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.transactionType || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (String(c.id) || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    const dealerId = activeFilters.dealerId
    if (dealerId) list = list.filter((c) => c.dealerId === dealerId)
    const statusVal = activeFilters.status
    const statusArr = Array.isArray(statusVal) ? statusVal : statusVal ? [String(statusVal)] : []
    if (statusArr.length) list = list.filter((c) => statusArr.includes(c.status))
    return list
  }, [commissions, searchQuery, activeFilters])

  const totalCommissions = filteredCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0)
  const paidCommissions = filteredCommissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + (c.commissionAmount || 0), 0)
  const pendingCommissions = filteredCommissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + (c.commissionAmount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]" onClick={() => router.push("/details/commissions")}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><DollarSign className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Commissions</p>
              <p className="text-2xl font-bold text-foreground">Rs {totalCommissions.toLocaleString("en-PK")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]" onClick={() => router.push("/details/commissions?status=paid")}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10"><TrendingUp className="h-6 w-6 text-success" /></div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Paid Commissions</p>
              <p className="text-2xl font-bold text-success">Rs {paidCommissions.toLocaleString("en-PK")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]" onClick={() => router.push("/details/commissions?status=pending")}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/10"><Calendar className="h-6 w-6 text-yellow-600 dark:text-yellow-500" /></div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Commissions</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">Rs {pendingCommissions.toLocaleString("en-PK")}</p>
            </div>
          </div>
        </Card>
      </div>

      <ListToolbar
        searchPlaceholder="Search by dealer, property, or commission ID…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
      />

      <Card>
        <div className="overflow-x-auto">
          <DataTableFromRegistry
            entity="commission"
            data={filteredCommissions}
            loading={loading}
            error={error}
            emptyMessage={commissions.length === 0 ? "Commissions will appear when property sales are completed" : "No commissions match your filters"}
            onRowClick={(row) => router.push(`/details/commissions/${row.id}`)}
            renderCell={(col, _value, row) => {
              if (col.key === "transactionType") return <Badge variant="outline">{row.transactionType}</Badge>
              if (col.key === "status") return <Badge variant={row.status === "paid" ? "default" : "secondary"}>{row.status}</Badge>
              if (col.key === "saleAmount") return <span className="font-medium">Rs {(row.saleAmount || 0).toLocaleString("en-PK")}</span>
              if (col.key === "commissionAmount") return <span className="font-semibold text-success">Rs {(row.commissionAmount || 0).toLocaleString("en-PK")}</span>
              if (col.key === "commissionRate") return <span>{row.commissionRate}%</span>
              return undefined
            }}
            renderActions={(row) => null}
          />
        </div>
      </Card>

      <DownloadReportDialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog} entity="commission" module="commissions" entityDisplayName="Commissions" filters={toExportFilters(activeFilters, "finance")} search={searchQuery || undefined} />
      <UnifiedFilterDrawer open={showFilterDrawer} onOpenChange={setShowFilterDrawer} entity="finance" tab="commissions" initialFilters={activeFilters} onApply={(filters) => { setActiveFilters(filters); saveFilters("finance", "commissions", filters); toast({ title: "Filters applied" }) }} />
    </div>
  )
}
