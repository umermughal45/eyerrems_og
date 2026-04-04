"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Home, Calendar, DollarSign, TrendingUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const rentHistory = [
  { month: "January 2024", amount: 2000, status: "paid", date: "2024-01-01", method: "Bank Transfer" },
  { month: "December 2023", amount: 2000, status: "paid", date: "2023-12-01", method: "Credit Card" },
  { month: "November 2023", amount: 2000, status: "paid", date: "2023-11-01", method: "Bank Transfer" },
  { month: "October 2023", amount: 2000, status: "paid", date: "2023-10-01", method: "Bank Transfer" },
]

export default function CurrentRentPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Current Rent Details</h1>
            <p className="text-muted-foreground mt-1">Your rental payment information and history</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Monthly Rent</p>
            <p className="text-3xl font-bold text-foreground mt-2">$2,000</p>
            <p className="text-sm text-muted-foreground mt-2">Fixed rate</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Next Due Date</p>
            <p className="text-3xl font-bold text-foreground mt-2">Feb 1</p>
            <p className="text-sm text-muted-foreground mt-2">5 days remaining</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Security Deposit</p>
            <p className="text-3xl font-bold text-foreground mt-2">$4,000</p>
            <p className="text-sm text-muted-foreground mt-2">2 months rent</p>
          </Card>
          <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
            <p className="text-sm text-muted-foreground">Payment Status</p>
            <p className="text-3xl font-bold text-success mt-2">Current</p>
            <div className="flex items-center gap-1 mt-2 text-success">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">All paid</span>
            </div>
          </Card>
        </div>

        <Card className="p-6 relative overflow-hidden bg-white dark:bg-[#0d212c] rounded-xl border-l-4 border-l-[#24344c] dark:border-l-[#0d212c] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)]">
          <h3 className="text-lg font-semibold mb-4">Rent Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <Home className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Base Rent</p>
                  <p className="text-sm text-muted-foreground">Unit A-101, Sunset Apartments</p>
                </div>
              </div>
              <p className="text-lg font-semibold">$1,800</p>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Parking Fee</p>
                  <p className="text-sm text-muted-foreground">1 covered parking spot</p>
                </div>
              </div>
              <p className="text-lg font-semibold">$150</p>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Maintenance Fee</p>
                  <p className="text-sm text-muted-foreground">Common area maintenance</p>
                </div>
              </div>
              <p className="text-lg font-semibold">$50</p>
            </div>
            <div className="flex items-center justify-between py-3 pt-4">
              <p className="text-lg font-bold">Total Monthly Rent</p>
              <p className="text-2xl font-bold text-primary">$2,000</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payment History</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentHistory.map((payment, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{payment.month}</TableCell>
                  <TableCell className="font-semibold">${payment.amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{payment.date}</span>
                    </div>
                  </TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell>
                    <Badge variant="default">Paid</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
