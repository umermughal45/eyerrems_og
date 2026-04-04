"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Download, 
  Calendar, 
  DollarSign, 
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Search,
  Filter
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

export function PaymentHistoryView({ tenantData }: { tenantData: any }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [filteredPayments, setFilteredPayments] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")

  useEffect(() => {
    fetchPaymentHistory()
  }, [tenantData])

  useEffect(() => {
    applyFilters()
  }, [payments, invoices, searchTerm, statusFilter, dateFilter])

  const fetchPaymentHistory = async () => {
    try {
      setLoading(true)
      
      if (!tenantData?.id) return

      // Fetch payments
      const paymentsRes = await apiService.payments.getAll()
      const allPayments = Array.isArray((paymentsRes as any)?.data?.data)
        ? (paymentsRes as any).data.data
        : Array.isArray((paymentsRes as any)?.data)
          ? (paymentsRes as any).data
          : []
      
      const tenantPayments = allPayments.filter((p: any) => p.tenantId === tenantData.id)
      setPayments(tenantPayments)

      // Fetch invoices
      const invoicesRes = await apiService.invoices.getAll()
      const allInvoices = Array.isArray((invoicesRes as any)?.data?.data)
        ? (invoicesRes as any).data.data
        : Array.isArray((invoicesRes as any)?.data)
          ? (invoicesRes as any).data
          : []
      
      const tenantInvoices = allInvoices.filter((inv: any) => inv.tenantId === tenantData.id)
      setInvoices(tenantInvoices)
      
    } catch (error) {
      console.error("Error fetching payment history:", error)
      toast({
        title: "Error",
        description: "Failed to load payment history.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...payments]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((p: any) => {
        const searchLower = searchTerm.toLowerCase()
        return (
          p.paymentId?.toLowerCase().includes(searchLower) ||
          p.referenceNumber?.toLowerCase().includes(searchLower) ||
          p.method?.toLowerCase().includes(searchLower) ||
          p.amount?.toString().includes(searchLower)
        )
      })
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((p: any) => p.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date()
      filtered = filtered.filter((p: any) => {
        const paymentDate = new Date(p.date)
        switch (dateFilter) {
          case "today":
            return paymentDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return paymentDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            return paymentDate >= monthAgo
          case "year":
            const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
            return paymentDate >= yearAgo
          default:
            return true
        }
      })
    }

    // Sort by date (newest first)
    filtered.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    
    setFilteredPayments(filtered)
  }

  const getInvoiceForPayment = (payment: any) => {
    if (!payment.invoiceId) return null
    return invoices.find((inv: any) => inv.id === payment.invoiceId)
  }

  const handleDownloadReceipt = async (payment: any) => {
    try {
      // Generate receipt PDF
      const invoice = getInvoiceForPayment(payment)
      const receiptData = {
        receiptNumber: payment.paymentId || `REC-${payment.id.slice(0, 8)}`,
        paymentDate: payment.date,
        amount: payment.amount,
        method: payment.method,
        tenant: tenantData?.name,
        invoice: invoice ? {
          number: invoice.invoiceNumber,
          dueDate: invoice.dueDate,
          billingDate: invoice.billingDate
        } : null
      }

      // Call API to generate receipt
      try {
        const receiptRes = (await apiService.receipts?.generate?.(payment.id) || null) as any
        if (receiptRes?.data?.receiptUrl) {
          window.open(receiptRes.data.receiptUrl, '_blank')
          return
        }
      } catch (e) {
        console.warn("Receipt generation API not available, generating client-side")
      }

      // Fallback: Generate simple receipt
      const receiptContent = `
RENT PAYMENT RECEIPT
====================

Receipt Number: ${receiptData.receiptNumber}
Date: ${new Date(receiptData.paymentDate).toLocaleDateString()}
Tenant: ${receiptData.tenant}

Payment Details:
- Amount: ${formatCurrency(receiptData.amount)}
- Method: ${receiptData.method}
${receiptData.invoice ? `- Invoice: ${receiptData.invoice.number}` : ''}

Thank you for your payment!
      `.trim()

      const blob = new Blob([receiptContent], { type: "text/plain" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `receipt_${receiptData.receiptNumber}.txt`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Receipt Downloaded",
        description: "Your receipt has been downloaded.",
      })
    } catch (error) {
      console.error("Error downloading receipt:", error)
      toast({
        title: "Error",
        description: "Failed to download receipt.",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "paid":
        return <CheckCircle2 className="h-4 w-4 text-success" />
      case "pending":
        return <Clock className="h-4 w-4 text-warning" />
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "paid":
        return <Badge variant="default" className="bg-success">Paid</Badge>
      case "pending":
        return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payment History</h2>
          <p className="text-muted-foreground mt-1">View and download your payment receipts</p>
        </div>
        <Link href="/tenant?tab=pay-online">
          <Button>
            <DollarSign className="h-4 w-4 mr-2" />
            Pay Online
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => {
              setSearchTerm("")
              setStatusFilter("all")
              setDateFilter("all")
            }}>
              <Filter className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {/* Payment History Table */}
      <Card className="p-6">
        {filteredPayments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No payment history found</p>
            <Link href="/tenant?tab=pay-online">
              <Button variant="outline" className="mt-4">
                Make Your First Payment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPayments.map((payment: any) => {
              const invoice = getInvoiceForPayment(payment)
              const isLate = invoice && new Date(invoice.dueDate) < new Date(payment.date)
              
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      {getStatusIcon(payment.status)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-foreground">
                          Payment #{payment.paymentId || payment.id.slice(0, 8)}
                        </p>
                        {getStatusBadge(payment.status)}
                        {isLate && (
                          <Badge variant="outline" className="border-warning text-warning">
                            Late Payment
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(payment.date).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(payment.amount)}
                        </div>
                        <div>
                          Method: {payment.method || "N/A"}
                        </div>
                        {invoice && (
                          <div>
                            Invoice: {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                          </div>
                        )}
                      </div>
                      {payment.referenceNumber && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reference: {payment.referenceNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadReceipt(payment)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Receipt
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Paid</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(
                  filteredPayments
                    .filter((p: any) => p.status === "completed" || p.status === "paid")
                    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
                )}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="text-xl font-bold text-foreground">{filteredPayments.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
              <p className="text-xl font-bold text-foreground">
                {filteredPayments.filter((p: any) => p.status === "pending").length}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

