"use client"

import React from "react"
import { format } from "date-fns"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Search, ExternalLink, ArrowUpRight, ArrowDownLeft, Receipt, Briefcase } from "lucide-react"

export interface LedgerEntry {
  id: string
  tid: string
  ledgerType: 'CLIENT' | 'PROPERTY' | 'DEALER'
  entryType: 'DEAL_CREATED' | 'PAYMENT_RECEIVED' | 'COMMISSION_RECORDED' | 'REFUND_ISSUED' | 'ADJUSTMENT'
  referenceId: string
  referenceType: 'DEAL' | 'PAYMENT' | 'ADJUSTMENT'
  dealAmount: number
  paymentAmount: number
  outstandingAmount: number
  entryDate: string | Date
  notes?: string
  // Legacy support
  amount?: number
}

interface UnifiedLedgerTableProps {
  entries: LedgerEntry[]
  onRowClick?: (tid: string) => void
  loading?: boolean
}

const EntryTypeBadge = ({ type }: { type: LedgerEntry['entryType'] }) => {
  switch (type) {
    case 'DEAL_CREATED':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
          <Briefcase className="h-3 w-3" /> Deal Created
        </Badge>
      )
    case 'PAYMENT_RECEIVED':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <Receipt className="h-3 w-3" /> Payment
        </Badge>
      )
    case 'COMMISSION_RECORDED':
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1">
          <ArrowUpRight className="h-3 w-3" /> Commission
        </Badge>
      )
    case 'REFUND_ISSUED':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
          <ArrowDownLeft className="h-3 w-3" /> Refund
        </Badge>
      )
    default:
      return <Badge variant="secondary">{type}</Badge>
  }
}

export function UnifiedLedgerTable({ entries, onRowClick, loading }: UnifiedLedgerTableProps) {
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Search className="h-10 w-10 mb-4 opacity-20" />
        <p>No transactions found in this ledger</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[140px]">Date</TableHead>
            <TableHead className="w-[150px]">TID</TableHead>
            <TableHead className="w-[180px]">Type</TableHead>
            <TableHead className="min-w-[250px]">Notes</TableHead>
            <TableHead className="text-right w-[140px]">Deal Amount</TableHead>
            <TableHead className="text-right w-[140px]">Payment</TableHead>
            <TableHead className="text-right w-[140px]">Outstanding</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow 
              key={entry.id} 
              className="cursor-pointer group hover:bg-muted/30 transition-colors"
              onClick={() => onRowClick?.(entry.tid)}
            >
              <TableCell className="font-medium text-muted-foreground whitespace-nowrap">
                {format(new Date(entry.entryDate), "dd MMM yyyy")}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-primary">
                    {entry.tid}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <EntryTypeBadge type={entry.entryType} />
              </TableCell>
              <TableCell className="max-w-[300px]">
                <p className="text-sm line-clamp-1 text-muted-foreground group-hover:text-foreground">
                  {entry.notes || "—"}
                </p>
              </TableCell>
              <TableCell className="text-right font-medium">
                {entry.dealAmount > 0 ? formatCurrency(entry.dealAmount) : "—"}
              </TableCell>
              <TableCell className="text-right font-medium text-emerald-600">
                {entry.paymentAmount > 0 ? `+ ${formatCurrency(entry.paymentAmount)}` : "—"}
              </TableCell>
              <TableCell className="text-right">
                <span className={cn(
                  "font-bold",
                  entry.outstandingAmount > 0 ? "text-orange-600" : "text-primary"
                )}>
                  {formatCurrency(entry.outstandingAmount)}
                </span>
              </TableCell>
              <TableCell>
                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
