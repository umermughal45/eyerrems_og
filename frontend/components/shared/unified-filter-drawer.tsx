"use client"

import { useState, useEffect, useMemo } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Filter } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, Check } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  getFilterConfig,
  getFiltersByGroup,
  getGroupOrder,
  countActiveFilters,
  type FilterFieldConfig,
} from "@/lib/filter-config-registry"
import { SearchableSelect } from "@/components/common/searchable-select"
import { apiService } from "@/lib/api"
import { cn } from "@/lib/utils"

export type FilterState = Record<string, unknown>

export interface UnifiedFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: string
  tab?: string
  initialFilters?: FilterState
  onApply: (filters: FilterState) => void
}

function entitySelectSource(optionsSource: string): "dealers" | "properties" | "clients" | "employees" | "units" | "tenants" {
  const map: Record<string, "dealers" | "properties" | "clients" | "employees" | "units" | "tenants"> = {
    dealers: "dealers",
    properties: "properties",
    clients: "clients",
    employees: "employees",
    employee_departments: "employees",
    units: "units",
    tenants: "tenants",
  }
  return map[optionsSource] ?? "clients"
}

function SearchableMultiSelect({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const selected = new Set(value)
  const filtered = useMemo(() => {
    if (!q.trim()) return options
    const lower = q.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower))
  }, [options, q])
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9">
          <span className="truncate">{selected.size === 0 ? "All" : `${selected.size} selected`}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search…" value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>No match</CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => {
                const isSelected = selected.has(opt.value)
                return (
                  <CommandItem
                    key={opt.value}
                    onSelect={() => {
                      const next = new Set(selected)
                      if (isSelected) next.delete(opt.value)
                      else next.add(opt.value)
                      onChange(next.size ? Array.from(next) : [])
                    }}
                    className="cursor-pointer"
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {opt.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function FilterField({
  config,
  value,
  onChange,
  departments,
}: {
  config: FilterFieldConfig
  value: unknown
  onChange: (v: unknown) => void
  departments?: string[]
}) {
  // multi-checkbox: vertical checkbox list (Status, Priority) - no pills
  if (config.type === "multi-checkbox" && config.options?.length) {
    const selected = new Set(Array.isArray(value) ? value : value ? [String(value)] : [])
    const allValues = config.options.map((o) => o.value)
    const allSelected = allValues.every((v) => selected.has(v))
    const noneSelected = selected.size === 0
    return (
      <div className="space-y-2">
        <div className="flex gap-2 mb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange(allValues)}
          >
            Select All
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange(undefined)}
          >
            Clear
          </Button>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {config.options.map((opt) => (
            <div key={opt.value} className="flex items-center space-x-2">
              <Checkbox
                id={`${config.key}-${opt.value}`}
                checked={selected.has(opt.value)}
                onCheckedChange={(checked) => {
                  const next = new Set(selected)
                  if (checked) next.add(opt.value)
                  else next.delete(opt.value)
                  onChange(next.size ? Array.from(next) : undefined)
                }}
              />
              <Label htmlFor={`${config.key}-${opt.value}`} className="text-sm font-normal cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // multi-select: searchable dropdown for long lists (Source - 20+)
  if (config.type === "multi-select" && config.options?.length) {
    const selected = Array.isArray(value) ? value : value ? [String(value)] : []
    return (
      <SearchableMultiSelect
        options={config.options}
        value={selected}
        onChange={(v) => onChange(v.length ? v : undefined)}
      />
    )
  }

  if (config.type === "select" && config.options?.length) {
    const val = typeof value === "string" ? value : ""
    return (
      <select
        value={val}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
      >
        <option value="">All</option>
        {config.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }

  if (config.type === "text") {
    return (
      <Input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={config.placeholder}
        className="h-9"
      />
    )
  }

  if (config.type === "numeric-range") {
    const num = typeof value === "number" ? value : value ? parseFloat(String(value)) : undefined
    return (
      <Input
        type="number"
        value={num ?? ""}
        onChange={(e) => {
          const v = e.target.value ? parseFloat(e.target.value) : undefined
          onChange(v)
        }}
        placeholder={config.placeholder ?? "0"}
        className="h-9"
      />
    )
  }

  if (config.type === "entity-select" && config.options_source) {
    if (config.options_source === "employee_departments" && departments?.length) {
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">All</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      )
    }
    const source = entitySelectSource(config.options_source)
    return (
      <SearchableSelect
        source={source}
        value={(value as string) ?? null}
        onChange={(v) => onChange(v ?? undefined)}
        placeholder={`Select ${config.label}…`}
        allowEmpty
      />
    )
  }

  return null
}

export function UnifiedFilterDrawer({
  open,
  onOpenChange,
  entity,
  tab,
  initialFilters = {},
  onApply,
}: UnifiedFilterDrawerProps) {
  const config = getFilterConfig(entity, tab)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [departments, setDepartments] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setFilters(initialFilters)
    }
  }, [open, initialFilters])

  useEffect(() => {
    if (entity === "employees" && open) {
      apiService.employees.getAll().then((res: any) => {
        const data = res?.data?.data ?? res?.data ?? []
        const depts = Array.from(new Set((data as any[]).map((e: any) => e.department).filter(Boolean))).sort()
        setDepartments(depts)
      }).catch(() => setDepartments([]))
    }
  }, [entity, open])

  const handleApply = () => {
    const cleaned: FilterState = {}
    for (const [k, v] of Object.entries(filters)) {
      if (v === undefined || v === null || v === "") continue
      if (Array.isArray(v) && v.length === 0) continue
      cleaned[k] = v
    }
    onApply(cleaned)
    onOpenChange(false)
  }

  const handleClear = () => {
    setFilters({})
    onApply({})
    onOpenChange(false)
  }

  const updateFilter = (key: string, value: unknown) => {
    setFilters((prev) => {
      const next = { ...prev }
      if (value === undefined || value === null || value === "") {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  const activeCount = countActiveFilters(filters)

  if (!config) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[420px] max-w-[95vw] p-0 flex flex-col">
          <div className="flex flex-col flex-1 min-h-0 px-6 pt-6">
            <SheetHeader className="px-0">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <p className="text-sm text-muted-foreground mt-4">No filter config for {entity}.</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  const grouped = getFiltersByGroup(config)
  const groupOrder = getGroupOrder(config)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[420px] max-w-[95vw] p-0 flex flex-col gap-0"
      >
        {/* Header — Clear All right-aligned, Close via Sheet (pr-12 for close icon) */}
        <div className="shrink-0 px-6 pt-6 pb-4 pr-12 border-b">
          <div className="flex items-center justify-between gap-4">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
              <Filter className="h-5 w-5 text-muted-foreground" />
              Filters
              {activeCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({activeCount} active)
                </span>
              )}
            </SheetTitle>
            <Button variant="ghost" size="sm" onClick={handleClear} className="text-muted-foreground hover:text-foreground">
              Clear All
            </Button>
          </div>
        </div>

        {/* Body — inner content container, 24px padding, max-width centered */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[360px] mx-auto px-6 py-6 space-y-6">
            {groupOrder.map((groupName, idx) => {
              const fields = grouped[groupName]
              if (!fields?.length) return null
              const isPrimary = idx === 0 && groupName === "Status"
              return (
                <div key={groupName} className={idx > 0 ? "pt-4 border-t" : ""}>
                  <Collapsible defaultOpen>
                    <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-semibold hover:underline text-left">
                      <span className={isPrimary ? "text-foreground" : "text-muted-foreground"}>{groupName}</span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 pt-3">
                      {fields.map((f) => (
                        <div key={f.key} className="space-y-2">
                          <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
                          <FilterField
                            config={f}
                            value={filters[f.key]}
                            onChange={(v) => updateFilter(f.key, v)}
                            departments={f.options_source === "employee_departments" ? departments : undefined}
                          />
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sticky Footer — aligned with content, no edge touching */}
        <div className="shrink-0 border-t bg-background px-6 py-4">
          <div className="max-w-[360px] mx-auto flex flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
