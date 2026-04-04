"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, TrendingUp, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { apiService } from "@/lib/api"

type DealRecord = any

export default function DealsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiService.deals.getAll()
        setDeals(Array.isArray(response.data) ? response.data : [])
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to fetch deals")
        setDeals([])
      } finally {
        setLoading(false)
      }
    }

    fetchDeals()
  }, [])

  const filteredDeals = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return deals.filter((deal) => {
      const titleMatch = (deal.title || "").toLowerCase().includes(query)
      const clientMatch = (deal.client?.name || "").toLowerCase().includes(query)
      const dealerMatch = (deal.dealer?.name || "").toLowerCase().includes(query)
      return titleMatch || clientMatch || dealerMatch
    })
  }, [deals, searchQuery])

  const {
    totalDeals,
    totalValue,
    averageValue,
    winRate,
    stageDistribution,
    topDeals,
  } = useMemo(() => {
    const total = deals.length
    const value = deals.reduce(
      (sum, deal) => sum + (typeof deal.dealAmount === "number" ? deal.dealAmount : Number(deal.dealAmount) || 0),
      0,
    )
    const average = total === 0 ? 0 : value / total

    const winStages = ["closed-won", "won"]
    const wins = deals.filter((deal) =>
      winStages.includes((deal.stage || "").toLowerCase()),
    ).length
    const winRateValue = total === 0 ? 0 : (wins / total) * 100

    const stageMap = deals.reduce<Record<string, number>>((acc, deal) => {
      const stage = (deal.stage || "unknown").toLowerCase()
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})

    const stageColors = [
      "#2563eb",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ef4444",
      "#94a3b8",
      "#0ea5e9",
    ]

    const stageData = Object.entries(stageMap).map(([stage, count], index) => ({
      name: stage.replace(/-/g, " "),
      value: count,
      color: stageColors[index % stageColors.length],
    }))

    const topDealsByValue = [...deals]
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 5)
      .map((deal) => ({
        title: deal.title,
        client: deal.client?.name,
        value: typeof deal.dealAmount === "number" ? deal.dealAmount : Number(deal.dealAmount) || 0,
      }))

    return {
      totalDeals: total,
      totalValue: value,
      averageValue: average,
      winRate: winRateValue,
      stageDistribution: stageData,
      topDeals: topDealsByValue,
    }
  }, [deals])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Deals in Pipeline</h1>
            <p className="text-muted-foreground mt-1">Track all active deals and their progress</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-3xl font-bold text-foreground mt-2">{totalDeals}</p>
            <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Deal Value</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {totalValue === 0 ? "Rs 0" : `Rs ${totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Current pipeline value</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Average Deal Size</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {averageValue === 0 ? "$0" : `$${averageValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Across all deals</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-3xl font-bold text-foreground mt-2">{winRate.toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground mt-2">Closed-won deals</p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Deals by Stage</h3>
            {stageDistribution.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deal data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stageDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {stageDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Deals by Value</h3>
            {topDeals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No deal data available yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topDeals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="title" stroke="var(--muted-foreground)" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Value"]}
                    labelFormatter={(label: any, payload: any) => {
                      const item = topDeals.find((deal) => deal.title === label)
                      return item?.client ? `${label} (${item.client})` : label
                    }}
                  />
                  <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
            <h3 className="text-lg font-semibold">All Deals</h3>
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search deals..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No deals found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deal Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Dealer</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => (
                  <TableRow 
                    key={deal.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/details/deals/${deal.id}`)}
                  >
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell>{deal.client?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {(deal.stage || "unknown").replace(/-/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{deal.dealer?.name || "—"}</TableCell>
                    <TableCell>
                      {deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {deal.dealAmount ? `$${Number(deal.dealAmount).toLocaleString()}` : "$0"}
                    </TableCell>
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
