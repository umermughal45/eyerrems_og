"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

/**
 * Global Filter Payload (matches backend schema)
 */
export interface GlobalFilterPayload {
  identity: {
    system_ids: string[]
    reference_codes: string[]
    tids: string[]
  }
  status: string[]
  lifecycle: string[]
  priority: string[]
  stage: string[]
  ownership: {
    assigned_users: string[]
    teams: string[]
    departments: string[]
    dealers: string[]
    agents: string[]
    created_by: string[]
    approved_by: string[]
  }
  date?: {
    field?: 'created_at' | 'updated_at' | 'approved_at' | 'posted_at' | 'date' | 'follow_up_date' | 'expected_close_date' | 'deal_date' | 'join_date'
    from?: string | null
    to?: string | null
    preset?: 'today' | 'last_7_days' | 'month_to_date' | 'quarter' | 'last_month' | 'this_year' | 'custom'
  }
  numeric_ranges?: {
    amount_min?: number | null
    amount_max?: number | null
    balance_min?: number | null
    balance_max?: number | null
  }
  relationships: {
    has_related: Array<{ type: string; id: string }>
    missing_related: string[]
  }
  pagination: {
    page: number
    limit: number
  }
  sorting: {
    field: string
    direction: 'asc' | 'desc'
  }
  search?: string
}

export interface GlobalFilterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (filters: GlobalFilterPayload) => void
  module: string
  tab?: string
  availableStatuses?: string[]
  availablePriorities?: string[]
  availableStages?: string[]
  availableLifecycles?: string[]
  availableDateFields?: Array<{ value: string; label: string }>
  availableDepartments?: string[]
  initialFilters?: Partial<GlobalFilterPayload>
}

