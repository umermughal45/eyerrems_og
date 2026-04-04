"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingUp, Home, Building2, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { apiService } from "@/lib/api"

type PropertyOccupancyData = {
  property: string
  occupancy: number
  total: number
  occupied: number
  vacant: number
}

type OccupancyTrendPoint = {
  month: string
  rate: number
}

export default function OccupancyDetailsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [overallOccupancy, setOverallOccupancy] = useState(0)
  const [occupiedUnits, setOccupiedUnits] = useState(0)
  const [totalUnits, setTotalUnits] = useState(0)
  const [vacantUnits, setVacantUnits] = useState(0)
  const [occupancyChange, setOccupancyChange] = useState("+0%")
  const [propertyOccupancyData, setPropertyOccupancyData] = useState<PropertyOccupancyData[]>([])
  const [occupancyTrendData, setOccupancyTrendData] = useState<OccupancyTrendPoint[]>([])

  useEffect(() => {
    fetchOccupancyData()
  }, [])

  const fetchOccupancyData = async () => {
    try {
      setLoading(true)
      
      const [statsResponse, propertiesResponse] = await Promise.all([
        apiService.stats.getPropertiesStats(),
        apiService.properties.getAll(),
      ])

      const statsData = (statsResponse as any)?.data?.data || (statsResponse as any)?.data || {}
      const properties = Array.isArray((propertiesResponse as any)?.data?.data)
        ? (propertiesResponse as any).data.data
        : Array.isArray((propertiesResponse as any)?.data)
          ? (propertiesResponse as any).data
          : []

      // Calculate overall stats
      const totalUnitsCount = statsData.totalUnits || 0
      const occupiedUnitsCount = statsData.occupiedUnits || 0
      const vacantUnitsCount = statsData.vacantUnits || 0
      const occupancyRate = statsData.occupancyRate || 0

      setTotalUnits(totalUnitsCount)
      setOccupiedUnits(occupiedUnitsCount)
      setVacantUnits(vacantUnitsCount)
      setOverallOccupancy(occupancyRate)
      setOccupancyChange(statsData.occupancyChange || "+0% from last month")

      // Calculate property-level occupancy
      const propertyDataArray: PropertyOccupancyData[] = properties
        .filter((p: any) => p.type !== "house") // Exclude houses as they don't have units
        .map((property: any) => {
          const total = property.units || property._count?.units || 0
          const occupied = property.occupied || 0
          const vacant = total - occupied
          const occupancy = total > 0 ? (occupied / total) * 100 : 0

          return {
            property: property.name || "Unnamed Property",
            occupancy: Number(occupancy.toFixed(1)),
            total,
            occupied,
            vacant,
          }
        })
        .filter((p: PropertyOccupancyData) => p.total > 0) // Only show properties with units
      
      const propertyData = propertyDataArray.sort((a, b) => b.occupancy - a.occupancy)

      setPropertyOccupancyData(propertyData)

      // Generate trend data (last 6 months) - simplified since we don't have historical data
      const now = new Date()
      const months = Array.from({ length: 6 }).map((_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
        return {
          month: date.toLocaleString("en-US", { month: "short" }),
          rate: occupancyRate, // Using current rate as approximation
        }
      })
      setOccupancyTrendData(months)
    } catch (err) {
      console.error("Failed to fetch occupancy data:", err)
      setOverallOccupancy(0)
      setOccupiedUnits(0)
      setTotalUnits(0)
      setVacantUnits(0)
      setPropertyOccupancyData([])
      setOccupancyTrendData([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Occupancy Rate Details</h1>
            <p className="text-muted-foreground mt-1">Track occupancy rates across all properties</p>
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
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              </div>
              <p className="text-sm text-muted-foreground">Overall Occupancy</p>
              <p className="text-3xl font-bold text-foreground mt-2">{overallOccupancy.toFixed(1)}%</p>
              <p className="text-sm text-success mt-1">{occupancyChange}</p>
            </Card>
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Home className="h-6 w-6 text-white" />
              </div>
              </div>
              <p className="text-sm text-muted-foreground">Occupied Units</p>
              <p className="text-3xl font-bold text-foreground mt-2">{occupiedUnits.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Out of {totalUnits.toLocaleString()} total</p>
            </Card>
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              </div>
              <p className="text-sm text-muted-foreground">Vacant Units</p>
              <p className="text-3xl font-bold text-foreground mt-2">{vacantUnits.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground mt-1">Available for lease</p>
            </Card>
            <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              </div>
              <p className="text-sm text-muted-foreground">Target Rate</p>
              <p className="text-3xl font-bold text-foreground mt-2">95%</p>
              <p className="text-sm text-muted-foreground mt-1">
                {overallOccupancy >= 95 ? "Target achieved" : `${(95 - overallOccupancy).toFixed(1)}% to target`}
              </p>
            </Card>
          </div>
        )}

        {/* Charts */}
        {loading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="p-6">
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Occupancy Rate Trend</h3>
              {occupancyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={occupancyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2} name="Occupancy Rate %" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No trend data available
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Occupancy by Property</h3>
              {propertyOccupancyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={propertyOccupancyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="property"
                      stroke="var(--muted-foreground)"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis stroke="var(--muted-foreground)" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="occupancy" fill="#10b981" radius={[8, 8, 0, 0]} name="Occupancy %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No property data available
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Property Breakdown */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Property Occupancy Breakdown</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : propertyOccupancyData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No property data available</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property Name</TableHead>
                  <TableHead className="text-right">Total Units</TableHead>
                  <TableHead className="text-right">Occupied</TableHead>
                  <TableHead className="text-right">Vacant</TableHead>
                  <TableHead className="text-right">Occupancy Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyOccupancyData.map((property, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{property.property}</TableCell>
                    <TableCell className="text-right">{property.total}</TableCell>
                    <TableCell className="text-right">{property.occupied}</TableCell>
                    <TableCell className="text-right">{property.vacant}</TableCell>
                    <TableCell className="text-right font-semibold">{property.occupancy}%</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          property.occupancy >= 90 ? "default" : property.occupancy >= 80 ? "secondary" : "destructive"
                        }
                      >
                        {property.occupancy >= 90 ? "Excellent" : property.occupancy >= 80 ? "Good" : "Needs Attention"}
                      </Badge>
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
