# Permission Model Documentation

## Overview

The permission system implements a hierarchical, action-based access control model that enforces explicit permissions with no wildcards at runtime.

## Permission Structure

### Hierarchy

```
Module → Submodule → Action
```

**Example:**
- `finance.transactions.view` - View transactions in Finance module
- `finance.transactions.create` - Create transactions in Finance module
- `properties.view` - View properties (module-level)
- `ai.intelligence.override_decision` - Override AI decision (restricted action)

### Standard Actions

Available across all modules:

- `view` - Read-only access
- `create` - Create new records
- `edit` - Modify existing records
- `delete` - Remove records
- `approve` - Approve/reject records
- `export` - Export data

### Restricted Actions

Require explicit grant, OFF by default:

- `override` - Override system decisions (AI, Finance, Audit modules only)

## Permission Path Format

### Module-Level Permission
```
module.action
```
Example: `finance.view`, `properties.create`

### Submodule-Level Permission
```
module.submodule.action
```
Example: `finance.transactions.view`, `hr.employees.create`

## Permission Checking Rules

### CRITICAL RULES

1. **Deny by Default**
   - If no explicit permission exists → DENY
   - No silent fallbacks
   - No optimistic assumptions

2. **Explicit Grants Only**
   - Wildcards (`*`) are NOT evaluated at runtime
   - Admin role must have explicit permissions
   - Every permission must be explicitly granted

3. **No Bypass**
   - Admin role does NOT bypass permission checks
   - Admin must pass explicit permission checks
   - Admin permissions are explicit grants, not special cases

4. **Silent Refusal**
   - Permission denials return 403 without detailed error messages
   - Logged for audit but not exposed to user

## Permission Resolution

### Explicit Permissions (Primary)

System checks `RolePermission` table for explicit grants:

```typescript
{
  roleId: "role-uuid",
  module: "finance",
  submodule: "transactions",
  action: "view",
  granted: true
}
```

### Backward Compatibility (Fallback)

For roles without explicit permissions:
1. Check legacy `permissions` JSON field
2. Auto-convert to explicit permissions on first access
3. Preserve legacy behavior during migration period

## Admin Role Definition

Admin role has explicit permissions for ALL modules, submodules, and actions:

- All standard actions across all modules
- All restricted actions (override, etc.)
- No wildcard `*` at runtime
- Full access through explicit grants

See `ADMIN_ROLE_DEFINITION.md` for complete Admin permission set.

## Module Definitions

### Finance Module
- Submodules: `transactions`, `reports`, `vouchers`, `journal`
- Restricted: `finance.transactions.modify_posted_entries`, `finance.transactions.delete_transactions`

### Properties Module
- Submodules: `units`, `leases`, `maintenance`

### HR Module
- Submodules: `employees`, `payroll`, `attendance`, `leave`

### CRM Module
- Submodules: `leads`, `clients`, `deals`, `communications`

### Construction Module
- Submodules: `projects`, `milestones`, `budgets`

### Tenants Module
- Submodules: `payments`, `leases`, `maintenance`

### AI Module
- Submodules: `intelligence`, `assistant`
- Restricted: `ai.intelligence.override_decision`, `ai.intelligence.view_explanations`

### Audit Module
- Submodules: `logs`, `reports`
- Restricted: `audit.logs.view`

## Usage Examples

### Check Permission (Backend)

```typescript
import { checkPermission } from '../services/permissions/permission-service';

const result = await checkPermission(roleId, 'finance.transactions.view');
if (result.allowed) {
  // Proceed
} else {
  // Deny access
}
```

### Require Permission (Middleware)

```typescript
import { requirePermission } from '../middleware/rbac';

router.get('/transactions', requirePermission('finance.transactions.view'), handler);
```

### Grant Permission

```typescript
import { grantPermission } from '../services/permissions/permission-service';

await grantPermission(
  roleId,
  'finance',
  'transactions',
  'view',
  actorId
);
```

## Migration Notes

See `MIGRATION_NOTES.md` for migration procedures and backward compatibility details.
