# Role & Permission Module - Professional Architecture Design

## Executive Summary

This document outlines the professional architecture design for the Role & Permission module, following industry best practices, enterprise standards, and maintainability principles.

---

## 1. Architecture Principles

### 1.1 Separation of Concerns
- **Permission Service**: Core permission logic (CRUD, checking)
- **RBAC Middleware**: Express middleware for route protection
- **Permission Inspector**: Read-only inspection and audit
- **Compatibility Resolver**: Legacy system migration handling
- **Audit Logger**: Comprehensive audit trail management
- **Cache Service**: Performance optimization layer

### 1.2 Single Responsibility Principle
Each service/module has ONE clear responsibility:
- `permission-service.ts` → Permission CRUD and checking
- `rbac.ts` → Request-level authorization
- `permission-inspector.ts` → Read-only inspection
- `compatibility-resolver.ts` → Legacy migration
- `audit-logger.ts` → Audit logging
- `permission-cache.ts` → Caching layer

### 1.3 Dependency Injection
- Services are pure functions where possible
- Database client (Prisma) is imported, not instantiated
- Cache is singleton but can be mocked

### 1.4 Error Handling Strategy
- **Fail-Closed**: Errors result in denial, not allowance
- **Structured Errors**: Consistent error response format
- **Comprehensive Logging**: All errors logged with context
- **Silent Refusal**: 403 responses without exposing internal details

---

## 2. Data Model Design

### 2.1 Permission Hierarchy
```
Module → Submodule → Action
```

**Example Structure:**
- Module: `finance`
- Submodule: `transactions` (optional)
- Action: `view`, `create`, `edit`, `delete`, `approve`, `export`

**Permission Path Format:**
- Module-level: `finance.view`
- Submodule-level: `finance.transactions.view`

### 2.2 Database Schema
```prisma
model Role {
  id              String           @id @default(uuid())
  name            String           @unique
  status          String           @default("ACTIVE") // ACTIVE | DEACTIVATED | SYSTEM_LOCKED
  permissions     Json             // Legacy: kept for backward compatibility
  rolePermissions RolePermission[] // New: explicit permissions
  // ... other fields
}

model RolePermission {
  id          String   @id @default(uuid())
  roleId      String
  module      String
  submodule   String?  // Nullable for module-level permissions
  action      String
  granted     Boolean  @default(true)
  createdAt   DateTime @default(now())
  createdBy   String?  // Actor who granted this permission
  
  @@unique([roleId, module, submodule, action])
  @@index([roleId])
  @@index([module])
}
```

### 2.3 Permission States
- **ACTIVE**: Role can grant permissions at runtime
- **DEACTIVATED**: Role exists but doesn't grant permissions
- **SYSTEM_LOCKED**: System role (Admin) - cannot be modified

---

## 3. Service Layer Design

### 3.1 Permission Service (`permission-service.ts`)

**Core Functions:**
```typescript
// Permission checking
checkPermission(roleId, permission): Promise<PermissionCheckResult>
checkAnyPermission(roleId, permissions[]): Promise<PermissionCheckResult>

// Permission management
grantPermission(roleId, module, submodule, action, actorId): Promise<void>
revokePermission(roleId, module, submodule, action, actorId): Promise<void>
bulkUpdatePermissions(roleId, permissions[], actorId): Promise<void>

// Permission queries
getRolePermissions(roleId): Promise<RolePermission[]>
getAllAvailablePermissions(): Record<string, string[]>

// Permission utilities
parsePermission(permission: string): PermissionPath | null
buildPermissionPath(module, submodule?, action): string
```

**Design Patterns:**
- **Result Pattern**: `PermissionCheckResult` with `allowed`, `reason`, `permissionPath`
- **Cache Integration**: All checks go through cache layer
- **Role Status Check**: Deactivated roles denied immediately
- **Atomic Operations**: Bulk updates use transactions

### 3.2 RBAC Middleware (`rbac.ts`)

**Middleware Functions:**
```typescript
requireAuth(req, res, next): Promise<void>  // Authentication middleware
requirePermission(permission: string): Middleware  // Single permission check
requireAnyPermission(permissions: string[]): Middleware  // OR permission check
requireAdmin(req, res, next): void  // Admin role check
```

**Design Patterns:**
- **Middleware Chain**: Composable middleware functions
- **Request Enrichment**: Attach user/role to `req.user`
- **Backward Compatibility**: Supports legacy permission system
- **Audit Integration**: Logs all permission checks

### 3.3 Permission Inspector (`permission-inspector.ts`)

**Purpose**: Read-only inspection for compliance and debugging

