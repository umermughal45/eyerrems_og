"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Download, Filter, Printer } from "lucide-react"
import { format } from "date-fns"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

interface ClientLedgerPageProps {
  clientId: string
  clientName?: string
}

interface LedgerEntry {
  id: string
  date: string | Date
  description?: string
  debit: number
  credit: number
  runningBalance: number
  propertyName?: string
  propertyId?: string
  dealTitle?: string
  paymentType?: string
  paymentMode?: string
  paymentId?: string
  dealId?: string
}

export function ClientLedgerPage({ clientId, clientName }: ClientLedgerPageProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'thisMonth'>('all')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [properties, setProperties] = useState<Array<{ id: string; name: string; code?: string }>>([])

  useEffect(() => {
    loadLedgerData()
    loadProperties()
  }, [clientId, filter, selectedPropertyId])

  const loadProperties = async () => {
    try {
      const response: any = await apiService.properties.getAll()
      const data = response?.data?.data || response?.data || []
      const props = Array.isArray(data)
        ? data.map((p: any) => ({ 
            id: p.id, 
            name: p.name || p.address || 'Unnamed Property',
            code: p.manualUniqueId || p.propertyCode
          }))
        : []
      setProperties(props)
    } catch (error) {
      console.error('Failed to load properties:', error)
    }
  }

  const loadLedgerData = async () => {
    try {
      setLoading(true)
      const params: any = {
        period: filter,
      }
      if (selectedPropertyId && selectedPropertyId !== 'all') {
        params.propertyId = selectedPropertyId
      }

      const response: any = await apiService.ledgers.clientById(clientId, params)
      const data = response?.data?.data || response?.data || []
      setEntries(Array.isArray(data) ? data : [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load client ledger",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    // Create CSV content
    const headers = [
      'Customer Name', 'Tran Date', 'Transaction Number', 'Cheque Number', 'Cheque Date',
      'Reference No', 'Memo', 'Debit', 'Credit', 'Running Total', 'Status',
      'Property Serial No', 'Attachment', 'Modified Flag', 'Auditor Remarks', 'Reason Modification'
    ]
    
    const rows = entries.map(entry => {
      const prop = properties.find(p => p.id === entry.propertyId)
      return [
        clientName || '—',
        format(new Date(entry.date), 'yyyy-MM-dd'),
        entry.paymentId || entry.dealId || '—',
        entry.paymentMode === 'Cheque' ? '—' : '—', // Placeholder
        '—', // Cheque Date
        '—', // Reference No
        entry.description || '—',
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.runningBalance.toFixed(2),
        'Posted', // Status
        prop?.code || '—',
        '—', // Attachment
        '—', // Modified Flag
        '—', // Auditor Remarks
        '—'  // Reason Modification
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `customer-ledger-${clientId}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Success",
      description: "Ledger exported successfully",
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0)
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0)
  const finalBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Header and Filters - Hidden in print if needed, or styled */}
      <Card className="print:hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Ledger Report</CardTitle>
              <CardDescription>Complete financial history of {clientName}</CardDescription>
            </div>
            <div className="flex gap-2">
               <Button onClick={handlePrint} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Filter Period</Label>
              <Select value={filter} onValueChange={(val: 'all' | 'thisMonth') => setFilter(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Filter by Property</Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={loadLedgerData} variant="outline" className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Printable Header - Only visible in print */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold">Customer Ledger Report</h1>
        <p className="text-sm text-gray-500">Customer: {clientName}</p>
        <p className="text-sm text-gray-500">Date: {format(new Date(), "PPP")}</p>
      </div>

      {/* Ledger Table */}
      <Card className="border-t-4 border-t-primary/80 shadow-sm print:shadow-none print:border-none">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No ledger entries found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1500px]">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm print:shadow-none">
                  <TableRow>
                    <TableHead className="w-[150px]">Customer Name</TableHead>
                    <TableHead className="w-[100px]">Tran Date</TableHead>
                    <TableHead className="w-[120px]">Transaction No</TableHead>
                    <TableHead className="w-[100px]">Cheque No</TableHead>
                    <TableHead className="w-[100px]">Cheque Date</TableHead>
                    <TableHead className="w-[100px]">Reference No</TableHead>
                    <TableHead className="w-[200px]">Memo</TableHead>
                    <TableHead className="text-right w-[120px]">Debit</TableHead>
                    <TableHead className="text-right w-[120px]">Credit</TableHead>
                    <TableHead className="text-right w-[120px]">Running Total</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[120px]">Property Serial</TableHead>
                    <TableHead className="w-[80px]">Attach</TableHead>
                    <TableHead className="w-[80px]">Modified</TableHead>
                    <TableHead className="w-[150px]">Auditor Remarks</TableHead>
                    <TableHead className="w-[150px]">Reason Mod</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const prop = properties.find(p => p.id === entry.propertyId)
                    return (
                      <TableRow key={entry.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{clientName || '—'}</TableCell>
                        <TableCell>{format(new Date(entry.date), "dd-MMM-yyyy")}</TableCell>
                        <TableCell className="font-mono text-xs">{entry.paymentId || entry.dealId || '—'}</TableCell>
                        <TableCell>{entry.paymentMode === 'Cheque' ? '—' : '—'}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={entry.description}>{entry.description || '—'}</TableCell>
                        <TableCell className="text-right text-red-600 font-medium">
                          {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${entry.runningBalance >= 0 ? 'text-primary' : 'text-orange-600'}`}>
                          {formatCurrency(entry.runningBalance)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-100">Posted</Badge>
                        </TableCell>
                        <TableCell>{prop?.code || '—'}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                {/* Report Total Section */}
                <tfoot className="bg-muted/50 font-bold border-t-2 border-primary/20">
                    <TableRow>
                        <TableCell colSpan={7} className="text-right text-muted-foreground uppercase tracking-wider">Report Total</TableCell>
                        <TableCell className="text-right text-red-600 text-lg">{formatCurrency(totalDebit)}</TableCell>
                        <TableCell className="text-right text-green-600 text-lg">{formatCurrency(totalCredit)}</TableCell>
                        <TableCell className="text-right text-primary text-lg">{formatCurrency(finalBalance)}</TableCell>
                        <TableCell colSpan={6}></TableCell>
                    </TableRow>
                </tfoot>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

