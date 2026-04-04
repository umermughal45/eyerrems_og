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
import { Download, Edit, Loader2, FileText } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface ViewReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  receiptId: string
  onEdit?: () => void
}

export function ViewReceiptDialog({ open, onOpenChange, receiptId, onEdit }: ViewReceiptDialogProps) {
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open && receiptId) {
      fetchReceipt()
    }
  }, [open, receiptId])

  const fetchReceipt = async () => {
    try {
      setLoading(true)
      const response = await apiService.receipts.getById(receiptId) as any
      const receiptData = response.data?.data || response.data || response
      setReceipt(receiptData)
    } catch (error: any) {
      toast({
        title: "Failed to load receipt",
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
      const response = await apiService.receipts.getPDF(receiptId) as any
      
      // Create blob and download
      const blob = new Blob([response.data as BlobPart], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `receipt-${receipt?.receiptNo || receiptId}.pdf`
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

  const formatDate = (date: string | Date) => {
    if (!date) return "N/A"
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!receipt) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Receipt not found</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[800px] max-w-[95vw] sm:max-w-[90vw] md:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt Details - {receipt.receiptNo}</DialogTitle>
          <DialogDescription>
            <Badge variant="secondary" className="mt-2">{receipt.method}</Badge>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Receipt Number</label>
              <p className="text-sm font-medium">{receipt.receiptNo}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Date</label>
              <p className="text-sm">{formatDate(receipt.date)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
              <p className="text-sm">{receipt.method || "N/A"}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Amount</label>
              <p className="text-sm font-semibold">{formatCurrency(receipt.amount)}</p>
            </div>
            {receipt.referenceNumber && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reference Number</label>
                <p className="text-sm">{receipt.referenceNumber}</p>
              </div>
            )}
            {receipt.receivedByUser && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Received By</label>
                <p className="text-sm">{receipt.receivedByUser.username || receipt.receivedByUser.email || "N/A"}</p>
              </div>
            )}
          </div>

          {receipt.client && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Client Details</h4>
              <div className="space-y-1">
                <p className="text-sm"><strong>Name:</strong> {receipt.client.name || "N/A"}</p>
                {receipt.client.email && (
                  <p className="text-sm"><strong>Email:</strong> {receipt.client.email}</p>
                )}
                {receipt.client.phone && (
                  <p className="text-sm"><strong>Phone:</strong> {receipt.client.phone}</p>
                )}
                {receipt.client.address && (
                  <p className="text-sm"><strong>Address:</strong> {receipt.client.address}</p>
                )}
              </div>
            </div>
          )}

          {receipt.deal && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Deal Details</h4>
              <div className="space-y-1">
                <p className="text-sm"><strong>Title:</strong> {receipt.deal.title || "N/A"}</p>
                {receipt.deal.dealCode && (
                  <p className="text-sm"><strong>Deal Code:</strong> {receipt.deal.dealCode}</p>
                )}
                <p className="text-sm"><strong>Deal Amount:</strong> {formatCurrency(receipt.deal.dealAmount)}</p>
                {receipt.deal.property && (
                  <p className="text-sm"><strong>Property:</strong> {receipt.deal.property.name || "N/A"}</p>
                )}
              </div>
            </div>
          )}

          {receipt.allocations && receipt.allocations.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Allocations</h4>
              <div className="space-y-2">
                {receipt.allocations.map((allocation: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">
                          Installment #{allocation.installment?.installmentNumber || idx + 1}
                        </p>
                        {allocation.installment?.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due: {formatDate(allocation.installment.dueDate)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(allocation.amountAllocated)}
                        </p>
                        {allocation.installment?.amount && (
                          <p className="text-xs text-muted-foreground">
                            of {formatCurrency(allocation.installment.amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {receipt.notes && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Notes</h4>
              <p className="text-sm">{receipt.notes}</p>
            </div>
          )}

          {receipt.journalEntry && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Journal Entry</h4>
              <div className="space-y-1">
                <p className="text-sm"><strong>Entry Number:</strong> {receipt.journalEntry.entryNumber || "N/A"}</p>
                {receipt.journalEntry.lines && receipt.journalEntry.lines.length > 0 && (
                  <div className="space-y-1 mt-2">
                    {receipt.journalEntry.lines.map((line: any, idx: number) => (
                      <div key={idx} className="text-sm flex justify-between pl-4">
                        <span>{line.account?.name || "N/A"}:</span>
                        <span>
                          {line.debit > 0 ? `Dr. ${formatCurrency(line.debit)}` : `Cr. ${formatCurrency(line.credit)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
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

