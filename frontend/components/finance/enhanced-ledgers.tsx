"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, RefreshCw } from "lucide-react"
import { apiService } from "@/lib/api"
import { DealerLedgerView } from "./dealer-ledger-view"

type LedgerTab = "clients" | "properties" | "dealer"

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
    } else {
      fetchLedgerData()
    }
  }, [activeTab, selectedDealerId])

  // Refresh data when dealer is selected
  useEffect(() => {
    if (activeTab === "dealer" && selectedDealerId) {
      // DealerLedgerView will handle its own data fetching
    } else if (activeTab !== "dealer") {
      fetchLedgerData()
    }
  }, [selectedDealerId])

  const fetchDealers = async () => {
    try {
      const response = await apiService.dealers.getAll()
      const dealerPayload = response.data as any
      setDealers(
        Array.isArray(dealerPayload?.data ?? dealerPayload)
          ? (dealerPayload.data ?? dealerPayload).map((d: any) => ({ id: d.id, name: d.name }))
          : [],
      )
    } catch (err: any) {
      setDealers([])
    }
  }

  const fetchLedgerData = async () => {
    try {
      setLoading(true)
      setError(null)
      if (activeTab === "clients") {
        const response: any = await apiService.ledgers.clients()
        const responseData = response?.data
        // Handle different response structures
        const data = Array.isArray(responseData?.data) 
          ? responseData.data 
          : Array.isArray(responseData) 
            ? responseData 
            : Array.isArray(response?.data) 
              ? response.data 
              : []
        setClientRows(data)
      } else if (activeTab === "properties") {
        const response: any = await apiService.ledgers.properties()
        const responseData = response?.data
        // Handle different response structures
        const data = Array.isArray(responseData?.data) 
          ? responseData.data 
          : Array.isArray(responseData) 
            ? responseData 
            : Array.isArray(response?.data) 
              ? response.data 
              : []
        setPropertyRows(data)
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to fetch ledger data"
      setError(errorMessage)
      setClientRows([])
      setPropertyRows([])
      console.error(`Failed to fetch ${activeTab} ledger:`, err)
    } finally {
      setLoading(false)
    }
  }

  const filteredClientRows = useMemo(() => {
    const query = searchQuery.toLowerCase()
    if (!query) return clientRows
    return clientRows.filter((row) => {
      return (
        row.paymentId?.toLowerCase().includes(query) ||
        row.dealTitle?.toLowerCase().includes(query) ||
        row.clientName?.toLowerCase().includes(query) ||
        row.propertyName?.toLowerCase().includes(query)
      )
    })
  }, [clientRows, searchQuery])

  const filteredPropertyRows = useMemo(() => {
    const query = searchQuery.toLowerCase()
    if (!query) return propertyRows
    return propertyRows.filter((row) =>
      row.propertyName?.toLowerCase().includes(query) ||
      row.propertyCode?.toLowerCase().includes(query),
    )
  }, [propertyRows, searchQuery])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-input p-1 text-sm font-medium">
          {[
            { label: "Client Ledger", value: "clients" },
            { label: "Property Ledger", value: "properties" },
            { label: "Dealer Ledger", value: "dealer" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value as LedgerTab)}
              className={`rounded-sm px-3 py-1 ${
                activeTab === tab.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchLedgerData}
          disabled={loading || activeTab === "dealer"}
          className="ml-auto"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {(activeTab === "clients" || activeTab === "properties") && (
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab === "clients" ? "payments" : "properties"}...`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-8"
            />
          </div>
        )}
        {activeTab === "dealer" && (
          <div className="relative w-full max-w-xs">
            <Label className="sr-only">Select Dealer</Label>
            <Select value={selectedDealerId} onValueChange={setSelectedDealerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select dealer to view ledger" />
              </SelectTrigger>
              <SelectContent>
                {dealers.length > 0 ? (
                  dealers.map((dealer) => (
                    <SelectItem key={dealer.id} value={dealer.id}>
                      {dealer.name}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No dealers found</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <Card className="p-10 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
          Loading ledger data...
        </Card>
      ) : error ? (
        <Card className="p-10 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={fetchLedgerData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : (
        <>
          {activeTab === "clients" && (
            <Card className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Client / Property</TableHead>
                      <TableHead>Payment Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                          No payments found for the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClientRows.map((row, idx) => (
                        <TableRow key={row.id || row.paymentId || idx}>
                          <TableCell className="font-medium">{row.paymentId || row.id || "Deal Opening"}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{row.dealTitle || row.deal?.trackingId || row.deal?.title || "—"}</span>
                              <span className="text-xs text-muted-foreground">Deal ID: {row.dealId || row.deal?.id || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{row.clientName || row.client?.name || "—"}</span>
                              <span className="text-xs text-muted-foreground">{row.propertyName || row.property?.name || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="capitalize">{row.paymentType || row.type || "—"}</span>
                              <span className="text-xs text-muted-foreground">{row.paymentMode?.replace("_", " ") || row.mode || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {row.amount ? `Rs ${Number(row.amount).toLocaleString("en-PK")}` : "Rs 0"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.outstanding ? `Rs ${Number(row.outstanding).toLocaleString("en-PK")}` : "Rs 0"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {row.date ? new Date(row.date).toLocaleDateString() : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {activeTab === "properties" && (
            <div className="space-y-4">
              {filteredPropertyRows.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground">No property ledger data available.</Card>
              ) : (
                filteredPropertyRows.map((property) => (
                  <Card key={property.propertyId || property.id || property.propertyName || Math.random()} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{property.propertyName || property.name || "Unnamed Property"}</h3>
                        <p className="text-sm text-muted-foreground">
                          {property.propertyCode ? `Code: ${property.propertyCode}` : property.code ? `Code: ${property.code}` : "No property code"}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right text-sm">
                        <div>
                          <p className="text-muted-foreground">Deal Value</p>
                          <p className="font-semibold">
                            {property.totalDealAmount ? `Rs ${Number(property.totalDealAmount).toLocaleString("en-PK")}` : "Rs 0"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Received</p>
                          <p className="font-semibold text-primary">
                            {property.totalReceived ? `Rs ${Number(property.totalReceived).toLocaleString("en-PK")}` : "Rs 0"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Outstanding</p>
                          <p className="font-semibold text-destructive">
                            {property.outstanding ? `Rs ${Number(property.outstanding).toLocaleString("en-PK")}` : "Rs 0"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Deal</TableHead>
                            <TableHead>Payment ID</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(!property.payments || property.payments.length === 0) ? (
                            <TableRow>
                              <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                                No payments recorded for this property.
                              </TableCell>
                            </TableRow>
                          ) : (
                            property.payments.map((payment: any, idx: number) => (
                              <TableRow key={payment.id || payment.paymentId || idx}>
                                <TableCell className="font-medium">{payment.dealTitle || payment.deal?.trackingId || payment.deal?.title || "—"}</TableCell>
                                <TableCell>{payment.paymentId || payment.id || "—"}</TableCell>
                                <TableCell className="capitalize">{payment.paymentMode?.replace("_", " ") || payment.mode || "—"}</TableCell>
                                <TableCell className="text-right">
                                  {payment.amount ? `Rs ${Number(payment.amount).toLocaleString("en-PK")}` : "Rs 0"}
                                </TableCell>
                                <TableCell className="text-right text-sm text-muted-foreground">
                                  {payment.date ? new Date(payment.date).toLocaleDateString() : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "dealer" && (
            <div className="space-y-4">
              {!selectedDealerId ? (
                <Card className="p-10 text-center text-muted-foreground">
                  Please select a dealer to view their ledger
                </Card>
              ) : (
                <DealerLedgerView
                  dealerId={selectedDealerId}
                  dealerName={dealers.find((d) => d.id === selectedDealerId)?.name}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}


