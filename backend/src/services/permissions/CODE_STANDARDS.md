# Code Standards & Best Practices
## Role & Permission Module

---

## 1. Naming Conventions

### 1.1 Files
- **kebab-case.ts**: `permission-service.ts`, `rbac.ts`
- **Descriptive names**: Clearly indicate purpose
- **One purpose per file**: Single responsibility principle

### 1.2 Functions
- **camelCase**: `checkPermission`, `grantPermission`, `hasPermission`
- **Verb-based names**: Start with action verb
- **Clear and descriptive**: `checkPermission` not `check`

### 1.3 Types & Interfaces
- **PascalCase**: `PermissionPath`, `PermissionCheckResult`
- **Descriptive suffixes**: `Permission*`, `*Result`, `*Log`
- **Avoid abbreviations**: `PermissionPath` not `PermPath`

### 1.4 Constants
- **UPPER_SNAKE_CASE**: `STANDARD_ACTIONS`, `RESTRICTED_ACTIONS`
- **Descriptive names**: Clearly indicate purpose
- **Group related constants**: Use `as const` for type safety

### 1.5 Variables
- **camelCase**: `permissionPath`, `roleId`, `actorId`
- **Descriptive names**: `hasExplicitPermission` not `has`
- **Boolean prefixes**: `is*`, `has*`, `can*`, `should*`

---

## 2. TypeScript Standards

### 2.1 Type Definitions
```typescript
// ✅ Good: Explicit types
interface PermissionPath {
  module: string;
  submodule?: string;
  action: string;
}

// ❌ Bad: Implicit any
function checkPermission(roleId, permission) { }

// ✅ Good: Return type explicit
async function checkPermission(roleId: string, permission: string): Promise<PermissionCheckResult> { }
```

### 2.2 Avoid `any` Type
```typescript
// ❌ Bad: Using any
function processData(data: any) { }

// ✅ Good: Use specific types
function processData(data: PermissionPath | string) { }

// ✅ Good: Use unknown when type is truly unknown
function processData(data: unknown) {
  if (typeof data === 'string') { }
}
```

### 2.3 Type Assertions
```typescript
// ❌ Bad: Unsafe type assertion
const role = data as Role;

// ✅ Good: Type guard
function isRole(data: unknown): data is Role {
  return typeof data === 'object' && data !== null && 'id' in data && 'name' in data;
}

if (isRole(data)) {
  // data is now typed as Role
}
```

### 2.4 Optional Chaining & Nullish Coalescing
```typescript
// ✅ Good: Safe property access
const roleName = role?.name ?? 'Unknown';

// ✅ Good: Optional chaining
const permissionCount = role?.rolePermissions?.length ?? 0;
```

---

## 3. Error Handling Standards

### 3.1 Error Response Format
```typescript
// ✅ Good: Structured error
interface ErrorResponse {
  error: string;        // Error category
  message: string;      // User-friendly message
  code: string;         // Error code
  details?: any;        // Additional details (dev only)
}

// ✅ Good: Consistent error creation
throw new Error(`Permission check failed: ${error.message}`);
```

### 3.2 Try-Catch Blocks
```typescript
// ✅ Good: Comprehensive error handling
try {
  const result = await checkPermission(roleId, permission);
  return result;
} catch (error: any) {
  logger.error(`Permission check failed: ${error.message}`, {
    roleId,
    permission,
    stack: error.stack,
  });
  // Fail closed - deny on error
  return {
    allowed: false,
    reason: 'Permission check failed',
    permissionPath: permission,
  };
}
```

### 3.3 Error Logging
```typescript
// ✅ Good: Log with context
logger.error(`Failed to grant permission: ${error.message}`, {
  roleId,
  module,
  submodule,
  action,
  actorId,
  error: error.message,
  stack: error.stack,
});

// ❌ Bad: No context
logger.error('Error');
```

---

## 4. Function Design Standards

### 4.1 Single Responsibility
```typescript
// ✅ Good: One clear purpose
async function checkPermission(roleId: string, permission: string): Promise<PermissionCheckResult> {
  // Only checks permission
}

// ❌ Bad: Multiple responsibilities
async function checkAndGrantPermission(roleId: string, permission: string) {
  // Checks AND grants - violates SRP
}
```

### 4.2 Pure Functions (When Possible)
```typescript
// ✅ Good: Pure function (no side effects)
function parsePermission(permission: string): PermissionPath | null {
  const parts = permission.split('.');
  // No database calls, no mutations
  return { module: parts[0], action: parts[1] };
}

// ✅ Good: Side effects clearly indicated
async function grantPermission(roleId: string, ...): Promise<void> {
  // Side effects: database write, cache invalidation
  await prisma.rolePermission.create(...);
  permissionCache.invalidateRole(roleId);
}
```

### 4.3 Function Documentation
```typescript
/**
 * Check if user has explicit permission
 * 
 * @param roleId - The role ID to check
 * @param permission - Permission path (e.g., 'finance.transactions.view')
 * @returns Permission check result with allow/deny status and reason
 * 
 * @throws Error if role not found or database error
 */
async function checkPermission(
  roleId: string,
  permission: string
): Promise<PermissionCheckResult> {
  // Implementation
}
```

---

## 5. Code Organization Standards

### 5.1 File Structure
```typescript
// 1. Imports (external first, then internal)
import { Request, Response } from 'express';
import prisma from '../../prisma/client';
import logger from '../../utils/logger';

// 2. Type definitions
export interface PermissionPath { }

// 3. Constants
export const STANDARD_ACTIONS = [] as const;

// 4. Utility functions (pure functions)
export function parsePermission() { }

// 5. Core functions (with side effects)
export async function checkPermission() { }

// 6. Main export (if applicable)
export default { checkPermission, grantPermission };
```

