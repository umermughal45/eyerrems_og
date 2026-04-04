"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Search, AlertCircle, Clock, DollarSign, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"

type OutstandingInvoice = {
  id: string
  invoiceNumber: string
  tenant: string
  property?: string
  amount: number
  dueDate: string | null
  daysOverdue: number
  status: "Overdue" | "Due Soon" | "Upcoming"
  rawStatus: string
}

type Metrics = {
  totalOutstanding: number
  overdueCount: number
  overdueAmount: number
  dueThisWeekAmount: number
  dueThisWeekCount: number
  collectionRate: number
}

const formatCurrency = (amount: number) => {
  const value = Number(amount) || 0
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: value < 1000 ? 0 : 1,
  }).format(value)

  if (Math.abs(value) >= 10000000) {
    return `Rs ${(value / 10000000).toFixed(2)}Cr`
  }
  if (Math.abs(value) >= 100000) {
    return `Rs ${(value / 100000).toFixed(1)}L`
  }
  return `Rs ${formatted}`
}

export default function OutstandingPaymentsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<OutstandingInvoice[]>([])
  const [metrics, setMetrics] = useState<Metrics>({
    totalOutstanding: 0,
    overdueCount: 0,
    overdueAmount: 0,
    dueThisWeekAmount: 0,
    dueThisWeekCount: 0,
    collectionRate: 0,
  })

  useEffect(() => {
    fetchOutstandingInvoices()
  }, [])

  const fetchOutstandingInvoices = async () => {
    try {
      setLoading(true)
      setError(null)

      const response: any = await apiService.invoices.getAll()
      const data = Array.isArray(response?.data?.data)
        ? response.data.data
        : Array.isArray(response?.data)
          ? response.data
          : []

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const endOfWeek = new Date(today)
      endOfWeek.setDate(endOfWeek.getDate() + 7)

      let paidCount = 0
      const outstandingInvoices: OutstandingInvoice[] = data
        .map((invoice: any) => {
          // Safe date parsing with validation
          let dueDate: Date | null = null
          if (invoice.dueDate) {
            try {
              const parsedDate = new Date(invoice.dueDate)
              if (!isNaN(parsedDate.getTime())) {
                dueDate = parsedDate
              }
            } catch {
              dueDate = null
            }
          }

          const baseStatus = (invoice.status || "unpaid").toLowerCase()
          const isPaid = baseStatus === "paid"
          if (isPaid) {
            paidCount += 1
          }

          if (isPaid) {
            return null
          }

          let status: OutstandingInvoice["status"] = "Upcoming"
          let daysOverdue = 0

          if (dueDate && !isNaN(dueDate.getTime())) {
            try {
              const diff = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
              if (dueDate < today) {
                status = "Overdue"
                daysOverdue = diff > 0 ? diff : 0
              } else if (dueDate >= today && dueDate <= endOfWeek) {
                status = "Due Soon"
              }
            } catch {
              // If date calculation fails, keep default status
            }
          }

          // Extract tenant name - handle both string and object cases
          let tenantName = "Unknown tenant"
          if (invoice.tenant) {
            if (typeof invoice.tenant === "string") {
              tenantName = invoice.tenant
            } else if (typeof invoice.tenant === "object" && invoice.tenant !== null) {
              tenantName = invoice.tenant.name || invoice.tenant.fullName || invoice.tenant.email || "Unknown tenant"
            }
          } else if (invoice.tenantName) {
            tenantName = invoice.tenantName
          } else if (invoice.customer) {
            tenantName = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer.name || invoice.customer.fullName || invoice.customer.email || "Unknown tenant")
          }

          // Extract property name - handle both string and object cases
          let propertyName = "-"
          if (invoice.property) {
            if (typeof invoice.property === "string") {
              propertyName = invoice.property
            } else if (typeof invoice.property === "object" && invoice.property !== null) {
              propertyName = invoice.property.name || invoice.property.title || invoice.property.propertyCode || "-"
            }
          } else if (invoice.propertyName) {
            propertyName = invoice.propertyName
          } else if (invoice.unit) {
            propertyName = typeof invoice.unit === "string" ? invoice.unit : (invoice.unit.name || invoice.unit.unitCode || "-")
          } else if (invoice.unitName) {
            propertyName = invoice.unitName
          }

          return {
            id: invoice.id || `invoice-${Math.random()}`,
            invoiceNumber: invoice.invoiceNumber || invoice.invoiceId || invoice.id || "-",
            tenant: tenantName,
            property: propertyName,
            amount: Number(invoice.amount || invoice.totalAmount || invoice.balance || 0) || 0,
            dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate.toISOString() : null,
            daysOverdue,
            status,
            rawStatus: baseStatus,
          }
        })
        .filter(Boolean) as OutstandingInvoice[]

      const totalOutstanding = outstandingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
      const overdueInvoices = outstandingInvoices.filter((invoice) => invoice.status === "Overdue")
      const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)

      const dueThisWeek = outstandingInvoices.filter((invoice) => {
        if (!invoice.dueDate) return false
        try {
          const due = new Date(invoice.dueDate)
          if (isNaN(due.getTime())) return false
          return due >= today && due <= endOfWeek && invoice.status !== "Overdue"
        } catch {
          return false
        }
      })

      const dueThisWeekAmount = dueThisWeek.reduce((sum, invoice) => sum + invoice.amount, 0)
      const dueThisWeekCount = dueThisWeek.length

      const totalInvoices = data.length || outstandingInvoices.length + paidCount
      const collectionRate =
        totalInvoices > 0 ? Number(((paidCount / totalInvoices) * 100).toFixed(1)) : 0

      setInvoices(outstandingInvoices)
      setMetrics({
        totalOutstanding,
        overdueCount: overdueInvoices.length,
        overdueAmount,
        dueThisWeekAmount,
        dueThisWeekCount,
        collectionRate,
      })
    } catch (err: any) {
      console.error("Failed to fetch outstanding payments:", err)
      setError(err?.response?.data?.message || "Unable to load outstanding payments")
      setInvoices([])
      setMetrics({
        totalOutstanding: 0,
        overdueCount: 0,
        overdueAmount: 0,
        dueThisWeekAmount: 0,
        dueThisWeekCount: 0,
        collectionRate: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredPayments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return invoices
    return invoices.filter(
      (invoice) =>
        invoice.tenant.toLowerCase().includes(query) ||
        (invoice.property || "").toLowerCase().includes(query) ||
        invoice.invoiceNumber.toLowerCase().includes(query),
    )
  }, [invoices, searchQuery])

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Outstanding Payments</h1>
          <p className="text-muted-foreground mt-1">Track and manage pending payments</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {invoices.length} outstanding {invoices.length === 1 ? "invoice" : "invoices"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatCurrency(metrics.overdueAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.overdueCount} overdue {metrics.overdueCount === 1 ? "invoice" : "invoices"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.dueThisWeekAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.dueThisWeekCount} {metrics.dueThisWeekCount === 1 ? "invoice" : "invoices"} due
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.collectionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Paid invoices vs total issued</p>
          </CardContent>
        </Card>
      </div>

      {!loading && error && (
        <Card>
          <CardContent className="py-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by tenant, property, or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Days Overdue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No outstanding invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.tenant}</TableCell>
                    <TableCell>{invoice.property || "-"}</TableCell>
                    <TableCell className="font-bold">
                      {formatCurrency(invoice.amount)}
                    </TableCell>
                    <TableCell>
                      {invoice.dueDate ? (() => {
                        try {
                          const date = new Date(invoice.dueDate)
                          return !isNaN(date.getTime()) ? date.toLocaleDateString() : "—"
                        } catch {
                          return "—"
                        }
                      })() : "—"}
                    </TableCell>
                    <TableCell>
                      {invoice.daysOverdue > 0 ? (
                        <span className="text-destructive font-medium">
                          {invoice.daysOverdue} {invoice.daysOverdue === 1 ? "day" : "days"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "Overdue"
                            ? "destructive"
                            : invoice.status === "Due Soon"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        Send Reminder
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
