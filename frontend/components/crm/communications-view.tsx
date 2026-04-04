"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  Loader2,
  MoreVertical,
  Pencil,
  Trash,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AddCommunicationDialog } from "./add-communication-dialog"
import { apiService } from "@/lib/api"
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

export function CommunicationsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [communications, setCommunications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<string>("all")
  const [editingCommunication, setEditingCommunication] = useState<any | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchCommunications()
  }, [])

  const fetchCommunications = async () => {
    try {
      setLoading(true)
      setError(null)
      const response: any = await apiService.communications.getAll()
      const responseData = response.data as any
      const data = Array.isArray(responseData?.data) ? responseData.data : Array.isArray(responseData) ? responseData : []
      const mapped = Array.isArray(data) ? data.map((c: any) => {
        const firstLine = typeof c.content === "string" ? c.content.split("\n")[0] : ""
        const clientName =
          (typeof c.client === "string" ? c.client : c.client?.name) ??
          (typeof c.clientName === "string" ? c.clientName : "")
        const leadName =
          (typeof c.lead === "string" ? c.lead : c.lead?.name) ??
          (typeof c.leadName === "string" ? c.leadName : "")

        return {
          id: c.id,
          type: c.channel,
          subject: firstLine || "Communication",
          contact: clientName || leadName || c.contactName || "",
          agent: c.agent || "",
          date: c.createdAt ? new Date(c.createdAt).toLocaleString() : "",
          status: c.status || "completed",
          notes: typeof c.content === "string" ? c.content : "",
          clientId: c.clientId,
          rawDate: c.createdAt,
          content: c.content,
        }
      }) : []
      setCommunications(mapped)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch communications")
      setCommunications([])
    } finally {
      setLoading(false)
    }
  }

  const filteredCommunications = communications.filter((comm) => {
    const matchesSearch =
      comm.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.contact?.toLowerCase().includes(searchQuery.toLowerCase())

    const type = (comm.type || "").toLowerCase()
    const matchesChannel = channelFilter === "all" || type === channelFilter

    return matchesSearch && matchesChannel
  })

  const handleEditCommunication = (communication: any) => {
    setEditingCommunication(communication)
    setShowAddDialog(true)
  }

  const confirmDeleteCommunication = (communication: any) => {
    setDeleteTarget(communication)
  }

  const handleDeleteCommunication = async () => {
    if (!deleteTarget) return
    try {
      await apiService.communications.delete(deleteTarget.id)
      toast({ title: "Communication deleted" })
      setDeleteTarget(null)
      fetchCommunications()
    } catch (err: any) {
      console.error("Failed to delete communication", err)
      toast({ title: "Failed to delete communication", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search communications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "all", label: "All" },
            { value: "email", label: "Email" },
            { value: "call", label: "Call" },
            { value: "meeting", label: "Meeting" },
          ].map((filter) => (
            <Button
              key={filter.value}
              variant={channelFilter === filter.value ? "default" : "outline"}
              onClick={() => setChannelFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Activity
          </Button>
        </div>
      </div>

      {/* Communications List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredCommunications.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {communications.length === 0 ? "No communications yet" : "No communications match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {communications.length === 0 
                ? "Log communications with leads, clients, and deals to track all interactions and maintain a complete history."
                : "Try adjusting your search or filter criteria"}
            </p>
            {communications.length === 0 && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Log Your First Communication
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCommunications.map((comm) => (
            <Card key={comm.id} className="p-6">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    comm.type === "email" ? "bg-primary/10" : comm.type === "call" ? "bg-success/10" : "bg-warning/10",
                  )}
                >
                  {comm.type === "email" && <Mail className="h-5 w-5 text-primary" />}
                  {comm.type === "call" && <Phone className="h-5 w-5 text-success" />}
                  {comm.type === "meeting" && <MessageSquare className="h-5 w-5 text-warning" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{comm.subject}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="capitalize">
                          {comm.type}
                        </Badge>
                        <Badge variant={comm.status === "completed" ? "default" : "outline"}>{comm.status}</Badge>
                      </div>
                    </div>
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
                            handleEditCommunication(comm)
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault()
                            confirmDeleteCommunication(comm)
                          }}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <p className="font-medium text-foreground mt-1">{comm.contact}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Agent</p>
                      <p className="font-medium text-foreground mt-1">{comm.agent}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date & Time</p>
                      <div className="flex items-center gap-1 text-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        {comm.date}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-line">{comm.notes}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddCommunicationDialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCommunication(null)
          }
          setShowAddDialog(open)
        }}
        onSuccess={fetchCommunications}
        initialData={
          editingCommunication
            ? {
                id: editingCommunication.id,
                clientId:
                  editingCommunication.clientId || editingCommunication.client?.id || editingCommunication.clientId,
                channel: editingCommunication.type,
                content: editingCommunication.content || editingCommunication.notes,
                createdAt: editingCommunication.rawDate || editingCommunication.createdAt,
              }
            : null
        }
        mode={editingCommunication ? "edit" : "create"}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Communication</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this communication? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCommunication}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
