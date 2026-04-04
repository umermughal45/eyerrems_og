"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Download, Info, UploadCloud } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

type LeadImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

export function LeadImportDialog({ open, onOpenChange, onImported }: LeadImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [batchInfo, setBatchInfo] = useState<{ batchId: string; rowCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    setError(null)
    setBatchInfo(null)
    if (!selectedFile) {
      setFile(null)
      return
    }

    const ext = selectedFile.name.split(".").pop()?.toLowerCase()
    if (ext !== "csv") {
      setError("Only .csv files are currently supported. Please upload a CSV file using the required template.")
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a CSV file to upload.")
      return
    }

    try {
      setUploading(true)
      setError(null)

      const response = await apiService.leadImport.upload(file)
      const data = response.data

      setBatchInfo({
        batchId: data.batchId,
        rowCount: data.rowCount,
      })

      toast({
        title: "File uploaded",
        description: `Imported ${data.rowCount} rows into staging. Review and confirm import from the Leads module.`,
      })

      // For now, just notify parent to refresh stats/leads list
      onImported?.()
    } catch (err: any) {
      console.error("Lead import upload failed:", err)
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to upload lead import file"
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setBatchInfo(null)
    setError(null)
    setUploading(false)
    setDownloadingTemplate(false)
    onOpenChange(false)
  }

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true)
      setError(null)
      const response = await apiService.leadImport.downloadTemplate()
      const blob = response.data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "crm_lead_import_template.csv"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({
        title: "Template downloaded",
        description: "crm_lead_import_template.csv",
      })
    } catch (err: any) {
      console.error("Lead import template download failed:", err)
      if (err?.response?.status === 403) {
        setError("You don't have permission to download the lead import template.")
      } else if (err?.response?.data instanceof Blob) {
        try {
          const text = await (err.response.data as Blob).text()
          const j = JSON.parse(text)
          setError(j?.error || j?.message || "Failed to download template.")
        } catch {
          setError("Failed to download template.")
        }
      } else {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to download template."
        setError(message)
      }
    } finally {
      setDownloadingTemplate(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing leads to import into the CRM. The file will be staged for validation before any
            leads are actually created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Template requirements</AlertTitle>
            <AlertDescription className="mt-1 space-y-1 text-sm">
              <p>The CSV must contain a header row with the following exact columns:</p>
              <p className="font-mono text-xs break-all">
                Full Name, Phone, Email, CNIC, Lead Source, Source Details, Dealer TID, Dealer Email, Notes
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Phone and Lead Source are required.</li>
                <li>Either Dealer TID or Dealer Email may be provided per row, but not both.</li>
                <li>Status, pipeline stage, property or deal fields are not allowed in the file.</li>
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                {downloadingTemplate ? "Downloading..." : "Download Template"}
              </Button>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="cursor-pointer"
              />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground truncate">
                Selected file: <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Uploading and staging leads...</p>
              <Progress value={70} />
            </div>
          )}

          {batchInfo && (
            <Alert className="border-green-600/40 bg-green-50/60 text-green-900">
              <AlertTitle>Staging created</AlertTitle>
              <AlertDescription className="text-sm mt-1">
                Batch <span className="font-mono text-xs">{batchInfo.batchId}</span> was created with{" "}
                <span className="font-semibold">{batchInfo.rowCount}</span> rows. Validation, deduplication, and dealer
                assignment will run in the next step before final import.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription className="text-sm mt-1">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            <UploadCloud className="h-4 w-4 mr-2" />
            {uploading ? "Uploading..." : "Upload & Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

