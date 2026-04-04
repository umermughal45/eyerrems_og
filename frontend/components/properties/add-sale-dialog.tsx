"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { AddBuyerDialog } from "./add-buyer-dialog"
import { Plus } from "lucide-react"

interface AddSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddSaleDialog({ open, onOpenChange, onSuccess }: AddSaleDialogProps) {
  const [formData, setFormData] = useState({
    tid: "",
    propertyId: "",
    buyerId: "",
    dealer: "",
    saleValue: "",
    commission: "",
    saleDate: "",
    status: "Pending",
    notes: "",
  })
  const [selectedProperty, setSelectedProperty] = useState<any>(null)
  const [actualPropertyValue, setActualPropertyValue] = useState<number>(0)
  const [profit, setProfit] = useState<number>(0)
  const [documents, setDocuments] = useState<File[]>([])
  const [dealers, setDealers] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAddBuyerDialog, setShowAddBuyerDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchDealers()
      fetchProperties()
      fetchBuyers()
    }
  }, [open])

  const fetchDealers = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.dealers.getAll()
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
    } finally {
      setLoading(false)
    }
  }

  const fetchProperties = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.properties.getAll()
      const responseData = response.data as any
      const propertiesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      
      // Filter out properties with active leases
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
      
      // Filter out properties with active leases and already sold properties
      const filteredProperties = Array.isArray(propertiesData)
        ? propertiesData.filter((property: any) => {
            const isSold = property.status === "Sold" || property.sales?.some((s: any) => s.status === "Completed")
            const hasActiveLease = propertiesWithActiveLeases.includes(property.id)
            return !isSold && !hasActiveLease
          })
        : []
      
      const sortedProperties = filteredProperties.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
      setProperties(sortedProperties)
    } catch (err: any) {
      console.error("Failed to fetch properties:", err)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const fetchBuyers = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.buyers.getAll()
      const responseData = response.data as any
      const buyersData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Sort buyers alphabetically by name
      const sortedBuyers = Array.isArray(buyersData)
        ? buyersData.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
        : []
      setBuyers(sortedBuyers)
    } catch (err: any) {
      console.error("Failed to fetch buyers:", err)
      setBuyers([])
    } finally {
      setLoading(false)
    }
  }

  const handleDealerChange = (dealerId: string) => {
    const dealer = dealers.find((d) => d.id === dealerId)
    setFormData({ ...formData, dealer: dealerId })

    // Auto-calculate commission if sale value exists
    if (formData.saleValue && dealer) {
      const calculatedCommission = (Number.parseFloat(formData.saleValue) * (dealer.commissionRate || 0)) / 100
      setFormData((prev) => ({ ...prev, dealer: dealerId, commission: calculatedCommission.toFixed(2) }))
    }
  }

  const handlePropertyChange = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId)
    setSelectedProperty(property)
    // Prefer explicit sale price from property
    const value =
      (property?.salePrice !== undefined && property?.salePrice !== null
        ? property.salePrice
        : property?.value || property?.actualValue || 0) || 0
    setActualPropertyValue(value)
    setFormData({ ...formData, propertyId, saleValue: value ? value.toString() : "" })
    setProfit(0)
  }

  const handleSalePriceChange = (price: string) => {
    const salePrice = parseFloat(price) || 0
    setFormData((prev) => ({ ...prev, saleValue: price }))
    
    // Calculate profit
    setProfit(salePrice - actualPropertyValue)

    // Auto-calculate commission if dealer is selected (default 2% if no dealer)
    if (price) {
      if (formData.dealer) {
        const dealer = dealers.find((d) => d.id === formData.dealer)
        if (dealer) {
          const calculatedCommission = (salePrice * (dealer.commissionRate || 0)) / 100
          setFormData((prev) => ({ ...prev, saleValue: price, commission: calculatedCommission.toFixed(2) }))
        }
      } else {
        // Default 2% commission if no dealer selected
        const calculatedCommission = (salePrice * 2) / 100
        setFormData((prev) => ({ ...prev, saleValue: price, commission: calculatedCommission.toFixed(2) }))
      }
    }
  }

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setDocuments(Array.from(files))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      
      // Validate required fields
      if (!formData.propertyId) {
        toast({
          title: "Error",
          description: "Please select a property",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }
      
      if (!formData.saleValue || parseFloat(formData.saleValue) <= 0) {
        toast({
          title: "Error",
          description: "Please enter a valid sale price",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      const saleValue = parseFloat(formData.saleValue)
      if (actualPropertyValue && Math.abs(saleValue - actualPropertyValue) > 0.01) {
        toast({
          title: "Error",
          description: "Sale price must match the property's configured sales price",
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }
      const commission = parseFloat(formData.commission) || 0
      
      // Calculate commission rate from commission and sale value
      const commissionRate = saleValue > 0 ? (commission / saleValue) * 100 : 2.0

      // Upload documents if any
      const documentUrls: string[] = []
      if (documents.length > 0) {
        try {
          for (const file of documents) {
            const reader = new FileReader()
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(file)
            })
            
            const uploadResponse: any = await apiService.upload.image({ image: base64, filename: file.name })
            const url = uploadResponse?.data?.url || uploadResponse?.data?.data?.url
            if (url) {
              documentUrls.push(url)
            }
          }
        } catch (uploadErr) {
          console.error("Failed to upload documents:", uploadErr)
          toast({
            title: "Warning",
            description: "Some documents failed to upload. Sale will be created without them.",
            variant: "default",
          })
        }
      }

      const payload: any = {
        tid: formData.tid,
        propertyId: formData.propertyId,
        saleValue: saleValue,
        commissionRate: commissionRate,
        status: formData.status || "Pending",
        actualPropertyValue: actualPropertyValue,
        profit: profit,
      }

      // Add documents if uploaded
      if (documentUrls.length > 0) {
        payload.documents = documentUrls
      }

      // Add dealerId if selected
      if (formData.dealer) {
        payload.dealerId = formData.dealer
      }

      // Convert saleDate to ISO string if provided
      if (formData.saleDate) {
        const date = new Date(formData.saleDate)
        payload.saleDate = date.toISOString()
      }
      
      if (formData.notes && formData.notes.trim()) {
        payload.notes = formData.notes.trim()
      }

      console.log('Sending sale payload:', payload)
      await apiService.sales.create(payload)
      toast({
        title: "Success",
        description: "Sale added successfully",
        variant: "default",
      })
      onSuccess?.()
      onOpenChange(false)
      setFormData({
        tid: "",
        propertyId: "",
        buyerId: "",
        dealer: "",
        saleValue: "",
        commission: "",
        saleDate: "",
        status: "Pending",
        notes: "",
      })
      setSelectedProperty(null)
      setActualPropertyValue(0)
      setProfit(0)
      setDocuments([])
    } catch (err: any) {
      console.error("Failed to create sale:", err)
      console.error("Error response:", err.response?.data)
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          (err.response?.data?.details ? 
                            err.response.data.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ') : 
                            null) ||
                          "Failed to create sale"
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
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Property Sale</DialogTitle>
          <DialogDescription>Enter the details for the new property sale</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="tid">Tracking ID *</Label>
            <Input
              id="tid"
              value={formData.tid}
              onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
              placeholder="SLE-XXXX"
              required
            />
            <p className="text-xs text-muted-foreground">Enter unique tracking ID</p>
          </div>

          {/* Property Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Property Information</h3>
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property</Label>
              <Select
                value={formData.propertyId}
                onValueChange={handlePropertyChange}
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
                    properties.map((property) => {
                      const isSold = property.status === "Sold" || property.sales?.some((s: any) => s.status === "Completed")
                      return (
                        <SelectItem 
                          key={property.id} 
                          value={property.id}
                          disabled={isSold}
                        >
                          {property.tid ? `[${property.tid}] ` : ""}{property.name} - {property.type || "N/A"} {isSold ? "(Already Sold)" : ""}
                        </SelectItem>
                      )
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Buyer Information */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Buyer Information</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddBuyerDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Buyer
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerId">Buyer (Optional)</Label>
              <Select
                value={formData.buyerId}
                onValueChange={(value) => setFormData({ ...formData, buyerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select buyer" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading buyers...</SelectItem>
                  ) : buyers.length === 0 ? (
                    <SelectItem value="none" disabled>No buyers available</SelectItem>
                  ) : (
                    buyers.map((buyer) => (
                      <SelectItem key={buyer.id} value={buyer.id}>
                        {buyer.name} {buyer.email ? `(${buyer.email})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dealer Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Dealer/Agent Information</h3>
            <div className="space-y-2">
              <Label htmlFor="dealer">Assigned Dealer/Agent</Label>
              <Select value={formData.dealer} onValueChange={handleDealerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dealer" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <SelectItem value="loading" disabled>Loading dealers...</SelectItem>
                  ) : dealers.length === 0 ? (
                    <SelectItem value="none" disabled>No dealers available</SelectItem>
                  ) : (
                    dealers.map((dealer) => (
                      <SelectItem key={dealer.id} value={dealer.id}>
                        {dealer.tid ? `[${dealer.tid}] ` : ""}{dealer.name} - {dealer.specialization} ({dealer.commissionRate || 0}%)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sale Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Sale Details</h3>
            {selectedProperty && actualPropertyValue > 0 && (
              <div className="space-y-2 p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Sales Price (Read-only)</Label>
                <p className="text-lg font-semibold text-foreground">Rs {actualPropertyValue.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">This value is read-only</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="saleValue">Sale Price</Label>
                <Input
                  id="saleValue"
                  type="number"
                  step="0.01"
                  value={formData.saleValue}
                  onChange={(e) => handleSalePriceChange(e.target.value)}
                  placeholder="0.00"
                  required
                readOnly={!!selectedProperty?.salePrice}
                className={`${
                  selectedProperty?.salePrice ? "bg-muted" : ""
                }`}
                />
              </div>
              {profit !== 0 && (
                <div className="space-y-2">
                  <Label htmlFor="profit">Profit (Auto-calculated)</Label>
                  <Input
                    id="profit"
                    type="number"
                    value={profit.toFixed(2)}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="commission">Commission (Auto-calculated)</Label>
                <Input
                  id="commission"
                  type="number"
                  value={formData.commission}
                  onChange={(e) => setFormData({ ...formData, commission: e.target.value })}
                  placeholder="0.00"
                  readOnly
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saleDate">Sale Date</Label>
                <Input
                  id="saleDate"
                  type="date"
                  value={formData.saleDate}
                  onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the sale..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documents">Documents (Optional)</Label>
              <Input
                id="documents"
                type="file"
                multiple
                onChange={handleDocumentUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              {documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">Selected files:</p>
                  {documents.map((file, index) => (
                    <p key={index} className="text-xs text-foreground">{file.name}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add Sale"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <AddBuyerDialog
        open={showAddBuyerDialog}
        onOpenChange={(open) => {
          setShowAddBuyerDialog(open)
          if (!open) {
            // Refresh buyers list after adding
            fetchBuyers()
          }
        }}
      />
    </Dialog>
  )
}