export function GlobalFilterDialog({
  open,
  onOpenChange,
  onApply,
  module,
  tab,
  availableStatuses = [],
  availablePriorities = [],
  availableStages = [],
  availableLifecycles = [],
  availableDateFields = [
    { value: 'created_at', label: 'Created Date' },
    { value: 'updated_at', label: 'Updated Date' },
  ],
  availableDepartments = [],
  initialFilters = {},
}: GlobalFilterDialogProps) {
  const [filters, setFilters] = useState<GlobalFilterPayload>({
    identity: { system_ids: [], reference_codes: [], tids: [] },
    status: [],
    lifecycle: [],
    priority: [],
    stage: [],
    ownership: {
      assigned_users: [],
      teams: [],
      departments: [],
      dealers: [],
      agents: [],
      created_by: [],
      approved_by: [],
    },
    relationships: { has_related: [], missing_related: [] },
    pagination: { page: 1, limit: 25 },
    sorting: { field: 'created_at', direction: 'desc' },
    ...initialFilters,
  })

  useEffect(() => {
    if (open) {
      setFilters({
        identity: { system_ids: [], reference_codes: [], tids: [] },
        status: [],
        lifecycle: [],
        priority: [],
        stage: [],
        ownership: {
          assigned_users: [],
          teams: [],
          departments: [],
          dealers: [],
          agents: [],
          created_by: [],
          approved_by: [],
        },
        relationships: { has_related: [], missing_related: [] },
        pagination: { page: 1, limit: 25 },
        sorting: { field: 'created_at', direction: 'desc' },
        ...initialFilters,
      })
    }
  }, [open, initialFilters])

  const handleApply = () => {
    onApply(filters)
    onOpenChange(false)
  }

  const handleClear = () => {
    setFilters({
      identity: { system_ids: [], reference_codes: [], tids: [] },
      status: [],
      lifecycle: [],
      priority: [],
      stage: [],
      ownership: {
        assigned_users: [],
        teams: [],
        departments: [],
        dealers: [],
        agents: [],
        created_by: [],
        approved_by: [],
      },
      relationships: { has_related: [], missing_related: [] },
      pagination: { page: 1, limit: 25 },
      sorting: { field: 'created_at', direction: 'desc' },
    })
    onApply({
      identity: { system_ids: [], reference_codes: [], tids: [] },
      status: [],
      lifecycle: [],
      priority: [],
      stage: [],
      ownership: {
        assigned_users: [],
        teams: [],
        departments: [],
        dealers: [],
        agents: [],
        created_by: [],
        approved_by: [],
      },
      relationships: { has_related: [], missing_related: [] },
      pagination: { page: 1, limit: 25 },
      sorting: { field: 'created_at', direction: 'desc' },
    })
    onOpenChange(false)
  }

  const activeFilterCount = [
    ...filters.identity.system_ids,
    ...filters.identity.reference_codes,
    ...filters.identity.tids,
    ...filters.status,
    ...filters.lifecycle,
    ...filters.priority,
    ...filters.stage,
    ...filters.ownership.assigned_users,
    ...filters.ownership.departments,
    filters.date?.field ? 1 : 0,
    filters.numeric_ranges?.amount_min !== undefined ? 1 : 0,
    filters.numeric_ranges?.amount_max !== undefined ? 1 : 0,
  ].filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-slot="dialog-content" className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                <Label htmlFor="systemIds" className="text-xs">System IDs / TIDs (comma-separated)</Label>
                <Input
                  id="systemIds"
                  placeholder="ID1, ID2..."
                  value={[...filters.identity.system_ids, ...filters.identity.tids].join(', ')}
                  onChange={(e) => {
                    const values = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                    setFilters({
                      ...filters,
                      identity: {
                        ...filters.identity,
                        system_ids: values,
                        tids: values,
                      },
                    })
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="referenceCodes" className="text-xs">Reference Codes (comma-separated)</Label>
                <Input
                  id="referenceCodes"
                  placeholder="Code1, Code2..."
                  value={filters.identity.reference_codes.join(', ')}
                  onChange={(e) => {
                    const codes = e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    setFilters({
                      ...filters,
                      identity: {
                        ...filters.identity,
                        reference_codes: codes,
                      },
                    })
                  }}
                />
              </div>
            </div>
          </div>

          {/* Status & Lifecycle Filters */}
          {(availableStatuses.length > 0 || availablePriorities.length > 0 || availableStages.length > 0 || availableLifecycles.length > 0) && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Status & Lifecycle</Label>
              {availableStatuses.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Status (multi-select)</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableStatuses.map((status) => {
                      const isSelected = filters.status.includes(status)
                      return (
                        <Button
                          key={status}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFilters({
                              ...filters,
                              status: isSelected
                                ? filters.status.filter(s => s !== status)
                                : [...filters.status, status],
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
                      const isSelected = filters.priority.includes(priority)
                      return (
                        <Button
                          key={priority}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFilters({
                              ...filters,
                              priority: isSelected
                                ? filters.priority.filter(p => p !== priority)
                                : [...filters.priority, priority],
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
              {availableStages.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Stage (multi-select)</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableStages.map((stage) => {
                      const isSelected = filters.stage.includes(stage)
                      return (
                        <Button
                          key={stage}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFilters({
                              ...filters,
                              stage: isSelected
                                ? filters.stage.filter(s => s !== stage)
                                : [...filters.stage, stage],
                            })
                          }}
                        >
                          {stage}
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
                value={filters.date?.field || ''}
                onValueChange={(value) => {
                  setFilters({
                    ...filters,
                    date: {
                      ...filters.date,
                      field: value as any,
                    },
                  })
                }}
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
            {filters.date?.field && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Preset or Custom</Label>
                  <Select
                    value={filters.date.preset || 'custom'}
                    onValueChange={(value) => {
                      if (value === 'custom') {
                        setFilters({
                          ...filters,
                          date: {
                            ...filters.date,
                            preset: undefined,
                          },
                        })
                      } else {
                        setFilters({
                          ...filters,
                          date: {
                            ...filters.date,
                            preset: value as any,
                            from: null,
                            to: null,
                          },
                        })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                      <SelectItem value="month_to_date">Month to Date</SelectItem>
                      <SelectItem value="quarter">This Quarter</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(!filters.date.preset || filters.date.preset === 'custom') && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="dateFrom" className="text-xs">From Date</Label>
                      <Input
                        id="dateFrom"
                        type="date"
                        value={filters.date.from || ''}
                        onChange={(e) => {
                          setFilters({
                            ...filters,
                            date: {
                              ...filters.date,
                              from: e.target.value || null,
                            },
                          })
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dateTo" className="text-xs">To Date</Label>
                      <Input
                        id="dateTo"
                        type="date"
                        value={filters.date.to || ''}
                        onChange={(e) => {
                          setFilters({
                            ...filters,
                            date: {
                              ...filters.date,
                              to: e.target.value || null,
                            },
                          })
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ownership & Responsibility */}
          {availableDepartments.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Ownership & Responsibility</Label>
              <div className="space-y-2">
                <Label htmlFor="department" className="text-xs">Department</Label>
                <Select
                  value={filters.ownership.departments[0] || ''}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      ownership: {
                        ...filters.ownership,
                        departments: value ? [value] : [],
                      },
                    })
                  }}
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
            </div>
          )}

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
                  value={filters.numeric_ranges?.amount_min || ''}
                  onChange={(e) => {
                    const min = e.target.value ? parseFloat(e.target.value) : null
                    setFilters({
                      ...filters,
                      numeric_ranges: {
                        ...filters.numeric_ranges,
                        amount_min: min,
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
                  value={filters.numeric_ranges?.amount_max || ''}
                  onChange={(e) => {
                    const max = e.target.value ? parseFloat(e.target.value) : null
                    setFilters({
                      ...filters,
                      numeric_ranges: {
                        ...filters.numeric_ranges,
                        amount_max: max,
                      },
                    })
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
            Clear All
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleApply} className="w-full sm:w-auto">
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
