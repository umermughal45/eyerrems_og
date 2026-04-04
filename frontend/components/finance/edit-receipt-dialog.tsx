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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface EditReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptId: string
  onSuccess?: () => void
}

export function EditReceiptDialog({ open, onOpenChange, receiptId, onSuccess }: EditReceiptDialogProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    date: "",
    amount: "",
    method: "",
    notes: "",
    referenceNumber: "",
  })
  const [receipt, setReceipt] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open && receiptId) {
      fetchReceipt()
    }
  }, [open, receiptId])

  const fetchReceipt = async () => {
    try {
      setLoading(true)
      const response = await apiService.receipts.getById(receiptId) as any
      const receiptData = response.data?.data || response.data || response
      setReceipt(receiptData)
      
      setFormData({
        date: receiptData.date ? new Date(receiptData.date).toISOString().split('T')[0] : "",
        amount: receiptData.amount?.toString() || "",
        method: receiptData.method || "Cash",
        notes: receiptData.notes || "",
        referenceNumber: receiptData.referenceNumber || "",
      })
    } catch (error: any) {
      toast({
        title: "Failed to load receipt",
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)

      const payload: any = {
        amount: parseFloat(formData.amount),
        method: formData.method,
        date: new Date(formData.date).toISOString(),
        notes: formData.notes || null,
        referenceNumber: formData.referenceNumber || null,
      }

      await apiService.receipts.update(receiptId, payload)
      
      toast({ title: "Receipt updated successfully" })
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({ 
        title: "Failed to update receipt", 
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive" 
      })
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFormData({
        date: "",
        amount: "",
        method: "",
        notes: "",
        referenceNumber: "",
      })
      setReceipt(null)
    }
    onOpenChange(open)
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[700px] max-w-[95vw] sm:max-w-[90vw] md:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Edit Receipt - {receipt?.receiptNo}</DialogTitle>
          <DialogDescription>Update the receipt details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="method">Payment Method</Label>
              <Select
                value={formData.method}
                onValueChange={(value) => setFormData({ ...formData, method: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="referenceNumber">Reference Number</Label>
              <Input
                id="referenceNumber"
                placeholder="Optional reference number"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
            {receipt && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Client:</strong> {receipt.client?.name || "N/A"}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Deal:</strong> {receipt.deal?.title || "N/A"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update Receipt"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

