"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DollarSign, Calendar, CreditCard, FileText, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface DealTimelineProps {
  deal: any
  onRefresh?: () => void
}

export function DealTimeline({ deal, onRefresh }: DealTimelineProps) {
  const timelineItems = useMemo(() => {
    const items: Array<{
      id: string
      type: "payment" | "installment" | "milestone"
      date: Date
      title: string
      description: string
      amount?: number
      mode?: string
      status?: string
    }> = []

    // Add payment plan milestones (installments)
    if (deal.paymentPlan?.installments) {
      deal.paymentPlan.installments.forEach((inst: any) => {
        items.push({
          id: inst.id,
          type: "installment",
          date: new Date(inst.dueDate),
          title: `Installment #${inst.installmentNumber}`,
          description: `Due: ${format(new Date(inst.dueDate), "PPP")} • ${inst.paymentMode || "N/A"}`,
          amount: inst.amount,
          mode: inst.paymentMode,
          status: inst.status,
        })
      })
    }

    // Add payments
    if (deal.payments) {
      deal.payments.forEach((payment: any) => {
        items.push({
          id: payment.id,
          type: "payment",
          date: new Date(payment.date),
          title: `Payment Received`,
          description: `Payment ID: ${payment.paymentId || payment.id.slice(0, 8)} • ${payment.paymentMode || "N/A"}`,
          amount: payment.amount,
          mode: payment.paymentMode,
        })
      })
    }

    // Sort by date (newest first)
    return items.sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [deal])

  const formatCurrency = (amount: number) => {
    return `Rs ${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      paid: "default",
      unpaid: "secondary",
      overdue: "destructive",
      partial: "outline",
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  if (timelineItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No payment history available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {timelineItems.map((item, index) => (
        <Card key={item.id} className="relative">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  item.type === "payment"
                    ? "bg-green-100 text-green-600"
                    : item.type === "installment"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.type === "payment" ? (
                  <DollarSign className="h-5 w-5" />
                ) : item.type === "installment" ? (
                  <CreditCard className="h-5 w-5" />
                ) : (
                  <Calendar className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="text-right">
                    {item.amount && <p className="font-bold">{formatCurrency(item.amount)}</p>}
                    {item.status && getStatusBadge(item.status)}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(item.date, "PPP 'at' p")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

