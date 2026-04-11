"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Mail, Phone, MapPin, DollarSign, Building, Loader2, User, TrendingUp, Home } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddSellerDialog } from "./add-seller-dialog"
import { apiService } from "@/lib/api"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const sellerStats = [
  {
    name: "Total Sellers",
    value: 0,
    icon: User,
    href: "/details/sellers",
  },
  {
    name: "Active Sellers",
    value: 0,
    icon: TrendingUp,
    href: "/details/sellers?status=active",
  },
  {
    name: "Properties Listed",
    value: 0,
    icon: Building,
    href: "/details/sellers",
  },
  {
    name: "Total Commissions",
    value: 0,
    icon: DollarSign,
    href: "/details/sellers",
    format: (v: number) => formatCurrency(v),
  },
]

export function SellersView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", "sellers") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [sellers, setSellers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchSellers()
  }, [])

  const fetchSellers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.sellers.getAll()
      const responseData = response.data as any
      const sellersData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setSellers(sellersData)

      // Update stats
      const totalSellers = sellersData.length
      const activeSellers = sellersData.filter((s: any) => s.status === 'Active').length
      const totalProperties = sellersData.reduce((sum: number, s: any) => sum + (s.properties?.length || 0), 0)
      const totalCommissions = sellersData.reduce((sum: number, s: any) => sum + (s.totalCommissions || 0), 0)

      sellerStats[0].value = totalSellers
      sellerStats[1].value = activeSellers
      sellerStats[2].value = totalProperties
      sellerStats[3].value = totalCommissions
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch sellers")
      setSellers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredSellers = (sellers || []).filter((seller) => {
    const name = seller.fullName || seller.name || ""
    const email = seller.email || ""
    const phone = seller.phone || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      phone.toLowerCase().includes(searchLower) ||
      seller.propertyName?.toLowerCase().includes(searchLower)

    const status = activeFilters.status
    const matchesStatus = !status || seller.status === status

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800'
      case 'Inactive': return 'bg-red-100 text-red-800'
      case 'Pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {sellerStats.map((stat, index) => (
          <Card
            key={index}
            className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(stat.href)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.format ? stat.format(stat.value) : stat.value}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <ListToolbar
        searchPlaceholder="Search sellers…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Seller
          </Button>
        }
      />

      {/* Sellers Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-center text-red-600">{error}</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSellers.map((seller) => (
            <Card key={seller.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/properties/sellers/${seller.id}`)}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{seller.fullName || seller.name}</h3>
                    <Badge className={getStatusColor(seller.status)}>
                      {seller.status}
                    </Badge>
                  </div>
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {seller.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{seller.phone}</span>
                    </div>
                  )}
                  {seller.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{seller.email}</span>
                    </div>
                  )}
                  {seller.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{seller.address}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Properties:</span>
                    <span className="font-medium">{seller.properties?.length || 0}</span>
                  </div>

                  {seller.totalCommissions > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Commissions:</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(seller.totalCommissions)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddSellerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          fetchSellers()
          setShowAddDialog(false)
        }}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="properties"
        tab="sellers"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("properties", "sellers", filters)
        }}
      />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="seller"
        module="sellers"
        entityDisplayName="Sellers"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
      />
    </div>
  )
}






