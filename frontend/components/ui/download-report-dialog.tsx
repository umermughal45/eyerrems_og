"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Loader2, AlertCircle, Info, CheckSquare, Square } from "lucide-react"
import { apiService } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  type ExportFormat,
  type EntityColumnDefinition,
  getExportableColumns,
  getColumnsByGroup,
  hasExportableColumns,
  type ColumnGroup,
} from "@/lib/entity-column-registry"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type ExportScope = "VIEW" | "FILTERED" | "ALL"
export type DataShape = "raw" | "structured"

const GROUP_LABELS: Record<ColumnGroup, string> = {
  Basic: "Basic Information",
  Contact: "Contact Information",
  Financial: "Financial",
  Status: "Status & Lifecycle",
  Relationships: "Relationships",
  System: "System & Metadata",
  Metadata: "Metadata",
}

const FORMAT_DESCRIPTIONS: Record<ExportFormat, string> = {
  csv: "Raw, flat data. All columns supported.",
  excel: "Raw, flat data. All columns supported.",
  pdf: "Layout-safe columns only. Grouped and readable. Internal IDs hidden.",
  word: "Layout-safe columns only. Grouped and readable. Internal IDs hidden.",
}

const MODULE_TO_ENTITY: Record<string, string> = {
  leads: "lead",
  clients: "client",
  dealers: "dealer",
  deals: "deal",
  employees: "employee",
  vouchers: "voucher",
  properties: "property",
  units: "unit",
  tenants: "tenant",
  leases: "lease",
  sales: "sale",
  buyers: "buyer",
  sellers: "seller",
  transactions: "transaction",
  invoices: "invoice",
  payments: "payment",
  commissions: "commission",
};

export interface DownloadReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Entity name (e.g., "lead", "client", "voucher") - preferred */
  entity?: string
  /** Module name (e.g., "leads", "clients", "vouchers") - legacy, maps to entity */
  module?: string
  /** Display name for entity */
  entityDisplayName?: string
  /** Active filters from UI */
  filters?: Record<string, any>
  /** Search query */
  search?: string
  /** Sort configuration */
  sort?: { field: string; direction: "asc" | "desc" }
  /** Pagination (for VIEW scope) */
  pagination?: { page: number; pageSize: number }
  /** User roles for column visibility */
  userRoles?: string[]
  /** Admin permission for ALL scope */
  hasAdminPermission?: boolean
}

const STORAGE_KEY_PREFIX = "export-columns-"

function loadColumnSelection(entity: string, format: ExportFormat): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const key = `${STORAGE_KEY_PREFIX}${entity}-${format}`
    const stored = localStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored)
      return new Set(Array.isArray(parsed) ? parsed : [])
    }
  } catch {
    // Ignore parse errors
  }
  return new Set()
}

function saveColumnSelection(entity: string, format: ExportFormat, selected: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    const key = `${STORAGE_KEY_PREFIX}${entity}-${format}`
    localStorage.setItem(key, JSON.stringify(Array.from(selected)))
  } catch {
    // Ignore storage errors
  }
}