**Functions:**
```typescript
inspectRolePermissions(roleId, inspectorId?, inspectorUsername?): Promise<PermissionInspectionResult>
inspectUserPermissions(userId, inspectorId?, inspectorUsername?): Promise<PermissionInspectionResult>
```

**Output Format:**
- Structured permission breakdown
- Resolution reasons for each permission
- Module/submodule hierarchy
- Effective access summary

### 3.4 Compatibility Resolver (`compatibility-resolver.ts`)

**Purpose**: Seamless migration from legacy to explicit permissions

**Functions:**
```typescript
convertLegacyPermissions(roleId, legacyPermissions, actorId): Promise<void>
resolveRolePermissions(roleId, legacyPermissions): Promise<string[]>
hasExplicitPermissions(roleId): Promise<boolean>
```

**Migration Strategy:**
1. Auto-detect legacy permissions (`*`, `admin.*`)
2. Convert to explicit permissions on first access
3. Preserve legacy behavior during migration period
4. Transparent to end users

### 3.5 Audit Logger (`audit-logger.ts`)

**Purpose**: Comprehensive audit trail for compliance

**Functions:**
```typescript
logPermissionChange(change): Promise<void>
logActionExecution(execution): Promise<void>
getPermissionAuditLogs(filters): Promise<AuditLog[]>
```

**Audit Events:**
- Permission grants/revokes
- Bulk permission updates
- Sensitive action executions
- Role lifecycle changes

### 3.6 Permission Cache (`permission-cache.ts`)

**Purpose**: Performance optimization for permission checks

**Design:**
- In-memory cache with 5-minute TTL
- LRU eviction when cache is full (10,000 entries)
- Role-level invalidation on permission changes
- Thread-safe operations

---

## 4. API Design Standards

### 4.1 RESTful Endpoints

**Roles API:**
```
GET    /api/roles                    # List all roles
GET    /api/roles/:id                # Get role details
POST   /api/roles                    # Create role
PUT    /api/roles/:id                # Update role
POST   /api/roles/:id/deactivate     # Deactivate role (soft delete)
PUT    /api/roles/:id/permissions    # Bulk update permissions
GET    /api/roles/:id/permissions    # Get role permissions
```

**Permissions API:**
```
GET    /api/permissions/inspect?type=role&id=xxx  # Inspect permissions
GET    /api/permissions/available                 # Get all available permissions
```

### 4.2 Request/Response Standards

**Request Validation:**
- Zod schemas for input validation
- Type-safe request/response types
- Clear error messages

**Response Format:**
```typescript
// Success
{
  success: true,
  data: T,
  meta?: { timestamp, pagination }
}

// Error
{
  error: string,
  message: string,
  code: string,
  details?: any  // Only in development
}
```

**HTTP Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Permission denied
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## 5. Security Design

### 5.1 Permission Checking Rules

1. **Deny by Default**
   - No permission → DENY
   - Invalid permission → DENY
   - Error during check → DENY (fail-closed)

2. **Explicit Grants Only**
   - No wildcards at runtime
   - Admin must have explicit permissions
   - Every permission explicitly granted

3. **Role Status Enforcement**
   - DEACTIVATED roles → All permissions denied
   - SYSTEM_LOCKED roles → Cannot be modified

4. **Audit Trail**
   - All permission changes logged
   - All sensitive actions logged
   - Immutable audit records

### 5.2 Admin Role Protection

- `status = SYSTEM_LOCKED`
- Cannot be deactivated
- Cannot be deleted
- Cannot be renamed
- All modifications blocked at API level
- Security events logged

---

## 6. Performance Optimization

### 6.1 Caching Strategy

- **Cache TTL**: 5 minutes
- **Cache Size**: 10,000 entries max
- **Eviction**: LRU (Least Recently Used)
- **Invalidation**: Role-level on permission changes

### 6.2 Database Optimization

- **Indexes**: On `roleId`, `module`, `(module, submodule, action)`
- **Batch Queries**: Bulk permission checks where possible
- **Connection Pooling**: Prisma connection pool configured

### 6.3 Query Patterns

- **Eager Loading**: Include `rolePermissions` when needed
- **Selective Fields**: Only fetch required fields
- **Pagination**: For large result sets

---

## 7. Error Handling Standards

### 7.1 Error Categories

1. **Validation Errors** (400)
   - Missing required fields
   - Invalid format
   - Constraint violations

2. **Authentication Errors** (401)
   - Missing token
   - Invalid token
   - Expired token

3. **Authorization Errors** (403)
   - Insufficient permissions
   - Role status restriction

4. **Not Found Errors** (404)
   - Role not found
   - Permission not found

5. **Server Errors** (500)
   - Database errors
   - Unexpected exceptions

