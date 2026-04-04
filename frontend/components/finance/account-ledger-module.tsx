"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, ChevronDown, ChevronRight, Search, Calendar, Eye, Download } from "lucide-react"
import { apiService } from "@/lib/api"
import { format } from "date-fns"

type AccountNode = {
  id: string
  code: string
  name: string
  type: string
  level?: number
  accountType?: string
  normalBalance?: string
  parentId?: string | null
  children?: AccountNode[]
}

type AccountTotals = {
  debitTotal: number
  creditTotal: number
  balance: number
}

type LedgerEntryRow = {
  id: string
  date: string
  description: string
  entryType: "Debit" | "Credit"
  amount: number
  linkedLabel?: string
  linkedType?: string
  linkedId?: string
}

type AttachmentItem = {
  id: string
  fileName: string
  fileType?: string
  uploadedAt?: string
  uploadedBy?: string
}

type DetailPayload = {
  attachments: AttachmentItem[]
  notes?: string
  history?: { id: string; userName?: string; action: string; createdAt: string; oldValue?: string; newValue?: string }[]
}

function currency(n: number) {
  return `Rs ${Number(n || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(value: Date | string) {
  try {
    return format(new Date(value), "dd MMM yyyy")
  } catch {
    return String(value)
  }
}

export function AccountLedgerModule() {
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [category, setCategory] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [accountsTree, setAccountsTree] = useState<AccountNode[]>([])
  const [totalsMap, setTotalsMap] = useState<Record<string, AccountTotals>>({})
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})
  const [entriesByAccount, setEntriesByAccount] = useState<Record<string, LedgerEntryRow[]>>({})
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<LedgerEntryRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailPayload, setDetailPayload] = useState<DetailPayload>({ attachments: [] })
  const [refreshing, setRefreshing] = useState(false)

  const categories = useMemo(() => ["Asset", "Liability", "Equity", "Revenue", "Expense"], [])
  const accountIndex = useMemo(() => {
    const map: Record<string, AccountNode> = {}
    const visit = (nodes: AccountNode[]) => {
      nodes.forEach((n) => {
        map[n.id] = n
        if (n.children && n.children.length > 0) visit(n.children)
      })
    }
    visit(accountsTree)
    return map
  }, [accountsTree])

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    try {
      const [treeRes, flatRes] = await Promise.all([
        apiService.accounts.getAll({ tree: "true" }),
        apiService.accounts.getAll(),
      ])
      const treePayload = treeRes.data?.data ?? treeRes.data ?? []
      const flatPayload = flatRes.data?.data ?? flatRes.data ?? []

      const tree: AccountNode[] = Array.isArray(treePayload) ? treePayload : []
      const flat: any[] = Array.isArray(flatPayload) ? flatPayload : []

      setAccountsTree(tree)

      const totals: Record<string, AccountTotals> = {}
      flat.forEach((acc: any) => {
        const debit = Number(acc.debitTotal ?? acc.totalDebits ?? 0)
        const credit = Number(acc.creditTotal ?? acc.totalCredits ?? 0)
        const balance = Number(acc.balance ?? 0)
        totals[acc.id] = {
          debitTotal: debit,
          creditTotal: credit,
          balance,
        }
      })
      setTotalsMap(totals)
    } catch {
      setAccountsTree([])
      setTotalsMap({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  useEffect(() => {
    const handler = () => {
      setRefreshing(true)
      loadAccounts().finally(() => setRefreshing(false))
    }
    const listener = (e: Event) => handler()
    if (typeof window !== "undefined") {
      window.addEventListener("accounts-footer-updated", listener as EventListener)
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("accounts-footer-updated", listener as EventListener)
      }
    }
  }, [loadAccounts])

  const filteredTree = useMemo(() => {
    const q = search.trim().toLowerCase()
    const typeFilter = category === "all" ? null : category
    const filterNode = (node: AccountNode): AccountNode | null => {
      const matchesText =
        !q ||
        node.name.toLowerCase().includes(q) ||
        node.code.toLowerCase().includes(q)
      const matchesType = !typeFilter || (node.type?.toLowerCase() === typeFilter.toLowerCase())
      const childMatches = (node.children || [])
        .map(filterNode)
        .filter(Boolean) as AccountNode[]
      if ((matchesText && matchesType) || childMatches.length > 0) {
        return { ...node, children: childMatches }
      }
      return null
    }
    return accountsTree
      .map(filterNode)
      .filter(Boolean) as AccountNode[]
  }, [accountsTree, search, category])

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const toggleAccount = async (accountId: string) => {
    const next = !expandedAccounts[accountId]
    setExpandedAccounts((prev) => ({ ...prev, [accountId]: next }))
    if (next && !entriesByAccount[accountId]) {
      const params: any = {}
      if (startDate && endDate) {
        params.startDate = new Date(startDate).toISOString()
        params.endDate = new Date(endDate).toISOString()
      }
      try {
        const res = await apiService.finance.getAccountLedger(accountId, params)
        const data = res.data?.entries ?? res.data?.data?.entries ?? res.data?.data ?? []
        const entries: LedgerEntryRow[] = Array.isArray(data)
          ? data.map((e: any) => {
              const entryTypeForAccount =
                e.debitAccountId === accountId ? "Debit" : "Credit"
              const label =
                e.paymentId
                  ? `Payment ${e.paymentId}`
                  : e.dealTitle
                  ? `Deal ${e.dealTitle}`
                  : e.clientName || e.propertyName || ""
              return {
                id: e.id,
                date: formatDate(e.date),
                description: e.remarks || `${e.accountDebit || ""} → ${e.accountCredit || ""}`,
                entryType: entryTypeForAccount,
                amount: Number(e.amount || 0),
                linkedLabel: label || undefined,
                linkedType: e.paymentId ? "payment" : e.dealTitle ? "deal" : undefined,
                linkedId: e.paymentId || undefined,
              }
            })
          : []
        setEntriesByAccount((prev) => ({ ...prev, [accountId]: entries }))
      } catch {
        setEntriesByAccount((prev) => ({ ...prev, [accountId]: [] }))
      }
    }
  }

  const openDetail = async (entry: LedgerEntryRow) => {
    setDetailEntry(entry)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      let attachments: AttachmentItem[] = []
      if (entry.id) {
        const att = await apiService.finance.getAttachments({ entryId: entry.id })
        const attData = att.data?.data ?? att.data ?? []
        attachments = Array.isArray(attData) ? attData : []
      }
      let notes = ""
      let history: DetailPayload["history"] = []
      if (entry.linkedType && entry.linkedId) {
        try {
          const meta = await apiService.entities.getMetadata(entry.linkedType, entry.linkedId)
          notes = meta.data?.notes || meta.data?.data?.notes || ""
        } catch {}
        try {
          const hist = await apiService.entities.getHistory(entry.linkedType, entry.linkedId)
          const histData = hist.data?.data ?? hist.data ?? []
          history = Array.isArray(histData) ? histData : []
        } catch {}
      }
      setDetailPayload({ attachments, notes, history })
    } catch {
      setDetailPayload({ attachments: [] })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDownloadAttachment = async (attachment: AttachmentItem) => {
    try {
      const res = await apiService.finance.getAttachment(attachment.id)
      const blob = new Blob([res.data], { type: attachment.fileType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', attachment.fileName)
      document.body.appendChild(link)
      link.click()
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download attachment:', error)
    }
  }

  const renderAccountRow = (node: AccountNode, depth = 0) => {
    const totals = totalsMap[node.id] || { debitTotal: 0, creditTotal: 0, balance: 0 }
    const hasChildren = (node.children || []).length > 0
    const isExpanded = !!expandedAccounts[node.id]
    return (
      <div key={node.id} className="border-b">
        <div className="flex items-center gap-2 py-2 px-2">
          <button
            type="button"
            onClick={() => (hasChildren ? toggleAccount(node.id) : toggleAccount(node.id))}
            className="inline-flex items-center"
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="inline-block w-4" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">{node.code}</Badge>
              <span className="font-medium">{node.name}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right w-[430px]">
            <span className="font-medium">{currency(totals.debitTotal)}</span>
            <span className="font-medium">{currency(totals.creditTotal)}</span>
            <span className={`font-semibold ${totals.balance >= 0 ? "text-primary" : "text-destructive"}`}>
              {currency(totals.balance)}
            </span>
          </div>
        </div>
        {isExpanded && (
          <div className="px-6 pb-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Entry Type</TableHead>
                    <TableHead className="text-right w-[140px]">Amount</TableHead>
                    <TableHead className="w-[220px]">Linked Entry</TableHead>
                    <TableHead className="text-right w-[80px]">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entriesByAccount[node.id] || []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No entries found for filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    (entriesByAccount[node.id] || []).map((row) => (
                      <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(row)}>
                        <TableCell className="font-medium">{row.date}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          <Badge variant={row.entryType === "Debit" ? "destructive" : "secondary"}>
                            {row.entryType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{currency(row.amount)}</TableCell>
                        <TableCell className="truncate">{row.linkedLabel || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        {(node.children || []).map((child) => renderAccountRow(child, depth + 1))}
      </div>
    )
  }

  const renderCategory = (cat: string) => {
    const open = !!expandedCategories[cat]
    const nodes = filteredTree.filter((n) => (n.type || "").toLowerCase() === cat.toLowerCase())
    return (
      <Card key={cat} className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggleCategory(cat)} className="inline-flex items-center">
              {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            <CardTitle>{cat}</CardTitle>
          </div>
          <CardDescription>{nodes.length} accounts</CardDescription>
        </CardHeader>
        {open && (
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_430px] gap-0 px-2 py-2 border-b bg-muted/40">
              <div className="text-xs text-muted-foreground px-2">Account</div>
              <div className="grid grid-cols-3 gap-6 text-xs text-muted-foreground text-right">
                <span>Debit</span>
                <span>Credit</span>
                <span>Balance</span>
              </div>
            </div>
            <div className="divide-y">
              {nodes.length === 0 ? (
                <div className="p-6 text-muted-foreground">No accounts</div>
              ) : (
                nodes.map((n) => renderAccountRow(n))
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setEntriesByAccount({})
    loadAccounts().finally(() => setRefreshing(false))
  }
  const handleExport = () => {
    const headers = ["Account Code", "Account Name", "Date", "Entry Type", "Amount", "Description", "Linked"]
    const rows: string[][] = []
    Object.entries(entriesByAccount).forEach(([accountId, entries]) => {
      const acc = accountIndex[accountId]
      entries.forEach((row) => {
        rows.push([
          acc?.code || "",
          acc?.name || "",
          row.date,
          row.entryType,
          Number(row.amount || 0).toFixed(2),
          row.description,
          row.linkedLabel || "",
        ])
      })
    })
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    const nameDate =
      startDate && endDate
        ? `${new Date(startDate).toISOString().split("T")[0]}_to_${new Date(endDate).toISOString().split("T")[0]}`
        : new Date().toISOString().split("T")[0]
    link.setAttribute("href", url)
    link.setAttribute("download", `account-ledger-${nameDate}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Account Ledger</h1>
          <p className="text-sm text-muted-foreground">View ledger entries grouped by account category</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <Loader2 className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search description"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <span className="text-muted-foreground">to</span>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Account category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="p-10 text-center">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" />
          Loading accounts and balances...
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => renderCategory(cat))}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Ledger Entry Details
            </DialogTitle>
            <DialogDescription>Linked attachments, history and notes</DialogDescription>
          </DialogHeader>
          {detailEntry && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <p className="font-medium">{detailEntry.date}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Amount</Label>
                  <p className="font-medium">{currency(detailEntry.amount)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Entry Type</Label>
                  <p className="font-medium">{detailEntry.entryType}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Linked</Label>
                  <p className="font-medium">{detailEntry.linkedLabel || "—"}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="text-sm">{detailEntry.description}</p>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Attachments</Label>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading attachments...
                  </div>
                ) : (detailPayload.attachments || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attachments</p>
                ) : (
                  <ScrollArea className="max-h-40 border rounded-md p-2">
                    <div className="space-y-2">
                      {detailPayload.attachments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{a.fileName}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{a.fileType || "file"}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleDownloadAttachment(a)}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">History</Label>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading history...
                  </div>
                ) : (detailPayload.history || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No history</p>
                ) : (
                  <ScrollArea className="max-h-40 border rounded-md p-2">
                    <div className="space-y-2">
                      {(detailPayload.history || []).map((h) => (
                        <div key={h.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{h.action}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{h.userName || ""}</div>
                          {(h.oldValue || h.newValue) && (
                            <div className="text-xs">
                              {h.oldValue && <span>Old: {h.oldValue} </span>}
                              {h.newValue && <span>New: {h.newValue}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading notes...
                  </div>
                ) : (
                  <p className="text-sm">{detailPayload.notes || "—"}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

