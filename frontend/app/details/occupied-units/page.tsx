"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home, Users, DollarSign, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"

export default function OccupiedUnitsDetailsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    occupiedUnits: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
  })

  useEffect(() => {
    fetchOccupiedUnits()
  }, [])

  const fetchOccupiedUnits = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.units.getAll()
      const unitsData = response?.data?.data || response?.data || []
      // Filter out units from houses (houses don't have units)
      const nonHouseUnits = Array.isArray(unitsData)
        ? unitsData.filter((u: any) => u.property?.type !== 'house')
        : []
      const occupiedUnits = nonHouseUnits.filter((u: any) => u.status === "Occupied")

      setUnits(occupiedUnits)

      // Calculate stats - only for non-house units
      const total = nonHouseUnits.length || 0
      const occupied = occupiedUnits.length || 0
      const occupancyRate = total > 0 ? (occupied / total) * 100 : 0
      const revenue = occupiedUnits.reduce(
        (sum: number, u: any) => sum + (parseFloat(u.monthlyRent) || 0),
        0
      )

      setStats({
        occupiedUnits: occupied,
        occupancyRate: occupancyRate,
        monthlyRevenue: revenue,
      })
    } catch (err: any) {
      console.error("Failed to fetch occupied units:", err)
      setUnits([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Occupied Units</h1>
            <p className="text-muted-foreground mt-1">All currently occupied units with tenant information</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Occupied Units</p>
                <p className="text-2xl font-bold">{stats.occupiedUnits}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Occupancy Rate</p>
                <p className="text-2xl font-bold">{stats.occupancyRate.toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold">Rs {stats.monthlyRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Occupied Units List</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No occupied units found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Monthly Rent</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.property?.name || "N/A"}</TableCell>
                    <TableCell>{unit.block?.name || "N/A"}</TableCell>
                    <TableCell>{unit.unitName || "N/A"}</TableCell>
                    <TableCell>{unit.tenantName || "N/A"}</TableCell>
                    <TableCell>Rs {parseFloat(unit.monthlyRent || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="default">{unit.status || "Occupied"}</Badge>
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
