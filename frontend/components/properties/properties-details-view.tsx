"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Building2, Home, MapPin, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { apiService } from "@/lib/api"
import { EditStatusDialog } from "@/components/properties/edit-status-dialog"
import { MiniChartCard } from "@/components/ui/mini-chart-card"

const useDebouncedValue = (value: string, delay = 400) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timeout)
  }, [value, delay])
  return debounced
}

export function PropertiesDetailsView({ initialData }: { initialData?: any }) {
  const router = useRouter()
  const [editingStatusProperty, setEditingStatusProperty] = useState<{ id: number | string; status: string; name: string } | null>(null)
  const [stats, setStats] = useState(() => {
    if (!initialData) return {
      totalProperties: 0,
      totalUnits: 0,
      locations: 0,
      avgOccupancy: 0,
      propertiesChange: "+0 this month",
      occupancyChange: "+0% from last month",
    }
    const { statsData, properties } = initialData
    const uniqueLocations = new Set(
      properties
        .map((p: any) => p.locationNode?.name || p.location)
        .filter(Boolean),
    )
    return {
      totalProperties: statsData.totalProperties || 0,
      totalUnits: statsData.totalUnits || 0,
      locations: uniqueLocations.size,
      avgOccupancy: statsData.occupancyRate || 0,
      propertiesChange: statsData.propertiesChange || "+0 this month",
      occupancyChange: statsData.occupancyChange || "+0% from last month",
    }
  })
  const [propertyTypeData, setPropertyTypeData] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.statsData.propertyTypeData || []
  })
  const [propertyStatusData, setPropertyStatusData] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.statsData.propertyStatusData || []
  })
  const [occupancyTrend, setOccupancyTrend] = useState<any[]>([])
  const [revenueTrend, setRevenueTrend] = useState<any[]>([])
  const [propertiesList, setPropertiesList] = useState<any[]>(() => {
    if (!initialData) return []
    return initialData.properties || []
  })
  const [loading, setLoading] = useState(!initialData)
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 420)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [statsResponse, propertiesResponse] = await Promise.all([
        apiService.stats.getPropertiesStats().catch(() => ({ data: {} })),
        apiService.properties
          .getAll({
            search: debouncedSearchTerm || undefined,
          })
          .catch(() => ({ data: [] })),
      ])

      const statsResponseData: any = statsResponse?.data || {}
      const propertiesResponseData: any = propertiesResponse?.data || {}
      const statsData = statsResponseData?.data || statsResponseData || {}
      const properties = propertiesResponseData?.data || propertiesResponseData || []
      setPropertyTypeData(statsData.propertyTypeData || [])
      setPropertyStatusData(statsData.propertyStatusData || [])

      const uniqueLocations = new Set(
        properties
          .map((p: any) => p.locationNode?.name || p.location)
          .filter(Boolean),
      )
      const avgOccupancy = statsData.occupancyRate || 0

      setStats({
        totalProperties: statsData.totalProperties || 0,
        totalUnits: statsData.totalUnits || 0,
        locations: uniqueLocations.size,
        avgOccupancy,
        propertiesChange: statsData.propertiesChange || "+0 this month",
        occupancyChange: statsData.occupancyChange || "+0% from last month",
      })

      // Generate trend data from properties list
      const now = new Date();
      const last6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return { name: d.toLocaleString('default', { month: 'short' }), Count: 0, Revenue: 0 };
      });
      
      properties.forEach((p: any) => {
        const pDate = new Date(p.createdAt || new Date());
        const mNode = last6Months.find(m => m.name === pDate.toLocaleString('default', { month: 'short' }));
        if(mNode) {
           mNode.Count += p.units?.length || 1;
           mNode.Revenue += (p.averageRent || p.rentRevenue || 5000);
        }
      });
      
      setOccupancyTrend(last6Months);
      setRevenueTrend(last6Months);
      setPropertiesList(properties)
    } catch (err) {
      console.error("Failed to fetch properties data:", err)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearchTerm])

  useEffect(() => {
    if (!initialData || debouncedSearchTerm) {
      fetchData()
    } else if (initialData && !occupancyTrend.length) {
      // Calculate trends from initial data
      const properties = initialData.properties || []
      const now = new Date();
      const last6Months = Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        return { name: d.toLocaleString('default', { month: 'short' }), Count: 0, Revenue: 0 };
      });
      
      properties.forEach((p: any) => {
        const pDate = new Date(p.createdAt || new Date());
        const mNode = last6Months.find(m => m.name === pDate.toLocaleString('default', { month: 'short' }));
        if(mNode) {
           mNode.Count += p.units?.length || 1;
           mNode.Revenue += (p.averageRent || p.rentRevenue || 5000);
        }
      });
      setOccupancyTrend(last6Months);
      setRevenueTrend(last6Months);
    }
  }, [fetchData, initialData, debouncedSearchTerm, occupancyTrend.length])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Total Properties Details</h1>
            <p className="text-muted-foreground mt-1">Complete overview of all properties and their performance</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Properties</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-2" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.totalProperties.toLocaleString()}</p>
                <p className="text-sm text-success mt-1">{stats.propertiesChange}</p>
              </>
            )}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Home className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Units</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-2" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.totalUnits.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground mt-1">Across all properties</p>
              </>
            )}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <MapPin className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Locations</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-2" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.locations}</p>
                <p className="text-sm text-muted-foreground mt-1">Cities covered</p>
              </>
            )}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Building2 className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Avg Occupancy</p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mt-2" />
            ) : (
              <>
                <p className="text-3xl font-bold text-foreground mt-2">{stats.avgOccupancy.toFixed(1)}%</p>
                <p className="text-sm text-success mt-1">{stats.occupancyChange}</p>
              </>
            )}
          </Card>
        </div>

        {/* Small Analytics Graphs */}
        <div className="grid gap-4 md:grid-cols-3">
            <MiniChartCard
              title="Unit Occupancy Growth"
              value={`${stats.avgOccupancy.toFixed(1)}%`}
              trend={{ value: parseFloat(stats.occupancyChange.replace(/[^\d.-]/g, '')), label: "last month" }}
              data={occupancyTrend}
              dataKey="Count"
              chartType="area"
              colors={["#0ea5e9"]}
              loading={loading}
            />
            <MiniChartCard
              title="Est. Revenue Trend"
              valuePrefix="$"
              value={revenueTrend[revenueTrend.length - 1]?.Revenue.toLocaleString() || "0"}
              data={revenueTrend}
              dataKey="Revenue"
              chartType="bar"
              colors={["#10b981"]}
              loading={loading}
            />
            <MiniChartCard
              title="Status Distribution"
              value=""
              hideValue
              data={propertyStatusData.slice(0, 4)}
              dataKey="value"
              nameKey="name"
              chartType="donut"
              colors={["#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899"]}
              loading={loading}
            />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Properties by Type</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={propertyTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(props: any) => {
                    const { name, percent } = props;
                    return `${name} ${((percent || 0) * 100).toFixed(0)}%`;
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {propertyTypeData.map((entry, index) => {
                    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff']
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  })}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Properties by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={propertyStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid gap-6">

          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">All Properties</h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-52">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search properties..."
                      className="pl-9"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                    />
                  </div>

                </div>
              </div>

              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Property Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Total Units</TableHead>
                    <TableHead className="text-right">Occupied</TableHead>
                    <TableHead className="text-right">Occupancy Rate</TableHead>
                    <TableHead className="text-right">Rent Revenue</TableHead>
                    <TableHead className="text-right">Rent Profit</TableHead>
                    <TableHead className="text-right">Sale Revenue</TableHead>
                    <TableHead className="text-right">Sale Profit</TableHead>
                    <TableHead className="text-right">Outstanding Invoices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !propertiesList.length ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : propertiesList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                        No properties found
                      </TableCell>
                    </TableRow>
                  ) : (
                    propertiesList.map((property) => (
                      <TableRow key={property.id}>
                        <TableCell className="font-medium">{property.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{property.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              property.status === "Sold" ? "destructive" :
                              property.status === "Active" ? "default" :
                              property.status === "Maintenance" ? "destructive" :
                              property.status === "For Sale" ? "secondary" :
                              "outline"
                            }
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingStatusProperty({ id: property.id, status: property.status || "Active", name: property.name })
                            }}
                          >
                            {property.status || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {property.locationNode?.name || property.location || "N/A"}
                        </TableCell>
                        <TableCell>{property.address}</TableCell>
                        <TableCell className="text-right">{property.units || property._count?.units || 0}</TableCell>
                        <TableCell className="text-right">{property.occupied || 0}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {property.units || property._count?.units ?
                            ((property.occupied || 0) / (property.units || property._count?.units) * 100).toFixed(1) :
                            "0"}%
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          Rs {((property.rentRevenue || 0)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${(property.rentProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Rs {((property.rentProfit || 0)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          Rs {((property.saleRevenue || 0)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${(property.saleProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Rs {((property.saleProfit || 0)).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold">Rs {((property.outstandingInvoicesAmount || 0)).toLocaleString("en-IN")}</span>
                            <span className="text-xs text-muted-foreground">
                              {property.outstandingInvoices || 0} {property.outstandingInvoices === 1 ? 'invoice' : 'invoices'}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>
      {editingStatusProperty && (
        <EditStatusDialog
          open={!!editingStatusProperty}
          onOpenChange={(open) => !open && setEditingStatusProperty(null)}
          onSuccess={() => {
            fetchData()
            setEditingStatusProperty(null)
          }}
          entityType="property"
          entityId={editingStatusProperty.id}
          currentStatus={editingStatusProperty.status}
          entityName={editingStatusProperty.name}
        />
      )}
    </div>
  )
}
