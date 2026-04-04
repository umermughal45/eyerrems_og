"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, TrendingUp, Percent, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { apiService } from "@/lib/api"

type CommissionRow = {
  id: string
  dealerName: string
  propertyName: string
  saleAmount: number
  rate: number
  amount: number
  status: string
  createdAt: string
}

type CommissionMetrics = {
  totalCommission: number
  averageRate: number
  totalSalesValue: number
  commissionCount: number
  completedCount: number
}

type DistributionSlice = {
  name: string
  value: number
}

const PIE_COLORS = ["#2563eb", "#10b981", "#f97316", "#6366f1", "#ec4899", "#14b8a6", "#8b5cf6"]

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

export default function CommissionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [metrics, setMetrics] = useState<CommissionMetrics>({
    totalCommission: 0,
    averageRate: 0,
    totalSalesValue: 0,
    commissionCount: 0,
    completedCount: 0,
  })
  const [distribution, setDistribution] = useState<DistributionSlice[]>([])

  useEffect(() => {
    fetchCommissionData()
  }, [])

  const fetchCommissionData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [commissionsResponse, dealersResponse, salesResponse] = await Promise.all([
        apiService.commissions.getAll(),
        apiService.dealers.getAll().catch((err) => {
          console.warn("Failed to fetch dealers:", err)
          return { data: [] }
        }),
        apiService.sales.getAll().catch((err) => {
          console.warn("Failed to fetch sales:", err)
          return { data: { data: [] } }
        }),
      ])

      const commissionsResponseTyped: any = commissionsResponse
      const rawCommissions = Array.isArray(commissionsResponseTyped?.data?.data)
        ? commissionsResponseTyped.data.data
        : Array.isArray(commissionsResponseTyped?.data)
          ? commissionsResponseTyped.data
          : []

      const dealersResponseTyped: any = dealersResponse
      const dealers = Array.isArray(dealersResponseTyped?.data?.data)
        ? dealersResponseTyped.data.data
        : Array.isArray(dealersResponseTyped?.data)
          ? dealersResponseTyped.data
          : []

      const salesResponseTyped: any = salesResponse
      const salesData = Array.isArray(salesResponseTyped?.data?.data)
        ? salesResponseTyped.data.data
        : Array.isArray(salesResponseTyped?.data)
          ? salesResponseTyped.data
          : Array.isArray(salesResponseTyped?.data?.data?.data)
            ? salesResponseTyped.data.data.data
            : []

      const dealersMap = new Map(
        dealers.map((dealer: any) => [dealer.id, dealer]),
      )

      const salesMap = new Map(
        salesData.map((sale: any) => [sale.id, sale]),
      )

      let totalCommissionAmount = 0
      let totalRate = 0
      let totalSalesValue = 0
      let completedCount = 0

      const commissionRows: CommissionRow[] = rawCommissions
        .map((commission: any) => {
          const dealer = dealersMap.get(commission.dealerId) as { name?: string } | undefined
          const sale: any = salesMap.get(commission.saleId)
          const saleStatus = sale?.status || "Pending"
          const saleAmount = Number(sale?.saleValue) || 0
          const commissionAmount = Number(commission.amount) || 0
          const rate = Number(commission.rate ?? sale?.commissionRate ?? sale?.commission ?? 0)

          totalCommissionAmount += commissionAmount
          totalRate += rate
          totalSalesValue += saleAmount
          if (saleStatus.toLowerCase() === "completed") {
            completedCount += 1
          }

          return {
            id: commission.id,
            dealerName: dealer?.name || "Unassigned Dealer",
            propertyName: sale?.property?.name || sale?.propertyName || "-",
            saleAmount,
            rate,
            amount: commissionAmount,
            status: saleStatus,
            createdAt: commission.createdAt || sale?.createdAt || new Date().toISOString(),
          }
        })
        .sort(
          (a: CommissionRow, b: CommissionRow) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )

      const averageRate =
        rawCommissions.length > 0 ? totalRate / rawCommissions.length : 0

      const distributionByDealer = commissionRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.dealerName] = (acc[row.dealerName] || 0) + row.amount
        return acc
      }, {})

      const distributionData = Object.entries(distributionByDealer)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)

      setCommissions(commissionRows)
      setMetrics({
        totalCommission: totalCommissionAmount,
        averageRate,
        totalSalesValue,
        commissionCount: commissionRows.length,
        completedCount,
      })
      setDistribution(distributionData)
    } catch (err: any) {
      console.error("Failed to fetch commissions:", err)
      setError(err?.response?.data?.message || "Unable to load commission data")
      setCommissions([])
      setMetrics({
        totalCommission: 0,
        averageRate: 0,
        totalSalesValue: 0,
        commissionCount: 0,
        completedCount: 0,
      })
      setDistribution([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCommissions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return commissions
    return commissions.filter(
      (commission) =>
        commission.dealerName.toLowerCase().includes(query) ||
        commission.propertyName.toLowerCase().includes(query) ||
        commission.status.toLowerCase().includes(query),
    )
  }, [commissions, searchQuery])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Commission Details</h1>
            <p className="text-muted-foreground mt-1">Track all sales commissions</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Percent className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Commission</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {formatCurrency(metrics.totalCommission)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Across {metrics.commissionCount} commission records
            </p>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Average Commission Rate</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {metrics.averageRate.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground mt-2">Weighted average across deals</p>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Linked Sales Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {formatCurrency(metrics.totalSalesValue)}
            </p>
            <div className="flex items-center gap-1 mt-2 text-success">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">
                {metrics.completedCount} completed {metrics.completedCount === 1 ? "sale" : "sales"}
              </span>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Commission Records</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {metrics.commissionCount.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Latest updated data</p>
          </Card>
        </div>

        {!loading && error && (
          <Card>
            <CardContent className="p-6 text-destructive">{error}</CardContent>
          </Card>
        )}

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Commission Distribution by Dealer</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => {
                  const { name, percent } = props;
                  return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
                }}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {distribution.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => [formatCurrency(value), "Commission"]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">All Commissions</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by dealer, property, or status..."
                className="pl-9"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dealer</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Sale Amount</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredCommissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No commission records found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCommissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">{commission.dealerName}</TableCell>
                    <TableCell>{commission.propertyName}</TableCell>
                    <TableCell>{formatCurrency(commission.saleAmount)}</TableCell>
                    <TableCell>{commission.rate.toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          commission.status.toLowerCase() === "completed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {commission.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(commission.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(commission.amount)}
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
