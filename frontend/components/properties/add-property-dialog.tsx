"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Plus, Trash2, Upload, X, FileText, RefreshCw } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useDropdownOptions } from "@/hooks/use-dropdowns"
import { useDealers } from "@/hooks/use-dealers"
import { useAccounts } from "@/hooks/use-accounts"
import { useAmenities } from "@/hooks/use-amenities"
import { useLeafLocations } from "@/hooks/use-leaf-locations"
import { useSubsidiaryOptions } from "@/hooks/use-subsidiary-options"
import { usePropertyDetails } from "@/hooks/use-property-details"

type PropertyForm = {
  tid: string // Transaction ID - unique across Property, Deal, Client
  type: string
  status: string
  category: string
  size: string
  address: string
  location: string
  locationId: string | null
  subsidiaryOptionId: string | null
  salePrice: string
  totalArea: string
  totalUnits: string
  yearBuilt: string
  dealerId: string
  amenities: string[]
  description: string
  imageUrl: string
}

const DEFAULT_FORM: PropertyForm = {
  tid: "",
  type: "",
  status: "Active",
  category: "",
  size: "",
  address: "",
  location: "",
  locationId: null,
  subsidiaryOptionId: null,
  salePrice: "",
  totalArea: "",
  totalUnits: "",
  yearBuilt: "",
  dealerId: "",
  amenities: [],
  description: "",
  imageUrl: "",
}

type AddPropertyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId?: string | number | null
  onSuccess?: () => void
}

type DropdownKey = "property.type" | "property.category" | "property.status" | "property.size" | "property.location"

const DROPDOWN_LABELS: Record<DropdownKey, string> = {
  "property.type": "Type",
  "property.category": "Category",
  "property.status": "Status",
  "property.size": "Size",
  "property.location": "Location",
}

