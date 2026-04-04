"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Receipt,
  CreditCard,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
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
import { UnifiedReportLayout } from "./unified-report-layout"

type ReportType = 'trial-balance' | 'balance-sheet' | 'profit-loss' | 'property-profitability' | 'escrow' | 'aging'

interface FinancialReportPreviewProps {
  reportType: ReportType
  reportData: any
  filters?: any
  onDownload: (format: 'pdf' | 'excel') => void
}

export function FinancialReportPreview({ reportType, reportData, filters, onDownload }: FinancialReportPreviewProps) {
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null)

  const handleDownload = async (format: 'pdf' | 'excel') => {
    setDownloading(format)
    try {
      await onDownload(format)
    } finally {
      setDownloading(null)
    }
  }

  const getReportTitle = () => {
    switch (reportType) {
      case 'trial-balance': return 'Trial Balance Report'
      case 'balance-sheet': return 'Balance Sheet Report'
      case 'profit-loss': return 'Profit & Loss Statement'
      case 'property-profitability': return 'Property Profitability Report'
      case 'escrow': return 'Escrow Balance Report'
      case 'aging': return 'Aging Report'
      default: return 'Financial Report'
    }
  }

  const getReportDescription = () => {
    switch (reportType) {
      case 'trial-balance': return 'All posting accounts with debit and credit balances'
      case 'balance-sheet': return 'Assets, Liabilities, and Equity as of selected date'
      case 'profit-loss': return 'Revenue and expenses for the selected period'
      case 'property-profitability': return 'Revenue and expenses by property'
      case 'escrow': return 'Trust assets and client liabilities reconciliation'
      case 'aging': return 'Accounts receivable or payable aging analysis'
      default: return 'Financial report details'
    }
  }

  const renderReportContent = () => {
    if (!reportData) return null

    switch (reportType) {
      case 'trial-balance':
        return <TrialBalanceContent data={reportData} />
      case 'balance-sheet':
        return <BalanceSheetContent data={reportData} />
      case 'profit-loss':
        return <ProfitLossContent data={reportData} />
      case 'property-profitability':
        return <PropertyProfitabilityContent data={reportData} />
      case 'escrow':
        return <EscrowContent data={reportData} />
      case 'aging':
        return <AgingContent data={reportData} filters={filters} />
      default:
        return null
    }
  }

  return (
    <UnifiedReportLayout
      title={getReportTitle()}
      description={getReportDescription()}
      filters={filters}
      onDownload={handleDownload}
      downloading={downloading}
    >
      {renderReportContent()}
    </UnifiedReportLayout>
  )
}

function TrialBalanceContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Balance Status */}
      {data.isBalanced ? (
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
            Trial balance is not balanced. Difference: {formatCurrency(Math.abs((data.totals?.totalDebits ?? 0) - (data.totals?.totalCredits ?? 0)))}
          </AlertDescription>
        </Alert>
      )}

      {/* Chart */}
      {data.entries && data.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Debit vs Credit Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  name: 'Totals',
                  Debits: data.totals?.totalDebits ?? 0,
                  Credits: data.totals?.totalCredits ?? 0,
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
          </CardContent>
        </Card>
      )}

      {/* Account Details Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Account Code</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Account Name</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Account Type</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Debit</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Credit</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(data.entries || []).map((entry: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-mono">{entry.accountCode}</td>
                    <td className="border border-gray-300 px-4 py-2">{entry.accountName}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <Badge variant="outline">{entry.accountType}</Badge>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(entry.debitTotal)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(entry.creditTotal)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-medium">{formatCurrency(entry.balance)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-100">
                  <td colSpan={3} className="border border-gray-300 px-4 py-2">TOTALS</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.totalDebits ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.totalCredits ?? 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BalanceSheetContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Balance Status */}
      {data.isBalanced ? (
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

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Balance Sheet Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Assets', value: data.assets?.total ?? 0 },
                  { name: 'Liabilities', value: data.liabilities?.total ?? 0 },
                  { name: 'Equity', value: data.equity?.total ?? 0 },
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
                  { name: 'Assets', value: data.assets?.total ?? 0 },
                  { name: 'Liabilities', value: data.liabilities?.total ?? 0 },
                  { name: 'Equity', value: data.equity?.total ?? 0 },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#8884d8' : index === 1 ? '#82ca9d' : '#ffc658'} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Assets and Liabilities */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">ASSETS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Current Assets</h4>
              <div className="space-y-2">
                {(data.assets?.current || []).map((entry: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{entry.accountCode} - {entry.accountName}</span>
                    <span className="font-medium">{formatCurrency(entry.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Current Assets</span>
                  <span>{formatCurrency((data.assets?.current || []).reduce((sum: number, e: any) => sum + e.balance, 0))}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Fixed Assets</h4>
              <div className="space-y-2">
                {(data.assets?.fixed || []).map((entry: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{entry.accountCode} - {entry.accountName}</span>
                    <span className="font-medium">{formatCurrency(entry.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Fixed Assets</span>
                  <span>{formatCurrency((data.assets?.fixed || []).reduce((sum: number, e: any) => sum + e.balance, 0))}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">LIABILITIES & EQUITY</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Current Liabilities</h4>
              <div className="space-y-2">
                {(data.liabilities?.current || []).map((entry: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{entry.accountCode} - {entry.accountName}</span>
                    <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total Liabilities</span>
                  <span>{formatCurrency((data.liabilities?.current || []).reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0))}</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Equity</h4>
              <div className="space-y-2">
                {(data.equity ? Object.values(data.equity).flat() : []).map((entry: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{entry.accountCode} - {entry.accountName}</span>
                    <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ProfitLossContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profit & Loss Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              {
                name: 'Revenue',
                Amount: data.revenue?.total ?? 0,
              },
              {
                name: 'Expenses',
                Amount: -(data.expenses?.total ?? 0),
              },
              {
                name: 'Net Profit',
                Amount: data.netProfit ?? 0,
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
                    Amount: data.revenue?.total ?? 0,
                  },
                  {
                    name: 'Expenses',
                    Amount: -(data.expenses?.total ?? 0),
                  },
                  {
                    name: 'Net Profit',
                    Amount: data.netProfit ?? 0,
                  },
                ].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.Amount >= 0 ? '#82ca9d' : '#ff7c7c'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue and Expenses */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-green-600">REVENUE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.revenue ? Object.values(data.revenue).flat() : []).map((entry: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{entry.accountCode} - {entry.accountName}</span>
                  <span className="font-medium">{formatCurrency(entry.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total Revenue</span>
                <span className="text-green-600">
                  {formatCurrency((data.revenue ? Object.values(data.revenue).flat() : []).reduce((sum: number, e: any) => sum + e.balance, 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-red-600">EXPENSES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.expenses ? Object.values(data.expenses).flat() : []).map((entry: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{entry.accountCode} - {entry.accountName}</span>
                  <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total Expenses</span>
                <span className="text-red-600">
                  {formatCurrency((data.expenses ? Object.values(data.expenses).flat() : []).reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Net Profit */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold">Net Profit</span>
            <span className={`text-2xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.netProfit)}
            </span>
          </div>
          {data.revenue && Object.values(data.revenue).flat().length > 0 && (
            <div className="text-sm text-muted-foreground mt-2">
              Profit Margin: {((data.netProfit / (data.revenue ? Object.values(data.revenue).flat() : []).reduce((sum: number, e: any) => sum + e.balance, 0)) * 100).toFixed(2)}%
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PropertyProfitabilityContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Chart */}
      {Array.isArray(data) && data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Property Profitability Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.map((p: any) => ({
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
          </CardContent>
        </Card>
      )}

      {/* Property Details */}
      {Array.isArray(data) ? (
        data.map((profit: any, idx: number) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle className="text-lg">{profit.propertyName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Revenue Breakdown</h4>
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
                <h4 className="font-semibold mb-2">Expense Breakdown</h4>
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
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-3">REVENUE</h3>
              <div className="space-y-2">
                {(data.revenue || []).map((entry: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{entry.accountCode} - {entry.accountName}</span>
                    <span className="font-medium">{formatCurrency(entry.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2 mt-2">
                  <span>Total Revenue</span>
                  <span className="text-green-600">
                    {formatCurrency((data.revenue || []).reduce((sum: number, e: any) => sum + e.balance, 0))}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">EXPENSES</h3>
              <div className="space-y-2">
                {(data.expenses || []).map((entry: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{entry.accountCode} - {entry.accountName}</span>
                    <span className="font-medium">{formatCurrency(Math.abs(entry.balance))}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold border-t pt-2 mt-2">
                  <span>Total Expenses</span>
                  <span className="text-red-600">
                    {formatCurrency((data.expenses || []).reduce((sum: number, e: any) => sum + Math.abs(e.balance), 0))}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Net Profit</span>
                <span className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(data.netProfit)}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                Profit Margin: {(data.profitMargin ?? 0).toFixed(2)}%
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EscrowContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {/* Balance Status */}
      {data.isBalanced ? (
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
            Escrow is not balanced. Difference: {formatCurrency(Math.abs(data.difference))}
            {(data.violations || []).length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {(data.violations || []).map((v: string, idx: number) => (
                  <li key={idx}>{v}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Escrow Balance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              {
                name: 'Escrow Balance',
                'Trust Assets': data.totalTrustAssets ?? 0,
                'Client Liabilities': data.totalClientLiabilities ?? 0,
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
        </CardContent>
      </Card>

      {/* Trust Assets and Client Liabilities */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">TRUST ASSETS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.trustAssets || []).map((asset: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{asset.accountCode} - {asset.accountName}</span>
                  <span className="font-medium">{formatCurrency(asset.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total Trust Assets</span>
                <span>{formatCurrency(data.totalTrustAssets)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CLIENT LIABILITIES</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(data.clientLiabilities || []).map((liability: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{liability.accountCode} - {liability.accountName}</span>
                  <span className="font-medium">{formatCurrency(liability.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>Total Client Liabilities</span>
                <span>{formatCurrency(data.totalClientLiabilities)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AgingContent({ data, filters }: { data: any, filters?: any }) {
  return (
    <div className="space-y-6">
      {/* Charts */}
      {data.entries && data.entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aging Buckets Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.entries.map((entry: any) => ({
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
          </CardContent>
        </Card>
      )}

      {data.totals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Aging Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  name: 'Totals',
                  '0-30 Days': data.totals.current ?? 0,
                  '31-60 Days': data.totals.days31_60 ?? 0,
                  '61-90 Days': data.totals.days61_90 ?? 0,
                  '91+ Days': data.totals.days91_plus ?? 0,
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
          </CardContent>
        </Card>
      )}

      {/* Aging Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aging Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 px-4 py-2 text-left">Account Code</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Account Name</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Current (0-30)</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">31-60 Days</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">61-90 Days</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">91+ Days</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data.entries || []).map((entry: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-mono">{entry.accountCode}</td>
                    <td className="border border-gray-300 px-4 py-2">{entry.accountName}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(entry.current)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(entry.days31_60)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(entry.days61_90)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(entry.days91_plus)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-medium">{formatCurrency(entry.total)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-gray-100">
                  <td colSpan={2} className="border border-gray-300 px-4 py-2">TOTALS</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.current || 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.days31_60 || 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.days61_90 || 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.days91_plus || 0)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(data.totals?.total || 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
