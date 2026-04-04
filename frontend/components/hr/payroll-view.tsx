"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, DollarSign, Loader2 } from "lucide-react"
import { AddPayrollDialog } from "./add-payroll-dialog"
import { apiService } from "@/lib/api"

export function PayrollView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [payroll, setPayroll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchPayroll()
  }, [])

  const fetchPayroll = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.payroll.getAll()
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const responseData = response.data as any
      const payrollData = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
        ? responseData
        : []
      setPayroll(payrollData)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch payroll")
      setPayroll([])
    } finally {
      setLoading(false)
    }
  }

  const filteredPayroll = Array.isArray(payroll)
    ? payroll.filter((record) =>
        record?.employee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.department?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  // Calculate summary stats
  const totalPayroll = Array.isArray(payroll)
    ? payroll.reduce((sum, record) => sum + (record?.netPay || 0), 0)
    : 0
  const paidCount = Array.isArray(payroll)
    ? payroll.filter((r) => r?.status === "fully_paid").length
    : 0
  const paidAmount = Array.isArray(payroll)
    ? payroll
        .filter((r) => r?.status === "fully_paid")
        .reduce((sum, record) => sum + (record?.netPay || 0), 0)
    : 0
  const pendingCount = Array.isArray(payroll)
    ? payroll.filter((r) => r?.status === "created" || r?.status === "partially_paid").length
    : 0
  const pendingAmount = Array.isArray(payroll)
    ? payroll
        .filter((r) => r?.status === "created" || r?.status === "partially_paid")
        .reduce((sum, record) => sum + ((record as any)?.remainingBalance || record?.netPay || 0), 0)
    : 0

  // Get current month
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payroll..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Payroll Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/payroll")}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payroll</p>
              <p className="text-2xl font-bold text-foreground">Rs {totalPayroll.toLocaleString("en-PK")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Current Period</p>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/payroll?status=fully_paid")}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Paid</p>
              <p className="text-2xl font-bold text-foreground">Rs {paidAmount.toLocaleString("en-PK")}</p>
            </div>
          </div>
          <p className="text-sm text-success">{paidCount} employees</p>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/payroll?status=partially_paid")}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold text-foreground">Rs {pendingAmount.toLocaleString("en-PK")}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{pendingCount} employees</p>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  TID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Base Salary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Bonus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Deductions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Net Pay
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-destructive">{error}</td>
                </tr>
              ) : filteredPayroll.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <DollarSign className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {payroll.length === 0 ? "No payroll records yet" : "No payroll records match your search"}
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        {payroll.length === 0 
                          ? "Process payroll for employees to track salaries, bonuses, and deductions"
                          : "Try adjusting your search criteria"}
                      </p>
                      {payroll.length === 0 && (
                        <Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Process Payroll
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayroll.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/details/payroll/${record.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium text-foreground">{record.employee}</p>
                      <p className="text-xs text-muted-foreground">{record.employeeId}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono">{record.tid || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{record.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    Rs {(record.baseSalary || 0).toLocaleString("en-PK")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-success">
                    +Rs {(record.bonus || 0).toLocaleString("en-PK")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-destructive">
                    -Rs {(record.deductions || 0).toLocaleString("en-PK")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-foreground">
                    Rs {(record.netPay || 0).toLocaleString("en-PK")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <AddPayrollDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={fetchPayroll} />
    </div>
  )
}
