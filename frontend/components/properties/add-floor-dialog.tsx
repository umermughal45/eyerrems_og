"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface AddFloorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  propertyId: string
  /** Optional: totalFloors configured on the property to enforce max floorNumber */
  propertyTotalFloors?: number | null
  /** Optional: floor when editing; add mode should usually omit this */
  floor?: any
}

type FloorFormState = {
  floorNumber: string
  floorLabel: string
  totalUnitsOnFloor: string
}

const DEFAULT_FORM_STATE: FloorFormState = {
  floorNumber: "",
  floorLabel: "",
  totalUnitsOnFloor: "",
}

export function AddFloorDialog({
  open,
  onOpenChange,
  onSuccess,
  propertyId,
  propertyTotalFloors,
  floor,
}: AddFloorDialogProps) {
  const [formData, setFormData] = useState<FloorFormState>(DEFAULT_FORM_STATE)
  const [submitting, setSubmitting] = useState(false)
  const [loadingFloors, setLoadingFloors] = useState(false)
  const [existingFloors, setExistingFloors] = useState<any[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()
  const isEditMode = Boolean(floor?.id)

  useEffect(() => {
    if (!open) return

    const loadFloors = async () => {
      try {
        setLoadingFloors(true)
        const response = await apiService.floors.getByProperty(propertyId)
        const floorsData = (response as any)?.data?.data || (response as any)?.data || []
        const normalized = Array.isArray(floorsData) ? floorsData : []
        setExistingFloors(normalized)

        // Auto-suggest next floor number for add mode
        if (!isEditMode) {
          const numbers = normalized
            .map((f: any) => f.floorNumber)
            .filter((n: any) => typeof n === "number" && !Number.isNaN(n))
          const maxExisting = numbers.length ? Math.max(...numbers) : 0
          const suggested = maxExisting + 1
          const withinLimit =
            typeof propertyTotalFloors === "number" && propertyTotalFloors > 0
              ? suggested <= propertyTotalFloors
              : true

          setFormData({
            floorNumber: withinLimit && suggested > 0 ? String(suggested) : "",
            floorLabel: withinLimit && suggested > 0 ? `Floor ${suggested}` : "",
            totalUnitsOnFloor: "",
          })
        }
      } catch (err) {
        console.error("Failed to load floors for property:", err)
        setExistingFloors([])
      } finally {
        setLoadingFloors(false)
      }
    }

    loadFloors()
  }, [open, propertyId, isEditMode])

  useEffect(() => {
    if (open && floor) {
      setFormData({
        floorNumber: floor.floorNumber != null ? String(floor.floorNumber) : "",
        floorLabel: floor.name || "",
        totalUnitsOnFloor: "",
      })
    } else if (open && !floor && !loadingFloors) {
      // In add mode, the auto-suggest effect above already set initial values
      setErrors({})
    }
  }, [open, floor, loadingFloors])

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {}

    const floorNumber = parseInt(formData.floorNumber || "", 10)
    if (!formData.floorNumber || Number.isNaN(floorNumber) || floorNumber < 1) {
      nextErrors.floorNumber = "Floor number must be a positive integer"
    }

    if (typeof propertyTotalFloors === "number" && propertyTotalFloors > 0) {
      if (!Number.isNaN(floorNumber) && floorNumber > propertyTotalFloors) {
        nextErrors.floorNumber = `Floor number cannot exceed total floors (${propertyTotalFloors})`
      }
    }

    if (formData.floorLabel.trim().length === 0) {
      nextErrors.floorLabel = "Floor label is required"
    }

    const totalUnits = parseInt(formData.totalUnitsOnFloor || "", 10)
    if (!formData.totalUnitsOnFloor || Number.isNaN(totalUnits) || totalUnits < 0) {
      nextErrors.totalUnitsOnFloor = "Total units must be zero or a positive integer"
    }

    // Uniqueness check for floorNumber within this property (excluding current floor on edit)
    if (!Number.isNaN(floorNumber)) {
      const duplicate = existingFloors.some((f: any) => {
        if (isEditMode && f.id === floor?.id) return false
        return typeof f.floorNumber === "number" && f.floorNumber === floorNumber
      })
      if (duplicate) {
        nextErrors.floorNumber = "Floor number must be unique for this property"
      }
    }

    return nextErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    try {
      setSubmitting(true)

      const floorNumber = parseInt(formData.floorNumber, 10)
      const totalUnits = parseInt(formData.totalUnitsOnFloor || "0", 10)

      const payload: any = {
        name: formData.floorLabel.trim(),
        floorNumber,
        propertyId,
      }

      // Persist totalUnitsOnFloor information into description for now
      if (!Number.isNaN(totalUnits) && totalUnits >= 0) {
        payload.description = `Planned units on floor: ${totalUnits}`
      }

      if (isEditMode && floor?.id) {
        await apiService.floors.update(floor.id, payload)
        toast({
          title: "Floor updated",
          description: "The floor has been updated successfully.",
        })
      } else {
        await apiService.floors.create(payload)
        toast({
          title: "Success",
          description: "Floor added successfully",
          variant: "default",
        })
      }

      onSuccess?.() // parent should refresh floor list
      onOpenChange(false)
      setFormData(DEFAULT_FORM_STATE)
      setErrors({})
    } catch (err: any) {
      console.error(isEditMode ? "Failed to update floor:" : "Failed to create floor:", err)
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.response?.data?.details
          ? err.response.data.details
              .map((detail: any) => `${detail.path?.join(".")}: ${detail.message}`)
              .join(", ")
          : null) ||
        (isEditMode ? "Failed to update floor" : "Failed to create floor")
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Floor" : "Add New Floor"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the floor details and save your changes."
              : "Enter the details for the new floor."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-6">
            {/* Floor Number */}
            <div className="space-y-2">
              <Label htmlFor="floorNumber">Floor Number</Label>
              <Input
                id="floorNumber"
                type="number"
                min={1}
                value={formData.floorNumber}
                onChange={(e) => setFormData({ ...formData, floorNumber: e.target.value })}
                disabled={loadingFloors}
                className={errors.floorNumber ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Auto-suggests the next available floor number. Must be unique and cannot exceed the property's total
                floors.
              </p>
              {errors.floorNumber && <p className="text-xs text-destructive">{errors.floorNumber}</p>}
            </div>

            {/* Floor Label */}
            <div className="grid gap-2">
              <Label htmlFor="floorLabel">Floor Label</Label>
              <Input
                id="floorLabel"
                placeholder="e.g., Ground Floor, 1st Floor, 2nd Floor"
                value={formData.floorLabel}
                onChange={(e) => setFormData({ ...formData, floorLabel: e.target.value })}
                className={errors.floorLabel ? "border-destructive" : ""}
              />
              {errors.floorLabel && <p className="text-xs text-destructive">{errors.floorLabel}</p>}
            </div>

            {/* Total Units on Floor */}
            <div className="grid gap-2">
              <Label htmlFor="totalUnitsOnFloor">Total Units on Floor</Label>
              <Input
                id="totalUnitsOnFloor"
                type="number"
                min={0}
                value={formData.totalUnitsOnFloor}
                onChange={(e) => setFormData({ ...formData, totalUnitsOnFloor: e.target.value })}
                className={errors.totalUnitsOnFloor ? "border-destructive" : ""}
              />
              {errors.totalUnitsOnFloor && (
                <p className="text-xs text-destructive">{errors.totalUnitsOnFloor}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingFloors}>
              {submitting ? (isEditMode ? "Updating..." : "Adding...") : isEditMode ? "Update Floor" : "Add Floor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

