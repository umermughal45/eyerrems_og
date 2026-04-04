"use client"

import { useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getTableColumns,
  getCellValue,
  formatColumnValue,
  type EntityColumnDefinition,
} from "@/lib/entity-column-registry"
import { Loader2 } from "lucide-react"

export interface DataTableFromRegistryProps<T = any> {
  /** Entity key (e.g. "property", "lead", "unit") */
  entity: string
  /** Data rows */
  data: T[]
  /** Loading state */
  loading?: boolean
  /** Error message */
  error?: string | null
  /** Click handler for row */
  onRowClick?: (row: T) => void
  /** Custom cell renderer (overrides default format) */
  renderCell?: (col: EntityColumnDefinition, value: any, row: T) => React.ReactNode
  /** Actions column content */
  renderActions: (row: T) => React.ReactNode
  /** Empty state message */
  emptyMessage?: string
  /** Additional class for table container */
  className?: string
  /** colSpan for loading/error/empty rows */
  colSpan?: number
}

export function DataTableFromRegistry<T = any>({
  entity,
  data,
  loading = false,
  error,
  onRowClick,
  renderCell,
  renderActions,
  emptyMessage = "No data found",
  className,
}: DataTableFromRegistryProps<T>) {
  const columns = useMemo(() => getTableColumns(entity), [entity])
  const colSpan = columns.length

  const renderCellContent = (col: EntityColumnDefinition, row: T) => {
    if (col.is_action) {
      return renderActions(row)
    }
    const value = getCellValue(col, row)
    if (renderCell) {
      const custom = renderCell(col, value, row)
      if (custom !== undefined) return custom
    }
    const formatted = formatColumnValue(col, value, row)
    return formatted !== "" ? formatted : "—"
  }

  if (!columns.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No columns configured for {entity}
      </div>
    )
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={col.is_action ? "text-right" : ""}
              style={col.width ? { width: col.width, minWidth: col.width } : undefined}
            >
              {col.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center py-12">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </TableCell>
          </TableRow>
        ) : error ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center py-12 text-destructive">
              {error}
            </TableCell>
          </TableRow>
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center py-12 text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          data.map((row: any, idx) => (
            <TableRow
              key={row.id ?? idx}
              className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={col.is_action ? "text-right" : ""}
                  onClick={col.is_action ? (e) => e.stopPropagation() : undefined}
                >
                  {renderCellContent(col, row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
