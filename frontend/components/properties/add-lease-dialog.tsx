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
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { LeaseToasts, showErrorToast } from "@/lib/toast-utils"

interface AddLeaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  lease?: any
  defaultPropertyId?: string
}

const DEFAULT_FORM_STATE = {
  tid: "",
  tenantId: "",
  propertyId: "",
  unitId: "",
  leaseStart: "",
  leaseEnd: "",
  rent: "",
  notes: "",
  status: "Active" as "Active" | "Expired" | "Terminated" | "Pending",
}

export function AddLeaseDialog({ open, onOpenChange, onSuccess, lease, defaultPropertyId }: AddLeaseDialogProps) {
  const [formData, setFormData] = useState(DEFAULT_FORM_STATE)
  const [dealers, setDealers] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const isEditMode = Boolean(lease?.id)

  useEffect(() => {
    if (open) {
      fetchDealers()
      fetchTenants()
      fetchProperties()
    }
  }, [open])

  useEffect(() => {
    if (open && lease) {
      const tenantId = lease.tenantId || lease.tenant?.id || ""
      const propertyId = lease.propertyId || lease.unit?.propertyId || lease.unit?.property?.id || ""
      const unitId = lease.unitId || lease.unit?.id || ""
      setFormData({
        tid: lease.tid || "",
        tenantId,
        propertyId,
        unitId,
        leaseStart: lease.leaseStart ? new Date(lease.leaseStart).toISOString().slice(0, 10) : "",
        leaseEnd: lease.leaseEnd ? new Date(lease.leaseEnd).toISOString().slice(0, 10) : "",
        rent: lease.rent ? String(lease.rent) : "",
        notes: lease.notes || "",
        status:
          (lease.status === "Active" || lease.status === "Expired" || lease.status === "Terminated" || lease.status === "Pending"
            ? lease.status
            : "Active") ?? "Active",
      })
    } else if (open) {
      if (defaultPropertyId) {
        setFormData({ ...DEFAULT_FORM_STATE, propertyId: defaultPropertyId })
      } else {
        setFormData(DEFAULT_FORM_STATE)
      }
    }
  }, [lease, open, defaultPropertyId])

  useEffect(() => {
    if (formData.propertyId) {
      fetchUnits()
    } else {
      setUnits([])
    }
  }, [formData.propertyId])

  const fetchDealers = async () => {
    try {
      const response = await apiService.dealers.getAll()
      const responseData = response.data as any
      const dealersData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setDealers(Array.isArray(dealersData) ? dealersData : [])
    } catch (err: any) {
      // Dealers endpoint might not exist yet, that's okay - it's optional
      // Silently fail - dealers are optional
      if (err.response?.status !== 404) {
        console.error("Failed to fetch dealers:", err)
      }
      setDealers([])
    }
  }

  const fetchTenants = async () => {
    try {
      const response = await apiService.tenants.getAll()
      const responseData = response.data as any
      const tenantsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Sort tenants alphabetically by name
      const sortedTenants = Array.isArray(tenantsData)
        ? tenantsData.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        : []
      setTenants(sortedTenants)
    } catch (err) {
      console.error("Failed to fetch tenants:", err)
      setTenants([])
    }
  }

  const fetchProperties = async () => {
    try {
      const response = await apiService.properties.getAll()
      const responseData = response.data as any
      const propertiesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      
      // Fetch active leases to filter out properties with active leases
      let propertiesWithActiveLeases: string[] = []
      try {
        const leasesResponse: any = await apiService.leases.getAll()
        const leasesResponseData = leasesResponse.data as any
        const leases = Array.isArray(leasesResponseData?.data) ? leasesResponseData.data : Array.isArray(leasesResponseData) ? leasesResponseData : []
        const activeLeases = Array.isArray(leases) 
          ? leases.filter((l: any) => l.status === 'Active' || l.status === 'active')
          : []
        propertiesWithActiveLeases = activeLeases
          .map((lease: any) => lease.unit?.propertyId || lease.propertyId)
          .filter(Boolean)
      } catch (leaseErr) {
        console.error("Failed to fetch leases for filtering:", leaseErr)
      }
      
      // Filter out properties with active leases and sort alphabetically
      const filteredProperties = Array.isArray(propertiesData)
        ? propertiesData.filter((property: any) => {
            // Don't filter if this is edit mode and the property is already selected
            if (isEditMode && lease?.unit?.propertyId === property.id) {
              return true
            }
            return !propertiesWithActiveLeases.includes(property.id)
          })
        : []
      
      const sortedProperties = filteredProperties.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
      setProperties(sortedProperties)
    } catch (err) {
      console.error("Failed to fetch properties:", err)
      setProperties([])
    }
  }

  const fetchUnits = async () => {
    try {
      if (!formData.propertyId) {
        setUnits([])
        return
      }
      const response = await apiService.units.getAll()
      const responseData = response.data as any
      const unitsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Filter units for selected property, exclude sold properties, and sort alphabetically
      const filteredUnits = Array.isArray(unitsData)
        ? unitsData
            .filter((unit) => {
              const unitPropId = unit.propertyId || unit.property?.id
              // Filter out units from sold properties
              if (unit.property?.status === 'Sold' || unit.property?.sales?.some((s: any) => s.status === 'Completed')) {
                return false
              }
              return unitPropId === formData.propertyId
            })
            .sort((a, b) => (a.unitName || "").localeCompare(b.unitName || ""))
        : []
      setUnits(filteredUnits)
    } catch (err) {
      console.error("Failed to fetch units:", err)
      setUnits([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Validate required fields
      if (!formData.tenantId || formData.tenantId === "none") {
        showErrorToast("Validation Error", "Please select a tenant")
        return
      }
      
      if (!formData.unitId || formData.unitId === "none") {
        showErrorToast("Validation Error", "Please select a unit")
        return
      }
      
      if (!formData.leaseStart) {
        showErrorToast("Validation Error", "Please select a lease start date")
        return
      }
      
      if (!formData.leaseEnd) {
        showErrorToast("Validation Error", "Please select a lease end date")
        return
      }
      
      if (!formData.rent || parseFloat(formData.rent) <= 0) {
        showErrorToast("Validation Error", "Please enter a valid rent amount")
        return
      }
      
      // Convert date strings to ISO datetime strings
      const leaseStartDate = new Date(formData.leaseStart)
      const leaseEndDate = new Date(formData.leaseEnd)
      
      // Set time to start of day for lease start and end of day for lease end
      leaseStartDate.setHours(0, 0, 0, 0)
      leaseEndDate.setHours(23, 59, 59, 999)
      
      // Validate dates
      if (leaseStartDate >= leaseEndDate) {
        showErrorToast("Validation Error", "Lease end date must be after lease start date")
        return
      }

      // Check for overlapping leases on the same unit
      try {
        const existingLeasesResponse: any = await apiService.leases.getAll()
        const existingLeases = existingLeasesResponse?.data?.data || existingLeasesResponse?.data || []
        const overlappingLease = existingLeases.find((existing: any) => {
          if (existing.unitId !== formData.unitId) return false
          if (existing.status !== "Active" && existing.status !== "active") return false
          if (isEditMode && existing.id === lease?.id) return false
          
          const existingStart = new Date(existing.leaseStart)
          const existingEnd = new Date(existing.leaseEnd)
          
          // Check if dates overlap
          return (leaseStartDate <= existingEnd && leaseEndDate >= existingStart)
        })
        
        if (overlappingLease) {
          showErrorToast(
            "Overlapping Lease",
            `This unit already has an active lease from ${new Date(overlappingLease.leaseStart).toLocaleDateString()} to ${new Date(overlappingLease.leaseEnd).toLocaleDateString()}. Please terminate the existing lease first or select a different unit.`
          )
          return
        }
      } catch (checkErr) {
        console.error("Failed to check overlapping leases:", checkErr)
        // Continue with creation if check fails (backend will validate)
      }

      // Validate property is not sold
      const selectedUnit = units.find((u: any) => u.id === formData.unitId)
      if (selectedUnit && selectedUnit.property && (selectedUnit.property.status === "Sold" || selectedUnit.property.sales?.some((s: any) => s.status === "Completed"))) {
        showErrorToast("Validation Error", "Cannot create a lease for a unit in a sold property.")
        return
      }
      
      const payload: any = {
        tid: formData.tid,
        tenantId: formData.tenantId,
        unitId: formData.unitId,
        leaseStart: leaseStartDate.toISOString(),
        leaseEnd: leaseEndDate.toISOString(),
        rent: parseFloat(formData.rent),
        status: formData.status,
      }

      if (formData.notes && formData.notes.trim()) {
        payload.notes = formData.notes.trim()
      }

      if (isEditMode && lease?.id) {
        const response: any = await apiService.leases.update(lease.id, payload)
        const leaseNumber = response?.data?.data?.leaseNumber || response?.data?.leaseNumber
        LeaseToasts.updated(leaseNumber)
      } else {
        const response: any = await apiService.leases.create(payload)
        const leaseNumber = response?.data?.data?.leaseNumber || response?.data?.leaseNumber
        LeaseToasts.created(leaseNumber)
      }
      onSuccess?.()
      onOpenChange(false)
      setFormData(DEFAULT_FORM_STATE)
      setUnits([])
    } catch (err: any) {
      console.error("Failed to create lease:", err)
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          (err.response?.data?.details ? 
                            err.response.data.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ') : 
                            null) ||
                          "Failed to create lease"
      LeaseToasts.error(errorMessage)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Lease" : "Create New Lease"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the lease agreement details." : "Enter the lease agreement details"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="tid">TID *</Label>
              <Input
                id="tid"
                placeholder="LEA-XXXX"
                value={formData.tid}
                onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
                required
                disabled={isEditMode}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenantId">Tenant *</Label>
              <Select 
                value={formData.tenantId} 
                onValueChange={(value) => {
                  const selectedTenant = tenants.find(t => t.id === value)
                  if (selectedTenant?.unit) {
                    const tenantUnit = selectedTenant.unit
                    const propertyId = tenantUnit.propertyId || tenantUnit.property?.id || ""
                    const unitId = tenantUnit.id || ""
                    const monthlyRent = tenantUnit.monthlyRent || selectedTenant.leases?.[0]?.rent || ""
                    setFormData({ 
                      ...formData, 
                      tenantId: value,
                      propertyId: propertyId || formData.propertyId,
                      unitId: unitId || formData.unitId,
                      rent: monthlyRent ? String(monthlyRent) : formData.rent
                    })
                  } else {
                    setFormData({ ...formData, tenantId: value })
                  }
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length === 0 ? (
                    <SelectItem value="none" disabled>No tenants available</SelectItem>
                  ) : (
                    tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} {tenant.email ? `(${tenant.email})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="propertyId">Property *</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => {
                  setFormData({ ...formData, propertyId: value, unitId: "" })
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.length === 0 ? (
                    <SelectItem value="none" disabled>No properties available</SelectItem>
                  ) : (
                    properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            {formData.propertyId && (
              <div className="grid gap-2">
                <Label htmlFor="unitId">Unit *</Label>
                <Select
                  value={formData.unitId}
                  onValueChange={(value) => {
                    const selectedUnit = units.find(u => u.id === value)
                    const monthlyRent = selectedUnit?.monthlyRent || ""
                    setFormData({ 
                      ...formData, 
                      unitId: value,
                      rent: monthlyRent ? String(monthlyRent) : formData.rent
                    })
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.length === 0 ? (
                      <SelectItem value="none" disabled>No units available for this property</SelectItem>
                    ) : (
                      units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.tid ? `[${unit.tid}] ` : ""}{unit.unitName} {unit.block?.name ? `(Block ${unit.block.name})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="leaseStart">Start Date</Label>
              <Input
                id="leaseStart"
                type="date"
                value={formData.leaseStart}
                onChange={(e) => setFormData({ ...formData, leaseStart: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leaseEnd">End Date</Label>
              <Input
                id="leaseEnd"
                type="date"
                value={formData.leaseEnd}
                onChange={(e) => setFormData({ ...formData, leaseEnd: e.target.value })}
                required
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
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "Active" | "Pending" | "Expired" | "Terminated") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Enter lease notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Lease</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
