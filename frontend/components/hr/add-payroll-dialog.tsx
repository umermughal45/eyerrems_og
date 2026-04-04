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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { apiService } from "@/lib/api"
import { Loader2, Plus, X, Calculator } from "lucide-react"
import { PayrollToasts } from "@/lib/toast-utils"

interface AddPayrollDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface Allowance {
  type: string
  amount: string
  description: string
}

interface Deduction {
  type: string
  amount: string
  description: string
}

export function AddPayrollDialog({ open, onOpenChange, onSuccess }: AddPayrollDialogProps) {
  const [activeTab, setActiveTab] = useState("basic")
  const [formData, setFormData] = useState({
    employeeId: "",
    month: "",
    baseSalary: "",
    basicSalary: "",
    bonus: "0",
    overtimeAmount: "0",
    overtimeHours: "0",
    taxPercent: "0",
    allowances: [] as Allowance[],
    deductions: [] as Deduction[],
    paymentMethod: "",
    paymentStatus: "pending",
    notes: "",
  })
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculatedValues, setCalculatedValues] = useState({
    grossSalary: 0,
    totalAllowances: 0,
    totalDeductions: 0,
    taxAmount: 0,
    netPay: 0,
  })

  useEffect(() => {
    if (open) {
      fetchEmployees()
      // Set default month to current month
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setFormData(prev => ({ ...prev, month }))
    }
  }, [open])

  useEffect(() => {
    calculatePayroll()
  }, [formData.baseSalary, formData.basicSalary, formData.bonus, formData.overtimeAmount, formData.taxPercent, formData.allowances, formData.deductions])

  const fetchEmployees = async () => {
    try {
      const response = await apiService.employees.getAll()
      const responseData = response.data as any
      const employeesData = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
        ? responseData
        : []
      setEmployees(employeesData)
    } catch (err) {
      console.error("Failed to fetch employees:", err)
    }
  }

  const calculatePayroll = () => {
    const base = parseFloat(formData.baseSalary) || 0
    const basic = parseFloat(formData.basicSalary) || base
    const bonus = parseFloat(formData.bonus) || 0
    const overtime = parseFloat(formData.overtimeAmount) || 0
    
    // Calculate total allowances
    const totalAllowances = formData.allowances.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0)
    
    // Calculate gross salary
    const grossSalary = basic + totalAllowances + bonus + overtime
    
    // Calculate tax
    const taxPercent = parseFloat(formData.taxPercent) || 0
    const taxAmount = (grossSalary * taxPercent) / 100
    
    // Calculate total deductions
    const totalDeductions = formData.deductions.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0) + taxAmount
    
    // Calculate net pay
    const netPay = grossSalary - totalDeductions
    
    setCalculatedValues({
      grossSalary,
      totalAllowances,
      totalDeductions,
      taxAmount,
      netPay,
    })
  }

  const addAllowance = () => {
    setFormData(prev => ({
      ...prev,
      allowances: [...prev.allowances, { type: "other", amount: "0", description: "" }]
    }))
  }

  const removeAllowance = (index: number) => {
    setFormData(prev => ({
      ...prev,
      allowances: prev.allowances.filter((_, i) => i !== index)
    }))
  }

  const updateAllowance = (index: number, field: keyof Allowance, value: string) => {
    setFormData(prev => ({
      ...prev,
      allowances: prev.allowances.map((a, i) => i === index ? { ...a, [field]: value } : a)
    }))
  }

  const addDeduction = () => {
    setFormData(prev => ({
      ...prev,
      deductions: [...prev.deductions, { type: "other", amount: "0", description: "" }]
    }))
  }

  const removeDeduction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      deductions: prev.deductions.filter((_, i) => i !== index)
    }))
  }

  const updateDeduction = (index: number, field: keyof Deduction, value: string) => {
    setFormData(prev => ({
      ...prev,
      deductions: prev.deductions.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.employeeId || !formData.month || !formData.baseSalary) {
        setError("Please fill in all required fields")
        setLoading(false)
        return
      }

      // Prepare allowances and deductions for backend
      const allowances = formData.allowances.map(a => ({
        type: a.type,
        amount: parseFloat(a.amount) || 0,
        description: a.description || null,
      }))

      const deductions = formData.deductions.map(d => ({
        type: d.type,
        amount: parseFloat(d.amount) || 0,
        description: d.description || null,
      }))

      await apiService.payroll.create({
        employeeId: formData.employeeId,
        month: formData.month,
        baseSalary: formData.baseSalary,
        basicSalary: formData.basicSalary || formData.baseSalary,
        bonus: formData.bonus || "0",
        overtimeAmount: formData.overtimeAmount || "0",
        overtimeHours: formData.overtimeHours || "0",
        taxPercent: formData.taxPercent || "0",
        taxAmount: calculatedValues.taxAmount,
        grossSalary: calculatedValues.grossSalary,
        allowances: calculatedValues.totalAllowances,
        deductions: calculatedValues.totalDeductions,
        netPay: calculatedValues.netPay,
        paymentMethod: formData.paymentMethod || null,
        paymentStatus: formData.paymentStatus,
        notes: formData.notes || null,
        allowancesList: allowances,
        deductionsList: deductions,
      })

      // Get employee name for toast
      const selectedEmployee = employees.find((e: any) => e.id === formData.employeeId)
      const employeeName = selectedEmployee?.name || "Employee"
      PayrollToasts.created(employeeName, formData.month)

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to create payroll"
      
      // Handle accounting-specific errors with better messaging
      let displayMessage = errorMessage
      
      if (errorMessage.includes("PAYROLL_ACCOUNTING_ERROR")) {
        // Remove the error prefix for cleaner display
        displayMessage = errorMessage.replace("PAYROLL_ACCOUNTING_ERROR:", "").trim()
        
        // Check if it's a configuration error (non-blocking warning)
        if (errorMessage.includes("account mappings not configured")) {
          // This is a warning, not a blocking error (backward compatibility)
          // Log it but don't show as error - payroll was created successfully
          console.warn("Payroll created but accounting not configured:", errorMessage)
          // Continue with success flow - payroll is created even if accounting fails
          PayrollToasts.created(
            employees.find((e: any) => e.id === formData.employeeId)?.name || "Employee",
            formData.month
          )
          onOpenChange(false)
          if (onSuccess) {
            onSuccess()
          }
          setLoading(false)
          return
        }
      }
      
      setError(displayMessage)
      PayrollToasts.error(displayMessage)
    } finally {
      setLoading(false)
    }
  }

  const selectedEmployee = employees.find(e => e.id === formData.employeeId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[900px] max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Payroll Entry</DialogTitle>
          <DialogDescription>Enter comprehensive payroll details for an employee</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="allowances">Allowances</TabsTrigger>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="employeeId">Employee <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.employeeId}
                    onValueChange={(value) => {
                      const employee = employees.find((e) => e.id === value)
                      setFormData({
                        ...formData,
                        employeeId: value,
                        baseSalary: employee?.salary?.toString() || "",
                        basicSalary: employee?.basicSalary?.toString() || employee?.salary?.toString() || "",
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} - {employee.position} ({employee.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="month">Month <span className="text-destructive">*</span></Label>
                  <Input
                    id="month"
                    type="month"
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="baseSalary">Base Salary <span className="text-destructive">*</span></Label>
                  <Input
                    id="baseSalary"
                    type="number"
                    step="0.01"
                    placeholder="5000"
                    value={formData.baseSalary}
                    onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="basicSalary">Basic Salary</Label>
                  <Input
                    id="basicSalary"
                    type="number"
                    step="0.01"
                    placeholder="3000"
                    value={formData.basicSalary}
                    onChange={(e) => setFormData({ ...formData, basicSalary: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bonus">Bonus</Label>
                  <Input
                    id="bonus"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.bonus}
                    onChange={(e) => setFormData({ ...formData, bonus: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="overtimeHours">Overtime Hours</Label>
                  <Input
                    id="overtimeHours"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.overtimeHours}
                    onChange={(e) => {
                      const hours = parseFloat(e.target.value) || 0
                      const employee = selectedEmployee
                      const hourlyRate = employee?.salary ? (employee.salary / 160) : 0 // Assuming 160 working hours per month
                      const overtimeRate = hourlyRate * 1.5 // 1.5x for overtime
                      const amount = hours * overtimeRate
                      setFormData({ 
                        ...formData, 
                        overtimeHours: e.target.value,
                        overtimeAmount: amount.toFixed(2)
                      })
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="overtimeAmount">Overtime Amount</Label>
                  <Input
                    id="overtimeAmount"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.overtimeAmount}
                    onChange={(e) => setFormData({ ...formData, overtimeAmount: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="taxPercent">Tax Percentage (%)</Label>
                  <Input
                    id="taxPercent"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={formData.taxPercent}
                    onChange={(e) => setFormData({ ...formData, taxPercent: e.target.value })}
                  />
                </div>
              </div>

              {/* Summary Card */}
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-5 w-5" />
                  <h3 className="font-semibold">Payroll Summary</h3>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Salary:</span>
                    <span className="font-medium">{calculatedValues.grossSalary.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Allowances:</span>
                    <span className="font-medium text-green-600">+{calculatedValues.totalAllowances.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Deductions:</span>
                    <span className="font-medium text-red-600">-{calculatedValues.totalDeductions.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax Amount:</span>
                    <span className="font-medium text-red-600">-{calculatedValues.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="font-semibold">Net Pay:</span>
                    <span className="font-bold text-lg">{calculatedValues.netPay.toFixed(2)}</span>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="allowances" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Allowances</h3>
                <Button type="button" variant="outline" size="sm" onClick={addAllowance}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Allowance
                </Button>
              </div>
              {formData.allowances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No allowances added. Click "Add Allowance" to add one.</p>
              ) : (
                <div className="space-y-3">
                  {formData.allowances.map((allowance, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <Select
                            value={allowance.type}
                            onValueChange={(value) => updateAllowance(index, "type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="housing">Housing</SelectItem>
                              <SelectItem value="transport">Transport</SelectItem>
                              <SelectItem value="medical">Medical</SelectItem>
                              <SelectItem value="food">Food</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={allowance.amount}
                            onChange={(e) => updateAllowance(index, "amount", e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Description</Label>
                          <Input
                            value={allowance.description}
                            onChange={(e) => updateAllowance(index, "description", e.target.value)}
                            placeholder="Optional description"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => removeAllowance(index)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="deductions" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Deductions</h3>
                <Button type="button" variant="outline" size="sm" onClick={addDeduction}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Deduction
                </Button>
              </div>
              {formData.deductions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deductions added. Click "Add Deduction" to add one.</p>
              ) : (
                <div className="space-y-3">
                  {formData.deductions.map((deduction, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="grid gap-2">
                          <Label>Type</Label>
                          <Select
                            value={deduction.type}
                            onValueChange={(value) => updateDeduction(index, "type", value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="epf">EPF</SelectItem>
                              <SelectItem value="etf">ETF</SelectItem>
                              <SelectItem value="insurance">Insurance</SelectItem>
                              <SelectItem value="advance">Advance</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="absence">Absence</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={deduction.amount}
                            onChange={(e) => updateDeduction(index, "amount", e.target.value)}
                          />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                          <Label>Description</Label>
                          <Input
                            value={deduction.description}
                            onChange={(e) => updateDeduction(index, "description", e.target.value)}
                            placeholder="Optional description"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => removeDeduction(index)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="payment" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="paymentStatus">Payment Status</Label>
                  <Select
                    value={formData.paymentStatus}
                    onValueChange={(value) => setFormData({ ...formData, paymentStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="processed">Processed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    rows={3}
                    placeholder="Additional notes or remarks"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add Payroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
