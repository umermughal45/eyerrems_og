"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface AddLeaveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  defaultEmployeeId?: string
}

export function AddLeaveDialog({ open, onOpenChange, onSuccess, defaultEmployeeId }: AddLeaveDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const [formData, setFormData] = useState({
    employeeId: defaultEmployeeId || "",
    type: "annual",
    startDate: "",
    endDate: "",
    reason: "",
  })
  const [calculatedDays, setCalculatedDays] = useState(0)

  useEffect(() => {
    if (open) {
      fetchEmployees()
      if (defaultEmployeeId) {
        setFormData((prev) => ({ ...prev, employeeId: defaultEmployeeId }))
      }
    } else {
      // Reset form when dialog closes
      setFormData({
        employeeId: defaultEmployeeId || "",
        type: "annual",
        startDate: "",
        endDate: "",
        reason: "",
      })
      setCalculatedDays(0)
    }
  }, [open, defaultEmployeeId])

  useEffect(() => {
    // Calculate days when dates change
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (end >= start) {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        setCalculatedDays(days)
      } else {
        setCalculatedDays(0)
      }
    } else {
      setCalculatedDays(0)
    }
  }, [formData.startDate, formData.endDate])

  const fetchEmployees = async () => {
    try {
      const response: any = await apiService.employees.getAll()
      const employeesData = response?.data?.data || response?.data || []
      setEmployees(Array.isArray(employeesData) ? employeesData.filter((e: any) => e.status === "active") : [])
    } catch (err) {
      console.error("Failed to fetch employees:", err)
      setEmployees([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.employeeId) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.type) {
      toast({
        title: "Error",
        description: "Please select leave type",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.startDate || !formData.endDate) {
      toast({
        title: "Error",
        description: "Please select start and end dates",
        variant: "destructive",
      })
      return
    }
    
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    
    if (end < start) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.reason || formData.reason.trim().length === 0) {
      toast({
        title: "Error",
        description: "Please provide a reason for the leave",
        variant: "destructive",
      })
      return
    }
    
    setLoading(true)
    
    try {
      await apiService.leave.create({
        employeeId: formData.employeeId,
        type: formData.type,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason.trim(),
      })
      
      toast({
        title: "Success",
        description: "Leave request created successfully",
        variant: "success",
      })
      
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to create leave request"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>Create Leave Request</DialogTitle>
          <DialogDescription>
            Create a leave request for an employee. The request will be pending approval.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee <span className="text-destructive">*</span></Label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.length === 0 ? (
                    <SelectItem value="none" disabled>No active employees</SelectItem>
                  ) : (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeId}) - {emp.department}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Leave Type <span className="text-destructive">*</span></Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="emergency">Emergency Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date <span className="text-destructive">*</span></Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                min={formData.startDate}
                required
              />
            </div>
          </div>
          
          {calculatedDays > 0 && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                Duration: <span className="font-semibold text-foreground">{calculatedDays} day{calculatedDays !== 1 ? 's' : ''}</span>
              </p>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for leave..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={4}
              required
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Leave Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

