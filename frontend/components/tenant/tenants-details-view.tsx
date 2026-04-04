"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Users, UserCheck, UserX, Clock, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { apiService } from "@/lib/api"
import { MiniChartCard } from "@/components/ui/mini-chart-card"

export function TenantsDetailsView({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [tenants, setTenants] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.tenants || []
  })
  const [loading, setLoading] = useState(!initialData)
  const [stats, setStats] = useState(() => {
    if (!initialData) return {
      totalTenants: 0,
      activeTenants: 0,
      newTenants: 0,
      expiringLeases: 0,
    }
    const tenantsData = initialData.tenants || []
    const total = tenantsData.length || 0
    const active = tenantsData.filter((t: any) => t.status === "active").length || 0
    
    const today = new Date()
    const ninetyDaysLater = new Date(today)
    ninetyDaysLater.setDate(today.getDate() + 90)
    
    const expiring = tenantsData.filter((t: any) => {
      if (!t.leases || t.leases.length === 0) return false
      const lease = t.leases[0]
      if (!lease.leaseEnd) return false
      const leaseEnd = new Date(lease.leaseEnd)
      return leaseEnd >= today && leaseEnd <= ninetyDaysLater
    }).length || 0

    return {
      totalTenants: total,
      activeTenants: active,
      newTenants: 0,
      expiringLeases: expiring,
    }
  })
  
  const [tenantGrowthData, setTenantGrowthData] = useState<any[]>([])
  const [tenantStatusData, setTenantStatusData] = useState<any[]>([])
  const [leaseTrendData, setLeaseTrendData] = useState<any[]>([])

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true)
      const response: any = await apiService.tenants.getAll()
      const tenantsData = response?.data?.data || response?.data || []
      setTenants(Array.isArray(tenantsData) ? tenantsData : [])

      // Calculate stats
      const total = tenantsData.length || 0
      const active = tenantsData.filter((t: any) => t.status === "active").length || 0
      
      const today = new Date()
      const ninetyDaysLater = new Date(today)
      ninetyDaysLater.setDate(today.getDate() + 90)
      
      const expiring = tenantsData.filter((t: any) => {
        if (!t.leases || t.leases.length === 0) return false
        const lease = t.leases[0]
        if (!lease.leaseEnd) return false
        const leaseEnd = new Date(lease.leaseEnd)
        return leaseEnd >= today && leaseEnd <= ninetyDaysLater
      }).length || 0

      setStats({
        totalTenants: total,
        activeTenants: active,
        newTenants: 0,
        expiringLeases: expiring,
      })
      
      const now = new Date()
      const last6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
        return { name: d.toLocaleString('default', { month: 'short' }), Tenants: 0, Leases: 0 }
      })
      
      tenantsData.forEach((t: any) => {
        const tDate = new Date(t.createdAt || new Date());
        const mNode = last6Months.find(m => m.name === tDate.toLocaleString('default', { month: 'short' }))
        if(mNode) mNode.Tenants += 1;
        
        if (t.leases && t.leases[0] && t.leases[0].leaseStart) {
          const lDate = new Date(t.leases[0].leaseStart);
           const lNode = last6Months.find(m => m.name === lDate.toLocaleString('default', { month: 'short' }))
           if(lNode) lNode.Leases += 1;
        }
      })
      
      setTenantGrowthData(last6Months)
      setLeaseTrendData(last6Months)
      setTenantStatusData([
        { name: "Active", value: active },
        { name: "Inactive", value: total - active }
      ])
      
    } catch (err: any) {
      console.error("Failed to fetch tenants:", err)
      setTenants([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialData) {
      fetchTenants()
    } else if (!tenantGrowthData.length) {
       // Calculate charts from initial data
       const tenantsData = initialData.tenants || []
       const now = new Date()
       const last6Months = Array.from({ length: 6 }).map((_, i) => {
         const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
         return { name: d.toLocaleString('default', { month: 'short' }), Tenants: 0, Leases: 0 }
       })
       
       tenantsData.forEach((t: any) => {
         const tDate = new Date(t.createdAt || new Date());
         const mNode = last6Months.find(m => m.name === tDate.toLocaleString('default', { month: 'short' }))
         if(mNode) mNode.Tenants += 1;
         
         if (t.leases && t.leases[0] && t.leases[0].leaseStart) {
           const lDate = new Date(t.leases[0].leaseStart);
            const lNode = last6Months.find(m => m.name === lDate.toLocaleString('default', { month: 'short' }))
            if(lNode) lNode.Leases += 1;
         }
       })
       
       setTenantGrowthData(last6Months)
       setLeaseTrendData(last6Months)
       setTenantStatusData([
         { name: "Active", value: stats.activeTenants },
         { name: "Inactive", value: stats.totalTenants - stats.activeTenants }
       ])
    }
  }, [fetchTenants, initialData, tenantGrowthData.length, stats.activeTenants, stats.totalTenants])

  const filteredTenants = tenants.filter((tenant) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      tenant.name?.toLowerCase().includes(searchLower) ||
      tenant.unit?.unitName?.toLowerCase().includes(searchLower) ||
      tenant.unit?.property?.name?.toLowerCase().includes(searchLower)
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
            <h1 className="text-3xl font-bold text-foreground">Active Tenants Details</h1>
            <p className="text-muted-foreground mt-1">Complete overview of tenant information and lease status</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Active Tenants</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.totalTenants}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <UserCheck className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Active Tenants</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.activeTenants}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#ef4444,#b91c1c)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <UserX className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Inactive Tenants</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.totalTenants - stats.activeTenants}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Leases Expiring (90 days)</p>
            <p className="text-3xl font-bold text-foreground mt-2">{stats.expiringLeases}</p>
          </Card>
        </div>

        {/* Analytics Mini Charts */}
        <div className="grid gap-4 md:grid-cols-3">
          <MiniChartCard
            title="Tenant Growth"
            value={stats.totalTenants}
            data={tenantGrowthData}
            dataKey="Tenants"
            chartType="area"
            colors={["#8b5cf6"]}
            loading={loading}
          />
          <MiniChartCard
            title="Leases Started"
            value={leaseTrendData.reduce((acc, curr) => acc + curr.Leases, 0)}
            data={leaseTrendData}
            dataKey="Leases"
            chartType="line"
            colors={["#f59e0b"]}
            loading={loading}
          />
          <MiniChartCard
            title="Active vs Inactive"
            value=""
            hideValue
            data={tenantStatusData}
            dataKey="value"
            nameKey="name"
            chartType="donut"
            colors={["#10b981", "#ef4444"]}
            loading={loading}
          />
        </div>

        {/* Tenants List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">All Tenants</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant Name</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Lease Start</TableHead>
                <TableHead>Lease End</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !tenants.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No tenants found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => {
                  const lease = tenant.leases && tenant.leases.length > 0 ? tenant.leases[0] : null
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name || "N/A"}</TableCell>
                      <TableCell>{tenant.unit?.unitName || "N/A"}</TableCell>
                      <TableCell>{tenant.unit?.property?.name || "N/A"}</TableCell>
                      <TableCell>{lease?.leaseStart ? new Date(lease.leaseStart).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell>{lease?.leaseEnd ? new Date(lease.leaseEnd).toLocaleDateString() : "N/A"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {lease?.rent ? `Rs ${parseFloat(lease.rent).toLocaleString()}` : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.status === "active" ? "default" : "destructive"}>
                          {tenant.status || "inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
