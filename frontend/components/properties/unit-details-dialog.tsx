"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  Home,
  Building2,
  Users,
  Calendar,
  DollarSign,
  Loader2,
  AlertTriangle,
} from "lucide-react"

interface UnitDetailsDialogProps {
  unitId: string | number
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateLease?: (unit: any) => void
  onUpdateUnit?: (unit: any) => void
  onMarkVacant?: (unit: any) => void
}

export function UnitDetailsDialog({
  unitId,
  open,
  onOpenChange,
  onCreateLease,
  onUpdateUnit,
  onMarkVacant,
}: UnitDetailsDialogProps) {
  const [unit, setUnit] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markingVacant, setMarkingVacant] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && unitId) {
      fetchUnit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unitId])

  const fetchUnit = async () => {
    try {
      setLoading(true)
      setError(null)
      const response: any = await apiService.units.getById(String(unitId))
      const responseData = response.data as any
      const data = responseData?.data || responseData
      setUnit(data)
    } catch (err: any) {
      console.error("Failed to fetch unit details:", err)
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch unit details")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const closeDialog = (nextOpen: boolean) => {
    if (!nextOpen) {
      onOpenChange(false)
    } else {
      onOpenChange(true)
    }
  }

  const parseMetaFromDescription = (description: string | null | undefined) => {
    if (!description) return { sizeSqFt: null as number | null, securityDeposit: null as number | null }
    const sizeMatch = description.match(/Size:\s*([0-9]+(?:\.[0-9]+)?)\s*sq ft/i)
    const depositMatch = description.match(/Security deposit:\s*([0-9]+(?:\.[0-9]+)?)/i)
    return {
      sizeSqFt: sizeMatch ? Number(sizeMatch[1]) : null,
      securityDeposit: depositMatch ? Number(depositMatch[1]) : null,
    }
  }

  const getCurrentLease = () => {
    const leases: any[] = unit?.leases || []
    if (!Array.isArray(leases) || leases.length === 0) return null

    const active = leases.find((l) => !l.isDeleted && (l.status === "Active" || l.status === "active"))
    return active || leases[0]
  }

  const computeNextDueRentDate = (lease: any | null) => {
    if (!lease?.leaseStart) return null
    try {
      const start = new Date(lease.leaseStart)
      if (Number.isNaN(start.getTime())) return null

      const today = new Date()
      if (today <= start) return start

      const due = new Date(start)
      while (due <= today) {
        due.setMonth(due.getMonth() + 1)
      }
      return due
    } catch {
      return null
    }
  }

  const handleMarkVacant = async () => {
    if (!unit?.id) return

    if (unit.status === "Vacant") {
      toast({
        title: "Already vacant",
        description: "This unit is already marked as vacant.",
      })
      return
    }

    try {
      setMarkingVacant(true)
      if (onMarkVacant) {
        onMarkVacant(unit)
      } else {
        await apiService.units.update(unit.id, { status: "Vacant" })
        toast({
          title: "Status updated",
          description: "Unit has been marked as vacant.",
        })
        await fetchUnit()
      }
    } catch (err: any) {
      console.error("Failed to mark unit as vacant:", err)
      toast({
        title: "Error",
        description:
          err?.response?.data?.message || err?.response?.data?.error || "Failed to mark unit as vacant",
        variant: "destructive",
      })
    } finally {
      setMarkingVacant(false)
    }
  }

  const lease = getCurrentLease()
  const nextDueDate = computeNextDueRentDate(lease)
  const { sizeSqFt, securityDeposit } = parseMetaFromDescription(unit?.description)

  const unitSize =
    typeof unit?.sizeSqFt === "number" && !Number.isNaN(unit.sizeSqFt)
      ? unit.sizeSqFt
      : sizeSqFt

  const depositValue =
    typeof unit?.securityDeposit === "number" && !Number.isNaN(unit.securityDeposit)
      ? unit.securityDeposit
      : securityDeposit

  const rentValue =
    typeof lease?.rent === "number" && !Number.isNaN(lease.rent)
      ? lease.rent
      : typeof unit?.monthlyRent === "number" && !Number.isNaN(unit.monthlyRent)
      ? unit.monthlyRent
      : null

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="w-[800px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            {loading ? "Unit Details" : unit?.unitName || unit?.unitNumber || "Unit Details"}
          </DialogTitle>
          <DialogDescription>View complete details for this unit.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-12 text-center text-destructive">{error}</div>
        ) : !unit ? (
          <div className="py-12 text-center text-muted-foreground">Unit not found</div>
        ) : (
          <div className="space-y-4">
            {/* Basic Info & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {unit.unitName || unit.unitNumber || "Unit"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {unit.property?.name || "Unknown Property"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    unit.status === "Occupied" || unit.status === "occupied"
                      ? "default"
                      : unit.status === "Vacant" || unit.status === "vacant"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {unit.status || "Unknown"}
                </Badge>
                {unit.floor?.name && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {unit.floor.name}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* 1. Basic Info */}
              <Card className="space-y-3 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">Basic Info</p>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Unit Number</span>
                    <span className="text-foreground">{unit.unitName || unit.unitNumber || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Floor</span>
                    <span className="text-foreground">{unit.floor?.name || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground">{unit.type || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Size</span>
                    <span className="text-foreground">
                      {unitSize ? `${unitSize} sq ft` : "N/A"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* 2. Occupancy */}
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">Occupancy</p>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Current Tenant</span>
                    <span className="text-foreground">
                      {unit.tenant?.name || unit.tenantName || "No active tenant"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Lease Period</span>
                    <span className="text-foreground">
                      {lease?.leaseStart ? new Date(lease.leaseStart).toLocaleDateString() : "-"} -
                      {" "}
                      {lease?.leaseEnd ? new Date(lease.leaseEnd).toLocaleDateString() : "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2 items-start">
                    <span className="text-muted-foreground">Next Due Rent</span>
                    <span className="text-foreground flex items-center gap-1">
                      {nextDueDate ? (
                        <>
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {nextDueDate.toLocaleDateString()}
                        </>
                      ) : (
                        "N/A"
                      )}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* 3. Rental Info */}
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">Rental Info</p>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Rent Amount</span>
                    <span className="text-foreground">
                      {rentValue ? `Rs ${rentValue.toLocaleString("en-IN")}` : "N/A"}
                    </span>
                  </div>
                  <div className="grid grid-cols-[120px,1fr] gap-2">
                    <span className="text-muted-foreground">Deposit</span>
                    <span className="text-foreground">
                      {depositValue != null ? `Rs ${depositValue.toLocaleString("en-IN")}` : "N/A"}
                    </span>
                  </div>
                </div>
              </Card>

              {/* 4. Maintenance */}
              <Card className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">Maintenance</p>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-[140px,1fr] gap-2">
                    <span className="text-muted-foreground">Last maintenance</span>
                    <span className="text-foreground">N/A</span>
                  </div>
                  <div className="grid grid-cols-[140px,1fr] gap-2 items-start">
                    <span className="text-muted-foreground">Upcoming schedules</span>
                    <span className="text-foreground">No schedules recorded</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Description */}
            {unit.description && (
              <Card className="space-y-2 p-4">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">Description</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{unit.description}</p>
              </Card>
            )}

            {/* 5. Actions */}
            <Card className="space-y-3 p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">Actions</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => unit && onCreateLease?.(unit)}
                  disabled={!unit}
                >
                  Create Lease
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => unit && onUpdateUnit?.(unit)}
                  disabled={!unit}
                >
                  Update Unit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start text-destructive border-destructive/40"
                  onClick={handleMarkVacant}
                  disabled={!unit || markingVacant}
                >
                  {markingVacant ? "Marking..." : "Mark as Vacant"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
