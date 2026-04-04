"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Home, Building2, DollarSign, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiService } from "@/lib/api"
import { EditStatusDialog } from "@/components/properties/edit-status-dialog"

export default function UnitsDetailsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [units, setUnits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingStatusUnit, setEditingStatusUnit] = useState<{ id: string | number; status: string; name: string } | null>(null)
  const [stats, setStats] = useState({
    totalUnits: 0,
    occupied: 0,
    revenue: 0,
  })

  useEffect(() => {
    fetchUnits()
  }, [])

  const fetchUnits = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.units.getAll()
      const unitsData = response?.data?.data || response?.data || []
      // Filter out units from houses (houses don't have units)
      const nonHouseUnits = Array.isArray(unitsData)
        ? unitsData.filter((u: any) => u.property?.type !== 'house')
        : []
      setUnits(nonHouseUnits)

      // Calculate stats - only for non-house units
      const total = nonHouseUnits.length || 0
      const occupied = nonHouseUnits.filter((u: any) => u.status === "Occupied").length || 0
      const revenue = nonHouseUnits
        .filter((u: any) => u.status === "Occupied")
        .reduce((sum: number, u: any) => sum + (parseFloat(u.monthlyRent) || 0), 0)

      setStats({
        totalUnits: total,
        occupied: occupied,
        revenue: revenue,
      })
    } catch (err: any) {
      console.error("Failed to fetch units:", err)
      setUnits([])
    } finally {
      setLoading(false)
    }
  }

  const filteredUnits = units.filter((unit) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      unit.unitName?.toLowerCase().includes(searchLower) ||
      unit.property?.name?.toLowerCase().includes(searchLower) ||
      unit.block?.name?.toLowerCase().includes(searchLower)
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
            <h1 className="text-3xl font-bold text-foreground">All Units</h1>
            <p className="text-muted-foreground mt-1">Complete list of all units across properties</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold">{stats.totalUnits}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Occupied</p>
                <p className="text-2xl font-bold">{stats.occupied}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold">Rs {stats.revenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search units..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Block</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredUnits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No units found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.property?.name || "N/A"}</TableCell>
                    <TableCell>{unit.block?.name || "N/A"}</TableCell>
                    <TableCell>{unit.unitName || "N/A"}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={unit.status === "Occupied" ? "default" : "secondary"}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingStatusUnit({ 
                            id: unit.id, 
                            status: unit.status || "Vacant", 
                            name: unit.unitName || "Unit" 
                          })
                        }}
                      >
                        {unit.status || "Vacant"}
                      </Badge>
                    </TableCell>
                    <TableCell>{unit.tenantName || "N/A"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      Rs {parseFloat(unit.monthlyRent || 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      {editingStatusUnit && (
        <EditStatusDialog
          open={!!editingStatusUnit}
          onOpenChange={(open) => !open && setEditingStatusUnit(null)}
          onSuccess={() => {
            fetchUnits()
            setEditingStatusUnit(null)
          }}
          entityType="unit"
          entityId={editingStatusUnit.id}
          currentStatus={editingStatusUnit.status}
          entityName={editingStatusUnit.name}
        />
      )}
    </DashboardLayout>
  )
}
