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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiService } from "@/lib/api"
import { UnitToasts, showErrorToast } from "@/lib/toast-utils"

interface AddUnitDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  unit?: any
  defaultPropertyId?: string
}

const UNIT_TYPES = [
  "Studio",
  "1BHK",
  "2BHK",
  "Shop",
  "Office",
  "Warehouse",
] as const

const UTILITIES = ["Water", "Electricity", "Gas", "Internet"] as const

type UnitStatus = "Vacant" | "Occupied" | "Under Maintenance"

type AddUnitFormState = {
  tid: string
  unitNumber: string
  propertyId: string
  blockId: string
  floorId: string
  status: UnitStatus
  unitType: string
  sizeSqFt: string
  rentPrice: string
  securityDeposit: string
  description: string
  utilitiesIncluded: string[]
}

const DEFAULT_FORM_STATE: AddUnitFormState = {
  tid: "",
  unitNumber: "",
  propertyId: "",
  blockId: "",
  floorId: "",
  status: "Vacant",
  unitType: "",
  sizeSqFt: "",
  rentPrice: "",
  securityDeposit: "",
  description: "",
  utilitiesIncluded: [],
}

export function AddUnitDialog({ open, onOpenChange, onSuccess, unit, defaultPropertyId }: AddUnitDialogProps) {
  const [formData, setFormData] = useState<AddUnitFormState>(DEFAULT_FORM_STATE)
  const [properties, setProperties] = useState<any[]>([])
  const [blocks, setBlocks] = useState<any[]>([])
  const [floors, setFloors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditMode = Boolean(unit?.id)

  useEffect(() => {
    if (open) {
      fetchProperties()
    }
  }, [open])

  useEffect(() => {
    if (open && unit) {
      const propertyId = unit.propertyId || unit.property?.id || ""
      const blockId = unit.blockId || unit.block?.id || ""
      const floorId = unit.floorId || unit.floor?.id || ""
      const statusRaw = (unit.status || "Vacant").toString()
      const normalizedStatus: UnitStatus =
        statusRaw === "Occupied" || statusRaw.toLowerCase() === "occupied"
          ? "Occupied"
          : statusRaw === "Under Maintenance"
            ? "Under Maintenance"
            : "Vacant"

      setFormData({
        tid: unit.tid || "",
        unitNumber: unit.unitName || unit.unitNumber || "",
        propertyId,
        blockId,
        floorId,
        status: normalizedStatus,
        unitType: unit.type || "",
        sizeSqFt:
          typeof unit.sizeSqFt === "number" && !Number.isNaN(unit.sizeSqFt)
            ? String(unit.sizeSqFt)
            : "",
        rentPrice:
          typeof unit.monthlyRent === "number"
            ? String(unit.monthlyRent)
            : unit.monthlyRent || unit.rent
            ? String(unit.monthlyRent || unit.rent)
            : "",
        securityDeposit:
          typeof unit.securityDeposit === "number" && !Number.isNaN(unit.securityDeposit)
            ? String(unit.securityDeposit)
            : "",
        description: unit.description || "",
        utilitiesIncluded: Array.isArray(unit.utilitiesIncluded) ? unit.utilitiesIncluded : [],
      })
      if (propertyId) {
        fetchBlocks(propertyId)
        fetchFloors(propertyId)
      }
    } else if (open && !unit) {
      if (defaultPropertyId) {
        setFormData({ ...DEFAULT_FORM_STATE, propertyId: defaultPropertyId })
        fetchBlocks(defaultPropertyId)
        fetchFloors(defaultPropertyId)
      } else {
        setFormData(DEFAULT_FORM_STATE)
      }
      setBlocks([])
      setFloors([])
      setErrors({})
    }
  }, [unit, open])

  useEffect(() => {
    if (formData.propertyId) {
      fetchBlocks(formData.propertyId)
      fetchFloors(formData.propertyId)
    } else {
      setBlocks([])
      setFloors([])
    }
  }, [formData.propertyId])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.properties.getAll()
      // Backend returns { success: true, data: [...] }
      const propertiesData = response?.data?.data || response?.data || []
      // Filter out sold properties - cannot add units to sold properties
      const availableProperties = (Array.isArray(propertiesData) ? propertiesData : []).filter(
        (p: any) => p.status !== "Sold" && !p.sales?.some((s: any) => s.status === "Completed")
      )
      // Sort properties alphabetically by name
      const sortedProperties = availableProperties.sort((a: any, b: any) => 
        (a.name || "").localeCompare(b.name || "")
      )
      setProperties(sortedProperties)
    } catch (err: any) {
      console.error("Failed to fetch properties:", err)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const fetchBlocks = async (propertyId?: string) => {
    try {
      const targetPropertyId = propertyId ?? formData.propertyId
      if (!targetPropertyId) {
        setBlocks([])
        return
      }
      const response = await apiService.blocks.getAll()
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const blocksData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Filter blocks for selected property and sort alphabetically
      const filteredBlocks = Array.isArray(blocksData)
        ? blocksData
            .filter((block) => block.propertyId === targetPropertyId)
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        : []
      setBlocks(filteredBlocks)
    } catch (err: any) {
      console.error("Failed to fetch blocks:", err)
      setBlocks([])
    }
  }

  const fetchFloors = async (propertyId?: string) => {
    try {
      const targetPropertyId = propertyId ?? formData.propertyId
      if (!targetPropertyId) {
        setFloors([])
        return
      }
      const response = await apiService.floors.getByProperty(targetPropertyId)
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const floorsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Sort floors by floorNumber
      const sortedFloors = Array.isArray(floorsData)
        ? floorsData.sort((a, b) => {
            const aNum = a.floorNumber ?? 999
            const bNum = b.floorNumber ?? 999
            return aNum - bNum
          })
        : []
      setFloors(sortedFloors)
    } catch (err: any) {
      console.error("Failed to fetch floors:", err)
      setFloors([])
    }
  }

  const validate = (): Record<string, string> => {
    const nextErrors: Record<string, string> = {}

    if (!formData.unitNumber.trim()) {
      nextErrors.unitNumber = "Unit number is required"
    }

    if (!formData.tid.trim()) {
      nextErrors.tid = "TID is required"
    }

    if (!formData.propertyId) {
      nextErrors.propertyId = "Property is required"
    }

    if (!formData.status) {
      nextErrors.status = "Status is required"
    }

    const size = formData.sizeSqFt ? parseFloat(formData.sizeSqFt) : NaN
    if (formData.sizeSqFt && (Number.isNaN(size) || size <= 0)) {
      nextErrors.sizeSqFt = "Size must be a positive number"
    }

    const rent = formData.rentPrice ? parseFloat(formData.rentPrice) : NaN
    if (formData.rentPrice && (Number.isNaN(rent) || rent <= 0)) {
      nextErrors.rentPrice = "Rent must be a positive number"
    }

    const deposit = formData.securityDeposit ? parseFloat(formData.securityDeposit) : NaN
    if (formData.securityDeposit && (Number.isNaN(deposit) || deposit < 0)) {
      nextErrors.securityDeposit = "Security deposit must be zero or positive"
    }

    return nextErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors = validate()
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    // Business rule: block creating units directly as Occupied
    if (!isEditMode && formData.status === "Occupied") {
      showErrorToast("Action Blocked", "Units cannot be created as occupied. Create the lease first, then the unit will be marked occupied.")
      return
    }

    try {
      setSubmitting(true)

      const rent = formData.rentPrice ? parseFloat(formData.rentPrice) : NaN
      const deposit = formData.securityDeposit ? parseFloat(formData.securityDeposit) : NaN
      const size = formData.sizeSqFt ? parseFloat(formData.sizeSqFt) : NaN

      const payload: any = {
        tid: formData.tid,
        unitName: formData.unitNumber.trim(),
        propertyId: formData.propertyId,
        status: formData.status,
      }

      if (formData.blockId) payload.blockId = formData.blockId
      if (formData.floorId) payload.floorId = formData.floorId
      if (!Number.isNaN(rent) && rent > 0) payload.monthlyRent = rent

      if (formData.description || formData.unitType || !Number.isNaN(size) || !Number.isNaN(deposit) || formData.utilitiesIncluded.length) {
        const meta: string[] = []
        if (formData.unitType) meta.push(`Type: ${formData.unitType}`)
        if (!Number.isNaN(size) && size > 0) meta.push(`Size: ${size} sq ft`)
        if (!Number.isNaN(deposit) && deposit >= 0) meta.push(`Security deposit: ${deposit}`)
        if (formData.utilitiesIncluded.length) meta.push(`Utilities: ${formData.utilitiesIncluded.join(", ")}`)

        const base = formData.description?.trim() || ""
        payload.description = meta.length
          ? [base, meta.join(" | ")].filter(Boolean).join("\n\n")
          : base
      }

      if (!payload.propertyId) {
        showErrorToast("Validation Error", "Please select a property")
        return
      }

      // Validate property is not sold
      const selectedProperty = properties.find((p: any) => p.id === payload.propertyId)
      if (selectedProperty && (selectedProperty.status === "Sold" || selectedProperty.sales?.some((s: any) => s.status === "Completed"))) {
        showErrorToast("Validation Error", "Cannot add units to a sold property. Please select a different property.")
        return
      }

      if (isEditMode && unit?.id) {
        await apiService.units.update(unit.id, payload)
        UnitToasts.updated(payload.unitName || "Unit")
      } else {
        await apiService.units.create(payload)
        UnitToasts.created(payload.unitName || "Unit")
      }
      onSuccess?.()
      onOpenChange(false)
      // Reset form
      setFormData(DEFAULT_FORM_STATE)
      setErrors({})
      setBlocks([])
      setFloors([])
    } catch (err: any) {
      console.error(isEditMode ? "Failed to update unit:" : "Failed to create unit:", err)
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.response?.data?.details
          ? err.response.data.details
              .map((detail: any) => `${detail.path?.join(".")}: ${detail.message}`)
              .join(", ")
          : null) ||
        (isEditMode ? "Failed to update unit" : "Failed to create unit")
      UnitToasts.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Unit" : "Add New Unit"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the unit information and save your changes." : "Enter the details for the new unit"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tid">TID (Transaction ID)</Label>
                <Input
                  id="tid"
                  placeholder="UNT-XXXX"
                  value={formData.tid}
                 onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
                 className={errors.tid ? "border-destructive" : ""}
               />
               {errors.tid && <p className="text-xs text-destructive">{errors.tid}</p>}
             </div>
             <div className="space-y-2">
                <Label htmlFor="unitNumber">Unit Number</Label>
                <Input
                  id="unitNumber"
                  placeholder="e.g., A-101, Unit 1"
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value })}
                  className={errors.unitNumber ? "border-destructive" : ""}
                />
                {errors.unitNumber && <p className="text-xs text-destructive">{errors.unitNumber}</p>}
              </div>
            </div>

            {/* Property */}
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => {
                  setFormData({ ...formData, propertyId: value, blockId: "" })
                }}
              >
                <SelectTrigger className={errors.propertyId ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading properties...</SelectItem>
                  ) : properties.length === 0 ? (
                    <SelectItem value="none" disabled>No properties available</SelectItem>
                  ) : (
                    properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.tid ? `[${property.tid}] ` : ""}{property.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.propertyId && <p className="text-xs text-destructive">{errors.propertyId}</p>}
            </div>
            {formData.propertyId && blocks.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="blockId">Block (Optional)</Label>
                <Select
                  value={formData.blockId || "none"}
                  onValueChange={(value) => {
                    setFormData({ ...formData, blockId: value === "none" ? "" : value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select block (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {blocks.map((block) => (
                      <SelectItem key={block.id} value={block.id}>
                        {block.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.propertyId && floors.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="floorId">Floor</Label>
                <Select
                  value={formData.floorId || "none"}
                  onValueChange={(value) => {
                    setFormData({ ...formData, floorId: value === "none" ? "" : value })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select floor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {floors.map((floor) => (
                      <SelectItem key={floor.id} value={floor.id}>
                        {floor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Type & Size */}
            <div className="grid gap-2">
              <Label htmlFor="unitType">Type</Label>
              <Select
                value={formData.unitType || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, unitType: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {UNIT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sizeSqFt">Size (sq ft)</Label>
              <Input
                id="sizeSqFt"
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g., 750"
                value={formData.sizeSqFt}
                onChange={(e) => setFormData({ ...formData, sizeSqFt: e.target.value })}
                className={errors.sizeSqFt ? "border-destructive" : ""}
              />
              {errors.sizeSqFt && <p className="text-xs text-destructive">{errors.sizeSqFt}</p>}
            </div>

            {/* Rent & Deposit */}
            <div className="grid gap-2">
              <Label htmlFor="rentPrice">Rent Price</Label>
              <Input
                id="rentPrice"
                type="number"
                step="0.01"
                placeholder="2000"
                value={formData.rentPrice}
                onChange={(e) => setFormData({ ...formData, rentPrice: e.target.value })}
                className={errors.rentPrice ? "border-destructive" : ""}
              />
              {errors.rentPrice && <p className="text-xs text-destructive">{errors.rentPrice}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="securityDeposit">Security Deposit</Label>
              <Input
                id="securityDeposit"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.securityDeposit}
                onChange={(e) => setFormData({ ...formData, securityDeposit: e.target.value })}
                className={errors.securityDeposit ? "border-destructive" : ""}
              />
              {errors.securityDeposit && (
                <p className="text-xs text-destructive">{errors.securityDeposit}</p>
              )}
            </div>

            {/* Status */}
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: UnitStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vacant">Vacant</SelectItem>
                  <SelectItem value="Occupied">Occupied</SelectItem>
                  <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && <p className="text-xs text-destructive">{errors.status}</p>}
            </div>

            {/* Utilities Included */}
            <div className="grid gap-2">
              <Label>Utilities Included</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {UTILITIES.map((util) => {
                  const selected = formData.utilitiesIncluded.includes(util)
                  return (
                    <button
                      key={util}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          utilitiesIncluded: selected
                            ? prev.utilitiesIncluded.filter((u) => u !== util)
                            : [...prev.utilitiesIncluded, util],
                        }))
                      }}
                      className={`flex items-center justify-center rounded-md border px-2 py-1 text-xs transition-colors ${
                        selected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-input bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {util}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Unit description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (isEditMode ? "Saving..." : "Adding...") : isEditMode ? "Save Changes" : "Add Unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
