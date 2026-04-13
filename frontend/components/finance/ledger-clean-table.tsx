"use client"

import { useRouter } from "next/navigation"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ExternalLink, FileText } from "lucide-react"

export interface CleanLedgerRow {
  tid: string
  name: string          // Client name or Property name
  type: "Deal" | "Payment" | "Refund" | "Commission" | string
  amount: number
  date: string | Date
  status?: "paid" | "partial" | "pending" | "outstanding"
  dealCode?: string
  clientCode?: string
}

interface LedgerCleanTableProps {
  rows: CleanLedgerRow[]
  loading?: boolean
  emptyMessage?: string
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null
  const map: Record<string, { label: string; className: string }> = {
    paid:        { label: "Paid",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300" },
    partial:     { label: "Partial",     className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300" },
    pending:     { label: "Pending",     className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400" },
    outstanding: { label: "Outstanding", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300" },
  }
  const cfg = map[status] ?? { label: status, className: "" }
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", cfg.className)}>
      {cfg.label}
    </Badge>
  )
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    Deal:       "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300",
    Payment:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
    Refund:     "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300",
    Commission: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300",
  }
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", map[type] ?? "")}>
      {type}
    </Badge>
  )
}

export function LedgerCleanTable({ rows, loading, emptyMessage }: LedgerCleanTableProps) {
  const router = useRouter()

  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 w-full rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <FileText className="h-10 w-10 opacity-20" />
        <p className="text-sm">{emptyMessage ?? "No transactions yet"}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[160px] font-semibold">TID</TableHead>
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="w-[130px] font-semibold">Type</TableHead>
            <TableHead className="w-[130px] font-semibold">Status</TableHead>
            <TableHead className="text-right w-[140px] font-semibold">Amount</TableHead>
            <TableHead className="text-right w-[110px] font-semibold">Date</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={`${row.tid}-${idx}`}
              className="cursor-pointer group hover:bg-muted/30 transition-colors"
              onClick={() => router.push(`/ledger/tid/${encodeURIComponent(row.tid)}`)}
            >
              <TableCell>
                <span className="font-mono text-xs font-semibold text-primary tracking-wide">
                  {row.tid}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-medium text-sm">{row.name}</span>
              </TableCell>
              <TableCell>
                <TypeBadge type={row.type} />
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right font-semibold text-sm tabular-nums">
                Rs {Number(row.amount).toLocaleString("en-PK")}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                {row.date ? format(new Date(row.date), "dd MMM yyyy") : "—"}
              </TableCell>
              <TableCell>
                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
