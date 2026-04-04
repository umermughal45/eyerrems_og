"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, TrendingUp, Star, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { apiService } from "@/lib/api"

type DealerRecord = any

export default function DealersPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [dealers, setDealers] = useState<DealerRecord[]>([])
  const [deals, setDeals] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [dealersRes, dealsRes, commissionsRes] = await Promise.all([
          apiService.dealers.getAll(),
          apiService.deals.getAll(),
          apiService.commissions.getAll(),
        ])

        setDealers(Array.isArray(dealersRes.data) ? dealersRes.data : [])
        setDeals(Array.isArray(dealsRes.data) ? dealsRes.data : [])
        setCommissions(Array.isArray(commissionsRes.data) ? commissionsRes.data : [])
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to fetch dealer data")
        setDealers([])
        setDeals([])
        setCommissions([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const commissionByDealer = useMemo(() => {
    return commissions.reduce<Record<string, number>>((acc, commission) => {
      const dealerId = commission.dealerId || commission.dealer?.id
      if (!dealerId) return acc
      const amount = typeof commission.amount === "number" ? commission.amount : Number(commission.amount) || 0
      acc[dealerId] = (acc[dealerId] || 0) + amount
      return acc
    }, {})
  }, [commissions])

  const dealsByDealer = useMemo(() => {
    return deals.reduce<Record<string, { totalValue: number; count: number }>>((acc, deal) => {
      const dealerId = deal.dealerId || deal.dealer?.id
      if (!dealerId) return acc
      const value = typeof deal.dealAmount === "number" ? deal.dealAmount : Number(deal.dealAmount) || 0
      if (!acc[dealerId]) {
        acc[dealerId] = { totalValue: 0, count: 0 }
      }
      acc[dealerId].totalValue += value
      acc[dealerId].count += 1
      return acc
    }, {})
  }, [deals])

  const enrichedDealers = useMemo(() => {
    return dealers.map((dealer) => {
      const dealsStats = dealsByDealer[dealer.id] || { totalValue: 0, count: 0 }
      const commissionTotal = commissionByDealer[dealer.id] || 0
      const rating = typeof dealer.rating === "number" ? dealer.rating : null

      return {
        ...dealer,
        totalDealValue: dealsStats.totalValue,
        totalDeals: dealsStats.count,
        totalCommission: commissionTotal,
        rating,
      }
    })
  }, [dealers, dealsByDealer, commissionByDealer])

  const filteredDealers = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return enrichedDealers.filter((dealer) => {
      return (
        (dealer.name || "").toLowerCase().includes(query) ||
        (dealer.email || "").toLowerCase().includes(query) ||
        (dealer.phone || "").toLowerCase().includes(query) ||
        (dealer.company || "").toLowerCase().includes(query)
      )
    })
  }, [enrichedDealers, searchQuery])

  const { totalDealers, totalSales, totalCommission, averageRating } = useMemo(() => {
    const total = enrichedDealers.length
    const salesCount = enrichedDealers.reduce((sum, dealer) => sum + (dealer.totalDeals || 0), 0)
    const commissionSum = enrichedDealers.reduce((sum, dealer) => sum + (dealer.totalCommission || 0), 0)
    const ratings = enrichedDealers.map((dealer) => dealer.rating).filter((rating) => typeof rating === "number")
    const avgRating = ratings.length === 0 ? null : ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length

    return {
      totalDealers: total,
      totalSales: salesCount,
      totalCommission: commissionSum,
      averageRating: avgRating,
    }
  }, [enrichedDealers])

  const topPerformers = useMemo(() => {
    return [...enrichedDealers]
      .sort((a, b) => (b.totalCommission || 0) - (a.totalCommission || 0))
      .slice(0, 5)
      .map((dealer) => ({
        name: dealer.name,
        commission: dealer.totalCommission || 0,
      }))
  }, [enrichedDealers])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Active Dealers</h1>
            <p className="text-muted-foreground mt-1">Performance overview of all active dealers</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Dealers</p>
            <p className="text-3xl font-bold text-foreground mt-2">{totalDealers}</p>
            <div className="flex items-center gap-1 mt-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>{new Date().toLocaleDateString()}</span>
            </div>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Deals</p>
            <p className="text-3xl font-bold text-foreground mt-2">{totalSales}</p>
            <p className="text-sm text-muted-foreground mt-2">Across all dealers</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Commission</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {totalCommission === 0 ? "$0" : `$${totalCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Sum of recorded commissions</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Average Rating</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {averageRating === null ? "—" : averageRating.toFixed(1)}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Out of 5.0</span>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performers by Commission</h3>
          {topPerformers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No commission data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topPerformers}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, "Commission"]}
                />
                <Bar dataKey="commission" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
            <h3 className="text-lg font-semibold">All Active Dealers</h3>
            <div className="relative w-full lg:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search dealers..."
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
          ) : filteredDealers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No dealers found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dealer Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDealers.map((dealer) => (
                  <TableRow key={dealer.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase">
                          {(dealer.name || "D")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p>{dealer.name}</p>
                          {typeof dealer.rating === "number" && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                              <span>{dealer.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{dealer.company || "—"}</TableCell>
                    <TableCell>{dealer.email || "—"}</TableCell>
                    <TableCell>{dealer.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{dealer.totalDeals ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {dealer.totalCommission && dealer.totalCommission > 0
                        ? `$${dealer.totalCommission.toLocaleString()}`
                        : "$0"}
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
