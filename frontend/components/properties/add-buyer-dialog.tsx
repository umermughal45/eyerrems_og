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
import { useToast } from "@/hooks/use-toast"

interface AddBuyerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddBuyerDialog({ open, onOpenChange, onSuccess }: AddBuyerDialogProps) {
  const [formData, setFormData] = useState({
    tid: "",
    name: "",
    email: "",
    phone: "",
    propertyId: "",
    address: "",
    buyStatus: "Pending",
    buyValue: "",
    notes: "",
  })
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchProperties()
    }
  }, [open])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.properties.getAll()
      const propertiesData = response?.data?.data || response?.data || []
      const sortedProperties = Array.isArray(propertiesData)
        ? propertiesData.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
        : []
      setProperties(sortedProperties)
    } catch (err: any) {
      console.error("Failed to fetch properties:", err)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      
      const payload: any = {
        name: formData.name.trim(),
        buyStatus: formData.buyStatus || "Pending",
      }
      
      if (formData.email && formData.email.trim()) {
        payload.email = formData.email.trim()
      }
      if (formData.phone && formData.phone.trim()) {
        payload.phone = formData.phone.trim()
      }
      if (formData.address && formData.address.trim()) {
        payload.address = formData.address.trim()
      }
      if (formData.propertyId && formData.propertyId !== "none") {
        payload.propertyId = formData.propertyId
      }
      if (formData.buyValue && parseFloat(formData.buyValue) > 0) {
        payload.buyValue = parseFloat(formData.buyValue)
      }
      if (formData.notes && formData.notes.trim()) {
        payload.notes = formData.notes.trim()
      }
      
      await apiService.buyers.create(payload)
      toast({
        title: "Success",
        description: "Buyer added successfully",
        variant: "default",
      })
      onSuccess?.()
      onOpenChange(false)
      setFormData({
        tid: "",
        name: "",
        email: "",
        phone: "",
        propertyId: "",
        address: "",
        buyStatus: "Pending",
        buyValue: "",
        notes: "",
      })
    } catch (err: any) {
      console.error("Failed to create buyer:", err)
      toast({
        title: "Error",
        description: err.response?.data?.message || err.response?.data?.error || "Failed to create buyer",
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
          <DialogTitle>Add New Buyer</DialogTitle>
          <DialogDescription>Enter the buyer details and property interest information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="tid">TID (Transaction ID)</Label>
              <Input
                id="tid"
                placeholder="BUY-XXXX"
                value={formData.tid}
                onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 234-567-8900"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="propertyId">Property Interest</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => setFormData({ ...formData, propertyId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading properties...</SelectItem>
                  ) : properties.length === 0 ? (
                    <SelectItem value="no-properties" disabled>No properties available</SelectItem>
                  ) : (
                    properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name} - {property.type || "N/A"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="buyValue">Buy Value</Label>
              <Input
                id="buyValue"
                type="number"
                step="0.01"
                placeholder="850000"
                value={formData.buyValue}
                onChange={(e) => setFormData({ ...formData, buyValue: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Buyer address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="buyStatus">Status</Label>
              <Select value={formData.buyStatus} onValueChange={(value) => setFormData({ ...formData, buyStatus: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Additional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Buyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
