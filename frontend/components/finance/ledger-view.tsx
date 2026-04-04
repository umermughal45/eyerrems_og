"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Download, FileText } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { TransactionDetailModal } from "@/components/finance/transaction-detail-modal"

type SourceTypeFilter = "all" | "deal" | "payment" | "voucher" | "refund" | "transfer" | "merge" | "commission" | "expense" | "adjustment"

interface LedgerEntry {
  id: string
  date: Date | string
  referenceNo: string | null
  description: string
  debit: number
  credit: number
  runningBalance: number
  sourceType?: string
  transactionUuid?: string
  isLegacy?: boolean
  status?: string
  accountHead?: string
  narration?: string
  linkedEntityType?: string
  linkedEntityId?: string
  linkedEntityName?: string
  voucherNo?: string
  createdAt?: Date | string
}

interface LedgerData {
  entityName: string
  entityId: string
  entries: LedgerEntry[]
  summary: {
    totalDebit: number
    totalCredit: number
    closingBalance: number
    openingBalance?: number
    openingBalanceSource?: "Derived" | "Legacy"
    hasLegacyEntries?: boolean
    dealValue?: number
    received?: number
    outstanding?: number
  }
}

interface LedgerViewProps {
  type: "client" | "dealer" | "property" | "deal"
  id: string
  onClose?: () => void
  showBackButton?: boolean
}

