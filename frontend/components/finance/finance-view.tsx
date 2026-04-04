"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, TrendingDown, Plus, Receipt, Percent, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { TransactionsView } from "./transactions-view"
import { InvoicesView } from "./invoices-view"
import { PaymentsView } from "./payments-view"
import { FinancialReportsView } from "./financial-reports-view"
import { CommissionsView } from "./commissions-view"
import { AccountingView } from "./accounting-view"
import { ChartOfAccountsView } from "./chart-of-accounts-view"
import { OperationsView } from "./operations-view"
import { AccountLedgerModule } from "./account-ledger-module"
import { AddTransactionDialog } from "./add-transaction-dialog"
import { cn } from "@/lib/utils"
import { MiniChartCard } from "@/components/ui/mini-chart-card"
import { useAuth } from "@/lib/auth-context"
import { hasPermission } from "@/lib/permissions"

export function FinanceView({ initialData }: { initialData?: any }) {
  const { user } = useAuth()
  const canCreate = hasPermission(user?.permissions, user?.isSuperAdmin, user?.role, "finance", "create")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [financialStats, setFinancialStats] = useState<any[]>(() => {
    if (!initialData) return []
    const data = initialData
    
    const formatCurrency = (amount: number | null | undefined) => {
      const numericValue = Number(amount || 0)
      return `Rs ${numericValue.toLocaleString("en-IN", {
        minimumFractionDigits: numericValue % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })}`
    }

    const formatPercentage = (value: number | null | undefined) => {
      if (value === null || value === undefined) return "—"
      const rounded = Number.isFinite(value) ? Number(value.toFixed(1)) : value
      if (!Number.isFinite(rounded)) return "—"
      const sign = rounded > 0 ? "+" : ""
      return `${sign}${rounded}%`
    }

    const getChangeType = (value: number | null | undefined, invert = false) => {
      if (value === null || value === undefined || !Number.isFinite(value)) return "positive"
      const effectiveValue = invert ? -value : value
      return effectiveValue >= 0 ? "positive" : "negative"
    }

    return [
      {
        name: "Total Revenue",
        value: formatCurrency(data.totalRevenue),
        change: formatPercentage(data.revenueChangePercent),
        changeType: getChangeType(data.revenueChangePercent),
        icon: DollarSign,
        gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
        href: "/details/revenue",
      },
      {
        name: "Outstanding Payments",
        value: formatCurrency(data.outstandingPayments),
        change: formatPercentage(data.paymentsChangePercent),
        changeType: getChangeType(data.paymentsChangePercent, true),
        icon: Receipt,
        gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
        href: "/details/outstanding-payments",
      },
      {
        name: "Monthly Expenses",
        value: formatCurrency(data.monthlyExpenses),
        change: formatPercentage(data.expensesChangePercent),
        changeType: getChangeType(data.expensesChangePercent, true),
        icon: TrendingDown,
        gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
        href: "/details/expenses",
      },
      {
        name: "Dealer Commissions",
        value: formatCurrency(data.dealerCommissions),
        change: formatPercentage(data.commissionsChangePercent),
        changeType: getChangeType(data.commissionsChangePercent),
        icon: Percent,
        gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
        href: "/details/commissions",
      },
    ]
  })
  const [statsLoading, setStatsLoading] = useState(!initialData)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [incomeVsExpenseData, setIncomeVsExpenseData] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.financeTrendData || []
  })
  const [cashFlowData, setCashFlowData] = useState<any[]>(() => {
    if (!initialData) return []
    return (initialData.financeTrendData || []).map((d: any) => ({
      month: d.month,
      cash: d.profit || d.cash || (d.income - d.expense)
    }))
  })
  const [outstandingTrendData, setOutstandingTrendData] = useState<any[]>(() => {
    if (!initialData) return []
    return Array.from({ length: 6 }).map((_, i) => ({
      month: `M${i + 1}`,
      amount: i === 5 ? (initialData.outstandingPayments || 0) : 0
    }))
  })
  const [activeTab, setActiveTabState] = useState("transactions")
  const [hasInitializedTab, setHasInitializedTab] = useState(false)
  const tabStorageKey = "finance-active-tab"

  const updateActiveTab = useCallback(
    (value: string, { shouldPersistQuery = true }: { shouldPersistQuery?: boolean } = {}) => {
      if (value !== activeTab) {
        setActiveTabState(value)
      }

      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(tabStorageKey, value)
        } catch {
          // Ignore storage errors (private mode, etc.)
        }
      }

      if (shouldPersistQuery) {
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", value)
        const query = params.toString()
        router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
      }
    },
    [activeTab, pathname, router, searchParams, tabStorageKey],
  )

  useEffect(() => {
    const tabFromQuery = searchParams.get("tab")
    if (tabFromQuery && tabFromQuery !== activeTab) {
      updateActiveTab(tabFromQuery, { shouldPersistQuery: false })
      if (!hasInitializedTab) {
        setHasInitializedTab(true)
      }
      return
    }

    if (!hasInitializedTab) {
      let storedTab: string | null = null
      if (typeof window !== "undefined") {
        try {
          storedTab = sessionStorage.getItem(tabStorageKey)
        } catch {
          storedTab = null
        }
      }

      if (storedTab && storedTab !== activeTab) {
        updateActiveTab(storedTab)
      } else if (!tabFromQuery) {
        updateActiveTab(activeTab)
      }

      setHasInitializedTab(true)
    }
  }, [activeTab, hasInitializedTab, searchParams, updateActiveTab])

  const handleTabChange = useCallback(
    (value: string) => {
      updateActiveTab(value)
    },
    [updateActiveTab],
  )

  useEffect(() => {
    if (!initialData) {
      fetchFinanceStats()
    }
  }, [initialData])

  const formatCurrency = (amount: number | null | undefined) => {
    const numericValue = Number(amount || 0)
    return `Rs ${numericValue.toLocaleString("en-IN", {
      minimumFractionDigits: numericValue % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return "—"
    }
    const rounded = Number.isFinite(value) ? Number(value.toFixed(1)) : value
    if (!Number.isFinite(rounded)) {
      return "—"
    }
    const sign = rounded > 0 ? "+" : ""
    return `${sign}${rounded}%`
  }

  const getChangeType = (value: number | null | undefined, invert = false) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "positive"
    }
    const effectiveValue = invert ? -value : value
    return effectiveValue >= 0 ? "positive" : "negative"
  }

  const fetchFinanceStats = async () => {
    try {
      setStatsLoading(true)
      setStatsError(null)
      const response: any = await apiService.stats.getFinanceStats()
      const data = response?.data?.data || response?.data || {}

      // Real data from backend for mini charts
      const financeTrendData = data.financeTrendData || [];
      const generatedIEData = financeTrendData.length > 0 ? financeTrendData : Array.from({ length: 6 }).map((_, i) => ({
        month: `M${i + 1}`,
        income: 0,
        expense: 0,
        cash: 0
      }));
      setIncomeVsExpenseData(generatedIEData)

      setCashFlowData(generatedIEData.map((d: any) => ({
        month: d.month,
        cash: d.cash || (d.income - d.expense)
      })))

      setOutstandingTrendData(Array.from({ length: 6 }).map((_, i) => ({
        month: `M${i + 1}`,
        amount: i === 5 ? (data.outstandingPayments || 0) : 0
      })))

      setFinancialStats([
        {
          name: "Total Revenue",
          value: formatCurrency(data.totalRevenue),
          change: formatPercentage(data.revenueChangePercent),
          changeType: getChangeType(data.revenueChangePercent),
          icon: DollarSign,
          gradient: "bg-[linear-gradient(135deg,#22c55e,#15803d)]",
          href: "/details/revenue",
        },
        {
          name: "Outstanding Payments",
          value: formatCurrency(data.outstandingPayments),
          change: formatPercentage(data.paymentsChangePercent),
          changeType: getChangeType(data.paymentsChangePercent, true),
          icon: Receipt,
          gradient: "bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)]",
          href: "/details/outstanding-payments",
        },
        {
          name: "Monthly Expenses",
          value: formatCurrency(data.monthlyExpenses),
          change: formatPercentage(data.expensesChangePercent),
          changeType: getChangeType(data.expensesChangePercent, true),
          icon: TrendingDown,
          gradient: "bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)]",
          href: "/details/expenses",
        },
        {
          name: "Dealer Commissions",
          value: formatCurrency(data.dealerCommissions),
          change: formatPercentage(data.commissionsChangePercent),
          changeType: getChangeType(data.commissionsChangePercent),
          icon: Percent,
          gradient: "bg-[linear-gradient(135deg,#f59e0b,#b45309)]",
          href: "/details/commissions",
        },
      ])
    } catch (err: any) {
      // Don't log timeout errors to reduce console noise
      if (err.code !== 'ECONNABORTED' && !err.message?.includes('timeout')) {
        console.error("Failed to fetch finance stats:", err)
      }
      setFinancialStats([])
      setStatsError(null) // Don't show error message for timeouts, just show empty state
    } finally {
      setStatsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-balance">Financial Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Track revenue, expenses, invoices, payments, and commissions</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {canCreate && (
            <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Transaction</span>
              <span className="sm:hidden">New</span>
            </Button>
          )}
        </div>
      </div>

      {/* Financial Stats */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {statsError && (
            <Card className="border-destructive/40 bg-destructive/10 text-destructive">
              <div className="p-4 text-sm">{statsError}</div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {financialStats.length === 0 ? (
              <Card className="p-6 text-sm text-muted-foreground">
                Unable to display summary metrics right now.
              </Card>
            ) : (
              financialStats.map((stat) => (
                <Card
                  key={stat.name}
                  className={cn(
                    "group relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] cursor-pointer p-0",
                  )}
                  onClick={() => router.push(stat.href)}
                >
                  <div className="relative p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 bg-gradient-to-br",
                        stat.gradient
                      )}>
                        <stat.icon className="h-6 w-6" />
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 shadow-sm",
                          stat.changeType === "positive" 
                            ? "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 dark:ring-emerald-500/30" 
                            : "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-900/40 dark:text-rose-400 dark:ring-rose-500/30",
                        )}
                      >
                        {stat.change}
                      </span>
                    </div>
                    <div className="mt-6">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.name}</p>
                      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Mini Charts Row */}
          <div className="grid gap-4 md:grid-cols-3">
            <MiniChartCard
              title="Income Trend"
              value={incomeVsExpenseData.length > 0 ? incomeVsExpenseData[5]?.income : 0}
              valuePrefix="Rs "
              data={incomeVsExpenseData}
              dataKey="income"
              chartType="bar"
              colors={["#10b981"]}
              trend={{ value: 8.4 }}
            />
            <MiniChartCard
              title="Monthly Cash Flow"
              value={cashFlowData.length > 0 ? cashFlowData[5]?.cash : 0}
              valuePrefix="Rs "
              data={cashFlowData}
              dataKey="cash"
              chartType="area"
              colors={["#3b82f6"]}
              trend={{ value: 12.4 }}
            />
            <MiniChartCard
              title="Outstanding Trend"
              value={outstandingTrendData.length > 0 ? outstandingTrendData[5]?.amount : 0}
              valuePrefix="Rs "
              data={outstandingTrendData}
              dataKey="amount"
              chartType="line"
              colors={["#f59e0b"]}
              trend={{ value: -5.2 }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex min-w-full sm:min-w-0">
            <TabsTrigger value="transactions" className="text-xs sm:text-sm">Transactions</TabsTrigger>
            <TabsTrigger value="invoices" className="text-xs sm:text-sm">Invoices</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs sm:text-sm">Payments</TabsTrigger>
            <TabsTrigger value="commissions" className="text-xs sm:text-sm">Commissions</TabsTrigger>
            <TabsTrigger value="chart-of-accounts" className="text-xs sm:text-sm">Chart of Accounts</TabsTrigger>
            <TabsTrigger value="accounting" className="text-xs sm:text-sm">Accounting</TabsTrigger>
            <TabsTrigger value="operations" className="text-xs sm:text-sm">Operations</TabsTrigger>
            <TabsTrigger value="account-ledger" className="text-xs sm:text-sm">Account Ledger</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="transactions">
          <TransactionsView />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesView />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsView />
        </TabsContent>

        <TabsContent value="commissions">
          <CommissionsView />
        </TabsContent>

        <TabsContent value="chart-of-accounts">
          <ChartOfAccountsView />
        </TabsContent>

        <TabsContent value="accounting">
          <AccountingView />
        </TabsContent>

        <TabsContent value="operations">
          <OperationsView highlightedRequestId={searchParams.get("requestId") || undefined} />
        </TabsContent>

        <TabsContent value="account-ledger">
          <AccountLedgerModule />
        </TabsContent>

        <TabsContent value="reports">
          <FinancialReportsView />
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <AddTransactionDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  )
}
