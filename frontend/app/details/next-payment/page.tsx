"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, DollarSign, AlertCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const upcomingPayments = [
  {
    id: 1,
    dueDate: "2024-06-01",
    amount: 2000,
    status: "pending",
    description: "Monthly Rent - June 2024",
    daysRemaining: 5,
  },
  {
    id: 2,
    dueDate: "2024-07-01",
    amount: 2000,
    status: "pending",
    description: "Monthly Rent - July 2024",
    daysRemaining: 35,
  },
  {
    id: 3,
    dueDate: "2024-08-01",
    amount: 2000,
    status: "pending",
    description: "Monthly Rent - August 2024",
    daysRemaining: 66,
  },
]

export default function NextPaymentPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Next Payment Details</h1>
            <p className="text-muted-foreground mt-1">View your upcoming rent payments</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#3b82f6,#1d4ed8)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <Calendar className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Next Due Date</p>
            <p className="text-2xl font-bold text-foreground mt-2">Jun 1, 2024</p>
            <p className="text-sm text-orange-500 mt-1">5 days remaining</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#22c55e,#15803d)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Amount Due</p>
            <p className="text-2xl font-bold text-foreground mt-2">$2,000</p>
            <p className="text-sm text-muted-foreground mt-1">Monthly rent</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl px-0 bg-[linear-gradient(135deg,#ef4444,#b91c1c)] text-white shadow-lg transition-transform duration-300 hover:scale-110">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold text-foreground mt-2">$2,000</p>
            <p className="text-sm text-destructive mt-1">Action required</p>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Upcoming Payments Schedule</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Days Remaining</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">{payment.dueDate}</TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell className="font-semibold">${payment.amount.toLocaleString()}</TableCell>
                  <TableCell>{payment.daysRemaining} days</TableCell>
                  <TableCell>
                    <Badge variant={payment.status === "pending" ? "secondary" : "default"}>{payment.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-4">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900">Payment Reminder</h4>
              <p className="text-sm text-blue-800 mt-1">
                Please ensure payment is made by the due date to avoid late fees. You can pay online through your tenant
                portal.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
