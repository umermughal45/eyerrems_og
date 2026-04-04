"use client"

import { useState, useEffect, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RotateCcw, ArrowRightLeft, Merge, Check, X, Play, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { RequestOperationDialog } from "./request-operation-dialog"

type OpType = "REFUND" | "TRANSFER" | "MERGE"
type OpStatus = "REQUESTED" | "APPROVED" | "POSTED" | "REJECTED"

interface Operation {
  id: string
  operationType: OpType
  status: OpStatus
  reason: string
  amount: number | null
  partialAmount: number | null
  createdAt: string
  requestedBy?: { username: string }
  approvedBy?: { username: string }
  postedBy?: { username: string }
  voucher?: { id: string; voucherNumber: string; type: string; amount: number; status: string }
  deal?: { dealCode: string; title: string }
  references?: { refType: string; refId: string; role: string }[]
}

interface OperationsViewProps {
  highlightedRequestId?: string
}

export function OperationsView({ highlightedRequestId }: OperationsViewProps) {
  const { toast } = useToast()
  const [operations, setOperations] = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const displayedOperations = useMemo(() => {
    if (!highlightedRequestId) return operations
    const found = operations.find((op) => op.id === highlightedRequestId)
    return found ? [found] : operations
  }, [operations, highlightedRequestId])

  const fetchOps = async () => {
    try {
      setLoading(true)
      const res: any = await apiService.financeOperations.getAll({
        status: statusFilter !== "all" ? statusFilter : undefined,
        operationType: typeFilter !== "all" ? typeFilter : undefined,
        limit: 100,
      })
      const data = res?.data?.data ?? res?.data ?? []
      setOperations(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to load operations",
        variant: "destructive",
      })
      setOperations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOps()
  }, [statusFilter, typeFilter])

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id)
      await apiService.financeOperations.approve(id)
      toast({ title: "Approved", description: "Operation approved" })
      fetchOps()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to approve",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    try {
      setActionLoading(id)
      await apiService.financeOperations.reject(id)
      toast({ title: "Rejected", description: "Operation rejected" })
      fetchOps()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to reject",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleExecute = async (id: string) => {
    try {
      setActionLoading(id)
      await apiService.financeOperations.execute(id)
      toast({ title: "Executed", description: "Voucher created and posted" })
      fetchOps()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to execute",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const formatAmount = (op: Operation) => {
    const amt = op.partialAmount ?? op.amount
    return amt != null ? `Rs ${Number(amt).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"
  }

  const getTypeIcon = (t: OpType) => {
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

  const getStatusColor = (s: OpStatus) => {
    switch (s) {
      case "REQUESTED":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "APPROVED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "POSTED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      default:
        return ""
    }
  }

  return (
    <div className="space-y-4">
      {highlightedRequestId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 text-sm">
            Showing your requested operation <span className="font-mono font-medium">{highlightedRequestId.slice(0, 8)}…</span>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Finance Operations</h2>
          <p className="text-sm text-muted-foreground">
            Refund, Transfer, Merge — executed here only. All operations create new vouchers.
          </p>
        </div>
        <Button onClick={() => setRequestDialogOpen(true)}>
          Request Operation
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="REQUESTED">Requested</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="REFUND">Refund</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
            <SelectItem value="MERGE">Merge</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : displayedOperations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No operations found. Request Refund, Transfer, or Merge from Deals or here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedOperations.map((op) => (
                  <TableRow
                    key={op.id}
                    className={highlightedRequestId && op.id === highlightedRequestId ? "bg-primary/5 ring-1 ring-primary/20" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(op.operationType)}
                        <span>{op.operationType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(op.status)}>{op.status}</Badge>
                    </TableCell>
                    <TableCell>{formatAmount(op)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{op.reason}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {op.requestedBy?.username ?? "—"}
                      </span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(op.createdAt), "dd MMM yyyy HH:mm")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {op.voucher ? (
                        <span className="text-sm font-mono">{op.voucher.voucherNumber}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {op.status === "REQUESTED" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(op.id)}
                            disabled={!!actionLoading}
                          >
                            {actionLoading === op.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(op.id)}
                            disabled={!!actionLoading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {op.status === "APPROVED" && (
                        <Button
                          size="sm"
                          onClick={() => handleExecute(op.id)}
                          disabled={!!actionLoading}
                        >
                          {actionLoading === op.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Execute
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RequestOperationDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
        onSuccess={fetchOps}
      />
    </div>
  )
}
