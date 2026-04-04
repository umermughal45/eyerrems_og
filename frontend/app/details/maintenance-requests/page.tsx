"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Wrench, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const maintenanceRequests = [
  {
    id: 1,
    title: "Leaky Kitchen Faucet",
    description: "Water dripping from kitchen faucet",
    status: "completed",
    priority: "medium",
    submittedDate: "2024-05-15",
    completedDate: "2024-05-20",
  },
  {
    id: 2,
    title: "AC Not Working",
    description: "Air conditioning unit not cooling properly",
    status: "in-progress",
    priority: "high",
    submittedDate: "2024-05-25",
    completedDate: null,
  },
  {
    id: 3,
    title: "Door Lock Repair",
    description: "Front door lock needs adjustment",
    status: "pending",
    priority: "low",
    submittedDate: "2024-05-28",
    completedDate: null,
  },
]

export default function MaintenanceRequestsPage() {
  const router = useRouter()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-success" />
      case "in-progress":
        return <Clock className="h-5 w-5 text-orange-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Maintenance Requests</h1>
            <p className="text-muted-foreground mt-1">Track all your maintenance requests</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Wrench className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Requests</p>
            <p className="text-2xl font-bold text-foreground mt-2">3</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-foreground mt-2">1</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-foreground mt-2">1</p>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">All Requests</h3>
          <div className="space-y-4">
            {maintenanceRequests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(request.status)}
                      <h4 className="font-semibold text-foreground">{request.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{request.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Submitted: {request.submittedDate}</span>
                      {request.completedDate && <span>Completed: {request.completedDate}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={request.priority === "high" ? "destructive" : "secondary"}>
                      {request.priority}
                    </Badge>
                    <Badge variant={request.status === "completed" ? "default" : "secondary"}>{request.status}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
