"use client"

import { useState } from "react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Loader2, Download, FileSpreadsheet } from "lucide-react"

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

export function BulkExcelExport() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const response = await apiService.bulkExcel.export()
      const blob = new Blob([response.data as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const filename = `rems-bulk-export-${new Date().toISOString().split('T')[0]}.xlsx`
      download(blob, filename)
      toast({
        title: "Excel export ready",
        description:
          "Multi-sheet Excel file generated with Properties, Customers, Installments, Payments, Amenities, Ledger, Staff, Bookings, and Options sheets.",
      })
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error?.response?.data?.error || error?.message || "Unable to export Excel file",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <div>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Excel Export</p>
        <h2 className="text-2xl font-bold text-foreground">Export All Data (Excel)</h2>
        <p className="text-sm text-muted-foreground">
          Download a multi-sheet Excel file containing all key modules: Properties, Customers,
          Installments, Payments, Ledger, Staff, and Bookings. The file can be edited in Excel
          and re-imported to update your system.
        </p>
      </div>
      <Button onClick={handleExport} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating Excel...
          </>
        ) : (
          <>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export All Data (Excel)
          </>
        )}
      </Button>
    </Card>
  )
}

