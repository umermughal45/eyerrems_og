"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DollarSign, Download, CreditCard, Calendar, CheckCircle2, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function PaymentsView({ tenantData, leaseData }: { tenantData: any; leaseData: any }) {
  const { toast } = useToast()
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [nextPayment, setNextPayment] = useState<any>(null)
  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    amount: "",
    method: "Bank Transfer",
    date: new Date().toISOString().split('T')[0],
    notes: "",
  })
  const [summary, setSummary] = useState({
    totalPaid: 0,
    onTimeRate: 0,
    nextDue: "N/A",
  })

  useEffect(() => {
    fetchPayments()
  }, [tenantData])

  const fetchPayments = async () => {
    try {
      setLoading(true)

      // Get payments for this tenant
      const paymentsRes = await apiService.payments.getAll()
      const allPayments = Array.isArray((paymentsRes as any)?.data?.data)
        ? (paymentsRes as any).data.data
        : Array.isArray((paymentsRes as any)?.data)
          ? (paymentsRes as any).data
          : []

      const tenantPayments = tenantData?.id
        ? allPayments.filter((p: any) => p.tenantId === tenantData.id)
        : []
      setPayments(tenantPayments)

      // Get invoices for this tenant
      const invoicesRes = await apiService.invoices.getAll()
      const allInvoices = Array.isArray((invoicesRes as any)?.data?.data)
        ? (invoicesRes as any).data.data
        : Array.isArray((invoicesRes as any)?.data)
          ? (invoicesRes as any).data
          : []

      const tenantInvoices = tenantData?.id
        ? allInvoices.filter((inv: any) => inv.tenantId === tenantData.id)
        : []
      setInvoices(tenantInvoices)

      // Find next payment
      const upcomingInvoice = tenantInvoices
        .filter((inv: any) => {
          const dueDate = new Date(inv.dueDate)
          const isPaid = inv.status === "paid" || inv.status === "Paid"
          return dueDate >= new Date() && !isPaid
        })
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]

      setNextPayment(upcomingInvoice)

      // Calculate summary
      const currentYear = new Date().getFullYear()
      const yearPayments = tenantPayments.filter((p: any) => {
        const paymentDate = new Date(p.date)
        return paymentDate.getFullYear() === currentYear
      })

      const totalPaid = yearPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
      const onTimePayments = yearPayments.filter((p: any) => {
        // Check if payment was on time (simplified - would need invoice comparison)
        return p.status === "completed" || p.status === "paid"
      }).length
      const onTimeRate = yearPayments.length > 0 ? Math.round((onTimePayments / yearPayments.length) * 100) : 100

      setSummary({
        totalPaid,
        onTimeRate,
        nextDue: upcomingInvoice
          ? new Date(upcomingInvoice.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : "N/A",
      })
    } catch (error) {
      console.error("Error fetching payments:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!paymentForm.amount || !paymentForm.method) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    const amount = parseFloat(paymentForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      await apiService.tenantPortal.pay(tenantData?.id, {
        invoiceId: (paymentForm.invoiceId && paymentForm.invoiceId !== 'none') ? paymentForm.invoiceId : null,
        amount,
        paymentMethod: paymentForm.method,
        date: new Date(paymentForm.date).toISOString(),
        notes: paymentForm.notes || undefined,
        status: "completed",
      })

      toast({
        title: "Payment Recorded",
        description: "Your payment has been recorded successfully.",
      })

      // Reset form
      setPaymentForm({
        invoiceId: "",
        amount: "",
        method: "Bank Transfer",
        date: new Date().toISOString().split('T')[0],
        notes: "",
      })
      setShowPaymentForm(false)

      // Refresh data
      await fetchPayments()
    } catch (error: any) {
      console.error("Error creating payment:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const daysRemaining = nextPayment
    ? Math.ceil((new Date(nextPayment.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="space-y-6">
      {/* Current Payment Due */}
      {nextPayment && (
        <Card className="p-6 bg-primary/5 border-primary/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Next Payment Due</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    Rs ${(nextPayment.amount || 0).toLocaleString("en-PK")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {new Date(nextPayment.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days Remaining</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {daysRemaining > 0 ? `${daysRemaining} days` : "Overdue"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className="mt-1">
                    {nextPayment.status || "Pending"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button onClick={() => setShowPaymentForm(true)} disabled={submitting}>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
            <Button variant="outline" disabled={submitting}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Payment
            </Button>
          </div>
        </Card>
      )}

      {/* Payment Form */}
      {showPaymentForm && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Record Payment</h3>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice">Invoice (Optional)</Label>
                <Select
                  value={paymentForm.invoiceId}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, invoiceId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {invoices
                      .filter((inv: any) => inv.status !== "paid" && inv.status !== "Paid")
                      .map((inv: any) => (
                        <SelectItem key={inv.id} value={inv.id.toString()}>
                          {new Date(inv.dueDate).toLocaleDateString()} - ${inv.amount}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="method">Payment Method *</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Debit Card">Debit Card</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                    <SelectItem value="Online Payment">Online Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this payment"
                rows={3}
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Record Payment
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPaymentForm(false)
                  setPaymentForm({
                    invoiceId: "",
                    amount: "",
                    method: "Bank Transfer",
                    date: new Date().toISOString().split('T')[0],
                    notes: "",
                  })
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Payment History */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Payment History</h3>
        {payments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No payment history available.</p>
        ) : (
          <div className="space-y-3">
            {payments
              .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {new Date(payment.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Paid via {payment.method || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        Rs ${Number(payment.amount || 0).toLocaleString("en-PK")}
                      </p>
                      <Badge variant="default" className="mt-1">
                        {payment.status || "completed"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Payment Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid ({new Date().getFullYear()})</p>
              <p className="text-xl font-bold text-foreground">Rs {summary.totalPaid.toLocaleString("en-PK")}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On-Time Payments</p>
              <p className="text-xl font-bold text-foreground">{summary.onTimeRate}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Due</p>
              <p className="text-xl font-bold text-foreground">{summary.nextDue}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
