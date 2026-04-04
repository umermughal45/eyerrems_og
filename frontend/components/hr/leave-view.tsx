"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, CheckCircle2, XCircle, Clock, Loader2, Plus, FileText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { AddLeaveDialog } from "./add-leave-dialog"

export function LeaveView() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchLeaveRequests()
    fetchEmployees()
  }, [])
  
  const fetchEmployees = async () => {
    try {
      const response: any = await apiService.employees.getAll()
      const employeesData = response?.data?.data || response?.data || []
      setEmployees(Array.isArray(employeesData) ? employeesData : [])
    } catch {
      setEmployees([])
    }
  }

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiService.leave.getAll()
      
      // Backend returns { success: true, data: [...] }
      // Axios unwraps it, so response.data = { success: true, data: [...] }
      const responseData = response?.data as any
      const leaveData = Array.isArray(responseData?.data) 
        ? responseData.data 
        : Array.isArray(responseData)
        ? responseData
        : []
      setLeaveRequests(leaveData)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch leave requests")
      setLeaveRequests([])
    } finally {
      setLoading(false)
    }
  }

  const filteredLeaveRequests = Array.isArray(leaveRequests)
    ? leaveRequests.filter((request) => {
        const matchesSearch = 
          request?.employee?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          request?.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          request?.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          request?.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          false
        
        const matchesStatus = statusFilter === "all" || request?.status === statusFilter
        
        return matchesSearch && matchesStatus
      })
    : []

  // Calculate summary stats
  const totalRequests = Array.isArray(leaveRequests) ? leaveRequests.length : 0
  const pendingCount = Array.isArray(leaveRequests)
    ? leaveRequests.filter((r) => r?.status === "pending").length
    : 0
  const approvedCount = Array.isArray(leaveRequests)
    ? leaveRequests.filter((r) => r?.status === "approved").length
    : 0
  const rejectedCount = Array.isArray(leaveRequests)
    ? leaveRequests.filter((r) => r?.status === "rejected").length
    : 0

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by employee, department, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Leave Request
          </Button>
        </div>
      </div>

      {/* Leave Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/leave")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Requests</p>
              <p className="text-xl font-bold text-foreground">{totalRequests}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/leave?status=pending")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-xl font-bold text-foreground">{pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/leave?status=approved")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-xl font-bold text-foreground">{approvedCount}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-4 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
          onClick={() => router.push("/details/leave?status=rejected")}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rejected</p>
              <p className="text-xl font-bold text-foreground">{rejectedCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Leave Requests */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : filteredLeaveRequests.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground mb-2">
              {leaveRequests.length === 0 ? "No leave requests yet" : "No leave requests match your filters"}
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              {leaveRequests.length === 0 
                ? "Create leave requests for employees to track time off and manage approvals"
                : "Try adjusting your search or filter criteria"}
            </p>
            {leaveRequests.length === 0 && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Leave Request
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLeaveRequests.map((request) => (
          <Card
            key={request.id}
            className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01]"
            onClick={() => router.push(`/details/leave/${request.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-semibold text-foreground">{request.employee}</h3>
                  <Badge variant="secondary">{request.type}</Badge>
                  <Badge
                    variant={
                      request.status === "approved"
                        ? "default"
                        : request.status === "rejected"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {request.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Department</p>
                    <p className="font-medium text-foreground mt-1">{request.department}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium text-foreground mt-1">{request.days} days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium text-foreground mt-1">
                      {request.startDate ? new Date(request.startDate).toLocaleDateString() : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End Date</p>
                    <p className="font-medium text-foreground mt-1">
                      {request.endDate ? new Date(request.endDate).toLocaleDateString() : "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">Reason</p>
                  <p className="text-sm text-foreground mt-1">{request.reason}</p>
                </div>
              </div>

              {request.status === "pending" && (
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await apiService.leave.approve(request.id)
                        toast({
                          title: "Success",
                          description: "Leave request approved successfully",
                          variant: "success",
                        })
                        fetchLeaveRequests()
                      } catch (err: any) {
                        console.error("Failed to approve leave:", err)
                        const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to approve leave"
                        toast({
                          title: "Error",
                          description: errorMessage,
                          variant: "destructive",
                        })
                      }
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        await apiService.leave.reject(request.id)
                        toast({
                          title: "Success",
                          description: "Leave request rejected successfully",
                          variant: "success",
                        })
                        fetchLeaveRequests()
                      } catch (err: any) {
                        console.error("Failed to reject leave:", err)
                        const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to reject leave"
                        toast({
                          title: "Error",
                          description: errorMessage,
                          variant: "destructive",
                        })
                      }
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </Card>
          ))}
        </div>
      )}
      
      {/* Create Leave Dialog */}
      <AddLeaveDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          fetchLeaveRequests()
        }}
      />
    </div>
  )
}