export function DownloadReportDialog({
  open,
  onOpenChange,
  entity: entityProp,
  module: moduleProp,
  entityDisplayName,
  filters = {},
  search,
  sort,
  pagination,
  userRoles = [],
  hasAdminPermission = false,
}: DownloadReportDialogProps) {
  const { toast } = useToast()
  const [format, setFormat] = useState<ExportFormat>("excel")
  const [scope, setScope] = useState<ExportScope>("FILTERED")
  const [dataShape, setDataShape] = useState<DataShape>("raw")
  const [downloading, setDownloading] = useState(false)
  const [recordCount, setRecordCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)

  // Resolve entity name (entity prop preferred, fallback to module mapping)
  const entity = useMemo(() => {
    if (entityProp) return entityProp;
    if (moduleProp) return MODULE_TO_ENTITY[moduleProp] || moduleProp;
    return "";
  }, [entityProp, moduleProp]);

  const availableColumns = useMemo(
    () => (entity ? getExportableColumns(entity, format, userRoles) : []),
    [entity, format, userRoles],
  )

  const groupedColumns = useMemo(
    () => (entity ? getColumnsByGroup(entity, format, userRoles) : {} as Record<ColumnGroup, EntityColumnDefinition[]>),
    [entity, format, userRoles],
  )

  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set())

  // Sync column selection when dialog opens or entity/format changes (stable deps to avoid React #185 loop)
  useEffect(() => {
    if (!open || !entity) return
    const cols = getExportableColumns(entity, format, userRoles)
    if (cols.length === 0) return
    const stored = loadColumnSelection(entity, format)
    const valid = Array.from(stored).filter((k) => cols.some((c) => c.key === k))
    if (valid.length > 0) {
      setSelectedColumns(new Set(valid))
    } else {
      setSelectedColumns(new Set(cols.filter((c) => c.default_visible).map((c) => c.key)))
    }
  }, [open, entity, format])

  // Persist column selection when it changes (no setState here to avoid loop)
  useEffect(() => {
    if (!open || !entity || selectedColumns.size === 0) return
    saveColumnSelection(entity, format, selectedColumns)
  }, [entity, format, selectedColumns, open])

  useEffect(() => {
    if (!open || scope === "VIEW" || !entity) {
      setRecordCount(null)
      return
    }
    let cancelled = false
    setLoadingCount(true)
    const moduleName = moduleProp || Object.entries(MODULE_TO_ENTITY).find(([_, e]) => e === entity)?.[0] || entity
    const params = new URLSearchParams()
    params.append("scope", scope)
    if (filters && Object.keys(filters).length > 0) {
      params.append("filters", JSON.stringify(filters))
    }
    if (search) params.append("search", search)
    apiService
      .get(`/export/${moduleName}/count?${params.toString()}`)
      .then((res: any) => {
        if (!cancelled) setRecordCount(res?.data?.count ?? null)
      })
      .catch(() => {
        if (!cancelled) setRecordCount(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingCount(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, entity, moduleProp, scope, filters, search])

  const toggleColumn = (key: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const toggleGroup = (group: ColumnGroup) => {
    const groupCols = groupedColumns[group] || []
    const allSelected = groupCols.every((c) => selectedColumns.has(c.key))
    setSelectedColumns((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        groupCols.forEach((c) => next.delete(c.key))
      } else {
        groupCols.forEach((c) => next.add(c.key))
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedColumns(new Set(availableColumns.map((c) => c.key)))
  }

  const deselectAll = () => {
    setSelectedColumns(new Set())
  }

  const canDownload = availableColumns.length > 0 && selectedColumns.size > 0 && !downloading

  const handleDownload = async () => {
    if (!canDownload) return

    try {
      setDownloading(true)

      // Map entity back to module for backend compatibility
      const moduleName = moduleProp || (entityProp ? Object.entries(MODULE_TO_ENTITY).find(([_, e]) => e === entityProp)?.[0] : entity);
      
      const payload = {
        entity,
        module: moduleName, // Backend accepts both
        format,
        scope,
        dataShape: format === "pdf" || format === "word" ? "structured" : dataShape,
        filters,
        search,
        sort,
        columns: Array.from(selectedColumns),
        ...(scope === "VIEW" && pagination ? { pagination } : {}),
      }

      const response = await apiService.post("/export", payload, {
        responseType: "blob",
      })

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "application/octet-stream",
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url

      const contentDisposition = response.headers["content-disposition"]
      let filename = `${entity}-${new Date().toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : format === "word" ? "docx" : format}`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/i)
        if (match) filename = match[1]
      }

      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export started",
        description: `Downloading ${entityDisplayName || entity} report...`,
      })

      onOpenChange(false)
    } catch (error: any) {
      console.error("Export error:", error)
      toast({
        title: "Export failed",
        description: error?.response?.data?.error || error?.message || "Failed to export report",
        variant: "destructive",
      })
    } finally {
      setDownloading(false)
    }
  }

  const formatInfo = FORMAT_DESCRIPTIONS[format]
  const hasFilters = filters && Object.keys(filters).length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[1000px] max-w-[95vw] sm:max-w-[90vw] lg:max-w-[1000px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Download Report</DialogTitle>
          <DialogDescription>
            Export {entityDisplayName || entity} data with selected columns and filters.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Format *</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(["csv", "excel", "pdf", "word"] as ExportFormat[]).map((f) => (
                  <div key={f} className="flex items-center space-x-2">
                    <RadioGroupItem value={f} id={`format-${f}`} />
                    <Label htmlFor={`format-${f}`} className="cursor-pointer capitalize">
                      {f === "excel" ? "Excel" : f.toUpperCase()}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{formatInfo}</span>
            </div>
          </div>

          {/* Data Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Data Scope *</Label>
            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ExportScope)}>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="VIEW" id="scope-view" />
                  <Label htmlFor="scope-view" className="cursor-pointer">
                    Current Page ({pagination?.pageSize || 25} records)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="FILTERED" id="scope-filtered" />
                  <Label htmlFor="scope-filtered" className="cursor-pointer">
                    All Filtered Results
                    {loadingCount ? (
                      <span className="ml-2 text-xs text-muted-foreground">(calculating...)</span>
                    ) : recordCount != null ? (
                      <span className="ml-2 text-xs font-semibold">({recordCount.toLocaleString()} records)</span>
                    ) : null}
                  </Label>
                </div>
                {hasAdminPermission && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ALL" id="scope-all" />
                    <Label htmlFor="scope-all" className="cursor-pointer">
                      Full Dataset (Admin only)
                    </Label>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Columns *</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-7 text-xs"
                >
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="h-7 text-xs"
                >
                  <Square className="h-3 w-3 mr-1" />
                  Deselect All
                </Button>
              </div>
            </div>

            {!entity ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Entity not specified. Please provide entity or module prop.
                </AlertDescription>
              </Alert>
            ) : availableColumns.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No exportable columns configured for this module. Try a different format or contact support.
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-4">
                  {(Object.keys(groupedColumns) as ColumnGroup[]).map((group) => {
                    const cols = groupedColumns[group]
                    if (!cols || cols.length === 0) return null
                    const allSelected = cols.every((c) => selectedColumns.has(c.key))
                    const someSelected = cols.some((c) => selectedColumns.has(c.key))
                    return (
                      <div key={group} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleGroup(group)}
                            className="flex items-center gap-2 text-sm font-semibold hover:text-primary"
                          >
                            {allSelected ? (
                              <CheckSquare className="h-4 w-4" />
                            ) : someSelected ? (
                              <div className="h-4 w-4 border-2 border-primary rounded" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                            {GROUP_LABELS[group]} ({cols.length})
                          </button>
                        </div>
                        <div className="space-y-1.5 pl-6">
                          {cols.map((col) => {
                            const isSelected = selectedColumns.has(col.key)
                            const isDisabled = !col.formats.includes(format)
                            return (
                              <div
                                key={col.key}
                                className={cn(
                                  "flex items-center space-x-2 py-1",
                                  isDisabled && "opacity-50",
                                )}
                              >
                                <Checkbox
                                  id={`col-${col.key}`}
                                  checked={isSelected}
                                  onCheckedChange={() => !isDisabled && toggleColumn(col.key)}
                                  disabled={isDisabled}
                                />
                                <Label
                                  htmlFor={`col-${col.key}`}
                                  className={cn(
                                    "text-sm cursor-pointer flex-1",
                                    isDisabled && "cursor-not-allowed",
                                  )}
                                >
                                  {col.label}
                                </Label>
                                {isDisabled && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Not available in {format.toUpperCase()} format</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                                {col.description && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{col.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        <Separator />
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}

            {selectedColumns.size === 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Select at least one column to export.</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Preview */}
          {(hasFilters || search) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Active filters will be applied:</p>
                  {hasFilters && <p className="text-xs">• Advanced filters: {Object.keys(filters).length} filter(s)</p>}
                  {search && <p className="text-xs">• Search: "{search}"</p>}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Cancel
          </Button>
          <Button onClick={handleDownload} disabled={!canDownload}>
            {downloading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download ({selectedColumns.size} columns)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
