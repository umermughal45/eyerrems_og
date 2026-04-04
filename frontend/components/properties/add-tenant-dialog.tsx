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
import { TenantToasts, showErrorToast } from "@/lib/toast-utils"

interface AddTenantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  blockId?: string
  onTenantCreated?: (tenant: any) => void
  defaultPropertyId?: string
}

export function AddTenantDialog({ open, onOpenChange, onSuccess, blockId, onTenantCreated, defaultPropertyId }: AddTenantDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    tid: "",
    email: "",
    phone: "",
    address: "",
    cnic: "",
    unitId: "",
    rent: "",
  })
  const [properties, setProperties] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetchProperties()
    }
  }, [open])

  useEffect(() => {
    // When a block is provided, resolve its property so we can show units from the entire property
    const resolvePropertyFromBlock = async () => {
      if (defaultPropertyId) {
        setSelectedPropertyId(defaultPropertyId)
        return
      }
      if (!blockId) {
        setSelectedPropertyId(null)
        return
      }
      try {
        const response = await apiService.blocks.getById(blockId)
        const responseData = response.data as any
        const block = responseData?.data || responseData || null
        const propId = block?.property?.id || block?.propertyId || null
        setSelectedPropertyId(propId || null)
      } catch (err) {
        console.error("Failed to fetch block details:", err)
        setSelectedPropertyId(null)
      }
    }
    resolvePropertyFromBlock()
  }, [blockId, defaultPropertyId])

  useEffect(() => {
    // Fetch all units when dialog opens or selected property changes
    fetchAllUnits()
  }, [open, selectedPropertyId])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const response = await apiService.properties.getAll()
      // Backend returns { success: true, data: [...] }
      const responseData = response.data as any
      const propertiesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Sort properties alphabetically by name
      const sortedProperties = Array.isArray(propertiesData)
        ? propertiesData.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        : []
      setProperties(sortedProperties)
    } catch (err) {
      console.error("Failed to fetch properties:", err)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const fetchAllUnits = async () => {
    try {
      const response = await apiService.units.getAll()
      const responseData = response.data as any
      const unitsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Filter to only show vacant units (units that don't have a tenant)
      let vacantUnits = Array.isArray(unitsData)
        ? unitsData.filter((unit: any) => {
            // Filter out units from houses (houses don't have units)
            if (unit.property?.type === 'house') return false
            // Filter out units from sold properties
            if (unit.property?.status === 'Sold' || unit.property?.sales?.some((s: any) => s.status === 'Completed')) return false
            // Only show vacant units or units without tenants
            return unit.status === 'Vacant' || !unit.tenant
          })
        : []
      // If a property is selected (derived from block), filter units to that property
      if (selectedPropertyId) {
        vacantUnits = vacantUnits.filter((unit: any) => {
          const unitPropId = unit.property?.id || unit.propertyId
          return unitPropId === selectedPropertyId
        })
      }
      // If a blockId is provided, filter units to only those belonging to that block
      if (blockId) {
        vacantUnits = vacantUnits.filter((unit: any) => {
          const unitBlockId = unit.block?.id || unit.blockId
          return unitBlockId === blockId
        })
      }
      // Sort units alphabetically by unitName, then by property name
      const sortedUnits = vacantUnits
        .sort((a, b) => {
          const unitNameA = (a.unitName || "").toLowerCase()
          const unitNameB = (b.unitName || "").toLowerCase()
          if (unitNameA !== unitNameB) {
            return unitNameA.localeCompare(unitNameB)
          }
          // If unit names are same, sort by property name
          const propNameA = (a.property?.name || "").toLowerCase()
          const propNameB = (b.property?.name || "").toLowerCase()
          return propNameA.localeCompare(propNameB)
        })
      setUnits(sortedUnits)
    } catch (err) {
      console.error("Failed to fetch units:", err)
      setUnits([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Validate required fields
      if (!formData.tid || !formData.tid.trim()) {
        showErrorToast("Error", "Tracking ID is required")
        return
      }

      if (!formData.name || !formData.name.trim()) {
        showErrorToast("Error", "Tenant name is required")
        return
      }

      if (!formData.unitId || formData.unitId === "none") {
        showErrorToast("Error", "Please select a unit")
        return
      }
      
      // Validate unitId is a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(formData.unitId)) {
        console.error("Invalid unitId format:", formData.unitId)
        showErrorToast("Error", "Invalid unit selected. Please select a valid unit.")
        return
      }
      
      const payload: any = {
        tid: formData.tid.trim(),
        name: formData.name.trim(),
        unitId: formData.unitId,
      }

      // Only add optional fields if they have values (don't send empty strings)
      if (formData.email && formData.email.trim()) {
        payload.email = formData.email.trim()
      }
      if (formData.phone && formData.phone.trim()) {
        payload.phone = formData.phone.trim()
      }
      if (formData.address && formData.address.trim()) {
        payload.address = formData.address.trim()
      }
      if (formData.cnic && formData.cnic.trim()) {
        payload.cnic = formData.cnic.trim()
      }
      
      // Debug: Log the payload being sent
      console.log('Creating tenant with payload:', payload)
      
      const createRes: any = await apiService.tenants.create(payload)
      const createdTenant = createRes?.data?.data || createRes?.data || null
      TenantToasts.created(formData.name.trim())
      // If rent was provided, update the unit's monthlyRent to reflect it
      if (formData.rent && formData.rent.trim()) {
        const rentValue = parseFloat(formData.rent)
        if (!isNaN(rentValue) && rentValue > 0) {
          try {
            await apiService.units.update(formData.unitId, { monthlyRent: rentValue })
          } catch (rentErr) {
            console.error("Failed to set unit monthlyRent:", rentErr)
            // Don't block tenant creation if setting rent fails
          }
        }
      }
      if (createdTenant) {
        try {
          onTenantCreated?.(createdTenant)
        } catch (err) {
          console.error("onTenantCreated callback error:", err)
        }
      }
      onSuccess?.()
      onOpenChange(false)
      setFormData({
        name: "",
        tid: "",
        email: "",
        phone: "",
        address: "",
        cnic: "",
        unitId: "",
        rent: "",
      })
      setUnits([])
    } catch (err: any) {
      console.error("Failed to create tenant:", err)
      console.error("Error response:", err.response?.data)
      console.error("Error details:", err.response?.data?.details)
      
      // Build detailed error message
      let errorMessage = "Failed to create tenant"
      
      if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
        // Format Zod validation errors
        const validationErrors = err.response.data.details.map((d: any) => {
          const field = d.path || 'unknown'
          return `${field}: ${d.message}`
        })
        errorMessage = validationErrors.join(', ')
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      }
      
      TenantToasts.error(errorMessage)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Tenant</DialogTitle>
          <DialogDescription>Enter the tenant details and lease information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="tid">Tracking ID <span className="text-destructive">*</span></Label>
              <Input
                id="tid"
                value={formData.tid}
                onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
                placeholder="TEN-XXXX"
                required
              />
              <p className="text-xs text-muted-foreground">Enter unique tracking ID</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 234-567-8900"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address (Optional)</Label>
              <Input
                id="address"
                placeholder="Tenant address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cnic">CNIC (Optional)</Label>
              <Input
                id="cnic"
                placeholder="12345-1234567-1"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rent">Monthly Rent</Label>
              <Input
                id="rent"
                type="number"
                step="0.01"
                placeholder="2000"
                value={formData.rent}
                onChange={(e) => setFormData({ ...formData, rent: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unitId">Unit *</Label>
              <Select
                value={formData.unitId}
                onValueChange={(value) => setFormData({ ...formData, unitId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading units...</SelectItem>
                  ) : units.length === 0 ? (
                    <SelectItem value="none" disabled>{selectedPropertyId ? "No vacant units in this property" : "No vacant units available"}</SelectItem>
                  ) : (
                    units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.tid ? `[${unit.tid}] ` : ""}{unit.unitName} - {unit.property?.name || ""} {unit.block?.name ? `(Block ${unit.block.name})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Tenant</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
