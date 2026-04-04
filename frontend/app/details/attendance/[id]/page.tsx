"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Clock, MapPin, User, Loader2 } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { apiService } from "@/lib/api"

export default function AttendanceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [record, setRecord] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAttendanceRecord = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await apiService.attendance.getById(id)
        
        // Handle response structure
        const responseData = response.data as any
        const attendanceData = responseData?.data || responseData
        
        if (!attendanceData) {
          setError("Attendance record not found")
          return
        }

        // Format the data for display
        const formattedRecord = {
          id: attendanceData.id,
          employee: attendanceData.employee?.name || "-",
          tid: attendanceData.employee?.tid || null,
          department: attendanceData.employee?.department || "-",
          date: attendanceData.date,
          checkIn: attendanceData.checkIn 
            ? new Date(attendanceData.checkIn).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })
            : "-",
          checkOut: attendanceData.checkOut 
            ? new Date(attendanceData.checkOut).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })
            : "-",
          hours: attendanceData.hours 
            ? attendanceData.hours.toFixed(2)
            : "-",
          status: attendanceData.status || "-",
          location: "Main Office", // Default location as schema doesn't have location field
        }

        setRecord(formattedRecord)
      } catch (err: any) {
        console.error("Failed to fetch attendance record:", err)
        setError(err.response?.data?.message || "Failed to fetch attendance record")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
    fetchAttendanceRecord()
    }
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Card className="p-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Card className="p-6 text-center">
            <p className="text-destructive">{error || "Attendance record not found"}</p>
          </Card>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-success/10 text-success"
      case "absent":
        return "bg-destructive/10 text-destructive"
      case "late":
        return "bg-warning/10 text-warning"
      case "leave":
        return "bg-primary/10 text-primary"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Attendance Details</h1>
            <p className="text-muted-foreground mt-1">View detailed attendance record</p>
          </div>
        </div>

        <Card className="p-6 space-y-6 stat-card">
          {/* Employee Info */}
          <div className="border-b border-border pb-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{record.employee}</h2>
                  <div className="flex items-center gap-2">
                    <p className="text-muted-foreground">{record.department}</p>
                    {record.tid && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <p className="text-muted-foreground font-mono text-xs">TID: {record.tid}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Badge className={getStatusColor(record.status)}>
                {record.status && record.status !== "-" ? record.status.toUpperCase() : "UNKNOWN"}
              </Badge>
            </div>
          </div>

          {/* Attendance Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Date</p>
              <p className="text-lg font-semibold text-foreground">
                {new Date(record.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Location</p>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">{record.location}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Check In</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">{record.checkIn}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Check Out</p>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-lg font-semibold text-foreground">{record.checkOut}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
              <p className="text-lg font-semibold text-foreground">{record.hours}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
