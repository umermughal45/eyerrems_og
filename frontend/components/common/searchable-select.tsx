"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import {
  SearchableOption,
  SearchableDataSource,
  useSearchableOptions,
} from "@/hooks/use-searchable-options"

export type SearchableSelectProps = {
  source: SearchableDataSource
  value?: string | null
  onChange: (value: string | null) => void
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
  filters?: Record<string, any>
  preload?: boolean
  className?: string
  error?: boolean
  transform?: (item: any) => SearchableOption
  limit?: number
}

export function SearchableSelect({
  source,
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  allowEmpty = true,
  emptyLabel = "None",
  filters = {},
  preload = false,
  className,
  error,
  transform,
  limit = 50,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const { options, isLoading } = useSearchableOptions({
    source,
    searchQuery,
    enabled: open, // Only fetch when dropdown is open
    limit,
    filters,
    transform,
    preload,
  })

  const selectedOption = React.useMemo(
    () => options.find((opt: SearchableOption) => opt.value === value),
    [options, value],
  )

  const handleSelect = React.useCallback(
    (selectedValue: string) => {
      if (selectedValue === "__empty__") {
        onChange(null)
      } else {
        onChange(selectedValue)
      }
      setOpen(false)
      setSearchQuery("") // Reset search on select
    },
    [onChange],
  )

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-xs font-semibold text-muted-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between",
              error && "border-destructive",
              !selectedOption && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {selectedOption ? (
                <span className="flex items-center gap-2">
                  <span>{selectedOption.label}</span>
                  {selectedOption.subtitle && (
                    <span className="text-xs text-muted-foreground">{selectedOption.subtitle}</span>
                  )}
                </span>
              ) : (
                placeholder || `Select ${label || source}...`
              )}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Search ${label || source}...`}
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                </div>
              ) : (
                <>
                  {allowEmpty && (
                    <CommandGroup>
                      <CommandItem
                        value="__empty__"
                        onSelect={() => handleSelect("__empty__")}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === null ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {emptyLabel}
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup>
                    {options.length === 0 ? (
                      <CommandEmpty>
                        {searchQuery
                          ? `No ${label || source} found matching "${searchQuery}"`
                          : `No ${label || source} available`}
                      </CommandEmpty>
                    ) : (
                      options.map((option: SearchableOption) => (
                        <CommandItem
                          key={option.id}
                          value={option.value}
                          disabled={option.disabled}
                          onSelect={() => handleSelect(option.value)}
                          className={cn(
                            "cursor-pointer",
                            option.disabled && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === option.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            {option.subtitle && (
                              <span className="text-xs text-muted-foreground">
                                {option.subtitle}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))
                    )}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
