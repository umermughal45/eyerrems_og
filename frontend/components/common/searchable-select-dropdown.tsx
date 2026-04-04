"use client"

/**
 * SearchableSelectDropdown - A drop-in replacement for Select components that adds
 * search functionality without modifying existing system logic.
 * 
 * This component accepts the same props as a standard Select + options array,
 * and renders a searchable dropdown that matches existing Select styling exactly.
 * 
 * This is an OPTIONAL enhancement. Existing Select components continue to work
 * exactly as before if this component is not used.
 * 
 * Usage Example (replacing existing Select):
 * 
 * Before:
 * ```tsx
 * <Select value={value} onValueChange={onChange}>
 *   <SelectTrigger>
 *     <SelectValue placeholder="Select..." />
 *   </SelectTrigger>
 *   <SelectContent>
 *     {options.map(opt => (
 *       <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
 *     ))}
 *   </SelectContent>
 * </Select>
 * ```
 * 
 * After (optional enhancement):
 * ```tsx
 * <SearchableSelectDropdown
 *   value={value}
 *   onValueChange={onChange}
 *   options={options.map(opt => ({ value: opt.id, label: opt.name }))}
 *   placeholder="Select..."
 * />
 * ```
 */

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SearchableOption = {
  value: string
  label: string | React.ReactNode
  disabled?: boolean
}

export type SearchableSelectDropdownProps = {
  /**
   * Array of options to display
   */
  options: SearchableOption[]
  
  /**
   * Currently selected value
   */
  value?: string
  
  /**
   * Callback when value changes
   */
  onValueChange?: (value: string) => void
  
  /**
   * Placeholder text for the trigger
   */
  placeholder?: string
  
  /**
   * Whether the select is disabled
   */
  disabled?: boolean
  
  /**
   * Placeholder text for search input
   * @default "Search..."
   */
  searchPlaceholder?: string
  
  /**
   * Minimum number of options before search is enabled
   * @default 5
   */
  minOptionsForSearch?: number
  
  /**
   * Custom className for the root container
   */
  className?: string
  
  /**
   * Custom className for SelectTrigger
   */
  triggerClassName?: string
  
  /**
   * Custom className for SelectContent
   */
  contentClassName?: string
  
  /**
   * Custom className for search input
   */
  searchInputClassName?: string
  
  /**
   * Whether search is case-sensitive
   * @default false
   */
  caseSensitive?: boolean
  
  /**
   * Empty state message when no options match search
   */
  emptyMessage?: string
  
  /**
   * Size variant for SelectTrigger
   */
  size?: "sm" | "default"
}

/**
 * Filters options based on search query (case-insensitive by default)
 */
function filterOptions(
  options: SearchableOption[],
  query: string,
  caseSensitive: boolean = false
): SearchableOption[] {
  if (!query.trim()) {
    return options
  }
  
  const normalizedQuery = caseSensitive ? query : query.toLowerCase()
  
  return options.filter((option) => {
    const label = typeof option.label === "string" ? option.label : String(option.label)
    const normalizedLabel = caseSensitive ? label : label.toLowerCase()
    return normalizedLabel.includes(normalizedQuery)
  })
}

export function SearchableSelectDropdown({
  options,
  value,
  onValueChange,
  placeholder,
  disabled,
  searchPlaceholder = "Search...",
  minOptionsForSearch = 5,
  className,
  triggerClassName,
  contentClassName,
  searchInputClassName,
  caseSensitive = false,
  emptyMessage,
  size = "default",
}: SearchableSelectDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Filter options based on search query
  const filteredOptions = React.useMemo(
    () => filterOptions(options, searchQuery, caseSensitive),
    [options, searchQuery, caseSensitive]
  )
  
  // Determine if search should be shown
  const showSearch = options.length >= minOptionsForSearch && open
  
  // Reset search when dropdown closes
  React.useEffect(() => {
    if (!open) {
      // Small delay to allow dropdown animation to complete
      const timer = setTimeout(() => {
        setSearchQuery("")
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [open])
  
  // Find selected option for display
  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  )
  
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      onValueChange?.(newValue)
      setOpen(false)
    },
    [onValueChange]
  )
  
  return (
    <div className={className}>
      <Select
        value={value}
        onValueChange={handleValueChange}
        disabled={disabled}
        open={open}
        onOpenChange={setOpen}
      >
        <SelectTrigger className={triggerClassName} size={size}>
          <SelectValue placeholder={placeholder}>
            {selectedOption && (
              <span className="truncate">
                {typeof selectedOption.label === "string"
                  ? selectedOption.label
                  : selectedOption.label}
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className={contentClassName}>
          {showSearch && (
            <div className="sticky top-0 z-10 border-b bg-popover px-2 py-1.5">
              <div className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "placeholder:text-muted-foreground flex h-8 w-full rounded-md border-0 bg-transparent px-0 py-0 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    searchInputClassName
                  )}
                  onClick={(e) => {
                    // Prevent click from closing the dropdown
                    e.stopPropagation()
                  }}
                  onKeyDown={(e) => {
                    // Prevent Enter/Escape from closing dropdown
                    if (e.key === "Enter" || e.key === "Escape") {
                      e.stopPropagation()
                    }
                    // Allow arrow keys to navigate
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.stopPropagation()
                    }
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {searchQuery
                ? emptyMessage || `No options found matching "${searchQuery}"`
                : emptyMessage || "No options available"}
            </div>
          ) : (
            filteredOptions.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
