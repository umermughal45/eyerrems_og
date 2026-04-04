"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, Download, FileText, Eye, Pencil, Trash2, MoreVertical } from "lucide-react"
import { format } from "date-fns"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewReceiptDialog } from "@/components/finance/view-receipt-dialog"
import { EditReceiptDialog } from "@/components/finance/edit-receipt-dialog"

interface ClientLedgerViewProps {
  dealId: string
}

interface Receipt {
  id: string
  receiptNo: string
  amount: number
  method: string
  date: string
  notes?: string
  allocations: Array<{
    id: string
    amountAllocated: number
    installment: {
      id: string
      installmentNumber: number
      amount: number
      dueDate: string
    }
  }>
  receivedByUser?: {
    username?: string
    email?: string
  }
}

interface Installment {
  id: string
  installmentNumber: number
  type?: string
  amount: number
  dueDate: string
  status: string
  paidAmount: number
  remaining: number
  notes?: string
}

export function ClientLedgerView({ dealId }: ClientLedgerViewProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [installments, setInstallments] = useState<Installment[]>([])
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalPaid: 0,
    remainingAmount: 0,
    progress: 0,
  })
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null)
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)

  useEffect(() => {
    loadLedgerData()
  }, [dealId])

  const loadLedgerData = async () => {
    try {
      setLoading(true)
      
      // Load receipts
      const receiptsResponse: any = await apiService.receipts.getByDealId(dealId)
      const receiptsData = receiptsResponse?.data || receiptsResponse || []
      setReceipts(Array.isArray(receiptsData) ? receiptsData : [])

      // Load payment plan and installments
      const planResponse: any = await apiService.paymentPlans.getByDealId(dealId)
      const planData = planResponse?.data || planResponse
      
      if (planData?.installments) {
        setInstallments(planData.installments)
        
        const totalAmount = planData.totalAmount || planData.totalExpected || 0
        const totalPaid = planData.totalPaid || planData.installments.reduce(
          (sum: number, inst: Installment) => sum + (inst.paidAmount || 0),
          0
        )
        const remaining = totalAmount - totalPaid
        const progress = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0

        setSummary({
          totalAmount,
          totalPaid,
          remainingAmount: remaining,
          progress,
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load ledger data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return "Rs 0.00"
    }
    return `Rs ${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      Paid: "default",
      Pending: "secondary",
      Partial: "outline",
      overdue: "destructive",
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  const handleViewReceipt = (receiptId: string) => {
    setViewingReceiptId(receiptId)
    setShowViewDialog(true)
  }

  const handleEditReceipt = (receiptId: string) => {
    setEditingReceiptId(receiptId)
    setShowEditDialog(true)
  }

  const handleDeleteReceipt = async (receiptId: string) => {
    if (!window.confirm("Are you sure you want to delete this receipt? This action cannot be undone.")) {
      return
    }

    try {
      await apiService.receipts.delete(receiptId)
      toast({
        title: "Success",
        description: "Receipt deleted successfully",
      })
      await loadLedgerData()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to delete receipt",
        variant: "destructive",
      })
    }
  }

  const handleDownloadReceipt = async (receiptId: string, receiptNo: string) => {
    try {
      const response = await apiService.receipts.getPDF(receiptId)
      const blob = response.data instanceof Blob 
        ? response.data 
        : new Blob([response.data as any], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `receipt-${receiptNo}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: "Receipt PDF downloaded successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download receipt PDF",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
          <CardDescription>Total amount, paid amount, and remaining balance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid Amount</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.remainingAmount)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{summary.progress.toFixed(1)}%</span>
            </div>
            <Progress value={summary.progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
          <CardDescription>All payment receipts for this deal</CardDescription>
        </CardHeader>
        <CardContent>
          {receipts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No receipts found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Allocations</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell className="font-medium">{receipt.receiptNo}</TableCell>
                    <TableCell>{format(new Date(receipt.date), "PPP")}</TableCell>
                    <TableCell>{formatCurrency(receipt.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{receipt.method}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {receipt.allocations?.map((alloc, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            Inst #{alloc.installment.installmentNumber}: {formatCurrency(alloc.amountAllocated)}
                          </div>
                        ))}
                        {(!receipt.allocations || receipt.allocations.length === 0) && (
                          <span className="text-xs text-muted-foreground">No allocations</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewReceipt(receipt.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditReceipt(receipt.id)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadReceipt(receipt.id, receipt.receiptNo)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteReceipt(receipt.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Installments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Installments</CardTitle>
          <CardDescription>Payment schedule and status</CardDescription>
        </CardHeader>
        <CardContent>
          {installments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No installments found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell>{inst.installmentNumber}</TableCell>
                    <TableCell>
                      {inst.type && <Badge variant="outline">{inst.type}</Badge>}
                    </TableCell>
                    <TableCell>{formatCurrency(inst.amount)}</TableCell>
                    <TableCell>{format(new Date(inst.dueDate), "PPP")}</TableCell>
                    <TableCell>{formatCurrency(inst.paidAmount)}</TableCell>
                    <TableCell>{formatCurrency(inst.remaining)}</TableCell>
                    <TableCell>{getStatusBadge(inst.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {viewingReceiptId && (
        <ViewReceiptDialog
          open={showViewDialog}
          onOpenChange={(open) => {
            setShowViewDialog(open)
            if (!open) setViewingReceiptId(null)
          }}
          receiptId={viewingReceiptId}
          onEdit={() => {
            setShowViewDialog(false)
            setEditingReceiptId(viewingReceiptId)
            setShowEditDialog(true)
          }}
        />
      )}

      {editingReceiptId && (
        <EditReceiptDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open)
            if (!open) {
              setEditingReceiptId(null)
            }
          }}
          receiptId={editingReceiptId}
          onSuccess={() => {
            loadLedgerData()
            setEditingReceiptId(null)
            setShowEditDialog(false)
          }}
        />
      )}
    </div>
  )
}

