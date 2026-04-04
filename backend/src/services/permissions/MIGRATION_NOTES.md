# Migration Notes

## Overview

This document describes the migration from wildcard-based permissions to explicit action-based permissions.

## Migration Strategy

### Phase 1: Schema Migration

1. Run Prisma migration to add new tables:
   ```bash
   npx prisma migrate dev --name add_explicit_permissions
   ```

2. New tables created:
   - `RolePermission` - Explicit permission grants
   - `PermissionAuditLog` - Permission change audit trail
   - `ActionAuditLog` - Action execution audit trail

### Phase 2: Admin Role Migration

Run the migration script to convert Admin wildcard to explicit permissions:

```bash
npm run migrate:permissions
# or
ts-node backend/src/migrations/migrate-permissions.ts
```

**What it does:**
- Finds Admin role
- Checks if explicit permissions already exist
- If not, grants ALL available permissions explicitly
- Logs migration in audit trail
- Marks as `createdBy: 'system'`

**Idempotent:** Safe to run multiple times - checks for existing permissions first.

### Phase 3: Backward Compatibility

Other roles are migrated automatically on first access:

1. User with legacy role accesses system
2. System checks for explicit permissions
3. If none exist, auto-converts legacy permissions
4. Future accesses use explicit permissions

**No downtime required** - migration happens transparently.

## Backward Compatibility

### Legacy Permission Format

Old format stored in `Role.permissions` JSON field:
```json
["finance.view", "finance.create", "properties.*", "*"]
```

### Conversion Rules

1. **Wildcard `*`** → Grants all standard actions for all modules
2. **Module wildcard `module.*`** → Grants all standard actions for module
3. **Exact permission `module.action`** → Grants that specific permission
4. **Submodule permission `module.submodule.action`** → Grants that specific permission

### Compatibility Resolver

The `resolveRolePermissions` function:
- Checks for explicit permissions first
- If none exist, converts legacy permissions
- Returns resolved permission list
- Caches conversion result

## Rollback Procedure

If migration needs to be rolled back:

1. **Keep explicit permissions** - They don't interfere with legacy system
2. **Revert middleware** - Use `hasPermissionSync` instead of async `hasPermission`
3. **Legacy system continues** - Old permission checks still work

**Note:** Explicit permissions remain in database but are ignored if middleware is reverted.

## Verification

### Check Migration Status

```typescript
// Check if Admin has explicit permissions
const adminRole = await prisma.role.findUnique({ where: { name: 'Admin' } });
const explicitCount = await prisma.rolePermission.count({
  where: { roleId: adminRole.id, granted: true }
});
console.log(`Admin has ${explicitCount} explicit permissions`);
```

Expected: 200+ permissions for Admin role.

### Check Legacy Conversion

```typescript
// Check if role has been converted
const role = await prisma.role.findUnique({
  where: { id: roleId },
  include: { rolePermissions: true }
});

if (role.rolePermissions.length > 0) {
  console.log('Role has explicit permissions');
} else {
  console.log('Role still using legacy permissions');
}
```

## Testing

### Test Admin Permissions

1. Login as Admin
2. Access all modules
3. Verify no permission errors
4. Check audit logs for permission checks

### Test Legacy Role Conversion

1. Create role with legacy permissions: `["finance.view", "properties.create"]`
2. Login as user with that role
3. Access finance module - should work
4. Check database - should have explicit permissions created
5. Access properties module - should work
6. Access HR module - should be denied (not in legacy permissions)

### Test Permission Denial

1. Create role with limited permissions
2. Attempt to access restricted resource
3. Verify 403 response
4. Check audit log for denial record

## Troubleshooting

### Issue: Admin can't access resources

**Solution:**
1. Run migration script again
2. Check explicit permissions count
3. Verify middleware is using async `hasPermission`

### Issue: Legacy roles not converting

**Solution:**
1. Check `resolveRolePermissions` function
2. Verify role has legacy permissions in JSON field
3. Check logs for conversion errors

### Issue: Permission checks too slow

**Solution:**
1. Add database indexes (already in schema)
2. Consider caching resolved permissions
3. Batch permission checks where possible

## Performance Considerations

### Database Indexes

Schema includes indexes on:
- `RolePermission(roleId, module, submodule, action)` - Unique constraint
- `RolePermission(roleId)` - Fast role lookup
- `RolePermission(module)` - Fast module lookup
- `PermissionAuditLog(roleId, createdAt)` - Fast audit queries
- `ActionAuditLog(userId, createdAt)` - Fast action audit queries

### Caching Strategy

Consider caching resolved permissions:
- Cache key: `role:${roleId}:permissions`
- TTL: 5 minutes
- Invalidate on permission changes

## Security Considerations

1. **Audit Logging** - All permission changes logged
2. **Action Logging** - All sensitive actions logged
3. **No Silent Failures** - Permission denials logged
4. **Explicit Grants** - No accidental permissions

## Future Enhancements

1. **Permission Templates** - Pre-defined permission sets
2. **Role Inheritance** - Roles can inherit from other roles
3. **Time-Based Permissions** - Permissions with expiration
4. **Conditional Permissions** - Context-based permission grants
