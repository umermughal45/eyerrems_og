"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, CheckCircle, XCircle, CalendarIcon, Loader2, Users, UserCheck, UserX, AlertCircle, Briefcase, Lock } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { EarlyCheckoutWarningDialog } from "./early-checkout-warning-dialog"

interface Employee {
  id: string
  name: string
  employeeId: string
  department: string
  position: string
}

interface AttendanceRecord {
  id: string
  employee: string
  employeeId: string
  tid: string | null
  department: string | null
  date: string
  checkIn: string | null
  checkOut: string | null
  hours: number
  status: string
  totalWorkDuration?: string
}

interface AttendanceStats {
  present: number
  late: number
  absent: number
  onLeave: number
}

export function AttendancePortalView() {
  const { toast } = useToast()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Data State
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [stats, setStats] = useState<AttendanceStats>({ present: 0, late: 0, absent: 0, onLeave: 0 })
  
  const [elapsedTime, setElapsedTime] = useState<string>("00:00:00")
  const [showEarlyCheckoutDialog, setShowEarlyCheckoutDialog] = useState(false)
  const [earlyCheckoutData, setEarlyCheckoutData] = useState<{
    workedHours: number
    minimumHours: number
    earlyCheckoutMinutes: number
    checkInTime: string
  } | null>(null)

  // Initial Fetch
  useEffect(() => {
    fetchEmployees()
    fetchStats()
    fetchAttendanceRecords()
  }, [])

  // Fetch today's attendance when employee is selected
  useEffect(() => {
    if (selectedEmployeeId) {
      fetchTodayAttendance(selectedEmployeeId)
    } else {
      setTodayAttendance(null)
      setElapsedTime("00:00:00")
    }
  }, [selectedEmployeeId])

  // Timer Logic - Only run when state is CHECKED_IN (authoritative state from backend)
  useEffect(() => {
    // Use authoritative state to determine if timer should run
    const state = todayAttendance?._state
    const isCheckedIn = state === 'CHECKED_IN'
    
    // Only run timer if state is CHECKED_IN (not just if checkIn exists)
    if (!isCheckedIn || !todayAttendance?.checkIn || todayAttendance?.checkOut) {
      if (!isCheckedIn) setElapsedTime("00:00:00")
      return
    }

    const updateElapsedTime = () => {
      try {
        const checkInTime = new Date(todayAttendance.checkIn).getTime()
        const now = Date.now()
        const elapsed = now - checkInTime
        
        if (elapsed < 0) {
          setElapsedTime("00:00:00")
          return
        }
        
        const hours = Math.floor(elapsed / (1000 * 60 * 60))
        const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)
        
        setElapsedTime(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        )
      } catch (error) {
        console.error('Error calculating elapsed time:', error)
      }
    }

    updateElapsedTime()
    const interval = setInterval(updateElapsedTime, 1000)
    return () => clearInterval(interval)
  }, [todayAttendance])

  const fetchEmployees = async () => {
    try {
      const response = await apiService.employees.getAll({ limit: 1000 })
      if ((response.data as any).success) {
        setEmployees((response.data as any).data || [])
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiService.attendance.getStats()
      if ((response.data as any).success) {
        setStats((response.data as any).data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true)
      // Fetch all records for today by default, or simple list
      const response = await apiService.attendance.getAll({ date: new Date().toISOString() })
      if ((response.data as any).success) {
        setAttendanceRecords((response.data as any).data || [])
      }
    } catch (error) {
      console.error('Failed to fetch attendance records:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTodayAttendance = async (employeeId: string) => {
    try {
      const response = await apiService.attendance.getToday(employeeId)
      const responseData = response?.data as any
      
      if (responseData?.success) {
        const data = responseData.data
        const state = responseData.state // AUTHORITATIVE STATE: Derived from timestamps by backend
        
        // CRITICAL: Always use backend-computed state, never derive state in frontend
        // If state is missing, fallback to NOT_STARTED (but this should never happen)
        const authoritativeState = state || (!data ? 'NOT_STARTED' : null)
        
        // Store both data and state - state is the single source of truth
        setTodayAttendance(data ? { ...data, _state: authoritativeState } : null)
      } else {
        // If API call succeeded but no data, set to null (NOT_STARTED)
        setTodayAttendance(null)
      }
    } catch (error) {
      console.error('Failed to fetch today attendance:', error)
      // On error, set to null to show NOT_STARTED state
      setTodayAttendance(null)
    }
  }

  const handleCheckIn = async () => {
    if (!selectedEmployeeId) return

    try {
      setActionLoading(true)
      const response = await apiService.attendance.checkIn({ employeeId: selectedEmployeeId })
      const responseData = response?.data as any
      
      // IMMEDIATE STATE UPDATE: Use authoritative state from backend response
      // This ensures UI updates instantly without waiting for refresh
      if (responseData?.success && responseData?.data && responseData?.state) {
        // Update todayAttendance immediately with new state from backend
        setTodayAttendance({
          ...responseData.data,
          _state: responseData.state, // Authoritative state from backend
        })
      }
      
      toast({
        title: "Success",
        description: "Checked in successfully",
      })

      // Refresh all data to ensure consistency
      await Promise.all([
        fetchTodayAttendance(selectedEmployeeId), // Re-fetch to ensure latest state
        fetchStats(),
        fetchAttendanceRecords(),
      ])
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Failed to check in"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      // On error, refresh to get accurate state
      await fetchTodayAttendance(selectedEmployeeId)
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async (earlyCheckoutReason?: string) => {
    if (!selectedEmployeeId) return

    try {
      setActionLoading(true)
      
      // Call checkout API with early checkout reason if provided
      const response = await apiService.attendance.checkOut({ 
        employeeId: selectedEmployeeId,
        earlyCheckoutReason,
        forceEarlyCheckout: !!earlyCheckoutReason,
      })
      
      // Check if response indicates early checkout warning
      const responseData = response?.data as any
      if (responseData?.warning && responseData?.isEarlyCheckout && !earlyCheckoutReason) {
        // Show early checkout warning dialog
        setEarlyCheckoutData({
          workedHours: parseFloat(responseData.workedHours),
          minimumHours: responseData.minimumHours,
          earlyCheckoutMinutes: responseData.earlyCheckoutMinutes,
          checkInTime: todayAttendance?.checkIn || new Date().toISOString(),
        })
        setShowEarlyCheckoutDialog(true)
        setActionLoading(false)
        return
      }
      
      // IMMEDIATE STATE UPDATE: Use authoritative state from backend response
      // This ensures UI updates instantly without waiting for refresh
      if (responseData?.success && responseData?.data && responseData?.state) {
        // Update todayAttendance immediately with new state from backend
        setTodayAttendance({
          ...responseData.data,
          _state: responseData.state, // Authoritative state from backend
        })
      }
      
      toast({
        title: "Success",
        description: responseData?.isEarlyCheckout 
          ? "Checked out successfully (Early checkout recorded)" 
          : "Checked out successfully",
      })

      // Refresh all data to ensure consistency
      await Promise.all([
        fetchTodayAttendance(selectedEmployeeId), // Re-fetch to ensure latest state
        fetchStats(),
        fetchAttendanceRecords(),
      ])
      
      // Close dialog if open
      setShowEarlyCheckoutDialog(false)
      setEarlyCheckoutData(null)
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Failed to check out"
      
      // Check if it requires reason
      if (err.response?.data?.requiresReason) {
        setEarlyCheckoutData({
          workedHours: parseFloat(err.response?.data?.workedHours || "0"),
          minimumHours: err.response?.data?.minimumHours || 8,
          earlyCheckoutMinutes: err.response?.data?.earlyCheckoutMinutes || 0,
          checkInTime: todayAttendance?.checkIn || new Date().toISOString(),
        })
        setShowEarlyCheckoutDialog(true)
        setActionLoading(false)
        return
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEarlyCheckoutConfirm = async (reason: string) => {
    await handleCheckOut(reason)
  }

  const handleEarlyCheckoutCancel = () => {
    setShowEarlyCheckoutDialog(false)
    setEarlyCheckoutData(null)
    setActionLoading(false)
  }

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-"
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">HR Attendance Portal</h1>
        <p className="text-muted-foreground mt-1">Manage employee check-ins and attendance records.</p>
      </div>

      {/* Dashboard Counters */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.present}</div>
            <p className="text-xs text-muted-foreground">Employees checked in</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.late}</div>
            <p className="text-xs text-muted-foreground">Checked in after 9:00 AM</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Leave</CardTitle>
            <Briefcase className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.onLeave}</div>
            <p className="text-xs text-muted-foreground">Approved leaves</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <UserX className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.absent}</div>
            <p className="text-xs text-muted-foreground">Not checked in</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* Main Action Area */}
        <Card className="md:col-span-8">
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="w-full md:w-1/2 space-y-2">
                <label className="text-sm font-medium">Select Employee</label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} ({emp.employeeId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full md:w-1/2 flex items-center justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p className="text-2xl font-bold font-mono">{new Date().toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            {selectedEmployeeId ? (
              <div className="mt-8 border rounded-lg p-6 bg-muted/30">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  {(() => {
                    // AUTHORITATIVE STATE: Use backend-computed state from timestamps
                    // This is the SINGLE SOURCE OF TRUTH - never compute state in frontend
                    let state = todayAttendance?._state
                    
                    // DEFENSIVE: If state is somehow null/undefined but attendance exists, 
                    // compute fallback state from timestamps (should never happen, but safety net)
                    if (todayAttendance && !state) {
                      console.warn('⚠️ ATTENDANCE_STATE_WARNING: Attendance data exists but state is missing. Computing fallback state from timestamps.', {
                        attendanceId: todayAttendance.id,
                        checkIn: todayAttendance.checkIn,
                        checkOut: todayAttendance.checkOut,
                        status: todayAttendance.status,
                      })
                      // Fallback: Compute state from timestamps if backend didn't provide it
                      if (todayAttendance.checkIn && todayAttendance.checkOut) {
                        state = 'CHECKED_OUT'
                      } else if (todayAttendance.checkIn && !todayAttendance.checkOut) {
                        state = 'CHECKED_IN'
                      } else {
                        state = 'NOT_STARTED'
                      }
                    }
                    
                    // If no attendance record, state is NOT_STARTED
                    if (!todayAttendance) {
                      state = 'NOT_STARTED'
                    }
                    
                    // Handle LOCKED state (manual override)
                    if (state === 'LOCKED' || (todayAttendance && todayAttendance.isManualOverride)) {
                      return (
                    <>
                          <div className="h-16 w-16 bg-orange-500/10 rounded-full flex items-center justify-center">
                            <Lock className="h-8 w-8 text-orange-600" />
                      </div>
                      <div>
                            <h3 className="text-lg font-semibold">Attendance Locked</h3>
                            <p className="text-sm text-muted-foreground">This attendance record has been manually locked and cannot be modified.</p>
                      </div>
                          <Button size="lg" variant="outline" className="w-48" disabled>
                            Locked
                      </Button>
                    </>
                      )
                    }
                    
                    // Handle leave status (from status field, but only if state allows)
                    if (state !== 'CHECKED_IN' && state !== 'CHECKED_OUT' && (todayAttendance?.status === 'On Leave' || todayAttendance?.status === 'Leave')) {
                      return (
                    <>
                      <div className="h-16 w-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <Briefcase className="h-8 w-8 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">On Leave</h3>
                        <p className="text-sm text-muted-foreground">Employee is on marked leave for today.</p>
                      </div>
                      <Button size="lg" variant="outline" className="w-48" disabled>
                        On Leave
                      </Button>
                    </>
                      )
                    }
                    
                    // STATE-DRIVEN LOGIC: Use authoritative state from backend
                    if (state === 'NOT_STARTED' || !todayAttendance) {
                      return (
                        <>
                          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Clock className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold">
                              {todayAttendance?.status === 'Absent' ? 'Marked Absent' : 'Not Checked In'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {todayAttendance?.status === 'Absent' 
                                ? 'Employee was marked absent. Check in to update status.' 
                                : 'No attendance record for today.'}
                            </p>
                          </div>
                          <Button size="lg" className="w-48" onClick={handleCheckIn} disabled={actionLoading}>
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Check In
                          </Button>
                        </>
                      )
                    }
                    
                    // CHECKED_IN: Only checkIn exists (authoritative state from backend)
                    if (state === 'CHECKED_IN') {
                      return (
                    <>
                      <div className="h-16 w-16 bg-yellow-500/10 rounded-full flex items-center justify-center animate-pulse">
                        <Clock className="h-8 w-8 text-yellow-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Currently Working</h3>
                            <p className="text-sm text-muted-foreground">
                              Checked in at {todayAttendance.checkIn ? formatTime(todayAttendance.checkIn) : 'N/A'}
                            </p>
                        <p className="text-2xl font-bold font-mono text-primary mt-2">{elapsedTime}</p>
                      </div>
                          <Button size="lg" variant="destructive" className="w-48" onClick={() => handleCheckOut()} disabled={actionLoading}>
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                        Check Out
                      </Button>
                    </>
                      )
                    }
                    
                    // CHECKED_OUT: Both checkIn and checkOut exist (authoritative state from backend)
                    if (state === 'CHECKED_OUT') {
                      return (
                    <>
                      <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Attendance Completed</h3>
                        <p className="text-sm text-muted-foreground">
                              Shift: {todayAttendance.checkIn ? formatTime(todayAttendance.checkIn) : 'N/A'} - {todayAttendance.checkOut ? formatTime(todayAttendance.checkOut) : 'N/A'}
                        </p>
                            <p className="font-medium mt-1">Total Hours: {todayAttendance.totalWorkDuration || (todayAttendance.hours ? todayAttendance.hours.toFixed(2) + ' hrs' : 'N/A')}</p>
                      </div>
                      <Button size="lg" variant="outline" className="w-48" disabled>
                        Completed
                      </Button>
                    </>
                      )
                    }
                    
                    // Fallback (should not happen if state is properly set)
                    return null
                  })()}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-20" />
                <p>Please select an employee to mark attendance.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Side Panel */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Today's Attendance Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : attendanceRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No attendance records found for today.
                  </TableCell>
                </TableRow>
              ) : (
                attendanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.employee}</TableCell>
                    <TableCell>{record.tid || "-"}</TableCell>
                    <TableCell>{record.department || "-"}</TableCell>
                    <TableCell>{formatDate(record.date)}</TableCell>
                    <TableCell>{formatTime(record.checkIn)}</TableCell>
                    <TableCell>{formatTime(record.checkOut)}</TableCell>
                    <TableCell>{record.totalWorkDuration || (record.hours ? record.hours.toFixed(2) + " hrs" : "-")}</TableCell>
                    <TableCell>
                      <Badge variant={
                        record.status?.toLowerCase() === 'present' ? 'default' :
                        record.status?.toLowerCase() === 'late' ? 'secondary' : // 'secondary' is usually yellowish/gray in shadcn, might need custom style
                        record.status?.toLowerCase() === 'absent' ? 'destructive' :
                        'outline'
                      } className={
                        record.status?.toLowerCase() === 'late' ? "bg-yellow-500 hover:bg-yellow-600" : ""
                      }>
                        {record.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Early Checkout Warning Dialog */}
      {earlyCheckoutData && (
        <EarlyCheckoutWarningDialog
          open={showEarlyCheckoutDialog}
          onOpenChange={setShowEarlyCheckoutDialog}
          onConfirm={handleEarlyCheckoutConfirm}
          onCancel={handleEarlyCheckoutCancel}
          workedHours={earlyCheckoutData.workedHours}
          minimumHours={earlyCheckoutData.minimumHours}
          earlyCheckoutMinutes={earlyCheckoutData.earlyCheckoutMinutes}
          checkInTime={earlyCheckoutData.checkInTime}
          loading={actionLoading}
        />
      )}
    </div>
  )
}
