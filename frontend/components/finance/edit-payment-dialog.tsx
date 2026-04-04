"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { PaymentToasts, showErrorToast } from "@/lib/toast-utils"

interface EditPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  payment: any | null
}

const paymentModes = [
  { label: "Cash", value: "cash" },
  { label: "Bank", value: "bank" },
  { label: "Online Transfer", value: "online_transfer" },
  { label: "Card", value: "card" },
]

const paymentTypes = [
  { label: "Token", value: "token" },
  { label: "Booking", value: "booking" },
  { label: "Installment", value: "installment" },
  { label: "Partial", value: "partial" },
  { label: "Full", value: "full" },
]

export function EditPaymentDialog({ open, onOpenChange, onSuccess, payment }: EditPaymentDialogProps) {
  const [formData, setFormData] = useState({
    amount: "",
    paymentType: "token",
    paymentMode: "cash",
    date: new Date().toISOString().split("T")[0],
    transactionId: "",
    referenceNumber: "",
    remarks: "",
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open && payment) {
      setFormData({
        amount: payment.amount?.toString() || "",
        paymentType: payment.paymentType || "token",
        paymentMode: payment.paymentMode || "cash",
        date: payment.date ? new Date(payment.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
        transactionId: payment.transactionId || "",
        referenceNumber: payment.referenceNumber || "",
        remarks: payment.remarks || "",
      })
    }
  }, [open, payment])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!payment) {
      showErrorToast("Validation Error", "Payment not found.")
      return
    }

    const amount = Number(formData.amount || 0)
    if (!amount || amount <= 0) {
      showErrorToast("Validation Error", "Payment amount must be greater than zero.")
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        amount,
        paymentType: formData.paymentType,
        paymentMode: formData.paymentMode,
        date: new Date(formData.date).toISOString(),
      }

      // Only include optional fields if they have values
      if (formData.transactionId && formData.transactionId.trim()) {
        payload.transactionId = formData.transactionId.trim()
      } else {
        payload.transactionId = null
      }
      if (formData.referenceNumber && formData.referenceNumber.trim()) {
        payload.referenceNumber = formData.referenceNumber.trim()
      } else {
        payload.referenceNumber = null
      }
      if (formData.remarks && formData.remarks.trim()) {
        payload.remarks = formData.remarks.trim()
      } else {
        payload.remarks = null
      }

      await apiService.payments.update(payment.id, payload)

      PaymentToasts.received("Payment updated", amount)
      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      console.error("Failed to update payment", error)
      
      // Extract validation errors from API response
      if (error?.response?.data?.error) {
        const apiError = error.response.data.error
        let errorMessage = "Failed to update payment"
        
        if (Array.isArray(apiError)) {
          // Zod validation errors
          errorMessage = apiError
            .map((err: any) => {
              if (typeof err === 'string') return err
              if (err?.message) return err.message
              if (err?.path) return `${err.path.join('.')}: ${err.message || 'Invalid value'}`
              return JSON.stringify(err)
            })
            .join(', ')
        } else if (typeof apiError === 'string') {
          errorMessage = apiError
        } else if (typeof apiError === 'object') {
          errorMessage = apiError.message || apiError.error || JSON.stringify(apiError)
        }
        
        PaymentToasts.error(errorMessage)
      } else {
        PaymentToasts.error(error?.response?.data?.message || "Failed to update payment")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!payment) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[720px] max-w-[95vw] sm:max-w-[90vw] md:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogDescription>
            Update payment details. Changes will automatically sync with the payment plan.
            {payment.deal && (
              <span className="block mt-1">
                Deal: {payment.deal.title} — {payment.paymentId}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment ID</Label>
              <Input value={payment.paymentId || payment.id} disabled className="bg-muted text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Payment ID cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
            </div>
          </div>

          {payment.deal && (
            <div className="rounded-md border border-border px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{payment.deal.property?.name || "Unassigned Property"}</p>
                  <p className="text-muted-foreground">{payment.deal.client?.name || "Unassigned Client"}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Deal Amount</p>
                  <p className="text-base font-semibold">
                    {payment.deal.dealAmount?.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select
                value={formData.paymentType}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select
                value={formData.paymentMode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMode: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Changing amount will update payment plan allocation
              </p>
            </div>
            <div className="space-y-2">
              <Label>Transaction ID</Label>
              <Input
                placeholder="Optional reference from POS/bank"
                value={formData.transactionId}
                onChange={(event) => setFormData((prev) => ({ ...prev, transactionId: event.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                placeholder="Cheque or receipt number"
                value={formData.referenceNumber}
                onChange={(event) => setFormData((prev) => ({ ...prev, referenceNumber: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Internal remarks for finance team"
                value={formData.remarks}
                onChange={(event) => setFormData((prev) => ({ ...prev, remarks: event.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Update Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

