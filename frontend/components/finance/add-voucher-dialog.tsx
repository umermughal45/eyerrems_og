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
import { X, FileText, Image as ImageIcon, Loader2, Plus, Trash2, AlertCircle, Lock } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { SearchableSelect } from "@/components/common/searchable-select"
import { VoucherAccountSelect } from "@/components/finance/voucher-account-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn, formatCurrency } from "@/lib/utils"
import { HelpCircle } from "lucide-react"
import {
  type VoucherTypeCode,
  type AccountLike,
  getConfig,
  getControlType,
} from "@/lib/voucher-config"

interface AddVoucherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voucherType?: "bank-payment" | "bank-receipt" | "cash-payment" | "cash-receipt"
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

const PAYEE_TYPES = [
  "Vendor", "Owner", "Agent", "Contractor", "Tenant", "Client", "Dealer", "Employee",
] as const

function toCode(t: AddVoucherDialogProps["voucherType"]): VoucherTypeCode {
  switch (t) {
    case "bank-payment": return "BPV"
    case "bank-receipt": return "BRV"
    case "cash-payment": return "CPV"
    case "cash-receipt": return "CRV"
    default: return "BPV"
  }
}

export function AddVoucherDialog({
  open,
  onOpenChange,
  voucherType = "bank-payment",
  onSuccess,
}: AddVoucherDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState<AccountLike[]>([])

  const code = toCode(voucherType)
  const cfg = getConfig(code)
  const isPayment = cfg.lineSide === "debit"
  const isBank = code === "BPV" || code === "BRV"

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    paymentMethod: isBank ? "Cheque" : "Cash",
    accountId: "" as string,
    description: "",
    referenceNumber: "",
    propertyId: "",
    unitId: "",
    payeeType: "",
    payeeId: "",
    dealId: "",
    customerId: "", // BRV/CRV when any line is AR
  })

  const [lines, setLines] = useState<VoucherLine[]>([
    { id: "1", accountId: "", debit: 0, credit: 0, description: "" },
  ])

  const [attachments, setAttachments] = useState<
    Array<{ id?: string; url: string; name: string; mimeType?: string }>
  >([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)

  useEffect(() => {
    if (!open) return
    apiService.accounts
      .getAll({ postable: "true", limit: 500 })
      .then((res: any) => {
        const data = (res?.data?.data ?? res?.data) ?? []
        setAccounts(Array.isArray(data) ? data : [])
      })
      .catch(() => setAccounts([]))
  }, [open])

  const userLines = useMemo(
    () => lines.filter((l) => l.accountId && l.accountId !== formData.accountId),
    [lines, formData.accountId],
  )
  const userDebit = useMemo(
    () => userLines.reduce((s, l) => s + (l.debit || 0), 0),
    [userLines],
  )
  const userCredit = useMemo(
    () => userLines.reduce((s, l) => s + (l.credit || 0), 0),
    [userLines],
  )
  const systemDebit = cfg.controlSide === "debit" ? userCredit : 0
  const systemCredit = cfg.controlSide === "credit" ? userDebit : 0
  const totalDebit = userDebit + systemDebit
  const totalCredit = userCredit + systemCredit
  const balanceDiff = Math.abs(totalDebit - totalCredit)
  const isBalanced = balanceDiff < 0.01

  const primaryAccount = useMemo(
    () => accounts.find((a) => a.id === formData.accountId),
    [accounts, formData.accountId],
  )
  const anyLineIsAR = useMemo(() => {
    return userLines.some((l) => {
      const acc = accounts.find((a) => a.id === l.accountId)
      return acc && getControlType(acc) === "AR"
    })
  }, [userLines, accounts])
  const anyLineIsAP = useMemo(() => {
    return userLines.some((l) => {
      const acc = accounts.find((a) => a.id === l.accountId)
      return acc && getControlType(acc) === "AP"
    })
  }, [userLines, accounts])

  const needPayee = isPayment || anyLineIsAP
  const needCustomer = (code === "BRV" || code === "CRV") && anyLineIsAR
  const payeeOk = !needPayee || (!!formData.payeeType && !!formData.payeeId)
  const customerOk = !needCustomer || !!formData.customerId
  const refOk = !isBank || !["Cheque", "Transfer"].includes(formData.paymentMethod) || !!formData.referenceNumber?.trim()
  const attachmentsOk = attachments.length > 0
  const everyLineHasAmount = userLines.every(
    (l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0,
  )
  const canSave =
    !!formData.accountId &&
    userLines.length >= cfg.minUserLines &&
    everyLineHasAmount &&
    (isPayment ? userDebit > 0 : userCredit > 0) &&
    isBalanced &&
    payeeOk &&
    customerOk &&
    refOk &&
    attachmentsOk &&
    !loading

  const addLine = () => {
    setLines([...lines, { id: Date.now().toString(), accountId: "", debit: 0, credit: 0, description: "" }])
  }

  const removeLine = (id: string) => {
    const after = lines.filter((l) => l.id !== id)
    const user = after.filter((l) => l.accountId && l.accountId !== formData.accountId)
    if (user.length < cfg.minUserLines) {
      toast({
        title: "Cannot remove",
        description: `${cfg.name} requires at least ${cfg.minUserLines} line(s).`,
        variant: "destructive",
      })
      return
    }
    setLines(after)
  }

  const updateLine = (id: string, field: keyof VoucherLine, value: unknown) => {
    setLines(
      lines.map((line) => {
        if (line.id !== id) return line
        if (field === "debit") {
          const v = Number(value) || 0
          return { ...line, debit: v, credit: v > 0 ? 0 : line.credit }
        }
        if (field === "credit") {
          const v = Number(value) || 0
          return { ...line, credit: v, debit: v > 0 ? 0 : line.debit }
        }
        return { ...line, [field]: value }
      }),
    )
  }

  const handlePrimaryChange = (accountId: string | null) => {
    const id = accountId ?? ""
    setFormData((f) => ({ ...f, accountId: id }))
    const rest = lines.filter((l) => l.accountId !== id)
    if (rest.length === 0) {
      setLines([{ id: Date.now().toString(), accountId: "", debit: 0, credit: 0, description: "" }])
    } else {
      setLines(rest)
    }
  }

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.readAsDataURL(file)
      r.onload = () => resolve(r.result as string)
      r.onerror = (e) => reject(e)
    })

  const onAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files
    if (!files?.length) return
    setUploadingAttachments(true)
    try {
      const next: typeof attachments = []
      for (const file of Array.from(files)) {
        if (!["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"].includes(file.type.toLowerCase()))
          continue
        if (file.size > 10 * 1024 * 1024) continue
        const url = await toBase64(file)
        next.push({ url, name: file.name, mimeType: file.type })
      }
      if (next.length) {
        setAttachments((p) => [...p, ...next])
        toast({ title: `${next.length} file(s) added` })
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" })
    } finally {
      setUploadingAttachments(false)
      e.target.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return

    const payload = {
      type: code,
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      accountId: formData.accountId,
      description: formData.description || undefined,
      referenceNumber: formData.referenceNumber || undefined,
      propertyId: formData.propertyId || undefined,
      unitId: formData.unitId || undefined,
      payeeType: needPayee ? formData.payeeType || undefined : undefined,
      payeeId: needPayee ? formData.payeeId || undefined : undefined,
      dealId: formData.dealId || undefined,
      lines: userLines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit || 0,
        credit: l.credit || 0,
        description: l.description || formData.description,
        propertyId: l.propertyId || formData.propertyId || undefined,
        unitId: l.unitId || formData.unitId || undefined,
      })),
      attachments: attachments.map((a) => ({ url: a.url, name: a.name, mimeType: a.mimeType })),
    }

    try {
      setLoading(true)
      await apiService.vouchers.create(payload)
      toast({ title: "Voucher created", description: `Draft ${code} created.` })
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      toast({
        title: "Failed to create voucher",
        description: err?.response?.data?.error || err?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFormData({
      date: new Date().toISOString().split("T")[0],
      paymentMethod: isBank ? "Cheque" : "Cash",
      accountId: "",
      description: "",
      referenceNumber: "",
      propertyId: "",
      unitId: "",
      payeeType: "",
      payeeId: "",
      dealId: "",
      customerId: "",
    })
    setLines([{ id: "1", accountId: "", debit: 0, credit: 0, description: "" }])
    setAttachments([])
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  const title = `New ${cfg.name} (${code})`
  const controlLabel = primaryAccount
    ? `${primaryAccount.code ?? ""} - ${primaryAccount.name ?? ""}`
    : "—"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[1200px] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {cfg.controlSide === "credit"
              ? `Money out. Debit expense/payables; ${cfg.control} credited automatically.`
              : `Money in. Credit income/receivables; ${cfg.control} debited automatically.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Payment method *</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) => setFormData((f) => ({ ...f, paymentMethod: v }))}
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
                <Label>{cfg.control} account *</Label>
                <VoucherAccountSelect
                  voucherType={code}
                  context="primary"
                  value={formData.accountId || null}
                  onChange={(v) => handlePrimaryChange(v)}
                  placeholder={`Select ${cfg.control} account…`}
                  required
                />
              </div>

              {isBank && ["Cheque", "Transfer"].includes(formData.paymentMethod) && (
                <div className="grid gap-2">
                  <Label>Reference number *</Label>
                  <Input
                    placeholder="Cheque / Transfer reference"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData((f) => ({ ...f, referenceNumber: e.target.value }))}
                  />
                </div>
              )}

              {needPayee && (
                <>
                  <div className="grid gap-2">
                    <Label>Payee type *</Label>
                    <Select
                      value={formData.payeeType}
                      onValueChange={(v) => setFormData((f) => ({ ...f, payeeType: v, payeeId: "" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payee type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYEE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.payeeType && (
                    <div className="grid gap-2">
                      <Label>Payee *</Label>
                      <SearchableSelect
                        source={
                          formData.payeeType === "Agent" || formData.payeeType === "Dealer"
                            ? "dealers"
                            : formData.payeeType === "Tenant"
                              ? "tenants"
                              : formData.payeeType === "Client"
                                ? "clients"
                                : formData.payeeType === "Employee"
                                  ? "employees"
                                  : "clients"
                        }
                        value={formData.payeeId}
                        onChange={(v) => setFormData((f) => ({ ...f, payeeId: v ?? "" }))}
                        placeholder={`Select ${formData.payeeType}…`}
                        required
                      />
                    </div>
                  )}
                </>
              )}

              {needCustomer && (
                <div className="grid gap-2 md:col-span-2">
                  <Label>Customer (AR) *</Label>
                  <SearchableSelect
                    source="clients"
                    value={formData.customerId}
                    onChange={(v) => setFormData((f) => ({ ...f, customerId: v ?? "" }))}
                    placeholder="Select customer…"
                    required
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Property (optional)</Label>
                <SearchableSelect
                  source="properties"
                  value={formData.propertyId}
                  onChange={(v) => setFormData((f) => ({ ...f, propertyId: v ?? "", unitId: "" }))}
                  placeholder="Select property…"
                  allowEmpty
                />
              </div>
              {formData.propertyId && (
                <div className="grid gap-2">
                  <Label>Unit (optional)</Label>
                  <SearchableSelect
                    source="units"
                    value={formData.unitId}
                    onChange={(v) => setFormData((f) => ({ ...f, unitId: v ?? "" }))}
                    placeholder="Select unit…"
                    allowEmpty
                    filters={{ propertyId: formData.propertyId }}
                  />
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Voucher description"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Locked control row */}
            {formData.accountId && cfg.control && (
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-amber-700" />
                  <span className="text-sm font-semibold text-amber-800">Control account (locked)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Account:</span>{" "}
                    <span className="font-medium">{controlLabel}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Debit:</span>{" "}
                    <span className="font-semibold">
                      {systemDebit > 0
                        ? formatCurrency(systemDebit)
                        : formatCurrency(0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Credit:</span>{" "}
                    <span className="font-semibold">
                      {systemCredit > 0
                        ? formatCurrency(systemCredit)
                        : formatCurrency(0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* User lines */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Lines *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add line
                </Button>
              </div>

              <Alert className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  {isPayment
                    ? `Enter amounts in Debit only. ${cfg.control} is credited automatically.`
                    : `Enter amounts in Credit only. ${cfg.control} is debited automatically.`}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {lines.map((line) => {
                  if (line.accountId === formData.accountId) return null
                  return (
                    <div key={line.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Line</span>
                        {lines.filter((l) => l.accountId !== formData.accountId).length > cfg.minUserLines && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(line.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="md:col-span-2 grid gap-2">
                          <Label>Account *</Label>
                          <VoucherAccountSelect
                            voucherType={code}
                            context="line"
                            value={line.accountId || null}
                            onChange={(v) => updateLine(line.id, "accountId", v ?? "")}
                            placeholder={isPayment ? "Expense / Payable" : "Income / Receivable / Advance"}
                            required
                          />
                        </div>
                        {isPayment && (
                          <div className="grid gap-2">
                            <Label>Debit *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={line.debit || ""}
                              onChange={(e) => updateLine(line.id, "debit", parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                          </div>
                        )}
                        {!isPayment && (
                          <div className="grid gap-2">
                            <Label>Credit *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={line.credit || ""}
                              onChange={(e) => updateLine(line.id, "credit", parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                            />
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <Label>Description</Label>
                        <Input
                          placeholder="Line description"
                          value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Balance summary */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Balance</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Debit:</span>{" "}
                  <span className="font-semibold">
                    {formatCurrency(totalDebit || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Credit:</span>{" "}
                  <span className="font-semibold">
                    {formatCurrency(totalCredit || 0)}
                  </span>
                </div>
              </div>
              {!isBalanced && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Out of balance: {formatCurrency(balanceDiff)}. Debit must equal Credit.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Attachments */}
            <div className="grid gap-2">
              <Label>Attachments *</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <Label className="cursor-pointer">
                  <span className="text-sm text-muted-foreground">Click to upload</span>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={onAttachmentUpload}
                    disabled={uploadingAttachments}
                    className="hidden"
                  />
                </Label>
                <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG, GIF, WEBP, max 10MB each. Required.</p>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm truncate">{a.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create voucher (draft)"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
