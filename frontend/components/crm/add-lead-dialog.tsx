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
import { Loader2, X, Plus, MapPin, Thermometer } from "lucide-react"

interface LeadData {
  id?: string
  name?: string
  email?: string
  phone?: string
  source?: string
  interest?: string
  budget?: string
  notes?: string
  cnic?: string
  address?: string
}

interface AddLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: LeadData | null
  mode?: "create" | "edit"
}

// Helper function to convert file to base64
const toBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

const SOURCE_OPTIONS = ["website", "referral", "social", "event", "walk-in", "advertisement", "other"] as const
const INTEREST_OPTIONS = ["buy", "rent", "invest"] as const
const INTEREST_TYPE_OPTIONS = ["residential", "commercial", "industrial", "land"] as const
const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const
const TEMPERATURE_OPTIONS = ["cold", "warm", "hot"] as const
const COMMUNICATION_PREF_OPTIONS = ["email", "phone", "whatsapp", "sms"] as const

const defaultFormState = {
  name: "",
  tid: "",
  email: "",
  phone: "",
  source: "",
  leadSourceDetails: "",
  priority: "medium",
  interest: "",
  interestType: "",
  budget: "",
  budgetMin: "",
  budgetMax: "",
  notes: "",
  cnic: "",
  address: "",
  city: "",
  country: "",
  postalCode: "",
  latitude: "",
  longitude: "",
  expectedCloseDate: "",
  followUpDate: "",
  temperature: "cold",
  communicationPreference: "",
  assignedToUserId: "",
  assignedDealerId: "",
  tags: [] as string[],
  attachments: [] as File[],
  systemId: "",
  manualUniqueId: "",
}

