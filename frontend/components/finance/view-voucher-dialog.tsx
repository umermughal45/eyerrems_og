"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Edit, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ViewVoucherDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  voucherId: string
  onEdit?: () => void
}

export function ViewVoucherDialog({ open, onOpenChange, voucherId, onEdit }: ViewVoucherDialogProps) {
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [voucher, setVoucher] = useState<any>(null)
  const [payeeDetails, setPayeeDetails] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open && voucherId) {
      fetchVoucher()
    }
  }, [open, voucherId])

  const fetchVoucher = async () => {
    try {
      setLoading(true)
      const response = await apiService.vouchers.getById(voucherId)
      // API returns { success: true, data: voucher } - extract the actual voucher object
      const voucherData = response.data?.data || response.data || response
      setVoucher(voucherData)

      // Fetch payee details if payeeType and payeeId exist
      if (voucherData.payeeType && voucherData.payeeId) {
        try {
          let payeeData = null
          switch (voucherData.payeeType) {
            case "Tenant":
              payeeData = await apiService.tenants.getById(voucherData.payeeId)
              break
            case "Client":
              payeeData = await apiService.clients.getById(voucherData.payeeId)
              break
            case "Employee":
              payeeData = await apiService.employees.getById(voucherData.payeeId)
              break
            case "Dealer":
            case "Agent":
              payeeData = await apiService.dealers.getById(voucherData.payeeId)
              break
            default:
              break
          }
          if (payeeData) {
            setPayeeDetails(payeeData.data || payeeData)
          }
        } catch (error) {
          console.error("Failed to fetch payee details:", error)
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to load voucher",
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true)
      const response = await apiService.vouchers.getPDF(voucherId) as any
      
      // Create blob and download
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `voucher-${voucher?.voucherNumber || voucherId}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({ title: "PDF downloaded successfully" })
    } catch (error: any) {
      toast({
        title: "Failed to download PDF",
        description: error?.response?.data?.error || error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const formatCurrency = (amount: number | undefined | null) => {
    const safeAmount = amount || 0
    return `Rs ${safeAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const formatDate = (date: string | Date | undefined | null) => {
    if (!date) return "-"
    try {
      const dateObj = date instanceof Date ? date : new Date(date)
      if (isNaN(dateObj.getTime())) return "-"
      return dateObj.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return "-"
    }
  }

  const getVoucherTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      BPV: "Bank Payment Voucher",
      BRV: "Bank Receipt Voucher",
      CPV: "Cash Payment Voucher",
      CRV: "Cash Receipt Voucher",
      JV: "Journal Voucher",
    }
    return labels[type] || type
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      submitted: "bg-blue-100 text-blue-800",
      approved: "bg-green-100 text-green-800",
      posted: "bg-green-100 text-green-800",
      reversed: "bg-red-100 text-red-800",
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  // Parse attachments if stored as JSON string
  const getAttachments = () => {
    if (!voucher?.attachments) return []
    if (typeof voucher.attachments === 'string') {
      try {
        const parsed = JSON.parse(voucher.attachments)
        return parsed?.files || parsed || []
      } catch {
        return []
      }
    }
    if (Array.isArray(voucher.attachments)) {
      return voucher.attachments
    }
    if (voucher.attachments?.files) {
      return voucher.attachments.files
    }
    return []
  }

  // Calculate totals from lines
  const calculateTotals = () => {
    if (!voucher?.lines || !Array.isArray(voucher.lines) || voucher.lines.length === 0) {
      return { totalDebit: 0, totalCredit: 0, balance: 0 }
    }
    const totalDebit = voucher.lines.reduce((sum: number, line: any) => {
      const debit = typeof line?.debit === 'number' ? line.debit : 0
      return sum + debit
    }, 0)
    const totalCredit = voucher.lines.reduce((sum: number, line: any) => {
      const credit = typeof line?.credit === 'number' ? line.credit : 0
      return sum + credit
    }, 0)
    return {
      totalDebit,
      totalCredit,
      balance: Math.abs(totalDebit - totalCredit),
    }
  }

  const totals = calculateTotals()

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Voucher</DialogTitle>
            <DialogDescription>Please wait while we load the voucher details...</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!voucher) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Voucher not found</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const isPayment = voucher.type === "BPV" || voucher.type === "CPV"
  const isReceipt = voucher.type === "BRV" || voucher.type === "CRV"
  const isJournal = voucher.type === "JV"
  const attachments = getAttachments()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[1000px] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1000px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Voucher Details - {voucher.voucherNumber}</DialogTitle>
              <DialogDescription className="mt-2 flex items-center gap-2">
                <Badge variant="secondary">{voucher.type ? `${voucher.type} - ${getVoucherTypeLabel(voucher.type)}` : "Voucher"}</Badge>
                {voucher.status && (
                  <Badge className={getStatusColor(voucher.status)}>
                    {voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1)}
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Voucher Number</label>
              <p className="text-sm font-medium">{voucher.voucherNumber || voucher.id || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <p className="text-sm">{formatDate(voucher.date || voucher.createdAt)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
              <p className="text-sm">{voucher.paymentMethod || "-"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Reference Number</label>
              <p className="text-sm">{voucher.referenceNumber || "-"}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground">
                {isPayment ? (voucher.type === "BPV" ? "Bank" : "Cash") : (voucher.type === "BRV" ? "Bank" : "Cash")} Account
              </label>
              <p className="text-sm font-medium">
                {voucher.account?.code ? `${voucher.account.code} - ${voucher.account.name || ""}`.trim() : voucher.accountId || "-"}
              </p>
            </div>
            {voucher.postingDate && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Posting Date</label>
                <p className="text-sm">{formatDate(voucher.postingDate)}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
              <p className="text-sm font-semibold">{formatCurrency(voucher.amount || totals.totalDebit || totals.totalCredit)}</p>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-sm">{voucher.description || "-"}</p>
            </div>
          </div>

          {/* Payee Information (for Payment Vouchers) */}
          {isPayment && voucher.payeeType && voucher.payeeId && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Payee Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payee Type</label>
                  <p className="text-sm">{voucher.payeeType}</p>
                </div>
                {payeeDetails && (
                  <>
                    {payeeDetails.name && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Name</label>
                        <p className="text-sm">{payeeDetails.name}</p>
                      </div>
                    )}
                    {payeeDetails.email && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <p className="text-sm">{payeeDetails.email}</p>
                      </div>
                    )}
                    {payeeDetails.phone && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phone</label>
                        <p className="text-sm">{payeeDetails.phone}</p>
                      </div>
                    )}
                  </>
                )}
                {!payeeDetails && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payee ID</label>
                    <p className="text-sm text-muted-foreground">{voucher.payeeId}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Property/Unit Information */}
          {(voucher.property || voucher.unit) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Property/Unit Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {voucher.property && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Property</label>
                    <p className="text-sm">{voucher.property.name || voucher.propertyId || "-"}</p>
                    {voucher.property.code && (
                      <p className="text-xs text-muted-foreground">Code: {voucher.property.code}</p>
                    )}
                  </div>
                )}
                {voucher.unit && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Unit</label>
                    <p className="text-sm">{voucher.unit.unitName || voucher.unit.name || voucher.unitId || "-"}</p>
                    {voucher.unit.unitNumber && (
                      <p className="text-xs text-muted-foreground">Unit #: {voucher.unit.unitNumber}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Deal Information */}
          {voucher.deal && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Deal Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Deal Title</label>
                  <p className="text-sm">{voucher.deal.title || voucher.dealId || "-"}</p>
                </div>
                {voucher.deal.dealCode && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Deal Code</label>
                    <p className="text-sm">{voucher.deal.dealCode}</p>
                  </div>
                )}
                {voucher.deal.client && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Client</label>
                    <p className="text-sm">{voucher.deal.client.name || "-"}</p>
                  </div>
                )}
                {voucher.deal.dealAmount && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Deal Amount</label>
                    <p className="text-sm font-semibold">{formatCurrency(voucher.deal.dealAmount)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Voucher Lines */}
          {voucher.lines && Array.isArray(voucher.lines) && voucher.lines.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Voucher Lines</h4>
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                  <div>Account</div>
                  <div className="text-right">Debit</div>
                  <div className="text-right">Credit</div>
                  <div>Description</div>
                  <div>Allocation</div>
                </div>
                {voucher.lines.map((line: any, idx: number) => {
                  if (!line) return null
                  const isSystemLine = line.description?.includes('[SYSTEM]') || line.accountId === voucher.accountId
                  return (
                    <div 
                      key={line.id || idx} 
                      className={cn(
                        "grid grid-cols-5 gap-2 text-sm py-2 border-b",
                        isSystemLine && "bg-blue-50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", isSystemLine && "text-blue-700")}>
                          {line.account?.code ? `${line.account.code} - ${line.account.name || ""}`.trim() : line.accountId || "-"}
                        </span>
                        {isSystemLine && (
                          <Badge variant="outline" className="text-xs">System</Badge>
                        )}
                      </div>
                      <div className="text-right font-medium">
                        {line.debit > 0 ? formatCurrency(line.debit) : "-"}
                      </div>
                      <div className="text-right font-medium">
                        {line.credit > 0 ? formatCurrency(line.credit) : "-"}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {line.description || "-"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {line.property?.name ? `Property: ${line.property.name}` : ""}
                        {line.unit?.unitName ? ` | Unit: ${line.unit.unitName}` : ""}
                      </div>
                    </div>
                  )
                })}
                <div className="grid grid-cols-5 gap-2 text-sm font-semibold pt-2 border-t">
                  <div>Total</div>
                  <div className="text-right">
                    {formatCurrency(totals.totalDebit)}
                  </div>
                  <div className="text-right">
                    {formatCurrency(totals.totalCredit)}
                  </div>
                  <div></div>
                  <div className={cn(
                    "text-right",
                    totals.balance < 0.01 ? "text-green-600" : "text-red-600"
                  )}>
                    {totals.balance < 0.01 ? "Balanced" : `Difference: ${formatCurrency(totals.balance)}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Journal Entry Details (if posted) */}
          {voucher.journalEntry && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Journal Entry Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entry Number:</span>
                  <span className="font-medium">{voucher.journalEntry.entryNumber}</span>
                </div>
                {voucher.journalEntry.lines && Array.isArray(voucher.journalEntry.lines) && voucher.journalEntry.lines.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">Journal Lines:</label>
                    <div className="space-y-1 pl-4">
                      {voucher.journalEntry.lines.map((line: any, idx: number) => {
                        if (!line) return null
                        return (
                          <div key={idx} className="text-sm flex justify-between">
                            <span>{line.account?.code || "N/A"} - {line.account?.name || "N/A"}:</span>
                            <span>
                              {line.debit > 0 ? `Dr. ${formatCurrency(line.debit)}` : line.credit > 0 ? `Cr. ${formatCurrency(line.credit)}` : "-"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workflow Information */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Workflow Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {voucher.preparedBy && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Prepared By</label>
                  <p className="text-sm">{voucher.preparedBy.username || voucher.preparedBy.email || "-"}</p>
                  {voucher.createdAt && (
                    <p className="text-xs text-muted-foreground">on {formatDate(voucher.createdAt)}</p>
                  )}
                </div>
              )}
              {voucher.approvedBy && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Approved By</label>
                  <p className="text-sm">{voucher.approvedBy.username || voucher.approvedBy.email || "-"}</p>
                </div>
              )}
              {voucher.postedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Posted At</label>
                  <p className="text-sm">{formatDate(voucher.postedAt)}</p>
                </div>
              )}
              {voucher.reversedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Reversed At</label>
                  <p className="text-sm text-red-600">{formatDate(voucher.reversedAt)}</p>
                  {voucher.reversedVoucher && (
                    <p className="text-xs text-muted-foreground">
                      Reversal Voucher: {voucher.reversedVoucher.voucherNumber}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          {attachments && Array.isArray(attachments) && attachments.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Attachments ({attachments.length})</h4>
              <div className="space-y-2">
                {attachments.map((attachment: any, idx: number) => {
                  if (!attachment) return null
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded-lg">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm flex-1">{attachment.name || `Attachment ${idx + 1}`}</span>
                      {attachment.url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(attachment.url, '_blank')}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && voucher.status === "draft" && (
            <Button variant="outline" onClick={() => {
              onOpenChange(false)
              onEdit()
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          <Button onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
