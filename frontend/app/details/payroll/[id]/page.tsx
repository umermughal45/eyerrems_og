"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, DollarSign, Loader2, Calendar, Clock, User, FileText, Plus, CheckCircle, XCircle } from "lucide-react"

import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

interface PayrollDetail {
  id: string
  employeeId: string
  month: string
  baseSalary: number
  bonus: number
  deductions: number
  netPay: number
  paidAmount: number
  remainingBalance: number
  paymentStatus: string
  employee: {
    id: string
    employeeId: string
    tid: string | null
    name: string
    email: string | null
    phone: string | null
    department: string
    position: string
    salary: number
  }
  payrollAllowances: Array<{
    id: string
    type: string
    amount: number
    description: string | null
  }>
  payrollDeductions: Array<{
    id: string
    type: string
    amount: number
    description: string | null
  }>
  payments: Array<{
    id: string
    amount: number
    paymentDate: string
    paymentMethod: string
    referenceNumber: string | null
    transactionId: string | null
    notes: string | null
    createdBy: {
      id: string
      username: string
      email: string
    } | null
  }>
  attendanceSummary: {
    totalDays: number
    presentDays: number
    absentDays: number
    leaveDays: number
    totalHours: number
    overtimeHours: number
  }
  leaveSummary: {
    totalRequests: number
    approvedDays: number
    pendingDays: number
    leaveRequests: Array<{
      id: string
      type: string
      startDate: string
      endDate: string
      days: number
      status: string
    }>
  }
}

