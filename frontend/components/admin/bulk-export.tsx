"use client"

import { useState } from "react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Download } from "lucide-react"

const download = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

export function BulkExport() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const response = await apiService.bulk.export()
      const blob = new Blob([response.data as BlobPart], { type: "text/csv; charset=utf-8" })
      const filename = `bulk-export-${new Date().toISOString().split('T')[0]}.csv`
      download(blob, filename)
      toast({ 
        title: "CSV export ready", 
        description: "All data exported in CSV format with sections (Properties, Finance, Customers, Deal Payments, Ledger)." 
      })
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.response?.data?.error || error?.message || "Unable to export data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Bulk Export</p>
        <h2 className="text-2xl font-bold text-foreground">Export All Data (CSV)</h2>
        <p className="text-sm text-muted-foreground">
          Download a single CSV file containing all key modules in a structured format:
          Properties, Finance, Customers, Deal Payments, and Ledger entries. 
          The file can be edited in Excel and re-imported to update your system.
        </p>
      </div>
      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating CSV...
          </>
        ) : (
          <>
            <Download className="mr-2 h-4 w-4" />
            Export All Data (CSV)
          </>
        )}
      </Button>
    </Card>
  )
}