function ManagedDropdown({
  dropdownKey,
  value,
  onChange,
  required = false,
}: {
  dropdownKey: DropdownKey
  value: string
  onChange: (val: string) => void
  required?: boolean
}) {
  const { options, isLoading, isError, mutate } = useDropdownOptions(dropdownKey)
  const { toast } = useToast()
  const [newLabel, setNewLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const [localOptions, setLocalOptions] = useState<any[]>([])

  // Default fallback options when API fails or returns empty
  const getDefaultOptions = () => {
    switch (dropdownKey) {
      case "property.type":
        return [
          { id: "residential", label: "Residential", value: "residential" },
          { id: "commercial", label: "Commercial", value: "commercial" },
          { id: "industrial", label: "Industrial", value: "industrial" },
          { id: "land", label: "Land", value: "land" },
        ]
      case "property.status":
        return [
          { id: "active", label: "Active", value: "Active" },
          { id: "inactive", label: "Inactive", value: "Inactive" },
          { id: "maintenance", label: "Maintenance", value: "Maintenance" },
        ]
      case "property.category":
        return [
          { id: "apartment", label: "Apartment", value: "apartment" },
          { id: "house", label: "House", value: "house" },
          { id: "villa", label: "Villa", value: "villa" },
          { id: "plot", label: "Plot", value: "plot" },
          { id: "shop", label: "Shop", value: "shop" },
          { id: "office", label: "Office", value: "office" },
        ]
      case "property.size":
        return [
          { id: "small", label: "Small", value: "small" },
          { id: "medium", label: "Medium", value: "medium" },
          { id: "large", label: "Large", value: "large" },
        ]
      case "property.location":
        return [] // No default options - locations must be added via Advanced Options
      default:
        return []
    }
  }

  // Combine API options with local options, avoid duplicates
  const allOptions = useMemo(() => {
    const defaultOpts = getDefaultOptions()
    const apiOpts = options || []
    const localOpts = localOptions || []

    // Combine and deduplicate by value
    const combined = [...defaultOpts, ...apiOpts, ...localOpts]
    const unique = combined.filter((option, index, self) =>
      index === self.findIndex(o => o.value === option.value)
    )

    return unique
  }, [options, localOptions, dropdownKey])

  // Force re-render when options change by updating a version counter
  // Force re-render when options change by updating a version counter
  // Removed to prevent infinite loop - React handles this automatically
  // const [optionsVersion, setOptionsVersion] = useState(0)

  // useEffect(() => {
  //   setOptionsVersion(prev => prev + 1)
  // }, [allOptions])

  const addOption = async () => {
    if (!newLabel.trim()) return

    const newValue = newLabel.trim()
    const newOption = {
      id: `local-${Date.now()}`,
      label: newValue,
      value: newValue,
    }

    setSaving(true)

    // Add locally first for immediate feedback
    setLocalOptions(prev => [...prev, newOption])
    setNewLabel("")

    // Only try API if we can attempt it
    if (canAttemptAPI) {
      try {
        await apiService.advanced.createOption(dropdownKey, {
          label: newValue,
          value: newValue,
        })

        // If API succeeds, refresh the options and remove the local one
        await mutate()
        setLocalOptions(prev => prev.filter(opt => opt.id !== newOption.id))
        toast({ title: "Option added", description: `${newValue} created` })

      } catch (error: any) {
        // If API fails, keep the local option and show message
        if (error?.response?.status === 404) {
          toast({
            title: "Option added locally",
            description: `${newValue} added (server endpoint not available)`
          })
        } else if (error?.response?.status === 401 || error?.response?.status === 403) {
          toast({
            title: "Option added locally",
            description: `${newValue} added (admin access required for server sync)`
          })
        } else {
          toast({
            title: "Option added locally",
            description: `${newValue} added (server sync failed: ${error?.message || 'Unknown error'})`
          })
        }
      }
    } else {
      // No admin access, just show local success message
      toast({
        title: "Option added locally",
        description: `${newValue} added (admin access required for server sync)`
      })
    }

    setSaving(false)
  }

  const removeOption = async (id: string) => {
    const optionToRemove = allOptions.find(opt => opt.id === id)
    if (!optionToRemove) return

    // Always remove from local options first
    setLocalOptions(prev => prev.filter(opt => opt.id !== id))

    // Only try API for non-local options and if we can attempt it
    if (!id.startsWith('local-') && canAttemptAPI) {
      try {
        await apiService.advanced.deleteOption(id)
        await mutate()
        toast({ title: "Option removed" })
      } catch (error: any) {
        if (error?.response?.status === 404) {
          toast({ title: "Option removed locally", description: "Server endpoint not available" })
        } else if (error?.response?.status === 401 || error?.response?.status === 403) {
          toast({ title: "Option removed locally", description: "Admin access required for server sync" })
        } else {
          toast({ title: "Option removed locally", description: "Server sync failed" })
        }
      }
    } else {
      // Local-only removal
      if (id.startsWith('local-')) {
        toast({ title: "Option removed locally" })
      } else {
        toast({ title: "Option removed locally", description: "Admin access required for server removal" })
      }
    }
  }

  // Always use local options for property dropdowns to avoid API errors
  const canAttemptAPI = false

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground">
          {DROPDOWN_LABELS[dropdownKey]} {required && <span className="text-destructive">*</span>}
        </Label>
        {canAttemptAPI && (
          <div className="flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Add option"
              className="h-8 w-32"
            />
            <Button type="button" size="sm" variant="outline" disabled={!newLabel.trim() || saving} onClick={addOption}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      <Select value={value} onValueChange={onChange} disabled={isLoading}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Select ${DROPDOWN_LABELS[dropdownKey]}`} />
        </SelectTrigger>
        <SelectContent>
          {allOptions.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              {dropdownKey === "property.location"
                ? "No locations available. Add locations in Advanced Options."
                : "No options available"}
            </div>
          ) : (
            allOptions.map((opt) => (
              <div key={opt.id} className="flex items-center justify-between px-2">
                <SelectItem value={opt.value}>
                  {dropdownKey === "property.location" && opt.label.includes(">") ? (
                    <span className="flex items-center gap-1">
                      {opt.label.split(">").map((part: string, idx: number, arr: string[]) => (
                        <span key={idx}>
                          <span className="font-medium">{part.trim()}</span>
                          {idx < arr.length - 1 && <span className="text-muted-foreground mx-1">›</span>}
                        </span>
                      ))}
                    </span>
                  ) : (
                    opt.label
                  )}
                </SelectItem>
                {canAttemptAPI && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      removeOption(opt.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Show info message */}
      {localOptions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {localOptions.length} custom option(s) added locally
        </p>
      )}
      {dropdownKey === "property.location" && (!options || options.length === 0) && localOptions.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No locations available. Add locations in Advanced Options (e.g., "Country &gt; State &gt; City").
        </p>
      )}
      {dropdownKey !== "property.location" && (!options || options.length === 0) && (
        <p className="text-xs text-muted-foreground">
          Using default options. Admin can customize in Advanced Settings.
        </p>
      )}
    </div>
  )
}

export function AddPropertyDialog({ open, onOpenChange, propertyId, onSuccess }: AddPropertyDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<PropertyForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<Record<string, string>>({
    asset: "",
    expense: "",
    income: "",
    scrap: "",
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const { dealers, isLoading: dealersLoading } = useDealers()
  const { amenities, isLoading: amenitiesLoading } = useAmenities()
  const { accounts, isLoading: accountsLoading } = useAccounts()
  const { locations: leafLocations, isLoading: loadingLocations, isError: locationError, isValidating: isValidatingLocations, mutate: refreshLocations } = useLeafLocations(open)
  const { options: subsidiaryOptions, isLoading: loadingSubsidiaries } = useSubsidiaryOptions(form.locationId)
  const { propertyData, isLoading: propertyLoading } = usePropertyDetails(propertyId || null, open)
  
  const isEdit = Boolean(propertyId)
  const loading = isEdit && propertyLoading

  useEffect(() => {
    if (!open) {
      setSelectedAccountId({
        asset: "",
        expense: "",
        income: "",
        scrap: "",
      })
      setPhotoFile(null)
      setAttachmentFiles([])
      setForm(DEFAULT_FORM)
      return
    }
  }, [open])

  useEffect(() => {
    if (open && isEdit && propertyData) {
      const documents = typeof propertyData.documents === "object" ? propertyData.documents : {}
      const dealerId = propertyData.dealerId || propertyData.dealer?.id || ""
      const imageUrl = propertyData.imageUrl || ""

      setForm({
        tid: propertyData.tid || "",
        type: propertyData.type || "",
        status: propertyData.status || "Active",
        category: propertyData.category || "",
        size: propertyData.size || "",
        address: propertyData.address || "",
        location: propertyData.location || "",
        locationId: propertyData.locationId || null,
        subsidiaryOptionId: propertyData.subsidiaryOptionId || null,
        salePrice: propertyData.salePrice?.toString() || documents.salePrice?.toString() || "",
        imageUrl: imageUrl,
        totalArea: propertyData.totalArea?.toString() || "",
        totalUnits: propertyData.totalUnits?.toString() || "",
        yearBuilt: propertyData.yearBuilt?.toString() || "",
        dealerId: dealerId,
        amenities: Array.isArray(propertyData.amenities) ? propertyData.amenities : documents.amenities || [],
        description: propertyData.description || "",
      })
    } else if (open && !isEdit) {
      setForm(DEFAULT_FORM)
    }
  }, [open, isEdit, propertyData])


  const handleSave = async () => {
    // No validation - accept any data
    setSaving(true)

    try {
      const formData = new FormData()

      // Add all fields to FormData (all optional - allow empty/partial data)
      if (form.tid) formData.append('tid', form.tid)
      if (form.type) formData.append('type', form.type)
      if (form.category) formData.append('category', form.category)
      if (form.status) formData.append('status', form.status)
      if (form.address) formData.append('address', form.address)

      if (form.location) formData.append('location', form.location)
      if (form.locationId) formData.append('locationId', form.locationId)
      if (form.subsidiaryOptionId) formData.append('subsidiaryOptionId', form.subsidiaryOptionId)
      if (form.description) formData.append('description', form.description)

      // Handle numeric fields - send as strings, backend will coerce
      if (form.size) formData.append('size', form.size)
      if (form.totalArea) formData.append('totalArea', form.totalArea)
      if (form.totalUnits) formData.append('totalUnits', form.totalUnits)
      if (form.yearBuilt) formData.append('yearBuilt', form.yearBuilt)
      if (form.salePrice) formData.append('salePrice', form.salePrice)

      if (form.dealerId && form.dealerId.trim()) {
        formData.append('dealerId', form.dealerId.trim())
      }

      // Handle amenities
      if (form.amenities && form.amenities.length > 0) {
        formData.append('amenities', JSON.stringify(form.amenities))
      }

      // Log payload for debugging
      console.log("Property save payload (FormData entries):", Array.from(formData.entries()))

      // Append files directly to FormData
      if (photoFile) {
        formData.append('photo', photoFile)
      }

      if (attachmentFiles.length > 0) {
        attachmentFiles.forEach((file) => {
          formData.append('attachments', file)
        })
      }

      // Generate name (use provided name or create default)
      // Backend will use 'Unnamed Property' if name is empty, so always append
      const generatedName = form.tid ||
        (form.type && form.address
          ? `${form.type} at ${form.address}`
          : form.type || form.address || "Unnamed Property")
      formData.append('name', generatedName || 'Unnamed Property')

      let createdPropertyId: string | null = null

      if (isEdit) {
        await apiService.properties.update(String(propertyId), formData)
        toast({ title: "Property updated" })
        createdPropertyId = String(propertyId)
      } else {
        const createResponse: any = await apiService.properties.create(formData)
        const createdData = createResponse?.data?.data || createResponse?.data || createResponse
        createdPropertyId = createdData?.id || createdData?.propertyId || null
        toast({ title: "Property created" })
      }

      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Property save error:", error)
      // Don't show validation error toasts - just log and show generic error
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || "Save failed"
      
      // Only show toast for non-validation errors (5xx server errors)
      if (error?.response?.status >= 500 || !error?.response?.status) {
        toast({
          title: "Save failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!propertyId) return
    try {
      const response = await apiService.properties.getReport(String(propertyId))
      const blob = new Blob([response.data as Blob], { type: "application/pdf" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${(form.tid || "property").replace(/\s+/g, "-").toLowerCase()}-report.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      toast({ title: "Report failed", description: error?.message || "Unable to generate PDF", variant: "destructive" })
    }
  }

  const amenitySelected = useMemo(() => new Set(form.amenities), [form.amenities])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
    }
  }

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachmentFiles(Array.from(e.target.files))
    }
  }

  // Filter accounts by type
  const assetAccounts = useMemo(() => accounts.filter((a: any) => a.type?.toLowerCase() === "asset"), [accounts])
  const expenseAccounts = useMemo(() => accounts.filter((a: any) => a.type?.toLowerCase() === "expense"), [accounts])
  const incomeAccounts = useMemo(() => accounts.filter((a: any) => a.type?.toLowerCase() === "revenue" || a.type?.toLowerCase() === "income"), [accounts])
  const scrapAccounts = useMemo(() => accounts.filter((a: any) => a.name?.toLowerCase().includes("scrap") || a.code?.includes("scrap")), [accounts])


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] xl:w-[75vw] sm:max-w-[1400px] max-h-[90vh] p-0 flex flex-col z-50 bg-background">
        <DialogHeader className="px-6 md:px-8 py-4 border-b bg-muted/50">
          <DialogTitle className="flex items-center justify-between text-lg font-semibold">
            <span>{isEdit ? "View / Edit Property" : "Add Property"}</span>
            {propertyData?.propertyCode && (
              <Badge variant="secondary" className="ml-3">
                Code: {propertyData.propertyCode}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {isEdit ? "View and edit property details" : "Fill in the details to add a new property"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="px-6 md:px-8 pb-4">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    <div className="lg:col-span-7 space-y-4">

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="tid">Tracking ID</Label>
                          <Input
                            id="tid"
                            value={form.tid}
                            onChange={(e) => setForm((p) => ({ ...p, tid: e.target.value }))}
                            placeholder="PRO-XXXX (optional)"
                          />
                          <p className="text-xs text-muted-foreground">Enter unique tracking ID (optional)</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Address</Label>
                          <Input
                            value={form.address}
                            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                            placeholder="Address (optional)"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ManagedDropdown
                          dropdownKey="property.type"
                          value={form.type}
                          onChange={(val) => setForm((p) => ({ ...p, type: val }))}
                          required={false}
                        />
                        <ManagedDropdown
                          dropdownKey="property.status"
                          value={form.status}
                          onChange={(val) => setForm((p) => ({ ...p, status: val }))}
                          required={false}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ManagedDropdown
                          dropdownKey="property.category"
                          value={form.category}
                          onChange={(val) => setForm((p) => ({ ...p, category: val }))}
                        />
                        <ManagedDropdown
                          dropdownKey="property.size"
                          value={form.size}
                          onChange={(val) => setForm((p) => ({ ...p, size: val }))}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Sale Price</Label>
                          <Input
                            type="number"
                            value={form.salePrice}
                            onChange={(e) => setForm((p) => ({ ...p, salePrice: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Dealer</Label>
                          <Select
                            value={form.dealerId || "none"}
                            onValueChange={(val) =>
                              setForm((p) => ({
                                ...p,
                                dealerId: val === "none" ? "" : val,
                              }))
                            }
                            disabled={dealersLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={dealersLoading ? "Loading dealers..." : "Select dealer (optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {dealers.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.tid ? `[${d.tid}] ` : ""}{d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Total Area (sq ft)</Label>
                          <Input
                            type="number"
                            value={form.totalArea}
                            onChange={(e) => setForm((p) => ({ ...p, totalArea: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Total Units</Label>
                          <Input
                            type="number"
                            value={form.totalUnits}
                            onChange={(e) => setForm((p) => ({ ...p, totalUnits: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Year Built</Label>
                          <Input
                            type="number"
                            value={form.yearBuilt}
                            onChange={(e) => setForm((p) => ({ ...p, yearBuilt: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          rows={3}
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Property Image</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                        />
                      </div>

                    </div>

                    <div className="lg:col-span-5 space-y-4 lg:pl-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Location</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              refreshLocations()
                            }}
                            disabled={loadingLocations || isValidatingLocations}
                            className="h-7 text-xs"
                          >
                            {(loadingLocations || isValidatingLocations) ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RefreshCw className="h-3 w-3 mr-1" />
                            )}
                            Refresh
                          </Button>
                        </div>
                        <Select
                          value={form.locationId || "none"}
                          onValueChange={(val) => {
                            const selectedLocation = leafLocations.find((loc: any) => loc.id === val)
                            setForm((p) => ({
                              ...p,
                              location: selectedLocation?.path || "",
                              locationId: val === "none" ? null : val,
                              subsidiaryOptionId: null, // Reset subsidiary when location changes
                            }))
                          }}
                          disabled={loadingLocations || isValidatingLocations || locationError}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              (loadingLocations || isValidatingLocations)
                                ? "Loading locations..."
                                : locationError
                                  ? "Error loading locations - Click Refresh"
                                  : "Select location"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {locationError ? (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                <p className="mb-2">Failed to load locations.</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    refreshLocations()
                                  }}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Retry
                                </Button>
                              </div>
                            ) : leafLocations.length === 0 && !loadingLocations && !isValidatingLocations ? (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                No locations available. Add locations in Advanced Options &gt; Location & Subsidiary.
                              </div>
                            ) : loadingLocations || isValidatingLocations ? (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                Loading locations...
                              </div>
                            ) : (
                              (leafLocations || []).map((loc: any) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.path}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        {locationError && (
                          <p className="text-xs text-destructive">
                            Error loading locations. Click Refresh to retry.
                          </p>
                        )}
                        {!locationError && (
                          <p className="text-xs text-muted-foreground">
                            Select a leaf location (only locations without children can be selected). Add locations in Advanced Options &gt; Location & Subsidiary.
                          </p>
                        )}
                      </div>

                      {form.locationId && (
                        <div className="space-y-2">
                          <Label>Property Subsidiary</Label>
                          <div className="text-xs text-muted-foreground mb-2 p-2 bg-muted rounded">
                            Location: {(leafLocations || []).find((loc) => loc.id === form.locationId)?.path || "N/A"}
                          </div>
                          <Select
                            value={form.subsidiaryOptionId || "none"}
                            onValueChange={(val) =>
                              setForm((p) => ({
                                ...p,
                                subsidiaryOptionId: val === "none" ? null : val,
                              }))
                            }
                            disabled={loadingSubsidiaries}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={loadingSubsidiaries ? "Loading..." : "Select subsidiary (optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {(subsidiaryOptions || []).map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(subsidiaryOptions || []).length === 0 && !loadingSubsidiaries && (
                            <p className="text-xs text-muted-foreground">
                              No subsidiaries available for this location. Add them in Advanced Options &gt; Location & Subsidiary.
                            </p>
                          )}
                        </div>
                      )}


                      <div className="space-y-2">
                        <Label>Amenities</Label>
                        {amenitiesLoading ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                              {(amenities || []).map((a: any) => {
                                const active = amenitySelected.has(a.name)
                                return (
                                  <Button
                                    key={a.id}
                                    variant={active ? "default" : "outline"}
                                    size="sm"
                                    onClick={() =>
                                      setForm((p) => ({
                                        ...p,
                                        amenities: active
                                          ? p.amenities.filter((x) => x !== a.name)
                                          : [...p.amenities, a.name],
                                      }))
                                    }
                                    className="justify-start"
                                  >
                                    {a.name}
                                  </Button>
                                )
                              })}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Selected: {form.amenities.length ? form.amenities.join(", ") : "None"}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Asset Account</Label>
                          <Select
                            value={selectedAccountId.asset || "none"}
                            onValueChange={(val) =>
                              setSelectedAccountId((prev) => ({
                                ...prev,
                                asset: val === "none" ? "" : val,
                              }))
                            }
                          >
                            <SelectTrigger disabled={accountsLoading}>
                              <SelectValue placeholder={accountsLoading ? "Loading..." : "Select asset account (optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {(assetAccounts || []).map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Expense Account</Label>
                          <Select
                            value={selectedAccountId.expense || "none"}
                            onValueChange={(val) =>
                              setSelectedAccountId((prev) => ({
                                ...prev,
                                expense: val === "none" ? "" : val,
                              }))
                            }
                          >
                            <SelectTrigger disabled={accountsLoading}>
                              <SelectValue placeholder={accountsLoading ? "Loading..." : "Select expense account (optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {(expenseAccounts || []).map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Income Account</Label>
                          <Select
                            value={selectedAccountId.income || "none"}
                            onValueChange={(val) =>
                              setSelectedAccountId((prev) => ({
                                ...prev,
                                income: val === "none" ? "" : val,
                              }))
                            }
                          >
                            <SelectTrigger disabled={accountsLoading}>
                              <SelectValue placeholder={accountsLoading ? "Loading..." : "Select income account (optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {(incomeAccounts || []).map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Scrap Account</Label>
                          <Select
                            value={selectedAccountId.scrap || "none"}
                            onValueChange={(val) =>
                              setSelectedAccountId((prev) => ({
                                ...prev,
                                scrap: val === "none" ? "" : val,
                              }))
                            }
                          >
                            <SelectTrigger disabled={accountsLoading}>
                              <SelectValue placeholder={accountsLoading ? "Loading..." : "Select scrap account (optional)"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {(scrapAccounts || []).map((account: any) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Attachments</Label>
                        <Input
                          type="file"
                          multiple
                          onChange={handleAttachmentUpload}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 md:px-8 py-2 border-t bg-muted/50 mt-0 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEdit ? "Save Changes" : "Create Property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

