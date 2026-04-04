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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Plus as PlusIcon } from "lucide-react"
import { SearchableSelect } from "@/components/common/searchable-select"

interface AddTransactionDialogProps {
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

const paymentMethods = [
  { label: "Cash", value: "cash" },
  { label: "Bank", value: "bank" },
  { label: "Online", value: "online" },
]

const generateCode = (prefix: string) => {
  const now = new Date()
  const part = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
  const random = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${part}-${random}`
}

export function AddTransactionDialog({ open, onOpenChange, onSuccess }: AddTransactionDialogProps) {
  const { toast } = useToast()
  const [transactionCode, setTransactionCode] = useState(generateCode("TX"))
  const [loading, setLoading] = useState({
    accounts: false,
    categories: false,
    tenants: false,
    dealers: false,
    properties: false,
    invoices: false,
    attachments: false,
  })
  const [accounts, setAccounts] = useState<any[]>([]) // Only used for category creation dialog
  const [categories, setCategories] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [dealers, setDealers] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [formData, setFormData] = useState({
    transactionType: "income",
    transactionCategoryId: "",
    paymentMethod: "cash",
    amount: "",
    taxAmount: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    tenantId: "",
    dealerId: "",
    propertyId: "",
    invoiceId: "", // Optional invoice selection
    attachments: [] as AttachmentMeta[],
  })
  const [submitting, setSubmitting] = useState(false)
  const [showCategoryDialog, setShowCategoryDialog] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    defaultDebitAccountId: "",
    defaultCreditAccountId: "",
  })
  const [creatingCategory, setCreatingCategory] = useState(false)

  useEffect(() => {
    if (open) {
      setTransactionCode(generateCode("TX"))
      fetchInitialData()
    } else {
      resetForm()
    }
  }, [open])

  const fetchInitialData = async () => {
    await Promise.all([fetchAccounts(), fetchCategories(), fetchTenants(), fetchDealers(), fetchProperties(), fetchInvoices()])
  }

  // Fetch accounts only for category creation dialog (for default debit/credit accounts)
  const fetchAccounts = async () => {
    try {
      setLoading((prev) => ({ ...prev, accounts: true }))
      const response: any = await apiService.accounts.getAll()
      const responseData = response.data as any
      const accountsData = Array.isArray(responseData) ? responseData : Array.isArray(responseData?.data) ? responseData.data : []
      setAccounts(accountsData)
    } catch {
      setAccounts([])
    } finally {
      setLoading((prev) => ({ ...prev, accounts: false }))
    }
  }

  const fetchCategories = async () => {
    try {
      setLoading((prev) => ({ ...prev, categories: true }))
      const response: any = await apiService.transactionCategories.getAll()
      setCategories(Array.isArray(response?.data) ? response.data : [])
    } catch {
      setCategories([])
    } finally {
      setLoading((prev) => ({ ...prev, categories: false }))
    }
  }

  const handleCreateCategory = async () => {
    if (!categoryFormData.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" })
      return
    }

    setCreatingCategory(true)
    try {
      const newCategory = await apiService.transactionCategories.create({
        name: categoryFormData.name.trim(),
        type: formData.transactionType,
        description: categoryFormData.description.trim() || null,
        defaultDebitAccountId: categoryFormData.defaultDebitAccountId || null,
        defaultCreditAccountId: categoryFormData.defaultCreditAccountId || null,
      })

      const categoryResponse: any = newCategory?.data || newCategory
      
      // Refresh categories list
      await fetchCategories()
      
      // Select the newly created category
      if (categoryResponse && categoryResponse.id) {
        setFormData((prev) => ({ ...prev, transactionCategoryId: categoryResponse.id }))
      }

      // Reset category form and close dialog
      setCategoryFormData({
        name: "",
        description: "",
        defaultDebitAccountId: "",
        defaultCreditAccountId: "",
      })
      setShowCategoryDialog(false)
      
      toast({ title: "Category created successfully" })
    } catch (error: any) {
      const message = error?.response?.data?.error || "Failed to create category"
      toast({ title: message, variant: "destructive" })
    } finally {
      setCreatingCategory(false)
    }
  }

  const fetchTenants = async () => {
    try {
      setLoading((prev) => ({ ...prev, tenants: true }))
      const response: any = await apiService.tenants.getAll()
      const responseData = response.data as any
      const tenantsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setTenants(
        Array.isArray(tenantsData) ? tenantsData.sort((a, b) => (a.name || "").localeCompare(b.name || "")) : []
      )
    } catch {
      setTenants([])
    } finally {
      setLoading((prev) => ({ ...prev, tenants: false }))
    }
  }

  const fetchDealers = async () => {
    try {
      setLoading((prev) => ({ ...prev, dealers: true }))
      const response: any = await apiService.dealers.getAll()
      const responseData = response.data as any
      const dealersData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setDealers(
        Array.isArray(dealersData) ? dealersData.sort((a, b) => (a.name || "").localeCompare(b.name || "")) : []
      )
    } catch {
      setDealers([])
    } finally {
      setLoading((prev) => ({ ...prev, dealers: false }))
    }
  }

  const fetchProperties = async () => {
    try {
      setLoading((prev) => ({ ...prev, properties: true }))
      const response: any = await apiService.properties.getAll()
      const responseData = response.data as any
      const propertiesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setProperties(
        Array.isArray(propertiesData) ? propertiesData.sort((a, b) => (a.name || "").localeCompare(b.name || "")) : []
      )
    } catch {
      setProperties([])
    } finally {
      setLoading((prev) => ({ ...prev, properties: false }))
    }
  }

  const fetchInvoices = async () => {
    try {
      setLoading((prev) => ({ ...prev, invoices: true }))
      const response: any = await apiService.invoices.getAll()
      const responseData = response.data as any
      const invoicesData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      // Filter only outstanding invoices (unpaid, partial, overdue)
      const outstandingInvoices = Array.isArray(invoicesData)
        ? invoicesData.filter(
            (inv: any) =>
              inv.status &&
              ["unpaid", "partial", "overdue"].includes(inv.status.toLowerCase())
          )
        : []
      setInvoices(outstandingInvoices)
    } catch {
      setInvoices([])
    } finally {
      setLoading((prev) => ({ ...prev, invoices: false }))
    }
  }

  const resetForm = () => {
    setFormData({
      transactionType: "income",
      transactionCategoryId: "",
      paymentMethod: "cash",
      amount: "",
      taxAmount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      tenantId: "",
      dealerId: "",
      propertyId: "",
      invoiceId: "",
      attachments: [],
    })
    setValidationErrors({})
    setSubmitting(false)
  }

  // Auto-fill form when invoice is selected
  useEffect(() => {
    if (formData.invoiceId) {
      const selectedInvoice = invoices.find((inv) => inv.id === formData.invoiceId)
      if (selectedInvoice) {
        // Auto-fill amount (remaining amount or total amount)
        const invoiceAmount = selectedInvoice.remainingAmount || selectedInvoice.totalAmount || selectedInvoice.amount || 0
        if (!formData.amount || formData.amount === "0") {
          setFormData((prev) => ({ ...prev, amount: invoiceAmount.toString() }))
        }

        // Auto-fill tenant
        if (selectedInvoice.tenantId && !formData.tenantId) {
          setFormData((prev) => ({ ...prev, tenantId: selectedInvoice.tenantId }))
        }

        // Auto-fill property
        if (selectedInvoice.propertyId && !formData.propertyId) {
          setFormData((prev) => ({ ...prev, propertyId: selectedInvoice.propertyId }))
        }

        // Auto-fill description
        if (!formData.description) {
          const invoiceDesc = `Payment for Invoice ${selectedInvoice.invoiceNumber || selectedInvoice.id}`
          setFormData((prev) => ({ ...prev, description: invoiceDesc }))
        }
      }
    }
  }, [formData.invoiceId, invoices])

  // Validate form - enforce lifecycle context
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // BLOCK: Category is required
    if (!formData.transactionCategoryId) {
      errors.transactionCategoryId = "Transaction category is required"
    }

    // BLOCK: Amount must be > 0
    const amount = Number(formData.amount || 0)
    if (!amount || amount <= 0) {
      errors.amount = "Transaction amount must be greater than zero"
    }

    // BLOCK: Description is required
    if (!formData.description || formData.description.trim().length === 0) {
      errors.description = "Transaction description/narration is required"
    }

    // ENFORCE: Transaction MUST resolve to a lifecycle event
    // Must have at least one of: tenant, dealer, invoice, or property (for corporate-level)
    const hasLifecycleContext = 
      formData.tenantId || 
      formData.dealerId || 
      formData.invoiceId || 
      (formData.propertyId && formData.transactionType === "income")

    if (!hasLifecycleContext) {
      errors.lifecycle = "Transaction must be linked to a tenant, dealer, invoice, or property (for corporate-level income)"
    }

    // BLOCK: Date cannot be in future
    const transactionDate = new Date(formData.date)
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (transactionDate > today) {
      errors.date = "Transaction date cannot be in the future"
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
        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
        if (!allowedTypes.includes(file.type.toLowerCase())) {
          toast({ 
            title: "Invalid file type", 
            description: "Only PDF, JPG, and PNG files are allowed",
            variant: "destructive" 
          })
          continue
        }

        const base64 = await toBase64(file)
        // Use finance attachment endpoint
        const response: any = await apiService.finance.uploadAttachment({ 
          file: base64, 
          filename: file.name 
        })
        const responseData = response.data as any
        const uploaded = responseData?.data || responseData
        uploads.push({
          name: file.name,
          url: uploaded?.url || uploaded?.filename,
          mimeType: file.type,
          size: file.size,
        })
      }
      setFormData((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploads] }))
      toast({ title: "Attachments uploaded successfully" })
    } catch (error: any) {
      toast({ 
        title: "Failed to upload attachment", 
        description: error.message || "Upload failed",
        variant: "destructive" 
      })
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
      toast({ title: "Validation Error", description: firstError, variant: "destructive" })
      return
    }

    setSubmitting(true)
    setValidationErrors({})
    
    try {
      // Transaction creation - only essential data
      // Account selection and accounting entries are handled automatically by the backend
      // Status: For income transactions linked to invoices, set as "pending" until payment is recorded
      // For other transactions, status defaults to "completed" in the backend
      const transactionStatus = formData.invoiceId && formData.transactionType === "income" 
        ? "pending" 
        : undefined // Let backend set default to "completed"
      
      await apiService.transactions.create({
        transactionCode,
        transactionType: formData.transactionType,
        transactionCategoryId: formData.transactionCategoryId || null,
        paymentMethod: formData.paymentMethod,
        amount: Number(formData.amount || 0),
        taxAmount: Number(formData.taxAmount || 0),
        date: new Date(formData.date).toISOString(),
        description: formData.description || null,
        tenantId: formData.tenantId || null,
        dealerId: formData.dealerId || null,
        propertyId: formData.propertyId || null,
        invoiceId: formData.invoiceId || null, // Optional invoice link
        attachments: formData.attachments,
        ...(transactionStatus && { status: transactionStatus }),
      })
      toast({ title: "Transaction recorded successfully" })
      onSuccess?.()
      onOpenChange(false)
      resetForm()
      setTransactionCode(generateCode("TX"))
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || "Failed to add transaction"
      
      // Handle ACCOUNTING_VIOLATION errors
      if (errorMessage.includes('ACCOUNTING_VIOLATION')) {
        const violationMessage = errorMessage.replace('ACCOUNTING_VIOLATION:', '').trim()
        toast({ title: "Accounting Violation", description: violationMessage, variant: "destructive" })
        
        // Map errors to form fields
        if (errorMessage.includes('lifecycle') || errorMessage.includes('context')) {
          setValidationErrors({ lifecycle: violationMessage })
        } else if (errorMessage.includes('amount')) {
          setValidationErrors({ amount: violationMessage })
        } else if (errorMessage.includes('category')) {
          setValidationErrors({ transactionCategoryId: violationMessage })
        }
      } else {
        toast({ title: errorMessage, variant: "destructive" })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Determine lifecycle context type
  const lifecycleContextType = useMemo(() => {
    if (formData.invoiceId) return "invoice"
    if (formData.tenantId) return "tenant"
    if (formData.dealerId) return "dealer"
    if (formData.propertyId && formData.transactionType === "income") return "corporate"
    return null
  }, [formData.invoiceId, formData.tenantId, formData.dealerId, formData.propertyId, formData.transactionType])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[900px] max-w-[95vw] sm:max-w-[90vw] md:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Transaction</DialogTitle>
          <DialogDescription>
            Capture a controlled financial transaction. Transaction MUST resolve to Invoice creation, Payment recording, or Advance handling.
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

          {/* Lifecycle Context Indicator */}
          {lifecycleContextType && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Lifecycle Context:</strong> {lifecycleContextType === "invoice" && "Linked to Invoice"}
                {lifecycleContextType === "tenant" && "Linked to Tenant"}
                {lifecycleContextType === "dealer" && "Linked to Dealer"}
                {lifecycleContextType === "corporate" && "Corporate-level Income"}
                {!lifecycleContextType && "⚠️ Transaction must be linked to tenant, dealer, invoice, or property"}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Transaction Code</Label>
              <Input value={transactionCode} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transactionType">Transaction Type</Label>
              <Select
                value={formData.transactionType}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, transactionType: value, transactionCategoryId: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transactionCategoryId">Category *</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowCategoryDialog(true)
                  }}
                >
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Add Category
                </Button>
              </div>
              <Select
                value={formData.transactionCategoryId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, transactionCategoryId: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading.categories ? "Loading..." : "Select category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {loading.categories ? "Loading..." : "No categories"}
                    </SelectItem>
                  ) : (
                    categories
                      .filter((cat) => cat.type?.toLowerCase() === formData.transactionType)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
              {validationErrors.transactionCategoryId && (
                <p className="text-xs text-destructive">{validationErrors.transactionCategoryId}</p>
              )}
            </div>
          </div>

          {/* Invoice Selection - Only for Income transactions */}
          {formData.transactionType === "income" && (
            <div className="space-y-2">
              <Label htmlFor="invoiceId">Select Invoice (Optional)</Label>
              <Select
                value={formData.invoiceId || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, invoiceId: value === "none" ? "" : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={loading.invoices ? "Loading..." : "Select invoice to mark as paid"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No invoice</SelectItem>
                  {invoices.map((invoice) => {
                    const invoiceNumber = invoice.invoiceNumber || invoice.id
                    const remaining = invoice.remainingAmount || invoice.totalAmount || invoice.amount || 0
                    const tenantName = typeof invoice.tenant === "string" 
                      ? invoice.tenant 
                      : invoice.tenant?.name || invoice.tenantName || "Unknown"
                    return (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoiceNumber} - {tenantName} - Rs {remaining.toLocaleString()} ({invoice.status})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Linking a transaction to an invoice records the accounting entry. The invoice remains outstanding until payment is recorded.
              </p>
            </div>
          )}

          {/* Lifecycle Context Fields */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Lifecycle Context (Required)</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Transaction MUST be linked to at least one: Tenant, Dealer, Invoice, or Property (for corporate-level income)
            </p>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenantId">Assign to Tenant</Label>
                <SearchableSelect
                  source="tenants"
                  value={formData.tenantId}
                  onChange={(value) => setFormData((prev) => ({ ...prev, tenantId: value || "" }))}
                  placeholder="Select tenant (optional)..."
                  allowEmpty
                  label=""
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dealerId">Assign to Dealer</Label>
                <SearchableSelect
                  source="dealers"
                  value={formData.dealerId}
                  onChange={(value) => setFormData((prev) => ({ ...prev, dealerId: value || "" }))}
                  placeholder="Select dealer (optional)..."
                  allowEmpty
                  label=""
                />
              </div>
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
              <p className="text-xs text-muted-foreground">
                Property linkage is recommended for corporate-level income transactions
              </p>
            </div>
            
            {validationErrors.lifecycle && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{validationErrors.lifecycle}</AlertDescription>
              </Alert>
            )}
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
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
              {validationErrors.amount && (
                <p className="text-xs text-destructive">{validationErrors.amount}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxAmount">Tax Amount</Label>
              <Input
                id="taxAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.taxAmount}
                onChange={(e) => setFormData((prev) => ({ ...prev, taxAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
              {validationErrors.date && (
                <p className="text-xs text-destructive">{validationErrors.date}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description / Memo *</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Provide transaction narration..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
            {validationErrors.description && (
              <p className="text-xs text-destructive">{validationErrors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <Input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => handleAttachmentUpload(e.target.files)} />
            {loading.attachments && <p className="text-sm text-muted-foreground">Uploading attachments...</p>}
            {formData.attachments.length > 0 && (
              <ul className="space-y-1 text-sm">
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
            <Button type="submit" disabled={submitting || !lifecycleContextType}>
              {submitting ? "Saving..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Add Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new {formData.transactionType} category for transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                placeholder="e.g., Office Supplies, Rent Income"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData((prev) => ({ ...prev, name: e.target.value }))}
                disabled={creatingCategory}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Description (Optional)</Label>
              <Textarea
                id="category-description"
                placeholder="Brief description of this category"
                rows={3}
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData((prev) => ({ ...prev, description: e.target.value }))}
                disabled={creatingCategory}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AccountSelect
                label="Default Debit Account (Optional)"
                value={categoryFormData.defaultDebitAccountId}
                onChange={(value) => setCategoryFormData((prev) => ({ ...prev, defaultDebitAccountId: value }))}
                accounts={accounts}
                placeholder="Select account"
              />
              <AccountSelect
                label="Default Credit Account (Optional)"
                value={categoryFormData.defaultCreditAccountId}
                onChange={(value) => setCategoryFormData((prev) => ({ ...prev, defaultCreditAccountId: value }))}
                accounts={accounts}
                placeholder="Select account"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCategoryDialog(false)
                setCategoryFormData({
                  name: "",
                  description: "",
                  defaultDebitAccountId: "",
                  defaultCreditAccountId: "",
                })
              }}
              disabled={creatingCategory}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateCategory} disabled={creatingCategory || !categoryFormData.name.trim()}>
              {creatingCategory ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

interface AccountSelectProps {
  label: string
  value: string
  accounts: any[]
  onChange: (value: string) => void
  placeholder?: string
}

function AccountSelect({ label, value, accounts, onChange, placeholder }: AccountSelectProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder || "Select account"} />
        </SelectTrigger>
        <SelectContent>
          {accounts.length === 0 ? (
            <SelectItem value="none" disabled>
              No accounts available
            </SelectItem>
          ) : (
            accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.code ? `${account.code} — ` : ""}
                {account.name}{" "}
                <span className={cn("text-xs text-muted-foreground", account.type && "ml-1")}>
                  {account.type ? `(${account.type})` : ""}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
