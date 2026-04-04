"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useDropdownOptions } from "@/hooks/use-dropdowns"
import { SearchableSelect } from "@/components/common/searchable-select"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { DealToasts } from "@/lib/toast-utils"
import { Loader2, Paperclip, Upload, File, Trash2 } from "lucide-react"

interface DealFormData {
  id?: string
  tid?: string
  title?: string
  clientId?: string | null
  propertyId?: string | null
  role?: string | null
  dealAmount?: number | string | null
  stage?: string | null
  status?: string | null
  dealDate?: string | null
  description?: string | null
  dueDate?: string | null
  cancellationReason?: string | null
  attachments?: { name: string; url: string; type: string; size: number }[]
}

interface DealFinancialLinkage {
  hasInvoices: boolean
  hasPayments: boolean
  invoiceCount: number
  paymentCount: number
}

interface AddDealDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: DealFormData | null
  mode?: "create" | "edit"
}

type ClientOption = {
  id: string
  name: string
  tid?: string
}

type PropertyOption = {
  id: string
  name: string

  tid?: string
  propertyCode?: string
  status?: string
  salePrice?: number
}

const FALLBACK_STAGE_OPTIONS = [
  { label: "Prospecting", value: "prospecting" },
  { label: "Qualified", value: "qualified" },
  { label: "Proposal", value: "proposal" },
  { label: "Negotiation", value: "negotiation" },
  { label: "Closing", value: "closing" },
  { label: "Closed Won", value: "closed-won" },
  { label: "Closed Lost", value: "closed-lost" },
]

const ROLE_OPTIONS = [
  { label: "Buyer", value: "buyer" },
  { label: "Seller", value: "seller" },
  { label: "Tenant", value: "tenant" },
  { label: "Landlord", value: "landlord" },
  { label: "Investor", value: "investor" },
  { label: "Partner", value: "partner" },
]

const FALLBACK_STATUS_OPTIONS = [
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
  { label: "Cancelled", value: "cancelled" },
]

type DealFormState = {
  tid: string
  title: string
  clientId: string
  propertyId: string
  role: string
  dealAmount: string
  stage: string
  status: string
  dealDate: string
  description: string
  dueDate: string
  cancellationReason: string
  attachments: { name: string; url: string; type: string; size: number }[]
}

const defaultFormState: DealFormState = {
  tid: "",
  title: "",
  clientId: "",
  propertyId: "",
  role: "buyer",
  dealAmount: "",
  stage: "prospecting",
  status: "open",
  dealDate: new Date().toISOString().split("T")[0],
  description: "",
  dueDate: "",
  cancellationReason: "",
  attachments: [],
}

