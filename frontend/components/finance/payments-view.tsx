"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Search, Plus, CreditCard, Loader2, Printer, Pencil, Trash2, MoreVertical } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import { AddPaymentDialog } from "./add-payment-dialog"
import { EditPaymentDialog } from "./edit-payment-dialog"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TransactionHeader } from "@/components/shared/transaction-header"
import { TransactionTimeline } from "@/components/shared/transaction-timeline"

export function PaymentsView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("finance", "payments") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingPayment, setEditingPayment] = useState<any | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [timelineTarget, setTimelineTarget] = useState<any | null>(null)
  const [showTimelineDialog, setShowTimelineDialog] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.payments.getAll()
      const responseData = response.data as any
      const paymentsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setPayments(paymentsData)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch payments")
      setPayments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = searchQuery.toLowerCase()
      return (p.paymentId?.toLowerCase() || "").includes(q) || (p.deal?.trackingId?.toLowerCase() || "").includes(q) || (p.deal?.title?.toLowerCase() || "").includes(q) || (p.deal?.client?.name?.toLowerCase() || "").includes(q) || (p.deal?.property?.name?.toLowerCase() || "").includes(q)
    })
  }, [payments, searchQuery])

  const handlePrintReceipt = async (payment: any) => {
    try {
      const response = await apiService.payments.printReceipt(payment.id)
      if (response.data instanceof Blob) {
        const url = URL.createObjectURL(response.data)
        const w = window.open(url, "_blank")
        if (w) w.onload = () => w.print()
        toast({ title: "Receipt opened" })
      }
    } catch {
      toast({ title: "Failed to generate receipt", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await apiService.payments.delete(deleteTarget.id)
      toast({ title: "Payment deleted" })
      setDeleteTarget(null)
      setShowDeleteDialog(false)
      fetchPayments()
    } catch {
      toast({ title: "Error", description: "Failed to delete payment", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search payments…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <DataTableFromRegistry
            entity="payment"
            data={filteredPayments}
            loading={loading}
            error={error}
            emptyMessage="No payments found"
            renderCell={(col, _value, row) => {
              if (col.key === "paymentId") return <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10"><CreditCard className="h-4 w-4 text-primary" /></div><span className="font-medium">{row.paymentId}</span></div>
              if (col.key === "deal") return <div className="flex flex-col"><span className="font-medium">{row.deal?.trackingId || row.deal?.title || "N/A"}</span><span className="text-xs text-muted-foreground">{row.deal?.stage}</span></div>
              if (col.key === "clientProperty") return <div className="flex flex-col"><span>{row.deal?.client?.name || "Unassigned Client"}</span><span className="text-xs text-muted-foreground">{row.deal?.property?.name || "Unassigned Property"}</span></div>
              if (col.key === "paymentTypeDisplay") return <div className="flex flex-col"><span className="capitalize">{row.paymentType}</span><span className="text-xs text-muted-foreground">{(row.paymentMode || "").replace("_", " ")}</span></div>
              if (col.key === "amount") return <span className="font-medium">Rs {(row.amount || 0).toLocaleString("en-IN")}</span>
              return undefined
            }}
            renderActions={(payment) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePrintReceipt(payment)}><Printer className="mr-2 h-4 w-4" />Print Receipt</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setEditingPayment(payment); setShowEditDialog(true) }}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setTimelineTarget(payment); setShowTimelineDialog(true) }}><Search className="mr-2 h-4 w-4" />View Lifecycle</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => { setDeleteTarget(payment); setShowDeleteDialog(true) }}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      </Card>

      <AddPaymentDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchPayments} />
      <EditPaymentDialog open={showEditDialog} onOpenChange={(o) => { setShowEditDialog(o); if (!o) setEditingPayment(null) }} onSuccess={() => { fetchPayments(); setEditingPayment(null) }} payment={editingPayment} />
      <DownloadReportDialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog} entity="payment" module="payments" entityDisplayName="Payments" filters={toExportFilters(activeFilters, "finance")} search={searchQuery || undefined} />
      <UnifiedFilterDrawer open={showFilterDrawer} onOpenChange={setShowFilterDrawer} entity="finance" tab="payments" initialFilters={activeFilters} onApply={(filters) => { setActiveFilters(filters); saveFilters("finance", "payments", filters); toast({ title: "Filters applied" }) }} />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete payment {deleteTarget?.paymentId}? This will update the payment plan. The payment will be moved to recycle bin.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteTarget(null); setShowDeleteDialog(false) }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Global Transaction Lifecycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <TransactionHeader tid={timelineTarget?.tid} />
            <TransactionTimeline tid={timelineTarget?.tid} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
