# Admin Role Definition

## Overview

The Admin role is redefined to have **explicit permissions** for all modules, submodules, and actions. Admin does NOT bypass permission checks - it passes them explicitly.

## Key Principles

1. **No Wildcards at Runtime**
   - Admin role has explicit `RolePermission` records
   - No `*` wildcard evaluation
   - Every permission is explicitly granted

2. **Full Access Through Explicit Grants**
   - Admin has ALL standard actions across ALL modules
   - Admin has ALL restricted actions
   - Full access achieved through comprehensive explicit grants

3. **No Bypass**
   - Admin must pass permission checks like any other role
   - Permission middleware checks explicit grants
   - No special-case handling for Admin

4. **System-Initialized**
   - Admin permissions are created by migration script
   - Marked as `createdBy: 'system'` in audit logs
   - Cannot be modified by users (protected)

## Complete Permission Set

### Finance Module
```
finance.view
finance.create
finance.edit
finance.delete
finance.approve
finance.export
finance.transactions.view
finance.transactions.create
finance.transactions.edit
finance.transactions.delete
finance.transactions.approve
finance.transactions.export
finance.transactions.modify_posted_entries (restricted)
finance.transactions.delete_transactions (restricted)
finance.reports.view
finance.reports.create
finance.reports.edit
finance.reports.delete
finance.reports.export
finance.vouchers.view
finance.vouchers.create
finance.vouchers.edit
finance.vouchers.delete
finance.vouchers.approve
finance.journal.view
finance.journal.create
finance.journal.edit
finance.journal.delete
finance.journal.approve
```

### Properties Module
```
properties.view
properties.create
properties.edit
properties.delete
properties.approve
properties.export
properties.units.view
properties.units.create
properties.units.edit
properties.units.delete
properties.leases.view
properties.leases.create
properties.leases.edit
properties.leases.delete
properties.leases.approve
properties.maintenance.view
properties.maintenance.create
properties.maintenance.edit
properties.maintenance.delete
```

### HR Module
```
hr.view
hr.create
hr.edit
hr.delete
hr.approve
hr.export
hr.employees.view
hr.employees.create
hr.employees.edit
hr.employees.delete
hr.payroll.view
hr.payroll.create
hr.payroll.edit
hr.payroll.delete
hr.payroll.approve
hr.attendance.view
hr.attendance.create
hr.attendance.edit
hr.attendance.delete
hr.leave.view
hr.leave.create
hr.leave.edit
hr.leave.delete
hr.leave.approve
```

### CRM Module
```
crm.view
crm.create
crm.edit
crm.delete
crm.approve
crm.export
crm.leads.view
crm.leads.create
crm.leads.edit
crm.leads.delete
crm.clients.view
crm.clients.create
crm.clients.edit
crm.clients.delete
crm.deals.view
crm.deals.create
crm.deals.edit
crm.deals.delete
crm.deals.approve
crm.communications.view
crm.communications.create
crm.communications.edit
crm.communications.delete
```

### Construction Module
```
construction.view
construction.create
construction.edit
construction.delete
construction.approve
construction.export
construction.projects.view
construction.projects.create
construction.projects.edit
construction.projects.delete
construction.milestones.view
construction.milestones.create
construction.milestones.edit
construction.milestones.delete
construction.budgets.view
construction.budgets.create
construction.budgets.edit
construction.budgets.delete
```

### Tenants Module
```
tenants.view
tenants.create
tenants.edit
tenants.delete
tenants.approve
tenants.export
tenants.payments.view
tenants.payments.create
tenants.payments.edit
tenants.payments.delete
tenants.leases.view
tenants.leases.create
tenants.leases.edit
tenants.leases.delete
tenants.maintenance.view
tenants.maintenance.create
tenants.maintenance.edit
tenants.maintenance.delete
```

### AI Module
```
ai.view
ai.create
ai.edit
ai.delete
ai.approve
ai.export
ai.intelligence.view
ai.intelligence.create
ai.intelligence.edit
ai.intelligence.delete
ai.intelligence.override_decision (restricted)
ai.intelligence.view_explanations (restricted)
ai.assistant.view
ai.assistant.create
ai.assistant.edit
ai.assistant.delete
```

### Audit Module
```
audit.view
audit.create
audit.edit
audit.delete
audit.approve
audit.export
audit.logs.view (restricted)
audit.reports.view
audit.reports.create
audit.reports.edit
audit.reports.delete
audit.reports.export
```

## Migration

Admin permissions are created by the migration script (`migrate-permissions.ts`):

1. Finds Admin role
2. Checks for existing explicit permissions
3. If none exist, grants ALL available permissions
4. Logs migration in `PermissionAuditLog` with `changeType: 'bulk_update'`
5. Marks as `createdBy: 'system'`

## Protection

Admin role permissions are protected:

- Cannot be modified via API (protected in routes)
- Can only be changed via migration script
- All changes are logged in audit trail

## Verification

To verify Admin has all permissions:

```typescript
import { getRolePermissions } from '../services/permissions/permission-service';

const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
const permissions = await getRolePermissions(adminRole.id);
console.log(`Admin has ${permissions.length} explicit permissions`);
```

Expected: ~200+ explicit permissions covering all modules, submodules, and actions.
