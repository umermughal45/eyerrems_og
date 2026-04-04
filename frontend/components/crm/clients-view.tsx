"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Mail, Phone, Building2, Loader2, Plus, MoreVertical, Pencil, Trash, Users, FileText, Eye, Search } from "lucide-react"
import { apiService } from "@/lib/api"
import { AddClientDialog } from "./add-client-dialog"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { DownloadReportDialog } from "@/components/ui/download-report-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TransactionHeader } from "@/components/shared/transaction-header"
import { TransactionTimeline } from "@/components/shared/transaction-timeline"
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

export function ClientsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [editingClient, setEditingClient] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("clients", undefined) || {})
  const [timelineTarget, setTimelineTarget] = useState<any | null>(null)
  const [showTimelineDialog, setShowTimelineDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchClients()
  }, [searchQuery, activeFilters])

  const fetchClients = async () => {
    try {
      setLoading(true)
      setError(null)
      const filters = toSimpleFilters(activeFilters)
      const params: { search?: string; status?: string | string[]; clientType?: string | string[] } = {
        search: searchQuery || undefined,
      }
      if (filters.status) params.status = filters.status as string | string[]
      if (filters.clientType) params.clientType = filters.clientType as string | string[]
      const response: any = await apiService.clients.getAll(params)
      const responseData = response.data as any

      // Handle different response formats
      let data: any[] = []
      if (responseData?.success && Array.isArray(responseData?.data)) {
        data = responseData.data
      } else if (Array.isArray(responseData?.data)) {
        data = responseData.data
      } else if (Array.isArray(responseData)) {
        data = responseData
      }

      const mapped = Array.isArray(data) ? data.map((c: any) => ({
        id: c.id,
        tid: c.tid || "-",
        name: c.name,
        email: c.email || "",
        phone: c.phone || "",
        company: c.company || "",
        type: c.company ? "Corporate" : "Individual",
        status: c.status || "active",
        createdAt: c.createdAt,
      })) : []
      setClients(mapped)
    } catch (err: any) {
      console.error("Failed to fetch clients:", err)
      const errorMessage = err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch clients"

      // Log detailed error for debugging
      console.log("Error details:", {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      })

      setError(`${errorMessage} ${err.response?.status ? `(${err.response.status})` : ''}`)
      setClients([])
      toast({
        title: "Error fetching clients",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredClients = clients

  const openClientDetails = (id: string) => {
    router.push(`/details/clients/${id}`)
  }

  const handleEditClient = (client: any) => {
    setEditingClient(client)
    setShowAddDialog(true)
  }

  const confirmDeleteClient = (client: any) => {
    setDeleteTarget(client)
  }

  const handleDeleteClient = async () => {
    if (!deleteTarget) return
    try {
      await apiService.clients.delete(deleteTarget.id)
      toast({ title: "Client deleted" })
      setDeleteTarget(null)
      fetchClients()
    } catch (err: any) {
      console.error("Failed to delete client", err)
      toast({ title: "Failed to delete client", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search by TID, name, email…"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        onDownloadClick={() => setShowDownloadDialog(true)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        }
      />

      {/* Clients Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredClients.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {clients.length === 0 ? "No clients yet" : "No clients match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {clients.length === 0
                ? "Convert qualified leads to clients or add clients directly. Clients can be linked to deals and properties."
                : "Try adjusting your search or filter criteria"}
            </p>
            {clients.length === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Client
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="p-4 border-b">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredClients.length}</span> of <span className="font-semibold text-foreground">{clients.length}</span> clients
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TID</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openClientDetails(client.id)}
                >
                  <TableCell>
                    <span className="font-mono text-sm">{client.tid}</span>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold uppercase flex-shrink-0">
                        {client.name
                          .split(" ")
                          .map((n: string) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold">{client.name}</p>
                        {client.status === "vip" && (
                          <Badge variant="default" className="mt-1 text-xs">VIP</Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{client.type}</Badge>
                  </TableCell>
                  <TableCell>
                    {client.company && client.company !== "-" ? (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{client.company}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[200px]">{client.email || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{client.phone || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="capitalize">{client.status || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            router.push(`/details/clients/${client.id}`)
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            router.push(`/ledger/client/${client.id}`)
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Open Ledger
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            handleEditClient(client)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            setTimelineTarget(client)
                            setShowTimelineDialog(true)
                          }}
                        >
                          <Search className="mr-2 h-4 w-4" />
                          View Lifecycle
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            confirmDeleteClient(client)
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
      <AddClientDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingClient(null)
          }
          setShowAddDialog(open)
        }}
        onSuccess={fetchClients}
        initialData={editingClient}
        mode={editingClient ? "edit" : "create"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DownloadReportDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        entity="client"
        module="clients"
        entityDisplayName="Clients"
        filters={toExportFilters(activeFilters, "clients")}
        search={searchQuery || undefined}
      />

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="clients"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("clients", undefined, filters)
          toast({ title: "Filters applied" })
        }}
      />

      <Dialog open={showTimelineDialog} onOpenChange={setShowTimelineDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Global Transaction Lifecycle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <TransactionHeader tid={timelineTarget?.tid} />
            <TransactionTimeline tid={timelineTarget?.tid} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
