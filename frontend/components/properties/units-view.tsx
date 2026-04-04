"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Home, DollarSign, Loader2, MoreVertical, Pencil, Trash2, Building2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddUnitDialog } from "./add-unit-dialog"
import { EditStatusDialog } from "./edit-status-dialog"
import { apiService } from "@/lib/api"
import { UnitToasts, handleApiError } from "@/lib/toast-utils"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { useToast } from "@/hooks/use-toast"

export function UnitsView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", "units") || {})
  const [showUnitDialog, setShowUnitDialog] = useState(false)
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingStatusUnit, setEditingStatusUnit] = useState<{ id: string | number; status: string; name: string } | null>(null)
  const [editingUnit, setEditingUnit] = useState<any | null>(null)
  const [deletingUnitId, setDeletingUnitId] = useState<string | number | null>(null)

  useEffect(() => {
    fetchUnits()
  }, [])

  const fetchUnits = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.units.getAll()
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const unitsData = responseData?.data || responseData || []
      setUnits(Array.isArray(unitsData) ? unitsData : [])
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch units")
      setUnits([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUnit = async (unit: any) => {
    if (!unit?.id) return
    const confirmed = window.confirm(
      `Are you sure you want to delete ${unit.unitName || unit.unitNumber || "this unit"}? This action cannot be undone.`
    )
    if (!confirmed) return

    try {
      setDeletingUnitId(unit.id)
      await apiService.units.delete(unit.id)
      UnitToasts.deleted(unit.unitName || unit.unitNumber || "Unit")
      fetchUnits()
    } catch (err: any) {
      console.error("Failed to delete unit:", err)
      handleApiError(err, "Failed to delete unit")
    } finally {
      setDeletingUnitId(null)
    }
  }

  const filteredUnits = (units || []).filter((unit) => {
    const unitName = unit.unitName || unit.unitNumber || ""
    const propertyName = unit.property?.name || unit.property || ""
    const floorName = unit.floor?.name || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      unitName.toLowerCase().includes(searchLower) ||
      propertyName.toLowerCase().includes(searchLower) ||
      floorName.toLowerCase().includes(searchLower)

    const unitStatus = activeFilters.unitStatus
    const statusVal = Array.isArray(unitStatus) ? unitStatus : unitStatus ? [String(unitStatus)] : []
    const matchesStatus = !statusVal.length || statusVal.some((s: string) => (unit.status || "").toLowerCase() === s.toLowerCase())

    const propId = activeFilters.propertyId
    const matchesProperty = !propId || (unit.propertyId || unit.property?.id) === propId

    const unitType = activeFilters.unitType
    const typeVal = Array.isArray(unitType) ? unitType : unitType ? [String(unitType)] : []
    const matchesType = !typeVal.length || typeVal.some((t: string) => (unit.unitType || unit.type || "").toLowerCase() === t.toLowerCase())

    const rentMin = activeFilters.rent_min as number | undefined
    const rentMax = activeFilters.rent_max as number | undefined
    const rent = unit.monthlyRent ?? unit.rent ?? 0
    const matchesRent = (rentMin == null || rent >= rentMin) && (rentMax == null || rent <= rentMax)

    const areaMin = activeFilters.area_min as number | undefined
    const areaMax = activeFilters.area_max as number | undefined
    const area = unit.area ?? unit.sqft ?? 0
    const matchesArea = (areaMin == null || area >= areaMin) && (areaMax == null || area <= areaMax)

    return matchesSearch && matchesStatus && matchesProperty && matchesType && matchesRent && matchesArea
  })

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search units…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => { setEditingUnit(null); setShowUnitDialog(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Unit
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <DataTableFromRegistry
            entity="unit"
            data={filteredUnits}
            loading={loading}
            error={error}
            emptyMessage="No units found"
            renderCell={(col, _value, row) => {
              if (col.key === "unitName") return <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10"><Home className="h-4 w-4 text-primary" /></div><span className="font-medium">{row.unitName || row.unitNumber || "N/A"}</span></div>
              if (col.key === "status") return <Badge variant={row.status === "Occupied" || row.status === "occupied" ? "default" : row.status === "Vacant" || row.status === "vacant" ? "secondary" : "outline"} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setEditingStatusUnit({ id: row.id, status: row.status || "Vacant", name: row.unitName || row.unitNumber || "Unit" }) }}>{row.status || "N/A"}</Badge>
              if (col.key === "floor") return row.floor ? <div className="flex items-center gap-1"><Building2 className="h-3 w-3" /><span>{row.floor.name}{row.floor.floorNumber != null ? ` (#${row.floor.floorNumber})` : ""}</span></div> : "—"
              return undefined
            }}
            renderActions={(unit) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditingUnit(unit); setShowUnitDialog(true) }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUnit(unit)} disabled={deletingUnitId === unit.id}><Trash2 className="mr-2 h-4 w-4" />{deletingUnitId === unit.id ? "Deleting..." : "Delete"}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      </Card>

      <AddUnitDialog
        open={showUnitDialog}
        onOpenChange={(open) => {
          setShowUnitDialog(open)
          if (!open) {
            setEditingUnit(null)
          }
        }}
        onSuccess={fetchUnits}
        unit={editingUnit}
      />
      {editingStatusUnit && (
        <EditStatusDialog
          open={!!editingStatusUnit}
          onOpenChange={(open) => !open && setEditingStatusUnit(null)}
          onSuccess={() => {
            fetchUnits()
            setEditingStatusUnit(null)
          }}
          entityType="unit"
          entityId={editingStatusUnit.id}
          currentStatus={editingStatusUnit.status}
          entityName={editingStatusUnit.name}
        />
      )}

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="unit"
        module="units"
        entityDisplayName="Units"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="properties"
        tab="units"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("properties", "units", filters)
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}
