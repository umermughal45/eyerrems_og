/**
 * Example Usage: Searchable Dropdown Wrapper
 * 
 * This file demonstrates how to use the searchable dropdown wrapper components
 * WITHOUT modifying existing system components.
 * 
 * IMPORTANT: This is an example file. Do NOT modify existing components.
 * Create new components that use these wrappers instead.
 */

"use client"

import * as React from "react"
import { SearchableSelectDropdown } from "./searchable-select-dropdown"
import { SearchableSelectWrapper } from "./searchable-select-wrapper"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

// Example 1: Simple replacement pattern
export function ExampleSimpleReplacement() {
  const [category, setCategory] = React.useState<string>("")

  // Simulated data - in real usage, this would come from props or API
  const categories = [
    { id: "1", name: "Residential" },
    { id: "2", name: "Commercial" },
    { id: "3", name: "Industrial" },
    { id: "4", name: "Land" },
    { id: "5", name: "Mixed Use" },
    { id: "6", name: "Agricultural" },
    { id: "7", name: "Special Purpose" },
  ]

  return (
    <div className="space-y-2">
      <Label>Property Category</Label>
      <SearchableSelectDropdown
        value={category}
        onValueChange={setCategory}
        options={categories.map((cat) => ({
          value: cat.id,
          label: cat.name,
        }))}
        placeholder="Select category"
        minOptionsForSearch={3}
      />
    </div>
  )
}

// Example 2: With complex labels
export function ExampleComplexLabels() {
  const [account, setAccount] = React.useState<string>("")

  const accounts = [
    { id: "1", code: "1001", name: "Cash", type: "Asset" },
    { id: "2", code: "2001", name: "Accounts Payable", type: "Liability" },
    { id: "3", code: "3001", name: "Revenue", type: "Income" },
    { id: "4", code: "4001", name: "Expenses", type: "Expense" },
  ]

  return (
    <div className="space-y-2">
      <Label>Account</Label>
      <SearchableSelectDropdown
        value={account}
        onValueChange={setAccount}
        options={accounts.map((acc) => ({
          value: acc.id,
          label: (
            <span>
              {acc.code} — {acc.name}{" "}
              <span className="text-xs text-muted-foreground">
                ({acc.type})
              </span>
            </span>
          ),
        }))}
        placeholder="Select account"
      />
    </div>
  )
}

// Example 3: Using the wrapper pattern for more control
export function ExampleWrapperPattern() {
  const [status, setStatus] = React.useState<string>("")

  const statuses = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "pending", label: "Pending" },
    { value: "suspended", label: "Suspended" },
    { value: "archived", label: "Archived" },
  ]

  return (
    <div className="space-y-2">
      <Label>Status</Label>
      <SearchableSelectWrapper
        options={statuses}
        value={status}
        onValueChange={setStatus}
        minOptionsForSearch={3}
      >
        {(filteredOptions, searchInput) => (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {searchInput}
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No options found
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
        )}
      </SearchableSelectWrapper>
    </div>
  )
}

// Example 4: With disabled options
export function ExampleWithDisabled() {
  const [client, setClient] = React.useState<string>("")

  const clients = [
    { id: "1", name: "Active Client", status: "active" },
    { id: "2", name: "Inactive Client", status: "inactive" },
    { id: "3", name: "Suspended Client", status: "suspended" },
  ]

  return (
    <div className="space-y-2">
      <Label>Client</Label>
      <SearchableSelectDropdown
        value={client}
        onValueChange={setClient}
        options={clients.map((client) => ({
          value: client.id,
          label: client.name,
          disabled: client.status !== "active",
        }))}
        placeholder="Select client"
      />
    </div>
  )
}

// Example 5: Large list with custom search placeholder
export function ExampleLargeList() {
  const [property, setProperty] = React.useState<string>("")

  // Simulated large list
  const properties = Array.from({ length: 100 }, (_, i) => ({
    id: String(i + 1),
    name: `Property ${i + 1}`,
    address: `Address ${i + 1}`,
  }))

  return (
    <div className="space-y-2">
      <Label>Property</Label>
      <SearchableSelectDropdown
        value={property}
        onValueChange={setProperty}
        options={properties.map((prop) => ({
          value: prop.id,
          label: `${prop.name} - ${prop.address}`,
        }))}
        placeholder="Select property"
        searchPlaceholder="Search properties by name or address..."
        minOptionsForSearch={10}
      />
    </div>
  )
}

// Example 6: Side-by-side comparison (existing vs enhanced)
export function ExampleComparison() {
  const [existingValue, setExistingValue] = React.useState<string>("")
  const [enhancedValue, setEnhancedValue] = React.useState<string>("")

  const options = [
    { id: "1", name: "Option 1" },
    { id: "2", name: "Option 2" },
    { id: "3", name: "Option 3" },
    { id: "4", name: "Option 4" },
    { id: "5", name: "Option 5" },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Existing Select - DO NOT MODIFY */}
      <div className="space-y-2">
        <Label>Existing Select (Unchanged)</Label>
        <Select value={existingValue} onValueChange={setExistingValue}>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Enhanced Select - New component using wrapper */}
      <div className="space-y-2">
        <Label>Enhanced Select (With Search)</Label>
        <SearchableSelectDropdown
          value={enhancedValue}
          onValueChange={setEnhancedValue}
          options={options.map((opt) => ({
            value: opt.id,
            label: opt.name,
          }))}
          placeholder="Select..."
        />
      </div>
    </div>
  )
}
