"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Loader2, FileText, FileSpreadsheet, File, FileType } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { GlobalFilterPayload } from "./global-filter-dialog"

export interface EnhancedReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  module: string
  tab?: string
  filter: GlobalFilterPayload
  availableColumns?: Array<{ key: string; label: string }>
  currentPage?: number
  currentPageSize?: number
  totalRecords?: number
  hasAdminPermission?: boolean
}

export function EnhancedReportDialog({
  open,
  onOpenChange,
  module,
  tab,
  filter,
  availableColumns = [],
  currentPage = 1,
  currentPageSize = 25,
  totalRecords = 0,
  hasAdminPermission = false,
}: EnhancedReportDialogProps) {
  const { toast } = useToast()
  const [format, setFormat] = useState<'csv' | 'excel' | 'pdf' | 'word'>('excel')
  const [scope, setScope] = useState<'current_page' | 'all_filtered' | 'custom_limit'>('all_filtered')
  const [customLimit, setCustomLimit] = useState<number>(1000)
  const [dataShape, setDataShape] = useState<'raw' | 'grouped' | 'aggregated'>('raw')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (open) {
      // Initialize selected columns to all available
      if (availableColumns.length > 0) {
        setSelectedColumns(availableColumns.map(col => col.key))
      }
    }
  }, [open, availableColumns])

  const handleCreateJob = async () => {
    try {
      setCreating(true)

      const payload = {
        module,
        tab,
        format,
        scope,
        custom_limit: scope === 'custom_limit' ? customLimit : undefined,
        columns: selectedColumns.length > 0 ? selectedColumns : undefined,
        data_shape: dataShape,
        filter,
      }

      const response = await apiService.post('/export-jobs', payload)
      const jobId = response.data?.data?.id

      if (!jobId) {
        throw new Error('Failed to create export job')
      }

      toast({
        title: "Export job created",
        description: "Your report is being generated. Check export history for status.",
      })

      onOpenChange(false)
      
      // Poll for job status (optional - could be done via separate status endpoint)
      // For now, user can check export history
    } catch (error: any) {
      console.error("Export job creation error:", error)
      toast({
        title: "Export failed",
        description: error?.response?.data?.error || error?.message || "Failed to create export job",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      setSelectedColumns(selectedColumns.filter(k => k !== key))
    } else {
      setSelectedColumns([...selectedColumns, key])
    }
  }

  const selectAllColumns = () => {
    if (selectedColumns.length === availableColumns.length) {
      setSelectedColumns([])
    } else {
      setSelectedColumns(availableColumns.map(col => col.key))
    }
  }

  const filteredCount = totalRecords // This should come from backend based on filters
  const currentPageCount = Math.min(currentPageSize, filteredCount - (currentPage - 1) * currentPageSize)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="dialog-content" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Download Report</DialogTitle>
          <DialogDescription>
            Configure and download your report in various formats. Select the data scope, format, and columns to include.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Format</Label>
            <RadioGroup value={format} onValueChange={(value) => setFormat(value as any)}>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="format-csv" />
                  <Label htmlFor="format-csv" className="cursor-pointer flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    CSV
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="format-excel" />
                  <Label htmlFor="format-excel" className="cursor-pointer flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="format-pdf" />
                  <Label htmlFor="format-pdf" className="cursor-pointer flex items-center gap-2">
                    <File className="h-4 w-4" />
                    PDF
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="word" id="format-word" />
                  <Label htmlFor="format-word" className="cursor-pointer flex items-center gap-2">
                    <FileType className="h-4 w-4" />
                    Word
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Data Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Data Scope</Label>
            <RadioGroup value={scope} onValueChange={(value) => setScope(value as any)}>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="current_page" id="scope-current" />
                  <Label htmlFor="scope-current" className="cursor-pointer">
                    Current Page ({currentPageCount} records)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all_filtered" id="scope-filtered" />
                  <Label htmlFor="scope-filtered" className="cursor-pointer">
                    All Filtered Results ({filteredCount} records) - Default
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom_limit" id="scope-custom" />
                  <Label htmlFor="scope-custom" className="cursor-pointer flex items-center gap-2">
                    Custom Limit
                    {scope === 'custom_limit' && (
                      <Input
                        type="number"
                        value={customLimit}
                        onChange={(e) => setCustomLimit(parseInt(e.target.value, 10) || 1000)}
                        className="w-24 h-8"
                        min={1}
                        max={100000}
                      />
                    )}
                  </Label>
                </div>
                {hasAdminPermission && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="all_filtered" id="scope-all" disabled />
                    <Label htmlFor="scope-all" className="cursor-not-allowed text-muted-foreground">
                      Full Dataset (Admin only - use "All Filtered" with no filters)
                    </Label>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Column Selection */}
          {availableColumns.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Columns</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllColumns}
                >
                  {selectedColumns.length === availableColumns.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
                {availableColumns.map((col) => (
                  <div key={col.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <Label htmlFor={`col-${col.key}`} className="cursor-pointer text-sm">
                      {col.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Shape */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Data Shape</Label>
            <Select value={dataShape} onValueChange={(value) => setDataShape(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">Raw Rows</SelectItem>
                <SelectItem value="grouped">Grouped</SelectItem>
                <SelectItem value="aggregated">Aggregated (Sum, Count, Avg)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleCreateJob} disabled={creating || selectedColumns.length === 0} className="w-full sm:w-auto">
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Create Export Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
