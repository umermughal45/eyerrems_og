"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Download, Send, Loader2 } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { DataTableFromRegistry } from "@/components/shared/data-table-from-registry"
import { AddInvoiceDialog } from "./add-invoice-dialog"
import { generateInvoicePDF } from "./invoice-pdf-generator"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TransactionHeader } from "@/components/shared/transaction-header"
import { TransactionTimeline } from "@/components/shared/transaction-timeline"
import { MoreVertical, Search } from "lucide-react"

export function InvoicesView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("finance", "invoices") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timelineTarget, setTimelineTarget] = useState<any | null>(null)
  const [showTimelineDialog, setShowTimelineDialog] = useState(false)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.invoices.getAll()
      let invoicesData: any[] = []
      if (Array.isArray((response as any)?.data?.data)) invoicesData = (response as any).data.data as any[]
      else if (Array.isArray((response as any)?.data)) invoicesData = (response as any).data as any[]
      setInvoices(invoicesData)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch invoices")
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = useMemo(() => {
    let list = invoices.filter((inv) =>
      inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (typeof inv.tenant === "object" ? inv.tenant?.name?.toLowerCase() : String(inv.tenant || "").toLowerCase()).includes(searchQuery.toLowerCase())
    )
    const statusVal = activeFilters.status
    const statusArr = Array.isArray(statusVal) ? statusVal : statusVal ? [String(statusVal)] : []
    if (statusArr.length) list = list.filter((inv) => statusArr.includes(inv.status))
    return list
  }, [invoices, searchQuery, activeFilters])

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search invoices…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        }
      />

      <Card>
        <div className="overflow-x-auto">
          <DataTableFromRegistry
            entity="invoice"
            data={filteredInvoices}
            loading={loading}
            error={error}
            emptyMessage={invoices.length === 0 ? "No invoices yet" : "No invoices match your filters"}
            renderCell={(col, _value, row) => {
              if (col.key === "invoiceNumber") return <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div><span className="font-medium">{row.invoiceNumber}</span></div>
              if (col.key === "totalAmount") return <div><div className="font-medium">Rs {(row.totalAmount || row.amount || 0).toLocaleString("en-IN")}</div>{row.remainingAmount > 0 && <div className="text-xs text-muted-foreground">Remaining: Rs {row.remainingAmount.toLocaleString("en-IN")}</div>}</div>
              if (col.key === "status") return <Badge variant={row.status === "paid" ? "default" : row.status === "overdue" ? "destructive" : "secondary"}>{row.status}</Badge>
              return undefined
            }}
            renderActions={(inv) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => generateInvoicePDF(inv)}><Download className="mr-2 h-4 w-4" />Download PDF</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {}}><Send className="mr-2 h-4 w-4" />Send Invoice</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setTimelineTarget(inv); setShowTimelineDialog(true) }}><Search className="mr-2 h-4 w-4" />View Lifecycle</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      </Card>

      <AddInvoiceDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchInvoices} />
      <DownloadReportDialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog} entity="invoice" module="invoices" entityDisplayName="Invoices" filters={toExportFilters(activeFilters, "finance")} search={searchQuery || undefined} />
      <UnifiedFilterDrawer open={showFilterDrawer} onOpenChange={setShowFilterDrawer} entity="finance" tab="invoices" initialFilters={activeFilters} onApply={(filters) => { setActiveFilters(filters); saveFilters("finance", "invoices", filters); toast({ title: "Filters applied" }) }} />

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
