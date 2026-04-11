"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft, Hash, User, Building2, DollarSign,
  Calendar, CreditCard, Activity, CheckCircle2,
  Clock, AlertCircle, Copy, Check,
} from "lucide-react"
import { apiService } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface TransactionDetailViewProps {
  tid: string
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase()
  const variant =
    s === "paid" || s === "completed" || s === "won" || s === "closed-won" || s === "active"
      ? "default"
      : s === "pending" || s === "open" || s === "in_progress"
      ? "secondary"
      : s === "overdue" || s === "lost" || s === "cancelled"
      ? "destructive"
      : "outline"
  return <Badge variant={variant}>{status || "—"}</Badge>
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="grid grid-cols-[160px,1fr] gap-2 text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <Separator className="mb-4" />
      {children}
    </Card>
  )
}

export function TransactionDetailView({ tid }: TransactionDetailViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!tid) return
    fetchTransaction()
  }, [tid])

  const fetchTransaction = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await apiService.transactionsCrm.getByTID(tid)
      const result = (res.data as any)?.data || res.data
      setData(result)
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.response?.data?.error || "Transaction not found")
    } finally {
      setLoading(false)
    }
  }

  const copyTID = () => {
    navigator.clipboard.writeText(tid)
    setCopied(true)
    toast({ title: "TID copied to clipboard" })
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (d?: string | null) => {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <Card className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-lg font-semibold">Transaction Not Found</p>
          <p className="text-muted-foreground text-sm mt-1">{error || `No records found for TID: ${tid}`}</p>
          <Button className="mt-4" onClick={() => router.push("/crm")}>Go to CRM</Button>
        </Card>
      </div>
    )
  }

  const { client, lead, deals = [], properties = [], dealers = [], paymentPlans = [], installments = [], payments = [], activities = [] } = data
  const primaryDeal = deals[0]
  const primaryProperty = properties[0]
  const primaryPlan = paymentPlans[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold">{tid}</h1>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyTID}>
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Transaction Details</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {client && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/crm?clientId=${client.id}`)}>
              View in CRM
            </Button>
          )}
          {primaryDeal && (
            <Button variant="outline" size="sm" onClick={() => router.push(`/crm?dealId=${primaryDeal.id}`)}>
              View Deal
            </Button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "TID", value: tid, icon: Hash },
          { label: "Lead ID", value: lead?.leadCode || "—", icon: User },
          { label: "Client ID", value: client?.clientCode || "—", icon: User },
          { label: "Deal Amount", value: primaryDeal ? formatCurrency(primaryDeal.dealAmount) : "—", icon: DollarSign },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-semibold truncate font-mono">{value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Lead Details */}
        {lead && (
          <Section title="Lead Details" icon={User}>
            <InfoRow label="Lead ID" value={lead.leadCode} />
            <InfoRow label="Name" value={lead.name} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="CNIC" value={lead.cnic} />
            <InfoRow label="Source" value={lead.source} />
            <InfoRow label="Status" value={lead.status} />
            <InfoRow label="Priority" value={lead.priority} />
            <InfoRow label="Temperature" value={lead.temperature} />
            <InfoRow label="Conversion" value={lead.convertedToClientId ? "Converted to Client" : "Not yet converted"} />
            <InfoRow label="Created" value={formatDate(lead.createdAt)} />
          </Section>
        )}

        {/* Client Details */}
        {client && (
          <Section title="Client Details" icon={User}>
            <InfoRow label="Client ID" value={client.clientCode} />
            {client.convertedFromLeadId && (
              <InfoRow label="Origin" value="Converted from Lead" />
            )}
            <InfoRow label="Name" value={client.name} />
            <InfoRow label="Phone" value={client.phone} />
            <InfoRow label="Email" value={client.email} />
            <InfoRow label="CNIC" value={client.cnic} />
            <InfoRow label="Address" value={client.address} />
            <InfoRow label="City" value={client.city} />
            <InfoRow label="Status" value={client.status} />
            <InfoRow label="Created" value={formatDate(client.createdAt)} />
          </Section>
        )}

        {/* Deal Details */}
        {primaryDeal && (
          <Section title="Deal Details" icon={DollarSign}>
            <InfoRow label="Deal Code" value={primaryDeal.dealCode} />
            <InfoRow label="Title" value={primaryDeal.title} />
            <InfoRow label="Deal Type" value={primaryDeal.dealType} />
            <InfoRow label="Deal Amount" value={formatCurrency(primaryDeal.dealAmount)} />
            <InfoRow label="Total Paid" value={formatCurrency(primaryDeal.totalPaid)} />
            <InfoRow label="Remaining" value={formatCurrency(primaryDeal.dealAmount - primaryDeal.totalPaid)} />
            <InfoRow label="Stage" value={primaryDeal.stage} />
            <InfoRow label="Status" value={primaryDeal.status} />
            <InfoRow label="Deal Date" value={formatDate(primaryDeal.dealDate)} />
            <InfoRow label="Expected Close" value={formatDate(primaryDeal.expectedClosingDate)} />
            <InfoRow label="Commission Rate" value={primaryDeal.commissionRate ? `${primaryDeal.commissionRate}%` : undefined} />
            <InfoRow label="Notes" value={primaryDeal.notes} />
          </Section>
        )}

        {/* Property Details */}
        {primaryProperty && (
          <Section title="Property Details" icon={Building2}>
            <InfoRow label="Name" value={primaryProperty.name} />
            <InfoRow label="Type" value={primaryProperty.type} />
            <InfoRow label="Address" value={primaryProperty.address} />
            <InfoRow label="Status" value={primaryProperty.status} />
            <InfoRow label="Total Area" value={primaryProperty.totalArea ? `${primaryProperty.totalArea} sq ft` : undefined} />
            <InfoRow label="Sale Price" value={primaryProperty.salePrice ? formatCurrency(primaryProperty.salePrice) : undefined} />
          </Section>
        )}

        {/* Dealer / Agent Details */}
        {dealers.length > 0 && (
          <Section title="Dealer / Agent Details" icon={User}>
            {dealers.map((dealer: any) => (
              <div key={dealer.id} className="mb-3 last:mb-0">
                <InfoRow label="Name" value={dealer.name} />
                <InfoRow label="Phone" value={dealer.phone} />
                <InfoRow label="Email" value={dealer.email} />
                {dealer.commissionRate !== undefined && (
                  <InfoRow label="Commission Rate" value={`${dealer.commissionRate}%`} />
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Payment Plan */}
        {primaryPlan && (
          <Section title="Payment Plan" icon={Calendar}>
            <InfoRow label="Total Amount" value={formatCurrency(primaryPlan.totalAmount)} />
            <InfoRow label="Down Payment" value={primaryPlan.downPayment ? formatCurrency(primaryPlan.downPayment) : undefined} />
            <InfoRow label="Installments" value={primaryPlan.numberOfInstallments} />
            <InfoRow label="Total Paid" value={formatCurrency(primaryPlan.totalPaid)} />
            <InfoRow label="Remaining" value={formatCurrency(primaryPlan.remaining)} />
            <InfoRow label="Status" value={primaryPlan.status} />
            <InfoRow label="Start Date" value={formatDate(primaryPlan.startDate)} />
          </Section>
        )}
      </div>

      {/* Installments Table */}
      {installments.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Installment Schedule ({installments.length})</h3>
          </div>
          <Separator className="mb-4" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-left py-2 pr-4">Due Date</th>
                  <th className="text-right py-2 pr-4">Amount</th>
                  <th className="text-right py-2 pr-4">Paid</th>
                  <th className="text-right py-2 pr-4">Remaining</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {installments.map((inst: any) => (
                  <tr key={inst.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4">{inst.installmentNumber}</td>
                    <td className="py-2 pr-4">{formatDate(inst.dueDate)}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(inst.amount)}</td>
                    <td className="py-2 pr-4 text-right text-green-600">{formatCurrency(inst.paidAmount)}</td>
                    <td className="py-2 pr-4 text-right text-orange-600">{formatCurrency(inst.remaining)}</td>
                    <td className="py-2"><StatusBadge status={inst.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Payments History */}
      {payments.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Payment History ({payments.length})</h3>
          </div>
          <Separator className="mb-4" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-right py-2 pr-4">Amount</th>
                  <th className="text-left py-2 pr-4">Type</th>
                  <th className="text-left py-2 pr-4">Method</th>
                  <th className="text-left py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay: any) => (
                  <tr key={pay.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-4">{formatDate(pay.date)}</td>
                    <td className="py-2 pr-4 text-right font-medium text-green-600">{formatCurrency(pay.amount)}</td>
                    <td className="py-2 pr-4">{pay.paymentType || "—"}</td>
                    <td className="py-2 pr-4">{pay.paymentMode || "—"}</td>
                    <td className="py-2 text-muted-foreground">{pay.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Activity Timeline */}
      {activities.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">Activity Timeline</h3>
          </div>
          <Separator className="mb-4" />
          <div className="space-y-3">
            {activities.map((act: any) => (
              <div key={act.id} className="flex gap-3 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{act.title}</p>
                  {act.description && <p className="text-muted-foreground text-xs">{act.description}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(act.activityDate)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
