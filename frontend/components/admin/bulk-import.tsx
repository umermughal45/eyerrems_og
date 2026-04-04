"use client"

import { useRef, useState } from "react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Progress } from "@/components/ui/progress"

type ImportSummary = {
  inserted?: number
  updated?: number
  failed?: number
  errors?: string[]
  sectionResults?: Record<string, { inserted: number; updated: number; failed: number }>
}

export function BulkImport() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setProgress(0)
    setSummary(null)
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const text = await file.text()
      
      // Validate CSV has sections
      if (!text.includes('# PROPERTIES') && !text.includes('# FINANCE') && 
          !text.includes('# CUSTOMERS') && !text.includes('# DEAL PAYMENTS') && 
          !text.includes('# LEDGER')) {
        clearInterval(progressInterval)
        setLoading(false)
        toast({
          title: "Invalid CSV format",
          description: "CSV file must contain section headers (e.g., # PROPERTIES, # FINANCE, etc.)",
          variant: "destructive",
        })
        return
      }

      const response: any = await apiService.bulk.import(text)
      
      clearInterval(progressInterval)
      setProgress(100)
      setSummary(response.data.summary || null)
      
      const totalProcessed = (response.data.summary?.inserted || 0) + 
                            (response.data.summary?.updated || 0) + 
                            (response.data.summary?.failed || 0)
      
      if (response.data.summary?.failed === 0) {
        toast({ 
          title: "Import complete", 
          description: `Successfully imported ${totalProcessed} records. ${response.data.summary?.inserted || 0} inserted, ${response.data.summary?.updated || 0} updated.` 
        })
      } else {
        toast({
          title: "Import completed with errors",
          description: `${response.data.summary?.failed || 0} records failed. Check the error list below.`,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      setProgress(0)
      toast({
        title: "Import failed",
        description: error?.response?.data?.error || error?.message || "Unable to import CSV",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
      setTimeout(() => setProgress(0), 2000)
    }
  }

  const totalProcessed = summary 
    ? (summary.inserted || 0) + (summary.updated || 0) + (summary.failed || 0)
    : 0

  return (
    <Card className="space-y-4 p-6">
      <div>
        <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Bulk Import</p>
        <h2 className="text-2xl font-bold text-foreground">Import CSV</h2>
        <p className="text-sm text-muted-foreground">
          Upload a CSV file exported from this system. The file should contain sections 
          (Properties, Finance, Customers, Deal Payments, Ledger). Records with IDs will be 
          updated, records without IDs will be inserted as new.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Upload CSV file</Label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          variant="outline"
          size="sm"
          className="w-full justify-center"
          disabled={loading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {loading ? "Importing..." : "Upload CSV"}
        </Button>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Processing CSV...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {summary && totalProcessed > 0 && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Import Results</h3>
            {summary.failed === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Inserted</p>
              <p className="text-lg font-semibold text-green-600">{summary.inserted ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="text-lg font-semibold text-blue-600">{summary.updated ?? 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Failed</p>
              <p className="text-lg font-semibold text-red-600">{summary.failed ?? 0}</p>
            </div>
          </div>

          {summary.sectionResults && Object.keys(summary.sectionResults).length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-bold text-foreground">By Section:</p>
              <div className="space-y-1 text-xs">
                {Object.entries(summary.sectionResults).map(([section, results]) => (
                  <div key={section} className="flex justify-between">
                    <span className="text-muted-foreground">{section}:</span>
                    <span>
                      +{results.inserted} / ↑{results.updated} / ✗{results.failed}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {summary.errors && summary.errors.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <p className="text-xs font-bold text-red-600">
                  Errors ({summary.errors.length})
                </p>
              </div>
              <div className="max-h-40 overflow-y-auto rounded bg-red-50 p-2 dark:bg-[#0d212c]/20">
                <ul className="space-y-1 text-xs text-red-700 dark:text-red-400">
                  {summary.errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="list-disc pl-2">{error}</li>
                  ))}
                  {summary.errors.length > 10 && (
                    <li className="text-muted-foreground">
                      ... and {summary.errors.length - 10} more errors
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

