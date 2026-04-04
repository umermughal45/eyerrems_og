"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Loader2,
  MoreVertical,
  Pencil,
  Trash,
  UserPlus,
  UserCheck,
  UploadCloud,
} from "lucide-react"
import { LeadCreationController } from "./lead-creation-controller"
import { LeadImportDialog } from "./lead-import-dialog"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toLeadsFilterPayload, toExportFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { apiService } from "@/lib/api"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
const CRMDealPipeline = lazy(() => import("./crm-deal-pipeline").then(m => ({ default: m.CRMDealPipeline })))
import { LeadSideDrawer } from "./lead-side-drawer"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

export function LeadsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingLead, setEditingLead] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("leads", undefined) || {})
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 })
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("table")
  const [selectedLead, setSelectedLead] = useState<any | null>(null)
  const [showSideDrawer, setShowSideDrawer] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchLeads()
  }, [activeFilters, searchQuery])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      setError(null)
      const globalFilter = toLeadsFilterPayload(activeFilters, {
        search: searchQuery || undefined,
        pagination: { page: pagination.page, limit: pagination.limit },
        sorting: { field: "created_at", direction: "desc" },
      })
      const response: any = await apiService.leads.getAll(
        { filter: globalFilter },
        { headers: { "Content-Type": "application/json" } }
      )
      const responseData = response?.data
      let data: any[] = []
      let paginationData: any = null
      
      if (responseData?.success) {
        if (responseData?.data?.data) {
          data = responseData.data.data
          paginationData = responseData.data.pagination
        } else if (Array.isArray(responseData?.data)) {
          data = responseData.data
        }
      } else if (responseData?.data) {
        data = Array.isArray(responseData.data) ? responseData.data : []
        paginationData = responseData.pagination
      } else if (Array.isArray(responseData)) {
        data = responseData
      }
      
      if (paginationData) {
        setPagination({
          page: paginationData.page || 1,
          limit: paginationData.limit || 25,
          total: paginationData.total || data.length,
        })
      }
      
      console.log(`Fetched ${data.length} leads`)
      setLeads(data)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch leads")
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      // Optimistic update
      const oldLeads = [...leads]
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l))

      await apiService.leads.update(leadId, { status: newStatus })
      toast({ title: "Lead status updated" })
      fetchLeads() // Refresh to ensure synchronization
    } catch (err: any) {
      console.error("Failed to update lead status", err)
      toast({ title: "Failed to update lead status", variant: "destructive" })
      fetchLeads() // Revert on failure
    }
  }

  const openEditLead = (lead: any) => {
    setEditingLead(lead)
    setShowAddDialog(true)
  }

  const confirmDeleteLead = (lead: any) => {
    setDeleteTarget(lead)
  }

  const handleDeleteLead = async () => {
    if (!deleteTarget) return
    try {
      await apiService.leads.delete(deleteTarget.id)
      toast({ title: "Lead deleted" })
      setDeleteTarget(null)
      fetchLeads()
    } catch (err: any) {
      console.error("Failed to delete lead", err)
      toast({ title: "Failed to delete lead", variant: "destructive" })
    }
  }

  const filteredLeads = leads

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search by TID, name, email…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        extraActions={
          <>
            <div className="flex items-center gap-1 bg-muted p-1 rounded-md mr-2">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => setViewMode("table")}
              >
                Table View
              </Button>
              <Button
                variant={viewMode === "pipeline" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 text-xs px-3"
                onClick={() => setViewMode("pipeline")}
              >
                Pipeline View
              </Button>
            </div>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <UploadCloud className="h-4 w-4 mr-2" />
              Import Leads
            </Button>
          </>
        }
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        }
      />

      {/* Leads Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredLeads.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <UserPlus className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {leads.length === 0 ? "No leads yet" : "No leads match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {leads.length === 0 
                ? "Start building your sales pipeline by adding your first lead. Track prospects, convert them to clients, and manage deals."
                : "Try adjusting your search or filter criteria to find leads."}
            </p>
            {leads.length === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Lead
              </Button>
            )}
          </div>
        </Card>
      ) : viewMode === "pipeline" ? (
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <CRMDealPipeline 
            leads={filteredLeads} 
            onLeadClick={(lead) => {
              setSelectedLead(lead)
              setShowSideDrawer(true)
            }} 
            onStatusChange={handleStatusChange}
          />
        </Suspense>
      ) : (
        <Card className="p-0">
          <div className="p-4 border-b">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredLeads.length}</span> of <span className="font-semibold text-foreground">{leads.length}</span> leads
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TID</TableHead>
                <TableHead>Lead Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-muted/50">
                  <TableCell>
                    <span className="font-mono text-xs">{lead.tid || "—"}</span>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase flex-shrink-0">
                        {lead.name
                          ?.split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="font-semibold">{lead.name || "N/A"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lead.status === "new"
                          ? "secondary"
                          : lead.status === "qualified"
                            ? "default"
                            : lead.status === "negotiation"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {lead.status || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {lead.source ? (
                      <Badge variant="outline">{lead.source}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[200px]">{lead.email || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.phone || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.interest ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.interest}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{lead.budget || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span>{lead.assignedTo || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {lead.createdDate ? new Date(lead.createdDate).toLocaleDateString() : "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            openEditLead(lead)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {lead.status !== "converted" && (
                          <DropdownMenuItem
                            onSelect={async (event) => {
                              event.preventDefault()
                              try {
                                await apiService.leads.convertToClient(lead.id)
                                toast({ title: "Lead converted to client successfully", variant: "success" })
                                fetchLeads()
                              } catch (err: any) {
                                console.error("Failed to convert lead", err)
                                toast({ 
                                  title: "Failed to convert lead", 
                                  description: err.response?.data?.error || err.response?.data?.message || "An error occurred",
                                  variant: "destructive" 
                                })
                              }
                            }}
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Convert to Client
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            confirmDeleteLead(lead)
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Lead Dialog controlled by LeadCreationController */}
      <LeadCreationController
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingLead(null)
          }
          setShowAddDialog(open)
        }}
        onSuccess={fetchLeads}
        initialData={editingLead}
        mode={editingLead ? "edit" : "create"}
      />

      {/* Lead Import Dialog (staging-first pipeline) */}
      <LeadImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={fetchLeads}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLead}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="lead"
        module="leads"
        entityDisplayName="Leads"
        filters={toExportFilters(activeFilters, "leads")}
        search={searchQuery || undefined}
        pagination={{ page: pagination.page, pageSize: pagination.limit }}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="leads"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("leads", undefined, filters)
          toast({ title: "Filters applied" })
        }}
      />

      <LeadSideDrawer
        lead={selectedLead}
        open={showSideDrawer}
        onOpenChange={setShowSideDrawer}
        onOpenFullProfile={(lead) => {
          setShowSideDrawer(false)
          router.push(`/details/leads?id=${lead.id}`)
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