export function LedgerView({ type, id, onClose, showBackButton = true }: LedgerViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [selectedTid, setSelectedTid] = useState<string | null>(null)
  const [filterStartDate, setFilterStartDate] = useState<string>("")
  const [filterEndDate, setFilterEndDate] = useState<string>("")
  const [filterSourceType, setFilterSourceType] = useState<SourceTypeFilter>("all")

  const filters = useMemo(() => {
    const f: { startDate?: string; endDate?: string; sourceType?: string } = {}
    if (filterStartDate) f.startDate = filterStartDate
    if (filterEndDate) f.endDate = filterEndDate
    if (filterSourceType && filterSourceType !== "all") f.sourceType = filterSourceType
    return f
  }, [filterStartDate, filterEndDate, filterSourceType])

  // Must run unconditionally (Rules of Hooks) - before any early returns
  const filteredEntries = useMemo(
    () => (ledgerData?.entries ?? []) as LedgerEntry[],
    [ledgerData?.entries]
  )
  const groupedRows = useMemo(() => {
    const groups: { txId: string; entries: LedgerEntry[] }[] = []
    const seen = new Set<string>()
    for (const e of filteredEntries) {
      const txId = e.transactionUuid || e.id
      if (!seen.has(txId)) {
        seen.add(txId)
        groups.push({
          txId,
          entries: filteredEntries.filter((x) => (x.transactionUuid || x.id) === txId),
        })
      }
    }
    return groups
  }, [filteredEntries])

  useEffect(() => {
    fetchLedger()
  }, [type, id, filterStartDate, filterEndDate, filterSourceType])

  const fetchLedger = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log(`Fetching ledger for ${type} with ID: ${id}`)
      
      // Make API call - handle deal type separately (deal API does not support filters)
      let response: any
      if (type === 'deal') {
        response = await apiService.deals.getLedger(id)
      } else {
        response = await apiService.ledgers.getLedger(type, id, filters)
      }
      
      console.log("Ledger API response:", response)
      
      // Handle different response structures
      let data = null
      if (response?.data) {
        // Check if response.data has a nested data property
        if (response.data.data) {
          data = response.data.data
        } else if (response.data.success && response.data.data) {
          data = response.data.data
        } else {
          data = response.data
        }
      } else if (response?.success && response?.data) {
        data = response.data
      } else {
        data = response
      }
      
      // Validate data structure
      if (!data) {
        throw new Error("No data received from server")
      }
      
      // Handle deal type response structure
      if (type === 'deal' && data.deal) {
        // Transform deal ledger response to match expected format
        const entries = (data.entries || []).map((entry: any) => ({
          id: entry.id,
          date: entry.date,
          referenceNo: entry.payment?.paymentId || entry.payment?.referenceNumber || entry.id,
          description: entry.remarks || `Payment ${entry.payment?.paymentId || ''}`,
          debit: entry.debitAccount ? entry.amount : 0,
          credit: entry.creditAccount ? entry.amount : 0,
          runningBalance: 0, // Will be calculated below
          sourceType: 'payment' as const,
          transactionUuid: entry.id,
          isLegacy: false,
          accountHead: entry.debitAccount?.name || entry.creditAccount?.name || '',
          linkedEntityType: 'payment',
          linkedEntityId: entry.payment?.id,
          payment: entry.payment,
        }))
        
        // Calculate running balance
        let runningBalance = 0
        entries.forEach((entry: any) => {
          runningBalance += entry.debit - entry.credit
          entry.runningBalance = runningBalance
        })
        
        data.entries = entries
        data.entityName = data.deal.title || data.deal.dealCode || `Deal ${id.substring(0, 8)}`
        data.entityId = data.deal.id
      }
      
      // Ensure required fields exist
      if (!data.entries || !Array.isArray(data.entries)) {
        console.error("Invalid ledger data structure:", data)
        // If entries is missing but we have other data, create empty entries array
        if (data && typeof data === 'object') {
          data.entries = []
        } else {
          throw new Error("Invalid ledger data format. Missing entries array.")
        }
      }
      
      // Ensure summary exists
      if (!data.summary) {
        const entries = data.entries || []
        data.summary = {
          totalDebit: entries.reduce((sum: number, e: LedgerEntry) => sum + (e.debit || 0), 0),
          totalCredit: entries.reduce((sum: number, e: LedgerEntry) => sum + (e.credit || 0), 0),
          closingBalance: entries.length > 0 
            ? entries[entries.length - 1].runningBalance || 0 
            : 0
        }
      }
      
      // Ensure entityName exists
      if (!data.entityName) {
        const typeStr = type || "Entity"
        const idStr = id || ""
        data.entityName = `${typeStr.charAt(0).toUpperCase() + typeStr.slice(1)} ${idStr.substring(0, 8)}...`
      }
      
      // Ensure entityId exists
      if (!data.entityId) {
        data.entityId = id
      }
      
      setLedgerData(data)
    } catch (err: any) {
      console.error("Ledger fetch error:", err)
      console.error("Error details:", {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        url: err?.config?.url,
        type,
        id,
      })
      
      // More detailed error messages
      let errorMessage = "Failed to load ledger"
      
      // Check if it's a network error (API not reachable)
      if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
        errorMessage = "Cannot connect to server. Please check your connection and try again."
      } else if (err?.response?.status === 404) {
        // Check if it's the API route or the entity
        const responseError = err?.response?.data?.error || err?.response?.data?.message || ""
        if (responseError.toLowerCase().includes('route') || 
            err?.config?.url?.includes('/finance/ledger/')) {
          errorMessage = `API endpoint not found. Please ensure the server is running and the route /api/finance/ledger/${type}/${id} is accessible.`
        } else if (responseError.toLowerCase().includes('not found') || 
                   responseError.toLowerCase().includes('property not found')) {
          errorMessage = `The ${type} with ID ${id.substring(0, 8)}... was not found. It may have been deleted or doesn't exist.`
        } else {
          errorMessage = `The ${type} with ID ${id.substring(0, 8)}... was not found. ${responseError || ''}`
        }
      } else if (err?.response?.status === 401 || err?.response?.status === 403) {
        errorMessage = "You don't have permission to view this ledger."
      } else if (err?.response?.status === 500) {
        // Server error - might be property not found or other server issue
        const serverError = err?.response?.data?.error || err?.response?.data?.message || ""
        if (serverError.toLowerCase().includes('not found')) {
          errorMessage = `The ${type} was not found. ${serverError}`
        } else {
          errorMessage = `Server error: ${serverError || 'Unknown error occurred on the server'}`
        }
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error
      } else if (err?.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err?.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
      toast({
        title: "Error Loading Ledger",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `Rs ${Number(amount).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: Date | string) => {
    try {
      return format(new Date(date), "dd MMM yyyy")
    } catch {
      return String(date)
    }
  }

  const handleExport = () => {
    if (!ledgerData) return

    // Create CSV content
    const headers = ["Date", "Reference No", "Description", "Debit", "Credit", "Running Balance"]
    const rows = ledgerData.entries.map((entry) => [
      formatDate(entry.date),
      entry.referenceNo || "",
      entry.description,
      entry.debit > 0 ? entry.debit.toFixed(2) : "",
      entry.credit > 0 ? entry.credit.toFixed(2) : "",
      entry.runningBalance.toFixed(2),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      "",
      `Total Debit,${ledgerData.summary.totalDebit.toFixed(2)}`,
      `Total Credit,${ledgerData.summary.totalCredit.toFixed(2)}`,
      `Closing Balance,${ledgerData.summary.closingBalance.toFixed(2)}`,
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${type}-ledger-${id}-${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Ledger exported to CSV",
    })
  }

  const getTypeLabel = () => {
    switch (type) {
      case "client":
        return "Client Ledger"
      case "dealer":
        return "Dealer Ledger"
      case "property":
        return "Property Ledger"
      default:
        return "Ledger"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading ledger data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div>
            <p className="text-lg font-semibold text-destructive mb-2">Failed to Load Ledger</p>
            <p className="text-sm text-muted-foreground mb-2">{error}</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Type: {type} | ID: {id.substring(0, 8)}...</p>
              <p>API Endpoint: /api/finance/ledger/{type}/{id}</p>
              {error.toLowerCase().includes("not found") && (
                <p className="text-destructive mt-2">
                  The {type} may not exist or you may not have permission to view it.
                </p>
              )}
              {error.toLowerCase().includes("route") && (
                <p className="text-destructive mt-2">
                  Please check that the server is running and the API endpoint is accessible.
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={fetchLedger}>
              Retry
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  if (!ledgerData) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">No ledger data available</div>
      </Card>
    )
  }

  const handleViewEntry = (entry: LedgerEntry) => {
    if (entry.id === "OPENING" || entry.isLegacy) return
    const tid =
      String(entry.referenceNo || "").match(/\d{4}-\d{2}-\d{4}/)?.[0] ||
      String(entry.description || "").match(/\d{4}-\d{2}-\d{4}/)?.[0] ||
      String(entry.narration || "").match(/\d{4}-\d{2}-\d{4}/)?.[0] ||
      null
    setSelectedTid(tid)
    setSelectedEntry(entry)
    setDetailDialogOpen(true)
  }

  const formatSourceType = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "—")

  const getStatusBadge = (entry: LedgerEntry) => {
    if (entry.id === "OPENING") return <Badge variant="outline" className="text-xs">B/F</Badge>
    const status = entry.status || (entry.isLegacy ? "Legacy" : undefined)
    if (!status) return type === "dealer" ? (entry.runningBalance >= 0 ? "CR" : "DR") : "—"
    if (type === "dealer") return entry.runningBalance >= 0 ? "CR" : "DR"
    const variant = status === "Legacy" ? "secondary" : status === "Payment" ? "default" : "outline"
    return <Badge variant={variant} className="text-xs">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Ledger Entry Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Ledger Entry Details
            </DialogTitle>
            <DialogDescription>
              Complete information for this ledger entry
            </DialogDescription>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-6">
              {/* Entry Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Voucher / Reference No</Label>
                  <p className="font-medium">
                    {selectedEntry.voucherNo || selectedEntry.referenceNo || "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">{formatDate(selectedEntry.date)}</p>
                </div>
              </div>

              <Separator />

              {/* Account & Description */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Account Head</Label>
                  <p className="font-medium">{selectedEntry.accountHead || getTypeLabel()}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Narration / Description</Label>
                  <p className="font-medium">{selectedEntry.narration || selectedEntry.description}</p>
                </div>
              </div>

              <Separator />

              {/* Linked Entity */}
              {(selectedEntry.linkedEntityType || selectedEntry.linkedEntityName) && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Linked Entity</Label>
                    <div className="flex items-center gap-2">
                      {selectedEntry.linkedEntityType && (
                        <Badge variant="outline">
                          {selectedEntry.linkedEntityType.charAt ? 
                            selectedEntry.linkedEntityType.charAt(0).toUpperCase() + selectedEntry.linkedEntityType.slice(1) :
                            String(selectedEntry.linkedEntityType)}
                        </Badge>
                      )}
                      <span className="font-medium">{selectedEntry.linkedEntityName || selectedEntry.linkedEntityId || "—"}</span>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Debit & Credit Breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <CardContent className="pt-4">
                    <Label className="text-xs text-muted-foreground">Debit</Label>
                    <p className="text-2xl font-bold text-red-600">
                      {selectedEntry.debit > 0 ? formatCurrency(selectedEntry.debit) : "—"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-4">
                    <Label className="text-xs text-muted-foreground">Credit</Label>
                    <p className="text-2xl font-bold text-green-600">
                      {selectedEntry.credit > 0 ? formatCurrency(selectedEntry.credit) : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Running Balance */}
              <Card>
                <CardContent className="pt-4">
                  <Label className="text-xs text-muted-foreground">Running Balance (After this entry)</Label>
                  <p className={`text-2xl font-bold ${selectedEntry.runningBalance >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrency(selectedEntry.runningBalance)}
                  </p>
                </CardContent>
              </Card>

              {/* Double-Entry Note */}
              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <p className="font-medium mb-1">Double-Entry Accounting</p>
                <p>
                  This entry follows double-entry bookkeeping principles. 
                  {selectedEntry.debit > 0 && ` Debit increases asset/expense accounts.`}
                  {selectedEntry.credit > 0 && ` Credit increases liability/equity/revenue accounts.`}
                </p>
              </div>
              {selectedTid && (
                <Button type="button" variant="outline" onClick={() => setTransactionModalOpen(true)}>
                  Open Transaction Detail View
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <TransactionDetailModal open={transactionModalOpen} onOpenChange={setTransactionModalOpen} tid={selectedTid} />

      {/* Ledger Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Button variant="ghost" size="icon" onClick={onClose || (() => router.back())}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">{getTypeLabel()}</h1>
            <p className="text-sm text-muted-foreground">
              {ledgerData.entityName}
              {ledgerData.entityId && (
                <span className="ml-2 font-mono text-xs">Ref: {ledgerData.entityId.slice(0, 8)}…</span>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters (read-only, do not alter calculations) */}
      {type !== "deal" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filters</CardTitle>
            <CardDescription>Display filters only. Do not affect balances or calculations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-xs">Date range (from)</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Date range (to)</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-[140px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Source type</Label>
                <Select value={filterSourceType} onValueChange={(v) => setFilterSourceType(v as SourceTypeFilter)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(type === "client" || type === "property") && <SelectItem value="deal">Deal</SelectItem>}
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="voucher">Voucher</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="merge">Merge</SelectItem>
                    {type === "dealer" && <SelectItem value="commission">Commission</SelectItem>}
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards - accounting-correct, read-only */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Opening Balance {ledgerData.summary.openingBalanceSource ? `(${ledgerData.summary.openingBalanceSource})` : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(ledgerData.summary.openingBalance ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              {(type === "client" || type === "property") ? "Deal Value" : type === "dealer" ? "Total Payments (SUM Debit)" : "Total Debit"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency((type === "client" || type === "property") && ledgerData.summary.dealValue !== undefined ? ledgerData.summary.dealValue : ledgerData.summary.totalDebit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              {(type === "client" || type === "property") ? "Received" : type === "dealer" ? "Total Commission (SUM Credit)" : "Total Credit"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold tabular-nums text-foreground">
              {formatCurrency((type === "client" || type === "property") && ledgerData.summary.received !== undefined ? ledgerData.summary.received : ledgerData.summary.totalCredit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>
              {(type === "client" || type === "property") ? "Outstanding Balance" : type === "dealer" ? "Outstanding Balance (Credit − Debit)" : "Current Balance (read-only)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-bold tabular-nums ${ledgerData.summary.closingBalance >= 0 ? "text-foreground" : "text-destructive"}`}>
              {formatCurrency((type === "client" || type === "property") && ledgerData.summary.outstanding !== undefined ? ledgerData.summary.outstanding : ledgerData.summary.closingBalance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ledger Table - Fixed columns, transaction grouping, legacy labeling */}
      <Card>
        <CardHeader>
          <CardTitle>Ledger Entries</CardTitle>
          <CardDescription>
            {filteredEntries.length} {filteredEntries.length === 1 ? "entry" : "entries"} shown
            {ledgerData.summary.hasLegacyEntries && " (Legacy commission data)"}
            {type === "dealer" && ledgerData.summary.hasLegacyEntries && " — New operations will appear here going forward."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[120px]">{type === "dealer" ? "Transaction No" : "Reference"}</TableHead>
                  <TableHead>{type === "dealer" ? "Memo" : "Description"}</TableHead>
                  <TableHead className="w-[100px]">Source</TableHead>
                  <TableHead className="text-right w-[130px]">Debit</TableHead>
                  <TableHead className="text-right w-[130px]">Credit</TableHead>
                  <TableHead className="text-right w-[140px]">Running Balance</TableHead>
                  {(type === "dealer" || type === "client" || type === "property") && <TableHead className="w-[90px]">Status</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={(type === "dealer" || type === "client" || type === "property") ? 8 : 7} className="text-center py-12 text-muted-foreground space-y-2">
                      {type === "dealer" ? (
                        <>
                          <p>No ledger entries found for this dealer.</p>
                          {!ledgerData.summary.hasLegacyEntries && (
                            <p className="text-sm">Create commissions or voucher payments to see entries.</p>
                          )}
                        </>
                      ) : (type === "client" || type === "property") ? (
                        <>
                          <p>No ledger entries found.</p>
                          <p className="text-sm">Create deals and record payments to see entries.</p>
                        </>
                      ) : (
                        "No ledger entries found"
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedRows.map(({ txId, entries: txEntries }) =>
                    txEntries.map((entry, idx) => {
                      const isOpening = entry.id === "OPENING"
                      return (
                        <TableRow
                          key={entry.id}
                          className={cn(
                            isOpening && "bg-muted/40 font-medium border-y",
                            !isOpening && !entry.isLegacy && "cursor-pointer hover:bg-muted/50 transition-colors",
                            !isOpening && entry.isLegacy && "bg-muted/30"
                          )}
                          onClick={() => handleViewEntry(entry)}
                        >
                          <TableCell className={cn("font-medium align-top min-h-[44px]", idx > 0 && !isOpening && "pl-12")}>
                            {idx === 0 || isOpening ? formatDate(entry.date) : ""}
                          </TableCell>
                          <TableCell className={cn("align-top min-h-[44px]", idx > 0 && !isOpening && "pl-12")}>
                            {(idx === 0 || isOpening) && (
                              <>
                                {entry.referenceNo && entry.referenceNo !== "—" ? (
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {entry.referenceNo}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell className={cn("align-top min-h-[44px] break-words", idx > 0 && !isOpening && "pl-12")}>
                            <span className={cn(idx > 0 && !isOpening && "pl-2 border-l-2 border-muted")}>
                              {entry.description}
                              {!isOpening && entry.isLegacy && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Legacy
                                </Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="align-top min-h-[44px]">
                            {formatSourceType(entry.sourceType)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-foreground align-top min-h-[44px] whitespace-nowrap">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-foreground align-top min-h-[44px] whitespace-nowrap">
                            {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                          </TableCell>
                          <TableCell className={`text-right font-semibold tabular-nums align-top min-h-[44px] whitespace-nowrap ${entry.runningBalance >= 0 ? "text-foreground" : "text-destructive"}`}>
                            {formatCurrency(entry.runningBalance)}
                          </TableCell>
                          {(type === "dealer" || type === "client" || type === "property") && (
                            <TableCell className="align-top min-h-[44px]">
                              {getStatusBadge(entry)}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })
                  )
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

