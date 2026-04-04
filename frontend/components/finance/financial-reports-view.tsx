"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  FileText,
  Download,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Receipt,
  CreditCard,
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"

type ReportType = 'trial-balance' | 'balance-sheet' | 'profit-loss' | 'property-profitability' | 'escrow' | 'aging'

export function FinancialReportsView() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<ReportType>('trial-balance')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Date filters
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })

  // Report data
  const [trialBalance, setTrialBalance] = useState<any>(null)
  const [balanceSheet, setBalanceSheet] = useState<any>(null)
  const [profitLoss, setProfitLoss] = useState<any>(null)
  const [propertyProfitability, setPropertyProfitability] = useState<any>(null)
  const [escrow, setEscrow] = useState<any>(null)
  const [aging, setAging] = useState<any>(null)
  const [agingType, setAgingType] = useState<'Receivable' | 'Payable'>('Receivable')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([])

  // Load properties for property profitability filter
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const res = await apiService.properties.getAll()
        const data = (res.data as any)?.data || res.data || []
        setProperties(Array.isArray(data) ? data.map((p: any) => ({ id: p.id, name: p.name || p.tid || 'Unnamed' })) : [])
      } catch (error) {
        console.error('Failed to load properties:', error)
      }
    }
    loadProperties()
  }, [])

  const loadReport = async (type: ReportType) => {
    setLoading(true)
    try {
      switch (type) {
        case 'trial-balance':
          const tbRes = await apiService.financialReports.trialBalance({ startDate, endDate })
          setTrialBalance(tbRes.data)
          break
        case 'balance-sheet':
          const bsRes = await apiService.financialReports.balanceSheet({ asOfDate })
          setBalanceSheet(bsRes.data)
          break
        case 'profit-loss':
          if (!startDate || !endDate) {
            toast({
              title: "Error",
              description: "Start date and end date are required for Profit & Loss report",
              variant: "destructive",
            })
            return
          }
          const plRes = await apiService.financialReports.profitLoss({ startDate, endDate })
          setProfitLoss(plRes.data)
          break
        case 'property-profitability':
          const ppRes = await apiService.financialReports.propertyProfitability({
            propertyId: (selectedPropertyId && selectedPropertyId !== 'all') ? selectedPropertyId : undefined,
            startDate,
            endDate,
          })
          setPropertyProfitability(ppRes.data)
          break
        case 'escrow':
          const escRes = await apiService.financialReports.escrow()
          setEscrow(escRes.data)
          break
        case 'aging':
          const agRes = await apiService.financialReports.aging({ type: agingType, asOfDate })
          setAging(agRes.data)
          break
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to load report",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (type: ReportType, format: 'pdf' | 'excel') => {
    setExporting(true)
    try {
      let response
      const params: any = {}

      switch (type) {
        case 'trial-balance':
          params.startDate = startDate
          params.endDate = endDate
          params.format = format
          response = await apiService.financialReports.exportTrialBalance(params)
          break
        case 'balance-sheet':
          params.asOfDate = asOfDate
          params.format = format
          response = await apiService.financialReports.exportBalanceSheet(params)
          break
        case 'profit-loss':
          if (!startDate || !endDate) {
            toast({
              title: "Error",
              description: "Start date and end date are required",
              variant: "destructive",
            })
            return
          }
          params.startDate = startDate
          params.endDate = endDate
          params.format = format
          response = await apiService.financialReports.exportProfitLoss(params)
          break
        case 'property-profitability':
          params.propertyId = (selectedPropertyId && selectedPropertyId !== 'all') ? selectedPropertyId : undefined
          params.startDate = startDate
          params.endDate = endDate
          params.format = format
          response = await apiService.financialReports.exportPropertyProfitability(params)
          break
        case 'escrow':
          params.format = format
          response = await apiService.financialReports.exportEscrow(params)
          break
        case 'aging':
          params.type = agingType
          params.asOfDate = asOfDate
          params.format = format
          response = await apiService.financialReports.exportAging(params)
          break
      }

      // Create blob and download
      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `${format.toUpperCase()} report downloaded successfully`,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.response?.data?.error || error?.message || "Failed to export report",
        variant: "destructive",
      })
    } finally {
      setExporting(false)
    }
  }

  // Auto-load report when tab changes or filters change
  useEffect(() => {
    if (activeTab) {
      loadReport(activeTab)
    }
  }, [activeTab, startDate, endDate, asOfDate, agingType, selectedPropertyId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Financial Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive financial reporting with fraud detection and export capabilities
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportType)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="profit-loss">P&L</TabsTrigger>
          <TabsTrigger value="property-profitability">Property Profit</TabsTrigger>
          <TabsTrigger value="escrow">Escrow</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
        </TabsList>

        {/* Trial Balance */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Trial Balance</CardTitle>
                  <CardDescription>All posting accounts with debit and credit balances</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('trial-balance', 'pdf')}
                    disabled={exporting || !trialBalance}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('trial-balance', 'excel')}
                    disabled={exporting || !trialBalance}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : trialBalance ? (
                <>
                  {trialBalance.isBalanced ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Balanced</AlertTitle>
                      <AlertDescription>
                        Trial balance is balanced. Total debits equal total credits.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Mismatch Detected</AlertTitle>
                      <AlertDescription>
                        Trial balance is not balanced. Difference: {formatCurrency(Math.abs((trialBalance.totals?.totalDebits ?? 0) - (trialBalance.totals?.totalCredits ?? 0)))}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Trial Balance Chart */}
                  {trialBalance.entries && trialBalance.entries.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-md font-semibold mb-4">Debit vs Credit Overview</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                          {
                            name: 'Totals',
                            Debits: trialBalance.totals?.totalDebits ?? 0,
                            Credits: trialBalance.totals?.totalCredits ?? 0,
                          }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="Debits" fill="#8884d8" />
                          <Bar dataKey="Credits" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Code</TableHead>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Account Type</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(trialBalance.entries || []).map((entry: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{entry.accountCode}</TableCell>
                            <TableCell>{entry.accountName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{entry.accountType}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.debitTotal)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(entry.creditTotal)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(entry.balance)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-muted">
                          <TableCell colSpan={3}>TOTALS</TableCell>
                          <TableCell className="text-right">{formatCurrency(trialBalance.totals?.totalDebits ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(trialBalance.totals?.totalCredits ?? 0)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Click "Load Report" or adjust date filters to generate report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Balance Sheet</CardTitle>
                  <CardDescription>Assets, Liabilities, and Equity as of selected date</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('balance-sheet', 'pdf')}
                    disabled={exporting || !balanceSheet}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('balance-sheet', 'excel')}
                    disabled={exporting || !balanceSheet}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>As of Date</Label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : balanceSheet ? (
                <>
                  {balanceSheet.isBalanced ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Balanced</AlertTitle>
                      <AlertDescription>
                        Balance sheet is balanced. Assets equal Liabilities + Equity.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Mismatch Detected</AlertTitle>
                      <AlertDescription>
                        Balance sheet is not balanced. Please review the entries.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Balance Sheet Chart */}
                  {balanceSheet && (
                    <div className="mt-6 mb-6">
                      <h4 className="text-md font-semibold mb-4">Balance Sheet Overview</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Assets', value: balanceSheet.assets?.total ?? 0 },
                              { name: 'Liabilities', value: balanceSheet.liabilities?.total ?? 0 },
                              { name: 'Equity', value: balanceSheet.equity?.total ?? 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry: any) => {
                              const percent = entry.percent ?? 0;
                              return `${entry.name}: ${(percent * 100).toFixed(1)}%`;
                            }}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {[
                              { name: 'Assets', value: balanceSheet.assets?.total ?? 0 },
                              { name: 'Liabilities', value: balanceSheet.liabilities?.total ?? 0 },
                              { name: 'Equity', value: balanceSheet.equity?.total ?? 0 },
                            ].map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#8884d8' : index === 1 ? '#82ca9d' : '#ffc658'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Assets */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">ASSETS</h3>
                      <div>
                        <h4 className="font-medium mb-2">Current Assets</h4>
                        <div className="space-y-2">
                          {(balanceSheet.assets?.current || []).map((entry: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{entry.accountCode} - {entry.accountName}</span>
                              <span className="font-medium">{formatCurrency(entry.balance)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold border-t pt-2">
                            <span>Total Current Assets</span>
                            <span>{formatCurrency((balanceSheet.assets?.current || []).reduce((sum: number, e: any) => sum + e.balance, 0))}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Fixed Assets</h4>
                        <div className="space-y-2">
                          {(balanceSheet.assets?.fixed || []).map((entry: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{entry.accountCode} - {entry.accountName}</span>
                              <span className="font-medium">{formatCurrency(entry.balance)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold border-t pt-2">
                            <span>Total Fixed Assets</span>
                            <span>{formatCurrency((balanceSheet.assets?.fixed || []).reduce((sum: number, e: any) => sum + e.balance, 0))}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Liabilities & Equity */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">LIABILITIES & EQUITY</h3>
                      <div>
                        <h4 className="font-medium mb-2">Current Liabilities</h4>
                        <div className="space-y-2">
                          {(balanceSheet.liabilities?.current || []).map((entry: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{entry.accountCode} - {entry.accountName}</span>
                              <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold border-t pt-2">
                            <span>Total Liabilities</span>
                            <span>{formatCurrency((balanceSheet.liabilities?.current || []).reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0))}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Equity</h4>
                        <div className="space-y-2">
                          {(balanceSheet.equity ? Object.values(balanceSheet.equity).flat() : []).map((entry: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{entry.accountCode} - {entry.accountName}</span>
                              <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Adjust date filter to generate report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit & Loss - Continue in next part due to length */}
        <TabsContent value="profit-loss" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Profit & Loss Statement</CardTitle>
                  <CardDescription>Revenue and expenses for the selected period</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('profit-loss', 'pdf')}
                    disabled={exporting || !profitLoss}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('profit-loss', 'excel')}
                    disabled={exporting || !profitLoss}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : profitLoss ? (
                <div className="space-y-6">
                  {/* P&L Chart */}
                  <div className="mt-4">
                    <h4 className="text-md font-semibold mb-4">Profit & Loss Overview</h4>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        {
                          name: 'Revenue',
                          Amount: profitLoss.revenue?.total ?? 0,
                        },
                        {
                          name: 'Expenses',
                          Amount: -(profitLoss.expenses?.total ?? 0),
                        },
                        {
                          name: 'Net Profit',
                          Amount: profitLoss.netProfit ?? 0,
                        },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="Amount">
                          {[
                            {
                              name: 'Revenue',
                              Amount: profitLoss.revenue?.total ?? 0,
                            },
                            {
                              name: 'Expenses',
                              Amount: -(profitLoss.expenses?.total ?? 0),
                            },
                            {
                              name: 'Net Profit',
                              Amount: profitLoss.netProfit ?? 0,
                            },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.Amount >= 0 ? '#82ca9d' : '#ff7c7c'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">REVENUE</h3>
                    <div className="space-y-2">
                      {(profitLoss.revenue ? Object.values(profitLoss.revenue).flat() : []).map((entry: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{entry.accountCode} - {entry.accountName}</span>
                          <span className="font-medium">{formatCurrency(entry.balance)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold border-t pt-2 mt-2">
                        <span>Total Revenue</span>
                        <span className="text-green-600">
                          {formatCurrency((profitLoss.revenue ? Object.values(profitLoss.revenue).flat() : []).reduce((sum: number, e: any) => sum + e.balance, 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">EXPENSES</h3>
                    <div className="space-y-2">
                      {(profitLoss.expenses ? Object.values(profitLoss.expenses).flat() : []).map((entry: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{entry.accountCode} - {entry.accountName}</span>
                          <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold border-t pt-2 mt-2">
                        <span>Total Expenses</span>
                        <span className="text-red-600">
                          {formatCurrency((profitLoss.expenses ? Object.values(profitLoss.expenses).flat() : []).reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Net Profit */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Net Profit</span>
                      <span className={`text-xl font-bold ${profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(profitLoss.netProfit)}
                      </span>
                    </div>
                    {profitLoss.revenue && Object.values(profitLoss.revenue).flat().length > 0 && (
                      <div className="text-sm text-muted-foreground mt-2">
                        Profit Margin: {((profitLoss.netProfit / (profitLoss.revenue ? Object.values(profitLoss.revenue).flat() : []).reduce((sum: number, e: any) => sum + e.balance, 0)) * 100).toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select date range and generate report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Property Profitability */}
        <TabsContent value="property-profitability" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Property Profitability</CardTitle>
                  <CardDescription>Revenue and expenses by property</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('property-profitability', 'pdf')}
                    disabled={exporting || !propertyProfitability}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('property-profitability', 'excel')}
                    disabled={exporting || !propertyProfitability}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Property (Optional)</Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Properties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : propertyProfitability ? (
                <div className="space-y-6">
                  {/* Property Profitability Chart */}
                  {Array.isArray(propertyProfitability) && propertyProfitability.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-md font-semibold mb-4">Property Profitability Comparison</h4>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={propertyProfitability.map((p: any) => ({
                          name: p.propertyName?.substring(0, 20) || 'Unknown',
                          Revenue: p.revenue ?? 0,
                          Expenses: p.expenses ?? 0,
                          'Net Profit': p.netProfit ?? 0,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="Revenue" fill="#82ca9d" />
                          <Bar dataKey="Expenses" fill="#ff7c7c" />
                          <Bar dataKey="Net Profit" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
                  {/* Property Details - show first property or all if array */}
                  {Array.isArray(propertyProfitability) ? (
                    propertyProfitability.map((profit: any, idx: number) => (
                      <div key={idx} className="border rounded-lg p-4">
                        <h3 className="text-lg font-semibold mb-3">{profit.propertyName}</h3>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Revenue Breakdown</h4>
                            <div className="space-y-1">
                              {(profit.revenueBreakdown || []).map((entry: any, eIdx: number) => (
                                <div key={eIdx} className="flex justify-between text-sm">
                                  <span>{entry.accountCode} - {entry.accountName}</span>
                                  <span className="font-medium">{formatCurrency(entry.amount)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                <span>Total Revenue</span>
                                <span className="text-green-600">{formatCurrency(profit.revenue ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-2">Expense Breakdown</h4>
                            <div className="space-y-1">
                              {(profit.expenseBreakdown || []).map((entry: any, eIdx: number) => (
                                <div key={eIdx} className="flex justify-between text-sm">
                                  <span>{entry.accountCode} - {entry.accountName}</span>
                                  <span className="font-medium">{formatCurrency(entry.amount)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                                <span>Total Expenses</span>
                                <span className="text-red-600">{formatCurrency(profit.expenses ?? 0)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="border-t pt-2">
                            <div className="flex justify-between items-center">
                              <span className="font-bold">Net Profit</span>
                              <span className={`text-lg font-bold ${profit.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(profit.netProfit ?? 0)}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Profit Margin: {(profit.profitMargin ?? 0).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold mb-3">REVENUE</h3>
                        <div className="space-y-2">
                          {(propertyProfitability.revenue || []).map((entry: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{entry.accountCode} - {entry.accountName}</span>
                              <span className="font-medium">{formatCurrency(entry.balance)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold border-t pt-2 mt-2">
                            <span>Total Revenue</span>
                            <span className="text-green-600">
                              {formatCurrency((propertyProfitability.revenue || []).reduce((sum: number, e: any) => sum + e.balance, 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold mb-3">EXPENSES</h3>
                        <div className="space-y-2">
                          {(propertyProfitability.expenses || []).map((entry: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{entry.accountCode} - {entry.accountName}</span>
                              <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between font-bold border-t pt-2 mt-2">
                            <span>Total Expenses</span>
                            <span className="text-red-600">
                              {formatCurrency((propertyProfitability.expenses || []).reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold">Net Profit</span>
                          <span className={`text-xl font-bold ${propertyProfitability.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(propertyProfitability.netProfit)}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          Profit Margin: {(propertyProfitability.profitMargin ?? 0).toFixed(2)}%
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select filters and generate report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Escrow */}
        <TabsContent value="escrow" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Escrow Balance Report</CardTitle>
                  <CardDescription>Trust assets and client liabilities reconciliation</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('escrow', 'pdf')}
                    disabled={exporting || !escrow}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('escrow', 'excel')}
                    disabled={exporting || !escrow}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : escrow ? (
                <>
                  {escrow.isBalanced ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>Balanced</AlertTitle>
                      <AlertDescription>
                        Escrow is balanced. Trust assets equal client liabilities.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Mismatch Detected</AlertTitle>
                      <AlertDescription>
                        Escrow is not balanced. Difference: {formatCurrency(Math.abs(escrow.difference))}
                        {(escrow.violations || []).length > 0 && (
                          <ul className="mt-2 list-disc list-inside">
                            {(escrow.violations || []).map((v: string, idx: number) => (
                              <li key={idx}>{v}</li>
                            ))}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Escrow Chart */}
                  {escrow && (
                    <div className="mt-4 mb-6">
                      <h4 className="text-md font-semibold mb-4">Escrow Balance Comparison</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                          {
                            name: 'Escrow Balance',
                            'Trust Assets': escrow.totalTrustAssets ?? 0,
                            'Client Liabilities': escrow.totalClientLiabilities ?? 0,
                          }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="Trust Assets" fill="#8884d8" />
                          <Bar dataKey="Client Liabilities" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <h3 className="text-lg font-semibold mb-3">TRUST ASSETS</h3>
                      <div className="space-y-2">
                        {(escrow.trustAssets || []).map((asset: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{asset.accountCode} - {asset.accountName}</span>
                            <span className="font-medium">{formatCurrency(asset.balance)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold border-t pt-2 mt-2">
                          <span>Total Trust Assets</span>
                          <span>{formatCurrency(escrow.totalTrustAssets)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">CLIENT LIABILITIES</h3>
                      <div className="space-y-2">
                        {(escrow.clientLiabilities || []).map((liability: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{liability.accountCode} - {liability.accountName}</span>
                            <span className="font-medium">{formatCurrency(liability.balance)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between font-bold border-t pt-2 mt-2">
                          <span>Total Client Liabilities</span>
                          <span>{formatCurrency(escrow.totalClientLiabilities)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Loading escrow report...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aging */}
        <TabsContent value="aging" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Aging Report</CardTitle>
                  <CardDescription>Accounts receivable or payable aging analysis</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('aging', 'pdf')}
                    disabled={exporting || !aging}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('aging', 'excel')}
                    disabled={exporting || !aging}
                  >
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                    Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={agingType} onValueChange={(v) => setAgingType(v as 'Receivable' | 'Payable')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Receivable">Accounts Receivable</SelectItem>
                      <SelectItem value="Payable">Accounts Payable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>As of Date</Label>
                  <Input
                    type="date"
                    value={asOfDate}
                    onChange={(e) => setAsOfDate(e.target.value)}
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : aging ? (
                <>
                  {/* Aging Chart */}
                  {aging.entries && aging.entries.length > 0 && (
                    <div className="mt-4 mb-6">
                      <h4 className="text-md font-semibold mb-4">Aging Buckets Visualization</h4>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={aging.entries.map((entry: any) => ({
                          name: entry.accountName?.substring(0, 20) || entry.accountCode,
                          '0-30 Days': entry.current ?? 0,
                          '31-60 Days': entry.days31_60 ?? 0,
                          '61-90 Days': entry.days61_90 ?? 0,
                          '91+ Days': entry.days91_plus ?? 0,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="0-30 Days" stackId="a" fill="#82ca9d" />
                          <Bar dataKey="31-60 Days" stackId="a" fill="#ffc658" />
                          <Bar dataKey="61-90 Days" stackId="a" fill="#ff7c7c" />
                          <Bar dataKey="91+ Days" stackId="a" fill="#d73027" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
                  {/* Totals Chart */}
                  {aging.totals && (
                    <div className="mb-6">
                      <h4 className="text-md font-semibold mb-4">Total Aging Summary</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                          {
                            name: 'Totals',
                            '0-30 Days': aging.totals.current ?? 0,
                            '31-60 Days': aging.totals.days31_60 ?? 0,
                            '61-90 Days': aging.totals.days61_90 ?? 0,
                            '91+ Days': aging.totals.days91_plus ?? 0,
                          }
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="0-30 Days" fill="#82ca9d" />
                          <Bar dataKey="31-60 Days" fill="#ffc658" />
                          <Bar dataKey="61-90 Days" fill="#ff7c7c" />
                          <Bar dataKey="91+ Days" fill="#d73027" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <ScrollArea className="h-[600px]">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead className="text-right">Current (0-30)</TableHead>
                        <TableHead className="text-right">31-60 Days</TableHead>
                        <TableHead className="text-right">61-90 Days</TableHead>
                        <TableHead className="text-right">91+ Days</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(aging.entries || []).map((entry: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{entry.accountCode}</TableCell>
                          <TableCell>{entry.accountName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.current)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.days31_60)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.days61_90)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entry.days91_plus)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(entry.total)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-muted">
                        <TableCell colSpan={2}>TOTALS</TableCell>
                        <TableCell className="text-right">{formatCurrency(aging.totals?.current || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(aging.totals?.days31_60 || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(aging.totals?.days61_90 || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(aging.totals?.days91_plus || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(aging.totals?.total || 0)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </ScrollArea>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select type and date to generate report
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

