"use client"

import type React from "react"

import { useEffect, useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, X, Plus, Paperclip, Upload, File, Trash2 } from "lucide-react"

interface ClientFormData {
  id?: string
  name?: string
  tid?: string
  email?: string
  phone?: string
  company?: string
  status?: string
  cnic?: string
  address?: string
  city?: string
  country?: string
  postalCode?: string
  clientType?: string
  clientCategory?: string
  propertyInterest?: string
  locationId?: string | null
  billingAddress?: string
  notes?: string
  tags?: string[]
  assignedAgentId?: string
  assignedDealerId?: string
  clientCode?: string
}

interface AddClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: ClientFormData | null
  mode?: "create" | "edit"
}

const CLIENT_STATUSES = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "VIP", value: "vip" },
  { label: "Corporate", value: "corporate" },
]

const CLIENT_TYPES = [
  { label: "Individual", value: "individual" },
  { label: "Corporate", value: "corporate" },
  { label: "Government", value: "government" },
]

const CLIENT_CATEGORIES = [
  { label: "VIP", value: "vip" },
  { label: "Regular", value: "regular" },
  { label: "Corporate", value: "corporate" },
  { label: "Premium", value: "premium" },
]

const PROPERTY_INTEREST_OPTIONS = ["buy", "rent", "invest"] as const

type FormState = ClientFormData & {
  systemId: string
  tid: string
  attachments: { name: string; url: string; type: string; size: number }[]
}

const defaultFormState: FormState = {
  name: "",
  tid: "",
  email: "",
  phone: "",
  company: "",
  status: "active",
  cnic: "",
  address: "",
  city: "",
  country: "",
  postalCode: "",
  clientType: "",
  clientCategory: "",
  propertyInterest: "",
  locationId: null as string | null,
  billingAddress: "",
  notes: "",
  tags: [] as string[],
  assignedAgentId: "",
  assignedDealerId: "",
  systemId: "",
  attachments: [] as { name: string; url: string; type: string; size: number }[],
}



