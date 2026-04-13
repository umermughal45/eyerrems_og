"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Search, RefreshCw } from "lucide-react"
import { apiService } from "@/lib/api"
import { DealerLedgerView } from "./dealer-ledger-view"
import { LedgerCleanTable, type CleanLedgerRow } from "./ledger-clean-table"

type LedgerTab = "clients" | "properties" | "dealer"

function computeStatus(dealAmount: number, totalPaid: number): CleanLedgerRow["status"] {
  if (totalPaid === 0) return "pending"
  if (totalPaid >= dealAmount) return "paid"
  return "partial"
}

export function EnhancedLedgers() {
  const [activeTab, setActiveTab] = useState<LedgerTab>("clients")
  const [clientRows, setClientRows] = useState<any[]>([])
  const [propertyRows, setPropertyRows] = useState<any[]>([])
  const [dealers, setDealers] = useState<{ id: string; name: string }[]>([])
  const [selectedDealerId, setSelectedDealerId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === "dealer" && dealers.length === 0) {
      fetchDealers()
    } else if (activeTab !== "dealer") {
      fetchLedgerData()
    }
  }, [activeTab])

  const fetchDealers = async () => {
    try {
      const response = await apiService.dealers.getAll()
      const payload = response.data as any
      const list = Array.isArray(payload?.data ?? payload) ? (payload.data ?? payload) : []
      setDealers(list.map((d: any) => ({ id: d.id, name: d.name })))
    } catch {
      setDealers([])
    }
  }

  const fetchLedgerData = async () => {
    try {
      setLoading(true)
      setError(null)
      if (activeTab === "clients") {
        const response: any = await apiService.ledgers.clients()
        const data = response?.data?.data ?? response?.data ?? []
        setClientRows(Array.isArray(data) ? data : [])
      } else if (activeTab === "properties") {
        const response: any = await apiService.ledgers.properties()
        const data = response?.data?.data ?? response?.data ?? []
        setPropertyRows(Array.isArray(data) ? data : [])
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to fetch ledger data")
      setClientRows([])
      setPropertyRows([])
    } finally {
      setLoading(false)
    }
  }

  // Transform client rows → CleanLedgerRow
  const clientCleanRows = useMemo<CleanLedgerRow[]>(() => {
    const q = searchQuery.toLowerCase()
    return clientRows
      .filter((row) => {
        if (!q) return true
        return (
          row.tid?.toLowerCase().includes(q) ||
          row.clientName?.toLowerCase().includes(q) ||
          row.dealTitle?.toLowerCase().includes(q) ||
          row.propertyName?.toLowerCase().includes(q) ||
          row.paymentId?.toLowerCase().includes(q)
        )
      })
      .map((row) => ({
        tid: row.tid ?? row.dealId ?? row.id ?? "—",
        name: row.clientName ?? "Unknown Client",
        type: row.paymentType === "deal" ? "Deal" : "Payment",
        amount: row.credit > 0 ? row.credit : row.debit ?? row.amount ?? 0,
        date: row.date,
        status: computeStatus(row.debit ?? 0, row.credit ?? 0),
      }))
  }, [clientRows, searchQuery])

  // Transform property rows → CleanLedgerRow (one row per property)
  const propertyCleanRows = useMemo<CleanLedgerRow[]>(() => {
    const q = searchQuery.toLowerCase()
    return propertyRows
      .filter((row) => {
        if (!q) return true
        return (
          row.propertyName?.toLowerCase().includes(q) ||
          row.propertyCode?.toLowerCase().includes(q)
        )
      })
      .map((row) => ({
        tid: row.tid ?? row.propertyId ?? "—",
        name: row.propertyName ?? "Unknown Property",
        type: "Deal",
        amount: row.totalDealAmount ?? 0,
        date: row.payments?.[0]?.date ?? new Date().toISOString(),
        status: computeStatus(row.totalDealAmount ?? 0, row.totalReceived ?? 0),
      }))
  }, [propertyRows, searchQuery])

  const tabs = [
    { label: "Client Ledger", value: "clients" },
    { label: "Property Ledger", value: "properties" },
    { label: "Dealer Ledger", value: "dealer" },
  ]

  return (
    <div className="space-y-5">
      {/* Tab bar + controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-input p-1 text-sm font-medium bg-muted/30">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setActiveTab(tab.value as LedgerTab); setSearchQuery("") }}
              className={`rounded-md px-4 py-1.5 transition-colors ${
                activeTab === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeTab !== "dealer" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by TID, name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 w-56 text-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchLedgerData} disabled={loading} className="h-8">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </>
          )}
          {activeTab === "dealer" && (
            <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
              <SelectTrigger className="w-56 h-8 text-sm">
                <SelectValue placeholder="Select dealer..." />
              </SelectTrigger>
              <SelectContent>
                {dealers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && activeTab !== "dealer" ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          <p className="text-sm">Loading ledger data...</p>
        </Card>
      ) : error ? (
        <Card className="p-10 text-center">
          <p className="text-destructive text-sm mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchLedgerData}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
          </Button>
        </Card>
      ) : (
        <>
          {activeTab === "clients" && (
            <LedgerCleanTable rows={clientCleanRows} emptyMessage="No client transactions yet" />
          )}
          {activeTab === "properties" && (
            <LedgerCleanTable rows={propertyCleanRows} emptyMessage="No property transactions yet" />
          )}
          {activeTab === "dealer" && (
            !selectedDealerId ? (
              <Card className="p-10 text-center text-muted-foreground text-sm">
                Select a dealer to view their ledger
              </Card>
            ) : (
              <DealerLedgerView
                dealerId={selectedDealerId}
                dealerName={dealers.find((d) => d.id === selectedDealerId)?.name}
              />
            )
          )}
        </>
      )}
    </div>
  )
}
