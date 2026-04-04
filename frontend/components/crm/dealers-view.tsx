"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiService } from "@/lib/api"
import axios from "axios"
import { DollarSign, Loader2, Mail, Phone, Plus, TrendingUp, MoreVertical, Pencil, Trash, Briefcase, FileText, Eye, Download } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toSimpleFilters, toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
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
import { AddDealerDialog } from "./add-dealer-dialog"

interface DealersViewProps {
  refreshKey?: number
}

const formatCurrency = (value: number) => {
  if (!value || Number.isNaN(value)) return "Rs 0"
  return `Rs ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
}

const formatDate = (value?: string | null) => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? "—" : date.toLocaleDateString()
}

export function DealersView({ refreshKey = 0 }: DealersViewProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [dealers, setDealers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingDealer, setEditingDealer] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("dealers", undefined) || {})
  const { toast } = useToast()

  useEffect(() => {
    fetchDealers()
  }, [refreshKey, searchQuery, activeFilters])

  const fetchDealers = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log("Fetching dealers...")

      // Fetch dealers
      const filters = toSimpleFilters(activeFilters)
      const params: Record<string, unknown> = {}
      if (searchQuery) params.search = searchQuery
      if (filters.isActive !== undefined) params.isActive = filters.isActive
      let dealersResp: any
      try {
        dealersResp = await apiService.dealers.getAll(params)
      } catch (err: any) {
        if (axios.isCancel(err) || err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError') return
        console.error("Failed to fetch dealers API:", err)
        throw new Error(err.response?.data?.message || err.message || "Failed to fetch dealers list")
      }

      // Fetch deals (don't fail if deals fail)
      let dealsResp: any
      try {
        dealsResp = await apiService.deals.getAll()
      } catch (err) {
        console.warn("Failed to fetch deals for statistics:", err)
        dealsResp = { data: [] }
      }

      const dealersPayload = dealersResp?.data
      let dealerList: any[] = []
      if (dealersPayload?.success && Array.isArray(dealersPayload?.data)) {
        dealerList = dealersPayload.data
      } else if (Array.isArray(dealersPayload?.data)) {
        dealerList = dealersPayload.data
      } else if (Array.isArray(dealersPayload)) {
        dealerList = dealersPayload
      }

      let deals: any[] = []
      const dealsPayload = dealsResp?.data
      if (dealsPayload?.success && Array.isArray(dealsPayload?.data)) {
        deals = dealsPayload.data
      } else if (Array.isArray(dealsPayload?.data)) {
        deals = dealsPayload.data
      } else if (Array.isArray(dealsPayload)) {
        deals = dealsPayload
      }

      console.log(`Fetched ${dealerList.length} dealers and ${deals.length} deals`)

      const dealsByDealer: Record<string, { count: number; totalValue: number; lastDealAt?: string }> = {}
      deals.forEach((deal: any) => {
        const dealerId = deal.dealerId || deal.dealer?.id
        if (!dealerId) return

        const numericValue =
          typeof deal.dealAmount === "number" ? deal.dealAmount : Number.parseFloat(deal.dealAmount ?? "0")
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0
        const createdAt = deal.createdAt

        if (!dealsByDealer[dealerId]) {
          dealsByDealer[dealerId] = { count: 0, totalValue: 0, lastDealAt: createdAt }
        }

        dealsByDealer[dealerId].count += 1
        dealsByDealer[dealerId].totalValue += safeValue

        const currentLast = dealsByDealer[dealerId].lastDealAt
        if (!currentLast || (createdAt && new Date(createdAt) > new Date(currentLast))) {
          dealsByDealer[dealerId].lastDealAt = createdAt
        }
      })

      const mapped = dealerList.map((dealer: any) => {
        const stats = dealsByDealer[dealer.id] || { count: 0, totalValue: 0, lastDealAt: undefined }
        return {
          id: dealer.id,
          name: dealer.name,
          email: dealer.email || "",
          phone: dealer.phone || "",
          company: dealer.company || "—",
          commissionRate: typeof dealer.commissionRate === "number" ? dealer.commissionRate : null,
          createdAt: dealer.createdAt,
          totalDeals: stats.count,
          totalDealValue: stats.totalValue,
          lastDealAt: stats.lastDealAt,
        }
      })

      setDealers(mapped)
    } catch (err: any) {
      console.error("Error in fetchDealers:", err)
      const msg = err.message || "Failed to fetch dealers"
      setError(`${msg} ${err.response?.status ? `(${err.response.status})` : ''}`)
      setDealers([])
      toast({
        title: "Error fetching dealers",
        description: msg,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredDealers = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return dealers.filter((dealer) => {
      const name = (dealer.name || "").toLowerCase()
      const email = (dealer.email || "").toLowerCase()
      const phone = (dealer.phone || "").toLowerCase()
      const company = (dealer.company || "").toLowerCase()
      const tid = (dealer.tid || "").toLowerCase()
      return (
        tid.includes(query) ||
        name.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        company.includes(query)
      )
    })
  }, [dealers, searchQuery])

  return (
    <div className="space-y-6">
      <ListToolbar
        searchPlaceholder="Search by TID, name, email, company…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Dealer
          </Button>
        }
      />

      {/* Dealers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dealer</TableHead>
              <TableHead>TID</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Deals</TableHead>
              <TableHead>Total Deal Value</TableHead>
              <TableHead>Commission Rate</TableHead>
              <TableHead>Last Deal</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-6 py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="px-6 py-12 text-center text-destructive">{error}</TableCell>
              </TableRow>
            ) : filteredDealers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <Briefcase className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-lg font-semibold text-foreground mb-2">
                      {dealers.length === 0 ? "No dealers yet" : "No dealers match your search"}
                    </p>
                    <p className="text-sm text-muted-foreground mb-4 max-w-md">
                      {dealers.length === 0
                        ? "Add dealers to track commissions and manage sales relationships"
                        : "Try adjusting your search criteria"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredDealers.map((dealer) => (
                <TableRow key={dealer.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase flex-shrink-0">
                        {dealer.name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="font-semibold">{dealer.name || "N/A"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{dealer.tid || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="text-xs">{dealer.email || "—"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-xs">{dealer.phone || "—"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{dealer.company || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium">{dealer.totalDeals}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="font-semibold text-success">
                        {dealer.totalDealValue > 0 ? formatCurrency(dealer.totalDealValue) : "$0"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {dealer.commissionRate != null ? `${dealer.commissionRate}%` : "—"}
                  </TableCell>
                  <TableCell>{formatDate(dealer.lastDealAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <span>{formatDate(dealer.createdAt)}</span>
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
                              router.push(`/ledger/dealer/${dealer.id}`)
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              router.push(`/ledger/dealer/${dealer.id}`)
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Open Ledger
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              setEditingDealer(dealer)
                              setShowDialog(true)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={(event) => {
                              event.preventDefault()
                              setDeleteTarget(dealer)
                            }}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AddDealerDialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDealer(null)
          }
          setShowDialog(open)
        }}
        onSuccess={fetchDealers}
        initialData={editingDealer}
        mode={editingDealer ? "edit" : "create"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dealer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return
                try {
                  await apiService.dealers.delete(deleteTarget.id)
                  toast({ title: "Dealer deleted" })
                  setDeleteTarget(null)
                  fetchDealers()
                } catch (err: any) {
                  console.error("Failed to delete dealer", err)
                  toast({ title: "Failed to delete dealer", variant: "destructive" })
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="dealer"
        module="dealers"
        entityDisplayName="Dealers"
        filters={toExportFilters(activeFilters, "dealers")}
        search={searchQuery || undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="dealers"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("dealers", undefined, filters)
          toast({ title: "Filters applied" })
        }}
      />
    </div>
  )
}
