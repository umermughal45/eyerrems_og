"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Users, Home, FileText } from "lucide-react"
import { apiService } from "@/lib/api"
import { PropertyToasts, showErrorToast } from "@/lib/toast-utils"

interface PropertyDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string | number
  propertyName?: string | null
  propertyCode?: string | null
  onDeleted?: () => void
}

export function PropertyDeleteDialog({
  open,
  onOpenChange,
  propertyId,
  propertyName,
  propertyCode,
  onDeleted,
}: PropertyDeleteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [unitsCount, setUnitsCount] = useState<number | null>(null)
  const [tenantsCount, setTenantsCount] = useState<number | null>(null)
  const [activeLeasesCount, setActiveLeasesCount] = useState<number | null>(null)

  useEffect(() => {
    if (!open || !propertyId) return

    const loadStats = async () => {
      try {
        setStatsLoading(true)

        // Fetch property details for units & tenants
        const propertyResponse: any = await apiService.properties.getById(String(propertyId))
        const propertyData = propertyResponse?.data?.data || propertyResponse?.data

        if (propertyData) {
          const units = Array.isArray(propertyData.units) ? propertyData.units : []
          const unitsFromCount = propertyData._count?.units
          const unitsResolved = typeof unitsFromCount === "number" ? unitsFromCount : units.length
          setUnitsCount(unitsResolved)

          const tenantsFromTotal = propertyData.totalTenants
          if (typeof tenantsFromTotal === "number") {
            setTenantsCount(tenantsFromTotal)
          } else {
            const tenantsFromUnits = units.filter((u: any) => !!u.tenant).length
            setTenantsCount(tenantsFromUnits)
          }
        } else {
          setUnitsCount(0)
          setTenantsCount(0)
        }

        // Fetch all leases and derive active leases for this property
        const leasesResponse: any = await apiService.leases.getAll()
        const leasesData = leasesResponse?.data?.data || leasesResponse?.data || []
        const leases = Array.isArray(leasesData) ? leasesData : []

        const idStr = String(propertyId)
        const activeLeases = leases.filter((lease: any) => {
          const status = (lease.status || "").toString().toLowerCase()
          const isActive = status === "active" || status === "ongoing" || status === "current"

          if (!isActive) return false

          const leasePropertyId =
            lease.propertyId ||
            lease.property?.id ||
            lease.unit?.propertyId ||
            lease.unit?.property?.id

          return leasePropertyId && String(leasePropertyId) === idStr
        })

        setActiveLeasesCount(activeLeases.length)
      } catch (err: any) {
        console.error("Failed to load property delete stats:", err)
        setUnitsCount((prev) => (prev === null ? 0 : prev))
        setTenantsCount((prev) => (prev === null ? 0 : prev))
        setActiveLeasesCount((prev) => (prev === null ? 0 : prev))
      } finally {
        setStatsLoading(false)
      }
    }

    loadStats()
  }, [open, propertyId])

  const hasActiveLeases = !!activeLeasesCount && activeLeasesCount > 0

  const handleClose = () => {
    if (loading) return
    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (hasActiveLeases) {
      showErrorToast("Cannot Delete Property", "This property has active leases. End or remove them before deleting the property.")
      return
    }

    try {
      setLoading(true)
      await apiService.properties.delete(String(propertyId))
      PropertyToasts.deleted(propertyName || "Property")
      onDeleted?.()
      onOpenChange(false)
    } catch (err: any) {
      console.error("Failed to delete property:", err)
      PropertyToasts.error(
        err?.response?.data?.message || err?.response?.data?.error || "Failed to delete property"
      )
    } finally {
      setLoading(false)
    }
  }

  const displayName = propertyName || "This property"
  const displayCode = propertyCode || "N/A"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[900px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Delete Property</DialogTitle>
          <DialogDescription>
            Please confirm you want to permanently delete this property. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Property summary */}
          <Card className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                <p className="text-xs font-mono text-muted-foreground">Code: {displayCode}</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Deleting a property will also remove units that do not have active leases. This operation is permanent.
            </p>
          </Card>

          {/* Stats */}
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground">Linked Records</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>Tenants</span>
                </div>
                <p className="text-base font-semibold text-foreground">
                  {statsLoading && tenantsCount === null ? "--" : tenantsCount ?? 0}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Home className="h-3.5 w-3.5" />
                  <span>Units</span>
                </div>
                <p className="text-base font-semibold text-foreground">
                  {statsLoading && unitsCount === null ? "--" : unitsCount ?? 0}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Active Leases</span>
                </div>
                <p
                  className={`text-base font-semibold ${
                    hasActiveLeases ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {statsLoading && activeLeasesCount === null ? "--" : activeLeasesCount ?? 0}
                </p>
                {hasActiveLeases && (
                  <Badge variant="outline" className="mt-0.5 border-destructive/40 text-[10px] text-destructive">
                    Delete disabled while active leases exist
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || statsLoading || hasActiveLeases}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
