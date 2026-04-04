"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Search, TrendingDown, Calendar, DollarSign, Loader2 } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { apiService } from "@/lib/api"

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6b7280"]

type ExpenseTransaction = {
  id: string
  description: string
  category: string
  amount: number
  date: string
  property?: string
  status: string
}

type ExpenseMetrics = {
  totalExpenses: number
  currentMonthExpenses: number
  averageMonthlyExpenses: number
  pendingAmount: number
}

type CategoryBreakdown = {
  category: string
  amount: number
  percentage: number
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

export default function ExpensesDetailPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([])
  const [metrics, setMetrics] = useState<ExpenseMetrics>({
    totalExpenses: 0,
    currentMonthExpenses: 0,
    averageMonthlyExpenses: 0,
    pendingAmount: 0,
  })
  const [trendData, setTrendData] = useState<{ month: string; amount: number }[]>([])
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([])

  useEffect(() => {
    fetchExpenses()
  }, [])

  const fetchExpenses = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiService.transactions.getAll()
      const data = Array.isArray((response as any)?.data?.data)
        ? (response as any).data.data
        : Array.isArray((response as any)?.data)
          ? (response as any).data
          : []

      const expenseTransactions = data
        .filter((txn: any) => (txn?.type || "").toLowerCase() === "expense")
        .map((txn: any) => {
          const dateString = txn.date || txn.createdAt
          const parsedDate = dateString ? new Date(dateString) : null
          if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
            return null
          }

          return {
            id: txn.id,
            description: txn.description || "Expense",
            category: txn.category || "General",
            amount: Number(txn.amount) || 0,
            date: parsedDate.toISOString(),
            property: txn.property || "",
            status: (txn.status || "completed").toLowerCase(),
            parsedDate,
          }
        })
        .filter(Boolean) as Array<ExpenseTransaction & { parsedDate: Date }>

      const totalExpenses = expenseTransactions.reduce(
        (sum, txn) => sum + (Number(txn.amount) || 0),
        0,
      )

      const now = new Date()
      const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

      const currentMonthExpenses = expenseTransactions
        .filter((txn) => txn.parsedDate >= startOfCurrentMonth && txn.parsedDate <= endOfCurrentMonth)
        .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

      const uniqueMonths = new Set(
        expenseTransactions.map(
          (txn) => `${txn.parsedDate.getFullYear()}-${txn.parsedDate.getMonth()}`,
        ),
      )

      const averageMonthlyExpenses =
        uniqueMonths.size > 0 ? totalExpenses / uniqueMonths.size : 0

      const pendingAmount = expenseTransactions
        .filter((txn) => txn.status !== "completed")
        .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

      // Trend data for last six months
      const monthsBack = Array.from({ length: 6 }).map((_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

        const amount = expenseTransactions
          .filter((txn) => txn.parsedDate >= monthStart && txn.parsedDate <= monthEnd)
          .reduce((sum, txn) => sum + (Number(txn.amount) || 0), 0)

        return {
          month: monthStart.toLocaleString("en-US", { month: "short" }),
          amount,
        }
      })

      const totalsByCategory = expenseTransactions.reduce<Record<string, number>>((acc, txn) => {
        const key = txn.category || "General"
        acc[key] = (acc[key] || 0) + (Number(txn.amount) || 0)
        return acc
      }, {})

      const categoryBreakdown = Object.entries(totalsByCategory)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount)

      setExpenses(
        expenseTransactions
          .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())
          .map(({ parsedDate, ...txn }) => txn),
      )
      setMetrics({
        totalExpenses,
        currentMonthExpenses,
        averageMonthlyExpenses,
        pendingAmount,
      })
      setTrendData(monthsBack)
      setCategoryData(categoryBreakdown)
    } catch (err: any) {
      console.error("Failed to fetch expenses:", err)
      setError(err?.response?.data?.message || "Unable to load expenses")
      setExpenses([])
      setMetrics({
        totalExpenses: 0,
        currentMonthExpenses: 0,
        averageMonthlyExpenses: 0,
        pendingAmount: 0,
      })
      setTrendData([])
      setCategoryData([])
    } finally {
      setLoading(false)
    }
  }

  const filteredExpenses = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase()
    return expenses.filter((expense) => {
      const matchesSearch =
        expense.description.toLowerCase().includes(searchLower) ||
        expense.category.toLowerCase().includes(searchLower) ||
        (expense.property || "").toLowerCase().includes(searchLower)
      const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [expenses, searchQuery, categoryFilter])

  const categoryOptions = useMemo(() => {
    const options = Array.from(new Set(expenses.map((expense) => expense.category))).sort()
    return options
  }, [expenses])

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monthly Expenses Details</h1>
          <p className="text-muted-foreground mt-1">Complete breakdown of all expenses</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">All recorded expense transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.currentMonthExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Updated {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Monthly</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.averageMonthlyExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all months with data</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.pendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
          </CardContent>
        </Card>
      </div>

      {!loading && error && (
        <Card>
          <CardContent className="py-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" name="Expenses" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props: any) => {
                    const category = props.payload?.category || props.category || '';
                    const percent = props.percent || 0;
                    return `${category} ${(percent * 100).toFixed(1)}%`;
                  }}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), "Amount"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense data available</p>
            ) : (
              categoryData.map((category) => (
                <div key={category.category} className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="font-medium min-w-[120px]">{category.category}</div>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${category.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right min-w-[120px]">
                    <div className="font-bold">{formatCurrency(category.amount)}</div>
                    <div className="text-sm text-muted-foreground">
                      {category.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No expenses found
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.id}</TableCell>
                    <TableCell>
                      {new Date(expense.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{expense.category}</Badge>
                    </TableCell>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell>{expense.property || "—"}</TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expense.status === "completed" ? "default" : "secondary"}>
                        {expense.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
