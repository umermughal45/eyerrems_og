"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiService } from "@/lib/api"
import { PropertyToasts, UnitToasts, handleApiError } from "@/lib/toast-utils"

interface EditStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  entityType: "property" | "unit"
  entityId: string | number
  currentStatus: string
  entityName?: string
}

export function EditStatusDialog({
  open,
  onOpenChange,
  onSuccess,
  entityType,
  entityId,
  currentStatus,
  entityName,
}: EditStatusDialogProps) {
  const [status, setStatus] = useState(currentStatus)
  const [submitting, setSubmitting] = useState(false)

  const propertyStatuses = ["Active", "Maintenance", "Vacant", "For Sale", "For Rent", "Sold"]
  const unitStatuses = ["Occupied", "Vacant"]

  const statuses = entityType === "property" ? propertyStatuses : unitStatuses

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      
      if (entityType === "property") {
        await apiService.properties.update(String(entityId), { status })
        PropertyToasts.updated(entityName || "Property")
      } else {
        await apiService.units.update(String(entityId), { status })
        UnitToasts.updated(entityName || "Unit")
      }
      
      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      console.error(`Failed to update ${entityType} status:`, err)
      if (entityType === "property") {
        PropertyToasts.error(err.response?.data?.message || err.response?.data?.error || "Failed to update property status")
      } else {
        UnitToasts.error(err.response?.data?.message || err.response?.data?.error || "Failed to update unit status")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Edit Status</DialogTitle>
          <DialogDescription>
            {entityName && `Update status for ${entityName}`}
            {!entityName && `Update ${entityType === "property" ? "property" : "unit"} status`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

