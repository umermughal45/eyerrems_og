"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent } from "@/components/ui/card"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertCircle, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { SearchableSelect } from "@/components/common/searchable-select"

type OpType = "REFUND" | "TRANSFER" | "MERGE"
type RefundMode = "full" | "partial"
type TargetType = "deal" | "property"

interface PaymentContext {
  id: string
  paymentId: string
  amount: number
  deal?: {
    id: string
    dealCode?: string | null
    title?: string
    client?: { id?: string; name?: string | null; clientCode?: string | null } | null
    property?: { name?: string | null; propertyCode?: string | null } | null
    unit?: { unitName?: string | null } | null
  } | null
}

interface RequestOperationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  dealId?: string
  sourcePaymentId?: string
  sourceClientId?: string
  sourceDealId?: string
  initialOperationType?: OpType
}

const formatRs = (n: number) =>
  `Rs ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function RequestOperationDialog({
  open,
  onOpenChange,
  onSuccess,
  dealId,
  sourcePaymentId,
  sourceClientId,
  sourceDealId,
  initialOperationType = "REFUND",
}: RequestOperationDialogProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [operationType, setOperationType] = useState<OpType>(initialOperationType)
  const [reason, setReason] = useState("")
  const [paymentId, setPaymentId] = useState(sourcePaymentId ?? "")
  const [paymentSearchOpen, setPaymentSearchOpen] = useState(false)
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("")
  const [paymentSearchLoading, setPaymentSearchLoading] = useState(false)
  const [paymentOptions, setPaymentOptions] = useState<any[]>([])
  const [selectedPaymentLabel, setSelectedPaymentLabel] = useState<string | null>(null)
  const [refundMode, setRefundMode] = useState<RefundMode>("full")
  const [partialAmount, setPartialAmount] = useState("")
  const [targetClientId, setTargetClientId] = useState<string | null>(null)
  const [targetType, setTargetType] = useState<TargetType>("deal")
  const [targetDealId, setTargetDealId] = useState<string | null>(null)
  const [targetPropertyId, setTargetPropertyId] = useState<string | null>(null)
  const [targetDealClientId, setTargetDealClientId] = useState<string | null>(null)
  const [targetDealStatus, setTargetDealStatus] = useState<string | null>(null)

  const [paymentContext, setPaymentContext] = useState<PaymentContext | null>(null)
  const [paymentContextLoading, setPaymentContextLoading] = useState(false)
  const [paymentContextError, setPaymentContextError] = useState<string | null>(null)
  const [operationHistory, setOperationHistory] = useState<any[]>([])

  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null)

  const totals = useMemo(() => {
    if (!paymentContext || operationHistory.length === 0) {
      return { refunded: 0, transferred: 0, merged: 0 }
    }
    const paymentRefId = paymentContext.id
    const dealIdRef = paymentContext.deal?.id
    const clientIdRef = paymentContext.deal?.client?.id

    let refunded = 0
    let transferred = 0
    let merged = 0

    for (const op of operationHistory) {
      if (op.status !== "POSTED") continue
      const opAmount = op.partialAmount ?? op.amount ?? 0
      const refs = Array.isArray(op.references) ? op.references : []
      const hasPaymentRef = refs.some((r: any) => r.refType === "payment" && r.refId === paymentRefId)
      const hasDealRef = dealIdRef && refs.some((r: any) => r.refType === "deal" && r.refId === dealIdRef && r.role === "SOURCE")

      if (op.operationType === "REFUND" && hasPaymentRef) refunded += opAmount
      if (op.operationType === "TRANSFER" && hasPaymentRef) transferred += opAmount
      if (op.operationType === "MERGE" && (hasPaymentRef || hasDealRef)) merged += opAmount
    }
    return { refunded, transferred, merged }
  }, [paymentContext, operationHistory])

  const transferableBase = paymentContext ? paymentContext.amount : 0
  const transferableBalance = Math.max(0, transferableBase - totals.refunded - totals.transferred - totals.merged)
  const refundableBalance = Math.max(0, transferableBase - totals.refunded)
  const partialAmt = parseFloat(partialAmount)
  const partialValid =
    refundMode !== "partial" ||
    (partialAmount.trim() !== "" && !isNaN(partialAmt) && partialAmt > 0 && partialAmt <= (operationType === "REFUND" ? refundableBalance : transferableBalance))

  const hasContext = !!paymentContext && !paymentContextError && !paymentContextLoading
  const isBalanceAvailable =
    operationType === "REFUND"
      ? refundableBalance > 0
      : transferableBalance > 0

  const transferClientMismatch =
    operationType === "TRANSFER" &&
    !!paymentContext?.deal?.client?.id &&
    !!targetClientId &&
    paymentContext.deal.client.id === targetClientId

  const mergeDealMismatch =
    operationType === "MERGE" &&
    !!paymentContext?.deal?.id &&
    !!targetDealId &&
    paymentContext.deal.id === targetDealId

  const mergeClientMismatch =
    operationType === "MERGE" &&
    !!paymentContext?.deal?.client?.id &&
    !!targetDealClientId &&
    paymentContext.deal.client.id !== targetDealClientId

  const mergeTargetInactive =
    operationType === "MERGE" &&
    !!targetDealStatus &&
    ["closed", "cancelled", "lost", "inactive", "sold"].includes(targetDealStatus.toLowerCase())

  const canSubmit =
    !!reason.trim() &&
    !!paymentId.trim() &&
    hasContext &&
    isBalanceAvailable &&
    !loading &&
    (refundMode === "full" || partialValid) &&
    (operationType !== "TRANSFER" || (!!targetClientId && !transferClientMismatch)) &&
    (operationType !== "MERGE" || (!!targetDealId || !!targetPropertyId)) &&
    !mergeDealMismatch &&
    !mergeClientMismatch &&
    !mergeTargetInactive

  const fetchPaymentContext = useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed) {
      setPaymentContext(null)
      setPaymentContextError(null)
      return
    }
    setPaymentContextLoading(true)
    setPaymentContextError(null)
    setPaymentContext(null)
    try {
      const res: any = await apiService.payments.getById(trimmed)
      const data = res?.data ?? res
      if (data?.id) {
        setPaymentContext(data as PaymentContext)
      } else {
        setPaymentContextError("Payment not found")
      }
    } catch {
      setPaymentContextError("Invalid Payment UUID or payment not found")
      setPaymentContext(null)
    } finally {
      setPaymentContextLoading(false)
    }
  }, [])

  const fetchPaymentOptions = useCallback(async (query: string) => {
    setPaymentSearchLoading(true)
    try {
      const res: any = await apiService.payments.getAll({ page: 1, limit: 50 })
      const data = res?.data?.data ?? res?.data ?? []
      const list = Array.isArray(data) ? data : []
      const q = query.trim().toLowerCase()
      const filtered = q
        ? list.filter((p: any) => {
            const paymentIdText = String(p.paymentId || "").toLowerCase()
            const clientName = String(p.deal?.client?.name || "").toLowerCase()
            const dealCode = String(p.deal?.dealCode || "").toLowerCase()
            const propertyName = String(p.deal?.property?.name || "").toLowerCase()
            return (
              paymentIdText.includes(q) ||
              clientName.includes(q) ||
              dealCode.includes(q) ||
              propertyName.includes(q)
            )
          })
        : list
      setPaymentOptions(filtered.slice(0, 20))
    } catch {
      setPaymentOptions([])
    } finally {
      setPaymentSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && paymentId.trim()) {
      const t = setTimeout(() => fetchPaymentContext(paymentId), 400)
      return () => clearTimeout(t)
    } else if (!paymentId.trim()) {
      setPaymentContext(null)
      setPaymentContextError(null)
    }
  }, [open, paymentId, fetchPaymentContext])

  useEffect(() => {
    if (open && paymentSearchOpen) {
      const t = setTimeout(() => fetchPaymentOptions(paymentSearchQuery), 250)
      return () => clearTimeout(t)
    }
  }, [open, paymentSearchOpen, paymentSearchQuery, fetchPaymentOptions])

  useEffect(() => {
    if (paymentContext?.deal?.id) {
      apiService.financeOperations
        .getByDealId(paymentContext.deal.id)
        .then((res: any) => {
          const data = res?.data?.data ?? res?.data ?? []
          setOperationHistory(Array.isArray(data) ? data : [])
        })
        .catch(() => setOperationHistory([]))
    } else {
      setOperationHistory([])
    }
  }, [paymentContext?.deal?.id])

  useEffect(() => {
    if (operationType !== "MERGE" || !targetDealId) {
      setTargetDealClientId(null)
      setTargetDealStatus(null)
      return
    }
    apiService.deals
      .getById(targetDealId)
      .then((res: any) => {
        const data = res?.data?.data ?? res?.data ?? res
        setTargetDealClientId(data?.clientId ?? null)
        setTargetDealStatus(data?.status ?? null)
      })
      .catch(() => {
        setTargetDealClientId(null)
        setTargetDealStatus(null)
      })
  }, [operationType, targetDealId])

  useEffect(() => {
    if (open) {
      if (sourcePaymentId) setPaymentId(sourcePaymentId)
      setOperationType(initialOperationType)
    }
  }, [open, sourcePaymentId, initialOperationType])

  const resetForm = () => {
    setOperationType("REFUND")
    setReason("")
    setPaymentId(sourcePaymentId ?? "")
    setSelectedPaymentLabel(null)
    setPaymentSearchQuery("")
    setPaymentSearchOpen(false)
    setPaymentOptions([])
    setRefundMode("full")
    setPartialAmount("")
    setTargetClientId(null)
    setTargetDealId(null)
    setTargetPropertyId(null)
    setTargetDealClientId(null)
    setTargetDealStatus(null)
    setPaymentContext(null)
    setPaymentContextError(null)
    setCreatedRequestId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return

    try {
      setLoading(true)
      const payload: any = {
        operationType,
        reason: reason.trim(),
        dealId: dealId || paymentContext?.deal?.id || undefined,
        sourcePaymentId: paymentId.trim(),
      }

      if (operationType === "REFUND") {
        if (refundMode === "partial" && partialValid && !isNaN(partialAmt)) {
          payload.partialAmount = partialAmt
        } else {
          payload.amount = refundableBalance
        }
      }

      if (operationType === "TRANSFER") {
        payload.sourceClientId = paymentContext?.deal?.client?.id
        payload.targetClientId = targetClientId
        payload.amount = refundMode === "partial" && partialValid && !isNaN(partialAmt) ? partialAmt : transferableBalance
      }

      if (operationType === "MERGE") {
        payload.sourcePaymentId = paymentId.trim()
        payload.sourceDealId = paymentContext?.deal?.id
        if (targetType === "deal") payload.targetDealId = targetDealId
        if (targetType === "property") payload.targetPropertyId = targetPropertyId
        payload.amount = refundMode === "partial" && partialValid && !isNaN(partialAmt) ? partialAmt : transferableBalance
      }

      const res: any = await apiService.financeOperations.request(payload)
      const data = res?.data?.data ?? res?.data ?? res
      const opId = typeof data === "object" && data?.id ? data.id : null

      setCreatedRequestId(opId)
      toast({
        title: "Request created",
        description: "Execute in Finance → Operations.",
      })
      onSuccess?.()
    } catch (err: any) {
      const raw = err.response?.data?.error ?? err.message ?? ""
      const friendly =
        typeof raw === "string" && raw.length > 0
          ? raw
          : "Failed to create request. Please check your entries and try again."
      toast({
        title: "Request failed",
        description: friendly,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = (v: boolean) => {
    if (!v) {
      resetForm()
      onOpenChange(false)
    }
  }

  const goToOperations = (requestId?: string) => {
    resetForm()
    onOpenChange(false)
    router.push(requestId ? `/finance?tab=operations&requestId=${requestId}` : "/finance?tab=operations")
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby="request-operation-desc">
        <DialogHeader>
          <DialogTitle>Request Finance Operation</DialogTitle>
          <DialogDescription id="request-operation-desc">
            Request-only form. Does not create vouchers or modify payments. Execution happens in Finance → Operations only.
          </DialogDescription>
        </DialogHeader>

        {createdRequestId ? (
          <div className="space-y-4">
            <Card className="border-green-200 bg-green-50/50 dark:border-green-900/50 dark:bg-[#0d212c]">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Request created successfully
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Request ID: <span className="font-mono">{createdRequestId}</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status: <span className="font-medium">Pending</span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => goToOperations(createdRequestId || undefined)}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Finance → Operations
                </Button>
              </CardContent>
            </Card>
            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Close</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Operation Type - Radio buttons, changing type resets dependent fields */}
            <div>
              <Label>Operation Type</Label>
              <RadioGroup
                value={operationType}
                onValueChange={(v) => {
                  setOperationType(v as OpType)
                  setTargetClientId(null)
                  setTargetDealId(null)
                  setTargetPropertyId(null)
                  setTargetDealClientId(null)
                  setTargetDealStatus(null)
                  setPartialAmount("")
                }}
                className="flex flex-col gap-3 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="REFUND" id="op-refund" />
                  <Label htmlFor="op-refund" className="font-normal cursor-pointer">
                    Refund
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="TRANSFER" id="op-transfer" />
                  <Label htmlFor="op-transfer" className="font-normal cursor-pointer">
                    Transfer (Client → Client)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="MERGE" id="op-merge" />
                  <Label htmlFor="op-merge" className="font-normal cursor-pointer">
                    Merge / Reallocation
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Reason *</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mandatory reason for this operation"
                rows={2}
                required
              />
            </div>

            {operationType && (
              <>
                <div>
                  <Label>Source Payment *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPaymentSearchOpen(true)}
                      className={cn("flex-1 justify-start", paymentContextError && "border-destructive")}
                      aria-label="Search and select payment"
                    >
                      {selectedPaymentLabel || "Search and select payment..."}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedPaymentLabel(null)
                        setPaymentId("")
                        setPaymentContext(null)
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                  {paymentContextError && (
                    <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {paymentContextError}
                    </p>
                  )}
                </div>

                {/* 1. Payment Context Preview (read-only) */}
                {paymentContextLoading && (
                  <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading payment context…
                  </div>
                )}
                {paymentContext && !paymentContextLoading && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm font-semibold mb-3 text-foreground">Payment Summary (read-only)</p>
                      <dl className="grid grid-cols-1 gap-2 text-sm">
                        <div>
                          <dt className="text-muted-foreground">Client</dt>
                          <dd className="font-medium text-foreground">{paymentContext.deal?.client?.name ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Property / Deal</dt>
                          <dd className="font-medium text-foreground">
                            {paymentContext.deal?.property?.name ?? "—"}
                            {paymentContext.deal?.unit?.unitName ? ` / ${paymentContext.deal.unit.unitName}` : ""}
                            {paymentContext.deal?.dealCode ? ` (${paymentContext.deal.dealCode})` : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Original Amount</dt>
                          <dd className="font-semibold text-foreground tabular-nums">{formatRs(paymentContext.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Refunded</dt>
                          <dd className="font-medium text-foreground tabular-nums">{formatRs(totals.refunded)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Transferred</dt>
                          <dd className="font-medium text-foreground tabular-nums">{formatRs(totals.transferred)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Merged</dt>
                          <dd className="font-medium text-foreground tabular-nums">{formatRs(totals.merged)}</dd>
                        </div>
                        <div className="pt-2 border-t">
                          <dt className="text-muted-foreground">Available Balance</dt>
                          <dd className={`font-bold tabular-nums ${isBalanceAvailable ? "text-foreground" : "text-destructive"}`}>
                            {formatRs(operationType === "REFUND" ? refundableBalance : transferableBalance)}
                          </dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                )}

                {/* Transfer / Merge specific fields */}
                {operationType === "TRANSFER" && paymentContext && (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <Label>Source Client (read-only)</Label>
                        <Input value={paymentContext.deal?.client?.name || ""} readOnly />
                      </div>
                      <SearchableSelect
                        source="clients"
                        value={targetClientId}
                        onChange={(v) => setTargetClientId(v)}
                        label="Target Client"
                        placeholder="Select target client"
                        required
                        error={transferClientMismatch}
                      />
                      {transferClientMismatch && (
                        <p className="text-sm text-destructive">
                          Target Client must be different from Source Client.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {operationType === "MERGE" && paymentContext && (
                  <Card>
                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <Label>Source Deal (read-only)</Label>
                        <Input
                          value={paymentContext.deal?.dealCode
                            ? `${paymentContext.deal.dealCode} — ${paymentContext.deal.title || ""}`.trim()
                            : paymentContext.deal?.title ?? "—"}
                          readOnly
                        />
                      </div>
                      <div>
                        <Label>Same Client (read-only)</Label>
                        <Input value={paymentContext.deal?.client?.name || ""} readOnly />
                      </div>
                      <div>
                        <Label>Target Type</Label>
                        <RadioGroup
                          value={targetType}
                          onValueChange={(v) => {
                            setTargetType(v as TargetType)
                            setTargetDealId(null)
                            setTargetPropertyId(null)
                          }}
                          className="flex gap-4 mt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="deal" id="target-deal" />
                            <Label htmlFor="target-deal" className="font-normal cursor-pointer">
                              Deal
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="property" id="target-property" />
                            <Label htmlFor="target-property" className="font-normal cursor-pointer">
                              Property
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                      {targetType === "deal" ? (
                        <SearchableSelect
                          source="deals"
                          value={targetDealId}
                          onChange={(v) => setTargetDealId(v)}
                          label="Target Deal"
                          placeholder="Select target deal"
                          required
                          error={mergeDealMismatch || mergeClientMismatch || mergeTargetInactive}
                        />
                      ) : (
                        <SearchableSelect
                          source="properties"
                          value={targetPropertyId}
                          onChange={(v) => setTargetPropertyId(v)}
                          label="Target Property"
                          placeholder="Select target property"
                          required
                        />
                      )}
                      {mergeDealMismatch && (
                        <p className="text-sm text-destructive">
                          Source and target deals must be different.
                        </p>
                      )}
                      {mergeClientMismatch && (
                        <p className="text-sm text-destructive">
                          Target deal must belong to the same client.
                        </p>
                      )}
                      {mergeTargetInactive && (
                        <p className="text-sm text-destructive">
                          Target deal is not active.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 2. Full vs Partial Amount */}
                <div>
                  <Label>{operationType === "REFUND" ? "Refund Type" : "Amount Type"}</Label>
                  <RadioGroup
                    value={refundMode}
                    onValueChange={(v) => {
                      setRefundMode(v as RefundMode)
                      if (v === "full") setPartialAmount("")
                    }}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="full" id="full" />
                      <Label htmlFor="full" className="font-normal cursor-pointer">
                        Full Amount
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="partial" id="partial" />
                      <Label htmlFor="partial" className="font-normal cursor-pointer">
                        Partial Amount
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {refundMode === "full" && paymentContext && (
                  <p className="text-sm text-muted-foreground rounded-lg border p-3 bg-muted/50">
                    This will apply {formatRs(operationType === "REFUND" ? refundableBalance : transferableBalance)} (remaining balance)
                  </p>
                )}

                {refundMode === "partial" && (
                  <div>
                    <Label>Partial Amount *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={operationType === "REFUND" ? refundableBalance : transferableBalance}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      placeholder={`Max ${formatRs(operationType === "REFUND" ? refundableBalance : transferableBalance)}`}
                      className={cn(
                        partialAmount.trim() !== "" &&
                          (!partialValid && "border-destructive")
                      )}
                    />
                    {partialAmount.trim() !== "" && !partialValid && (
                      <p className="text-sm text-destructive mt-1" role="alert">
                        Amount must be greater than 0 and cannot exceed available balance ({formatRs(operationType === "REFUND" ? refundableBalance : transferableBalance)}).
                      </p>
                    )}
                  </div>
                )}

                {!isBalanceAvailable && paymentContext && (
                  <p className="text-sm text-destructive font-medium">
                    Available balance is zero. Submission blocked. Complete pending operations or select a different payment.
                  </p>
                )}
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Request"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      {paymentSearchOpen && (
        <Dialog open={paymentSearchOpen} onOpenChange={setPaymentSearchOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Select Source Payment</DialogTitle>
              <DialogDescription>Search by payment ID, client, deal or property.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                placeholder="Search payments..."
              />
              {paymentSearchLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading payments...
                </div>
              ) : (
                <div className="max-h-64 overflow-auto space-y-2">
                  {paymentOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No payments found.</p>
                  ) : (
                    paymentOptions.map((p: any) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        className="w-full justify-between"
                        type="button"
                        onClick={() => {
                          setPaymentId(p.id)
                          setSelectedPaymentLabel(`${p.paymentId} — ${p.deal?.client?.name || "Client"} (${formatRs(p.amount)})`)
                          setPaymentSearchOpen(false)
                        }}
                      >
                        <span className="text-left">
                          {p.paymentId} — {p.deal?.client?.name || "Client"}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatRs(p.amount)}</span>
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentSearchOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
