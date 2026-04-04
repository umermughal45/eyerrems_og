"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Search, Calendar, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

export default function PendingLeavesPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchPendingLeaves()
  }, [])

  const fetchPendingLeaves = async () => {
    try {
      setLoading(true)
      const response = await apiService.leave.getAll()
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const responseData = response?.data as any
      const leaveData = Array.isArray(responseData?.data) 
        ? responseData.data 
        : Array.isArray(responseData)
        ? responseData
        : []
      
      // Filter for pending leaves
      const pending = leaveData.filter((leave: any) => leave?.status === "pending")
      setLeaveRequests(pending)
    } catch (err) {
      console.error("Failed to fetch leave requests:", err)
      setLeaveRequests([])
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (id: string) => {
    try {
      await apiService.leave.approve(id)
      toast({
        title: "Success",
        description: "Leave request approved successfully",
        variant: "success",
      })
      fetchPendingLeaves()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to approve leave"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const handleReject = async (id: string) => {
    try {
      await apiService.leave.reject(id)
      toast({
        title: "Success",
        description: "Leave request rejected successfully",
        variant: "success",
      })
      fetchPendingLeaves()
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to reject leave"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  const filteredLeaves = Array.isArray(leaveRequests)
    ? leaveRequests.filter((leave) =>
        leave?.employee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        leave?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        leave?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : []

  const totalDays = Array.isArray(leaveRequests)
    ? leaveRequests.reduce((sum, leave) => sum + (leave?.days || 0), 0)
    : 0
  
  // Calculate urgent leaves (within 3 days)
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const urgentLeaves = Array.isArray(leaveRequests)
    ? leaveRequests.filter((leave) => {
        if (!leave) return false
        const startDate = leave.startDate ? new Date(leave.startDate) : null
        return startDate && startDate <= threeDaysFromNow
      }).length
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
            <h1 className="text-3xl font-bold text-foreground">Pending Leave Requests</h1>
            <p className="text-muted-foreground mt-1">Review and approve employee leave requests</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Pending Requests</p>
            <p className="text-3xl font-bold text-foreground mt-2">{leaveRequests.length}</p>
            <p className="text-sm text-muted-foreground mt-2">Awaiting approval</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Total Days</p>
            <p className="text-3xl font-bold text-foreground mt-2">{totalDays}</p>
            <p className="text-sm text-muted-foreground mt-2">Requested days</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Urgent Requests</p>
            <p className="text-3xl font-bold text-foreground mt-2">{urgentLeaves}</p>
            <p className="text-sm text-muted-foreground mt-2">Within 3 days</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Avg Days per Request</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {leaveRequests.length > 0 ? (totalDays / leaveRequests.length).toFixed(1) : "0"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Days</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">All Pending Requests</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeaves.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No pending leave requests found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeaves.map((leave) => (
                  <TableRow key={leave.id}>
                    <TableCell className="font-medium">{leave.employee}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{leave.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{leave.startDate ? new Date(leave.startDate).toLocaleDateString() : "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {leave.endDate ? new Date(leave.endDate).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>{leave.days} days</TableCell>
                    <TableCell className="max-w-xs truncate">{leave.reason || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{leave.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(leave.id)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(leave.id)}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
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
