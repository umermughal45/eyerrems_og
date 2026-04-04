"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Calendar, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"

export default function AttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get("status")
  const [attendance, setAttendance] = useState<any[]>([])
  const [allAttendance, setAllAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchAttendance()
  }, [status])

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch all attendance records from API
      const response = await apiService.attendance.getAll()
      
      // Handle response structure
      const responseData = response.data as any
      const attendanceData = Array.isArray(responseData?.data) 
        ? responseData.data 
        : Array.isArray(responseData)
        ? responseData
        : []
      
      // Store all records for summary calculations
      setAllAttendance(attendanceData)
      
      // Filter by status if provided
      let filteredData = attendanceData
      if (status) {
        const statusLower = status.toLowerCase()
        filteredData = attendanceData.filter((r: any) => {
          if (!r || !r.status) return false
          const recordStatus = r.status.toLowerCase()
          // Handle status variations
          if (statusLower === "leave" || statusLower === "on-leave") {
            return recordStatus === "leave" || recordStatus === "on-leave"
          }
          return recordStatus === statusLower
        })
      }
      
      setAttendance(filteredData)
    } catch (err: any) {
      console.error("❌ Failed to fetch attendance:", err)
      setError(err.response?.data?.message || "Failed to fetch attendance records")
      setAttendance([])
      setAllAttendance([])
    } finally {
      setLoading(false)
    }
  }

  // Filter by search query
  const filteredRecords = attendance.filter((record) =>
    record?.employee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record?.employeeIdString?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record?.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate summary statistics from ALL attendance data
  const presentCount = allAttendance.filter((r) => r?.status?.toLowerCase() === "present").length
  const absentCount = allAttendance.filter((r) => r?.status?.toLowerCase() === "absent").length
  const lateCount = allAttendance.filter((r) => r?.status?.toLowerCase() === "late").length
  const leaveCount = allAttendance.filter((r) => {
    const s = r?.status?.toLowerCase()
    return s === "leave" || s === "on-leave"
  }).length

  const getStatusIcon = (status: string) => {
    if (!status) return null
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case "present":
        return <CheckCircle className="h-5 w-5 text-success" />
      case "absent":
        return <XCircle className="h-5 w-5 text-destructive" />
      case "late":
        return <Clock className="h-5 w-5 text-orange-500" />
      case "leave":
      case "on-leave":
        return <Calendar className="h-5 w-5 text-blue-500" />
      case "half-day":
        return <Clock className="h-5 w-5 text-blue-500" />
      default:
        return null
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
            <h1 className="text-3xl font-bold text-foreground">Attendance Records</h1>
            <p className="text-muted-foreground mt-1">
              {status ? `Showing ${status} records` : "Complete attendance overview"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Present</p>
            <p className="text-3xl font-bold text-foreground mt-2">{presentCount}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#ef4444,#b91c1c)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <XCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Absent</p>
            <p className="text-3xl font-bold text-foreground mt-2">{absentCount}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Late</p>
            <p className="text-3xl font-bold text-foreground mt-2">{lateCount}</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#8b5cf6,#6d28d9)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">On Leave</p>
            <p className="text-3xl font-bold text-foreground mt-2">{leaveCount}</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Attendance Details</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search employee..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {status ? `No ${status} attendance records found` : "No attendance records found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>TID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow 
                    key={record.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/details/attendance/${record.id}`)}
                  >
                    <TableCell className="font-medium">{record.employee || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{record.tid || "-"}</TableCell>
                    <TableCell>
                      {record.date ? new Date(record.date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>{record.checkIn || "-"}</TableCell>
                    <TableCell>{record.checkOut || "-"}</TableCell>
                    <TableCell>
                      {record.hours ? `${record.hours.toFixed(1)} hrs` : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(record.status)}
                        <Badge 
                          variant={
                            record.status?.toLowerCase() === "present" 
                              ? "default" 
                              : record.status?.toLowerCase() === "absent"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {record.status || "-"}
                        </Badge>
                      </div>
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
