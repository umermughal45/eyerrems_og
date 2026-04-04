"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Building2,
  Plus,
  Edit,
  Eye,
  Trash2,
  MoreVertical,
  Loader2,
  DollarSign,
  Calendar,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiService } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { ListToolbar } from "@/components/shared/list-toolbar"
import { UnifiedFilterDrawer } from "@/components/shared/unified-filter-drawer"
import { saveFilters, loadFilters } from "@/lib/filter-store"
import { toSimpleFilters } from "@/lib/filter-transform"
import { countActiveFilters } from "@/lib/filter-config-registry"
import { AddProjectDialog } from "./add-project-dialog"
import { EditProjectDialog } from "./edit-project-dialog"
import { ProjectDetailDialog } from "./project-detail-dialog"

interface Project {
  id: string
  code: string
  name: string
  description?: string
  status: string
  accountingMode: string
  costCodeMandatory: boolean
  budgetEnforcement: boolean
  startDate?: string
  endDate?: string
  budgetAmount?: number
  actualCost?: number
  property?: {
    id: string
    name: string
    propertyCode?: string
  }
}

export function ProjectsView({ onRefresh }: { onRefresh?: () => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>(loadFilters("projects", undefined) || {})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDetailDialog, setShowDetailDialog] = useState(false)

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const filters = toSimpleFilters(activeFilters)
      const statusVal = filters.status
      const response = await apiService.construction.projects.getAll({
        page,
        limit: 10,
        search: searchTerm || undefined,
        status: statusVal ? (Array.isArray(statusVal) ? (statusVal[0] as string) : (statusVal as string)) : undefined,
      })
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        const rawProjects = responseData.data || responseData || []
        // Ensure property objects have propertyCode field
        const projectsData: Project[] = rawProjects.map((p: any) => ({
          ...p,
          property: p.property ? {
            id: p.property.id,
            name: p.property.name,
            propertyCode: p.property.propertyCode || undefined,
          } : undefined,
        }))
        setProjects(projectsData)
        setTotalPages(responseData.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error("Error fetching projects:", error)
    } finally {
      setLoading(false)
    }
  }, [page, searchTerm, activeFilters])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return

    try {
      await apiService.construction.projects.delete(id)
      fetchProjects()
      onRefresh?.()
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("Failed to delete project")
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      planning: "secondary",
      active: "default",
      "on-hold": "outline",
      completed: "default",
      closed: "secondary",
    }
    return <Badge variant={variants[status] || "default"}>{status}</Badge>
  }

  const getAccountingModeBadge = (mode: string) => {
    return (
      <Badge variant={mode === "WIP" ? "default" : "secondary"} className="text-xs">
        {mode}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <ListToolbar
        searchPlaceholder="Search projects…"
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        onFilterClick={() => setShowFilterDrawer(true)}
        activeFilterCount={countActiveFilters(activeFilters)}
        primaryAction={
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        }
      />

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No projects found</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounting Mode</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Actual Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-mono text-sm">{project.code}</TableCell>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      {project.property ? (
                        <span className="text-sm">
                          {project.property.name}
                          {project.property.propertyCode ? ` (${project.property.propertyCode})` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell>{getAccountingModeBadge(project.accountingMode)}</TableCell>
                    <TableCell>
                      {project.budgetAmount ? formatCurrency(project.budgetAmount) : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(project.actualCost || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProject(project)
                              setShowDetailDialog(true)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedProject(project)
                              setShowEditDialog(true)
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(project.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Dialogs */}
      <AddProjectDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          fetchProjects()
          onRefresh?.()
        }}
      />
      {selectedProject && (
        <>
          <EditProjectDialog
            open={showEditDialog}
            onOpenChange={setShowEditDialog}
            project={selectedProject}
            onSuccess={() => {
              fetchProjects()
              onRefresh?.()
            }}
          />
          <ProjectDetailDialog
            open={showDetailDialog}
            onOpenChange={setShowDetailDialog}
            projectId={selectedProject.id}
          />
        </>
      )}

      <UnifiedFilterDrawer
        open={showFilterDrawer}
        onOpenChange={setShowFilterDrawer}
        entity="projects"
        initialFilters={activeFilters}
        onApply={(filters) => {
          setActiveFilters(filters)
          saveFilters("projects", undefined, filters)
        }}
      />
    </div>
  )
}
