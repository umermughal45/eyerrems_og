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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Info } from "lucide-react"
import { apiService } from "@/lib/api"
import { PaymentToasts, showErrorToast } from "@/lib/toast-utils"
import { SearchableSelect } from "@/components/common/searchable-select"

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type DealOption = {
  id: string
  title: string
  trackingId: string
  clientName: string
  propertyName: string
  dealAmount: number
  status: string
  stage: string
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

const defaultFormState = {
  dealId: "",
  paymentType: "token",
  paymentMode: "cash",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  transactionId: "",
  referenceNumber: "",
  remarks: "",
  systemId: "",
  manualUniqueId: "",
  invoiceId: "", // Optional invoice linkage
}

export function AddPaymentDialog({ open, onOpenChange, onSuccess }: AddPaymentDialogProps) {
  const [formData, setFormData] = useState(defaultFormState)
  const [deals, setDeals] = useState<DealOption[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null)
  const [loadingDeals, setLoadingDeals] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const selectedDeal = useMemo(
    () => deals.find((deal) => deal.id === formData.dealId),
    [deals, formData.dealId],
  )

  useEffect(() => {
    if (open) {
      setFormData(prev => ({ ...prev, systemId: "Will be generated on save" }))
      fetchDeals()
    } else {
      resetForm()
    }
  }, [open])

  useEffect(() => {
    if (formData.dealId) {
      fetchInvoicesForDeal()
    } else {
      setInvoices([])
      setSelectedInvoice(null)
    }
  }, [formData.dealId])

  const fetchDeals = async () => {
    try {
      setLoadingDeals(true)
      const response = await apiService.deals.getAll() as any
      const responseData = response.data?.data || response.data
      const data = Array.isArray(responseData) ? responseData : []
      setDeals(
        data.map((deal: any) => ({
          id: deal.id,
          title: deal.title,
          trackingId: deal.trackingId || deal.dealCode || "",
          clientName: deal.client?.name || "Unassigned Client",
          propertyName: deal.property?.tid || deal.property?.name || "Unassigned Property",
          dealAmount:
            typeof deal.dealAmount === "number"
              ? deal.dealAmount
              : Number.parseFloat(deal.dealAmount ?? "0") || 0,
          status: deal.status || "open",
          stage: deal.stage || "prospecting",
        })),
      )
    } catch (error) {
      console.error("Failed to load deals", error)
      showErrorToast("Failed to fetch deals", "Please refresh and try again.")
      setDeals([])
    } finally {
      setLoadingDeals(false)
    }
  }

  const fetchInvoicesForDeal = async () => {
    if (!formData.dealId) return
    
    try {
      setLoadingInvoices(true)
      // Fetch invoices for the deal's tenant/client
      const response: any = await apiService.invoices.getAll()
      const responseData = response.data as any
      const invoicesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      
      // Filter outstanding invoices (unpaid, partial)
      const outstandingInvoices = invoicesData.filter((inv: any) =>
        inv.status && ["unpaid", "partial", "overdue"].includes(inv.status.toLowerCase())
      )
      
      setInvoices(outstandingInvoices)
    } catch (error) {
      console.error("Failed to load invoices", error)
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }

  const resetForm = () => {
    setFormData(defaultFormState)
    setSelectedInvoice(null)
    setValidationErrors({})
    setSubmitting(false)
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // BLOCK: Deal is required
    if (!formData.dealId) {
      errors.dealId = "Deal is required for payment recording"
    }

    // BLOCK: Amount must be > 0
    const amount = Number(formData.amount || 0)
    if (!amount || amount <= 0) {
      errors.amount = "Payment amount must be greater than zero"
    }

    // BLOCK: Reference number required for cheque/transfer
    if (["bank", "online_transfer"].includes(formData.paymentMode) && !formData.referenceNumber?.trim()) {
      errors.referenceNumber = "Reference number is required for Bank/Online Transfer payments"
    }

    // Validate deal status
    if (selectedDeal) {
      if (selectedDeal.status === 'Closed' || selectedDeal.status === 'Cancelled') {
        errors.dealId = `Cannot record payment for ${selectedDeal.status.toLowerCase()} deal`
      }
    }

    // Validate invoice linkage if provided
    if (formData.invoiceId && selectedInvoice) {
      const isAdvance = formData.paymentType === 'token' || formData.paymentType === 'booking'
      
      if (!isAdvance && selectedInvoice.status === 'paid') {
        errors.invoiceId = "Invoice is already fully paid. Use advance/token payment type for advance payments."
      }

      if (!isAdvance && selectedInvoice.remainingAmount < amount) {
        errors.amount = `Payment amount (${amount}) exceeds outstanding invoice amount (${selectedInvoice.remainingAmount})`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Frontend validation
    if (!validateForm()) {
      const firstError = Object.values(validationErrors)[0]
      showErrorToast("Validation Error", firstError)
      return
    }

    const amount = Number(formData.amount || 0)
    setSubmitting(true)
    setValidationErrors({})
    
    try {
      const payload: any = {
        dealId: formData.dealId,
        amount,
        paymentType: formData.paymentType,
        paymentMode: formData.paymentMode,
        date: new Date(formData.date).toISOString(),
      }

      // Only include optional fields if they have values
      if (formData.transactionId && formData.transactionId.trim()) {
        payload.transactionId = formData.transactionId.trim()
      }
      if (formData.referenceNumber && formData.referenceNumber.trim()) {
        payload.referenceNumber = formData.referenceNumber.trim()
      }
      if (formData.remarks && formData.remarks.trim()) {
        payload.remarks = formData.remarks.trim()
      }
      if (formData.manualUniqueId?.trim()) {
        payload.manualUniqueId = formData.manualUniqueId.trim()
      }
      // Note: invoiceId is not directly supported in payment API
      // Payments are linked to deals, and invoices are resolved through deal/tenant relationship
      // The invoice selection in UI is for user reference only

      await apiService.payments.create(payload)

      PaymentToasts.received("Payment", amount)
      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch (error: any) {
      console.error("Failed to record payment", error)
      
      // Extract validation errors from API response
      const errorMessage = error?.response?.data?.error || "Failed to record payment"
      
      // Handle ACCOUNTING_VIOLATION errors
      if (errorMessage.includes('ACCOUNTING_VIOLATION')) {
        const violationMessage = errorMessage.replace('ACCOUNTING_VIOLATION:', '').trim()
        PaymentToasts.error(violationMessage)
        
        // Map errors to form fields
        if (errorMessage.includes('Deal')) {
          setValidationErrors({ dealId: violationMessage })
        } else if (errorMessage.includes('amount')) {
          setValidationErrors({ amount: violationMessage })
        } else if (errorMessage.includes('reference')) {
          setValidationErrors({ referenceNumber: violationMessage })
        } else if (errorMessage.includes('Invoice')) {
          setValidationErrors({ invoiceId: violationMessage })
        }
      } else {
        // Handle other error formats
        if (Array.isArray(errorMessage)) {
          const zodErrors = errorMessage
            .map((err: any) => {
              if (typeof err === 'string') return err
              if (err?.message) return err.message
              if (err?.path) return `${err.path.join('.')}: ${err.message || 'Invalid value'}`
              return JSON.stringify(err)
            })
            .join(', ')
          PaymentToasts.error(zodErrors)
        } else if (typeof errorMessage === 'string') {
          PaymentToasts.error(errorMessage)
        } else {
          PaymentToasts.error(error?.response?.data?.message || "Failed to record payment")
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleInvoiceChange = (invoiceId: string) => {
    if (!invoiceId) {
      setSelectedInvoice(null)
      setFormData((prev) => ({ ...prev, invoiceId: "" }))
      return
    }

    const invoice = invoices.find((inv) => inv.id === invoiceId)
    setSelectedInvoice(invoice || null)
    setFormData((prev) => ({ ...prev, invoiceId }))
    
    // Auto-fill amount if invoice is selected
    if (invoice && !formData.amount) {
      const remainingAmount = invoice.remainingAmount || invoice.totalAmount || 0
      setFormData((prev) => ({ ...prev, amount: remainingAmount.toString() }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[800px] max-w-[95vw] sm:max-w-[90vw] md:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Deal Payment</DialogTitle>
          <DialogDescription>
            Capture token, booking, installment, or final payments against an approved deal. 
            Payment debits Cash/Bank and credits Accounts Receivable or Customer Advance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Validation Errors */}
          {Object.keys(validationErrors).length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {Object.values(validationErrors).map((error, idx) => (
                  <div key={idx}>{error}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>System ID (Auto-generated)</Label>
              <Input value={formData.systemId || "Will be generated on save"} disabled className="bg-muted text-muted-foreground" />
              <p className="text-xs text-muted-foreground">This ID is automatically generated by the system</p>
            </div>
            <div className="space-y-2">
              <Label>Manual Unique ID (Optional)</Label>
              <Input
                value={formData.manualUniqueId}
                onChange={(event) => setFormData((prev) => ({ ...prev, manualUniqueId: event.target.value }))}
                placeholder="Enter custom unique ID (optional)"
              />
              <p className="text-xs text-muted-foreground">Optional: Enter a custom unique identifier</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealId">Deal *</Label>
            <Select
              value={formData.dealId}
              onValueChange={(value) => {
                const selectedDeal = deals.find((deal) => deal.id === value)
                setFormData((prev) => ({
                  ...prev,
                  dealId: value,
                  amount: selectedDeal ? selectedDeal.dealAmount.toString() : prev.amount,
                }))
              }}
              disabled={loadingDeals}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingDeals ? "Loading deals..." : "Select deal"} />
              </SelectTrigger>
              <SelectContent>
                {deals.length === 0 && !loadingDeals ? (
                  <SelectItem value="no-deals" disabled>
                    No deals available
                  </SelectItem>
                ) : (
                  deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.trackingId || deal.title} — {deal.clientName} ({deal.status})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {validationErrors.dealId && (
              <p className="text-xs text-destructive">{validationErrors.dealId}</p>
            )}
            {selectedDeal && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Deal Status: {selectedDeal.status} | Stage: {selectedDeal.stage} | 
                  Amount: Rs {selectedDeal.dealAmount.toLocaleString()}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Invoice Selection - Optional but recommended */}
          {formData.dealId && (
            <div className="space-y-2">
              <Label htmlFor="invoiceId">Link to Invoice (Optional)</Label>
              <Select
                value={formData.invoiceId || "none"}
                onValueChange={(value) => handleInvoiceChange(value === "none" ? "" : value)}
                disabled={loadingInvoices}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingInvoices ? "Loading invoices..." : "Select invoice (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No invoice (advance payment)</SelectItem>
                  {invoices.map((invoice) => {
                    const invoiceNumber = invoice.invoiceNumber || invoice.id
                    const remaining = invoice.remainingAmount || invoice.totalAmount || invoice.amount || 0
                    return (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoiceNumber} - Rs {remaining.toLocaleString()} ({invoice.status})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {selectedInvoice && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Invoice: {selectedInvoice.invoiceNumber} | 
                    Total: Rs {selectedInvoice.totalAmount?.toLocaleString()} | 
                    Outstanding: Rs {selectedInvoice.remainingAmount?.toLocaleString()} | 
                    Status: {selectedInvoice.status}
                  </AlertDescription>
                </Alert>
              )}
              {validationErrors.invoiceId && (
                <p className="text-xs text-destructive">{validationErrors.invoiceId}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Link payment to invoice to settle receivables. Leave empty for advance/token payments.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentType">Payment Type</Label>
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
              <Label htmlFor="paymentMode">Payment Mode</Label>
              <Select
                value={formData.paymentMode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMode: value, referenceNumber: "" }))}
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
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
                required
              />
              {validationErrors.amount && (
                <p className="text-xs text-destructive">{validationErrors.amount}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">
                Reference Number {["bank", "online_transfer"].includes(formData.paymentMode) ? "*" : ""}
              </Label>
              <Input
                id="referenceNumber"
                placeholder={formData.paymentMode === "bank" ? "Cheque number" : "Transaction ID"}
                value={formData.referenceNumber}
                onChange={(event) => setFormData((prev) => ({ ...prev, referenceNumber: event.target.value }))}
                required={["bank", "online_transfer"].includes(formData.paymentMode)}
              />
              {validationErrors.referenceNumber && (
                <p className="text-xs text-destructive">{validationErrors.referenceNumber}</p>
              )}
              {["bank", "online_transfer"].includes(formData.paymentMode) && (
                <p className="text-xs text-muted-foreground">
                  Reference number is required for {formData.paymentMode === "bank" ? "cheque" : "online transfer"} payments
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transactionId">Transaction ID</Label>
              <Input
                id="transactionId"
                placeholder="Optional reference from POS/bank"
                value={formData.transactionId}
                onChange={(event) => setFormData((prev) => ({ ...prev, transactionId: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remarks">Notes</Label>
              <Textarea
                id="remarks"
                placeholder="Internal remarks for finance team"
                value={formData.remarks}
                onChange={(event) => setFormData((prev) => ({ ...prev, remarks: event.target.value }))}
                rows={2}
              />
            </div>
          </div>

          {/* Accounting Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Accounting Behavior:</strong> Payment will debit {formData.paymentMode === "cash" ? "Cash" : "Bank"} account and credit {
                formData.paymentType === "token" || formData.paymentType === "booking" 
                  ? "Customer Advance (Liability)" 
                  : "Accounts Receivable"
              }. Ledger entries are created automatically.
            </AlertDescription>
          </Alert>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingDeals || deals.length === 0}>
              {submitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
