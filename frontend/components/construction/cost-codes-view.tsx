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
  Trash2,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Search,
  Filter,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface CostCode {
  id: string
  code: string
  name: string
  level: number
  parentId?: string
  description?: string
  isActive: boolean
  projectId?: string
  parent?: CostCode
  children?: CostCode[]
}

export function CostCodesView() {
  const { toast } = useToast()
  const [costCodes, setCostCodes] = useState<CostCode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingCode, setEditingCode] = useState<CostCode | null>(null)
  const [projects, setProjects] = useState<any[]>([])

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    level: 1,
    parentId: undefined as string | undefined,
    description: "",
    projectId: undefined as string | undefined,
    isActive: true,
  })

  useEffect(() => {
    fetchCostCodes()
    fetchProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const fetchCostCodes = useCallback(async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (levelFilter !== "all") {
        params.level = parseInt(levelFilter)
      }
      const response = await apiService.construction.costCodes.getAll(params)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setCostCodes(responseData.data || responseData || [])
      }
    } catch (error) {
      console.error("Error fetching cost codes:", error)
      toast({
        title: "Error",
        description: "Failed to fetch cost codes",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [levelFilter, toast])

  const handleAdd = () => {
    setFormData({
      code: "",
      name: "",
      level: 1,
      parentId: undefined,
      description: "",
      projectId: undefined,
      isActive: true,
    })
    setEditingCode(null)
    setShowAddDialog(true)
  }

  const handleEdit = (code: CostCode) => {
    setFormData({
      code: code.code,
      name: code.name,
      level: code.level,
      parentId: code.parentId || undefined,
      description: code.description || "",
      projectId: code.projectId || undefined,
      isActive: code.isActive,
    })
    setEditingCode(code)
    setShowAddDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data: any = {
        code: formData.code,
        name: formData.name,
        level: formData.level,
        description: formData.description,
        isActive: formData.isActive,
      }
      if (formData.parentId) data.parentId = formData.parentId
      if (formData.projectId) data.projectId = formData.projectId

      if (editingCode) {
        await apiService.construction.costCodes.update(editingCode.id, data)
        toast({
          title: "Success",
          description: "Cost code updated successfully",
        })
      } else {
        await apiService.construction.costCodes.create(data)
        toast({
          title: "Success",
          description: "Cost code created successfully",
        })
      }
      setShowAddDialog(false)
      fetchCostCodes()
    } catch (error: any) {
      console.error("Error saving cost code:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to save cost code",
        variant: "destructive",
      })
    }
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const getLevelName = (level: number) => {
    switch (level) {
      case 1:
        return "Trade"
      case 2:
        return "Activity"
      case 3:
        return "Task"
      default:
        return `Level ${level}`
    }
  }

  const getLevelBadge = (level: number) => {
    const colors: Record<number, "default" | "secondary" | "outline"> = {
      1: "default",
      2: "secondary",
      3: "outline",
    }
    return (
      <Badge variant={colors[level] || "default"} className="text-xs">
        {getLevelName(level)}
      </Badge>
    )
  }

  // Build hierarchical tree
  const buildTree = (codes: CostCode[]): CostCode[] => {
    const map = new Map<string, CostCode>()
    const roots: CostCode[] = []

    // Create map
    codes.forEach((code) => {
      map.set(code.id, { ...code, children: [] })
    })

    // Build tree
    codes.forEach((code) => {
      const node = map.get(code.id)!
      if (code.parentId && map.has(code.parentId)) {
        const parent = map.get(code.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    })

    return roots.sort((a, b) => a.code.localeCompare(b.code))
  }

  const renderTree = (nodes: CostCode[], depth = 0): JSX.Element[] => {
    const filtered = nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        node.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return filtered.flatMap((node) => {
      const hasChildren = node.children && node.children.length > 0
      const isExpanded = expandedRows.has(node.id)
      const indent = depth * 24

      return [
        <TableRow key={node.id} className={!node.isActive ? "opacity-50" : ""}>
          <TableCell style={{ paddingLeft: `${16 + indent}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => toggleExpand(node.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              ) : (
                <div className="w-6" />
              )}
              <span className="font-mono text-sm">{node.code}</span>
            </div>
          </TableCell>
          <TableCell className="font-medium">{node.name}</TableCell>
          <TableCell>{getLevelBadge(node.level)}</TableCell>
          <TableCell>
            {node.parent ? (
              <span className="text-sm text-muted-foreground">
                {node.parent.code} - {node.parent.name}
              </span>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </TableCell>
          <TableCell>
            <Badge variant={node.isActive ? "default" : "secondary"}>
              {node.isActive ? "Active" : "Inactive"}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(node)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>,
        ...(isExpanded && hasChildren ? renderTree(node.children!, depth + 1) : []),
      ]
    })
  }

  const tree = buildTree(costCodes)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cost codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="1">Trade (Level 1)</SelectItem>
              <SelectItem value="2">Activity (Level 2)</SelectItem>
              <SelectItem value="3">Task (Level 3)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Cost Code
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : costCodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground">No cost codes found</p>
            <Button onClick={handleAdd} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add First Cost Code
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{renderTree(tree)}</TableBody>
          </Table>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingCode ? "Edit Cost Code" : "Add Cost Code"}</DialogTitle>
          <DialogDescription>
            {editingCode ? "Update the cost code details below." : "Create a new cost code for construction projects. Fields marked with * are required."}
          </DialogDescription>
        </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  placeholder="e.g., CIV-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="level">Level *</Label>
                <Select
                  value={formData.level.toString()}
                  onValueChange={(value) => setFormData({ ...formData, level: parseInt(value), parentId: undefined })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Trade (Level 1)</SelectItem>
                    <SelectItem value="2">Activity (Level 2)</SelectItem>
                    <SelectItem value="3">Task (Level 3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.level > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="parentId">Parent {getLevelName(formData.level - 1)}</Label>
                  <Select
                    value={formData.parentId || "__none__"}
                    onValueChange={(value) => setFormData({ ...formData, parentId: value === "__none__" ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {costCodes
                        .filter((cc) => cc.level === formData.level - 1 && cc.isActive)
                        .map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} - {cc.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project (Optional)</Label>
              <Select
                value={formData.projectId || "__none__"}
                onValueChange={(value) => setFormData({ ...formData, projectId: value === "__none__" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
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

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
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
    </div>
  )
}
