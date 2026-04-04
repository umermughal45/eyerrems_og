"use client"

/**
 * SearchableSelectWrapper - A non-invasive wrapper component that adds search functionality
 * to existing dropdown/select components without modifying their internal logic.
 * 
 * This is an OPTIONAL enhancement layer. If not used, the system behaves exactly as before.
 * 
 * Usage:
 * ```tsx
 * import { SearchableSelectWrapper } from "@/components/common/searchable-select-wrapper"
 * import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
 * 
 * <SearchableSelectWrapper
 *   options={[
 *     { value: "1", label: "Option 1" },
 *     { value: "2", label: "Option 2" },
 *   ]}
 *   value={selectedValue}
 *   onValueChange={setSelectedValue}
 * >
 *   {(filteredOptions, searchInput) => (
 *     <Select value={selectedValue} onValueChange={setSelectedValue}>
 *       <SelectTrigger>
 *         <SelectValue placeholder="Select..." />
 *       </SelectTrigger>
 *       <SelectContent>
 *         {searchInput}
 *         {filteredOptions.map(option => (
 *           <SelectItem key={option.value} value={option.value}>
 *             {option.label}
 *           </SelectItem>
 *         ))}
 *       </SelectContent>
 *     </Select>
 *   )}
 * </SearchableSelectWrapper>
 * ```
 */

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type SearchableOption = {
  value: string
  label: string
  disabled?: boolean
}

export type SearchableSelectWrapperProps = {
  /**
   * Array of options to display in the dropdown
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
   * Render prop that receives filtered options and search input element
   * @param filteredOptions - Options filtered by search query
   * @param searchInput - Search input element to render inside SelectContent
   */
  children: (
    filteredOptions: SearchableOption[],
    searchInput: React.ReactNode
  ) => React.ReactNode
  
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
   * Custom className for search input
   */
  searchInputClassName?: string
  
  /**
   * Whether search is case-sensitive
   * @default false
   */
  caseSensitive?: boolean
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
    const normalizedLabel = caseSensitive ? option.label : option.label.toLowerCase()
    return normalizedLabel.includes(normalizedQuery)
  })
}

export function SearchableSelectWrapper({
  options,
  value,
  onValueChange,
  children,
  searchPlaceholder = "Search...",
  minOptionsForSearch = 5,
  searchInputClassName,
  caseSensitive = false,
}: SearchableSelectWrapperProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Filter options based on search query
  const filteredOptions = React.useMemo(
    () => filterOptions(options, searchQuery, caseSensitive),
    [options, searchQuery, caseSensitive]
  )
  
  // Determine if search should be shown
  const showSearch = options.length >= minOptionsForSearch
  
  // Create search input element
  const searchInput = showSearch ? (
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
            // Prevent Enter key from closing the dropdown
            if (e.key === "Enter") {
              e.stopPropagation()
            }
          }}
        />
      </div>
    </div>
  ) : null
  
  // Reset search when dropdown closes (value changes)
  React.useEffect(() => {
    if (value !== undefined) {
      // Small delay to allow the dropdown to close first
      const timer = setTimeout(() => {
        setSearchQuery("")
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [value])
  
  return <>{children(filteredOptions, searchInput)}</>
}
