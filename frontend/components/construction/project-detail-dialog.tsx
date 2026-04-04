"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"

interface ProjectDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

export function ProjectDetailDialog({ open, onOpenChange, projectId }: ProjectDetailDialogProps) {
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && projectId) {
      fetchProject()
    }
  }, [open, projectId])

  const fetchProject = async () => {
    try {
      setLoading(true)
      const response = await apiService.construction.projects.getById(projectId)
      const responseData = response.data as any
      if (responseData?.success || responseData?.data) {
        setProject(responseData.data || responseData)
      }
    } catch (error) {
      console.error("Error fetching project:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Details</DialogTitle>
          <DialogDescription>View detailed information about the construction project.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : project ? (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Code</p>
                  <p className="font-mono font-semibold">{project.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{project.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge>{project.status}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accounting Mode</p>
                  <Badge variant={project.accountingMode === "WIP" ? "default" : "secondary"}>
                    {project.accountingMode}
                  </Badge>
                </div>
                {project.property && (
                  <div>
                    <p className="text-sm text-muted-foreground">Property</p>
                    <p className="font-semibold">{project.property.name}</p>
                  </div>
                )}
                {project.budgetAmount && (
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="font-semibold">{formatCurrency(project.budgetAmount)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Actual Cost</p>
                  <p className="font-semibold">{formatCurrency(project.actualCost || 0)}</p>
                </div>
              </div>
            </Card>

            {project.description && (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p>{project.description}</p>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">Project not found</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
