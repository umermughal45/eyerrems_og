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
  Package,
  Warehouse,
  FileText,
  ArrowRight,
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

interface InventoryItem {
  id: string
  code: string
  name: string
  category?: string
  unit: string
  unitPrice?: number
  isActive: boolean
}

interface Warehouse {
  id: string
  code: string
  name: string
  location?: string
  isActive: boolean
}

interface GRN {
  id: string
  grnNumber: string
  warehouseId: string
  projectId?: string
  supplierName?: string
  receiptDate: string
  status: string
  notes?: string
  postedBy?: string
  postedAt?: string
  warehouse?: Warehouse
  project?: {
    id: string
    code: string
    name: string
  }
  items?: GRNItem[]
}

interface GRNItem {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  totalAmount: number
  item?: InventoryItem
}

interface Issue {
  id: string
  issueNumber: string
  projectId: string
  warehouseId: string
  costCodeId: string
  issueDate: string
  status: string
  notes?: string
  approvedBy?: string
  approvedAt?: string
  journalEntryId?: string
  project?: {
    id: string
    code: string
    name: string
  }
  warehouse?: Warehouse
  costCode?: {
    id: string
    code: string
    name: string
  }
  items?: IssueItem[]
}

interface IssueItem {
  id: string
  itemId: string
  quantity: number
  unitPrice: number
  totalAmount: number
  item?: InventoryItem
}

