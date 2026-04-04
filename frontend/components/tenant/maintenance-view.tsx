"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Wrench, Calendar, AlertCircle, Loader2, Trash2, Edit } from "lucide-react"
import { apiService } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/hooks/use-toast"

interface MaintenanceRequest {
  id: string
  title: string
  category: string
  description: string
  priority: "low" | "medium" | "high"
  status: "pending" | "in-progress" | "completed"
  submittedDate: string
  assignedTo?: string
  completedDate?: string
  messageId?: string
}

export function MaintenanceView({ tenantData, onUpdateCount }: { tenantData: any; onUpdateCount?: (count: number, desc: string) => void }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([])
  const [summary, setSummary] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
  })

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
  })

  useEffect(() => {
    fetchMaintenanceRequests()
  }, [tenantData])

  const fetchMaintenanceRequests = async () => {
    try {
      setLoading(true)
      
      // Fetch all messages and filter for maintenance requests
      const res = await apiService.chat.getMessages()
      const allMessages = Array.isArray((res as any)?.data?.data)
        ? (res as any).data.data
        : Array.isArray((res as any)?.data)
          ? (res as any).data
          : []
      
      // Parse messages to extract maintenance requests
      // Format: [MAINTENANCE] title|category|priority|description
      const requests: MaintenanceRequest[] = []
      
      allMessages.forEach((msg: any) => {
        const content = msg.content || ""
        if (content.startsWith("[MAINTENANCE]")) {
          try {
            const parts = content.replace("[MAINTENANCE]", "").split("|")
            if (parts.length >= 4) {
              const request: MaintenanceRequest = {
                id: msg.id,
                messageId: msg.id,
                title: parts[0]?.trim() || "Untitled",
                category: parts[1]?.trim() || "General",
                priority: (parts[2]?.trim() as "low" | "medium" | "high") || "medium",
                description: parts[3]?.trim() || "",
                status: content.includes("[COMPLETED]") ? "completed" : 
                        content.includes("[IN-PROGRESS]") ? "in-progress" : "pending",
                submittedDate: msg.createdAt || new Date().toISOString(),
                assignedTo: content.includes("[ASSIGNED:") 
                  ? content.match(/\[ASSIGNED:(.*?)\]/)?.[1] 
                  : undefined,
                completedDate: content.includes("[COMPLETED:") 
                  ? content.match(/\[COMPLETED:(.*?)\]/)?.[1] 
                  : undefined,
              }
              requests.push(request)
            }
          } catch (error) {
            console.error("Error parsing maintenance request:", error)
          }
        }
      })
      
      // Sort by date (newest first)
      requests.sort((a, b) => new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime())
      
      setMaintenanceRequests(requests)
      
      const pending = requests.filter((r) => r.status === "pending").length
      const inProgress = requests.filter((r) => r.status === "in-progress").length
      const completed = requests.filter((r) => r.status === "completed").length
      
      setSummary({ pending, inProgress, completed })
      
      const total = requests.length
      const desc = total === 0 
        ? "No requests" 
        : `${pending} pending, ${completed} completed`
      
      if (onUpdateCount) {
        onUpdateCount(total, desc)
      }
    } catch (error) {
      console.error("Error fetching maintenance requests:", error)
      toast({
        title: "Error",
        description: "Failed to load maintenance requests.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a title for your request.",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.category.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select a category.",
        variant: "destructive",
      })
      return
    }
    
    if (!formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a description.",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)
      
      // Format message content for maintenance request
      const messageContent = `[MAINTENANCE]${formData.title}|${formData.category}|${formData.priority}|${formData.description}`
      
      if (editingRequest) {
        // Update existing request by sending a new message with update info
        const updateContent = `[MAINTENANCE-UPDATE]${editingRequest.messageId}|${formData.title}|${formData.category}|${formData.priority}|${formData.description}`
        await apiService.chat.sendMessage({ content: updateContent })
        
        toast({
          title: "Request Updated",
          description: "Your maintenance request has been updated.",
        })
      } else {
        // Create new request
        await apiService.chat.sendMessage({ content: messageContent })
        
        toast({
          title: "Request Submitted",
          description: "Your maintenance request has been submitted successfully.",
        })
      }
      
      // Reset form
      setFormData({
        title: "",
        category: "",
        description: "",
        priority: "medium",
      })
      setShowRequestForm(false)
      setEditingRequest(null)
      
      // Refresh requests
      await fetchMaintenanceRequests()
    } catch (error: any) {
      console.error("Error submitting maintenance request:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRequest = async (request: MaintenanceRequest) => {
    if (!confirm("Are you sure you want to delete this maintenance request?")) {
      return
    }

    try {
      if (request.messageId) {
        // Delete the message
        await apiService.chat.deleteMessage(request.messageId)
        
        toast({
          title: "Request Deleted",
          description: "Your maintenance request has been deleted.",
        })
        
        // Refresh requests
        await fetchMaintenanceRequests()
      }
    } catch (error: any) {
      console.error("Error deleting maintenance request:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to delete request. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditRequest = (request: MaintenanceRequest) => {
    setEditingRequest(request)
    setFormData({
      title: request.title,
      category: request.category,
      description: request.description,
      priority: request.priority,
    })
    setShowRequestForm(true)
  }

  const handleCancelForm = () => {
    setShowRequestForm(false)
    setEditingRequest(null)
    setFormData({
      title: "",
      category: "",
      description: "",
      priority: "medium",
    })
  }

  return (
    <div className="space-y-6">
      {/* Submit Request Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Maintenance Requests</h2>
          <p className="text-sm text-muted-foreground mt-1">Submit and track your maintenance requests</p>
        </div>
        <Button onClick={() => setShowRequestForm(!showRequestForm)} disabled={submitting}>
          <Plus className="h-4 w-4 mr-2" />
          {editingRequest ? "Update Request" : "New Request"}
        </Button>
      </div>

      {/* New Request Form */}
      {showRequestForm && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {editingRequest ? "Update Maintenance Request" : "Submit Maintenance Request"}
          </h3>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Issue Title *</Label>
              <Input 
                id="title" 
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Plumbing">Plumbing</SelectItem>
                    <SelectItem value="Electrical">Electrical</SelectItem>
                    <SelectItem value="HVAC">HVAC</SelectItem>
                    <SelectItem value="Appliances">Appliances</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Pest Control">Pest Control</SelectItem>
                    <SelectItem value="Cleaning">Cleaning</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: "low" | "medium" | "high") => setFormData({ ...formData, priority: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Detailed Description *</Label>
              <Textarea 
                id="description" 
                placeholder="Provide detailed information about the issue"
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingRequest ? "Updating..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <Wrench className="h-4 w-4 mr-2" />
                    {editingRequest ? "Update Request" : "Submit Request"}
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelForm} disabled={submitting}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Request Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl font-bold text-foreground">{summary.pending}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Wrench className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-xl font-bold text-foreground">{summary.inProgress}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Wrench className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-xl font-bold text-foreground">{summary.completed}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Requests List */}
          {maintenanceRequests.length === 0 ? (
            <Card className="p-6">
              <p className="text-muted-foreground text-center">No maintenance requests found. Click "New Request" to create one.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {maintenanceRequests.map((request) => (
                <Card key={request.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground text-lg">{request.title}</h3>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary">{request.category}</Badge>
                        <Badge
                          variant={
                            request.status === "completed"
                              ? "default"
                              : request.status === "in-progress"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {request.status}
                        </Badge>
                        <Badge
                          variant={
                            request.priority === "high"
                              ? "destructive"
                              : request.priority === "medium"
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {request.priority} priority
                        </Badge>
                      </div>
                    </div>
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditRequest(request)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRequest(request)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{request.description}</p>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm pt-4 border-t border-border">
                    <div>
                      <p className="text-muted-foreground">Submitted</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        <span className="text-foreground">
                          {new Date(request.submittedDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {request.assignedTo && (
                      <div>
                        <p className="text-muted-foreground">Assigned To</p>
                        <p className="font-medium text-foreground mt-1">{request.assignedTo}</p>
                      </div>
                    )}
                    {request.completedDate && (
                      <div>
                        <p className="text-muted-foreground">Completed</p>
                        <p className="font-medium text-foreground mt-1">
                          {new Date(request.completedDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
