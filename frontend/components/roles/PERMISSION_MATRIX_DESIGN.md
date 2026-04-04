# Permission Matrix UI Design

## Analysis Summary

### Current State
- **Module Toggles**: Simple on/off switches for entire modules (Properties, HR, CRM, Finance, Tenant)
- **Detailed Permissions**: Simple badge list showing permission strings
- **Permission Format**: Legacy string array (e.g., `["finance.view", "finance.create"]`)
- **Save Mechanism**: Updates entire permission array

### Target State
- **Module Toggles**: Keep existing (no change)
- **Detailed Permissions**: Expandable matrix showing:
  - Module → Submodule → Actions hierarchy
  - Checkboxes for granular control
  - Visual indicators for granted/denied permissions
- **Permission Format**: Explicit permissions (Module.Submodule.Action)
- **Save Mechanism**: Bulk update using new API endpoint

## Design Principles

1. **No Visual Redesign**: Reuse existing components (Card, Switch, Checkbox, Badge)
2. **Progressive Enhancement**: Enhance existing "Detailed Permissions" section
3. **Backward Compatible**: Support both legacy and explicit permissions
4. **User-Friendly**: Clear hierarchy, expandable sections, visual feedback

## Component Structure

```
Detailed Permissions Card
├── Expandable Module Sections
│   ├── Finance Module
│   │   ├── Module-level actions (view, create, edit, delete)
│   │   └── Submodules (expandable)
│   │       ├── Transactions
│   │       │   └── Actions (view, create, edit, delete, export)
│   │       ├── Reports
│   │       │   └── Actions (view, export)
│   │       └── Vouchers
│   │           └── Actions (view, create, edit, delete, approve)
│   ├── Properties Module
│   │   └── Submodules: Units, Leases, Maintenance
│   ├── HR Module
│   │   └── Submodules: Employees, Payroll, Attendance, Leave
│   └── CRM Module
│       └── Submodules: Leads, Clients, Deals, Communications
```

## UI Components

### 1. Module Section
- **Header**: Module name + icon + expand/collapse button
- **Module-level Toggle**: Quick toggle for all module actions
- **Submodules**: Expandable list

### 2. Submodule Section
- **Header**: Submodule name + expand/collapse button
- **Actions Grid**: Checkboxes for each action (view, create, edit, delete, approve, export, override)

### 3. Action Checkbox
- **State**: Checked (granted), Unchecked (denied), Indeterminate (partial)
- **Visual**: Standard checkbox with label
- **Disabled**: For Admin role (full access)

## Data Flow

1. **Load Permissions**:
   - Fetch role with `GET /api/roles/:id`
   - Get explicit permissions with `GET /api/roles/:id/permissions`
   - Get available permissions structure from backend

2. **Display Matrix**:
   - Parse explicit permissions into hierarchical structure
   - Build module → submodule → action tree
   - Show checkboxes based on granted permissions

3. **Update Permissions**:
   - Track changes in local state
   - Build permission array from checked items
   - Save with `PUT /api/roles/:id/permissions`

## Implementation Plan

1. **Add API Methods** (lib/api.ts):
   - `getRolePermissions(id)` - Fetch explicit permissions
   - `updateRolePermissions(id, permissions)` - Bulk update

2. **Create Permission Matrix Component**:
   - Parse permissions into hierarchical structure
   - Render expandable module/submodule sections
   - Handle checkbox changes

3. **Integrate into RolesView**:
   - Replace "Detailed Permissions" section
   - Connect to existing save/cancel logic
   - Maintain backward compatibility

4. **Handle Edge Cases**:
   - Admin role (show all granted, disable editing)
   - Legacy permissions (auto-convert on load)
   - Empty permissions (show all unchecked)

## Visual Design

- **Module Header**: Bold, with icon, expandable
- **Submodule Header**: Slightly indented, expandable
- **Actions Grid**: 2-3 columns, checkboxes with labels
- **Spacing**: Consistent padding, clear hierarchy
- **Colors**: Use existing theme colors

## Accessibility

- Keyboard navigation for expand/collapse
- Screen reader labels for checkboxes
- Focus indicators
- ARIA attributes for expandable sections
