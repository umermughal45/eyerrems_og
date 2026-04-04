"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RotateCcw, ArrowRightLeft, Merge, ExternalLink, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { RequestOperationDialog } from "@/components/finance/request-operation-dialog"
import { useRouter } from "next/navigation"

interface DealFinancialHistoryPanelProps {
  dealId: string
  payments?: Array<{
    id: string
    paymentId: string
    amount: number
    paymentType: string
    paymentMode: string
    date: string
    remarks?: string
  }>
  clientId?: string
}

export function DealFinancialHistoryPanel({
  dealId,
  payments = [],
  clientId,
}: DealFinancialHistoryPanelProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [requestType, setRequestType] = useState<"REFUND" | "TRANSFER" | "MERGE">("REFUND")
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | undefined>()

  useEffect(() => {
    const fetchOps = async () => {
      try {
        setLoading(true)
        const res: any = await apiService.financeOperations.getByDealId(dealId)
        const data = res?.data?.data ?? res?.data ?? []
        setOperations(Array.isArray(data) ? data : [])
      } catch {
        setOperations([])
      } finally {
        setLoading(false)
      }
    }
    fetchOps()
  }, [dealId])

  const handleRequestRefund = (paymentId?: string) => {
    setSelectedPaymentId(paymentId)
    setRequestType("REFUND")
    setRequestDialogOpen(true)
  }

  const handleRequestTransfer = () => {
    setSelectedPaymentId(undefined)
    setRequestType("TRANSFER")
    setRequestDialogOpen(true)
  }

  const handleRequestMerge = () => {
    setSelectedPaymentId(undefined)
    setRequestType("MERGE")
    setRequestDialogOpen(true)
  }

  const formatAmount = (amt: number) =>
    `Rs ${Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`

  const getOpTypeIcon = (t: string) => {
    switch (t) {
      case "REFUND":
        return <RotateCcw className="h-4 w-4" />
      case "TRANSFER":
        return <ArrowRightLeft className="h-4 w-4" />
      case "MERGE":
        return <Merge className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Financial History</CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => handleRequestRefund()}>
              Request Refund
            </Button>
            <Button size="sm" variant="outline" onClick={handleRequestTransfer}>
              Request Transfer
            </Button>
            <Button size="sm" variant="outline" onClick={handleRequestMerge}>
              Request Merge
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => router.push("/finance?tab=operations")}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Finance Operations
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Original Payments */}
            <div>
              <h4 className="text-sm font-medium mb-2">Original Payments</h4>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">{p.paymentId}</TableCell>
                        <TableCell>{format(new Date(p.date), "dd MMM yyyy")}</TableCell>
                        <TableCell>{p.paymentType}</TableCell>
                        <TableCell>{p.paymentMode}</TableCell>
                        <TableCell>{formatAmount(p.amount)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRequestRefund(p.id)}
                          >
                            Request Refund
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Refunds, Transfers, Merges */}
            <div>
              <h4 className="text-sm font-medium mb-2">Operations (Refunds, Transfers, Merges)</h4>
              {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No finance operations</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Voucher</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.map((op) => (
                      <TableRow key={op.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getOpTypeIcon(op.operationType)}
                            {op.operationType}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={op.status === "POSTED" ? "default" : "secondary"}>
                            {op.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {op.partialAmount ?? op.amount != null
                            ? formatAmount(op.partialAmount ?? op.amount)
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate">{op.reason}</TableCell>
                        <TableCell>{format(new Date(op.createdAt), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          {op.voucher ? (
                            <span className="font-mono text-sm">{op.voucher.voucherNumber}</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </CardContent>

      <RequestOperationDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        initialOperationType={requestType}
        sourcePaymentId={requestType === "REFUND" ? selectedPaymentId : undefined}
        sourceClientId={requestType === "TRANSFER" ? clientId : undefined}
        sourceDealId={requestType === "MERGE" ? dealId : undefined}
        dealId={dealId}
        onSuccess={() => {
          setOperations([])
          setLoading(true)
          apiService.financeOperations.getByDealId(dealId).then((res: any) => {
            const data = res?.data?.data ?? res?.data ?? []
            setOperations(Array.isArray(data) ? data : [])
          }).catch(() => {}).finally(() => setLoading(false))
        }}
      />
    </Card>
  )
}
