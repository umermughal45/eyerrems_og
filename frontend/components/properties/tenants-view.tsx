"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Mail, Phone, MapPin, ArrowLeft, Loader2, Users } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddTenantDialog } from "./add-tenant-dialog"
import { BlocksView } from "./blocks-view"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { cn } from "@/lib/utils"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { useToast } from "@/hooks/use-toast"

export function TenantsView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", "tenants") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [selectedTenantDetails, setSelectedTenantDetails] = useState<any | null>(null)
  const [highlightedTenantId, setHighlightedTenantId] = useState<string | null>(null)
  const router = useRouter()

  const fetchTenants = async (blockId?: string | null) => {
    try {
      setLoading(true)
      setError(null)
      // Use blockId query parameter if available
      const effectiveBlockId = blockId !== undefined ? blockId : selectedBlock
      const response: any = await apiService.tenants.getAll(effectiveBlockId ? { blockId: effectiveBlockId } : undefined)
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      let data = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      data = Array.isArray(data) ? data : []
      
      setTenants(data)
      return data
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch tenants")
      setTenants([])
      return []
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants(selectedBlock ?? undefined)
  }, [selectedBlock])

  useEffect(() => {
    if (!selectedTenantId) {
      setSelectedTenantDetails(null)
      return
    }
    const match = tenants.find((tenant) => tenant.id === selectedTenantId)
    setSelectedTenantDetails(match || null)
  }, [tenants, selectedTenantId])

  useEffect(() => {
    if (!highlightedTenantId) return
    const timeoutId = window.setTimeout(() => setHighlightedTenantId(null), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [highlightedTenantId])

  const handleBlockSelect = (blockId: string) => {
    setSelectedBlock(blockId)
    setSelectedTenantId(null)
    setSelectedTenantDetails(null)
    setHighlightedTenantId(null)
    setSearchQuery("")
    // Explicitly fetch tenants for the selected block
    fetchTenants(blockId)
  }

  const handleTenantSelect = (tenant: any) => {
    if (!tenant?.id) return
    setSelectedTenantId(tenant.id)
    setSelectedTenantDetails(tenant)
    setHighlightedTenantId(tenant.id)
  }

  const filteredTenants = (tenants || []).filter((tenant) => {
    const tid = tenant.tid || ""
    const name = tenant.name || ""
    const email = tenant.email || ""
    const unitName =
      typeof tenant.unit === "string" ? tenant.unit : tenant.unit?.unitName || tenant.unit?.unitNumber || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      tid.toLowerCase().includes(searchLower) ||
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      unitName.toLowerCase().includes(searchLower)

    const active = activeFilters.active
    const matchesActive = active == null || (String(active) === "true" && (tenant.status || "").toLowerCase() === "active") || (String(active) === "false" && (tenant.status || "").toLowerCase() !== "active")

    const leaseStatus = activeFilters.leaseStatus
    const lsVal = Array.isArray(leaseStatus) ? leaseStatus : leaseStatus ? [String(leaseStatus)] : []
    const tenantLeaseStatus = tenant.leases?.[0]?.status || tenant.leaseStatus || ""
    const matchesLeaseStatus = !lsVal.length || lsVal.some((s: string) => tenantLeaseStatus.toLowerCase() === s.toLowerCase())

    const propId = activeFilters.propertyId
    const matchesProperty = !propId || (tenant.unit?.propertyId || tenant.unit?.property?.id) === propId

    const unitId = activeFilters.unitId
    const matchesUnit = !unitId || (tenant.unitId || tenant.unit?.id) === unitId

    return matchesSearch && matchesActive && matchesLeaseStatus && matchesProperty && matchesUnit
  })

  if (selectedBlock === null) {
    return (
      <BlocksView
        onBlockSelect={handleBlockSelect}
        onBlockCreated={(block) => {
          if (block?.id) {
            handleBlockSelect(block.id)
            setTimeout(() => setShowAddDialog(true), 0)
          }
        }}
      />
    )
  }

  const renderMonthlyRent = (tenant: any) => {
    const leaseRent = tenant?.leases?.[0]?.rent
    const unitRent = tenant?.unit?.monthlyRent
    const fallbackRent = tenant?.rent
    const rentValue =
      typeof leaseRent === "number"
        ? leaseRent
        : typeof unitRent === "number"
        ? unitRent
        : typeof fallbackRent === "number"
        ? fallbackRent
        : fallbackRent
        ? parseFloat(fallbackRent)
        : NaN
    if (!Number.isFinite(rentValue) || rentValue <= 0) {
      return "-"
    }
    return `Rs ${rentValue.toLocaleString()}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setSelectedBlock(null)
            setSelectedTenantId(null)
            setSelectedTenantDetails(null)
            setHighlightedTenantId(null)
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Blocks
        </Button>
      </div>

      <ListToolbar
        searchPlaceholder="Search by TID, name, email, unit…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </Button>
        }
      />

      {/* Tenants & Details */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredTenants.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground md:col-span-2">
                No tenants found
              </Card>
            ) : (
              filteredTenants.map((tenant) => {
                const isSelected = tenant.id === selectedTenantId
                const isHighlighted = tenant.id === highlightedTenantId
                const unitDisplay =
                  typeof tenant.unit === "string"
                    ? tenant.unit
                    : tenant.unit?.unitName || tenant.unit?.unitNumber || "N/A"
                const propertyDisplay = tenant.unit?.property?.name || tenant.property || "N/A"
                return (
                  <Card
                    key={tenant.id}
                    className={cn(
                      "p-6 cursor-pointer transition-shadow border",
                      isSelected
                        ? "border-primary shadow-lg ring-2 ring-primary/60"
                        : "border-border hover:shadow-lg",
                      isHighlighted && !isSelected ? "ring-2 ring-primary/40" : ""
                    )}
                    onClick={() => handleTenantSelect(tenant)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant={tenant.status?.toLowerCase() === "active" ? "secondary" : "outline"}>
                        {tenant.status || "-"}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-foreground text-lg">{tenant.name || "N/A"}</h3>
                        <div className="text-sm text-muted-foreground font-mono">{tenant.tid || "No TID"}</div>
                        <p className="text-sm text-muted-foreground">
                          {unitDisplay}
                          {propertyDisplay ? ` · ${propertyDisplay}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>{tenant.email || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{tenant.phone || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>
                          {unitDisplay}, {propertyDisplay}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-border">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Lease Period</p>
                            <p className="font-medium text-foreground mt-1">
                              {tenant.leases?.[0]?.leaseStart
                                ? new Date(tenant.leases[0].leaseStart).toLocaleDateString()
                                : "-"}{" "}
                              -{" "}
                              {tenant.leases?.[0]?.leaseEnd
                                ? new Date(tenant.leases[0].leaseEnd).toLocaleDateString()
                                : "-"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Monthly Rent</p>
                            <p className="font-medium text-foreground mt-1">{renderMonthlyRent(tenant)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
          <div className="space-y-4">
            {selectedTenantDetails ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {selectedTenantDetails.name || "N/A"}
                      </h3>
                      <p className="text-xs font-mono text-muted-foreground mb-1">
                        {selectedTenantDetails.tid || "—"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {typeof selectedTenantDetails.unit === "string"
                          ? selectedTenantDetails.unit
                          : selectedTenantDetails.unit?.unitName || selectedTenantDetails.unit?.unitNumber || "N/A"}
                        {selectedTenantDetails.unit?.block?.name
                          ? ` · Block ${selectedTenantDetails.unit.block.name}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant={selectedTenantDetails.status?.toLowerCase() === "active" ? "secondary" : "outline"}>
                    {selectedTenantDetails.status || "—"}
                  </Badge>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedTenantDetails.email || "Email not provided"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedTenantDetails.phone || "Phone not provided"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                    <span>
                      {typeof selectedTenantDetails.unit === "string"
                        ? selectedTenantDetails.unit
                        : selectedTenantDetails.unit?.unitName || selectedTenantDetails.unit?.unitNumber || "N/A"}
                      ,{" "}
                      {selectedTenantDetails.unit?.property?.name ||
                        selectedTenantDetails.property ||
                        "Property not specified"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Lease Overview</p>
                  <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                    <div>
                      <p>Start Date</p>
                      <p className="font-medium text-foreground mt-1">
                        {selectedTenantDetails.leases?.[0]?.leaseStart
                          ? new Date(selectedTenantDetails.leases[0].leaseStart).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p>End Date</p>
                      <p className="font-medium text-foreground mt-1">
                        {selectedTenantDetails.leases?.[0]?.leaseEnd
                          ? new Date(selectedTenantDetails.leases[0].leaseEnd).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p>Monthly Rent</p>
                      <p className="font-medium text-foreground mt-1">{renderMonthlyRent(selectedTenantDetails)}</p>
                    </div>
                    <div>
                      <p>Property</p>
                      <p className="font-medium text-foreground mt-1">
                        {selectedTenantDetails.unit?.property?.name || selectedTenantDetails.property || "—"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedTenantDetails?.id) {
                        router.push(`/tenant?tenantId=${selectedTenantDetails.id}`)
                      }
                    }}
                    disabled={!selectedTenantDetails?.id}
                  >
                    View Tenant Portal
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">
                Select a tenant to view detailed information here.
              </Card>
            )}
          </div>
        </div>
      )}

      <AddTenantDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={fetchTenants}
        blockId={selectedBlock ?? undefined}
        onTenantCreated={async (tenant: any) => {
          const newBlockId = tenant?.unit?.block?.id || tenant?.unit?.blockId || null
          const tenantId = tenant?.id || null

          if (tenantId) {
            setSelectedTenantId(tenantId)
            setHighlightedTenantId(tenantId)
          }

          if (newBlockId && newBlockId !== selectedBlock) {
            setSelectedTenantDetails(null)
            setSelectedBlock(newBlockId)
            setSearchQuery("")
            return
          }

          const updatedTenants = await fetchTenants(newBlockId ?? selectedBlock ?? undefined)
          if (tenantId) {
            const createdTenant = updatedTenants.find((item: any) => item.id === tenantId)
            if (createdTenant) {
              handleTenantSelect(createdTenant)
            }
          }
          setSearchQuery("")
        }}
      />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="tenant"
        module="tenants"
        entityDisplayName="Tenants"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="properties"
        tab="tenants"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("properties", "tenants", filters)
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}