export default function PayrollDetailPage() {
  const router = useRouter()
  const params = useParams()
  const payrollId = params.id as string
  const { toast } = useToast()
  
  const [payroll, setPayroll] = useState<PayrollDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [recordingPayment, setRecordingPayment] = useState(false)
  
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "",
    referenceNumber: "",
    transactionId: "",
    notes: "",
    paymentDate: new Date().toISOString().split('T')[0],
  })

  useEffect(() => {
    if (payrollId && payrollId.trim() !== '') {
      console.log("Fetching payroll details for ID:", payrollId)
      fetchPayroll()
    } else {
      console.error("Invalid payroll ID:", payrollId)
      setError("Invalid payroll ID")
      setLoading(false)
    }
  }, [payrollId])

  const fetchPayroll = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiService.payroll.getById(payrollId)
      const responseData = response?.data as any
      const payrollData: PayrollDetail | null = responseData?.data || responseData || null

      if (!payrollData) {
        setError("Payroll record not found")
        return
      }

      setPayroll(payrollData)
    } catch (err: any) {
      console.error("Failed to fetch payroll details:", err)
      setError(err.response?.data?.message || "Failed to fetch payroll details")
    } finally {
      setLoading(false)
    }
  }

  const handleRecordPayment = async () => {
    if (!payroll) return

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than 0",
        variant: "destructive",
      })
      return
    }

    if (!paymentForm.paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please select a payment method",
        variant: "destructive",
      })
      return
    }

    const paymentAmount = parseFloat(paymentForm.amount)
    if (paymentAmount > payroll.remainingBalance) {
      toast({
        title: "Amount Exceeds Balance",
        description: `Maximum payment: ${payroll.remainingBalance.toFixed(2)}`,
        variant: "destructive",
      })
      return
    }

    try {
      setRecordingPayment(true)
      
      // Call API to record payment
      await apiService.payroll.recordPayment(payrollId, {
        amount: paymentAmount,
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber || null,
        transactionId: paymentForm.transactionId || null,
        notes: paymentForm.notes || null,
        paymentDate: paymentForm.paymentDate,
      })

      toast({
        title: "Success",
        description: "Payment recorded successfully",
        variant: "default",
      })

      setShowPaymentDialog(false)
      setPaymentForm({
        amount: "",
        paymentMethod: "",
        referenceNumber: "",
        transactionId: "",
        notes: "",
        paymentDate: new Date().toISOString().split('T')[0],
      })

      // Refresh payroll data
      await fetchPayroll()
    } catch (err: any) {
      console.error("Failed to record payment:", err)
      
      // Extract error message from backend response
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          "Failed to record payment"
      
      // Handle accounting-specific errors with better messaging
      let title = "Error"
      let description = errorMessage
      
      if (errorMessage.includes("PAYROLL_ACCOUNTING_ERROR")) {
        title = "Accounting Error"
        // Remove the error prefix for cleaner display
        description = errorMessage.replace("PAYROLL_ACCOUNTING_ERROR:", "").trim()
        
        // Check if it's a configuration error
        if (errorMessage.includes("account mappings not configured")) {
          title = "Configuration Required"
          description = "Payroll account mappings are not configured. Please configure Salary Expense, Salary Payable, and Cash/Bank accounts in system settings."
        } else if (errorMessage.includes("exceeds remaining balance") || errorMessage.includes("overpayment")) {
          title = "Amount Validation Error"
          description = errorMessage.replace("PAYROLL_ACCOUNTING_ERROR:", "").trim()
        } else if (errorMessage.includes("must be approved and posted")) {
          title = "Payroll Not Approved"
          description = "This payroll must be approved before payments can be recorded. Please ensure the payroll has been created and approved."
        }
      }
      
      toast({
        title,
        description,
        variant: "destructive",
        duration: errorMessage.includes("PAYROLL_ACCOUNTING_ERROR") ? 8000 : 5000, // Longer duration for accounting errors
      })
    } finally {
      setRecordingPayment(false)
    }
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return "Rs 0"
    return `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (value: string | Date | null | undefined) => {
    if (!value) return "-"
    try {
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return "-"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_paid':
        return <Badge variant="default" className="capitalize">Fully Paid</Badge>
      case 'partially_paid':
        return <Badge variant="secondary" className="capitalize">Partially Paid</Badge>
      case 'created':
        return <Badge variant="outline" className="capitalize">Created</Badge>
      default:
        return <Badge variant="outline" className="capitalize">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Card className="p-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !payroll) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Card className="p-10 text-center">
            <p className="text-destructive">{error || "Payroll record not found"}</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Payroll Details</h1>
              <p className="text-muted-foreground mt-1">
                {payroll.employee.name} - {formatDate(payroll.month)}
              </p>
            </div>
          </div>
          {payroll.remainingBalance > 0 && (
            <Button onClick={() => setShowPaymentDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>

        {/* Payment Status Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Salary</p>
            <p className="text-2xl font-bold text-foreground mt-2">{formatCurrency(payroll.netPay)}</p>
            {getStatusBadge(payroll.paymentStatus)}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Paid Amount</p>
            <p className="text-2xl font-bold text-success mt-2">{formatCurrency(payroll.paidAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((payroll.paidAmount / payroll.netPay) * 100).toFixed(1)}% paid
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <XCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Remaining Balance</p>
            <p className="text-2xl font-bold text-warning mt-2">{formatCurrency(payroll.remainingBalance)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((payroll.remainingBalance / payroll.netPay) * 100).toFixed(1)}% remaining
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#64748b,#334155)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Payment Records</p>
            <p className="text-2xl font-bold text-foreground mt-2">{payroll.payments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total transactions</p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Employee & Payroll Info */}
          <Card className="p-6 lg:col-span-2 stat-card">
            <h2 className="text-lg font-semibold text-foreground mb-4">Employee & Payroll Information</h2>
            <Separator className="mb-4" />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Employee Name</p>
                <p className="text-lg font-semibold text-foreground">{payroll.employee.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="text-lg font-semibold text-foreground">{payroll.employee.employeeId}</p>
              </div>
              {payroll.employee.tid && (
                <div>
                  <p className="text-sm text-muted-foreground">Tracking ID</p>
                  <p className="text-lg font-semibold text-foreground font-mono">{payroll.employee.tid}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="text-lg font-semibold text-foreground">{payroll.employee.department}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="text-lg font-semibold text-foreground">{payroll.employee.position}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Month</p>
                <p className="text-lg font-semibold text-foreground">{formatDate(payroll.month)}</p>
              </div>
            </div>

            <Separator className="my-4" />

            <h3 className="text-md font-semibold text-foreground mb-3">Salary Breakdown</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Salary</span>
                <span className="font-semibold">{formatCurrency(payroll.baseSalary)}</span>
              </div>
              {payroll.bonus > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="font-semibold text-success">+{formatCurrency(payroll.bonus)}</span>
                </div>
              )}
              {payroll.payrollAllowances.length > 0 && (
                <>
                  {payroll.payrollAllowances.map((allowance) => (
                    <div key={allowance.id} className="flex justify-between">
                      <span className="text-muted-foreground">{allowance.type}</span>
                      <span className="font-semibold text-success">+{formatCurrency(allowance.amount)}</span>
                    </div>
                  ))}
                </>
              )}
              {payroll.deductions > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deductions</span>
                  <span className="font-semibold text-destructive">-{formatCurrency(payroll.deductions)}</span>
                </div>
              )}
              {payroll.payrollDeductions.length > 0 && (
                <>
                  {payroll.payrollDeductions.map((deduction) => (
                    <div key={deduction.id} className="flex justify-between">
                      <span className="text-muted-foreground">{deduction.type}</span>
                      <span className="font-semibold text-destructive">-{formatCurrency(deduction.amount)}</span>
                    </div>
                  ))}
                </>
              )}
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Net Pay</span>
                <span className="font-bold">{formatCurrency(payroll.netPay)}</span>
              </div>
            </div>
          </Card>

          {/* Attendance & Leave Summary */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Attendance & Leave</h2>
            <Separator className="mb-4" />
            
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Attendance Summary
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Days</span>
                    <span className="font-semibold">{payroll.attendanceSummary.totalDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Present</span>
                    <span className="font-semibold text-success">{payroll.attendanceSummary.presentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Absent</span>
                    <span className="font-semibold text-destructive">{payroll.attendanceSummary.absentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">On Leave</span>
                    <span className="font-semibold">{payroll.attendanceSummary.leaveDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Hours</span>
                    <span className="font-semibold">{payroll.attendanceSummary.totalHours.toFixed(1)} hrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overtime</span>
                    <span className="font-semibold text-success">{payroll.attendanceSummary.overtimeHours.toFixed(1)} hrs</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Leave Summary
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Requests</span>
                    <span className="font-semibold">{payroll.leaveSummary.totalRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Approved Days</span>
                    <span className="font-semibold text-success">{payroll.leaveSummary.approvedDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending Days</span>
                    <span className="font-semibold text-warning">{payroll.leaveSummary.pendingDays}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
              <p className="text-sm text-muted-foreground">
                Complete record of all payments made for this payroll
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {payroll.payments.length} {payroll.payments.length === 1 ? 'payment' : 'payments'}
            </Badge>
          </div>
          {payroll.payments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">No payments recorded yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Click "Record Payment" to add the first payment for this payroll
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference #</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payroll.payments.map((payment, index) => {
                    const cumulativeAmount = payroll.payments
                      .slice(0, index + 1)
                      .reduce((sum, p) => sum + p.amount, 0);
                    const isLastPayment = index === payroll.payments.length - 1;
                    
                    return (
                      <TableRow 
                        key={payment.id}
                        className={isLastPayment ? "bg-muted/30" : ""}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatDate(payment.paymentDate)}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.paymentDate).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <p className="font-semibold text-success">{formatCurrency(payment.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              Total: {formatCurrency(cumulativeAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {payment.paymentMethod}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {payment.referenceNumber ? (
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {payment.referenceNumber}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payment.transactionId ? (
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {payment.transactionId}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {payment.createdBy?.username || <span className="text-muted-foreground">System</span>}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {payment.notes ? (
                            <p className="text-sm text-muted-foreground truncate" title={payment.notes}>
                              {payment.notes}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {/* Payment Summary */}
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Payments</p>
                    <p className="font-semibold text-lg">{formatCurrency(payroll.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining Balance</p>
                    <p className="font-semibold text-lg text-warning">{formatCurrency(payroll.remainingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Count</p>
                    <p className="font-semibold text-lg">{payroll.payments.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Payment Dialog */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
              <DialogDescription>
                Record a payment for {payroll.employee.name}. Remaining balance: <strong>{formatCurrency(payroll.remainingBalance)}</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Payment Summary Card */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Net Pay</p>
                    <p className="font-semibold text-lg">{formatCurrency(payroll.netPay)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Already Paid</p>
                    <p className="font-semibold text-lg text-success">{formatCurrency(payroll.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining Balance</p>
                    <p className="font-semibold text-lg text-warning">{formatCurrency(payroll.remainingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Progress</p>
                    <p className="font-semibold text-lg">
                      {((payroll.paidAmount / payroll.netPay) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="amount">
                    Payment Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payroll.remainingBalance}
                    placeholder="0.00"
                    value={paymentForm.amount}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = parseFloat(value);
                      setPaymentForm({ ...paymentForm, amount: value });
                      // Auto-fill remaining balance if user enters a value >= remaining balance
                      if (numValue >= payroll.remainingBalance) {
                        // Optionally auto-fill full amount button
                      }
                    }}
                    className="text-lg font-semibold"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPaymentForm({ ...paymentForm, amount: payroll.remainingBalance.toString() })}
                      className="text-xs"
                    >
                      Fill Full Amount
                    </Button>
                    {payroll.remainingBalance > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentForm({ ...paymentForm, amount: (payroll.remainingBalance / 2).toFixed(2) })}
                        className="text-xs"
                      >
                        Half Amount
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum: {formatCurrency(payroll.remainingBalance)}
                  </p>
                  {paymentForm.amount && parseFloat(paymentForm.amount) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      After this payment: {formatCurrency(Math.max(0, payroll.remainingBalance - parseFloat(paymentForm.amount || "0")))}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">
                    Payment Method <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={paymentForm.paymentMethod}
                    onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="online">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the method used for this payment
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="paymentDate">Payment Date</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Date when payment was made
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    placeholder="e.g., CHQ-12345, TXN-ABC123"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cheque number, reference code, etc.
                  </p>
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="transactionId">Transaction ID</Label>
                  <Input
                    id="transactionId"
                    placeholder="e.g., Bank transaction ID, payment gateway ID"
                    value={paymentForm.transactionId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Transaction ID from bank or payment gateway (recommended for reconciliation)
                  </p>
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Additional notes or remarks about this payment..."
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)} disabled={recordingPayment}>
                Cancel
              </Button>
              <Button 
                onClick={handleRecordPayment} 
                disabled={recordingPayment || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0 || !paymentForm.paymentMethod}
              >
                {recordingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording Payment...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Record Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

