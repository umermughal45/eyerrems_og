"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, TrendingUp, TrendingDown, DollarSign, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { apiService } from "@/lib/api"
import { cn } from "@/lib/utils"

type NormalizedSale = {
  id: string
  property: string
  type: string
  date: Date | null
  value: number
  raw: any
}

type TrendPoint = {
  month: string
  value: number
}

const formatCurrency = (value: number) => {
  const numeric = Number.isFinite(value) ? value : 0
  return `Rs ${numeric.toLocaleString("en-IN", {
    maximumFractionDigits: numeric < 1000 ? 0 : 2,
  })}`
}

const formatPercent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`

export default function SalesValuePage() {
  const router = useRouter()
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true)
        setError(null)
        const response: any = await apiService.sales.getAll()
        const data = response?.data?.data || response?.data || []
        setSales(Array.isArray(data) ? data : [])
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.response?.data?.error || "Unable to load sales data")
        setSales([])
      } finally {
        setLoading(false)
      }
    }

    fetchSales()
  }, [])

  const normalizedSales = useMemo<NormalizedSale[]>(() => {
    if (!Array.isArray(sales)) return []

    return sales
      .filter((sale: any) => {
        const status = (sale?.status || "").toLowerCase()
        // Only include completed sales; if status is missing, include by default
        return !status || status === "completed"
      })
      .map((sale: any, index: number) => {
        const propertyName =
          sale?.property?.name || sale?.propertyName || sale?.property_title || sale?.property || "N/A"
        const propertyType =
          sale?.property?.type || sale?.type || sale?.propertyType || sale?.property_type || "—"
        const rawDate = sale?.saleDate || sale?.closedAt || sale?.createdAt || sale?.updatedAt || null
        const parsedDate = rawDate ? new Date(rawDate) : null
        const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null
        const numericValueRaw = sale?.saleValue ?? sale?.value ?? sale?.amount ?? 0
        const numericValue = Number(numericValueRaw)

        return {
          id: String(sale?.id ?? `${propertyName}-${index}`),
          property: propertyName,
          type: propertyType,
          date: validDate,
          value: Number.isFinite(numericValue) ? numericValue : 0,
          raw: sale,
        }
      })
  }, [sales])

  const metrics = useMemo(() => {
    if (!normalizedSales.length) {
      return {
        totalSalesValue: 0,
        averageSaleValue: 0,
        highestSale: null as NormalizedSale | null,
        lowestSale: null as NormalizedSale | null,
        trendData: Array.from({ length: 6 }).map((_, index) => ({
          month: new Date(new Date().getFullYear(), new Date().getMonth() - (5 - index), 1).toLocaleString(
            "en-US",
            { month: "short" }
          ),
          value: 0,
        })),
        changePercent: null as number | null,
      }
    }

    const positiveSales = normalizedSales.filter((sale) => sale.value > 0)
    const totalSalesValue = positiveSales.reduce((sum, sale) => sum + sale.value, 0)
    const averageSaleValue = positiveSales.length ? totalSalesValue / positiveSales.length : 0
    const highestSale =
      positiveSales.length > 0
        ? positiveSales.reduce((prev, current) => (current.value > prev.value ? current : prev))
        : null
    const lowestSale =
      positiveSales.length > 0
        ? positiveSales.reduce((prev, current) => (current.value < prev.value ? current : prev))
        : null

    const now = new Date()
    const trendData: TrendPoint[] = Array.from({ length: 6 }).map((_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthlyTotal = positiveSales
        .filter((sale) => sale.date && sale.date >= monthStart && sale.date <= monthEnd)
        .reduce((sum, sale) => sum + sale.value, 0)
      return {
        month: monthStart.toLocaleString("en-US", { month: "short" }),
        value: Number(monthlyTotal.toFixed(2)),
      }
    })

    const currentMonthValue = trendData[trendData.length - 1]?.value ?? 0
    const previousMonthValue = trendData[trendData.length - 2]?.value ?? 0
    const changePercent =
      previousMonthValue > 0 ? ((currentMonthValue - previousMonthValue) / previousMonthValue) * 100 : null

    return {
      totalSalesValue,
      averageSaleValue,
      highestSale,
      lowestSale,
      trendData,
      changePercent,
    }
  }, [normalizedSales])

  const filteredSales = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const sorted = [...normalizedSales].sort((a, b) => {
      const aTime = a.date ? a.date.getTime() : 0
      const bTime = b.date ? b.date.getTime() : 0
      return bTime - aTime
    })

    if (!query) {
      return sorted
    }

    return sorted.filter((sale) => {
      const propertyMatch = sale.property.toLowerCase().includes(query)
      const typeMatch = sale.type.toLowerCase().includes(query)
      const dateMatch = sale.date
        ? sale.date.toLocaleDateString().toLowerCase().includes(query) ||
          sale.date.toLocaleString("en-US", { month: "short" }).toLowerCase().includes(query)
        : false
      return propertyMatch || typeMatch || dateMatch
    })
  }, [normalizedSales, searchQuery])

  const changePercent = metrics.changePercent
  const changeIsPositive = typeof changePercent === "number" && changePercent >= 0

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Sales Value Analysis</h1>
            <p className="text-muted-foreground mt-1">Track total value of property sales</p>
          </div>
        </div>

        {error && !loading && (
          <Card className="p-4 border-destructive/40 bg-destructive/5 text-destructive text-sm">{error}</Card>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Sales Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatCurrency(metrics.totalSalesValue)}
            </p>
            <div
              className={cn(
                "flex items-center gap-1 mt-2 text-sm font-medium",
                typeof changePercent === "number"
                  ? changeIsPositive
                    ? "text-success"
                    : "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {typeof changePercent === "number" ? (
                changeIsPositive ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )
              ) : (
                <TrendingUp className="h-4 w-4 opacity-50" />
              )}
              <span>
                {typeof changePercent === "number" ? `${formatPercent(changePercent)} vs last month` : "No prior month data"}
              </span>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Average Sale Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : formatCurrency(metrics.averageSaleValue)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Per transaction</p>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Highest Sale</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : metrics.highestSale ? (
                formatCurrency(metrics.highestSale.value)
              ) : (
                "—"
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {metrics.highestSale?.property || (loading ? "Loading..." : "No data")}
            </p>
          </Card>

  <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Lowest Sale</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : metrics.lowestSale ? (
                formatCurrency(metrics.lowestSale.value)
              ) : (
                "—"
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {metrics.lowestSale?.property || (loading ? "Loading..." : "No data")}
            </p>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Sales Value Trend</h3>
          {loading ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), "Sales"]}
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ fill: "#2563eb" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h3 className="text-lg font-semibold">Sales by Value</h3>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sales..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No sales found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.property}</TableCell>
                    <TableCell>{sale.type}</TableCell>
                    <TableCell>{sale.date ? sale.date.toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(sale.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
