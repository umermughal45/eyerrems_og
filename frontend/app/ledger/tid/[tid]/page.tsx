"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { apiService } from "@/lib/api"
import { format } from "date-fns"
import { ArrowLeft, Loader2, AlertCircle, User, Building2, Briefcase, CreditCard, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { label: string; className: string }> = {
    paid:        { label: "Paid",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" },
    partial:     { label: "Partial",     className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
    pending:     { label: "Pending",     className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400" },
    open:        { label: "Open",        className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300" },
    closed:      { label: "Closed",      className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" },
    cancelled:   { label: "Cancelled",   className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300" },
    in_progress: { label: "In Progress", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
  }
  const cfg = map[status.toLowerCase()] ?? { label: status, className: "" }
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  )
}

function AmountCard({ label, amount, highlight }: { label: string; amount: number; highlight?: "green" | "red" | "blue" }) {
  const colorMap = {
    green: "text-emerald-600 dark:text-emerald-400",
    red:   "text-red-600 dark:text-red-400",
    blue:  "text-blue-600 dark:text-blue-400",
  }
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl border bg-card">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn("text-xl font-bold tabular-nums", highlight ? colorMap[highlight] : "")}>
        Rs {Number(amount || 0).toLocaleString("en-PK")}
      </span>
    </div>
  )
}

export default function TidDetailPage() {
  const params = useParams()
  const router = useRouter()
  const tid = decodeURIComponent(params?.tid as string ?? "")
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tid) return
    setLoading(true)
    setError(null)
    apiService.search.byTid(tid)
      .then((res: any) => {
        const payload = res?.data?.data ?? res?.data ?? null
        setData(payload)
      })
      .catch((err: any) => {
        const msg = err?.response?.data?.error ?? err?.message ?? "Failed to load transaction"
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [tid])

  // Derived financials from deals
  const totalDealAmount = data?.deals?.reduce((s: number, d: any) => s + (d.dealAmount ?? 0), 0) ?? 0
  const totalPaid = data?.payments?.reduce((s: number, p: any) => s + (p.amount ?? 0), 0) ?? 0
  const outstanding = Math.max(totalDealAmount - totalPaid, 0)
  const paymentStatus = totalPaid === 0 ? "pending" : outstanding === 0 ? "paid" : "partial"

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading transaction...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <Card className="p-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive opacity-60" />
              <div>
                <p className="font-semibold text-destructive">Transaction Not Found</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
              <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
            </div>
          </Card>
        )}

        {data && !loading && (
          <>
            {/* Header Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-lg font-bold text-primary tracking-wide">{tid}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Transaction Identity Record
                    </p>
                  </div>
                  <StatusBadge status={paymentStatus} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <AmountCard label="Total Deal Value" amount={totalDealAmount} highlight="blue" />
                  <AmountCard label="Total Received" amount={totalPaid} highlight="green" />
                  <AmountCard label="Outstanding" amount={outstanding} highlight={outstanding > 0 ? "red" : "green"} />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Info */}
              {data.client && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" /> Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0.5">
                    <InfoRow label="Name" value={data.client.name} />
                    <InfoRow label="Code" value={data.client.clientCode} />
                    <InfoRow label="Phone" value={data.client.phone} />
                    <InfoRow label="Email" value={data.client.email} />
                    <InfoRow label="Status" value={data.client.status} />
                  </CardContent>
                </Card>
              )}

              {/* Property Info */}
              {data.properties?.[0] && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" /> Property
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0.5">
                    <InfoRow label="Name" value={data.properties[0].name} />
                    <InfoRow label="Type" value={data.properties[0].type} />
                    <InfoRow label="Address" value={data.properties[0].address} />
                    <InfoRow label="Status" value={data.properties[0].status} />
                    <InfoRow label="Sale Price" value={data.properties[0].salePrice ? `Rs ${Number(data.properties[0].salePrice).toLocaleString("en-PK")}` : null} />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Deals */}
            {data.deals?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" /> Deals ({data.deals.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Deal Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.deals.map((deal: any) => (
                        <TableRow key={deal.id}>
                          <TableCell className="font-mono text-xs font-semibold text-primary">{deal.dealCode ?? "—"}</TableCell>
                          <TableCell className="font-medium text-sm">{deal.title}</TableCell>
                          <TableCell className="capitalize text-sm text-muted-foreground">{deal.stage}</TableCell>
                          <TableCell><StatusBadge status={deal.status} /></TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-sm">
                            Rs {Number(deal.dealAmount ?? 0).toLocaleString("en-PK")}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {deal.dealDate ? format(new Date(deal.dealDate), "dd MMM yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" /> Payment History ({data.payments?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!data.payments?.length ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                    <CreditCard className="h-8 w-8 opacity-20" />
                    <p className="text-sm">No transactions yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Payment ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Remarks</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payments.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs font-semibold">{p.paymentId ?? "—"}</TableCell>
                          <TableCell className="capitalize text-sm">{p.paymentType ?? "—"}</TableCell>
                          <TableCell className="capitalize text-sm text-muted-foreground">{p.paymentMode?.replace("_", " ") ?? "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.remarks ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
                            + Rs {Number(p.amount ?? 0).toLocaleString("en-PK")}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {p.date ? format(new Date(p.date), "dd MMM yyyy") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
