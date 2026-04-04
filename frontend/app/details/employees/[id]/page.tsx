"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, BadgeCheck, Calendar, Clock, DollarSign, Loader2, Mail, Phone, User, FileText, Download, Eye } from "lucide-react"

import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { DocumentViewer } from "@/components/shared/document-viewer"

interface EmployeePayload {
  id: string
  employeeId?: string
  tid?: string | null
  name?: string
  email?: string | null
  phone?: string | null
  department?: string | null
  position?: string | null
  joinDate?: string | null
  status?: string | null
  salary?: number | null
  profilePhotoUrl?: string | null
  cnicDocumentUrl?: string | null
  cnic?: string | null
  attendance?: Array<{
    id: string
    date: string
    status: string
    checkIn?: string | null
    checkOut?: string | null
    hours?: number | null
    totalWorkDuration?: string | null
  }>
  payroll?: Array<{
    id: string
    month: string
    baseSalary: number
    bonus: number
    deductions: number
    netPay: number
    status: string
    paymentStatus?: string
  }>
  leaveRequests?: Array<{
    id: string
    type: string
    startDate: string
    endDate: string
    status: string
    days: number
    reason?: string | null
  }>
  leaveBalances?: Array<{
    id: string
    leaveType: string
    totalAllocated: number
    used: number
    pending: number
    available: number
    year: number
  }>
}

