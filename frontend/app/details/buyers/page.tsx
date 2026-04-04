"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Mail, Phone, MapPin, DollarSign, Building, TrendingUp, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"

export default function BuyersDetailsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalBuyers: 0,
    activeBuyers: 0,
    totalSpent: 0,
    avgBudget: 0,
  })

  useEffect(() => {
    fetchBuyers()
  }, [])

  const fetchBuyers = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.buyers.getAll()
      const buyersData = response?.data?.data || response?.data || []
      setBuyers(Array.isArray(buyersData) ? buyersData : [])

      // Calculate stats
      const total = buyersData.length || 0
      const active = buyersData.filter((b: any) => b.buyStatus === "Completed" || b.buyStatus === "Pending").length || 0
      const totalSpent = buyersData.reduce((sum: number, b: any) => sum + (parseFloat(b.buyValue) || 0), 0)
      const avgBudget = total > 0 ? totalSpent / total : 0

      setStats({
        totalBuyers: total,
        activeBuyers: active,
        totalSpent: totalSpent,
        avgBudget: avgBudget,
      })
    } catch (err: any) {
      console.error("Failed to fetch buyers:", err)
      setBuyers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredBuyers = buyers.filter((buyer) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      buyer.name?.toLowerCase().includes(searchLower) ||
      buyer.contact?.toLowerCase().includes(searchLower) ||
      buyer.property?.name?.toLowerCase().includes(searchLower)
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
            <h1 className="text-3xl font-bold text-foreground">All Buyers</h1>
            <p className="text-muted-foreground">Complete buyer database and analytics</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Buyers</p>
                <p className="text-2xl font-bold text-foreground">{stats.totalBuyers}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Building className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Buyers</p>
                <p className="text-2xl font-bold text-foreground">{stats.activeBuyers}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Spent</p>
                <p className="text-2xl font-bold text-foreground">Rs {(stats.totalSpent / 1000000).toFixed(1)}M</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
          <Card className="p-4 stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Budget</p>
                <p className="text-2xl font-bold text-foreground">Rs {(stats.avgBudget / 1000).toFixed(0)}K</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search buyers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Buyers Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBuyers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No buyers found</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBuyers.map((buyer) => (
              <Card key={buyer.id} className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground text-lg">{buyer.name || "N/A"}</h3>
                    <Badge variant="default" className="mt-2">
                      {buyer.buyStatus || "Pending"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  {buyer.contact && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{buyer.contact}</span>
                    </div>
                  )}
                  {buyer.property?.address && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{buyer.property.address}</span>
                    </div>
                  )}
                  {buyer.buyValue && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <DollarSign className="h-4 w-4" />
                      <span>Buy Value: Rs {parseFloat(buyer.buyValue).toLocaleString()}</span>
                    </div>
                  )}
                  {buyer.property?.name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building className="h-4 w-4" />
                      <span>Property: {buyer.property.name}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-semibold text-foreground">{buyer.buyStatus || "Pending"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Buy Value</p>
                        <p className="font-semibold text-foreground">
                          Rs {buyer.buyValue ? parseFloat(buyer.buyValue).toLocaleString() : "0"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
