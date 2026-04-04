"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Calendar, CheckCircle, Clock, Loader2, Search, XCircle } from "lucide-react"

import { apiService } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface LeaveRequest {
  id: string
  employee: string
  employeeId: string
  department?: string
  type: string
  startDate: string
  endDate: string
  days: number
  reason?: string | null
  status: "pending" | "approved" | "rejected" | string
}

export default function LeavePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const statusFilter = searchParams.get("status")
  const [searchQuery, setSearchQuery] = useState("")
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaveRequests = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiService.leave.getAll()
      const responseData = response?.data as any
      const leaveData: LeaveRequest[] = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
          ? responseData
          : []

      setLeaveRequests(leaveData)
    } catch (err: any) {
      console.error("Failed to fetch leave requests:", err)
      setError(err.response?.data?.message || "Failed to fetch leave requests")
      setLeaveRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeaveRequests()
  }, [fetchLeaveRequests])

  const handleStatusChange = (nextStatus: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (nextStatus) {
      params.set("status", nextStatus)
    } else {
      params.delete("status")
    }
    const query = params.toString()
    router.replace(`/details/leave${query ? `?${query}` : ""}`, { scroll: false })
  }

  const summary = useMemo(() => {
    if (leaveRequests.length === 0) {
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      }
    }

    return {
      total: leaveRequests.length,
      pending: leaveRequests.filter((request) => request.status === "pending").length,
      approved: leaveRequests.filter((request) => request.status === "approved").length,
      rejected: leaveRequests.filter((request) => request.status === "rejected").length,
    }
  }, [leaveRequests])

  const filteredRequests = useMemo(() => {
    return leaveRequests
      .filter((request) => {
        if (!statusFilter) return true
        return request.status === statusFilter
      })
      .filter((request) => {
        if (!searchQuery) return true
        const query = searchQuery.toLowerCase()
        return (
          request.employee.toLowerCase().includes(query) ||
          request.employeeId.toLowerCase().includes(query) ||
          request.department?.toLowerCase().includes(query) ||
          request.type.toLowerCase().includes(query)
        )
      })
  }, [leaveRequests, searchQuery, statusFilter])

  const statusButtons: Array<{ label: string; value: string | null; icon: JSX.Element }> = [
    { label: "All", value: null, icon: <Calendar className="h-4 w-4" /> },
    { label: "Pending", value: "pending", icon: <Clock className="h-4 w-4" /> },
    { label: "Approved", value: "approved", icon: <CheckCircle className="h-4 w-4" /> },
    { label: "Rejected", value: "rejected", icon: <XCircle className="h-4 w-4" /> },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return { variant: "default" as const, icon: <CheckCircle className="h-4 w-4 text-success" /> }
      case "rejected":
        return { variant: "destructive" as const, icon: <XCircle className="h-4 w-4 text-destructive" /> }
      case "pending":
        return { variant: "secondary" as const, icon: <Clock className="h-4 w-4 text-orange-500" /> }
      default:
        return { variant: "outline" as const, icon: null }
    }
  }

  const formatDate = (value?: string | null) => {
    if (!value) return "-"
    try {
      return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return "-"
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Leave Management</h1>
            <p className="text-muted-foreground mt-1">
              {statusFilter ? `Showing ${statusFilter} leave requests` : "Complete leave overview"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-3xl font-bold text-foreground mt-2">{summary.total}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-3xl font-bold text-foreground mt-2">{summary.pending}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-3xl font-bold text-foreground mt-2">{summary.approved}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#ef4444,#b91c1c)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <XCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Rejected</p>
            <p className="text-3xl font-bold text-foreground mt-2">{summary.rejected}</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
            <h3 className="text-lg font-semibold">Leave Requests</h3>
              <p className="text-sm text-muted-foreground">
                {filteredRequests.length} {filteredRequests.length === 1 ? "result" : "results"}
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
                      className="flex items-center gap-1"
                    >
                      {button.icon}
                      {button.label}
                    </Button>
                  )
                })}
              </div>
              <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by employee, type or department..."
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
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No leave requests found.</div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredRequests.map((request) => {
                  const statusBadge = getStatusBadge(request.status)
                  return (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.employee}</TableCell>
                      <TableCell>{request.employeeId}</TableCell>
                      <TableCell>{request.department || "-"}</TableCell>
                  <TableCell>{request.type}</TableCell>
                      <TableCell>{formatDate(request.startDate)}</TableCell>
                      <TableCell>{formatDate(request.endDate)}</TableCell>
                      <TableCell className="text-center font-semibold">{request.days}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                          {statusBadge.icon}
                          <Badge variant={statusBadge.variant} className="capitalize">
                        {request.status}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
                  )
                })}
            </TableBody>
          </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
