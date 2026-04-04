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

interface AddBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (block?: any) => void
}

export function AddBlockDialog({ open, onOpenChange, onSuccess }: AddBlockDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    propertyId: "",
    description: "",
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
      // Backend returns { success: true, data: [...] }
      const propertiesData = response?.data?.data || response?.data || []
      // Sort properties alphabetically by name
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
        propertyId: formData.propertyId,
      }

      if (formData.description && formData.description.trim()) {
        payload.description = formData.description.trim()
      }

      const response: any = await apiService.blocks.create(payload)
      const createdBlock = response?.data?.data || response?.data || null
      toast({
        title: "Success",
        description: "Block added successfully",
        variant: "default",
      })
      onSuccess?.(createdBlock)
      onOpenChange(false)
      // Reset form
      setFormData({
        name: "",
        propertyId: "",
        description: "",
      })
    } catch (err: any) {
      console.error("Failed to create block:", err)
      toast({
        title: "Error",
        description: err.response?.data?.message || err.response?.data?.error || "Failed to create block",
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
          <DialogTitle>Add New Block</DialogTitle>
          <DialogDescription>Enter the details for the new block</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Block Name</Label>
              <Input
                id="name"
                placeholder="e.g., Block A, Building 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="propertyId">Property</Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => {
                  setFormData({ ...formData, propertyId: value })
                }}
                required
              >
                <SelectTrigger>
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
                        {property.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Block description"
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
              {submitting ? "Adding..." : "Add Block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

