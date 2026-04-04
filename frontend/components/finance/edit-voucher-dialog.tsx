"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
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
import { Upload, X, FileText, Image as ImageIcon, Loader2, Plus, Trash2, AlertCircle } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { SearchableSelect } from "@/components/common/searchable-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { HelpCircle } from "lucide-react"

interface EditVoucherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voucherId: string
  onSuccess?: () => void
}

interface VoucherLine {
  id: string
  accountId: string
  debit: number
  credit: number
  description: string
  propertyId?: string
  unitId?: string
}

export function EditVoucherDialog({ open, onOpenChange, voucherId, onSuccess }: EditVoucherDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [voucher, setVoucher] = useState<any>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    date: "",
    paymentMethod: "",
    accountId: "",
    description: "",
    referenceNumber: "",
    propertyId: "",
    unitId: "",
    payeeType: "",
    payeeId: "",
    dealId: "",
  })

  const [lines, setLines] = useState<VoucherLine[]>([])
  const [systemLines, setSystemLines] = useState<VoucherLine[]>([]) // TASK 4: Store system lines separately
  const [attachments, setAttachments] = useState<Array<{ id?: string; url: string; name: string; mimeType?: string }>>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)

  // Determine voucher type from loaded voucher
  const voucherTypeCode = voucher?.type || "BPV"
  const voucherType = useMemo(() => {
    if (voucherTypeCode === "BPV") return "bank-payment"
    if (voucherTypeCode === "BRV") return "bank-receipt"
    if (voucherTypeCode === "CPV") return "cash-payment"
    if (voucherTypeCode === "CRV") return "cash-receipt"
    return "bank-payment"
  }, [voucherTypeCode])

  const isPayment = voucherTypeCode === "BPV" || voucherTypeCode === "CPV"
  const isReceipt = voucherTypeCode === "BRV" || voucherTypeCode === "CRV"
  const isBank = voucherTypeCode === "BPV" || voucherTypeCode === "BRV"
  const isCash = voucherTypeCode === "CPV" || voucherTypeCode === "CRV"

  // Load voucher and accounts when dialog opens
  useEffect(() => {
    if (open && voucherId) {
      fetchVoucher()
      fetchAccounts()
    }
  }, [open, voucherId])

  const fetchVoucher = async () => {
    try {
      setLoading(true)
      const response = await apiService.vouchers.getById(voucherId) as any
      // API returns { success: true, data: voucher } - extract the actual voucher object
      const voucherData = response.data?.data || response.data || response
      setVoucher(voucherData)

      // Extract form data - ensure all fields are properly extracted
      const voucherDate = voucherData.date || voucherData.createdAt
      setFormData({
        date: voucherDate ? new Date(voucherDate).toISOString().split('T')[0] : "",
        paymentMethod: voucherData.paymentMethod || "",
        accountId: voucherData.accountId || "",
        description: voucherData.description || "",
        referenceNumber: voucherData.referenceNumber || "",
        propertyId: voucherData.propertyId || "",
        unitId: voucherData.unitId || "",
        payeeType: voucherData.payeeType || "",
        payeeId: voucherData.payeeId || "",
        dealId: voucherData.dealId || "",
      })

      // TASK 4: Load ALL lines exactly as created (including system lines)
      // System lines will be shown as read-only in the UI
      const allLines = voucherData.lines || []
      const loadedLines = allLines.map((line: any, index: number) => ({
        id: line.id || `line-${index}`,
        accountId: line.accountId,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description || "",
        propertyId: line.propertyId || undefined,
        unitId: line.unitId || undefined,
        isSystemLine: line.accountId === voucherData.accountId || line.description?.includes('[SYSTEM]') || false,
      }))

      // Separate user lines for editing (system lines shown separately as read-only)
      const userLines = loadedLines.filter((line: any) => !line.isSystemLine)
      setLines(userLines.length > 0 ? userLines : [{ id: "1", accountId: "", debit: 0, credit: 0, description: "" }])
      
      // Store system lines separately for display (TASK 4: Show as read-only)
      const sysLines = loadedLines.filter((line: any) => line.isSystemLine).map((line: any) => ({
        id: line.id,
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
        propertyId: line.propertyId,
        unitId: line.unitId,
      }))
      setSystemLines(sysLines)

      // Load attachments - handle various formats
      if (voucherData.attachments) {
        try {
          const attachmentsData = typeof voucherData.attachments === 'string' 
            ? JSON.parse(voucherData.attachments) 
            : voucherData.attachments
          
          if (Array.isArray(attachmentsData)) {
            setAttachments(attachmentsData)
          } else if (attachmentsData?.files && Array.isArray(attachmentsData.files)) {
            setAttachments(attachmentsData.files)
          } else if (attachmentsData?.url) {
            // Single attachment object
            setAttachments([attachmentsData])
          }
        } catch (error) {
          console.error("Failed to parse attachments:", error)
          setAttachments([])
        }
      } else {
        setAttachments([])
      }
    } catch (error: any) {
      toast({
        title: "Failed to load voucher",
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    try {
      setLoadingAccounts(true)
      const response = await apiService.accounts.getAll({ postable: "true" })
      const responseData = response.data as any
      const accountsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setAccounts(accountsData.filter((acc: any) => acc.isPostable && acc.level === 5))
    } catch (error) {
      console.error("Failed to load accounts:", error)
      toast({
        title: "Failed to load accounts",
        description: "Please refresh and try again.",
        variant: "destructive",
      })
    } finally {
      setLoadingAccounts(false)
    }
  }

  // Calculate totals including system-generated line
  const totals = useMemo(() => {
    // User-entered lines only (exclude system lines)
    const userLines = lines.filter((line) => line.accountId !== formData.accountId)
    const userDebit = userLines.reduce((sum, line) => sum + (line.debit || 0), 0)
    const userCredit = userLines.reduce((sum, line) => sum + (line.credit || 0), 0)
    
    // Calculate system line amount
    let systemDebit = 0
    let systemCredit = 0
    
    if (formData.accountId && ['BPV', 'BRV', 'CPV', 'CRV'].includes(voucherTypeCode)) {
      if (isPayment) {
        // BPV/CPV: System credits bank/cash = sum of user debits
        systemCredit = userDebit
      } else {
        // BRV/CRV: System debits bank/cash = sum of user credits
        systemDebit = userCredit
      }
    }
    
    const totalDebit = userDebit + systemDebit
    const totalCredit = userCredit + systemCredit
    
    return { 
      debit: totalDebit, 
      credit: totalCredit, 
      balance: Math.abs(totalDebit - totalCredit),
      userDebit,
      userCredit,
      systemDebit,
      systemCredit,
    }
  }, [lines, formData.accountId, voucherTypeCode, isPayment])

  // Validate balance
  const isBalanced = (totals?.balance || 0) < 0.01

  const addLine = () => {
    setLines([...lines, { id: Date.now().toString(), accountId: "", debit: 0, credit: 0, description: "" }])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      toast({
        title: "Cannot remove",
        description: "Voucher must have at least one line item",
        variant: "destructive",
      })
      return
    }
    setLines(lines.filter((line) => line.id !== id))
  }

  const updateLine = (id: string, field: keyof VoucherLine, value: any) => {
    setLines(lines.map((line) => {
      if (line.id !== id) return line

      // Enforce one-sided per line at state level
      if (field === "debit") {
        const debitVal = Number(value) || 0
        return {
          ...line,
          debit: debitVal,
          credit: debitVal > 0 ? 0 : line.credit,
        }
      }

      if (field === "credit") {
        const creditVal = Number(value) || 0
        return {
          ...line,
          credit: creditVal,
          debit: creditVal > 0 ? 0 : line.debit,
        }
      }

      return { ...line, [field]: value }
    }))
  }

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
      const uploads: Array<{ id?: string; url: string; name: string; mimeType?: string }> = []
      
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
        toast({ title: `${uploads.length} file(s) uploaded successfully` })
      }
    } catch (error: any) {
      toast({
        title: "Failed to upload attachment",
        description: error?.response?.data?.error || error?.message || "Upload failed",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.accountId) {
      toast({
        title: "Primary account required",
        description: "Please select the primary bank/cash account",
        variant: "destructive",
      })
      return
    }

    // Filter out system lines - only send user-entered lines
    const userLines = lines.filter((line) => line.accountId !== formData.accountId)

    if (userLines.length === 0) {
      toast({
        title: "At least one line required",
        description: "Please add at least one line item",
        variant: "destructive",
      })
      return
    }

    // Enforce voucher type rules at UI level
    if (isPayment) {
      const hasCredit = userLines.some((line) => (line.credit || 0) > 0)
      if (hasCredit) {
        toast({
          title: "Invalid entry",
          description: "Manual credit entries are not allowed in Bank/Cash Payment Voucher. Credit will be auto-posted to Bank/Cash.",
          variant: "destructive",
        })
        return
      }
      
      const hasDebit = userLines.some((line) => (line.debit || 0) > 0)
      if (!hasDebit) {
        toast({
          title: "Debit required",
          description: `${voucherTypeCode} requires at least one debit entry`,
          variant: "destructive",
        })
        return
      }
    } else {
      const hasDebit = userLines.some((line) => (line.debit || 0) > 0)
      if (hasDebit) {
        toast({
          title: "Invalid entry",
          description: "Manual debit entries are not allowed in Bank/Cash Receipt Voucher. Debit will be auto-posted to Bank/Cash.",
          variant: "destructive",
        })
        return
      }
      
      const hasCredit = userLines.some((line) => (line.credit || 0) > 0)
      if (!hasCredit) {
        toast({
          title: "Credit required",
          description: `${voucherTypeCode} requires at least one credit entry`,
          variant: "destructive",
        })
        return
      }
    }

    // Validate balance (including system line)
    if (!isBalanced) {
      toast({
        title: "Entries must balance",
        description: `Total Debit (${(totals?.debit || 0).toFixed(2)}) must equal Total Credit (${(totals?.credit || 0).toFixed(2)})`,
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      // CRITICAL: Only send user-entered lines (backend will auto-generate system line)
      const preparedLines = userLines.map((line) => ({
        accountId: line.accountId,
        debit: line.debit || 0,
        credit: line.credit || 0,
        description: line.description || formData.description,
        propertyId: line.propertyId || formData.propertyId || undefined,
        unitId: line.unitId || formData.unitId || undefined,
      }))

      const payload: any = {
        date: formData.date,
        paymentMethod: formData.paymentMethod,
        accountId: formData.accountId,
        description: formData.description,
        referenceNumber: formData.referenceNumber || undefined,
        propertyId: formData.propertyId || undefined,
        unitId: formData.unitId || undefined,
        payeeType: formData.payeeType || undefined,
        payeeId: formData.payeeId || undefined,
        dealId: formData.dealId || undefined,
        lines: preparedLines, // Only user lines - backend auto-generates system line
        attachments: attachments.map((a) => ({
          url: a.url,
          name: a.name,
          mimeType: a.mimeType,
        })),
      }

      await apiService.vouchers.update(voucherId, payload)

      toast({ title: "Voucher updated successfully", description: `Draft ${voucherTypeCode} updated.` })
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Failed to update voucher",
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form
      setFormData({
        date: "",
        paymentMethod: "",
        accountId: "",
        description: "",
        referenceNumber: "",
        propertyId: "",
        unitId: "",
        payeeType: "",
        payeeId: "",
        dealId: "",
      })
      setLines([{ id: "1", accountId: "", debit: 0, credit: 0, description: "" }])
      setSystemLines([]) // TASK 4: Clear system lines
      setAttachments([])
      setVoucher(null)
    }
    onOpenChange(open)
  }

  // Get filtered accounts based on voucher type
  const getFilteredAccounts = (forLine: boolean = false) => {
    if (forLine) {
      if (isPayment) {
        return accounts.filter((acc: any) => acc.type === "Expense" || acc.type === "Liability")
      } else {
        return accounts.filter((acc: any) => 
          acc.type === "Revenue" || 
          acc.type === "Asset" || 
          acc.type === "Liability"
        )
      }
    } else {
      if (isBank) {
        return accounts.filter((acc: any) => 
          acc.code?.startsWith("1112") || 
          acc.code?.startsWith("111201") || 
          acc.code?.startsWith("111202") ||
          acc.name?.toLowerCase().includes("bank")
        )
      } else {
        return accounts.filter((acc: any) => 
          acc.code?.startsWith("1111") || 
          acc.code?.startsWith("111101") || 
          acc.code?.startsWith("111102") ||
          acc.name?.toLowerCase().includes("cash")
        )
      }
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Voucher</DialogTitle>
            <DialogDescription>Please wait while we load the voucher details...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!voucher) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voucher Not Found</DialogTitle>
            <DialogDescription>The voucher you're trying to edit could not be found.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Only allow editing draft vouchers
  if (voucher.status !== 'draft') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Edit Voucher</DialogTitle>
            <DialogDescription>
              This voucher is in {voucher.status} status and cannot be edited. Only draft vouchers can be modified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[1200px] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Voucher - {voucher.voucherNumber} ({voucherTypeCode})</DialogTitle>
          <DialogDescription>
            Update the {voucherTypeCode} voucher. All entries must balance (Total Debit = Total Credit).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid gap-6 py-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isBank ? (
                      <>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                        <SelectItem value="Online">Online</SelectItem>
                      </>
                    ) : (
                      <SelectItem value="Cash">Cash</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="primaryAccount">{isBank ? "Bank" : "Cash"} Account *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This account is auto-selected based on voucher type and cannot be changed.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <SearchableSelect
                  source="accounts"
                  value={formData.accountId}
                  onChange={(value) => setFormData({ ...formData, accountId: value || "" })}
                  placeholder={`Select ${isBank ? "bank" : "cash"} account...`}
                  required
                  filters={{ postable: "true" }}
                  transform={(item: any) => {
                    const isBankAccount = item.code?.startsWith("1112") || item.name?.toLowerCase().includes("bank")
                    const isCashAccount = item.code?.startsWith("1111") || item.name?.toLowerCase().includes("cash")
                    const isRelevant = (isBank && isBankAccount) || (isCash && isCashAccount)
                    return {
                      id: item.id,
                      label: `${item.code} - ${item.name}`,
                      value: item.id,
                      subtitle: item.type,
                      metadata: item,
                      disabled: !isRelevant,
                    }
                  }}
                />
              </div>

              {(isBank && ["Cheque", "Transfer"].includes(formData.paymentMethod)) && (
                <div className="grid gap-2">
                  <Label htmlFor="referenceNumber">Reference Number *</Label>
                  <Input
                    id="referenceNumber"
                    placeholder="Cheque / Transfer / Reference number"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                    required
                  />
                </div>
              )}

              {isPayment && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="payeeType">Payee Type *</Label>
                    <Select
                      value={formData.payeeType}
                      onValueChange={(value) => setFormData({ ...formData, payeeType: value, payeeId: "" })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payee type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vendor">Vendor</SelectItem>
                        <SelectItem value="Owner">Owner</SelectItem>
                        <SelectItem value="Agent">Agent</SelectItem>
                        <SelectItem value="Contractor">Contractor</SelectItem>
                        <SelectItem value="Tenant">Tenant</SelectItem>
                        <SelectItem value="Client">Client</SelectItem>
                        <SelectItem value="Dealer">Dealer</SelectItem>
                        <SelectItem value="Employee">Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.payeeType && (
                    <div className="grid gap-2">
                      <Label htmlFor="payeeId">Payee *</Label>
                      <SearchableSelect
                        source={
                          formData.payeeType === "Agent" || formData.payeeType === "Dealer" ? "dealers" :
                          formData.payeeType === "Tenant" ? "tenants" :
                          formData.payeeType === "Client" ? "clients" :
                          formData.payeeType === "Employee" ? "employees" :
                          "clients"
                        }
                        value={formData.payeeId}
                        onChange={(value) => setFormData({ ...formData, payeeId: value || "" })}
                        placeholder={`Select ${formData.payeeType.toLowerCase()}...`}
                        required
                      />
                    </div>
                  )}
                </>
              )}

              <div className="grid gap-2">
                <Label htmlFor="propertyId">Property (Optional)</Label>
                <SearchableSelect
                  source="properties"
                  value={formData.propertyId}
                  onChange={(value) => setFormData({ ...formData, propertyId: value || "", unitId: "" })}
                  placeholder="Select property..."
                  allowEmpty
                />
              </div>

              {formData.propertyId && (
                <div className="grid gap-2">
                  <Label htmlFor="unitId">Unit (Optional)</Label>
                  <SearchableSelect
                    source="units"
                    value={formData.unitId}
                    onChange={(value) => setFormData({ ...formData, unitId: value || "" })}
                    placeholder="Select unit..."
                    allowEmpty
                    filters={{ propertyId: formData.propertyId }}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Voucher description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Voucher Lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Voucher Lines *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              {/* Voucher-specific guidance */}
              {isPayment && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    Enter amounts in <strong>Debit</strong> for expense or payable accounts. {isBank ? "Bank" : "Cash"} will be <strong>credited automatically</strong> by the system.
                  </AlertDescription>
                </Alert>
              )}
              {isReceipt && (
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    Enter amounts in <strong>Credit</strong> for income or receivable accounts. {isBank ? "Bank" : "Cash"} will be <strong>debited automatically</strong> by the system.
                  </AlertDescription>
                </Alert>
              )}

              {/* TASK 4: Show actual system-generated lines from database as read-only */}
              {systemLines.length > 0 && systemLines.map((systemLine, idx) => {
                const systemAccount = accounts.find((a: any) => a.id === systemLine.accountId) || 
                                     voucher?.lines?.find((l: any) => l.id === systemLine.id)?.account
                return (
                  <div key={systemLine.id || `system-${idx}`} className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-blue-800">System-Generated Line (Read-Only)</span>
                      <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded">Auto-generated</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                      <div className="md:col-span-2">
                        <span className="text-muted-foreground">Account:</span>
                        <span className="ml-2 font-medium">
                          {systemAccount?.code || 'N/A'} - {systemAccount?.name || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Debit:</span>
                        <span className="ml-2 font-semibold">
                          {(systemLine.debit || 0) > 0 ? `Rs ${(systemLine.debit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs 0.00'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Credit:</span>
                        <span className="ml-2 font-semibold">
                          {(systemLine.credit || 0) > 0 ? `Rs ${(systemLine.credit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs 0.00'}
                        </span>
                      </div>
                    </div>
                    {systemLine.description && (
                      <p className="text-xs text-muted-foreground mt-1">{systemLine.description}</p>
                    )}
                    <p className="text-xs text-blue-700 mt-2 italic">
                      This line is automatically generated by the system and cannot be edited. It will be recalculated when you save changes.
                    </p>
                  </div>
                )
              })}
              
              {/* Show calculated preview if no system lines loaded yet (for new edits) */}
              {systemLines.length === 0 && formData.accountId && ['BPV', 'BRV', 'CPV', 'CRV'].includes(voucherTypeCode) && (
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-blue-800">System-Generated Line (Preview)</span>
                    <span className="text-xs px-2 py-0.5 bg-blue-200 text-blue-800 rounded">Auto-generated</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Account:</span>
                      <span className="ml-2 font-medium">
                        {accounts.find((a: any) => a.id === formData.accountId)?.code || 'N/A'} - {accounts.find((a: any) => a.id === formData.accountId)?.name || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Debit:</span>
                      <span className="ml-2 font-semibold">
                        {(totals?.systemDebit || 0) > 0 ? `Rs ${(totals?.systemDebit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs 0.00'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Credit:</span>
                      <span className="ml-2 font-semibold">
                        {(totals?.systemCredit || 0) > 0 ? `Rs ${(totals?.systemCredit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rs 0.00'}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2 italic">
                    This line will be automatically generated by the system when you save.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {lines.map((line, index) => {
                  // Skip system lines in rendering (they're shown separately)
                  if (line.accountId === formData.accountId) {
                    return null
                  }
                  
                  return (
                    <div key={line.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Line {index + 1}</span>
                        </div>
                        {lines.filter((l) => l.accountId !== formData.accountId).length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeLine(line.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className={cn("grid gap-3", isPayment ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-3")}>
                        <div className="md:col-span-2 grid gap-2">
                          <div className="flex items-center gap-2">
                            <Label>Account *</Label>
                          </div>
                          <SearchableSelect
                            source="accounts"
                            value={line.accountId}
                            onChange={(value) => updateLine(line.id, "accountId", value || "")}
                            placeholder={isPayment ? "Select expense or payable account" : "Select income, receivable, or advance account"}
                            required
                            filters={{ postable: "true" }}
                            transform={(item: any) => {
                              let isRelevant = true
                              const isBankAccount = item.code?.startsWith("1112") || item.name?.toLowerCase().includes("bank")
                              const isCashAccount = item.code?.startsWith("1111") || item.name?.toLowerCase().includes("cash")
                              
                              if (isBankAccount || isCashAccount) {
                                isRelevant = false
                              } else if (isPayment) {
                                isRelevant = item.type === "Expense" || item.type === "Liability"
                              } else {
                                isRelevant = ["Revenue", "Asset", "Liability"].includes(item.type)
                              }
                              
                              return {
                                id: item.id,
                                label: `${item.code} - ${item.name}`,
                                value: item.id,
                                subtitle: item.type,
                                metadata: item,
                                disabled: !isRelevant,
                              }
                            }}
                          />
                          {line.accountId ? (
                            <p className="text-xs text-muted-foreground">
                              This account represents where the amount is posted.
                            </p>
                          ) : null}
                        </div>

                        {!isReceipt && (
                          <div className="grid gap-2">
                            <div className="flex items-center gap-2">
                              <Label>Debit *</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Enter the amount to debit this account. Credit will be auto-posted to {isBank ? "Bank" : "Cash"}.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.debit || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                updateLine(line.id, "debit", val)
                              }}
                              placeholder="Enter debit amount"
                              required
                            />
                          </div>
                        )}

                        {!isPayment && (
                          <div className="grid gap-2">
                            <div className="flex items-center gap-2">
                              <Label>Credit *</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Enter the amount to credit this account. Debit will be auto-posted to {isBank ? "Bank" : "Cash"}.</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.credit || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                updateLine(line.id, "credit", val)
                              }}
                              placeholder="Enter credit amount"
                              required
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label>Line Description</Label>
                        <Input
                          placeholder="Line item description"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Balance Summary */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Balance Summary</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Total Debit must equal Total Credit before submission.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">User Debit:</span>
                      <span className="ml-2 font-semibold">Rs {(totals?.userDebit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">User Credit:</span>
                      <span className="ml-2 font-semibold">Rs {(totals?.userCredit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">System {isPayment ? "Credit" : "Debit"}:</span>
                      <span className="ml-2 font-semibold text-blue-600">
                        Rs {(isPayment ? (totals?.systemCredit || 0) : (totals?.systemDebit || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <div className="border-t pt-2 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Debit:</span>
                      <span className="ml-2 font-semibold">Rs {(totals?.debit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Credit:</span>
                      <span className="ml-2 font-semibold">Rs {(totals?.credit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Difference:</span>
                      <span className={cn("ml-2 font-semibold", isBalanced ? "text-green-600" : "text-red-600")}>
                        Rs {(totals?.balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {!isBalanced && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Voucher is not balanced. Please review entered amounts. Total Debit ({(totals?.debit || 0).toFixed(2)}) must equal Total Credit ({(totals?.credit || 0).toFixed(2)}).
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div className="grid gap-2">
              <Label>Attachments *</Label>
              <p className="text-xs text-muted-foreground">Attachment is required for audit and compliance.</p>
              <div className="space-y-2">
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <Label htmlFor="voucher-attachment-upload" className="cursor-pointer">
                    <span className="text-sm text-muted-foreground">Click to upload documents</span>
                    <Input
                      id="voucher-attachment-upload"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                      multiple
                      onChange={handleAttachmentUpload}
                      disabled={uploadingAttachments}
                      className="hidden"
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG, GIF, WEBP up to 10MB each</p>
                  <p className="text-xs text-muted-foreground mt-1">Required for {voucherTypeCode}</p>
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
                              <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                            )}
                            <span className="text-sm truncate">{attachment.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAttachment(idx)}
                            className="shrink-0"
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
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !isBalanced}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Voucher"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
