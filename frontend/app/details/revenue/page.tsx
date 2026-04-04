"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { apiService } from "@/lib/api"
import { MiniChartCard } from "@/components/ui/mini-chart-card"

type RevenueSummary = {
  totalRevenue: number
  monthlyRevenue: number
  averageMonthlyRevenue: number
  transactionCount: number
  monthOverMonthChange: number | null
}

type RevenueTrendPoint = {
  month: string
  revenue: number
  target: number
}

type RevenueBreakdownItem = {
  source: string
  amount: number
  percentage: number
  trend: "up" | "down" | "flat"
}

type RevenueTransaction = {
  id: string
  date: string
  description: string
  category: string
  status: string
  amount: number
  property?: string
}

const formatCurrency = (amount: number) => {
  const value = Number(amount) || 0
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value < 1000 ? 0 : 1,
  }).format(value)

  if (Math.abs(value) >= 10000000) {
    return `Rs ${(value / 10000000).toFixed(2)}Cr`
  }
  if (Math.abs(value) >= 100000) {
    return `Rs ${(value / 100000).toFixed(1)}L`
  }
  return `Rs ${formatted}`
}

const toPercentage = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(1)}%`

export default function RevenueDetailsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<RevenueSummary>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    averageMonthlyRevenue: 0,
    transactionCount: 0,
    monthOverMonthChange: null,
  })
  const [revenueData, setRevenueData] = useState<RevenueTrendPoint[]>([])
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueBreakdownItem[]>([])
  const [recentTransactions, setRecentTransactions] = useState<RevenueTransaction[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchRevenueData()
  }, [])

  const fetchRevenueData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [transactionsResponse, financeStatsResponse] = await Promise.all([
        apiService.transactions.getAll(),
        apiService.stats.getFinanceStats().catch((err) => {
          console.error("Failed to fetch finance stats:", err)
          return { data: {} } as any
        }),
      ])

      const financeStatsData =
        financeStatsResponse?.data?.data || financeStatsResponse?.data || {}

      const rawTransactions = Array.isArray((transactionsResponse as any)?.data?.data)
        ? (transactionsResponse as any).data.data
        : Array.isArray((transactionsResponse as any)?.data)
          ? (transactionsResponse as any).data
          : []

      const incomeTransactions = rawTransactions
        .filter((txn: any) => (txn?.type || "").toLowerCase() === "income")
        .map((txn: any) => {
          const dateString = txn.date || txn.createdAt
          const parsedDate = dateString ? new Date(dateString) : null

          if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
            return null
          }

          return {
            ...txn,
            parsedDate,
            amount: Number(txn.amount) || 0,
          }
        })
        .filter(Boolean) as Array<any & { parsedDate: Date }>

      const now = new Date()
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

      // Use totalRevenue from finance stats API (Rent + Sale - Expenses)
      const totalRevenue = financeStatsData.totalRevenue || 0

      // Calculate monthly revenue from transactions for display
      const monthlyRevenueFromTransactions = incomeTransactions
        .filter((txn) => txn.parsedDate >= startOfCurrentMonth && txn.parsedDate <= endOfCurrentMonth)
        .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

      const previousMonthRevenue = incomeTransactions
        .filter((txn) => txn.parsedDate >= startOfPreviousMonth && txn.parsedDate <= endOfPreviousMonth)
        .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

      const monthOverMonthChange =
        previousMonthRevenue > 0
          ? ((monthlyRevenueFromTransactions - previousMonthRevenue) / previousMonthRevenue) * 100
          : null

      const uniqueMonths = new Set(
        incomeTransactions.map(
          (txn) => `${txn.parsedDate.getFullYear()}-${txn.parsedDate.getMonth()}`,
        ),
      )
      // Calculate average based on total revenue and number of months
      const averageMonthlyRevenue =
        uniqueMonths.size > 0 ? totalRevenue / uniqueMonths.size : 0

      // Prepare trend data for the last 6 months (including current)
      const monthsBack = Array.from({ length: 6 }).map((_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

        const revenue = incomeTransactions
          .filter((txn) => txn.parsedDate >= monthStart && txn.parsedDate <= monthEnd)
          .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

        return {
          month: monthStart.toLocaleString("en-US", { month: "short" }),
          revenue,
          target: averageMonthlyRevenue || monthlyRevenueFromTransactions || financeStatsData.monthlyRevenue || 0,
        }
      })

      // Prepare breakdown by category
      const totalsByCategory = incomeTransactions.reduce<Record<string, number>>((acc, txn) => {
        const key = txn.category || "Uncategorized"
        acc[key] = (acc[key] || 0) + (Number(txn.amount) || 0)
        return acc
      }, {})

      const breakdown = Object.entries(totalsByCategory)
        .map(([source, amount]) => {
          const currentMonthAmount = incomeTransactions
            .filter(
              (txn) =>
                (txn.category || "Uncategorized") === source &&
                txn.parsedDate >= startOfCurrentMonth &&
                txn.parsedDate <= endOfCurrentMonth,
            )
            .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

          const previousMonthAmount = incomeTransactions
            .filter(
              (txn) =>
                (txn.category || "Uncategorized") === source &&
                txn.parsedDate >= startOfPreviousMonth &&
                txn.parsedDate <= endOfPreviousMonth,
            )
            .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

          let trend: "up" | "down" | "flat" = "flat"
          if (previousMonthAmount === 0 && currentMonthAmount > 0) {
            trend = "up"
          } else if (currentMonthAmount > previousMonthAmount) {
            trend = "up"
          } else if (currentMonthAmount < previousMonthAmount) {
            trend = "down"
          }

          return {
            source,
            amount,
            percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
            trend,
          }
        })
        .sort((a, b) => b.amount - a.amount)

      const recent = incomeTransactions
        .slice()
        .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())
        .slice(0, 12)
        .map((txn) => ({
          id: txn.id,
          date: txn.parsedDate.toISOString(),
          description: txn.description || "Income",
          category: txn.category || "Uncategorized",
          status: txn.status || "completed",
          amount: Number(txn.amount) || 0,
          property: txn.property || "",
        }))

      const resolvedMonthlyRevenue =
        monthlyRevenueFromTransactions || financeStatsData.monthlyRevenue || 0

      setSummary({
        totalRevenue,
        monthlyRevenue: resolvedMonthlyRevenue,
        averageMonthlyRevenue:
          averageMonthlyRevenue || financeStatsData.monthlyRevenue || 0,
        transactionCount: incomeTransactions.length,
        monthOverMonthChange,
      })
      setRevenueData(monthsBack)
      setRevenueBreakdown(breakdown)
      setRecentTransactions(recent)
    } catch (err: any) {
      console.error("Failed to fetch revenue data:", err)
      setError(err?.response?.data?.message || "Unable to load revenue data")
      setSummary({
        totalRevenue: 0,
        monthlyRevenue: 0,
        averageMonthlyRevenue: 0,
        transactionCount: 0,
        monthOverMonthChange: null,
      })
      setRevenueData([])
      setRevenueBreakdown([])
      setRecentTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = recentTransactions.filter((txn) => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true
    return (
      txn.description.toLowerCase().includes(query) ||
      txn.category.toLowerCase().includes(query) ||
      txn.id.toLowerCase().includes(query)
    )
  })

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Total Revenue Details</h1>
            <p className="text-muted-foreground mt-1">Complete breakdown of revenue streams and transactions</p>
          </div>
        </div>

        {/* Summary Cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-6">
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {formatCurrency(summary.totalRevenue)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {summary.transactionCount} transactions recorded
              </p>
            </Card>
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {formatCurrency(summary.monthlyRevenue)}
              </p>
              <div
                className={`flex items-center gap-1 mt-2 ${
                  (summary.monthOverMonthChange ?? 0) < 0 ? "text-destructive" : "text-success"
                }`}
              >
                {(summary.monthOverMonthChange ?? 0) < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
                <span className="text-sm font-medium">
                  {summary.monthOverMonthChange === null
                    ? "No prior month data"
                    : toPercentage(summary.monthOverMonthChange)}
                </span>
              </div>
            </Card>
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <p className="text-sm text-muted-foreground">Average / Month</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {formatCurrency(summary.averageMonthlyRevenue)}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Based on recorded revenue months
              </p>
            </Card>
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {summary.transactionCount.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Income entries captured
              </p>
            </Card>
          </div>
        )}

        {!loading && error && (
          <Card className="p-6 border-destructive/40 bg-destructive/5 text-destructive">
            {error}
          </Card>
        )}
        
        {/* Small Analytics Graphs */}
        <div className="grid gap-4 md:grid-cols-3">
          <MiniChartCard
            title="Revenue Trend"
            valuePrefix="Rs "
            value={summary.monthlyRevenue.toLocaleString() || "0"}
            data={revenueData}
            dataKey="revenue"
            chartType="area"
            colors={["#2563eb"]}
            loading={loading}
          />
          <MiniChartCard
            title="Category Average"
            valuePrefix="Rs "
            value={summary.averageMonthlyRevenue.toLocaleString() || "0"}
            data={revenueData.map(d => ({ ...d, avg: d.target }))}
            dataKey="avg"
            chartType="line"
            colors={["#10b981"]}
            loading={loading}
          />
          <MiniChartCard
            title="Top Sources"
            value=""
            hideValue
            data={revenueBreakdown.slice(0, 4).map(d => ({ name: d.source, value: d.amount }))}
            dataKey="value"
            nameKey="name"
            chartType="donut"
            colors={["#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6"]}
            loading={loading}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} name="Revenue" />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Average"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="source"
                  stroke="var(--muted-foreground)"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="amount" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Revenue Breakdown Table */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Breakdown by Source</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Revenue Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No revenue data available
                  </TableCell>
                </TableRow>
              ) : (
                revenueBreakdown.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.source}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.percentage.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {item.trend === "up" ? (
                        <div className="flex items-center gap-1 text-success">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm">Increasing</span>
                        </div>
                      ) : item.trend === "down" ? (
                        <div className="flex items-center gap-1 text-destructive">
                          <TrendingDown className="h-4 w-4" />
                          <span className="text-sm">Decreasing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="text-sm">Stable</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Recent Transactions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No income transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="font-medium">{txn.id}</TableCell>
                      <TableCell>
                        {new Date(txn.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{txn.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={txn.status === "completed" ? "default" : "secondary"}>
                          {txn.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(txn.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
