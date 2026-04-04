"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"

export default function ActiveTodayPage() {
  const router = useRouter()
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchTodayAttendance()
  }, [])

  const fetchTodayAttendance = async () => {
    try {
      setLoading(true)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      
      const response: any = await apiService.attendance.getAll()
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const attendanceData = Array.isArray(response?.data?.data) 
        ? response.data.data 
        : Array.isArray(response?.data)
        ? response.data
        : []
      
      // Filter for today's attendance with present/late/half-day status
      const todayAttendance = attendanceData.filter((att: any) => {
        if (!att) return false
        if (!att.date) return false
        
        try {
          const attDate = new Date(att.date)
          attDate.setHours(0, 0, 0, 0)
          const attDateStr = attDate.toISOString().split('T')[0]
          return attDateStr === todayStr && ['present', 'late', 'half-day'].includes(att.status)
        } catch {
          return false
        }
      })

      setAttendance(todayAttendance)
    } catch (err) {
      console.error("Failed to fetch attendance:", err)
      setAttendance([])
    } finally {
      setLoading(false)
    }
  }

  const filteredAttendance = Array.isArray(attendance)
    ? attendance.filter((record) =>
        record?.employee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record?.employeeIdString?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const presentCount = Array.isArray(attendance) ? attendance.length : 0
  const onTimeCount = Array.isArray(attendance) 
    ? attendance.filter((r) => r?.status === "present").length 
    : 0
  const lateCount = Array.isArray(attendance)
    ? attendance.filter((r) => r?.status === "late").length
    : 0
  const totalHours = Array.isArray(attendance)
    ? attendance.reduce((sum, r) => sum + (r?.hours || 0), 0)
    : 0
  const avgHours = presentCount > 0 ? (totalHours / presentCount).toFixed(1) : "0"
  
  // Calculate attendance rate (would need total employees)
  const totalEmployees = 0 // This would come from stats
  const attendanceRate = totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0
  const punctualityRate = presentCount > 0 ? Math.round((onTimeCount / presentCount) * 100) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Active Today</h1>
            <p className="text-muted-foreground mt-1">Employees currently present at work</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Present Today</p>
            <p className="text-3xl font-bold text-foreground mt-2">{presentCount}</p>
            {attendanceRate > 0 && (
              <div className="flex items-center gap-1 mt-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">{attendanceRate}% attendance</span>
              </div>
            )}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">On Time</p>
            <p className="text-3xl font-bold text-foreground mt-2">{onTimeCount}</p>
            {punctualityRate > 0 && (
              <p className="text-sm text-muted-foreground mt-2">{punctualityRate}% punctuality</p>
            )}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Late Arrivals</p>
            <p className="text-3xl font-bold text-foreground mt-2">{lateCount}</p>
            {presentCount > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {Math.round((lateCount / presentCount) * 100)}% of present
              </p>
            )}
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Avg Work Hours</p>
            <p className="text-3xl font-bold text-foreground mt-2">{avgHours}</p>
            <p className="text-sm text-muted-foreground mt-2">So far today</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Currently Active Employees</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Hours Worked</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No active employees found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.employee}</TableCell>
                    <TableCell>{record.department}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{record.checkIn || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{record.checkOut || "-"}</TableCell>
                    <TableCell>{record.hours ? `${record.hours.toFixed(1)} hrs` : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="default">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
