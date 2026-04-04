# Quick Start: Searchable Dropdown Wrapper

## TL;DR

Add search to any dropdown without modifying existing code. Use `SearchableSelectDropdown` as a drop-in replacement.

## Installation

No installation needed. Components are already in `components/common/`.

## Basic Usage

```tsx
import { SearchableSelectDropdown } from "@/components/common/searchable-select-dropdown"

// Replace this:
<Select value={value} onValueChange={setValue}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {options.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>)}
  </SelectContent>
</Select>

// With this:
<SearchableSelectDropdown
  value={value}
  onValueChange={setValue}
  options={options.map(opt => ({ value: opt.id, label: opt.name }))}
  placeholder="Select..."
/>
```

## Key Points

✅ **Optional**: Existing code works exactly as before  
✅ **Non-invasive**: No modifications to existing components  
✅ **Drop-in**: Same props as Select, just add `options` array  
✅ **Auto-search**: Search appears automatically when 5+ options  

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `options` | `{value: string, label: string}[]` | required | Options array |
| `value` | `string` | - | Selected value |
| `onValueChange` | `(value: string) => void` | - | Change handler |
| `placeholder` | `string` | - | Trigger placeholder |
| `minOptionsForSearch` | `number` | `5` | Min options to show search |
| `searchPlaceholder` | `string` | `"Search..."` | Search input placeholder |
| `caseSensitive` | `boolean` | `false` | Case-sensitive search |

## Examples

See `components/common/searchable-dropdown-example.tsx` for complete examples.

## Full Documentation

See `components/common/SEARCHABLE_DROPDOWN_WRAPPER_README.md` for detailed documentation.
