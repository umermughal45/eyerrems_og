"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddProjectDialog({ open, onOpenChange, onSuccess }: AddProjectDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    propertyId: undefined as string | undefined,
    status: "planning",
    accountingMode: "WIP",
    costCodeMandatory: true,
    budgetEnforcement: false,
    startDate: "",
    endDate: "",
    budgetAmount: "",
  })

  useEffect(() => {
    if (open) {
      fetchProperties()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProperties = async () => {
    try {
      const response = await apiService.properties.getAll({ limit: 100 })
      const data = (response.data as any)?.data || response.data || []
      setProperties(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching properties:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description || undefined,
        propertyId: formData.propertyId && formData.propertyId.trim() !== "" ? formData.propertyId : undefined,
        status: formData.status,
        accountingMode: formData.accountingMode,
        costCodeMandatory: formData.costCodeMandatory,
        budgetEnforcement: formData.budgetEnforcement,
        budgetAmount: formData.budgetAmount ? parseFloat(formData.budgetAmount) : undefined,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      }

      await apiService.construction.projects.create(payload)
      toast({
        title: "Success",
        description: "Project created successfully",
      })
      onSuccess?.()
      onOpenChange(false)
      // Reset form
      setFormData({
        name: "",
        description: "",
        propertyId: undefined,
        status: "planning",
        accountingMode: "WIP",
        costCodeMandatory: true,
        budgetEnforcement: false,
        startDate: "",
        endDate: "",
        budgetAmount: "",
      })
    } catch (error: any) {
      console.error("Error creating project:", error)
      toast({
        title: "Error",
        description: error.response?.data?.error || error.message || "Failed to create project",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Fill in the project details below. Fields marked with * are required.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyId">Property (Optional)</Label>
              <Select
                value={formData.propertyId || "__none__"}
                onValueChange={(value) => setFormData({ ...formData, propertyId: value === "__none__" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>
                      {prop.name} {prop.propertyCode ? `(${prop.propertyCode})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountingMode">Accounting Mode</Label>
              <Select
                value={formData.accountingMode}
                onValueChange={(value) => setFormData({ ...formData, accountingMode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WIP">WIP (Work in Progress)</SelectItem>
                  <SelectItem value="DirectExpense">Direct Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetAmount">Budget Amount</Label>
            <Input
              id="budgetAmount"
              type="number"
              step="0.01"
              value={formData.budgetAmount}
              onChange={(e) => setFormData({ ...formData, budgetAmount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="costCodeMandatory">Cost Code Mandatory</Label>
                <p className="text-sm text-muted-foreground">
                  Require cost code for all postings
                </p>
              </div>
              <Switch
                id="costCodeMandatory"
                checked={formData.costCodeMandatory}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, costCodeMandatory: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="budgetEnforcement">Budget Enforcement</Label>
                <p className="text-sm text-muted-foreground">
                  Enforce budget limits on approvals
                </p>
              </div>
              <Switch
                id="budgetEnforcement"
                checked={formData.budgetEnforcement}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, budgetEnforcement: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
