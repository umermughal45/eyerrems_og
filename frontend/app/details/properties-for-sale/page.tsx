"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Building2, DollarSign, MapPin, Calendar, User, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiService } from "@/lib/api"

export default function PropertiesForSaleDetailsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalListed: 0,
    totalValue: 0,
    avgDaysListed: 0,
  })

  useEffect(() => {
    fetchPropertiesForSale()
  }, [])

  const fetchPropertiesForSale = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.properties.getAll()
      const propertiesData = response?.data?.data || response?.data || []
      // Filter properties with status "For Sale"
      const forSaleProperties = Array.isArray(propertiesData)
        ? propertiesData.filter((p: any) => p.status === "For Sale")
        : []

      setProperties(forSaleProperties)

      // Calculate stats
      const total = forSaleProperties.length || 0
      const totalValue = forSaleProperties.reduce((sum: number, p: any) => {
        // If property has saleValue, use it; otherwise estimate from other fields
        return sum + (parseFloat(p.saleValue) || 0)
      }, 0)

      setStats({
        totalListed: total,
        totalValue: totalValue,
        avgDaysListed: 0, // Can be calculated if we track listedDate
      })
    } catch (err: any) {
      console.error("Failed to fetch properties for sale:", err)
      setProperties([])
    } finally {
      setLoading(false)
    }
  }

  const filteredProperties = properties.filter((property) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      property.name?.toLowerCase().includes(searchLower) ||
      property.address?.toLowerCase().includes(searchLower) ||
      property.type?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Properties for Sale</h1>
            <p className="text-muted-foreground mt-1">Complete list of properties available for sale</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Listed</p>
                <p className="text-2xl font-bold">{stats.totalListed}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">Rs {(stats.totalValue / 1000000).toFixed(1)}M</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Days Listed</p>
                <p className="text-2xl font-bold">{stats.avgDaysListed}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No properties for sale found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProperties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell className="font-medium">{property.name || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{property.type || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {property.address || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {property.saleValue ? `Rs ${parseFloat(property.saleValue).toLocaleString()}` : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={property.status === "For Sale" ? "default" : "outline"}>
                        {property.status || "N/A"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
