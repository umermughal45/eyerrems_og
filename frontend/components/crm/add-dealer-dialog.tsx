"use client"

import type React from "react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Paperclip, Upload, File, Trash2, Loader2 } from "lucide-react"

interface DealerFormData {
  id?: string
  name?: string
  email?: string
  phone?: string
  company?: string
  commissionRate?: number | string | null
  notes?: string | null
  cnic?: string
  address?: string
  tid?: string
  attachments?: { name: string; url: string; type: string; size: number }[]
}

interface AddDealerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: DealerFormData | null
  mode?: "create" | "edit"
}

const defaultFormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  commissionRate: "",
  notes: "",
  cnic: "",
  address: "",
  systemId: "",
  tid: "",
  attachments: [] as { name: string; url: string; type: string; size: number }[],
}

export function AddDealerDialog({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = "create",
}: AddDealerDialogProps) {
  const [formData, setFormData] = useState(defaultFormState)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const isEdit = mode === "edit" && !!initialData?.id

  useEffect(() => {
    if (open) {
      if (isEdit && initialData) {
        setFormData({
          name: initialData.name || "",
          email: initialData.email || "",
          phone: initialData.phone || "",
          company: initialData.company || "",
          commissionRate:
            initialData.commissionRate !== undefined && initialData.commissionRate !== null
              ? initialData.commissionRate.toString()
              : "",
          notes: initialData.notes || "",
          cnic: initialData.cnic || "",
          address: initialData.address || "",
          systemId: (initialData as any).dealerCode || "",
          tid: initialData.tid || "",
          attachments: (initialData as any)?.attachments?.files || [],
        })
      } else {
        setFormData(defaultFormState)
      }
    }
  }, [open, isEdit, initialData])

  const resetForm = () => {
    setFormData(defaultFormState)
    setSubmitting(false)
    setUploading(false)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      const newAttachments: { name: string; url: string; type: string; size: number }[] = []
      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the maximum size of 10MB`,
            variant: "destructive"
          })
          continue
        }

        const reader = new FileReader()
        const base64: string = await new Promise((resolve, reject) => {
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
      e.target.value = ""
    }
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const payload: any = {
        tid: formData.tid,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company || null,
        commissionRate: formData.commissionRate ? Number.parseFloat(formData.commissionRate) : null,
        cnic: formData.cnic || null,
        address: formData.address || null,
        isActive: true,
      }

      // Handle attachments
      if (formData.attachments.length > 0) {
        const attachmentsData: any = {}
        if (formData.notes?.trim()) {
          attachmentsData.notes = formData.notes.trim()
        }
        attachmentsData.files = formData.attachments
        payload.attachments = attachmentsData
      }

      if (isEdit) {
        await apiService.dealers.update(initialData!.id!, payload)
        toast({ title: "Dealer updated successfully" })
      } else {
        await apiService.dealers.create(payload)
        toast({ title: "Dealer added successfully" })
      }

      console.log("Dealer created successfully, calling onSuccess")
      onOpenChange(false)
      resetForm()
      onSuccess?.()
    } catch (error) {
      console.error("Failed to save dealer", error)
      toast({ title: `Failed to ${isEdit ? "update" : "add"} dealer`, variant: "destructive" })
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
      <DialogContent className="w-[900px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Dealer/Agent" : "Add New Dealer/Agent"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update dealer details to keep information accurate."
              : "Capture dealer details to make them available across CRM workflows."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
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
            <div className="space-y-2">
              <Label htmlFor="tid">TID (Transaction ID) *</Label>
              <Input
                id="tid"
                value={formData.tid}
                onChange={(e) => setFormData({ ...formData, tid: e.target.value })}
                placeholder="DEA-XXXX"
                required
                disabled={isEdit && !!initialData?.tid}
              />
              <p className="text-xs text-muted-foreground">Enter unique transaction ID</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter dealer name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="dealer@example.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company / Firm</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company name (optional)"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commissionRate">Commission Rate (%)</Label>
              <Input
                id="commissionRate"
                type="number"
                min="0"
                step="0.1"
                value={formData.commissionRate}
                onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                placeholder="5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cnic">CNIC</Label>
              <Input
                id="cnic"
                value={formData.cnic}
                onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                placeholder="12345-1234567-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter dealer address"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about the dealer..."
              rows={3}
            />
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
                id="dealer-attachments"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
              />
              <label
                htmlFor="dealer-attachments"
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

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Dealer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
