"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, CheckCircle2, XCircle, Clock, Loader2, FileText } from "lucide-react"
import { apiService } from "@/lib/api"

export function AttendanceView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employees, setEmployees] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    fetchAttendance()
  }, [])

  const fetchAttendance = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.attendance.getAll()
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const responseData = response.data as any
      const attendanceData = Array.isArray(responseData?.data)
        ? responseData.data
        : Array.isArray(responseData)
        ? responseData
        : []
      setAttendance(attendanceData)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch attendance")
      setAttendance([])
    } finally {
      setLoading(false)
    }
  }

  const filteredAttendance = Array.isArray(attendance)
    ? attendance.filter((record) =>
        record?.employee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.employeeIdString?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  // Calculate summary stats
  const presentCount = Array.isArray(attendance) 
    ? attendance.filter((r) => r?.status === "present").length 
    : 0
  const absentCount = Array.isArray(attendance)
    ? attendance.filter((r) => r?.status === "absent").length
    : 0
  const lateCount = Array.isArray(attendance)
    ? attendance.filter((r) => r?.status === "late").length
    : 0
  const leaveCount = Array.isArray(attendance)
    ? attendance.filter((r) => r?.status === "leave").length
    : 0

  return (
    <div className="space-y-4">
      {/* Search and Date Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search attendance..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Today
          </Button>
          <Button variant="outline">This Week</Button>
          <Button variant="outline">This Month</Button>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/attendance?status=present")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Present</p>
              <p className="text-xl font-bold text-foreground">{presentCount}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/attendance?status=absent")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Absent</p>
              <p className="text-xl font-bold text-foreground">{absentCount}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/attendance?status=late")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Late</p>
              <p className="text-xl font-bold text-foreground">{lateCount}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/attendance?status=leave")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">On Leave</p>
              <p className="text-xl font-bold text-foreground">{leaveCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Attendance Table */}
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Check In
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Check Out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hours
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
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                      <p className="text-sm font-medium text-foreground mb-1">
                        {attendance.length === 0 ? "No attendance records yet" : "No attendance records match your search"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attendance.length === 0 
                          ? "Attendance records will appear here once employees check in"
                          : "Try adjusting your search criteria"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/details/attendance/${record.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{record.employee}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-mono">{record.tid || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{record.department}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {record.date ? new Date(record.date).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{record.checkIn || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{record.checkOut || "-"}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {record.hours ? `${record.hours.toFixed(1)} hrs` : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={
                        record.status === "present"
                          ? "default"
                          : record.status === "absent"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {record.status}
                    </Badge>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