export function AddLeadDialog({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = "create",
}: AddLeadDialogProps) {
  const [formData, setFormData] = useState(defaultFormState)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [agents, setAgents] = useState<any[]>([])
  const [dealers, setDealers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("basic")
  const { toast } = useToast()
  const isEdit = mode === "edit" && initialData?.id

  // Calculate lead score based on form data
  const calculateLeadScore = () => {
    let score = 0
    if (formData.budgetMin && formData.budgetMax) {
      const min = parseFloat(formData.budgetMin) || 0
      const max = parseFloat(formData.budgetMax) || 0
      if (max > 1000000) score += 30
      else if (max > 500000) score += 20
      else if (max > 100000) score += 10
    }
    if (formData.interest) score += 15
    if (formData.interestType) score += 10
    if (formData.email) score += 10
    if (formData.phone) score += 10
    if (formData.expectedCloseDate) score += 15
    if (formData.temperature === "hot") score += 20
    else if (formData.temperature === "warm") score += 10
    if (formData.priority === "urgent") score += 15
    else if (formData.priority === "high") score += 10
    return Math.min(100, score)
  }

  const leadScore = calculateLeadScore()

  useEffect(() => {
    if (open) {
      fetchAgents()
      fetchDealers()
      if (isEdit && initialData) {
        setFormData({
          name: initialData.name || "",
          email: initialData.email || "",
          phone: initialData.phone || "",
          source: initialData.source || "",
          leadSourceDetails: (initialData as any).leadSourceDetails || "",
          priority: (initialData as any).priority || "medium",
          interest: initialData.interest || "",
          interestType: (initialData as any).interestType || "",
          budget: initialData.budget || "",
          budgetMin: (initialData as any).budgetMin || "",
          budgetMax: (initialData as any).budgetMax || "",
          notes: initialData.notes || "",
          cnic: initialData.cnic || "",
          address: initialData.address || "",
          city: (initialData as any).city || "",
          country: (initialData as any).country || "",
          postalCode: (initialData as any).postalCode || "",
          latitude: (initialData as any).latitude || "",
          longitude: (initialData as any).longitude || "",
          expectedCloseDate: (initialData as any).expectedCloseDate ? (initialData as any).expectedCloseDate.split("T")[0] : "",
          followUpDate: (initialData as any).followUpDate ? (initialData as any).followUpDate.split("T")[0] : "",
          temperature: (initialData as any).temperature || "cold",
          communicationPreference: (initialData as any).communicationPreference || "",
          assignedToUserId: (initialData as any).assignedToUserId || "",
          assignedDealerId: (initialData as any).assignedDealerId || "",
          tags: (initialData as any).tags || [],
          attachments: [],
          systemId: (initialData as any).leadCode || "",
          manualUniqueId: (initialData as any).manualUniqueId || "",
          tid: (initialData as any).tid || "",
        })
      } else {
        setFormData(defaultFormState)
      }
    }
  }, [open, isEdit, initialData])

  const fetchAgents = async () => {
    try {
      // TODO: Implement agent/user API endpoint
      // For now, using empty array
      setAgents([])
    } catch (err) {
      console.error("Failed to fetch agents:", err)
    }
  }

  const fetchDealers = async () => {
    try {
      const response: any = await apiService.dealers.getAll()
      const responseData = response.data as any
      const dealersData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setDealers(dealersData.filter((d: any) => d.isActive && !d.isDeleted))
    } catch (err) {
      console.error("Failed to fetch dealers:", err)
      setDealers([])
    }
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !files.length) return
    
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const invalidFiles: string[] = []
    
    // Validate file sizes
    fileArray.forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`)
      } else {
        validFiles.push(file)
      }
    })
    
    // Show error for files that are too large
    if (invalidFiles.length > 0) {
      toast({
        title: "File size too large",
        description: `The following files exceed the 10MB limit: ${invalidFiles.join(", ")}`,
        variant: "destructive",
      })
    }
    
    // Add only valid files
    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...validFiles]
      }))
    }
  }

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }))
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput("")
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  const resetDialog = () => {
    setFormData(defaultFormState)
    setSubmitting(false)
    setTagInput("")
    setActiveTab("basic")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation: Name is required
    if (!formData.name || formData.name.trim().length === 0) {
      toast({
        title: "Validation Error",
        description: "Full Name is required",
        variant: "destructive",
      })
      return
    }
    
    try {
      setSubmitting(true)

      // Upload attachments (optional - lead can be created even if upload fails)
      const uploadedAttachments: any[] = []
      const uploadErrors: string[] = []
      
      for (const file of formData.attachments) {
        try {
          // Check file size before uploading
          if (file.size > MAX_FILE_SIZE) {
            uploadErrors.push(`${file.name} exceeds 10MB limit`)
            continue
          }
          
          const base64 = await toBase64(file)
          
          // Check if base64 string is too large (base64 is ~33% larger than original)
          const base64Size = base64.length
          if (base64Size > 13 * 1024 * 1024) { // ~13MB for base64 of 10MB file
            uploadErrors.push(`${file.name} is too large after encoding`)
            continue
          }
          
          const response: any = await apiService.upload.file({ file: base64, filename: file.name })
          const responseData = response.data as any
          const uploaded = responseData?.data || responseData
          
          if (uploaded?.url || uploaded?.path) {
            uploadedAttachments.push({
              name: file.name,
              url: uploaded?.url || uploaded?.path,
              mimeType: file.type,
              size: file.size,
            })
          } else {
            uploadErrors.push(`${file.name} - upload failed`)
          }
        } catch (err: any) {
          console.error("Failed to upload file:", err)
          const errorMessage = err.response?.data?.error || err.message || "Upload failed"
          uploadErrors.push(`${file.name} - ${errorMessage}`)
        }
      }
      
      // Show warning if some files failed to upload, but continue with lead creation
      if (uploadErrors.length > 0 && formData.attachments.length > 0) {
        toast({
          title: "Some files could not be uploaded",
          description: uploadErrors.join(", "),
          variant: "destructive",
        })
      }

      const normalizedAssignedTo =
        formData.assignedToUserId && formData.assignedToUserId !== "none" ? formData.assignedToUserId : null

      const normalizeDate = (dateValue: string) => {
        if (!dateValue) return null
        const parsed = new Date(dateValue)
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
      }

      const payload = {
        name: formData.name.trim(),
        tid: formData.tid || undefined,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        source: formData.source || null,
        leadSourceDetails: formData.leadSourceDetails?.trim() || null,
        priority: formData.priority,
        score: leadScore,
        interest: formData.interest || null,
        interestType: formData.interestType || null,
        budget: formData.budget?.trim() || null,
        budgetMin: formData.budgetMin ? parseFloat(formData.budgetMin) : null,
        budgetMax: formData.budgetMax ? parseFloat(formData.budgetMax) : null,
        notes: formData.notes?.trim() || null,
        cnic: formData.cnic?.trim() || null,
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        country: formData.country?.trim() || null,
        postalCode: formData.postalCode?.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        expectedCloseDate: normalizeDate(formData.expectedCloseDate),
        followUpDate: normalizeDate(formData.followUpDate),
        temperature: formData.temperature,
        communicationPreference: formData.communicationPreference || null,
        assignedToUserId: normalizedAssignedTo,
        assignedDealerId: formData.assignedDealerId && formData.assignedDealerId !== "none" ? formData.assignedDealerId : null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : null,
        manualUniqueId: formData.manualUniqueId?.trim() || undefined,
      }

      if (isEdit) {
        await apiService.leads.update(initialData!.id!, payload)
        toast({ title: "Lead updated successfully", variant: "success" })
      } else {
        await apiService.leads.create(payload)
        toast({ title: "Lead added successfully", variant: "success" })
      }

      console.log("Lead created successfully, calling onSuccess")
      onSuccess?.()
      onOpenChange(false)
      resetDialog()
    } catch (err: any) {
      console.error("Failed to save lead", err)
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "An error occurred"
      toast({ 
        title: `Failed to ${isEdit ? "update" : "add"} lead`, 
        description: errorMessage,
        variant: "destructive" 
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetDialog()
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lead" : "Add New Lead"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update lead information" : "Enter comprehensive prospect details"}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="assignment">Assignment</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                  <Label htmlFor="tid">TID (Transaction ID) <span className="text-destructive">*</span></Label>
                  <Input
                    id="tid"
                    value={formData.tid}
                    onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
                    placeholder="LEA-XXXX"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Enter unique transaction ID</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manualUniqueId">Manual Unique ID (Optional)</Label>
                  <Input
                    id="manualUniqueId"
                    value={formData.manualUniqueId}
                    onChange={(e) => setFormData({ ...formData, manualUniqueId: e.target.value })}
                    placeholder="Enter custom unique ID (optional)"
                  />
                  <p className="text-xs text-muted-foreground">Optional: Enter a custom unique identifier</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
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
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cnic">CNIC</Label>
                  <Input
                    id="cnic"
                    placeholder="12345-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="source">Lead Source</Label>
                  <Select
                    value={formData.source}
                    onValueChange={(value) => setFormData({ ...formData, source: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="leadSourceDetails">Source Details</Label>
                  <Input
                    id="leadSourceDetails"
                    placeholder="e.g., Facebook Ad Campaign #123"
                    value={formData.leadSourceDetails}
                    onChange={(e) => setFormData({ ...formData, leadSourceDetails: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="interest">Property Interest</Label>
                  <Select
                    value={formData.interest}
                    onValueChange={(value) => setFormData({ ...formData, interest: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select interest" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="interestType">Interest Type</Label>
                  <Select
                    value={formData.interestType}
                    onValueChange={(value) => setFormData({ ...formData, interestType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget Range (Text)</Label>
                  <Input
                    id="budget"
                    placeholder="e.g., $100,000 - $200,000"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Budget Range (Numeric)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      placeholder="Min budget"
                      value={formData.budgetMin}
                      onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Max budget"
                      value={formData.budgetMax}
                      onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Select
                    value={formData.temperature}
                    onValueChange={(value) => setFormData({ ...formData, temperature: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPERATURE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4" />
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                  <Input
                    id="expectedCloseDate"
                    type="date"
                    value={formData.expectedCloseDate}
                    onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="followUpDate">Follow-up Date</Label>
                  <Input
                    id="followUpDate"
                    type="date"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="communicationPreference">Communication Preference</Label>
                  <Select
                    value={formData.communicationPreference}
                    onValueChange={(value) => setFormData({ ...formData, communicationPreference: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMUNICATION_PREF_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Lead Score: <span className="font-bold text-primary">{leadScore}/100</span></Label>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${leadScore}%` }}
                    />
                  </div>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    placeholder="Postal code"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="latitude">Latitude (Optional)</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="0.000001"
                    placeholder="24.8607"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="longitude">Longitude (Optional)</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.000001"
                    placeholder="67.0011"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional information about the lead..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assignment" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="assignedToUserId">Assign to Agent</Label>
                  <Select
                    value={formData.assignedToUserId}
                    onValueChange={(value) => setFormData({ ...formData, assignedToUserId: value })}
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
                  <Label htmlFor="assignedDealerId">Assign to Dealer</Label>
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
                          {dealer.name || dealer.company}
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
                  {formData.tags.length > 0 && (
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

            <TabsContent value="documents" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Attachments</Label>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.txt,.gif"
                      onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum file size: 10MB per file. Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT
                    </p>
                  </div>
                  {formData.attachments.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {formData.attachments.map((file, index) => {
                        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
                        const isLarge = file.size > MAX_FILE_SIZE
                        return (
                          <div 
                            key={index} 
                            className={`flex items-center justify-between rounded-md px-3 py-2 ${
                              isLarge ? "border border-destructive bg-destructive/10" : "bg-muted"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium block truncate">{file.name}</span>
                              <span className={`text-xs ${isLarge ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {fileSizeMB} MB {isLarge && "(Too large - will be skipped)"}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeAttachment(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Add Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
