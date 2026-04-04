"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { SearchableSelect } from "@/components/common/searchable-select"
import { VoucherAccountSelect } from "@/components/finance/voucher-account-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { HelpCircle } from "lucide-react"
import { getConfig } from "@/lib/voucher-config"

interface AddGeneralVoucherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface JournalLine {
  id: string
  accountId: string
  debit: number
  credit: number
  description: string
  propertyId?: string
  unitId?: string
}

const JV_WARNING = "Journal Vouchers are for non-cash adjustments only. No Cash, Bank, AR, or AP."

export function AddGeneralVoucherDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddGeneralVoucherDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const cfg = getConfig("JV")

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    propertyId: "",
    unitId: "",
  })

  const [lines, setLines] = useState<JournalLine[]>([
    { id: "1", accountId: "", debit: 0, credit: 0, description: "" },
    { id: "2", accountId: "", debit: 0, credit: 0, description: "" },
  ])

  const totalDebit = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    [lines],
  )
  const totalCredit = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
    [lines],
  )
  const balanceDiff = Math.abs(totalDebit - totalCredit)
  const isBalanced = balanceDiff < 0.01

  const everyLineOneSided = useMemo(() => {
    return lines.every((l) => {
      const d = Number(l.debit) || 0
      const c = Number(l.credit) || 0
      return (d > 0 && c <= 0) || (c > 0 && d <= 0)
    })
  }, [lines])

  const everyLineHasAmount = useMemo(() => {
    return lines.every((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0)
  }, [lines])

  const allHaveAccounts = useMemo(
    () => lines.every((l) => !!l.accountId?.trim()),
    [lines],
  )

  const canSave =
    lines.length >= cfg.minUserLines &&
    allHaveAccounts &&
    everyLineOneSided &&
    everyLineHasAmount &&
    isBalanced &&
    !loading

  const addLine = () => {
    setLines([
      ...lines,
      { id: Date.now().toString(), accountId: "", debit: 0, credit: 0, description: "" },
    ])
  }

  const removeLine = (id: string) => {
    if (lines.length <= cfg.minUserLines) {
      toast({
        title: "Cannot remove",
        description: `JV requires at least ${cfg.minUserLines} line items (double-entry).`,
        variant: "destructive",
      })
      return
    }
    setLines(lines.filter((l) => l.id !== id))
  }

  const updateLine = (id: string, field: keyof JournalLine, value: unknown) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return

    const payload = {
      type: "JV",
      date: formData.date,
      paymentMethod: "N/A",
      accountId: lines[0].accountId,
      description: formData.description || undefined,
      propertyId: formData.propertyId || undefined,
      unitId: formData.unitId || undefined,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || formData.description,
        propertyId: l.propertyId || formData.propertyId || undefined,
        unitId: l.unitId || formData.unitId || undefined,
      })),
    }

    try {
      setLoading(true)
      await apiService.vouchers.create(payload)
      toast({ title: "Journal voucher created", description: "Draft JV created." })
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      toast({
        title: "Failed to create journal voucher",
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
      description: "",
      propertyId: "",
      unitId: "",
    })
    setLines([
      { id: "1", accountId: "", debit: 0, credit: 0, description: "" },
      { id: "2", accountId: "", debit: 0, credit: 0, description: "" },
    ])
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) reset()
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[1200px] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1200px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Journal Voucher (JV)</DialogTitle>
          <DialogDescription>
            Non-cash adjustments only (accruals, depreciation, provisions, corrections). Debit must equal Credit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-6 py-4">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900 font-medium">
              {JV_WARNING}
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Date *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea
                placeholder="e.g. Depreciation, Accrual, Correction"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Journal lines * (min {cfg.minUserLines})</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-2" />
                Add line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={line.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Line {idx + 1}</span>
                    {lines.length > cfg.minUserLines && (
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
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2 grid gap-2">
                      <div className="flex items-center gap-2">
                        <Label>Account *</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{JV_WARNING}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <VoucherAccountSelect
                        voucherType="JV"
                        context="line"
                        value={line.accountId || null}
                        onChange={(v) => updateLine(line.id, "accountId", v ?? "")}
                        placeholder="Asset, Liability, Expense, Equity, Income"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Debit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.debit || ""}
                        onChange={(e) =>
                          updateLine(line.id, "debit", parseFloat(e.target.value) || 0)
                        }
                        disabled={(Number(line.credit) || 0) > 0}
                        placeholder="0.00"
                        className={cn((Number(line.credit) || 0) > 0 && "cursor-not-allowed")}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Credit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.credit || ""}
                        onChange={(e) =>
                          updateLine(line.id, "credit", parseFloat(e.target.value) || 0)
                        }
                        disabled={(Number(line.debit) || 0) > 0}
                        placeholder="0.00"
                        className={cn((Number(line.debit) || 0) > 0 && "cursor-not-allowed")}
                      />
                    </div>
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
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Balance</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Debit:</span>{" "}
                  <span className="font-semibold">
                    Rs {(totalDebit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Credit:</span>{" "}
                  <span className="font-semibold">
                    Rs {(totalCredit || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              {!isBalanced && (
                <Alert variant="destructive" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Out of balance: {balanceDiff.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Debit must equal Credit.
                  </AlertDescription>
                </Alert>
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
                "Create JV (draft)"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