export default function EmployeeDetailPage() {
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string
  const [employee, setEmployee] = useState<EmployeePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<{ id?: string; url: string; name: string; fileType: string } | null>(null)
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false)

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await apiService.employees.getById(employeeId)
        const responseData = response?.data as any
        const employeeData: EmployeePayload | null = responseData?.data || responseData || null

        if (!employeeData) {
          setError("Employee not found")
          return
        }

        setEmployee(employeeData)
      } catch (err: any) {
        console.error("Failed to fetch employee details:", err)
        setError(err.response?.data?.message || "Failed to fetch employee details")
      } finally {
        setLoading(false)
      }
    }

    fetchEmployee()
  }, [employeeId])

  const payrollStats = useMemo(() => {
    if (!employee?.payroll || employee.payroll.length === 0) {
      return {
        total: 0,
        paidTotal: 0,
        pendingTotal: 0,
        pendingCount: 0,
      }
    }

    const total = employee.payroll.reduce((sum, record) => sum + (record.netPay || 0), 0)
    const paidTotal = employee.payroll
      .filter((record) => record.status === "paid")
      .reduce((sum, record) => sum + (record.netPay || 0), 0)
    const pendingRecords = employee.payroll.filter((record) => record.status === "pending")
    const pendingTotal = pendingRecords.reduce((sum, record) => sum + (record.netPay || 0), 0)

    return {
      total,
      paidTotal,
      pendingTotal,
      pendingCount: pendingRecords.length,
    }
  }, [employee?.payroll])

  const lastAttendance = useMemo(() => {
    if (!employee?.attendance || employee.attendance.length === 0) return null
    return employee.attendance[0]
  }, [employee?.attendance])

  const leaveStats = useMemo(() => {
    if (!employee?.leaveRequests || employee.leaveRequests.length === 0) {
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalDaysUsed: 0,
        totalDaysPending: 0,
      }
    }

    const total = employee.leaveRequests.length
    const pending = employee.leaveRequests.filter((request) => request.status === "pending").length
    const approved = employee.leaveRequests.filter((request) => request.status === "approved").length
    const rejected = employee.leaveRequests.filter((request) => request.status === "rejected").length
    const totalDaysUsed = employee.leaveRequests
      .filter((request) => request.status === "approved")
      .reduce((sum, request) => sum + (request.days || 0), 0)
    const totalDaysPending = employee.leaveRequests
      .filter((request) => request.status === "pending")
      .reduce((sum, request) => sum + (request.days || 0), 0)

    return { total, pending, approved, rejected, totalDaysUsed, totalDaysPending }
  }, [employee?.leaveRequests])

  const formatCurrency = (value: number | null | undefined) => {
    if (!value || Number.isNaN(value)) return "Rs 0"
    return `Rs ${value.toLocaleString("en-IN")}`
  }

  const formatDate = (value?: string | null, options?: Intl.DateTimeFormatOptions) => {
    if (!value) return "-"
    try {
      return new Date(value).toLocaleDateString(undefined, options)
    } catch {
      return "-"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
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

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Card className="p-10 text-center">
            <p className="text-destructive">{error || "Employee not found"}</p>
          </Card>
        </div>
      </div>
    )
  }

  const statusVariant =
    employee.status === "active"
      ? "default"
      : employee.status === "on-leave"
        ? "secondary"
        : employee.status === "inactive"
          ? "destructive"
          : "outline"

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Employee Profile</h1>
            <p className="text-muted-foreground mt-1">Detailed insights for {employee.name}</p>
          </div>
        </div>

        <Card className="p-6">
          <div className="grid gap-6 md:grid-cols-[auto,1fr]">
            <div className="flex flex-col items-center gap-3">
              {/* Profile Picture - Circular Avatar */}
              {employee.profilePhotoUrl ? (
                <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-primary/20">
                  <img
                    src={employee.profilePhotoUrl.startsWith('http') 
                      ? employee.profilePhotoUrl 
                      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}${employee.profilePhotoUrl.replace(/^\/api/, '')}`}
                    alt={employee.name || "Employee"}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none"
                      const parent = (e.target as HTMLImageElement).parentElement
                      if (parent) {
                        parent.innerHTML = '<div class="h-full w-full flex items-center justify-center bg-primary/10"><svg class="h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>'
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
                  <User className="h-12 w-12 text-primary" />
                </div>
              )}
              <Badge variant={statusVariant} className="capitalize">
                {employee.status || "unknown"}
              </Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-lg font-semibold text-foreground">{employee.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="text-lg font-semibold text-foreground">{employee.employeeId || "-"}</p>
              </div>
              {employee.tid && (
                <div>
                  <p className="text-sm text-muted-foreground">Tracking ID</p>
                  <p className="text-lg font-semibold text-foreground">{employee.tid}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="text-lg font-semibold text-foreground">{employee.department || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="text-lg font-semibold text-foreground">{employee.position || "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a
                  href={employee.email ? `mailto:${employee.email}` : undefined}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {employee.email || "Not provided"}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={employee.phone ? `tel:${employee.phone}` : undefined}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {employee.phone || "Not provided"}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Joined {formatDate(employee.joinDate, { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  Base Salary {formatCurrency(employee.salary || null)}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Documents Section */}
        {(employee.cnicDocumentUrl || employee.cnic) && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Documents</h2>
            <Separator className="mb-4" />
            <div className="space-y-3">
              {employee.cnic && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">CNIC Number</p>
                      <p className="text-xs text-muted-foreground">{employee.cnic}</p>
                    </div>
                  </div>
                </div>
              )}
              {employee.cnicDocumentUrl && (
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">CNIC Document</p>
                      <p className="text-xs text-muted-foreground">Identity document</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const docUrl = employee.cnicDocumentUrl!.startsWith('http')
                          ? employee.cnicDocumentUrl!
                          : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}${employee.cnicDocumentUrl!.replace(/^\/api/, '')}`
                        setSelectedDocument({
                          url: docUrl,
                          name: 'CNIC Document',
                          fileType: 'application/pdf'
                        })
                        setDocumentViewerOpen(true)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const docUrl = employee.cnicDocumentUrl!.startsWith('http')
                          ? employee.cnicDocumentUrl!
                          : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}${employee.cnicDocumentUrl!.replace(/^\/api/, '')}`
                        window.open(docUrl, '_blank')
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Document Viewer */}
        {selectedDocument && (
          <DocumentViewer
            open={documentViewerOpen}
            onClose={() => {
              setDocumentViewerOpen(false)
              setSelectedDocument(null)
            }}
            document={selectedDocument}
          />
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110 mb-2">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <p className="text-2xl font-bold text-foreground mt-2">{formatCurrency(payrollStats.total)}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110 mb-2">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-foreground mt-2">{formatCurrency(payrollStats.paidTotal)}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110 mb-2">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {formatCurrency(payrollStats.pendingTotal)}{" "}
              <span className="text-sm text-muted-foreground block">{payrollStats.pendingCount} records</span>
            </p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-lg transition-transform duration-300 hover:scale-110 mb-2">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <p className="text-sm text-muted-foreground">Last Attendance</p>
            {lastAttendance ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(lastAttendance.date, { weekday: "long", month: "short", day: "numeric" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="capitalize">{lastAttendance.status}</span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">No attendance records</p>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Recent Payroll</h2>
              <Badge variant="outline" className="capitalize">
                {employee.payroll?.[0]?.status || "—"}
              </Badge>
            </div>
            {employee.payroll && employee.payroll.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.payroll.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.month}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.baseSalary)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.bonus)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(record.deductions)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(record.netPay)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (record.status === "paid" || record.paymentStatus === "paid")
                              ? "default"
                              : (record.status === "pending" || record.paymentStatus === "pending")
                                ? "secondary"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {record.paymentStatus || record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No payroll records available.</p>
            )}
          </Card>

          {/* Leave Management Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Leave Management</h2>
              <Badge variant="outline">{leaveStats.total} requests</Badge>
            </div>
            
            {/* Leave Balance Summary */}
            {employee.leaveBalances && employee.leaveBalances.length > 0 && (
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <h3 className="text-sm font-semibold mb-3">Leave Balances</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {employee.leaveBalances.map((balance) => (
                    <div key={balance.id} className="space-y-1">
                      <p className="text-xs text-muted-foreground capitalize">{balance.leaveType}</p>
                      <p className="text-sm font-semibold">
                        {balance.available.toFixed(1)} / {balance.totalAllocated.toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Used: {balance.used.toFixed(1)} | Pending: {balance.pending.toFixed(1)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leave Statistics */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-lg font-semibold text-success">{leaveStats.approved}</p>
                <p className="text-xs text-muted-foreground">{leaveStats.totalDaysUsed} days</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-semibold text-warning">{leaveStats.pending}</p>
                <p className="text-xs text-muted-foreground">{leaveStats.totalDaysPending} days</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Rejected</p>
                <p className="text-lg font-semibold text-destructive">{leaveStats.rejected}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-semibold text-foreground">Recent Leave Requests</h3>
            </div>
            {employee.leaveRequests && employee.leaveRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.leaveRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.type}</TableCell>
                      <TableCell>
                        <p>{formatDate(request.startDate)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(request.endDate)}</p>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{request.days}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.status === "approved"
                              ? "default"
                              : request.status === "rejected"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No leave requests recorded.</p>
            )}
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Attendance History</h2>
            <Badge variant="outline">{employee.attendance?.length ?? 0} records</Badge>
          </div>
          {employee.attendance && employee.attendance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead className="text-right">Hours Worked</TableHead>
                  <TableHead className="text-right">Total Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employee.attendance.map((record) => {
                  const checkInTime = record.checkIn
                    ? new Date(record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "-"
                  const checkOutTime = record.checkOut
                    ? new Date(record.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    : "-"
                  
                  // Calculate hours if not stored but both times exist
                  let hoursDisplay = "-"
                  if (typeof record.hours === "number") {
                    hoursDisplay = `${record.hours.toFixed(2)} hrs`
                  } else if (record.checkIn && record.checkOut) {
                    const checkIn = new Date(record.checkIn).getTime()
                    const checkOut = new Date(record.checkOut).getTime()
                    const hours = (checkOut - checkIn) / (1000 * 60 * 60)
                    hoursDisplay = `${hours.toFixed(2)} hrs`
                  }

                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        {formatDate(record.date, { year: "numeric", month: "short", day: "numeric", weekday: "short" })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            record.status === "Checked Out"
                              ? "default"
                              : record.status === "Checked In"
                                ? "secondary"
                                : record.status === "present"
                                  ? "default"
                                  : record.status === "late"
                                    ? "secondary"
                                    : record.status === "absent"
                                      ? "destructive"
                                      : "outline"
                          }
                          className="capitalize"
                        >
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{checkInTime}</TableCell>
                      <TableCell className="font-mono text-sm">{checkOutTime}</TableCell>
                      <TableCell className="text-right font-semibold">{hoursDisplay}</TableCell>
                      <TableCell className="text-right font-semibold">{record.totalWorkDuration || "-"}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No attendance history available.</p>
          )}
        </Card>
      </div>
    </div>
  )
}


