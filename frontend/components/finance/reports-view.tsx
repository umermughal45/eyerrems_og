"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { TrendingUp, DollarSign } from "lucide-react"
import { apiService } from "@/lib/api"

type MonthRow = { month: string; revenue: number; expenses: number }
type CategoryRow = { category: string; amount: number }

function getMonthLabel(index: number) {
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][index]
}

export function ReportsView() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const txRes = await apiService.transactions.getAll()
        const txData = txRes.data as any
        const transactionsData = Array.isArray(txData?.data) ? txData.data : Array.isArray(txData) ? txData : []
        setTransactions(transactionsData)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const currentYear = new Date().getFullYear()

  const revenueData: MonthRow[] = useMemo(() => {
    const rows: MonthRow[] = Array.from({ length: 12 }, (_, i) => ({
      month: getMonthLabel(i),
      revenue: 0,
      expenses: 0,
    }))
    transactions
      .filter((t) => {
        const d = new Date(t.date)
        return d.getFullYear() === currentYear
      })
      .forEach((t) => {
        const d = new Date(t.date)
        const m = d.getMonth()
        if (t.type === "income") {
          rows[m].revenue += Number(t.amount || 0)
        } else if (t.type === "expense") {
          rows[m].expenses += Number(t.amount || 0)
        }
      })
    return rows
  }, [transactions, currentYear])

  const categoryData: CategoryRow[] = useMemo(() => {
    const map = new Map<string, number>()
    transactions
      .filter((t) => {
        const d = new Date(t.date)
        return d.getFullYear() === currentYear && t.type === "expense"
      })
      .forEach((t) => {
        const key = t.category || "Other"
        map.set(key, (map.get(key) || 0) + Number(t.amount || 0))
      })
    return Array.from(map.entries()).map(([category, amount]) => ({ category, amount }))
  }, [transactions, currentYear])

  const { ytdRevenue, ytdExpenses } = useMemo(() => {
    let rev = 0
    let exp = 0
    transactions.forEach((t) => {
      const d = new Date(t.date)
      if (d.getFullYear() !== currentYear) return
      const amt = Number(t.amount || 0)
      if (t.type === "income") rev += amt
      if (t.type === "expense") exp += amt
    })
    return { ytdRevenue: rev, ytdExpenses: exp }
  }, [transactions, currentYear])

  const netProfit = ytdRevenue - ytdExpenses

  return (
    <div className="space-y-6">
      {/* Report Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground">Financial Reports</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Comprehensive financial analytics and insights</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">YTD Revenue</p>
              <p className="text-2xl font-bold text-foreground">Rs {ytdRevenue.toLocaleString("en-PK")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{loading ? "Loading..." : ""}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <DollarSign className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">YTD Expenses</p>
              <p className="text-2xl font-bold text-foreground">Rs {ytdExpenses.toLocaleString("en-PK")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{loading ? "Loading..." : ""}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Profit</p>
              <p className="text-2xl font-bold text-foreground">Rs {netProfit.toLocaleString("en-PK")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{loading ? "Loading..." : ""}</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue vs Expenses */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">Revenue vs Expenses</h3>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
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
              <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Expense by Category */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-foreground mb-4">Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="category" stroke="var(--muted-foreground)" />
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
    </div>
  )
}
