"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowDownRight, ArrowUpRight, FileText, Loader2, Trash2 } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import { AddTransactionDialog } from "./add-transaction-dialog"
import { apiService } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function TransactionsView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("finance", "transactions") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.transactions.getAll()
      const responseData = response.data as any
      const transactionsData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setTransactions(transactionsData)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch transactions")
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter((tx) => {
      const matchesSearch =
        tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.transactionCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.transactionCategory?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.property?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        false
      const typeVal = activeFilters.transactionType
      const matchesType = !typeVal || typeVal === "all" || tx.transactionType === typeVal
      const statusVal = activeFilters.status
      const statusArr = Array.isArray(statusVal) ? statusVal : statusVal ? [String(statusVal)] : []
      const matchesStatus = !statusArr.length || statusArr.includes(tx.status)
      return matchesSearch && matchesType && matchesStatus
    })
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return filtered
  }, [transactions, searchQuery, activeFilters])

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await apiService.transactions.delete(deleteTarget.id)
      toast({ title: "Transaction deleted" })
      setDeleteTarget(null)
      fetchTransactions()
    } catch (err: any) {
      toast({ title: "Failed to delete transaction", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search by code, description, category, property…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <DataTableFromRegistry
            entity="transaction"
            data={filteredTransactions}
            loading={loading}
            error={error}
            emptyMessage={transactions.length === 0 ? "No transactions yet" : "No transactions match your filters"}
            renderCell={(col, _value, row) => {
              if (col.key === "date") return <span className="text-sm">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</span>
              if (col.key === "transactionType") return <Badge variant={row.transactionType === "income" ? "default" : "secondary"}>{row.transactionType === "income" ? "Income" : "Expense"}</Badge>
              if (col.key === "totalAmount") return <span className={cn("font-semibold", row.transactionType === "income" ? "text-success" : "text-destructive")}>{row.transactionType === "income" ? "+" : "-"}Rs {(row.totalAmount ?? row.amount ?? 0).toLocaleString("en-IN")}</span>
              if (col.key === "status") return <Badge variant={row.status === "completed" ? "default" : "outline"}>{row.status || "—"}</Badge>
              if (col.key === "category") return <Badge variant="secondary" className="text-xs">{row.transactionCategory?.name || row.category || "Uncategorized"}</Badge>
              return undefined
            }}
            renderActions={(tx) => (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(tx)} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      </Card>

      <AddTransactionDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchTransactions} />

      <DownloadReportDialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog} entity="transaction" module="transactions" entityDisplayName="Transactions" filters={toExportFilters(activeFilters, "finance")} search={searchQuery || undefined} />

      <UnifiedFilterDrawer open={showFilterDrawer} onOpenChange={setShowFilterDrawer} entity="finance" tab="transactions" initialFilters={activeFilters} onApply={(filters) => { setActiveFilters(filters); saveFilters("finance", "transactions", filters); toast({ title: "Filters applied" }) }} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this transaction? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="mt-2 p-2 bg-muted rounded text-sm">
              <p className="font-medium">{deleteTarget.description || "No description"}</p>
              <p className="text-xs text-muted-foreground">{deleteTarget.transactionCode || deleteTarget.id?.slice(0, 8)} • {new Date(deleteTarget.date).toLocaleDateString()}</p>
              <p className="text-xs font-semibold mt-1">Amount: Rs {(deleteTarget.totalAmount || deleteTarget.amount || 0).toLocaleString()}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
