"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home, TrendingDown, Clock, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"

export default function VacantUnitsDetailsPage() {
  const router = useRouter()
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    vacantUnits: 0,
    vacancyRate: 0,
    avgVacantDays: 0,
  })

  useEffect(() => {
    fetchVacantUnits()
  }, [])

  const fetchVacantUnits = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.units.getAll()
      const unitsData = response?.data?.data || response?.data || []
      // Filter out units from houses (houses don't have units)
      const nonHouseUnits = Array.isArray(unitsData)
        ? unitsData.filter((u: any) => u.property?.type !== 'house')
        : []
      const vacantUnits = nonHouseUnits.filter((u: any) => u.status === "Vacant")

      setUnits(vacantUnits)

      // Calculate stats - only for non-house units
      const total = nonHouseUnits.length || 0
      const vacant = vacantUnits.length || 0
      const vacancyRate = total > 0 ? (vacant / total) * 100 : 0

      setStats({
        vacantUnits: vacant,
        vacancyRate: vacancyRate,
        avgVacantDays: 0, // Can be calculated if we track when units became vacant
      })
    } catch (err: any) {
      console.error("Failed to fetch vacant units:", err)
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
            <h1 className="text-3xl font-bold text-foreground">Vacant Units</h1>
            <p className="text-muted-foreground mt-1">All currently vacant units available for rent</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vacant Units</p>
                <p className="text-2xl font-bold">{stats.vacantUnits}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ef4444,#b91c1c)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <TrendingDown className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vacancy Rate</p>
                <p className="text-2xl font-bold">{stats.vacancyRate.toFixed(1)}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Vacant Days</p>
                <p className="text-2xl font-bold">{stats.avgVacantDays}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Vacant Units List</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : units.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No vacant units found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Unit</TableHead>
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
                    <TableCell>Rs {parseFloat(unit.monthlyRent || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{unit.status || "Vacant"}</Badge>
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