### 7.2 Error Response Format

```typescript
{
  error: string,           // Error category
  message: string,         // User-friendly message
  code: string,            // Error code for programmatic handling
  details?: any,           // Additional details (dev only)
  timestamp: string        // ISO timestamp
}
```

### 7.3 Logging Standards

- **Error Level**: `logger.error()` with full context
- **Warning Level**: `logger.warn()` for recoverable issues
- **Info Level**: `logger.info()` for important events
- **Debug Level**: `logger.debug()` for detailed debugging

---

## 8. Type Safety & Interfaces

### 8.1 Core Types

```typescript
// Permission Path
interface PermissionPath {
  module: string;
  submodule?: string;
  action: string;
}

// Permission Check Result
interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  permissionPath?: string;
}

// Permission Source
type PermissionSource = 
  | 'explicit_grant'
  | 'explicit_deny'
  | 'system_restriction'
  | 'deny_by_default'
  | 'legacy_migration';

// Resolution Reason
type ResolutionReason = 
  | 'EXPLICITLY_GRANTED'
  | 'NOT_GRANTED_TO_ROLE'
  | 'MODULE_ACCESS_DISABLED'
  | 'SYSTEM_RESTRICTED'
  | 'REQUIRES_HIGHER_ROLE'
  | 'INHERITED_DENY';
```

### 8.2 Request/Response Types

```typescript
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    roleId: string;
    role?: {
      id: string;
      name: string;
      permissions: string[];
    };
  };
}
```

---

## 9. Code Quality Standards

### 9.1 Naming Conventions

- **Functions**: `camelCase` (e.g., `checkPermission`, `grantPermission`)
- **Types/Interfaces**: `PascalCase` (e.g., `PermissionPath`, `PermissionCheckResult`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `STANDARD_ACTIONS`, `RESTRICTED_ACTIONS`)
- **Files**: `kebab-case.ts` (e.g., `permission-service.ts`, `rbac.ts`)

### 9.2 Code Organization

```
server/src/services/permissions/
├── permission-service.ts        # Core permission logic
├── rbac.ts                      # RBAC middleware (in middleware/)
├── permission-inspector.ts      # Read-only inspection
├── compatibility-resolver.ts    # Legacy migration
├── audit-logger.ts              # Audit logging
├── permission-cache.ts          # Caching layer
└── initialize-admin-permissions.ts  # Admin initialization
```

### 9.3 Documentation Standards

- **JSDoc Comments**: All public functions
- **Type Annotations**: Explicit types, avoid `any`
- **Inline Comments**: Explain "why", not "what"
- **README Files**: Module-level documentation

### 9.4 Testing Standards

- **Unit Tests**: Each service function
- **Integration Tests**: API endpoints
- **E2E Tests**: Complete permission flows
- **Test Coverage**: >80% target

---

## 10. Backward Compatibility

### 10.1 Legacy Support

- **Legacy Permissions**: JSON `permissions` field preserved
- **Wildcard Support**: Auto-converted on first access
- **Migration Path**: Gradual, transparent migration
- **API Compatibility**: No breaking changes

### 10.2 Migration Strategy

1. **Phase 1**: New system deployed alongside legacy
2. **Phase 2**: Auto-convert on first access
3. **Phase 3**: Bulk migration of all roles
4. **Phase 4**: Legacy system deprecated (future)

---

## 11. Monitoring & Observability

### 11.1 Metrics

- Permission check latency
- Cache hit/miss ratio
- Permission grant/revoke frequency
- Error rates by type

### 11.2 Logging

- All permission changes
- All permission checks (optional, configurable)
- All security events
- All errors with full context

### 11.3 Health Checks

- Database connectivity
- Cache health
- Permission service availability

---

## 12. Future Enhancements

### 12.1 Planned Features

1. **Permission Templates**: Pre-defined permission sets
2. **Role Inheritance**: Hierarchical role structure
3. **Time-based Permissions**: Temporary permissions
4. **IP-based Restrictions**: Geographic access control
5. **Permission Analytics**: Usage statistics dashboard

### 12.2 Scalability Improvements

- Redis cache for distributed systems
- Permission pre-loading for users
- Batch permission checking API
- Permission query optimization

---

## Conclusion

This architecture provides:
- ✅ **Professional Standards**: Industry best practices
- ✅ **Maintainability**: Clear separation of concerns
- ✅ **Scalability**: Performance optimizations built-in
- ✅ **Security**: Fail-closed, comprehensive audit
- ✅ **Backward Compatibility**: Seamless migration
- ✅ **Type Safety**: Full TypeScript support

The design is production-ready and follows enterprise-grade standards.