### 5.2 Module Organization
```
server/src/services/permissions/
├── types.ts                      # Type definitions
├── permission-service.ts         # Core permission logic
├── permission-cache.ts           # Caching layer
├── rbac.ts                       # RBAC middleware (in middleware/)
├── permission-inspector.ts       # Read-only inspection
├── compatibility-resolver.ts     # Legacy migration
├── audit-logger.ts               # Audit logging
└── initialize-admin-permissions.ts # Admin initialization
```

---

## 6. Database Query Standards

### 6.1 Query Optimization
```typescript
// ✅ Good: Select only needed fields
const role = await prisma.role.findUnique({
  where: { id: roleId },
  select: {
    id: true,
    name: true,
    rolePermissions: {
      where: { granted: true },
      select: { module: true, action: true },
    },
  },
});

// ❌ Bad: Select all fields (wasteful)
const role = await prisma.role.findUnique({
  where: { id: roleId },
  include: { rolePermissions: true },
});
```

### 6.2 Transaction Usage
```typescript
// ✅ Good: Use transactions for atomic operations
await prisma.$transaction(async (tx) => {
  await tx.rolePermission.create({ ... });
  await tx.rolePermission.update({ ... });
}, {
  maxWait: 5000,
  timeout: 10000,
});

// ❌ Bad: Multiple separate queries (not atomic)
await prisma.rolePermission.create({ ... });
await prisma.rolePermission.update({ ... });
```

### 6.3 Error Handling in Queries
```typescript
// ✅ Good: Handle Prisma errors
try {
  await prisma.rolePermission.upsert({ ... });
} catch (error: any) {
  if (error.code === 'P2002') {
    // Unique constraint violation
    logger.warn(`Permission already exists: ${error.meta?.target}`);
  } else {
    throw error;
  }
}
```

---

## 7. Logging Standards

### 7.1 Log Levels
```typescript
// ✅ Good: Appropriate log levels
logger.error('Critical error', error);      // Errors that need attention
logger.warn('Recoverable issue', context);  // Warnings but continues
logger.info('Important event', data);       // Important business events
logger.debug('Detailed debug', details);    // Detailed debugging
```

### 7.2 Log Context
```typescript
// ✅ Good: Include relevant context
logger.info('Permission granted', {
  roleId,
  permission,
  actorId,
  timestamp: new Date().toISOString(),
});

// ❌ Bad: No context
logger.info('Permission granted');
```

### 7.3 Sensitive Data
```typescript
// ❌ Bad: Log sensitive data
logger.info('User logged in', { password: user.password });

// ✅ Good: Exclude sensitive data
logger.info('User logged in', {
  userId: user.id,
  username: user.username,
  // password excluded
});
```

---

## 8. Testing Standards

### 8.1 Test Organization
```typescript
describe('PermissionService', () => {
  describe('checkPermission', () => {
    it('should return allowed=true for granted permission', async () => {
      // Test implementation
    });

    it('should return allowed=false for denied permission', async () => {
      // Test implementation
    });
  });
});
```

### 8.2 Test Data
```typescript
// ✅ Good: Use test factories
const createTestRole = (overrides?: Partial<Role>): Role => ({
  id: 'test-role-id',
  name: 'Test Role',
  status: 'ACTIVE',
  ...overrides,
});

// ❌ Bad: Hard-coded test data scattered
const role = { id: '123', name: 'Role', ... }; // Repeated everywhere
```

---

## 9. Documentation Standards

### 9.1 JSDoc Comments
```typescript
/**
 * Checks if a role has a specific permission
 * 
 * This function checks both explicit permissions and legacy permissions
 * for backward compatibility during migration.
 * 
 * @param roleId - The ID of the role to check
 * @param permission - The permission path (e.g., 'finance.transactions.view')
 * @returns Promise resolving to permission check result
 * 
 * @example
 * ```typescript
 * const result = await checkPermission(roleId, 'finance.view');
 * if (result.allowed) {
 *   // Permission granted
 * }
 * ```
 */
```

### 9.2 Inline Comments
```typescript
// ✅ Good: Explain "why", not "what"
// Use findFirst instead of upsert because Prisma's upsert doesn't
// handle null values in compound unique constraints properly
const existing = await prisma.rolePermission.findFirst({ ... });

// ❌ Bad: Obvious comment
// Get role from database
const role = await prisma.role.findUnique({ ... });
```

---

## 10. Security Standards

### 10.1 Input Validation
```typescript
// ✅ Good: Validate input
import { z } from 'zod';

const permissionSchema = z.string().regex(/^[a-z]+\.[a-z]+\.[a-z]+$/);
const validatedPermission = permissionSchema.parse(permission);

// ❌ Bad: No validation
async function grantPermission(permission: string) {
  // No validation - security risk
}
```

### 10.2 Fail-Closed Security
```typescript
// ✅ Good: Deny on error (fail-closed)
try {
  return await checkPermission(roleId, permission);
} catch (error) {
  // Fail closed - deny on error
  return { allowed: false, reason: 'Permission check failed' };
}

// ❌ Bad: Allow on error (fail-open - security risk)
try {
  return await checkPermission(roleId, permission);
} catch (error) {
  return { allowed: true }; // Security risk!
}
```

---

## Conclusion

These standards ensure:
- ✅ **Consistency**: Uniform code style across the module
- ✅ **Maintainability**: Easy to understand and modify
- ✅ **Security**: Fail-closed, validated inputs
- ✅ **Performance**: Optimized queries, caching
- ✅ **Reliability**: Comprehensive error handling

Follow these standards for all new code and refactor existing code to match.
