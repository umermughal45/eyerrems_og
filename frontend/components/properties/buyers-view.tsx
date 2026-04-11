"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Mail, Phone, MapPin, DollarSign, ShoppingCart, Loader2, User, TrendingUp, Target } from "lucide-react"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { AddBuyerDialog } from "./add-buyer-dialog"
import { apiService } from "@/lib/api"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const buyerStats = [
  {
    name: "Total Buyers",
    value: 0,
    icon: User,
    href: "/details/buyers",
  },
  {
    name: "Active Leads",
    value: 0,
    icon: Target,
    href: "/details/buyers?status=interested",
  },
  {
    name: "Closed Deals",
    value: 0,
    icon: ShoppingCart,
    href: "/details/buyers?status=closed",
  },
  {
    name: "Total Budget",
    value: 0,
    icon: DollarSign,
    href: "/details/buyers",
    format: (v: number) => formatCurrency(v),
  },
]

export function BuyersView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("properties", "buyers") || {})
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchBuyers()
  }, [])

  const fetchBuyers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.buyers.getAll()
      const responseData = response.data as any
      const buyersData = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      setBuyers(buyersData)

      // Update stats
      const totalBuyers = buyersData.length
      const activeLeads = buyersData.filter((b: any) => ['New', 'Contacted', 'Interested'].includes(b.status)).length
      const closedDeals = buyersData.filter((b: any) => b.status === 'Closed').length
      const totalBudget = buyersData.reduce((sum: number, b: any) => {
        const max = b.budgetMax || 0
        return sum + max
      }, 0)

      buyerStats[0].value = totalBuyers
      buyerStats[1].value = activeLeads
      buyerStats[2].value = closedDeals
      buyerStats[3].value = totalBudget
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || "Failed to fetch buyers")
      setBuyers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredBuyers = (buyers || []).filter((buyer) => {
    const name = buyer.fullName || buyer.name || ""
    const email = buyer.email || ""
    const phone = buyer.phone || ""
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch =
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      phone.toLowerCase().includes(searchLower)

    const status = activeFilters.status
    const matchesStatus = !status || buyer.status === status

    const propertyType = activeFilters.propertyType
    const matchesType = !propertyType || buyer.interestedPropertyType === propertyType

    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800'
      case 'Contacted': return 'bg-yellow-100 text-yellow-800'
      case 'Interested': return 'bg-green-100 text-green-800'
      case 'Closed': return 'bg-purple-100 text-purple-800'
      case 'Lost': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {buyerStats.map((stat, index) => (
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
        searchPlaceholder="Search buyers…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Buyer
          </Button>
        }
      />

      {/* Buyers Grid */}
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
          {filteredBuyers.map((buyer) => (
            <Card key={buyer.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/properties/buyers/${buyer.id}`)}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{buyer.fullName || buyer.name}</h3>
                    <Badge className={getStatusColor(buyer.status)}>
                      {buyer.status}
                    </Badge>
                  </div>
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  {buyer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{buyer.phone}</span>
                    </div>
                  )}
                  {buyer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>{buyer.email}</span>
                    </div>
                  )}
                  {buyer.preferredLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{buyer.preferredLocation}</span>
                    </div>
                  )}
                </div>

                {(buyer.budgetMin || buyer.budgetMax) && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span>
                      {buyer.budgetMin ? formatCurrency(buyer.budgetMin) : 'Any'} - {buyer.budgetMax ? formatCurrency(buyer.budgetMax) : 'Any'}
                    </span>
                  </div>
                )}

                {buyer.interestedPropertyType && (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-blue-600" />
                    <span>{buyer.interestedPropertyType}</span>
                  </div>
                )}

                {buyer.requirementNotes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {buyer.requirementNotes}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddBuyerDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          fetchBuyers()
          setShowAddDialog(false)
        }}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="properties"
        tab="buyers"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("properties", "buyers", filters)
        }}
      />

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="buyer"
        module="buyers"
        entityDisplayName="Buyers"
        filters={toExportFilters(activeFilters, "properties")}
        search={searchQuery || undefined}
      />
    </div>
  )
}
