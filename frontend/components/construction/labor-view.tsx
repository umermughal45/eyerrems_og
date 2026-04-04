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
  Edit,
  CheckCircle,
  Search,
  Users,
  DollarSign,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"

interface Crew {
  id: string
  code: string
  name: string
  description?: string
  crewLeadId?: string
  isActive: boolean
}

interface LaborEntry {
  id: string
  projectId: string
  costCodeId: string
  crewId?: string
  employeeId?: string
  workDate: string
  hours: number
  rate?: number
  amount: number
  description?: string
  status: string
  approvedBy?: string
  approvedAt?: string
  journalEntryId?: string
  project?: {
    id: string
    code: string
    name: string
  }
  costCode?: {
    id: string
    code: string
    name: string
  }
  crew?: Crew
}

export function LaborView() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("entries")
  const [laborEntries, setLaborEntries] = useState<LaborEntry[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCrewDialog, setShowCrewDialog] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [costCodes, setCostCodes] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])

  const [formData, setFormData] = useState({
    projectId: "",
    costCodeId: "",
    crewId: "",
    employeeId: "",
    workDate: format(new Date(), "yyyy-MM-dd"),
    hours: 0,
    rate: 0,
    amount: 0,
    description: "",
  })

  const [crewFormData, setCrewFormData] = useState({
    code: "",
    name: "",
    description: "",
    crewLeadId: "",
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

  const fetchCostCodes = async () => {
    try {
      const response = await apiService.construction.costCodes.getAll()
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setCostCodes(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching cost codes:", error)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await apiService.employees.getAll({ limit: 100 })
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setEmployees(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching employees:", error)
    }
  }

  const fetchCrews = async () => {
    try {
      setLoading(true)
      const response = await apiService.construction.crews.getAll()
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setCrews(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching crews:", error)
      toast({
        title: "Error",
        description: "Failed to fetch crews",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchLaborEntries = useCallback(async () => {
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

      const response = await apiService.construction.labor.getAll(params)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setLaborEntries(responseData.data || responseData || [])
        setTotalPages(responseData.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error("Error fetching labor entries:", error)
      toast({
        title: "Error",
        description: "Failed to fetch labor entries",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, projectFilter, statusFilter, fromDate, toDate, toast])

  useEffect(() => {
    fetchProjects()
    fetchCostCodes()
    fetchEmployees()
    if (activeTab === "entries") {
      fetchLaborEntries()
    } else {
      fetchCrews()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "entries") {
      fetchLaborEntries()
    }
  }, [activeTab, fetchLaborEntries])

  const handleAdd = () => {
    setFormData({
      projectId: "",
      costCodeId: "",
      crewId: "",
      employeeId: "",
      workDate: format(new Date(), "yyyy-MM-dd"),
      hours: 0,
      rate: 0,
      amount: 0,
      description: "",
    })
    setShowAddDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Calculate amount if not provided
      const amount = formData.amount || (formData.hours * formData.rate)

      const data = {
        projectId: formData.projectId,
        costCodeId: formData.costCodeId,
        crewId: formData.crewId || undefined,
        employeeId: formData.employeeId || undefined,
        workDate: new Date(formData.workDate).toISOString(),
        hours: formData.hours,
        rate: formData.rate || undefined,
        amount: amount,
        description: formData.description || undefined,
      }

      await apiService.construction.labor.create(data)
      toast({
        title: "Success",
        description: "Labor entry created successfully",
      })
      setShowAddDialog(false)
      fetchLaborEntries()
    } catch (error: any) {
      console.error("Error creating labor entry:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create labor entry",
        variant: "destructive",
      })
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this labor entry? It will post to finance.")) return

    try {
      await apiService.construction.labor.approve(id)
      toast({
        title: "Success",
        description: "Labor entry approved and posted to finance",
      })
      fetchLaborEntries()
    } catch (error: any) {
      console.error("Error approving labor entry:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to approve labor entry",
        variant: "destructive",
      })
    }
  }

  const handleCrewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        code: crewFormData.code,
        name: crewFormData.name,
        description: crewFormData.description || undefined,
        crewLeadId: crewFormData.crewLeadId || undefined,
      }

      await apiService.construction.crews.create(data)
      toast({
        title: "Success",
        description: "Crew created successfully",
      })
      setShowCrewDialog(false)
      fetchCrews()
    } catch (error: any) {
      console.error("Error creating crew:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create crew",
        variant: "destructive",
      })
    }
  }

  // Calculate amount when hours or rate changes
  useEffect(() => {
    if (formData.hours > 0 && formData.rate > 0) {
      setFormData((prev) => ({
        ...prev,
        amount: prev.hours * prev.rate,
      }))
    }
  }, [formData.hours, formData.rate])

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      draft: "secondary",
      approved: "outline",
      posted: "default",
    }
    return <Badge variant={variants[status] || "default"}>{status}</Badge>
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="entries">Labor Entries</TabsTrigger>
          <TabsTrigger value="crews">Crews</TabsTrigger>
        </TabsList>

        {/* Labor Entries Tab */}
        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entries..."
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
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="posted">Posted</SelectItem>
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
                    Add Labor Entry
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
            ) : laborEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No labor entries found</p>
                <Button onClick={handleAdd} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Entry
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Crew/Employee</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {laborEntries
                      .filter(
                        (entry) =>
                          !searchTerm ||
                          entry.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          entry.costCode?.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            {format(new Date(entry.workDate), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            {entry.project ? (
                              <span className="text-sm">
                                {entry.project.code} - {entry.project.name}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.costCode ? (
                              <span className="text-sm">
                                {entry.costCode.code} - {entry.costCode.name}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {entry.crew ? (
                              <span className="text-sm">{entry.crew.name}</span>
                            ) : entry.employeeId ? (
                              <span className="text-sm">Employee</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>{entry.hours.toFixed(1)}</TableCell>
                          <TableCell>
                            {entry.rate ? formatCurrency(entry.rate) : "-"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(entry.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(entry.status)}</TableCell>
                          <TableCell className="text-right">
                            {entry.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(entry.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
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
        </TabsContent>

        {/* Crews Tab */}
        <TabsContent value="crews" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Crews</h3>
              <Button onClick={() => {
                setCrewFormData({
                  code: "",
                  name: "",
                  description: "",
                  crewLeadId: "",
                })
                setShowCrewDialog(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Crew
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : crews.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No crews found</p>
                <Button
                  onClick={() => {
                    setCrewFormData({
                      code: "",
                      name: "",
                      description: "",
                      crewLeadId: "",
                    })
                    setShowCrewDialog(true)
                  }}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Crew
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crews.map((crew) => (
                    <TableRow key={crew.id}>
                      <TableCell className="font-mono text-sm">{crew.code}</TableCell>
                      <TableCell className="font-medium">{crew.name}</TableCell>
                      <TableCell>{crew.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={crew.isActive ? "default" : "secondary"}>
                          {crew.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Labor Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Labor Entry</DialogTitle>
            <DialogDescription>Record labor hours for a project. Fields marked with * are required.</DialogDescription>
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
                <Label htmlFor="costCodeId">Cost Code *</Label>
                <Select
                  value={formData.costCodeId}
                  onValueChange={(value) => setFormData({ ...formData, costCodeId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCodes
                      .filter((cc) => cc.isActive)
                      .map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.code} - {cc.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crewId">Crew (Optional)</Label>
                <Select
                  value={formData.crewId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, crewId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select crew" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {crews
                      .filter((c) => c.isActive)
                      .map((crew) => (
                        <SelectItem key={crew.id} value={crew.id}>
                          {crew.code} - {crew.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee (Optional)</Label>
                <Select
                  value={formData.employeeId || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, employeeId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.employeeId} - {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workDate">Work Date *</Label>
                <Input
                  id="workDate"
                  type="date"
                  value={formData.workDate}
                  onChange={(e) => setFormData({ ...formData, workDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Hours *</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">Rate (per hour)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
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

      {/* Add Crew Dialog */}
      <Dialog open={showCrewDialog} onOpenChange={setShowCrewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Crew</DialogTitle>
            <DialogDescription>Create a new crew for labor management. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCrewSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="crewCode">Code *</Label>
                <Input
                  id="crewCode"
                  value={crewFormData.code}
                  onChange={(e) => setCrewFormData({ ...crewFormData, code: e.target.value })}
                  required
                  placeholder="e.g., CREW-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crewName">Name *</Label>
                <Input
                  id="crewName"
                  value={crewFormData.name}
                  onChange={(e) => setCrewFormData({ ...crewFormData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="crewLeadId">Crew Lead (Optional)</Label>
              <Select
                value={crewFormData.crewLeadId || "__none__"}
                onValueChange={(value) => setCrewFormData({ ...crewFormData, crewLeadId: value === "__none__" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select crew lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.employeeId} - {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="crewDescription">Description</Label>
              <Textarea
                id="crewDescription"
                value={crewFormData.description}
                onChange={(e) => setCrewFormData({ ...crewFormData, description: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCrewDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
