"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  Calendar,
  DollarSign
} from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

export function TenantLedgerView({ tenantData }: { tenantData: any }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([])
  const [summary, setSummary] = useState({
    totalDebits: 0,
    totalCredits: 0,
    currentBalance: 0,
    openingBalance: 0
  })

  useEffect(() => {
    fetchLedger()
  }, [tenantData])

  const fetchLedger = async () => {
    try {
      setLoading(true)
      
      if (!tenantData?.id) return

      // Fetch ledger entries
      try {
        const ledgerRes = await apiService.tenantPortal.getLedger(tenantData.id)
        const responseData = (ledgerRes as any)?.data?.data || (ledgerRes as any)?.data
        const entries = Array.isArray(responseData?.data) 
          ? responseData.data 
          : Array.isArray(responseData)
            ? responseData
            : []
        
        // Get summary if available
        if (responseData?.summary) {
          setSummary({
            totalDebits: responseData.summary.totalDebits || 0,
            totalCredits: responseData.summary.totalCredits || 0,
            currentBalance: responseData.summary.currentBalance || 0,
            openingBalance: responseData.summary.openingBalance || 0
          })
        }
        
        setLedgerEntries(entries.sort((a: any, b: any) => 
          new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
        ))

        // Calculate summary
        const debits = entries.filter((e: any) => e.entryType === "debit")
        const credits = entries.filter((e: any) => e.entryType === "credit")
        
        const totalDebits = debits.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)
        const totalCredits = credits.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)
        
        const currentBalance = entries.length > 0 
          ? entries[entries.length - 1].balance 
          : tenantData.outstandingBalance || 0
        
        const openingBalance = entries.length > 0 
          ? entries[0].balance - (entries[0].entryType === "debit" ? entries[0].amount : -entries[0].amount)
          : 0

        setSummary({
          totalDebits,
          totalCredits,
          currentBalance,
          openingBalance
        })
      } catch (e) {
        console.warn("Ledger API not available, generating from invoices/payments")
        
        // Fallback: Generate ledger from invoices and payments
        const invoicesRes = await apiService.invoices.getAll()
        const allInvoices = Array.isArray((invoicesRes as any)?.data?.data)
          ? (invoicesRes as any).data.data
          : Array.isArray((invoicesRes as any)?.data)
            ? (invoicesRes as any).data
            : []
        
        const tenantInvoices = allInvoices.filter((inv: any) => inv.tenantId === tenantData.id)
        
        const paymentsRes = await apiService.payments.getAll()
        const allPayments = Array.isArray((paymentsRes as any)?.data?.data)
          ? (paymentsRes as any).data.data
          : Array.isArray((paymentsRes as any)?.data)
            ? (paymentsRes as any).data
            : []
        
        const tenantPayments = allPayments.filter((p: any) => p.tenantId === tenantData.id)

        // Generate ledger entries
        const entries: any[] = []
        let runningBalance = tenantData.outstandingBalance || 0

        // Add invoice entries (debits)
        tenantInvoices.forEach((inv: any) => {
          entries.push({
            id: `invoice-${inv.id}`,
            entryDate: inv.billingDate || inv.dueDate,
            entryType: "debit",
            description: `Rent Invoice - ${inv.invoiceNumber || inv.id.slice(0, 8)}`,
            amount: inv.totalAmount || inv.amount || 0,
            balance: runningBalance + (inv.totalAmount || inv.amount || 0),
            referenceId: inv.id,
            referenceType: "invoice"
          })
          runningBalance += inv.totalAmount || inv.amount || 0
        })

        // Add payment entries (credits)
        tenantPayments.forEach((p: any) => {
          entries.push({
            id: `payment-${p.id}`,
            entryDate: p.date,
            entryType: "credit",
            description: `Payment - ${p.paymentId || p.id.slice(0, 8)}`,
            amount: p.amount || 0,
            balance: runningBalance - (p.amount || 0),
            referenceId: p.id,
            referenceType: "payment"
          })
          runningBalance -= p.amount || 0
        })

        // Sort by date
        entries.sort((a: any, b: any) => 
          new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime()
        )

        // Recalculate balances
        let balance = tenantData.outstandingBalance || 0
        entries.forEach((entry: any) => {
          if (entry.entryType === "debit") {
            balance += entry.amount
          } else {
            balance -= entry.amount
          }
          entry.balance = balance
        })

        setLedgerEntries(entries)

        const totalDebits = entries
          .filter((e: any) => e.entryType === "debit")
          .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)
        const totalCredits = entries
          .filter((e: any) => e.entryType === "credit")
          .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0)

        setSummary({
          totalDebits,
          totalCredits,
          currentBalance: balance,
          openingBalance: tenantData.outstandingBalance || 0
        })
      }
    } catch (error) {
      console.error("Error fetching ledger:", error)
      toast({
        title: "Error",
        description: "Failed to load ledger.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadLedger = () => {
    const ledgerContent = `
TENANT LEDGER STATEMENT
=======================

Tenant: ${tenantData?.name || "N/A"}
Period: ${ledgerEntries.length > 0 
  ? `${new Date(ledgerEntries[0].entryDate).toLocaleDateString()} to ${new Date(ledgerEntries[ledgerEntries.length - 1].entryDate).toLocaleDateString()}`
  : "N/A"}

Opening Balance: ${formatCurrency(summary.openingBalance)}

TRANSACTIONS
------------
${ledgerEntries.map((entry: any) => `
Date: ${new Date(entry.entryDate).toLocaleDateString()}
Type: ${entry.entryType.toUpperCase()}
Description: ${entry.description}
Amount: ${formatCurrency(entry.amount)}
Balance: ${formatCurrency(entry.balance)}
`).join('\n')}

SUMMARY
-------
Total Debits: ${formatCurrency(summary.totalDebits)}
Total Credits: ${formatCurrency(summary.totalCredits)}
Current Balance: ${formatCurrency(summary.currentBalance)}
    `.trim()

    const blob = new Blob([ledgerContent], { type: "text/plain" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ledger_${tenantData?.name?.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    toast({
      title: "Ledger Downloaded",
      description: "Your ledger statement has been downloaded.",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Tenant Ledger</h2>
          <p className="text-muted-foreground mt-1">Complete transaction history and balance</p>
        </div>
        <Button onClick={handleDownloadLedger} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Download Ledger
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Opening Balance</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(summary.openingBalance)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Debits</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(summary.totalDebits)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Credits</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(summary.totalCredits)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <FileText className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(summary.currentBalance)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Ledger Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Date</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Type</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">Description</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Debit</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Credit</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    No ledger entries found
                  </td>
                </tr>
              ) : (
                <>
                  {/* Opening Balance Row */}
                  <tr className="border-b border-border">
                    <td colSpan={3} className="py-3 px-4 text-sm font-medium text-foreground">
                      Opening Balance
                    </td>
                    <td colSpan={2}></td>
                    <td className="text-right py-3 px-4 text-sm font-semibold text-foreground">
                      {formatCurrency(summary.openingBalance)}
                    </td>
                  </tr>
                  {ledgerEntries.map((entry: any) => (
                    <tr key={entry.id} className="border-b border-border hover:bg-accent/50">
                      <td className="py-3 px-4 text-sm text-foreground">
                        {new Date(entry.entryDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={entry.entryType === "debit" ? "destructive" : "default"}
                        >
                          {entry.entryType === "debit" ? "Debit" : "Credit"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        {entry.description}
                        {entry.referenceType && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({entry.referenceType})
                          </span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-foreground">
                        {entry.entryType === "debit" ? formatCurrency(entry.amount) : "-"}
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-foreground">
                        {entry.entryType === "credit" ? formatCurrency(entry.amount) : "-"}
                      </td>
                      <td className="text-right py-3 px-4 text-sm font-semibold text-foreground">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