export function AddDealDialog({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = "create",
}: AddDealDialogProps) {
  const [formData, setFormData] = useState<DealFormState>(defaultFormState)
  // Removed: clients and properties state - now handled by SearchableSelect
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [financialLinkage, setFinancialLinkage] = useState<DealFinancialLinkage | null>(null)
  const [isLoadingLinkage, setIsLoadingLinkage] = useState(false)
  const { toast } = useToast()
  const isEdit = mode === "edit" && !!initialData?.id
  const { options: stageOverrides } = useDropdownOptions("crm.deal.stage")
  const { options: statusOverrides } = useDropdownOptions("crm.deal.status")
  const stageOptions = stageOverrides.length ? stageOverrides : FALLBACK_STAGE_OPTIONS
  const statusOptions = statusOverrides.length ? statusOverrides : FALLBACK_STATUS_OPTIONS
  
  // Determine if deal is closed or cancelled (read-only mode)
  const isClosed = formData.status === "closed" || formData.stage === "closed-won"
  const isCancelled = formData.status === "cancelled" || formData.stage === "closed-lost"
  const isReadOnly = isClosed || isCancelled
  
  // Check if client/property should be immutable
  const isClientImmutable = financialLinkage && (financialLinkage.hasInvoices || financialLinkage.hasPayments)
  const isPropertyImmutable = financialLinkage && (financialLinkage.hasInvoices || financialLinkage.hasPayments)

  useEffect(() => {
    if (!open) return
    const stageValid = stageOverrides.some((option) => option.value === formData.stage)
    if (!stageValid && stageOverrides.length) {
      setFormData((prev) => ({ ...prev, stage: stageOverrides[0].value }))
    }

    const statusValid = statusOverrides.some((option) => option.value === formData.status)
    if (!statusValid && statusOverrides.length) {
      setFormData((prev) => ({ ...prev, status: statusOverrides[0].value }))
    }
  }, [open, formData.stage, formData.status, stageOverrides, statusOverrides])

  // Load financial linkage data when editing
  useEffect(() => {
    if (open && isEdit && initialData?.id) {
      loadFinancialLinkage(initialData.id)
    } else {
      setFinancialLinkage(null)
    }
  }, [open, isEdit, initialData?.id])

  const loadFinancialLinkage = async (dealId: string) => {
    setIsLoadingLinkage(true)
    try {
      // Try to get deal with payments/invoices info
      const deal = await apiService.deals.getById(dealId)
      const dealData: any = deal.data || deal
      
      // Check for payments (they have dealId directly)
      const payments = dealData.payments || []
      const hasPayments = payments.length > 0
      
      // Check for invoices (best-effort via property)
      // Note: Invoice model doesn't have dealId, so we can't directly check
      // This is a limitation - we'll show a warning if property exists
      const hasInvoices = false // Can't reliably check without dealId on Invoice
      const invoiceCount = 0
      
      setFinancialLinkage({
        hasInvoices,
        hasPayments,
        invoiceCount,
        paymentCount: payments.length,
      })
    } catch (error) {
      console.error("Failed to load financial linkage:", error)
      // Set default - assume no linkage if we can't check
      setFinancialLinkage({
        hasInvoices: false,
        hasPayments: false,
        invoiceCount: 0,
        paymentCount: 0,
      })
    } finally {
      setIsLoadingLinkage(false)
    }
  }

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        const existingClientId =
          initialData.clientId !== undefined && initialData.clientId !== null
            ? String(initialData.clientId)
            : ""

        setFormData({
          tid: initialData.tid || "",
          title: initialData.title || "",
          clientId: existingClientId,
          propertyId:
            initialData.propertyId !== undefined && initialData.propertyId !== null
              ? String(initialData.propertyId)
              : "",
          role: initialData.role || "buyer",
          dealAmount:
            initialData.dealAmount !== undefined && initialData.dealAmount !== null
              ? initialData.dealAmount.toString()
              : "",
          stage: initialData.stage || "prospecting",
          status: initialData.status || "open",
          dealDate: initialData.dealDate ? initialData.dealDate.split("T")[0] : new Date().toISOString().split("T")[0],
          description: initialData.description || "",
          dueDate: initialData.dueDate ? initialData.dueDate.split("T")[0] : "",
          cancellationReason: (initialData as any).cancellationReason || "",
          attachments: Array.isArray((initialData as any).attachments?.files) ? (initialData as any).attachments.files : [],
        })
      } else {
        setFormData(defaultFormState)
      }
    }
  }, [open, isEdit, initialData])

  const resetForm = () => {
    setFormData(defaultFormState)
    setErrors({})
    setSubmitting(false)
    setUploading(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const newAttachments: { name: string; url: string; type: string; size: number }[] = []
      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

      for (const file of Array.from(files)) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the maximum size of 10MB`,
            variant: "destructive"
          })
          continue
        }

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

      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...newAttachments],
      }))
    } catch (error) {
      console.error("File upload error:", error)
      toast({
        title: "Upload Failed",
        description: "Could not process the uploaded file(s).",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      // Reset input
      e.target.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate TID (only for new deals)
    if (!isEdit && (!formData.tid || formData.tid.trim() === "")) {
      newErrors.tid = "Transaction ID is required"
    }

    if (!formData.title || formData.title.trim() === "") {
      newErrors.title = "Deal title is required"
    }

    if (!formData.clientId || formData.clientId.trim() === "") {
      newErrors.clientId = "Please select a client"
    }

    if (!formData.propertyId || formData.propertyId.trim() === "") {
      newErrors.propertyId = "Please select a property"
    }

    const dealAmount = Number.parseFloat(formData.dealAmount || "0")
    if (isNaN(dealAmount) || dealAmount <= 0) {
      newErrors.dealAmount = "Deal amount must be a valid number greater than 0. Deal amount is an EXPECTED contract value only."
    }

    // Validate cancellation reason if cancelling
    if ((formData.status === "cancelled" || formData.stage === "closed-lost") && 
        (!formData.cancellationReason || formData.cancellationReason.trim() === "")) {
      newErrors.cancellationReason = "Cancellation reason is required when cancelling a deal"
    }

    // Validate stage restrictions
    if (formData.stage === "prospecting") {
      if (financialLinkage?.hasPayments) {
        newErrors.stage = "Cannot set stage to Prospecting. Deal has payments. Prospecting stage does not allow payments or invoices."
      }
    }

    if (formData.stage === "negotiation") {
      // Check if there are non-advance payments (would need to check payment types)
      // This is a simplified check - backend will enforce the full rule
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        tid: formData.tid,
        title: formData.title,
        clientId: formData.clientId,
        propertyId: formData.propertyId,
        role: formData.role,
        dealAmount: Number(formData.dealAmount),
        stage: formData.stage,
        status: formData.status,
        dealDate: new Date(formData.dealDate || new Date()).toISOString(),
        description: formData.description,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
        cancellationReason: formData.cancellationReason || undefined,
        notes: formData.cancellationReason || formData.description || undefined,
        attachments: formData.attachments.length > 0 ? formData.attachments : undefined,
      }

      let response
      if (isEdit) {
        response = await apiService.deals.update(initialData!.id!, payload)
        DealToasts.updated(payload.title)
      } else {
        response = await apiService.deals.create(payload)
        DealToasts.created(payload.title)
      }

      if (onSuccess) onSuccess()
      onOpenChange(false)
      resetForm()
    } catch (error: any) {
      console.error("Deal submission error:", error)
      
      // Handle DEAL_VIOLATION errors with field-specific mapping
      const errorMessage = error.response?.data?.error || error.message || "Failed to save deal"
      const errorData = error.response?.data
      
      // Check if it's a DEAL_VIOLATION error
      if (errorMessage.includes("DEAL_VIOLATION:")) {
        const violationMessage = errorMessage.replace("DEAL_VIOLATION:", "").trim()
        
        // Map violations to specific fields
        if (violationMessage.includes("Client cannot be changed")) {
          setErrors({ clientId: violationMessage })
        } else if (violationMessage.includes("Property cannot be changed")) {
          setErrors({ propertyId: violationMessage })
        } else if (violationMessage.includes("Cannot reduce deal amount")) {
          setErrors({ dealAmount: violationMessage })
        } else if (violationMessage.includes("Cannot cancel deal")) {
          setErrors({ status: violationMessage, stage: violationMessage })
        } else if (violationMessage.includes("Cancellation reason is required")) {
          setErrors({ cancellationReason: violationMessage })
        } else if (violationMessage.includes("Cannot move deal to")) {
          setErrors({ stage: violationMessage })
        } else if (violationMessage.includes("Closed deals are read-only")) {
          setErrors({ 
            clientId: violationMessage,
            propertyId: violationMessage,
            dealAmount: violationMessage,
          })
        } else {
          // Generic violation error
          setErrors({ _general: violationMessage })
        }
        
        DealToasts.error(violationMessage)
      } else {
        // Regular error handling
        DealToasts.error(errorMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Deal" : "Add New Deal"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update deal details below." : "Enter the details for the new deal."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TID Field */}
            <div className="grid gap-2">
              <Label htmlFor="tid">Transaction ID <span className="text-destructive">*</span></Label>
              <Input
                id="tid"
                placeholder="DL-XXXX"
                value={formData.tid || ""}
                onChange={(e) => {
                  setFormData({ ...formData, tid: e.target.value })
                  if (errors.tid) setErrors({ ...errors, tid: "" })
                }}
                className={errors.tid ? "border-destructive" : ""}
                required
                disabled={isEdit} // TID cannot be changed after creation
              />
              {errors.tid && <p className="text-sm text-destructive">{errors.tid}</p>}
              <p className="text-xs text-muted-foreground">Enter unique transaction ID</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Deal Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="e.g. Downtown Apartment Sale"
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value })
                  if (errors.title) setErrors({ ...errors, title: "" })
                }}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>

            <div className="grid gap-2">
              <SearchableSelect
                source="clients"
                label="Client"
                value={formData.clientId || null}
                onChange={(value) => {
                  setFormData({ ...formData, clientId: value || "" })
                  if (errors.clientId) setErrors({ ...errors, clientId: "" })
                }}
                required
                placeholder="Search and select client..."
                error={!!errors.clientId}
                allowEmpty={false}
                disabled={(isEdit && isClientImmutable) || isReadOnly}
              />
              {errors.clientId && <p className="text-sm text-destructive">{errors.clientId}</p>}
              {isEdit && isClientImmutable && !errors.clientId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Client cannot be changed. Deal has linked financial records ({financialLinkage?.paymentCount || 0} payment(s)).
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <SearchableSelect
                source="properties"
                label="Property"
                value={formData.propertyId || null}
                onChange={(value) => {
                  setFormData({ ...formData, propertyId: value || "" })
                  if (errors.propertyId) setErrors({ ...errors, propertyId: "" })
                }}
                required
                placeholder="Search and select property..."
                error={!!errors.propertyId}
                allowEmpty={false}
                disabled={(isEdit && isPropertyImmutable) || isReadOnly}
              />
              {errors.propertyId && <p className="text-sm text-destructive">{errors.propertyId}</p>}
              {isEdit && isPropertyImmutable && !errors.propertyId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Property cannot be changed. Deal has linked financial records ({financialLinkage?.paymentCount || 0} payment(s)).
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role">Client Role</Label>
              <Select
                value={formData.role || ""}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dealAmount">Deal Amount <span className="text-destructive">*</span></Label>
              <Input
                id="dealAmount"
                type="number"
                placeholder="0.00"
                value={formData.dealAmount || ""}
                onChange={(e) => {
                  setFormData({ ...formData, dealAmount: e.target.value })
                  if (errors.dealAmount) setErrors({ ...errors, dealAmount: "" })
                }}
                className={errors.dealAmount ? "border-destructive" : ""}
                disabled={isReadOnly}
              />
              {errors.dealAmount && <p className="text-sm text-destructive">{errors.dealAmount}</p>}
              {!errors.dealAmount && (
                <p className="text-xs text-muted-foreground">
                  💡 Deal amount is an EXPECTED contract value only. It does not create invoices or accounting entries.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stage">Stage</Label>
              <Select
                value={formData.stage || ""}
                onValueChange={(value) => {
                  setFormData({ ...formData, stage: value })
                  if (errors.stage) setErrors({ ...errors, stage: "" })
                }}
                disabled={isReadOnly}
              >
                <SelectTrigger className={errors.stage ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  {stageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stage && <p className="text-sm text-destructive">{errors.stage}</p>}
              {formData.stage === "prospecting" && !errors.stage && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ Prospecting: No invoices or payments allowed
                </p>
              )}
              {formData.stage === "negotiation" && !errors.stage && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ Negotiation: Advance/token payments only
                </p>
              )}
              {formData.stage === "closing" && !errors.stage && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ Closing: Invoice creation allowed
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || ""}
                onValueChange={(value) => {
                  setFormData({ ...formData, status: value })
                  if (errors.status) setErrors({ ...errors, status: "" })
                }}
                disabled={isReadOnly && !isCancelled} // Allow status change for cancelled deals
              >
                <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.status && <p className="text-sm text-destructive">{errors.status}</p>}
              {isReadOnly && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Closed/Cancelled deals are read-only. Only status/stage changes are allowed.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dealDate">Deal Date</Label>
              <Input
                id="dealDate"
                type="date"
                value={formData.dealDate || ""}
                onChange={(e) => setFormData({ ...formData, dealDate: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate || ""}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter deal description..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-[100px]"
              disabled={isReadOnly}
            />
          </div>

          {/* Cancellation Reason Field - Show when cancelling */}
          {(formData.status === "cancelled" || formData.stage === "closed-lost") && (
            <div className="grid gap-2">
              <Label htmlFor="cancellationReason">
                Cancellation Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cancellationReason"
                placeholder="Please provide a reason for cancelling this deal..."
                value={formData.cancellationReason || ""}
                onChange={(e) => {
                  setFormData({ ...formData, cancellationReason: e.target.value })
                  if (errors.cancellationReason) setErrors({ ...errors, cancellationReason: "" })
                }}
                className={errors.cancellationReason ? "border-destructive" : ""}
                required
              />
              {errors.cancellationReason && (
                <p className="text-sm text-destructive">{errors.cancellationReason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                ⚠️ Cancellation reason is required. Deal cannot be cancelled if it has posted invoices or unreversed payments.
              </p>
            </div>
          )}

          {/* General Error Display */}
          {errors._general && (
            <div className="p-3 border border-destructive rounded-md bg-destructive/10">
              <p className="text-sm text-destructive font-medium">Validation Error</p>
              <p className="text-sm text-destructive mt-1">{errors._general}</p>
            </div>
          )}

          <div className="grid gap-2">
            <Label>Attachments</Label>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Upload Files
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                />
                <span className="text-xs text-muted-foreground">Max 10MB per file</span>
              </div>

              {formData.attachments.length > 0 && (
                <div className="space-y-2">
                  {formData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded bg-muted/20">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <File className="h-4 w-4 flex-shrink-0 text-primary" />
                        <span className="text-sm truncate max-w-[200px]">{file.name}</span>
                        <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeAttachment(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Update Deal" : "Create Deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
