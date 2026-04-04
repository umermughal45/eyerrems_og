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
  CheckCircle,
  Search,
  Wrench,
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

interface Equipment {
  id: string
  code: string
  name: string
  type?: string
  make?: string
  model?: string
  serialNumber?: string
  hourlyRate?: number
  dailyRate?: number
  costingMethod: string
  isActive: boolean
}

interface EquipmentUsage {
  id: string
  projectId: string
  costCodeId: string
  equipmentId: string
  usageDate: string
  hours?: number
  days?: number
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
  equipment?: Equipment
}

export function EquipmentView() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("usage")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [usages, setUsages] = useState<EquipmentUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [costCodes, setCostCodes] = useState<any[]>([])

  const [formData, setFormData] = useState({
    projectId: "",
    costCodeId: "",
    equipmentId: "",
    usageDate: format(new Date(), "yyyy-MM-dd"),
    hours: 0,
    days: 0,
    amount: 0,
    description: "",
  })

  const [equipmentFormData, setEquipmentFormData] = useState({
    code: "",
    name: "",
    type: "",
    make: "",
    model: "",
    serialNumber: "",
    hourlyRate: 0,
    dailyRate: 0,
    costingMethod: "hourly",
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

  const fetchEquipment = async () => {
    try {
      setLoading(true)
      const response = await apiService.construction.equipment.getAll()
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setEquipment(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching equipment:", error)
      toast({
        title: "Error",
        description: "Failed to fetch equipment",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchUsages = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: 10,
      }
      if (projectFilter !== "all") params.projectId = projectFilter
      if (equipmentFilter !== "all") params.equipmentId = equipmentFilter
      if (statusFilter !== "all") params.status = statusFilter

      const response = await apiService.construction.equipmentUsage.getAll(params)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setUsages(responseData.data || responseData || [])
        setTotalPages(responseData.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error("Error fetching equipment usage:", error)
      toast({
        title: "Error",
        description: "Failed to fetch equipment usage",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, projectFilter, equipmentFilter, statusFilter, toast])

  useEffect(() => {
    fetchProjects()
    fetchCostCodes()
    if (activeTab === "usage") {
      fetchUsages()
    } else {
      fetchEquipment()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "usage") {
      fetchUsages()
    }
  }, [activeTab, fetchUsages])

  const handleAdd = () => {
    setFormData({
      projectId: "",
      costCodeId: "",
      equipmentId: "",
      usageDate: format(new Date(), "yyyy-MM-dd"),
      hours: 0,
      days: 0,
      amount: 0,
      description: "",
    })
    setShowAddDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        projectId: formData.projectId,
        costCodeId: formData.costCodeId,
        equipmentId: formData.equipmentId,
        usageDate: new Date(formData.usageDate).toISOString(),
        hours: formData.hours > 0 ? formData.hours : undefined,
        days: formData.days > 0 ? formData.days : undefined,
        description: formData.description || undefined,
      }

      await apiService.construction.equipmentUsage.create(data)
      toast({
        title: "Success",
        description: "Equipment usage created successfully",
      })
      setShowAddDialog(false)
      fetchUsages()
    } catch (error: any) {
      console.error("Error creating equipment usage:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create equipment usage",
        variant: "destructive",
      })
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this equipment usage? It will post to finance.")) return

    try {
      await apiService.construction.equipmentUsage.approve(id)
      toast({
        title: "Success",
        description: "Equipment usage approved and posted to finance",
      })
      fetchUsages()
    } catch (error: any) {
      console.error("Error approving equipment usage:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to approve equipment usage",
        variant: "destructive",
      })
    }
  }

  const handleEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        code: equipmentFormData.code,
        name: equipmentFormData.name,
        type: equipmentFormData.type || undefined,
        make: equipmentFormData.make || undefined,
        model: equipmentFormData.model || undefined,
        serialNumber: equipmentFormData.serialNumber || undefined,
        hourlyRate: equipmentFormData.hourlyRate > 0 ? equipmentFormData.hourlyRate : undefined,
        dailyRate: equipmentFormData.dailyRate > 0 ? equipmentFormData.dailyRate : undefined,
        costingMethod: equipmentFormData.costingMethod,
      }

      await apiService.construction.equipment.create(data)
      toast({
        title: "Success",
        description: "Equipment created successfully",
      })
      setShowEquipmentDialog(false)
      fetchEquipment()
    } catch (error: any) {
      console.error("Error creating equipment:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create equipment",
        variant: "destructive",
      })
    }
  }

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
          <TabsTrigger value="usage">Equipment Usage</TabsTrigger>
          <TabsTrigger value="equipment">Equipment Master</TabsTrigger>
        </TabsList>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search usage..."
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
              <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Equipment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Equipment</SelectItem>
                  {equipment
                    .filter((e) => e.isActive)
                    .map((eq) => (
                      <SelectItem key={eq.id} value={eq.id}>
                        {eq.code} - {eq.name}
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
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add Usage
              </Button>
            </div>
          </Card>

          {/* Table */}
          <Card>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : usages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No equipment usage found</p>
                <Button onClick={handleAdd} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Usage
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usages
                      .filter(
                        (usage) =>
                          !searchTerm ||
                          usage.project?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          usage.equipment?.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((usage) => (
                        <TableRow key={usage.id}>
                          <TableCell>
                            {format(new Date(usage.usageDate), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            {usage.project ? (
                              <span className="text-sm">
                                {usage.project.code} - {usage.project.name}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {usage.equipment ? (
                              <span className="text-sm">{usage.equipment.name}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {usage.costCode ? (
                              <span className="text-sm">
                                {usage.costCode.code} - {usage.costCode.name}
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {usage.hours !== undefined && usage.hours > 0
                              ? `${usage.hours.toFixed(1)} hrs`
                              : usage.days !== undefined && usage.days > 0
                              ? `${usage.days.toFixed(1)} days`
                              : "-"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(usage.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(usage.status)}</TableCell>
                          <TableCell className="text-right">
                            {usage.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleApprove(usage.id)}
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

        {/* Equipment Master Tab */}
        <TabsContent value="equipment" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Equipment Master</h3>
              <Button
                onClick={() => {
                  setEquipmentFormData({
                    code: "",
                    name: "",
                    type: "",
                    make: "",
                    model: "",
                    serialNumber: "",
                    hourlyRate: 0,
                    dailyRate: 0,
                    costingMethod: "hourly",
                  })
                  setShowEquipmentDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : equipment.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No equipment found</p>
                <Button
                  onClick={() => {
                    setEquipmentFormData({
                      code: "",
                      name: "",
                      type: "",
                      make: "",
                      model: "",
                      serialNumber: "",
                      hourlyRate: 0,
                      dailyRate: 0,
                      costingMethod: "hourly",
                    })
                    setShowEquipmentDialog(true)
                  }}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Equipment
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead>Costing Method</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-mono text-sm">{eq.code}</TableCell>
                      <TableCell className="font-medium">{eq.name}</TableCell>
                      <TableCell>{eq.type || "-"}</TableCell>
                      <TableCell>
                        {eq.make || eq.model
                          ? `${eq.make || ""} ${eq.model || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{eq.costingMethod}</Badge>
                      </TableCell>
                      <TableCell>
                        {eq.costingMethod === "hourly"
                          ? eq.hourlyRate
                            ? formatCurrency(eq.hourlyRate)
                            : "-"
                          : eq.dailyRate
                          ? formatCurrency(eq.dailyRate)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={eq.isActive ? "default" : "secondary"}>
                          {eq.isActive ? "Active" : "Inactive"}
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

      {/* Add Usage Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Equipment Usage</DialogTitle>
            <DialogDescription>Record equipment usage for a project. Fields marked with * are required.</DialogDescription>
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
                <Label htmlFor="equipmentId">Equipment *</Label>
                <Select
                  value={formData.equipmentId}
                  onValueChange={(value) => setFormData({ ...formData, equipmentId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment
                      .filter((e) => e.isActive)
                      .map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.code} - {eq.name} ({eq.costingMethod})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="usageDate">Usage Date *</Label>
                <Input
                  id="usageDate"
                  type="date"
                  value={formData.usageDate}
                  onChange={(e) => setFormData({ ...formData, usageDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hours">Hours (for hourly costing)</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Days (for daily costing)</Label>
                <Input
                  id="days"
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: parseFloat(e.target.value) || 0 })}
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

      {/* Add Equipment Dialog */}
      <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Equipment</DialogTitle>
            <DialogDescription>Create a new equipment master record. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEquipmentSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="equipmentCode">Code *</Label>
                <Input
                  id="equipmentCode"
                  value={equipmentFormData.code}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, code: e.target.value })}
                  required
                  placeholder="e.g., EQ-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipmentName">Name *</Label>
                <Input
                  id="equipmentName"
                  value={equipmentFormData.name}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="equipmentType">Type</Label>
                <Input
                  id="equipmentType"
                  value={equipmentFormData.type}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, type: e.target.value })}
                  placeholder="e.g., Excavator, Crane"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costingMethod">Costing Method *</Label>
                <Select
                  value={equipmentFormData.costingMethod}
                  onValueChange={(value) => setEquipmentFormData({ ...equipmentFormData, costingMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make</Label>
                <Input
                  id="make"
                  value={equipmentFormData.make}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, make: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={equipmentFormData.model}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, model: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number</Label>
              <Input
                id="serialNumber"
                value={equipmentFormData.serialNumber}
                onChange={(e) => setEquipmentFormData({ ...equipmentFormData, serialNumber: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={equipmentFormData.hourlyRate}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, hourlyRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyRate">Daily Rate</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={equipmentFormData.dailyRate}
                  onChange={(e) => setEquipmentFormData({ ...equipmentFormData, dailyRate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEquipmentDialog(false)}>
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
