"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, TrendingUp, Loader2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { apiService } from "@/lib/api"

export default function WorkHoursPage() {
  const router = useRouter()
  const [attendance, setAttendance] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [attendanceResponse, employeesResponse] = await Promise.all([
        apiService.attendance.getAll(),
        apiService.employees.getAll(),
      ])

      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const attendanceData = Array.isArray((attendanceResponse as any)?.data?.data) 
        ? (attendanceResponse as any).data.data 
        : Array.isArray((attendanceResponse as any)?.data)
        ? (attendanceResponse as any).data
        : []
      
      const employeesData = Array.isArray((employeesResponse as any)?.data?.data)
        ? (employeesResponse as any).data.data
        : Array.isArray((employeesResponse as any)?.data)
        ? (employeesResponse as any).data
        : []

      setAttendance(attendanceData)
      setEmployees(employeesData)
    } catch (err) {
      console.error("Failed to fetch data:", err)
      setAttendance([])
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  // Calculate weekly data (last 7 days)
  const getWeeklyData = () => {
    if (!Array.isArray(attendance) || attendance.length === 0) {
      return []
    }

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const weeklyData: any[] = []
    const today = new Date()

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dayName = days[date.getDay()]
      const dateStr = date.toISOString().split('T')[0]

      const dayAttendance = attendance.filter((att: any) => {
        if (!att) return false
        const attDate = att.date ? new Date(att.date).toISOString().split('T')[0] : null
        return attDate === dateStr && att.hours
      })

      const totalHours = dayAttendance.reduce((sum: number, att: any) => sum + (att.hours || 0), 0)
      const avgHours = dayAttendance.length > 0 ? totalHours / dayAttendance.length : 0

      weeklyData.push({
        day: dayName,
        hours: Math.round(avgHours * 10) / 10,
      })
    }

    return weeklyData
  }

  // Calculate employee hours for this week and last week
  const getEmployeeHours = () => {
    if (!Array.isArray(employees) || employees.length === 0) {
      return []
    }
    if (!Array.isArray(attendance)) {
      return []
    }

    const today = new Date()
    const thisWeekStart = new Date(today)
    thisWeekStart.setDate(today.getDate() - today.getDay())
    thisWeekStart.setHours(0, 0, 0, 0)

    const lastWeekStart = new Date(thisWeekStart)
    lastWeekStart.setDate(lastWeekStart.getDate() - 7)

    const lastWeekEnd = new Date(thisWeekStart)
    lastWeekEnd.setMilliseconds(-1)

    return employees.map((emp: any) => {
      if (!emp || !emp.id) return null

      const thisWeekAtt = attendance.filter((att: any) => {
        if (!att || att.employeeId !== emp.id) return false
        const attDate = att.date ? new Date(att.date) : null
        return attDate && attDate >= thisWeekStart && att.hours
      })

      const lastWeekAtt = attendance.filter((att: any) => {
        if (!att || att.employeeId !== emp.id) return false
        const attDate = att.date ? new Date(att.date) : null
        return attDate && attDate >= lastWeekStart && attDate < thisWeekStart && att.hours
      })

      const thisWeekHours = thisWeekAtt.reduce((sum: number, att: any) => sum + (att.hours || 0), 0)
      const lastWeekHours = lastWeekAtt.reduce((sum: number, att: any) => sum + (att.hours || 0), 0)
      const avgHours = thisWeekAtt.length > 0 ? thisWeekHours / thisWeekAtt.length : 0

      return {
        id: emp.id,
        name: emp.name || "Unknown",
        department: emp.department || "Unknown",
        thisWeek: Math.round(thisWeekHours * 10) / 10,
        lastWeek: Math.round(lastWeekHours * 10) / 10,
        avg: Math.round(avgHours * 10) / 10,
      }
    }).filter((emp: any) => emp !== null && (emp.thisWeek > 0 || emp.lastWeek > 0))
  }

  const weeklyData = getWeeklyData()
  const employeeHours = getEmployeeHours()

  const filteredEmployeeHours = Array.isArray(employeeHours)
    ? employeeHours.filter((emp: any) =>
        emp?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp?.department?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  // Calculate stats
  const avgHoursPerDay = weeklyData.length > 0
    ? (weeklyData.reduce((sum, day) => sum + day.hours, 0) / weeklyData.length).toFixed(1)
    : "0"

  const totalHoursThisWeek = Array.isArray(employeeHours)
    ? employeeHours.reduce((sum, emp) => sum + (emp?.thisWeek || 0), 0)
    : 0
  const overtimeHours = Array.isArray(employeeHours)
    ? employeeHours.reduce((sum, emp) => {
        if (!emp) return sum
        const thisWeek = emp?.thisWeek || 0
        const overtime = thisWeek > 40 ? thisWeek - 40 : 0
        return sum + overtime
      }, 0)
    : 0

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
            <h1 className="text-3xl font-bold text-foreground">Average Work Hours</h1>
            <p className="text-muted-foreground mt-1">Track employee work hours and productivity</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">

            <p className="text-sm text-muted-foreground">Avg Hours/Day</p>
            <p className="text-3xl font-bold text-foreground mt-2">{avgHoursPerDay}</p>
            <div className="flex items-center gap-1 mt-2 text-success">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">This week</span>
            </div>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">

            <p className="text-sm text-muted-foreground">Total Hours (Week)</p>
            <p className="text-3xl font-bold text-foreground mt-2">{Math.round(totalHoursThisWeek)}</p>
            <p className="text-sm text-muted-foreground mt-2">All employees</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">

            <p className="text-sm text-muted-foreground">Overtime Hours</p>
            <p className="text-3xl font-bold text-foreground mt-2">{Math.round(overtimeHours)}</p>
            <p className="text-sm text-muted-foreground mt-2">This week</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">

            <p className="text-sm text-muted-foreground">Productivity Rate</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {weeklyData.length > 0 && parseFloat(avgHoursPerDay) >= 8 ? "96%" : "N/A"}
            </p>
            <div className="flex items-center gap-1 mt-2 text-success">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Good</span>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Average Hours</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="hours" stroke="#2563eb" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Performers (This Week)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={employeeHours.slice(0, 5).sort((a, b) => (b?.thisWeek || 0) - (a?.thisWeek || 0))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="thisWeek" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Employee Work Hours</h3>
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
                <TableHead>This Week</TableHead>
                <TableHead>Last Week</TableHead>
                <TableHead>Daily Avg</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployeeHours.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No work hours data found
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployeeHours.filter((emp) => emp != null).map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell className="font-semibold">{emp.thisWeek} hrs</TableCell>
                    <TableCell>{emp.lastWeek} hrs</TableCell>
                    <TableCell>{emp.avg} hrs</TableCell>
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
