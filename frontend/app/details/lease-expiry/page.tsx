"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FileText, Calendar, AlertCircle, CheckCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default function LeaseExpiryPage() {
  const router = useRouter()

  const leaseInfo = {
    startDate: "2022-01-01",
    endDate: "2024-12-31",
    totalDuration: 36,
    remainingMonths: 7,
    renewalOption: true,
    autoRenewal: false,
  }

  const progressPercentage = ((leaseInfo.totalDuration - leaseInfo.remainingMonths) / leaseInfo.totalDuration) * 100

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Lease Expiry Details</h1>
            <p className="text-muted-foreground mt-1">View your lease agreement information</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Lease Expiry Date</p>
            <p className="text-2xl font-bold text-foreground mt-2">Dec 31, 2024</p>
            <p className="text-sm text-orange-500 mt-1">7 months remaining</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Lease Duration</p>
            <p className="text-2xl font-bold text-foreground mt-2">36 Months</p>
            <p className="text-sm text-muted-foreground mt-1">3 years</p>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Lease Progress</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Lease Completion</span>
                <span className="text-sm text-muted-foreground">{progressPercentage.toFixed(0)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Start Date</p>
                <p className="font-semibold text-foreground">{leaseInfo.startDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">End Date</p>
                <p className="font-semibold text-foreground">{leaseInfo.endDate}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Lease Options</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="font-medium">Renewal Option Available</span>
              </div>
              <Badge variant="default">Yes</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Auto-Renewal</span>
              </div>
              <Badge variant="secondary">No</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-4">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">Renewal Notice</h4>
              <p className="text-sm text-blue-800 mt-1">
                Your lease will expire in 7 months. If you wish to renew, please contact your landlord at least 60 days
                before the expiry date.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
