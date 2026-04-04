"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2, DollarSign, Upload, X, FileText, ImageIcon } from "lucide-react"
import { format } from "date-fns"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ReceiptCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealId: string
  clientId: string
  onSuccess?: () => void
}

export function ReceiptCreationDialog({
  open,
  onOpenChange,
  dealId,
  clientId,
  onSuccess,
}: ReceiptCreationDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<"Cash" | "Bank">("Cash")
  const [date, setDate] = useState<Date>(new Date())
  const [notes, setNotes] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [manualUniqueId, setManualUniqueId] = useState("")
  const [attachments, setAttachments] = useState<Array<{ url: string; name: string; mimeType?: string }>>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !files.length) return

    setUploadingAttachments(true)
    try {
      const uploads: Array<{ url: string; name: string; mimeType?: string }> = []
      
      for (const file of Array.from(files)) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          toast({
            title: "Invalid file type",
            description: `File "${file.name}" is not supported. Only PDF, JPG, PNG, GIF, and WEBP files are allowed`,
            variant: "destructive",
          })
          continue
        }

        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `File "${file.name}" exceeds 10MB limit`,
            variant: "destructive",
          })
          continue
        }

        const base64 = await toBase64(file)
        uploads.push({
          url: base64,
          name: file.name,
          mimeType: file.type,
        })
      }

      if (uploads.length > 0) {
        setAttachments((prev) => [...prev, ...uploads])
        toast({ title: `${uploads.length} file(s) added successfully` })
      }
    } catch (error: any) {
      toast({
        title: "Failed to add attachment",
        description: error?.message || "Upload failed",
        variant: "destructive",
      })
    } finally {
      setUploadingAttachments(false)
      if (e.target) {
        e.target.value = ""
      }
    }
  }

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      const response: any = await apiService.receipts.create({
        dealId,
        clientId,
        amount: parseFloat(amount),
        method,
        date: date.toISOString(),
        notes: notes || null,
        referenceNumber: referenceNumber.trim() || undefined,
        manualUniqueId: manualUniqueId.trim() || undefined,
        attachments: attachments.length > 0 ? attachments.map(a => ({
          name: a.name,
          url: a.url,
          mimeType: a.mimeType,
        })) : undefined,
      })

      if (response?.data?.success || response?.success) {
        toast({
          title: "Success",
          description: `Receipt created successfully. ${response.data?.totalAllocated || 0} allocated to installments.`,
        })
        setAmount("")
        setNotes("")
        setReferenceNumber("")
        setManualUniqueId("")
        setDate(new Date())
        setAttachments([])
        onOpenChange(false)
        onSuccess?.()
      } else {
        throw new Error(response?.error || "Failed to create receipt")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create receipt",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Payment (Create Receipt)</DialogTitle>
          <DialogDescription>
            Create a receipt for payment received. The system will automatically allocate the amount to installments using FIFO.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="systemId">System ID (Auto-generated)</Label>
              <Input
                id="systemId"
                value="Will be generated on save"
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">This ID is automatically generated by the system</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manualUniqueId">Manual Unique ID (Optional)</Label>
              <Input
                id="manualUniqueId"
                value={manualUniqueId}
                onChange={(e) => setManualUniqueId(e.target.value)}
                placeholder="Enter custom unique ID (optional)"
              />
              <p className="text-xs text-muted-foreground">Optional: Enter a custom unique identifier</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount Received *</Label>
            <Input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={method} onValueChange={(value: "Cash" | "Bank") => setMethod(value)}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Bank">Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Payment Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="referenceNumber">Reference/Cheque No (Optional)</Label>
            <Input
              id="referenceNumber"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Enter reference or cheque number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this payment..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments (Bank Receipt, etc.)</Label>
            <div className="space-y-2">
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <Label htmlFor="receipt-attachment-upload" className="cursor-pointer">
                  <span className="text-sm text-muted-foreground">Click to upload documents</span>
                  <Input
                    id="receipt-attachment-upload"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={handleAttachmentUpload}
                    disabled={uploadingAttachments}
                    className="hidden"
                  />
                </Label>
                <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG, GIF, WEBP up to 10MB each</p>
              </div>
              {uploadingAttachments && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading attachments...
                </div>
              )}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((attachment, idx) => {
                    const isImage = attachment.mimeType?.startsWith('image/') || attachment.url.startsWith('data:image')
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isImage ? (
                            <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                          <span className="text-sm truncate">{attachment.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="flex-shrink-0"
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !amount}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <DollarSign className="mr-2 h-4 w-4" />
                Create Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

