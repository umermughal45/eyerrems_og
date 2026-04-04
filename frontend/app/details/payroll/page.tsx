"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, DollarSign, Loader2, Search } from "lucide-react"

import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface PayrollRecord {
  id: string
  employee: string
  employeeId: string
  tid?: string | null
  department?: string
  month: string
  baseSalary: number
  bonus: number
  deductions: number
  netPay: number
  paidAmount?: number
  remainingBalance?: number
  status: string
}

export default function PayrollPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const statusFilter = searchParams.get("status")
  const [searchQuery, setSearchQuery] = useState("")
  const [records, setRecords] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiService.payroll.getAll()
      const responseData = response?.data as any
      const payrollData: PayrollRecord[] = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : []

      setRecords(payrollData)
    } catch (err: any) {
      console.error("Failed to fetch payroll records:", err)
      setError(err.response?.data?.message || "Failed to fetch payroll records")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayroll()
  }, [fetchPayroll])

  const handleStatusChange = (nextStatus: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextStatus) {
      params.set("status", nextStatus)
    } else {
      params.delete("status")
    }
    const query = params.toString()
    router.replace(`/details/payroll${query ? `?${query}` : ""}`, { scroll: false })
  }

  const formatCurrency = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return "Rs 0"
    return `Rs ${value.toLocaleString("en-IN")}`
  }

  const summary = useMemo(() => {
    if (records.length === 0) {
      return {
        totalAmount: 0,
        paidAmount: 0,
        paidCount: 0,
        pendingAmount: 0,
        pendingCount: 0,
        averageSalary: 0,
      }
    }

    const totalAmount = records.reduce((sum, record) => sum + (record.netPay || 0), 0)
    const paidAmount = records.reduce((sum, record) => sum + ((record as any).paidAmount || 0), 0)
    const pendingRecords = records.filter((record) => record.status === "created" || record.status === "partially_paid")
    const paidRecords = records.filter((record) => record.status === "paid" || record.status === "completed")
    const pendingAmount = pendingRecords.reduce((sum, record) => sum + ((record as any).remainingBalance || record.netPay || 0), 0)

    return {
      totalAmount,
      paidAmount,
      paidCount: paidRecords.length,
      pendingAmount,
      pendingCount: pendingRecords.length,
      averageSalary: records.length > 0 ? totalAmount / records.length : 0,
    }
  }, [records])

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        if (!statusFilter) return true
        return record.status === statusFilter
      })
      .filter((record) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
          record.employee.toLowerCase().includes(query) ||
          record.employeeId.toLowerCase().includes(query) ||
          record.department?.toLowerCase().includes(query) ||
          record.month.toLowerCase().includes(query)
        )
      })
  }, [records, searchQuery, statusFilter])

  const statusButtons: Array<{ label: string; value: string | null }> = [
    { label: "All", value: null },
    { label: "Fully Paid", value: "fully_paid" },
    { label: "Partially Paid", value: "partially_paid" },
    { label: "Created", value: "created" },
  ]

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payroll Details</h1>
            <p className="text-muted-foreground mt-1">
              {statusFilter ? `Showing ${statusFilter} payroll records` : "Complete payroll overview"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(summary.totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {records.length} {records.length === 1 ? "record" : "records"}
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(summary.paidAmount)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {summary.paidCount} {summary.paidCount === 1 ? "employee" : "employees"}
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-3xl font-bold text-foreground mt-2">{formatCurrency(summary.pendingAmount)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {summary.pendingCount} {summary.pendingCount === 1 ? "employee" : "employees"}
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Average Net Pay</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {formatCurrency(Number.isFinite(summary.averageSalary) ? summary.averageSalary : 0)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Per record</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
            <h3 className="text-lg font-semibold">Payroll Records</h3>
              <p className="text-sm text-muted-foreground">
                {filteredRecords.length} {filteredRecords.length === 1 ? "result" : "results"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 md:items-center">
              <div className="flex gap-2">
                {statusButtons.map((button) => {
                  const isActive = statusFilter === button.value || (!statusFilter && button.value === null)
                  return (
                    <Button
                      key={button.label}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusChange(button.value)}
                    >
                      {button.label}
                    </Button>
                  )
                })}
              </div>
              <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by employee, month or dept..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-10 text-destructive">{error}</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No payroll records found.</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                <TableHead>Month</TableHead>
                  <TableHead className="text-right">Base Salary</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow 
                  key={record.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/details/payroll/${record.id}`)}
                >
                  <TableCell className="font-medium">{record.employee}</TableCell>
                    <TableCell>{record.employeeId}</TableCell>
                    <TableCell className="font-mono text-xs">{record.tid || "-"}</TableCell>
                    <TableCell>{record.department || "-"}</TableCell>
                  <TableCell>{record.month}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.baseSalary)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.bonus)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.deductions)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(record.netPay)}</TableCell>
                  <TableCell>
                      <Badge 
                        variant={
                          record.status === "fully_paid" 
                            ? "default" 
                            : record.status === "partially_paid"
                              ? "secondary"
                              : "outline"
                        } 
                        className="capitalize"
                      >
                        {record.status === "fully_paid" ? "Fully Paid" : record.status === "partially_paid" ? "Partially Paid" : "Created"}
                      </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