export function InventoryView() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("items")
  const [items, setItems] = useState<InventoryItem[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [grns, setGrns] = useState<GRN[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showItemDialog, setShowItemDialog] = useState(false)
  const [showWarehouseDialog, setShowWarehouseDialog] = useState(false)
  const [showGRNDialog, setShowGRNDialog] = useState(false)
  const [showIssueDialog, setShowIssueDialog] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("")
  const [projects, setProjects] = useState<any[]>([])
  const [costCodes, setCostCodes] = useState<any[]>([])

  const [itemFormData, setItemFormData] = useState({
    code: "",
    name: "",
    category: "",
    unit: "pcs",
    unitPrice: 0,
  })

  const [warehouseFormData, setWarehouseFormData] = useState({
    code: "",
    name: "",
    location: "",
  })

  const [grnFormData, setGrnFormData] = useState({
    warehouseId: "",
    projectId: "",
    supplierName: "",
    receiptDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    items: [] as Array<{ itemId: string; quantity: number; unitPrice: number }>,
  })

  const [issueFormData, setIssueFormData] = useState({
    projectId: "",
    warehouseId: "",
    costCodeId: "",
    issueDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    items: [] as Array<{ itemId: string; quantity: number }>,
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

  const fetchItems = async () => {
    try {
      setLoading(true)
      const response = await apiService.construction.inventory.items.getAll()
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setItems(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching items:", error)
      toast({
        title: "Error",
        description: "Failed to fetch items",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchWarehouses = async () => {
    try {
      setLoading(true)
      const response = await apiService.construction.inventory.warehouses.getAll()
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setWarehouses(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching warehouses:", error)
      toast({
        title: "Error",
        description: "Failed to fetch warehouses",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStock = async (warehouseId: string) => {
    try {
      const response = await apiService.construction.inventory.warehouses.getStock(warehouseId)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setStock(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching stock:", error)
    }
  }

  const fetchGRNs = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: 10,
      }
      if (projectFilter !== "all") params.projectId = projectFilter
      if (warehouseFilter !== "all") params.warehouseId = warehouseFilter
      if (statusFilter !== "all") params.status = statusFilter

      const response = await apiService.construction.grns.getAll(params)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setGrns(responseData.data || responseData || [])
        setTotalPages(responseData.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error("Error fetching GRNs:", error)
      toast({
        title: "Error",
        description: "Failed to fetch GRNs",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, projectFilter, warehouseFilter, statusFilter, toast])

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: 10,
      }
      if (projectFilter !== "all") params.projectId = projectFilter
      if (warehouseFilter !== "all") params.warehouseId = warehouseFilter
      if (statusFilter !== "all") params.status = statusFilter

      const response = await apiService.construction.issues.getAll(params)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setIssues(responseData.data || responseData || [])
        setTotalPages(responseData.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error("Error fetching issues:", error)
      toast({
        title: "Error",
        description: "Failed to fetch issues",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [page, projectFilter, warehouseFilter, statusFilter, toast])

  useEffect(() => {
    fetchProjects()
    fetchCostCodes()
    if (activeTab === "items") {
      fetchItems()
    } else if (activeTab === "warehouses") {
      fetchWarehouses()
    } else if (activeTab === "grns") {
      fetchGRNs()
    } else if (activeTab === "issues") {
      fetchIssues()
    }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "grns" || activeTab === "issues") {
      if (activeTab === "grns") {
        fetchGRNs()
      } else {
        fetchIssues()
      }
    }
  }, [activeTab, fetchGRNs, fetchIssues])

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        code: itemFormData.code,
        name: itemFormData.name,
        category: itemFormData.category || undefined,
        unit: itemFormData.unit,
        unitPrice: itemFormData.unitPrice > 0 ? itemFormData.unitPrice : undefined,
      }

      await apiService.construction.inventory.items.create(data)
      toast({
        title: "Success",
        description: "Item created successfully",
      })
      setShowItemDialog(false)
      fetchItems()
    } catch (error: any) {
      console.error("Error creating item:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create item",
        variant: "destructive",
      })
    }
  }

  const handleWarehouseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = {
        code: warehouseFormData.code,
        name: warehouseFormData.name,
        location: warehouseFormData.location || undefined,
      }

      await apiService.construction.inventory.warehouses.create(data)
      toast({
        title: "Success",
        description: "Warehouse created successfully",
      })
      setShowWarehouseDialog(false)
      fetchWarehouses()
    } catch (error: any) {
      console.error("Error creating warehouse:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create warehouse",
        variant: "destructive",
      })
    }
  }

  const handleGRNSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (grnFormData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      })
      return
    }

    try {
      const data = {
        warehouseId: grnFormData.warehouseId,
        projectId: grnFormData.projectId || undefined,
        supplierName: grnFormData.supplierName || undefined,
        receiptDate: new Date(grnFormData.receiptDate).toISOString(),
        notes: grnFormData.notes || undefined,
        items: grnFormData.items,
      }

      await apiService.construction.grns.create(data)
      toast({
        title: "Success",
        description: "GRN created successfully",
      })
      setShowGRNDialog(false)
      fetchGRNs()
    } catch (error: any) {
      console.error("Error creating GRN:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create GRN",
        variant: "destructive",
      })
    }
  }

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (issueFormData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item",
        variant: "destructive",
      })
      return
    }

    try {
      const data = {
        projectId: issueFormData.projectId,
        warehouseId: issueFormData.warehouseId,
        costCodeId: issueFormData.costCodeId,
        issueDate: new Date(issueFormData.issueDate).toISOString(),
        notes: issueFormData.notes || undefined,
        items: issueFormData.items,
      }

      await apiService.construction.issues.create(data)
      toast({
        title: "Success",
        description: "Issue created successfully",
      })
      setShowIssueDialog(false)
      fetchIssues()
    } catch (error: any) {
      console.error("Error creating issue:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create issue",
        variant: "destructive",
      })
    }
  }

  const handleApproveIssue = async (id: string) => {
    if (!confirm("Are you sure you want to approve this issue? It will post to finance.")) return

    try {
      await apiService.construction.issues.approve(id)
      toast({
        title: "Success",
        description: "Issue approved and posted to finance",
      })
      fetchIssues()
    } catch (error: any) {
      console.error("Error approving issue:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to approve issue",
        variant: "destructive",
      })
    }
  }

  const handlePostGRN = async (id: string) => {
    if (!confirm("Are you sure you want to post this GRN? It will update stock.")) return

    try {
      await apiService.construction.grns.post(id)
      toast({
        title: "Success",
        description: "GRN posted successfully",
      })
      fetchGRNs()
    } catch (error: any) {
      console.error("Error posting GRN:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to post GRN",
        variant: "destructive",
      })
    }
  }

  const addGRNItem = () => {
    setGrnFormData({
      ...grnFormData,
      items: [
        ...grnFormData.items,
        { itemId: "", quantity: 0, unitPrice: 0 },
      ],
    })
  }

  const removeGRNItem = (index: number) => {
    setGrnFormData({
      ...grnFormData,
      items: grnFormData.items.filter((_, i) => i !== index),
    })
  }

  const addIssueItem = () => {
    setIssueFormData({
      ...issueFormData,
      items: [...issueFormData.items, { itemId: "", quantity: 0 }],
    })
  }

  const removeIssueItem = (index: number) => {
    setIssueFormData({
      ...issueFormData,
      items: issueFormData.items.filter((_, i) => i !== index),
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      draft: "secondary",
      received: "outline",
      posted: "default",
      issued: "outline",
      approved: "outline",
    }
    return <Badge variant={variants[status] || "default"}>{status}</Badge>
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
          <TabsTrigger value="grns">GRN</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
        </TabsList>

        {/* Items Tab */}
        <TabsContent value="items" className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Inventory Items</h3>
              <Button
                onClick={() => {
                  setItemFormData({
                    code: "",
                    name: "",
                    category: "",
                    unit: "pcs",
                    unitPrice: 0,
                  })
                  setShowItemDialog(true)
                }}
              >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Package className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No items found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items
                    .filter(
                      (item) =>
                        !searchTerm ||
                        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.code.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.code}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.category || "-"}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>
                          {item.unitPrice ? formatCurrency(item.unitPrice) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.isActive ? "default" : "secondary"}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Warehouses Tab */}
        <TabsContent value="warehouses" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Warehouses</h3>
              <Button
                onClick={() => {
                  setWarehouseFormData({
                    code: "",
                    name: "",
                    location: "",
                  })
                  setShowWarehouseDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Warehouse
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : warehouses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No warehouses found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.map((warehouse) => (
                      <TableRow key={warehouse.id}>
                        <TableCell className="font-mono text-sm">{warehouse.code}</TableCell>
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell>{warehouse.location || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={warehouse.isActive ? "default" : "secondary"}>
                            {warehouse.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedWarehouse(warehouse.id)
                              fetchStock(warehouse.id)
                            }}
                          >
                            View Stock
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {selectedWarehouse && stock.length > 0 && (
                  <Card className="mt-4 p-4">
                    <h4 className="font-semibold mb-4">Stock Balance</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stock.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell>{s.item?.name || "-"}</TableCell>
                            <TableCell>{s.quantity}</TableCell>
                            <TableCell>{formatCurrency(s.unitPrice)}</TableCell>
                            <TableCell>
                              {formatCurrency(s.quantity * s.unitPrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </>
            )}
          </Card>
        </TabsContent>

        {/* GRN Tab */}
        <TabsContent value="grns" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search GRNs..."
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
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
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
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => {
                setGrnFormData({
                  warehouseId: "",
                  projectId: "",
                  supplierName: "",
                  receiptDate: format(new Date(), "yyyy-MM-dd"),
                  notes: "",
                  items: [],
                })
                setShowGRNDialog(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add GRN
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : grns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No GRNs found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grns.map((grn) => (
                      <TableRow key={grn.id}>
                        <TableCell className="font-mono text-sm">{grn.grnNumber}</TableCell>
                        <TableCell>
                          {format(new Date(grn.receiptDate), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>{grn.warehouse?.name || "-"}</TableCell>
                        <TableCell>
                          {grn.project ? `${grn.project.code} - ${grn.project.name}` : "-"}
                        </TableCell>
                        <TableCell>{grn.supplierName || "-"}</TableCell>
                        <TableCell>{getStatusBadge(grn.status)}</TableCell>
                        <TableCell className="text-right">
                          {grn.status === "received" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePostGRN(grn.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search issues..."
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
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
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
                  <SelectItem value="issued">Issued</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => {
                setIssueFormData({
                  projectId: "",
                  warehouseId: "",
                  costCodeId: "",
                  issueDate: format(new Date(), "yyyy-MM-dd"),
                  notes: "",
                  items: [],
                })
                setShowIssueDialog(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Issue
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <ArrowRight className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No issues found</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Cost Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-mono text-sm">{issue.issueNumber}</TableCell>
                        <TableCell>
                          {format(new Date(issue.issueDate), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          {issue.project ? `${issue.project.code} - ${issue.project.name}` : "-"}
                        </TableCell>
                        <TableCell>{issue.warehouse?.name || "-"}</TableCell>
                        <TableCell>
                          {issue.costCode ? `${issue.costCode.code} - ${issue.costCode.name}` : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(issue.status)}</TableCell>
                        <TableCell className="text-right">
                          {issue.status === "issued" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveIssue(issue.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      </Tabs>

      {/* Add Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>Create a new inventory item. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemCode">Code *</Label>
                <Input
                  id="itemCode"
                  value={itemFormData.code}
                  onChange={(e) => setItemFormData({ ...itemFormData, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemName">Name *</Label>
                <Input
                  id="itemName"
                  value={itemFormData.name}
                  onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={itemFormData.category}
                  onChange={(e) => setItemFormData({ ...itemFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Select
                  value={itemFormData.unit}
                  onValueChange={(value) => setItemFormData({ ...itemFormData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pcs">Pieces</SelectItem>
                    <SelectItem value="kg">Kilograms</SelectItem>
                    <SelectItem value="m">Meters</SelectItem>
                    <SelectItem value="m2">Square Meters</SelectItem>
                    <SelectItem value="m3">Cubic Meters</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitPrice">Unit Price</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                min="0"
                value={itemFormData.unitPrice}
                onChange={(e) => setItemFormData({ ...itemFormData, unitPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowItemDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Warehouse Dialog */}
      <Dialog open={showWarehouseDialog} onOpenChange={setShowWarehouseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Warehouse</DialogTitle>
            <DialogDescription>Create a new warehouse. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleWarehouseSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warehouseCode">Code *</Label>
                <Input
                  id="warehouseCode"
                  value={warehouseFormData.code}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouseName">Name *</Label>
                <Input
                  id="warehouseName"
                  value={warehouseFormData.name}
                  onChange={(e) => setWarehouseFormData({ ...warehouseFormData, name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={warehouseFormData.location}
                onChange={(e) => setWarehouseFormData({ ...warehouseFormData, location: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowWarehouseDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add GRN Dialog - Simplified for space */}
      <Dialog open={showGRNDialog} onOpenChange={setShowGRNDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add GRN</DialogTitle>
            <DialogDescription>Create a Goods Receipt Note to record incoming inventory. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGRNSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="grnWarehouse">Warehouse *</Label>
                <Select
                  value={grnFormData.warehouseId}
                  onValueChange={(value) => setGrnFormData({ ...grnFormData, warehouseId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.code} - {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="grnDate">Receipt Date *</Label>
                <Input
                  id="grnDate"
                  type="date"
                  value={grnFormData.receiptDate}
                  onChange={(e) => setGrnFormData({ ...grnFormData, receiptDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Supplier Name</Label>
                <Input
                  id="supplierName"
                  value={grnFormData.supplierName}
                  onChange={(e) => setGrnFormData({ ...grnFormData, supplierName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grnProject">Project (Optional)</Label>
                <Select
                  value={grnFormData.projectId || "__none__"}
                  onValueChange={(value) => setGrnFormData({ ...grnFormData, projectId: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} - {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Items *</Label>
              {grnFormData.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select
                      value={item.itemId}
                      onValueChange={(value) => {
                        const newItems = [...grnFormData.items]
                        newItems[index].itemId = value
                        setGrnFormData({ ...grnFormData, items: newItems })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items
                          .filter((i) => i.isActive)
                          .map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.code} - {it.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...grnFormData.items]
                      newItems[index].quantity = parseFloat(e.target.value) || 0
                      setGrnFormData({ ...grnFormData, items: newItems })
                    }}
                    className="w-24"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const newItems = [...grnFormData.items]
                      newItems[index].unitPrice = parseFloat(e.target.value) || 0
                      setGrnFormData({ ...grnFormData, items: newItems })
                    }}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeGRNItem(index)}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addGRNItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grnNotes">Notes</Label>
              <Textarea
                id="grnNotes"
                value={grnFormData.notes}
                onChange={(e) => setGrnFormData({ ...grnFormData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowGRNDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Issue Dialog - Simplified for space */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Issue to Project</DialogTitle>
            <DialogDescription>Issue inventory items from warehouse to a project. Fields marked with * are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleIssueSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueProject">Project *</Label>
                <Select
                  value={issueFormData.projectId}
                  onValueChange={(value) => setIssueFormData({ ...issueFormData, projectId: value })}
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
                <Label htmlFor="issueWarehouse">Warehouse *</Label>
                <Select
                  value={issueFormData.warehouseId}
                  onValueChange={(value) => setIssueFormData({ ...issueFormData, warehouseId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.code} - {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueCostCode">Cost Code *</Label>
                <Select
                  value={issueFormData.costCodeId}
                  onValueChange={(value) => setIssueFormData({ ...issueFormData, costCodeId: value })}
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
              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue Date *</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueFormData.issueDate}
                  onChange={(e) => setIssueFormData({ ...issueFormData, issueDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Items *</Label>
              {issueFormData.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select
                      value={item.itemId}
                      onValueChange={(value) => {
                        const newItems = [...issueFormData.items]
                        newItems[index].itemId = value
                        setIssueFormData({ ...issueFormData, items: newItems })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items
                          .filter((i) => i.isActive)
                          .map((it) => (
                            <SelectItem key={it.id} value={it.id}>
                              {it.code} - {it.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Quantity"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...issueFormData.items]
                      newItems[index].quantity = parseFloat(e.target.value) || 0
                      setIssueFormData({ ...issueFormData, items: newItems })
                    }}
                    className="w-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIssueItem(index)}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addIssueItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="issueNotes">Notes</Label>
              <Textarea
                id="issueNotes"
                value={issueFormData.notes}
                onChange={(e) => setIssueFormData({ ...issueFormData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowIssueDialog(false)}>
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
