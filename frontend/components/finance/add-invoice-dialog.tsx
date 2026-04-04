"use client"

import type React from "react"

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
import { InvoiceToasts, showErrorToast } from "@/lib/toast-utils"
import { SearchableSelect } from "@/components/common/searchable-select"

interface AddInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type AttachmentMeta = {
  name?: string
  url?: string
  mimeType?: string
  size?: number
}

const lateFeeOptions = [
  { label: "None", value: "none" },
  { label: "Fixed Amount", value: "fixed" },
  { label: "Percentage", value: "percentage" },
]

const generateInvoiceNumber = () => {
  const now = new Date()
  const part = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const random = Math.floor(100 + Math.random() * 900)
  return `INV-${part}-${random}`
}

export function AddInvoiceDialog({ open, onOpenChange, onSuccess }: AddInvoiceDialogProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber())
  const [accounts, setAccounts] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null)
  const [loading, setLoading] = useState({ accounts: false, deals: false, attachments: false })
  const [formData, setFormData] = useState({
    tenantId: "",
    propertyId: "",
    dealId: "",
    amount: "",
    taxPercent: "0",
    discountAmount: "0",
    billingDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    lateFeeRule: "none",
    termsAndConditions: "",
    description: "",
    tenantAccountId: "",
    incomeAccountId: "",
    attachments: [] as AttachmentMeta[],
  })
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setInvoiceNumber(generateInvoiceNumber())
      fetchData()
    } else {
      resetForm()
    }
  }, [open])

  const fetchData = async () => {
    await Promise.all([fetchAccounts(), fetchDeals()])
  }

  const fetchDeals = async () => {
    try {
      setLoading((prev) => ({ ...prev, deals: true }))
      const response: any = await apiService.deals.getAll()
      const responseData = response.data as any
      const dealsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Filter only Approved or Active deals
      const validDeals = dealsData.filter((deal: any) => 
        deal.status === 'Approved' || deal.status === 'Active'
      )
      setDeals(validDeals)
    } catch {
      setDeals([])
    } finally {
      setLoading((prev) => ({ ...prev, deals: false }))
    }
  }

  const fetchAccounts = async () => {
    try {
      setLoading((prev) => ({ ...prev, accounts: true }))
      const response: any = await apiService.accounts.getAll({ postable: "true" })
      const responseData = response.data as any
      const accountsData = Array.isArray(responseData) ? responseData : Array.isArray(responseData?.data) ? responseData.data : []
      // Filter to only Level-5 Posting accounts
      const postableAccounts = accountsData.filter((acc: any) => 
        acc.isPostable && acc.level === 5
      )
      setAccounts(postableAccounts)
    } catch {
      setAccounts([])
    } finally {
      setLoading((prev) => ({ ...prev, accounts: false }))
    }
  }

  // STRICT ACCOUNT FILTERING - Enforce accounting rules
  const receivableAccounts = useMemo(
    () => accounts.filter((account) => {
      // Only Accounts Receivable accounts (codes 1101-1104) or accounts with "receivable" in name
      const code = account.code || ""
      const name = (account.name || "").toLowerCase()
      const type = (account.type || "").toLowerCase()
      
      // Block Cash/Bank accounts
      if (code.startsWith('1111') || code.startsWith('1112') || 
          name.includes('cash') || name.includes('bank')) {
        return false
      }
      
      // Block Equity accounts
      if (type === 'equity') {
        return false
      }
      
      // Only allow Asset accounts that are Accounts Receivable
      if (type === 'asset') {
        return (
          code.startsWith('1101') ||
          code.startsWith('1102') ||
          code.startsWith('1103') ||
          code.startsWith('1104') ||
          name.includes('receivable') ||
          name.includes('accounts receivable')
        )
      }
      
      return false
    }),
    [accounts]
  )

  const revenueAccounts = useMemo(
    () => accounts.filter((account) => {
      const code = account.code || ""
      const name = (account.name || "").toLowerCase()
      const type = (account.type || "").toLowerCase()
      
      // Block Cash/Bank accounts
      if (code.startsWith('1111') || code.startsWith('1112') || 
          name.includes('cash') || name.includes('bank')) {
        return false
      }
      
      // Block Asset accounts (except AR, but AR shouldn't be in revenue list)
      if (type === 'asset') {
        return false
      }
      
      // Block Equity accounts
      if (type === 'equity') {
        return false
      }
      
      // Only Revenue accounts
      return type === 'revenue'
    }),
    [accounts]
  )

  useEffect(() => {
    if (!formData.tenantAccountId && receivableAccounts.length) {
      setFormData((prev) => ({ ...prev, tenantAccountId: receivableAccounts[0].id }))
    }
    if (!formData.incomeAccountId && revenueAccounts.length) {
      setFormData((prev) => ({ ...prev, incomeAccountId: revenueAccounts[0].id }))
    }
  }, [receivableAccounts, revenueAccounts, formData.tenantAccountId, formData.incomeAccountId])

  // Auto-fill property and tenant from deal
  useEffect(() => {
    if (formData.dealId && selectedDeal) {
      if (selectedDeal.propertyId && !formData.propertyId) {
        setFormData((prev) => ({ ...prev, propertyId: selectedDeal.propertyId }))
      }
      // Note: Deals don't have tenantId directly, but we can show deal info
    }
  }, [formData.dealId, selectedDeal])

  const handleDealChange = async (dealId: string) => {
    if (!dealId) {
      setSelectedDeal(null)
      setFormData((prev) => ({ ...prev, dealId: "" }))
      return
    }

    try {
      const deal = await apiService.deals.getById(dealId)
      const dealData: any = deal.data || deal
      setSelectedDeal(dealData)
      setFormData((prev) => ({
        ...prev,
        dealId,
        propertyId: dealData?.propertyId || prev.propertyId,
      }))
    } catch (error: any) {
      showErrorToast("Failed to load deal", error?.message || "Unknown error")
    }
  }

  const resetForm = () => {
    setFormData({
      tenantId: "",
      propertyId: "",
      dealId: "",
      amount: "",
      taxPercent: "0",
      discountAmount: "0",
      billingDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      lateFeeRule: "none",
      termsAndConditions: "",
      description: "",
      tenantAccountId: "",
      incomeAccountId: "",
      attachments: [],
    })
    setSelectedDeal(null)
    setValidationErrors({})
    setSubmitting(false)
  }

  const totals = useMemo(() => {
    const base = Number(formData.amount || 0)
    const taxPct = Number(formData.taxPercent || 0)
    const discount = Number(formData.discountAmount || 0)
    const taxValue = Number(((base * taxPct) / 100).toFixed(2))
    const total = Number((base + taxValue - discount).toFixed(2))
    return {
      base,
      taxValue,
      total: total < 0 ? 0 : total,
    }
  }, [formData.amount, formData.taxPercent, formData.discountAmount])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // BLOCK: Tenant is required
    if (!formData.tenantId) {
      errors.tenantId = "Tenant/Customer is required for invoice creation"
    }

    // WARN: Property missing (but allow for corporate-level)
    if (!formData.propertyId) {
      // Warning only, not blocking
    }

    // BLOCK: Amount must be > 0
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = "Invoice amount must be greater than zero"
    }

    // BLOCK: Total amount must be > 0
    if (totals.total <= 0) {
      errors.total = "Invoice total amount must be greater than zero"
    }

    // BLOCK: Accounts must be selected
    if (!formData.tenantAccountId) {
      errors.tenantAccountId = "Tenant Receivable Account is required"
    }

    if (!formData.incomeAccountId) {
      errors.incomeAccountId = "Income Account is required"
    }

    // Validate deal status if deal is selected
    if (formData.dealId && selectedDeal) {
      if (selectedDeal.status !== 'Approved' && selectedDeal.status !== 'Active') {
        errors.dealId = `Deal must be Approved or Active. Current status: ${selectedDeal.status}`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || !files.length) return
    setLoading((prev) => ({ ...prev, attachments: true }))
    try {
      const uploads: AttachmentMeta[] = []
      for (const file of Array.from(files)) {
        const base64 = await toBase64(file)
        const response: any = await apiService.upload.file({ file: base64, filename: file.name })
        const responseData = response.data as any
        const uploaded = responseData?.data || responseData
        uploads.push({
          name: file.name,
          url: uploaded?.url,
          mimeType: file.type,
          size: file.size,
        })
      }
      setFormData((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploads] }))
    } catch {
      showErrorToast("Upload Failed", "Failed to upload attachment")
    } finally {
      setLoading((prev) => ({ ...prev, attachments: false }))
    }
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Frontend validation
    if (!validateForm()) {
      const firstError = Object.values(validationErrors)[0]
      showErrorToast("Validation Error", firstError)
      return
    }

    setSubmitting(true)
    setValidationErrors({})
    
    try {
      await apiService.invoices.create({
        invoiceNumber,
        tenantId: formData.tenantId, // Required - backend will validate
        propertyId: formData.propertyId || null,
        dealId: formData.dealId || null,
        amount: Number(formData.amount || 0),
        billingDate: new Date(formData.billingDate).toISOString(),
        dueDate: new Date(formData.dueDate).toISOString(),
        taxPercent: Number(formData.taxPercent || 0),
        discountAmount: Number(formData.discountAmount || 0),
        lateFeeRule: formData.lateFeeRule,
        termsAndConditions: formData.termsAndConditions || null,
        tenantAccountId: formData.tenantAccountId,
        incomeAccountId: formData.incomeAccountId,
        attachments: formData.attachments,
        description: formData.description || `Invoice ${invoiceNumber}`,
      })
      InvoiceToasts.created(invoiceNumber)
      onSuccess?.()
      onOpenChange(false)
      resetForm()
      setInvoiceNumber(generateInvoiceNumber())
    } catch (error: any) {
      // Handle backend validation errors
      const errorMessage = error?.response?.data?.error || "Failed to create invoice"
      
      // Check if it's an ACCOUNTING_VIOLATION error
      if (errorMessage.includes('ACCOUNTING_VIOLATION')) {
        // Extract the violation message
        const violationMessage = errorMessage.replace('ACCOUNTING_VIOLATION:', '').trim()
        InvoiceToasts.error(violationMessage)
        
        // Map errors to form fields if possible
        if (errorMessage.includes('Tenant/Customer')) {
          setValidationErrors({ tenantId: violationMessage })
        } else if (errorMessage.includes('amount')) {
          setValidationErrors({ amount: violationMessage })
        } else if (errorMessage.includes('account')) {
          if (errorMessage.includes('Tenant account') || errorMessage.includes('Accounts Receivable')) {
            setValidationErrors({ tenantAccountId: violationMessage })
          } else if (errorMessage.includes('Income account') || errorMessage.includes('Revenue')) {
            setValidationErrors({ incomeAccountId: violationMessage })
          }
        } else if (errorMessage.includes('Deal')) {
          setValidationErrors({ dealId: violationMessage })
        }
      } else {
        InvoiceToasts.error(errorMessage)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[900px] max-w-[95vw] sm:max-w-[90vw] md:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Build a complete tenant invoice with taxes, discounts, and payment terms. 
            Invoice recognizes receivables and revenue ONLY (no cash/bank movement).
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
              <Label>Invoice Number</Label>
              <Input value={invoiceNumber} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantId">Tenant/Customer *</Label>
              <SearchableSelect
                source="tenants"
                value={formData.tenantId}
                onChange={(value) => setFormData((prev) => ({ ...prev, tenantId: value || "" }))}
                placeholder="Select tenant/customer..."
                required
                label=""
              />
              {validationErrors.tenantId && (
                <p className="text-xs text-destructive">{validationErrors.tenantId}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dealId">Deal (Optional)</Label>
              <Select
                value={formData.dealId || "none"}
                onValueChange={(value) => handleDealChange(value === "none" ? "" : value)}
                disabled={loading.deals}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading.deals ? "Loading..." : "Select deal (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No deal</SelectItem>
                  {deals.map((deal) => (
                    <SelectItem key={deal.id} value={deal.id}>
                      {deal.trackingId || deal.title} — {deal.client?.name || "Unassigned"} ({deal.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDeal && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Deal: {selectedDeal.trackingId || selectedDeal.title} | 
                    Status: {selectedDeal.status} | 
                    Property: {selectedDeal.property?.name || "N/A"}
                  </AlertDescription>
                </Alert>
              )}
              {validationErrors.dealId && (
                <p className="text-xs text-destructive">{validationErrors.dealId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property (Optional)</Label>
              <SearchableSelect
                source="properties"
                value={formData.propertyId}
                onChange={(value) => setFormData((prev) => ({ ...prev, propertyId: value || "" }))}
                placeholder="Select property (optional)..."
                allowEmpty
                label=""
              />
              {!formData.propertyId && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Property is optional but recommended. Use only for corporate-level invoices.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billingDate">Billing Date *</Label>
              <Input
                id="billingDate"
                type="date"
                value={formData.billingDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, billingDate: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Base Amount *</Label>
              <Input
                id="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
              {validationErrors.amount && (
                <p className="text-xs text-destructive">{validationErrors.amount}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxPercent">Tax (%)</Label>
              <Input
                id="taxPercent"
                type="number"
                min="0"
                step="0.01"
                value={formData.taxPercent}
                onChange={(e) => setFormData((prev) => ({ ...prev, taxPercent: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="discountAmount">Discount Amount</Label>
              <Input
                id="discountAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.discountAmount}
                onChange={(e) => setFormData((prev) => ({ ...prev, discountAmount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateFeeRule">Late Fee Rule</Label>
              <Select
                value={formData.lateFeeRule}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, lateFeeRule: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lateFeeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Invoice Total</Label>
              <div className="rounded-md border p-2 text-lg font-semibold">
                Rs {totals.total.toFixed(2)}
              </div>
              {validationErrors.total && (
                <p className="text-xs text-destructive">{validationErrors.total}</p>
              )}
            </div>
          </div>

          {/* Account Selection with STRICT filtering */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Accounting Accounts</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Invoice debit: Accounts Receivable ONLY | Credit: Revenue / Tax Payable ONLY
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenantAccountId">Tenant Receivable Account (Debit) *</Label>
                <Select
                  value={formData.tenantAccountId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, tenantAccountId: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loading.accounts ? "Loading..." : "Select AR account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {receivableAccounts.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {loading.accounts ? "Loading..." : "No Accounts Receivable accounts found"}
                      </SelectItem>
                    ) : (
                      receivableAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code ? `${account.code} — ` : ""}
                          {account.name} ({account.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {validationErrors.tenantAccountId && (
                  <p className="text-xs text-destructive">{validationErrors.tenantAccountId}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Only Accounts Receivable accounts (codes 1101-1104) are allowed
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="incomeAccountId">Income Account (Credit) *</Label>
                <Select
                  value={formData.incomeAccountId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, incomeAccountId: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loading.accounts ? "Loading..." : "Select revenue account"} />
                  </SelectTrigger>
                  <SelectContent>
                    {revenueAccounts.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {loading.accounts ? "Loading..." : "No Revenue accounts found"}
                      </SelectItem>
                    ) : (
                      revenueAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code ? `${account.code} — ` : ""}
                          {account.name} ({account.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {validationErrors.incomeAccountId && (
                  <p className="text-xs text-destructive">{validationErrors.incomeAccountId}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Only Revenue accounts are allowed. Cash/Bank/Asset/Equity accounts are blocked.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Invoice Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Describe what this invoice covers..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="termsAndConditions">Terms & Conditions</Label>
              <Textarea
                id="termsAndConditions"
                rows={4}
                placeholder="Payment terms, penalties, or special conditions..."
                value={formData.termsAndConditions}
                onChange={(e) => setFormData((prev) => ({ ...prev, termsAndConditions: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <Input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleAttachmentUpload(e.target.files)} />
            {loading.attachments && <p className="text-sm text-muted-foreground">Uploading attachments...</p>}
            {formData.attachments.length > 0 && (
              <ul className="space-y-2 text-sm">
                {formData.attachments.map((file, index) => (
                  <li key={`${file.url}-${index}`} className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                    <span className="truncate pr-2">{file.name || file.url}</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(index)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || totals.total <= 0}>
              {submitting ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
