# Searchable Dropdown Wrapper - Non-Invasive Enhancement

## Overview

This module provides **optional, non-invasive** search functionality for dropdown/select components in the REMS system. The wrapper components add search capability without modifying any existing system logic, workflows, APIs, or styling.

## Critical Rules

✅ **Safe to Use**: These components are wrappers that enhance existing dropdowns  
✅ **Optional**: System behaves exactly as before if not used  
✅ **Non-Breaking**: No changes to existing code required  
❌ **Do NOT modify**: Existing dropdowns, forms, or components  
❌ **Do NOT change**: System logic, APIs, or database models  

## Components

### 1. `SearchableSelectDropdown` (Recommended)

A drop-in replacement component that accepts options array and standard Select props.

**When to use**: When you want to replace an existing Select with a searchable version.

**Props**:
- `options`: Array of `{value: string, label: string | ReactNode, disabled?: boolean}`
- `value`: Currently selected value
- `onValueChange`: Callback when value changes
- `placeholder`: Placeholder text
- `disabled`: Whether select is disabled
- `searchPlaceholder`: Placeholder for search input (default: "Search...")
- `minOptionsForSearch`: Minimum options before search appears (default: 5)
- `caseSensitive`: Whether search is case-sensitive (default: false)
- `size`: "sm" | "default" (default: "default")

### 2. `SearchableSelectWrapper` (Advanced)

A render prop wrapper that provides filtered options and search input to your existing Select component.

**When to use**: When you need more control over the Select structure or want to keep existing Select JSX mostly intact.

**Props**:
- `options`: Array of options
- `value`: Currently selected value
- `onValueChange`: Callback when value changes
- `children`: Render prop `(filteredOptions, searchInput) => ReactNode`
- `searchPlaceholder`: Placeholder for search input
- `minOptionsForSearch`: Minimum options before search appears
- `caseSensitive`: Whether search is case-sensitive

## Usage Examples

### Example 1: Simple Dropdown Replacement

**Before** (existing code - DO NOT MODIFY):
```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

<Select value={category} onValueChange={setCategory}>
  <SelectTrigger>
    <SelectValue placeholder="Select category" />
  </SelectTrigger>
  <SelectContent>
    {categories.map(cat => (
      <SelectItem key={cat.id} value={cat.id}>
        {cat.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**After** (optional enhancement - new file/component):
```tsx
import { SearchableSelectDropdown } from "@/components/common/searchable-select-dropdown"

<SearchableSelectDropdown
  value={category}
  onValueChange={setCategory}
  options={categories.map(cat => ({ 
    value: cat.id, 
    label: cat.name 
  }))}
  placeholder="Select category"
/>
```

### Example 2: With Custom Styling

```tsx
<SearchableSelectDropdown
  value={selectedAccount}
  onValueChange={setSelectedAccount}
  options={accounts.map(acc => ({
    value: acc.id,
    label: `${acc.code} — ${acc.name}`,
  }))}
  placeholder="Select account"
  className="w-full"
  triggerClassName="w-full"
  minOptionsForSearch={3}
  searchPlaceholder="Search accounts..."
/>
```

### Example 3: Using the Wrapper Pattern

```tsx
import { SearchableSelectWrapper } from "@/components/common/searchable-select-wrapper"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"

<SearchableSelectWrapper
  options={options.map(opt => ({ value: opt.id, label: opt.name }))}
  value={value}
  onValueChange={setValue}
>
  {(filteredOptions, searchInput) => (
    <Select value={value} onValueChange={setValue}>
      <SelectTrigger>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {searchInput}
        {filteredOptions.map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )}
</SearchableSelectWrapper>
```

## Features

✅ **Type-to-search**: Filter options as you type  
✅ **Case-insensitive**: By default (configurable)  
✅ **Auto-hide**: Search only appears when there are enough options  
✅ **Keyboard navigation**: Arrow keys, Enter, Escape work as expected  
✅ **Visual matching**: Uses exact same styling as existing Select components  
✅ **No layout shift**: Search input appears inside dropdown, no spacing changes  
✅ **Isolated logic**: Search filtering is completely isolated in wrapper  

## Safety Guarantees

1. **No Global Changes**: Components are isolated, no prototype modifications
2. **No Breaking Changes**: Existing Select components work exactly as before
3. **No API Changes**: Same props interface as standard Select
4. **No Style Changes**: Uses existing Select component classes
5. **Optional Usage**: System behaves identically if components are not used

## Migration Strategy

1. **Identify** dropdowns that would benefit from search (long lists)
2. **Create** new component files using `SearchableSelectDropdown`
3. **Test** thoroughly in isolation
4. **Deploy** incrementally - old and new can coexist
5. **No rush** - existing code continues to work

## Technical Details

- **Search Logic**: Case-insensitive string matching by default
- **Performance**: Uses React.useMemo for efficient filtering
- **Accessibility**: Maintains keyboard navigation and ARIA attributes
- **Styling**: Inherits all Select component styles via composition
- **State Management**: Isolated search state, doesn't affect parent state

## Limitations

- Search input appears inside SelectContent (requires dropdown to be open)
- Minimum option threshold prevents search on small lists
- Search resets when dropdown closes (by design, for clean UX)

## Support

For questions or issues with the wrapper components:
1. Check this documentation
2. Review example usage files
3. Ensure you're not modifying existing components
4. Verify props match standard Select component API

---

**Remember**: These are **optional enhancements**. The existing system works perfectly without them. Use them only when search functionality adds value to specific dropdowns.
