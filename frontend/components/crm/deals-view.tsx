"use client"

import { useMemo, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, DollarSign, Calendar, TrendingUp, Loader2, MoreVertical, Pencil, Trash } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { Badge } from "@/components/ui/badge"
import { AddDealDialog } from "./add-deal-dialog"
import { apiService } from "@/lib/api"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toSimpleFilters, toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

const formatCurrency = (value: number) => {
  if (!value || Number.isNaN(value)) return "Rs 0"
  return `Rs ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

const normalizeStage = (stage?: string | null) => (stage || "").toLowerCase().trim()

export function DealsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [deals, setDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [editingDeal, setEditingDeal] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("deals", undefined) || {})
  const { toast } = useToast()

  useEffect(() => {
    fetchDeals()
  }, [searchQuery, activeFilters])

  const fetchDeals = async () => {
    try {
      setLoading(true)
      setError(null)
      const filters = toSimpleFilters(activeFilters)
      const params: Record<string, unknown> = { search: searchQuery || undefined }
      if (filters.stage) params.stage = filters.stage
      if (filters.status) params.status = filters.status
      if (filters.dealType) params.dealType = filters.dealType
      const response = await apiService.deals.getAll(params) as any
      // API returns { success: true, data: [...] }
      const rawData = response.data?.data || response.data || []
      const data: any[] = Array.isArray(rawData) ? rawData : []
      const mapped = data.map((deal: any) => ({
        ...deal,
        clientName:
          typeof deal.client === "string"
            ? deal.client
            : deal.client?.name || deal.clientName || "",
      }))
      setDeals(mapped)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch deals")
      setDeals([])
    } finally {
      setLoading(false)
    }
  }

  const filteredDeals = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return deals.filter((deal) =>
      (deal.tid || "").toLowerCase().includes(query) ||
      (deal.property?.tid || "").toLowerCase().includes(query) ||
      (deal.title || "").toLowerCase().includes(query) ||
      (deal.clientName || "").toLowerCase().includes(query) ||
      (typeof deal.client === "string" ? deal.client.toLowerCase().includes(query) : false) ||
      (deal.client?.name || "").toLowerCase().includes(query),
    )
  }, [deals, searchQuery])

  const formatDealValue = (value: unknown) => {
    const numericValue =
      typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : NaN
    if (!Number.isFinite(numericValue)) return "$0"
    return formatCurrency(numericValue)
  }

  const formatProbability = (probability: unknown) => {
    if (typeof probability === "number" && Number.isFinite(probability)) return `${probability}%`
    if (typeof probability === "string" && probability.trim() !== "") return `${probability}%`
    return "—"
  }

  const formatExpectedClose = (expectedClose: unknown) => {
    if (typeof expectedClose !== "string") return "—"
    const date = new Date(expectedClose)
    return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString()
  }

  const openEditDeal = (deal: any) => {
    setEditingDeal(deal)
    setShowAddDialog(true)
  }

  const confirmDeleteDeal = (deal: any) => {
    setDeleteTarget(deal)
  }

  const handleDeleteDeal = async () => {
    if (!deleteTarget) return
    try {
      await apiService.deals.delete(deleteTarget.id)
      toast({ title: "Deal deleted" })
      setDeleteTarget(null)
      fetchDeals()
    } catch (err: any) {
      console.error("Failed to delete deal", err)
      toast({ title: "Failed to delete deal", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search deals…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Deal
          </Button>
        }
      />

      {/* Deals List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredDeals.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <TrendingUp className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {deals.length === 0 ? "No deals yet" : "No deals match your search"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {deals.length === 0
                ? "Create deals to track sales opportunities. Link deals to clients and dealers, and manage the sales pipeline."
                : "Try adjusting your search criteria"}
            </p>
            {deals.length === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Deal
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDeals.map((deal) => (
            <Card key={deal.id} className="p-6 hover:shadow-lg transition-all hover:scale-[1.01]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className="flex flex-col gap-1"
                      onClick={() => router.push(`/details/deals/${deal.id}`)}
                      role="button"
                    >
                      <h3 className="font-semibold text-foreground text-lg">{deal.property?.tid || deal.title || "Untitled Deal"}</h3>
                      <Badge
                        variant={
                          normalizeStage(deal.stage) === "closing"
                            ? "default"
                            : normalizeStage(deal.stage) === "negotiation"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {toTitleCase(deal.stage)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/details/deals/${deal.id}/payment-plan`)
                        }}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Payment Plan
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              openEditDeal(deal)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              confirmDeleteDeal(deal)
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div
                    className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm"
                    onClick={() => router.push(`/details/deals/${deal.id}`)}
                    role="button"
                  >
                    <div>
                      <p className="text-muted-foreground">Client</p>
                      <p className="font-medium text-foreground mt-1">
                        {deal.client?.name || deal.clientName || "No client assigned"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deal Value</p>
                      <div className="flex items-center gap-1 font-medium text-foreground mt-1">
                        <DollarSign className="h-3 w-3" />
                        {formatDealValue(deal.dealAmount)}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Probability</p>
                      <p className="font-medium text-foreground mt-1">{formatProbability(deal.probability)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected Close</p>
                      <div className="flex items-center gap-1 text-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatExpectedClose(deal.expectedClose)}
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Agent</p>
                      <p className="font-medium text-foreground mt-1">{deal.agent || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddDealDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDeal(null)
          }
          setShowAddDialog(open)
        }}
        onSuccess={fetchDeals}
        initialData={
          editingDeal
            ? {
              id: editingDeal.id,
              title: editingDeal.title,
              clientId: editingDeal.clientId || editingDeal.client?.id || null,
              dealAmount: editingDeal.dealAmount ?? editingDeal.value ?? null,
              stage: editingDeal.stage,
            }
            : null
        }
        mode={editingDeal ? "edit" : "create"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.property?.tid || deleteTarget?.title}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDeal}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="deal"
        module="deals"
        entityDisplayName="Deals"
        filters={toExportFilters(activeFilters, "deals")}
        search={searchQuery || undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="deals"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("deals", undefined, filters)
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}

function toTitleCase(value?: string | null) {
  if (!value) return "—"
  return value
    .toString()
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