export function AddClientDialog({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = "create",
}: AddClientDialogProps) {
  const [formData, setFormData] = useState<FormState>(defaultFormState as any)
  const [submitting, setSubmitting] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [agents, setAgents] = useState<any[]>([])
  const [dealers, setDealers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("basic")
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const isEdit = mode === "edit" && initialData?.id

  useEffect(() => {
    if (open) {
      fetchAgents()
      fetchDealers()
      if (isEdit && initialData) {
        setFormData({
          name: initialData.name || "",
          tid: initialData.tid || "",
          email: initialData.email || "",
          phone: initialData.phone || "",
          company: initialData.company || "",
          status: initialData.status || "active",
          cnic: initialData.cnic || "",
          address: initialData.address || "",
          city: initialData.city || "",
          country: initialData.country || "",
          postalCode: initialData.postalCode || "",
          clientType: initialData.clientType || "",
          clientCategory: initialData.clientCategory || "",
          propertyInterest: initialData.propertyInterest || "",
          billingAddress: initialData.billingAddress || "",
          notes: "",
          tags: Array.isArray(initialData.tags) ? initialData.tags : [],
          assignedAgentId: initialData.assignedAgentId || "",
          assignedDealerId: initialData.assignedDealerId || "",
          systemId: initialData.clientCode || "",

          attachments: Array.isArray((initialData as any).attachments?.files) ? (initialData as any).attachments.files : [],
        })
      } else {
        setFormData({
          ...defaultFormState,
        })
      }
    }
  }, [open, isEdit, initialData])


  const fetchAgents = async () => {
    try {
      // TODO: Implement agent/user API endpoint
      setAgents([])
    } catch (err) {
      console.error("Failed to fetch agents:", err)
    }
  }

  const fetchDealers = async () => {
    try {
      const response: any = await apiService.dealers.getAll()
      const responseData = response.data as any
      const data = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setDealers(data)
    } catch (err) {
      console.error("Failed to fetch dealers:", err)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !(formData.tags || []).includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tagInput.trim()]
      }))
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(t => t !== tag)
    }))
  }

  const resetForm = () => {
    setFormData(defaultFormState)
    setSubmitting(false)
    setTagInput("")
    setActiveTab("basic")
    setUploading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const newAttachments: { name: string; url: string; type: string; size: number }[] = []

      for (const file of Array.from(files)) {
        // Convert file to base64 for storage (for small files)
        // For production, you'd upload to cloud storage and store URL
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        newAttachments.push({
          name: file.name,
          url: base64,
          type: file.type,
          size: file.size,
        })
      }

      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments]
      }))

      toast({ title: `${newAttachments.length} file(s) added` })
    } catch (err) {
      console.error("Failed to upload file:", err)
      toast({ title: "Failed to upload file", variant: "destructive" })
    } finally {
      setUploading(false)
      e.target.value = "" // Reset input
    }
  }

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()

    // Validation: Name is required
    if (!formData.name || formData.name.trim().length === 0) {
      toast({
        title: "Validation Error",
        description: "Client Name is required",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      // Debug authentication state
      const token = localStorage.getItem('token')
      const user = localStorage.getItem('erp-user')
      console.log('Auth Debug (Frontend):', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'No token',
        hasUser: !!user,
        userInfo: user ? JSON.parse(user) : null
      })

      // Normalize email - if empty string, don't include it in payload to avoid validation issues
      const normalizedEmail = formData.email?.trim()
      // Validate email format if provided
      if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid email address",
          variant: "destructive",
        })
        return
      }

      // Build payload - include all fields that match the updated schema
      const payload: any = {
        name: formData.name.trim(),
      }

      // Add optional fields only if they have values
      if (formData.tid?.trim()) payload.tid = formData.tid.trim()
      if (normalizedEmail) payload.email = normalizedEmail
      if (formData.phone?.trim()) payload.phone = formData.phone.trim()
      if (formData.company?.trim()) payload.company = formData.company.trim()
      if (formData.status) payload.status = formData.status
      if (formData.address?.trim()) payload.address = formData.address.trim()
      if (formData.cnic?.trim()) payload.cnic = formData.cnic.trim()
      if (formData.billingAddress?.trim()) payload.billingAddress = formData.billingAddress.trim()
      if (formData.city?.trim()) payload.city = formData.city.trim()
      if (formData.country?.trim()) payload.country = formData.country.trim()
      if (formData.postalCode?.trim()) payload.postalCode = formData.postalCode.trim()
      if (formData.clientType) payload.clientType = formData.clientType
      if (formData.clientCategory) payload.clientCategory = formData.clientCategory
      if (formData.propertyInterest) payload.propertyInterest = formData.propertyInterest

      
      // Handle assignments - only include if they have valid UUID values
      const normalizedAssignedAgent = formData.assignedAgentId && formData.assignedAgentId !== "none" ? formData.assignedAgentId : null
      const normalizedAssignedDealer = formData.assignedDealerId && formData.assignedDealerId !== "none" ? formData.assignedDealerId : null
      
      if (normalizedAssignedAgent) payload.assignedAgentId = normalizedAssignedAgent
      if (normalizedAssignedDealer) payload.assignedDealerId = normalizedAssignedDealer
      
      // Store notes and file attachments in attachments JSON field
      const attachmentsData: any = {}
      if (formData.notes?.trim()) {
        attachmentsData.notes = formData.notes.trim()
      }
      if (formData.attachments.length > 0) {
        attachmentsData.files = formData.attachments
      }
      if (Object.keys(attachmentsData).length > 0) {
        payload.attachments = attachmentsData
      }
      
      // Add tags if present
      if (formData.tags && formData.tags.length > 0) payload.tags = formData.tags
      console.log("Sending client payload:", JSON.stringify(payload, null, 2))

      if (isEdit) {
        await apiService.clients.update(initialData!.id as any, payload)
        toast({ title: "Client updated successfully", variant: "success" })
      } else {
        await apiService.clients.create(payload)
        toast({ title: "Client added successfully", variant: "success" })
      }

      resetForm()
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      console.error("Failed to save client", error)
      console.error("Error response (stringified):", JSON.stringify(error.response?.data, null, 2))
      console.error("Error status:", error.response?.status)

      // Handle different error types with specific messages
      let errorMessage = "An error occurred"
      let errorTitle = `Failed to ${isEdit ? "update" : "add"} client`

      if (error.response?.status === 401) {
        errorTitle = "Authentication Required"
        if (error.response.data?.code === 'MISSING_AUTH_HEADER') {
          errorMessage = "You are not logged in. Please log in and try again."
        } else if (error.response.data?.code === 'INVALID_TOKEN') {
          errorMessage = "Your session has expired. Please log in again."
        } else if (error.response.data?.code === 'USER_NOT_FOUND') {
          errorMessage = "Your account no longer exists. Please contact support."
        } else {
          errorMessage = error.response.data?.message || "Authentication failed. Please log in again."
        }
        
        // Redirect to login after showing error
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      } else if (error.response?.status === 403) {
        errorTitle = "Access Denied"
        if (error.response.data?.code === 'INSUFFICIENT_PERMISSIONS') {
          errorMessage = `You don't have permission to create clients. Required permission: ${error.response.data?.required}`
        } else if (error.response.data?.code === 'NO_ROLE_OR_PERMISSIONS') {
          errorMessage = "Your account has no permissions assigned. Please contact an administrator."
        } else {
          errorMessage = error.response.data?.message || "You don't have permission to perform this action."
        }
      } else if (error.response?.status === 400) {
        errorTitle = "Validation Error"
        if (error.response.data?.code === 'VALIDATION_ERROR') {
          const validationErrors = error.response.data?.validationErrors || []
          errorMessage = validationErrors.length > 0 
            ? `Validation failed: ${validationErrors.map((err: any) => `${err.field}: ${err.message}`).join(', ')}`
            : "Please check your input and try again."
        } else if (error.response.data?.code === 'TID_VALIDATION_ERROR') {
          errorMessage = `Transaction ID error: ${error.response.data?.message}`
        } else if (error.response.data?.code === 'DUPLICATE_ENTRY') {
          errorMessage = "A client with this information already exists."
        } else if (Array.isArray(error.response.data?.error)) {
          // Zod validation errors
          const validationErrors = error.response.data.error
            .map((err: any) => `${err.path?.join('.') || 'field'}: ${err.message}`)
            .join(', ')
          errorMessage = `Validation errors: ${validationErrors}`
        } else {
          errorMessage = error.response.data?.message || error.response.data?.error || "Invalid data provided."
        }
      } else if (error.response?.status === 500) {
        errorTitle = "Server Error"
        errorMessage = "An internal server error occurred. Please try again later."
      } else if (error.message) {
        errorMessage = error.message
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[1200px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update client information" : "Capture comprehensive client information to start tracking their deals."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="assignment">Assignment</TabsTrigger>
            <TabsTrigger value="additional">Additional</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="systemId">System ID (Auto-generated)</Label>
                  <Input
                    id="systemId"
                    value={formData.systemId || (isEdit ? "Loading..." : "Will be generated on save")}
                    disabled
                    className="bg-muted text-muted-foreground"
                    placeholder="System-generated ID"
                  />
                  <p className="text-xs text-muted-foreground">This ID is automatically generated by the system</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="client-name">Client Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="client-name"
                    placeholder="Jane Smith"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-tid">TID (Transaction ID) <span className="text-destructive">*</span></Label>
                  <Input
                    id="client-tid"
                    placeholder="CLI-XXXX"
                    value={formData.tid}
                    onChange={(event) => setFormData({ ...formData, tid: event.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Enter unique transaction ID</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-email">Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    placeholder="jane.smith@email.com"
                    value={formData.email}
                    onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-phone">Phone</Label>
                  <Input
                    id="client-phone"
                    type="tel"
                    placeholder="+1 234 567 8900"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-cnic">CNIC</Label>
                  <Input
                    id="client-cnic"
                    placeholder="12345-1234567-1"
                    value={formData.cnic}
                    onChange={(event) => setFormData({ ...formData, cnic: event.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-company">Company</Label>
                  <Input
                    id="client-company"
                    placeholder="Company name (optional)"
                    value={formData.company}
                    onChange={(event) => setFormData({ ...formData, company: event.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger id="client-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_STATUSES.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="client-type">Client Type</Label>
                  <Select value={formData.clientType} onValueChange={(value) => setFormData({ ...formData, clientType: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="client-category">Client Category</Label>
                  <Select value={formData.clientCategory} onValueChange={(value) => setFormData({ ...formData, clientCategory: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="property-interest">Property Interest</Label>
                  <Select value={formData.propertyInterest} onValueChange={(value) => setFormData({ ...formData, propertyInterest: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interest" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_INTEREST_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="client-address">Address</Label>
                  <Input
                    id="client-address"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  />
                </div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="billing-address">Billing Address</Label>
                  <Input
                    id="billing-address"
                    placeholder="Billing address (if different)"
                    value={formData.billingAddress}
                    onChange={(event) => setFormData({ ...formData, billingAddress: event.target.value })}
                  />
                </div>
                <div className="grid gap-2 md:col-span-3">
                  <Label htmlFor="client-notes">Notes</Label>
                  <Textarea
                    id="client-notes"
                    placeholder="Additional information about the client..."
                    value={formData.notes}
                    onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="assigned-agent">Assign to Agent</Label>
                  <Select
                    value={formData.assignedAgentId}
                    onValueChange={(value) => setFormData({ ...formData, assignedAgentId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name || agent.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="assigned-dealer">Assign to Dealer</Label>
                  <Select
                    value={formData.assignedDealerId}
                    onValueChange={(value) => setFormData({ ...formData, assignedDealerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dealer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {dealers.map((dealer) => (
                        <SelectItem key={dealer.id} value={dealer.id}>
                          {dealer.tid ? `${dealer.tid} - ${dealer.name || dealer.company}` : (dealer.name || dealer.company)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tags</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addTag()
                        }
                      }}
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="additional" className="space-y-4">
              <div className="rounded-md border border-dashed border-muted px-4 py-3 text-sm text-muted-foreground mb-4">
                Properties are now linked through Deals. Create or update a deal whenever you want to attach this client to a property.
              </div>

              {/* Attachments Section */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </Label>
                <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="client-attachments"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
                  />
                  <label
                    htmlFor="client-attachments"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading ? "Uploading..." : "Click to upload files (PDF, DOC, Images, Excel)"}
                    </span>
                  </label>
                </div>

                {formData.attachments.length > 0 && (
                  <div className="space-y-2">
                    {formData.attachments.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <File className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={(e) => handleSubmit(e)} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
