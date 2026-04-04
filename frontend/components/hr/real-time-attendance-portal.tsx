"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Clock, CheckCircle, XCircle, Coffee, CalendarIcon, Search } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiService } from "@/lib/api"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function RealTimeAttendancePortal() {
  const { toast } = useToast()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<string>("present")

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      setError(null)
      const employeesResponse = await apiService.employees.getAll()
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const employeesResponseData = employeesResponse?.data as any
      const employeesData = Array.isArray(employeesResponseData?.data) 
        ? employeesResponseData.data 
        : Array.isArray(employeesResponseData)
        ? employeesResponseData
        : []
      
      // Get today's attendance
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]
      const attendanceResponse = await apiService.attendance.getAll()
      
      // Backend returns { success: true, data: [...] }
      const attendanceResponseData = attendanceResponse?.data as any
      const attendanceData = Array.isArray(attendanceResponseData?.data) 
        ? attendanceResponseData.data 
        : Array.isArray(attendanceResponseData)
        ? attendanceResponseData
        : []
      
      const todayAttendance = attendanceData.filter((att: any) => {
        if (!att || !att.date) return false
        const attDate = new Date(att.date)
        attDate.setHours(0, 0, 0, 0)
        const attDateStr = attDate.toISOString().split('T')[0]
        return attDateStr === todayStr
      })

      // Map employees with their attendance status
      // Note: attendance.employeeId is the employee's database UUID (emp.id), not emp.employeeId
      const employeesWithStatus = employeesData.map((emp: any) => {
        if (!emp) return null
        // Find attendance by matching the employee's database ID
        // The backend returns employeeId which is the employee's database UUID
        const attendance = todayAttendance.find((att: any) => {
          if (!att) return false
          // Check if attendance has employee info or if we need to match by employee ID
          return att.employeeId === emp.id || att.employee?.id === emp.id
        })
        return {
          ...emp,
          status: attendance?.status || null,
          checkIn: attendance?.checkIn || null,
        }
      }).filter((emp: any) => emp !== null)

      setEmployees(employeesWithStatus)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch employees")
      setEmployees([])
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAttendance = async () => {
    if (!selectedEmployee) return

    try {
      const today = new Date().toISOString().split('T')[0]
      await apiService.attendance.create({
        employeeId: selectedEmployee,
        date: today,
        status: attendanceStatus,
      })

      toast({
        title: "Success",
        description: `Attendance marked as ${attendanceStatus} successfully`,
        variant: "success",
      })

      // Refresh employees list
      await fetchEmployees()
      setSelectedEmployee(null)
      setAttendanceStatus("present")
    } catch (err: any) {
      console.error("Failed to mark attendance:", err)
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to mark attendance"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const filteredEmployees = Array.isArray(employees)
    ? employees.filter(
        (emp) =>
          emp?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          emp?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : []

  const stats = {
    total: Array.isArray(employees) ? employees.length : 0,
    present: Array.isArray(employees) ? employees.filter((e) => e?.status === "present").length : 0,
    absent: Array.isArray(employees) ? employees.filter((e) => e?.status === "absent").length : 0,
    leave: Array.isArray(employees) ? employees.filter((e) => e?.status === "leave").length : 0,
    pending: Array.isArray(employees) ? employees.filter((e) => e?.status === null || e?.status === undefined).length : 0,
  }

  return (
    <div className="space-y-6">
      {/* Real-time Clock */}
      <Card className="p-6 bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Real-Time Attendance Portal</h2>
            <p className="text-muted-foreground mt-1">Mark employee attendance for today</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-3xl font-bold text-primary">
              <Clock className="h-8 w-8" />
              {currentTime.toLocaleTimeString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{currentTime.toLocaleDateString()}</p>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Employees</p>
          <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4 border-success">
          <p className="text-sm text-muted-foreground">Present</p>
          <p className="text-2xl font-bold text-success mt-1">{stats.present}</p>
        </Card>
        <Card className="p-4 border-destructive">
          <p className="text-sm text-muted-foreground">Absent</p>
          <p className="text-2xl font-bold text-destructive mt-1">{stats.absent}</p>
        </Card>
        <Card className="p-4 border-orange-500">
          <p className="text-sm text-muted-foreground">On Leave</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{stats.leave}</p>
        </Card>
        <Card className="p-4 border-muted">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-muted-foreground mt-1">{stats.pending}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mark Attendance Form */}
        <Card className="p-6 lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4">Mark Attendance</h3>
          <div className="space-y-4">
            <div>
              <Label>Select Employee</Label>
              <select
                className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2"
                value={selectedEmployee || ""}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="">Choose employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Attendance Status</Label>
              <RadioGroup value={attendanceStatus} onValueChange={setAttendanceStatus} className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="present" id="present" />
                  <Label htmlFor="present" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      Present
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="absent" id="absent" />
                  <Label htmlFor="absent" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Absent
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="leave" id="leave" />
                  <Label htmlFor="leave" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-orange-500" />
                      On Leave
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="half-day" id="half-day" />
                  <Label htmlFor="half-day" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-4 w-4 text-blue-500" />
                      Half Day
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={handleMarkAttendance} disabled={!selectedEmployee} className="w-full">
              Mark Attendance
            </Button>
          </div>
        </Card>

        {/* Employee List */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Today's Attendance</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.id}</TableCell>
                    <TableCell>{emp.name}</TableCell>
                    <TableCell>{emp.department}</TableCell>
                    <TableCell>
                      {emp.status ? (
                        <Badge
                          variant={
                            emp.status === "present" ? "default" : emp.status === "absent" ? "destructive" : "secondary"
                          }
                        >
                          {emp.status === "present" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {emp.status === "absent" && <XCircle className="h-3 w-3 mr-1" />}
                          {emp.status === "leave" && <CalendarIcon className="h-3 w-3 mr-1" />}
                          {emp.status === "half-day" && <Coffee className="h-3 w-3 mr-1" />}
                          {emp.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {emp.checkIn ? new Date(emp.checkIn).toLocaleTimeString() : (emp.status ? "Manual Entry" : "-")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
