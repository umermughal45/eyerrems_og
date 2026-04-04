"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Plus, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { apiService } from "@/lib/api"
import api from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useDropdownOptions } from "@/hooks/use-dropdowns"

interface PaymentPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealId: string
  clientId: string
  dealAmount: number
  onSuccess?: () => void
}

interface InstallmentRow {
  id: number
  installmentNumber: number
  type: string
  amount: number
  period: string
  dueDate: Date | null
  paymentMode: string
  notes: string
}

export function PaymentPlanDialog({
  open,
  onOpenChange,
  dealId,
  clientId,
  dealAmount,
  onSuccess,
}: PaymentPlanDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [numberOfInstallments, setNumberOfInstallments] = useState(3)
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [installments, setInstallments] = useState<InstallmentRow[]>([])
  const [notes, setNotes] = useState("")
  const [downPaymentType, setDownPaymentType] = useState<"percentage" | "manual">("manual")
  const [downPaymentPercentage, setDownPaymentPercentage] = useState<string>("")
  const [downPaymentAmount, setDownPaymentAmount] = useState<string>("")
  // Get installment types from advance options
  const { options: installmentTypeOptions } = useDropdownOptions("installment.type")

  // Calculate downpayment amount
  const calculatedDownPayment = useMemo(() => {
    if (downPaymentType === "percentage") {
      const percentage = parseFloat(downPaymentPercentage) || 0
      if (percentage > 0 && percentage <= 100) {
        return Math.round((dealAmount * percentage / 100) * 100) / 100
      }
      return 0
    } else {
      return parseFloat(downPaymentAmount) || 0
    }
  }, [downPaymentType, downPaymentPercentage, downPaymentAmount, dealAmount])

  // Calculate remaining amount after downpayment (for installments calculation)
  const remainingAmount = useMemo(() => {
    if (calculatedDownPayment > 0) {
      return Math.max(0, dealAmount - calculatedDownPayment)
    }
    return dealAmount
  }, [dealAmount, calculatedDownPayment])

  // Reset down payment state when dialog opens
  useEffect(() => {
    if (open) {
      setDownPaymentPercentage("")
      setDownPaymentAmount("")
    }
  }, [open])

  useEffect(() => {
    if (open && numberOfInstallments > 0) {
      // Use remaining amount (after downpayment deduction) for installments
      const defaultAmount = remainingAmount / numberOfInstallments
      const newInstallments: InstallmentRow[] = []
      
      for (let i = 0; i < numberOfInstallments; i++) {
        const dueDate = new Date(startDate)
        dueDate.setMonth(dueDate.getMonth() + i)
        
        newInstallments.push({
          id: Date.now() + i, // Unique ID for each installment
          installmentNumber: i + 1,
          type: "", // Will be selected from dropdown
          amount: Math.round(defaultAmount * 100) / 100,
          period: "", // Period in months/quarters/years
          dueDate,
          paymentMode: "bank",
          notes: "",
        })
      }
      
      // Adjust last installment to account for rounding
      const total = newInstallments.reduce((sum, inst) => sum + inst.amount, 0)
      if (Math.abs(total - remainingAmount) > 0.01) {
        newInstallments[newInstallments.length - 1].amount += remainingAmount - total
        newInstallments[newInstallments.length - 1].amount = Math.round(newInstallments[newInstallments.length - 1].amount * 100) / 100
      }
      
      setInstallments(newInstallments)
    }
  }, [open, numberOfInstallments, startDate, remainingAmount])

  // Exact update handler as specified
  const updateInstallment = (id: number, field: keyof InstallmentRow, value: any) => {
    setInstallments(prev =>
      prev.map(inst =>
        inst.id === id
          ? { ...inst, [field]: value }
          : inst
      )
    )
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)

      // Validate downpayment
      if (calculatedDownPayment < 0 || calculatedDownPayment > dealAmount) {
        toast({
          title: "Validation Error",
          description: `Down payment amount (${calculatedDownPayment.toLocaleString()}) cannot exceed deal amount (${dealAmount.toLocaleString()})`,
          variant: "destructive",
        })
        return
      }

      // Validate installments
      const total = installments.reduce((sum, inst) => sum + inst.amount, 0)
      const expectedTotal = remainingAmount
      if (Math.abs(total - expectedTotal) > 0.01) {
        toast({
          title: "Validation Error",
          description: `Total installment amount (${total.toLocaleString()}) must equal remaining amount after down payment (${expectedTotal.toLocaleString()})`,
          variant: "destructive",
        })
        return
      }

      const hasInvalidDates = installments.some((inst) => !inst.dueDate)
      if (hasInvalidDates) {
        toast({
          title: "Validation Error",
          description: "All installments must have a due date",
          variant: "destructive",
        })
        return
      }

      // Submit - down payment will be included as pending installment automatically
      const response = await api.post('/finance/payment-plans/create', {
        dealId,
        clientId,
        totalAmount: dealAmount,
        downPayment: calculatedDownPayment, // Will be added as pending installment
        installments: installments.map((i) => ({
          amount: i.amount,
          dueDate: i.dueDate?.toISOString(),
          type: i.type || null,
          paymentMode: i.paymentMode || null,
          notes: i.notes || null,
        })),
        notes,
      })

      const data: any = response.data || response

      if (!data || !data.success) {
        throw new Error(data?.error || "Failed to create payment plan")
      }

      toast({
        title: "Success",
        description: "Payment plan created successfully",
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment plan",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:max-w-4xl max-w-[95vw] sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Payment Plan</DialogTitle>
          <DialogDescription>
            Set up installment schedule for this deal. Total amount: Rs {dealAmount.toLocaleString("en-IN")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Down Payment Section */}
          <div className="space-y-4 border-b pb-4">
            <div>
              <Label className="text-base font-semibold">Down Payment</Label>
              <p className="text-sm text-muted-foreground">Enter down payment amount (will be deducted from total)</p>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Down Payment Type</Label>
                  <Select value={downPaymentType} onValueChange={(value: "percentage" | "manual") => {
                    setDownPaymentType(value)
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="manual">Manual Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  {downPaymentType === "percentage" ? (
                    <>
                      <Label>Down Payment Percentage (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={downPaymentPercentage}
                        onChange={(e) => {
                          const value = e.target.value
                          const num = parseFloat(value)
                          if (value === "" || (!isNaN(num) && num >= 0 && num <= 100)) {
                            setDownPaymentPercentage(value)
                          }
                        }}
                        placeholder="0.00"
                      />
                      {downPaymentPercentage && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Amount: Rs {calculatedDownPayment.toLocaleString("en-IN")}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Label>Down Payment Amount (Rs)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        max={dealAmount}
                        value={downPaymentAmount}
                        onChange={(e) => {
                          const value = e.target.value
                          const num = parseFloat(value)
                          if (value === "" || (!isNaN(num) && num >= 0 && num <= dealAmount)) {
                            setDownPaymentAmount(value)
                          }
                        }}
                        placeholder="0.00"
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
            {calculatedDownPayment > 0 && (
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Down Payment:</span>
                  <span className="text-sm font-semibold">Rs {calculatedDownPayment.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Remaining Amount for Installments:</span>
                  <span className="text-sm font-semibold">Rs {remainingAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-xs text-muted-foreground pt-1 border-t">
                  Note: Down payment will be automatically included as a pending installment when you create the plan.
                </div>
              </div>
            )}
          </div>

          {/* Basic Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="installments">Number of Installments</Label>
              <Input
                id="installments"
                type="number"
                min="1"
                value={numberOfInstallments}
                onChange={(e) => setNumberOfInstallments(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Installments will be calculated from remaining amount after down payment. Down payment will be added as pending installment automatically.
              </p>
            </div>
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={(date) => date && setStartDate(date)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Installments Table */}
          <div>
            <Label className="mb-2 block">Installments</Label>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Payment Mode</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {installments.map((installment) => (
                    <TableRow key={installment.id}>
                      <TableCell className="font-medium">{installment.installmentNumber}</TableCell>
                      <TableCell>
                        <Select
                          value={installment.type}
                          onValueChange={(value) => updateInstallment(installment.id, "type", value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {installmentTypeOptions && installmentTypeOptions.length > 0 ? (
                              installmentTypeOptions
                                .filter(opt => opt.isActive !== false)
                                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                .map((option) => (
                                  <SelectItem key={option.id} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))
                            ) : (
                              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                No installment types available. Add types in Advanced Options.
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={installment.amount}
                          onChange={(e) => updateInstallment(installment.id, "amount", Number(e.target.value) || 0)}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={installment.period}
                          onChange={(e) => updateInstallment(installment.id, "period", e.target.value)}
                          placeholder="Period"
                          className="w-24"
                        />
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !installment.dueDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {installment.dueDate ? format(installment.dueDate, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={installment.dueDate || undefined}
                              onSelect={(date) => updateInstallment(installment.id, "dueDate", date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={installment.paymentMode}
                          onValueChange={(value) => updateInstallment(installment.id, "paymentMode", value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank">Bank</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={installment.notes}
                          onChange={(e) => updateInstallment(installment.id, "notes", e.target.value)}
                          placeholder="Notes..."
                          className="w-48"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-2 space-y-1">
              <div className="text-sm text-muted-foreground">
                Installments Total: Rs {installments.reduce((sum, inst) => sum + inst.amount, 0).toLocaleString("en-IN")}
              </div>
              {calculatedDownPayment > 0 && (
                <div className="text-sm font-semibold">
                  Down Payment: Rs {calculatedDownPayment.toLocaleString("en-IN")} + Installments: Rs{" "}
                  {installments.reduce((sum, inst) => sum + inst.amount, 0).toLocaleString("en-IN")} = Total: Rs{" "}
                  {dealAmount.toLocaleString("en-IN")}
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes about this payment plan..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Payment Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

