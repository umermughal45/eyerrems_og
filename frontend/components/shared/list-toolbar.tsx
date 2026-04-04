"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Filter, Download } from "lucide-react"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface ListToolbarProps {
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  onFilterClick: () => void
  activeFilterCount?: number
  onDownloadClick?: () => void
  /** When true, Download Report button is hidden (e.g. entity has no exportable columns) */
  showDownload?: boolean
  primaryAction?: ReactNode
  extraActions?: ReactNode
  className?: string
}

/**
 * Standard list toolbar: [ Search ] [ Filter ] [ Download Report ] [ Primary Action ]
 * Single filter entry point. No inline status buttons or dropdowns.
 */
export function ListToolbar({
  searchPlaceholder = "Search…",
  searchValue,
  onSearchChange,
  onFilterClick,
  activeFilterCount = 0,
  onDownloadClick,
  showDownload = true,
  primaryAction,
  extraActions,
  className,
}: ListToolbarProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={onFilterClick}>
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
        {showDownload && onDownloadClick && (
          <Button variant="outline" onClick={onDownloadClick}>
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        )}
        {extraActions}
        {primaryAction}
      </div>
    </div>
  )
}
