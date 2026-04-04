"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, RefreshCw, Paperclip, Upload, File, Trash2, Download, FileText, Plus } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"

interface DealerLedgerViewProps {
  dealerId: string
  dealerName?: string
}

export function DealerLedgerView({ dealerId, dealerName }: DealerLedgerViewProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<any>(null)
  const [dealer, setDealer] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'thisMonth'>('all')
  const [uploading, setUploading] = useState(false)

  const fetchDealer = useCallback(async () => {
    if (!dealerId) return
    try {
      const response: any = await apiService.dealers.getById(dealerId)
      const dealerData = (response.data as any)?.data || response.data || response
      setDealer(dealerData)
    } catch (error: any) {
      console.error("Failed to fetch dealer:", error)
    }
  }, [dealerId])

  useEffect(() => {
    if (dealerId) {
      fetchLedger()
      fetchDealer()
    }
  }, [dealerId, filter, fetchDealer])

  const fetchLedger = async () => {
    try {
      setLoading(true)
      const response: any = await apiService.dealerLedger.getLedger(dealerId, { period: filter })
      const responseData = response?.data
      // Handle different response structures
      const ledgerData = responseData?.data || responseData || response?.data || null
      setLedger(ledgerData)
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to fetch dealer ledger"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setLedger(null)
      console.error("Failed to fetch dealer ledger:", error)
    } finally {
      setLoading(false)
    }
  }

  const goToCreateDealerPaymentVoucher = () => {
    router.push("/finance?tab=accounting")
    toast({
      title: "Create Dealer Payment Voucher",
      description: "Use Finance → Accounting to create a Bank Payment Voucher (BPV) for this dealer. Select payeeType=Dealer and payeeId.",
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !dealerId || !dealer) return

    setUploading(true)
    try {
      const newAttachments: any[] = []

      for (const file of Array.from(files)) {
        const reader = new FileReader()
        const base64: string = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        newAttachments.push({
          name: file.name,
          url: base64,
          type: file.type,
          size: file.size,
        })
      }

      const existingFiles = dealer?.attachments?.files || []
      const updatedAttachments = {
        notes: dealer?.attachments?.notes || "",
        files: [...existingFiles, ...newAttachments]
      }

      await apiService.dealers.update(dealerId, { attachments: updatedAttachments })
      toast({ title: `${newAttachments.length} file(s) uploaded successfully` })
      fetchDealer()
    } catch (err: any) {
      console.error("Failed to upload file:", err)
      toast({ title: "Failed to upload file", variant: "destructive" })
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleRemoveAttachment = async (index: number) => {
    if (!dealerId || !dealer) return

    try {
      const existingFiles = dealer?.attachments?.files || []
      const updatedFiles = existingFiles.filter((_: any, i: number) => i !== index)
      const updatedAttachments = {
        notes: dealer?.attachments?.notes || "",
        files: updatedFiles
      }

      await apiService.dealers.update(dealerId, { attachments: updatedAttachments })
      toast({ title: "Attachment removed" })
      fetchDealer()
    } catch (err: any) {
      console.error("Failed to remove attachment:", err)
      toast({ title: "Failed to remove attachment", variant: "destructive" })
    }
  }

  const getEntryTypeBadge = (type: string) => {
    switch (type) {
      case "commission":
        return <Badge variant="default">Commission</Badge>
      case "payment":
        return <Badge variant="secondary">Payment</Badge>
      case "adjustment":
        return <Badge variant="outline">Adjustment</Badge>
      default:
        return <Badge>{type}</Badge>
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Dealer Ledger {dealerName && `- ${dealerName}`}</h3>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(val: 'all' | 'thisMonth') => setFilter(val)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchLedger} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={goToCreateDealerPaymentVoucher}>
              <FileText className="mr-2 h-4 w-4" />
              Create Dealer Payment Voucher
            </Button>
          </div>
        </div>

        {ledger?.summary && (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Commission (SUM Credit)</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                Rs {Number(ledger.summary.totalCommission || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Payments (SUM Debit)</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                Rs {Number(ledger.summary.totalPayments || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Outstanding Balance (Credit − Debit)</p>
              <p className={`text-2xl font-bold tabular-nums ${(ledger.summary.outstandingBalance || 0) >= 0 ? "text-foreground" : "text-destructive"}`}>
                Rs {Number(ledger.summary.outstandingBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
        {ledger?.hasLegacyEntries && (
          <p className="text-sm text-muted-foreground mt-3">
            Showing legacy commission data. New operations will appear here going forward.
          </p>
        )}
      </Card>

      {/* Attachments Section */}
      {dealer && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Paperclip className="h-5 w-5" />
              Attachments
            </h3>
            <div>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="dealer-attachment-upload"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.xls,.xlsx"
              />
              <label htmlFor="dealer-attachment-upload">
                <Button asChild disabled={uploading} size="sm">
                  <span className="cursor-pointer">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Attachment
                      </>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {dealer?.attachments?.files && dealer.attachments.files.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {dealer.attachments.files.map((attachment: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="h-8 w-8 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {attachment.size ? formatFileSize(attachment.size) : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {attachment.url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (attachment.url.startsWith('data:')) {
                            const link = document.createElement('a')
                            link.href = attachment.url
                            link.download = attachment.name
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          } else {
                            window.open(attachment.url, '_blank')
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-2">No attachments uploaded for this dealer.</p>
            </div>
          )}
        </Card>
      )}

      {/* Ledger Entries */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Ledger Entries</h4>
        {ledger?.entries && ledger.entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction No</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Running Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.entries.map((entry: any) => (
                <TableRow key={entry.id} className={entry.isLegacy ? "bg-muted/30" : ""}>
                  <TableCell>{format(new Date(entry.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.referenceId || entry.referenceNo || "—"}</TableCell>
                  <TableCell>
                    {entry.description || "—"}
                    {entry.isLegacy && <Badge variant="secondary" className="ml-2 text-xs">Legacy Entry</Badge>}
                  </TableCell>
                  <TableCell>{entry.isLegacy ? "LEGACY_COMMISSION" : getEntryTypeBadge(entry.entryType)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {((entry.entryType === "payment" && entry.amount > 0) || (entry.debit != null && entry.debit > 0))
                      ? `Rs ${(entry.amount ?? entry.debit ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {((entry.entryType === "commission" && entry.amount > 0) || (entry.credit != null && entry.credit > 0))
                      ? `Rs ${(entry.amount ?? entry.credit ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    Rs {(entry.balance ?? entry.runningBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{(entry.balance ?? entry.runningBalance ?? 0) >= 0 ? "CR" : "DR"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <p>No ledger entries found for this dealer.</p>
            {ledger?.hasLegacyEntries === false && ledger?.hasLedgerEntries === false && (
              <p className="text-sm">Dealer ledger is empty. Create commissions or voucher payments to see entries.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

