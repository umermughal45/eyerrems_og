"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Calendar, Loader2 } from "lucide-react"
import { apiService } from "@/lib/api"

export function DocumentsView({ tenantData, leaseData }: { tenantData: any; leaseData: any }) {
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<any[]>([])

  useEffect(() => {
    fetchDocuments()
  }, [tenantData, leaseData])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      
      // Generate documents from lease and invoices
      const docs: any[] = []
      
      // Add lease agreement if available
      if (leaseData) {
        docs.push({
          id: `lease-${leaseData.id}`,
          name: "Lease Agreement",
          type: "Contract",
          date: new Date(leaseData.leaseStart).toISOString().split('T')[0],
          size: "~2 MB",
        })
      }
      
      // Get invoices as receipts
      if (tenantData?.id) {
        const invoicesRes = await apiService.invoices.getAll()
        const allInvoices = Array.isArray((invoicesRes as any)?.data?.data)
          ? (invoicesRes as any).data.data
          : Array.isArray((invoicesRes as any)?.data)
            ? (invoicesRes as any).data
            : []
        
        const tenantInvoices = allInvoices.filter((inv: any) => inv.tenantId === tenantData.id)
        
        tenantInvoices.forEach((inv: any) => {
          const month = new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          docs.push({
            id: `invoice-${inv.id}`,
            name: `Rent Receipt - ${month}`,
            type: "Receipt",
            date: inv.dueDate,
            size: "~150 KB",
          })
        })
      }
      
      setDocuments(docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch (error) {
      console.error("Error fetching documents:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (doc: any) => {
    try {
      // Generate document content based on type
      let content = ""
      let filename = doc.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".txt"
      
      if (doc.type === "Contract" && leaseData) {
        // Generate lease agreement content
        content = `LEASE AGREEMENT\n\n`
        content += `Property: ${leaseData.unit?.property?.name || "N/A"}\n`
        content += `Unit: ${leaseData.unit?.unitName || "N/A"}\n`
        content += `Tenant: ${tenantData?.name || "N/A"}\n`
        content += `Lease Start: ${new Date(leaseData.leaseStart).toLocaleDateString()}\n`
        content += `Lease End: ${new Date(leaseData.leaseEnd).toLocaleDateString()}\n`
        content += `Monthly Rent: $${leaseData.rent || 0}\n`
        filename = `lease_agreement_${new Date().getFullYear()}.txt`
      } else if (doc.type === "Receipt") {
        // Generate receipt content
        const invoiceId = doc.id.replace("invoice-", "")
        const invoice = await apiService.invoices.getById(parseInt(invoiceId))
        const invoiceData = (invoice as any)?.data?.data || (invoice as any)?.data
        
        content = `RENT RECEIPT\n\n`
        content += `Date: ${new Date(doc.date).toLocaleDateString()}\n`
        content += `Tenant: ${tenantData?.name || "N/A"}\n`
        content += `Amount: $${invoiceData?.amount || 0}\n`
        content += `Status: ${invoiceData?.status || "N/A"}\n`
        filename = `receipt_${new Date(doc.date).toISOString().split('T')[0]}.txt`
      }
      
      // Create and download file
      const blob = new Blob([content], { type: "text/plain" })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading document:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">My Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Access your lease agreement, receipts, and other documents</p>
      </div>

      {documents.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-center">No documents available.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((doc) => (
          <Card key={doc.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{doc.name}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{doc.type}</Badge>
                    <span className="text-xs text-muted-foreground">{doc.size}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3" />
                    {new Date(doc.date).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => handleDownload(doc)}
                title="Download document"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </Card>
          ))}
        </div>
      )}
    </div>
  )
}
