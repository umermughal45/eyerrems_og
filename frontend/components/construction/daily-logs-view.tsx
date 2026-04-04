"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2,
  Plus,
  Eye,
  CheckCircle,
  Search,
  Calendar,
  FileText,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface DailyLog {
  id: string
  projectId: string
  logDate: string
  weather?: string
  siteActivities?: string[]
  laborHours: number
  equipmentHours: number
  notes?: string
  attachments?: any
  status: string
  submittedBy?: string
  approvedBy?: string
  approvedAt?: string
  project?: {
    id: string
    code: string
    name: string
  }
}

export function DailyLogsView() {
  const { toast } = useToast()
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null)
  const [projects, setProjects] = useState<any[]>([])

  const [formData, setFormData] = useState({
    projectId: "",
    logDate: format(new Date(), "yyyy-MM-dd"),
    weather: "",
    siteActivities: [] as string[],
    laborHours: 0,
    equipmentHours: 0,
    notes: "",
    newActivity: "",
  })

  const fetchProjects = async () => {
    try {
      const response = await apiService.construction.projects.getAll({ limit: 100 })
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setProjects(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    }
  }

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: 10,
      }
      if (projectFilter !== "all") params.projectId = projectFilter
      if (statusFilter !== "all") params.status = statusFilter
      if (fromDate) params.fromDate = fromDate
      if (toDate) params.toDate = toDate

      const response = await apiService.construction.dailyLogs.getAll(params)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setLogs(responseData.data || responseData || [])
        setTotalPages(responseData.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error("Error fetching daily logs:", error)
      toast({
        title: "Error",
        description: "Failed to fetch daily logs",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, projectFilter, statusFilter, fromDate, toDate, toast])

  useEffect(() => {
    fetchProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const handleAdd = () => {
    setFormData({
      projectId: "",
      logDate: format(new Date(), "yyyy-MM-dd"),
      weather: "",
      siteActivities: [],
      laborHours: 0,
      equipmentHours: 0,
      notes: "",
      newActivity: "",
    })
    setShowAddDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        projectId: formData.projectId,
        logDate: new Date(formData.logDate).toISOString(),
        weather: formData.weather || undefined,
        siteActivities: formData.siteActivities.length > 0 ? formData.siteActivities : undefined,
        laborHours: formData.laborHours,
        equipmentHours: formData.equipmentHours,
        notes: formData.notes || undefined,
      }

      await apiService.construction.dailyLogs.create(data)
      toast({
        title: "Success",
        description: "Daily log created successfully",
      })
      setShowAddDialog(false)
      fetchLogs()
    } catch (error: any) {
      console.error("Error creating daily log:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create daily log",
        variant: "destructive",
      })
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this daily log? It will become read-only.")) return

    try {
      await apiService.construction.dailyLogs.approve(id)
      toast({
        title: "Success",
        description: "Daily log approved successfully",
      })
      fetchLogs()
    } catch (error: any) {
      console.error("Error approving daily log:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to approve daily log",
        variant: "destructive",
      })
    }
  }

  const handleView = (log: DailyLog) => {
    setSelectedLog(log)
    setShowViewDialog(true)
  }

  const addActivity = () => {
    if (formData.newActivity.trim()) {
      setFormData({
        ...formData,
        siteActivities: [...formData.siteActivities, formData.newActivity.trim()],
        newActivity: "",
      })
    }
  }

  const removeActivity = (index: number) => {
    setFormData({
      ...formData,
      siteActivities: formData.siteActivities.filter((_, i) => i !== index),
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      draft: "secondary",
      submitted: "outline",
      approved: "default",
      locked: "destructive",
    }
    return <Badge variant={variants[status] || "default"}>{status}</Badge>
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code} - {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label>From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label>To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Daily Log
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No daily logs found</p>
            <Button onClick={handleAdd} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add First Daily Log
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Weather</TableHead>
                  <TableHead>Labor Hours</TableHead>
                  <TableHead>Equipment Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs
                  .filter(
                    (log) =>
                      !searchTerm ||
                      log.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      log.notes?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        {format(new Date(log.logDate), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        {log.project ? (
                          <span className="text-sm">
                            {log.project.code} - {log.project.name}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{log.weather || "-"}</TableCell>
                      <TableCell>{log.laborHours.toFixed(1)}</TableCell>
                      <TableCell>{log.equipmentHours.toFixed(1)}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {log.status === "draft" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(log.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Daily Log</DialogTitle>
            <DialogDescription>Record daily activities, weather, and hours for a project. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="projectId">Project *</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logDate">Date *</Label>
                <Input
                  id="logDate"
                  type="date"
                  value={formData.logDate}
                  onChange={(e) => setFormData({ ...formData, logDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weather">Weather</Label>
              <Input
                id="weather"
                value={formData.weather}
                onChange={(e) => setFormData({ ...formData, weather: e.target.value })}
                placeholder="e.g., Sunny, Cloudy, Rainy"
              />
            </div>

            <div className="space-y-2">
              <Label>Site Activities</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.newActivity}
                  onChange={(e) => setFormData({ ...formData, newActivity: e.target.value })}
                  placeholder="Add activity..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addActivity()
                    }
                  }}
                />
                <Button type="button" onClick={addActivity}>
                  Add
                </Button>
              </div>
              {formData.siteActivities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.siteActivities.map((activity, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {activity}
                      <button
                        type="button"
                        onClick={() => removeActivity(index)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="laborHours">Labor Hours</Label>
                <Input
                  id="laborHours"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.laborHours}
                  onChange={(e) => setFormData({ ...formData, laborHours: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipmentHours">Equipment Hours</Label>
                <Input
                  id="equipmentHours"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.equipmentHours}
                  onChange={(e) => setFormData({ ...formData, equipmentHours: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={4}
                placeholder="Additional notes about the day..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Daily Log Details</DialogTitle>
            <DialogDescription>View detailed information about the daily log entry.</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p>{format(new Date(selectedLog.logDate), "MMM dd, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Project</Label>
                  <p>
                    {selectedLog.project
                      ? `${selectedLog.project.code} - ${selectedLog.project.name}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Weather</Label>
                  <p>{selectedLog.weather || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div>{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Labor Hours</Label>
                  <p>{selectedLog.laborHours.toFixed(1)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Equipment Hours</Label>
                  <p>{selectedLog.equipmentHours.toFixed(1)}</p>
                </div>
              </div>
              {selectedLog.siteActivities && selectedLog.siteActivities.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Site Activities</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(selectedLog.siteActivities as string[]).map((activity, index) => (
                      <Badge key={index} variant="secondary">
                        {activity}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedLog.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1">{selectedLog.notes}</p>
                </div>
              )}
              {selectedLog.approvedAt && (
                <div>
                  <Label className="text-muted-foreground">Approved At</Label>
                  <p>{format(new Date(selectedLog.approvedAt), "MMM dd, yyyy HH:mm")}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {selectedLog?.status === "draft" && (
              <Button onClick={() => selectedLog && handleApprove(selectedLog.id)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
