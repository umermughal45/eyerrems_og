"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar, X, Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FilterPayload } from "@/lib/filter-types"

export interface AdvancedFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (filters: FilterPayload) => void
  module: string
  availableStatuses?: string[]
  availablePriorities?: string[]
  availableDateFields?: Array<{ value: string; label: string }>
  availableDepartments?: string[]
  initialFilters?: FilterPayload
}

export function AdvancedFilterDialog({
  open,
  onOpenChange,
  onApply,
  module,
  availableStatuses = [],
  availablePriorities = [],
  availableDateFields = [
    { value: 'createdAt', label: 'Created Date' },
    { value: 'updatedAt', label: 'Updated Date' },
  ],
  availableDepartments = [],
  initialFilters = {},
}: AdvancedFilterDialogProps) {
  const [filters, setFilters] = useState<FilterPayload>(initialFilters)

  // Reset to initial filters when dialog opens
  useEffect(() => {
    if (open) {
      setFilters(initialFilters)
    }
  }, [open, initialFilters])

  const handleApply = () => {
    onApply(filters)
    onOpenChange(false)
  }

  const handleClear = () => {
    setFilters({})
    onApply({})
    onOpenChange(false)
  }

  const activeFilterCount = Object.keys(filters).filter(
    key => {
      const value = filters[key]
      if (Array.isArray(value)) return value.length > 0
      if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0
      return value !== undefined && value !== null && value !== ''
    }
  ).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="dialog-content" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Apply advanced filters to refine your search results. Use multiple filters to narrow down the data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Identity Filters */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Identity</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="systemId" className="text-xs">System ID / TID</Label>
                <Input
                  id="systemId"
                  placeholder="Enter ID or TID"
                  value={filters.tid || filters.systemId || ''}
                  onChange={(e) => setFilters({ ...filters, tid: e.target.value || undefined, systemId: e.target.value || undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codes" className="text-xs">Codes (comma-separated)</Label>
                <Input
                  id="codes"
                  placeholder="Code1, Code2..."
                  value={filters.codes?.join(', ') || ''}
                  onChange={(e) => {
                    const codes = e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    setFilters({ ...filters, codes: codes.length > 0 ? codes : undefined })
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status & Lifecycle Filters */}
          {(availableStatuses.length > 0 || availablePriorities.length > 0) && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Status & Lifecycle</Label>
              {availableStatuses.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Status (multi-select)</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableStatuses.map((status) => {
                      const isSelected = filters.status?.includes(status)
                      return (
                        <Button
                          key={status}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const current = filters.status || []
                            setFilters({
                              ...filters,
                              status: isSelected
                                ? current.filter(s => s !== status)
                                : [...current, status],
                            })
                          }}
                        >
                          {status}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}
              {availablePriorities.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Priority (multi-select)</Label>
                  <div className="flex flex-wrap gap-2">
                    {availablePriorities.map((priority) => {
                      const isSelected = filters.priority?.includes(priority)
                      return (
                        <Button
                          key={priority}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const current = filters.priority || []
                            setFilters({
                              ...filters,
                              priority: isSelected
                                ? current.filter(p => p !== priority)
                                : [...current, priority],
                            })
                          }}
                        >
                          {priority}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date Filters (CRITICAL) */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Date Range</Label>
            <div className="space-y-2">
              <Label htmlFor="dateField" className="text-xs">Date Field *</Label>
              <Select
                value={filters.dateField || ''}
                onValueChange={(value) => setFilters({ ...filters, dateField: value || undefined })}
              >
                <SelectTrigger id="dateField">
                  <SelectValue placeholder="Select date field" />
                </SelectTrigger>
                <SelectContent>
                  {availableDateFields.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filters.dateField && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Preset or Custom</Label>
                  <Select
                    value={filters.datePreset || 'custom'}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setFilters({ ...filters, datePreset: 'custom' })
                      } else {
                        setFilters({
                          ...filters,
                          datePreset: value as any,
                          dateFrom: undefined,
                          dateTo: undefined,
                        })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="lastMonth">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(!filters.datePreset || filters.datePreset === 'custom') && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dateFrom" className="text-xs">From Date</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={filters.dateFrom || ''}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateTo" className="text-xs">To Date</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={filters.dateTo || ''}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value || undefined })}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ownership & Responsibility */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Ownership & Responsibility</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {availableDepartments.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-xs">Department</Label>
                  <Select
                    value={filters.department || ''}
                    onValueChange={(value) => setFilters({ ...filters, department: value || undefined })}
                  >
                    <SelectTrigger id="department">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Departments</SelectItem>
                      {availableDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Numeric / Financial Filters */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Amount Range</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amountMin" className="text-xs">Min Amount</Label>
                <Input
                  id="amountMin"
                  type="number"
                  placeholder="0"
                  value={filters.amount?.min || ''}
                  onChange={(e) => {
                    const min = e.target.value ? parseFloat(e.target.value) : undefined
                    setFilters({
                      ...filters,
                      amount: {
                        ...filters.amount,
                        min,
                      },
                    })
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountMax" className="text-xs">Max Amount</Label>
                <Input
                  id="amountMax"
                  type="number"
                  placeholder="No limit"
                  value={filters.amount?.max || ''}
                  onChange={(e) => {
                    const max = e.target.value ? parseFloat(e.target.value) : undefined
                    setFilters({
                      ...filters,
                      amount: {
                        ...filters.amount,
                        max,
                      },
                    })
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClear}>
            Clear All
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
