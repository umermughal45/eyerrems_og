"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Calendar, DollarSign, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddLeaseDialog } from "./add-lease-dialog"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"

export function LeasesView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", "leases") || {})
  const [showLeaseDialog, setShowLeaseDialog] = useState(false)
  const [leases, setLeases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingLease, setEditingLease] = useState<any | null>(null)
  const [deletingLeaseId, setDeletingLeaseId] = useState<string | null>(null)

  useEffect(() => {
    fetchLeases()
  }, [])

  const fetchLeases = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.leases.getAll()
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const leasesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      const normalized = Array.isArray(leasesData) ? leasesData : []
      setLeases(normalized)
      return normalized
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch leases")
      setLeases([])
      return []
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLease = async (lease: any) => {
    if (!lease?.id) return
    const confirmed = window.confirm(
      "Are you sure you want to delete this lease? This action cannot be undone."
    )
    if (!confirmed) return

    try {
      setDeletingLeaseId(lease.id)
      await apiService.leases.delete(lease.id)
      toast({
        title: "Lease deleted",
        description: "The lease has been removed successfully.",
      })
      fetchLeases()
    } catch (err: any) {
      console.error("Failed to delete lease:", err)
      toast({
        title: "Error",
        description: err?.response?.data?.message || err?.response?.data?.error || "Failed to delete lease",
        variant: "destructive",
      })
    } finally {
      setDeletingLeaseId(null)
    }
  }

  const filteredLeases = (leases || []).filter((lease) => {
    const tenantName = lease.tenantName || lease.tenant?.name || lease.tenant || ""
    const propertyName = lease.propertyName || lease.unit?.property?.name || lease.property || ""
    const unitName = lease.unitName || lease.unit?.unitName || lease.unit || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      tenantName.toLowerCase().includes(searchLower) ||
      propertyName.toLowerCase().includes(searchLower) ||
      unitName.toLowerCase().includes(searchLower)

    const leaseStatus = activeFilters.leaseStatus
    const lsVal = Array.isArray(leaseStatus) ? leaseStatus : leaseStatus ? [String(leaseStatus)] : []
    const matchesLeaseStatus = !lsVal.length || lsVal.some((s: string) => (lease.status || "").toLowerCase() === s.toLowerCase())

    const propId = activeFilters.propertyId
    const matchesProperty = !propId || (lease.propertyId || lease.unit?.propertyId || lease.unit?.property?.id) === propId

    const tenantId = activeFilters.tenantId
    const matchesTenant = !tenantId || (lease.tenantId || lease.tenant?.id) === tenantId

    const rentMin = activeFilters.rent_min as number | undefined
    const rentMax = activeFilters.rent_max as number | undefined
    const rent = lease.rent ?? 0
    const matchesRent = (rentMin == null || rent >= rentMin) && (rentMax == null || rent <= rentMax)

    return matchesSearch && matchesLeaseStatus && matchesProperty && matchesTenant && matchesRent
  })

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search leases…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => { setEditingLease(null); setShowLeaseDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Lease
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <DataTableFromRegistry
            entity="lease"
            data={filteredLeases}
            loading={loading}
            error={error}
            emptyMessage="No leases found"
            renderCell={(col, _value, row) => {
              if (col.key === "id") return <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div><span className="font-medium">{row.id ? String(row.id).slice(0, 8) : "—"}</span></div>
              if (col.key === "rent") { const r = row.rent ?? row.monthlyRent; return r != null ? <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" /><span className="font-medium">Rs {Number(r).toLocaleString()}</span></div> : "—" }
              if (col.key === "leasePeriod") return <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{row.leaseStart ? new Date(row.leaseStart).toLocaleDateString() : "—"} - {row.leaseEnd ? new Date(row.leaseEnd).toLocaleDateString() : "—"}</div>
              if (col.key === "status") return <Badge variant={row.status === "Active" || row.status === "active" ? "default" : row.status === "Expired" || row.status === "expired" ? "outline" : row.status === "Terminated" || row.status === "terminated" ? "destructive" : "secondary"}>{row.status || "N/A"}</Badge>
              return undefined
            }}
            renderActions={(lease) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditingLease(lease); setShowLeaseDialog(true) }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteLease(lease)} disabled={deletingLeaseId === lease.id}><Trash2 className="mr-2 h-4 w-4" />{deletingLeaseId === lease.id ? "Deleting..." : "Delete"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      </Card>

      <AddLeaseDialog
        open={showLeaseDialog}
        onOpenChange={(open) => {
          setShowLeaseDialog(open)
          if (!open) {
            setEditingLease(null)
          }
        }}
        onSuccess={fetchLeases}
        lease={editingLease}
      />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="lease"
        module="leases"
        entityDisplayName="Leases"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="properties"
        tab="leases"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("properties", "leases", filters)
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}
