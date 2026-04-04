/**
 * Permission Inspector Service
 * 
 * Provides read-only inspection of effective permissions with full explanations.
 * Used for compliance, debugging, and audit verification.
 * 
 * NO MODIFICATIONS - READ-ONLY ONLY
 */

import prisma from '../../prisma/client';
import logger from '../../utils/logger';
import { checkPermission, parsePermission, getAllAvailablePermissions, RESTRICTED_ACTIONS } from './permission-service';
import { resolveRolePermissions, hasExplicitPermissions } from './compatibility-resolver';

/**
 * Sensitive permissions that require special highlighting
 */
export const SENSITIVE_PERMISSIONS = [
  'ai.override_decision',
  'ai.view_explanations',
  'finance.modify_posted_entries',
  'finance.delete_transactions',
  'audit.view_logs',
] as const;

/**
 * Permission source types
 */
export type PermissionSource = 
  | 'explicit_grant'
  | 'explicit_deny'
  | 'inherited_role'
  | 'system_restriction'
  | 'deny_by_default'
  | 'legacy_migration'
  | 'system_grant' // Admin or system-level grant
  | 'cannot_determine';

/**
 * Resolution reason for why a permission is allowed or denied
 * Used for clear, auditable explanations in the UI
 */
export type ResolutionReason = 
  | 'EXPLICITLY_GRANTED'
  | 'NOT_GRANTED_TO_ROLE'
  | 'MODULE_ACCESS_DISABLED'
  | 'SYSTEM_RESTRICTED'
  | 'REQUIRES_HIGHER_ROLE'
  | 'INHERITED_DENY';

/**
 * Effective access level
 */
export type EffectiveAccessLevel = 'full' | 'partial' | 'restricted';

/**
 * Effective access summary
 */
export interface EffectiveAccessSummary {
  level: EffectiveAccessLevel;
  description: string;
  grantedVia: ('explicit' | 'legacy' | 'system')[];
  enforcementStatus: 'active' | 'compatibility_mode';
}

/**
 * Detailed permission inspection result
 */
export interface PermissionInspectionDetail {
  permission: string;
  module: string;
  submodule: string | null;
  action: string;
  status: 'allowed' | 'denied' | 'cannot_determine';
  source: PermissionSource;
  resolutionReason: ResolutionReason; // Primary reason for why permission is allowed/denied
  reason: string; // Human-readable explanation
  isSensitive: boolean;
  auditRequired?: boolean; // Whether this permission requires audit logging (replaces auditFlagged)
  lastUsed?: Date | null;
  grantedAt?: Date | null;
  grantedBy?: string | null;
}

/**
 * Module-level inspection result
 */
export interface ModuleInspection {
  module: string;
  submodules: Record<string, SubmoduleInspection>;
  moduleLevelPermissions: PermissionInspectionDetail[]; // Permissions without submodule
}

/**
 * Submodule-level inspection result
 */
export interface SubmoduleInspection {
  submodule: string;
  permissions: PermissionInspectionDetail[];
}

/**
 * Complete permission inspection result
 */
export interface PermissionInspectionResult {
  inspectedEntity: {
    type: 'role' | 'user';
    id: string;
    name: string;
    status?: string; // PART 3: Role status (ACTIVE | DEACTIVATED | SYSTEM_LOCKED)
    roles?: string[]; // For user inspections
  };
  inspectionMetadata: {
    timestamp: Date;
    resolverVersion: string;
    inspectorId?: string;
    inspectorUsername?: string;
  };
  effectiveAccess: EffectiveAccessSummary;
  permissions: {
    modules: Record<string, ModuleInspection>;
    summary: {
      totalPermissions: number;
      effectiveAllowed: number; // Runtime effective access (what actually works)
      explicitlyDefined: number; // Explicitly granted or denied
      systemRestricted: number; // Hard system blocks
      sensitive: number;
      cannotDetermine: number;
    };
  };
  warnings: string[]; // Any data inconsistencies or missing information
}

/**
 * Check effective permission (replicates hasPermission logic to avoid circular dependency)
 * This determines what actually works at runtime, including Admin fallback and legacy compatibility
 */
async function checkEffectivePermission(
  roleId: string,
  roleName: string,
  legacyPermissions: string[],
  requiredPermission: string
): Promise<boolean> {
  try {
    // Check explicit permission first
    const explicitCheck = await checkPermission(roleId, requiredPermission);
    
    if (explicitCheck.allowed) {
      return true;
    }

    // Special handling for Admin role
    const normalizedRoleName = roleName?.trim().toLowerCase() || '';
    const isAdmin = normalizedRoleName === 'admin';
    
    if (isAdmin) {
      const hasExplicit = await hasExplicitPermissions(roleId);
      
      if (hasExplicit) {
        // Admin has been migrated - check if permission is in available list
        const allAvailable = getAllAvailablePermissions();
        const allPermsList: string[] = [];
        for (const modulePerms of Object.values(allAvailable)) {
          if (Array.isArray(modulePerms)) {
            allPermsList.push(...modulePerms);
          }
        }
        if (allPermsList.includes(requiredPermission)) {
          return true;
        }
      }
    }

    // Backward compatibility: legacy wildcard
    const hasLegacyWildcard = legacyPermissions.includes('*') || legacyPermissions.includes('admin.*');
    
    if (hasLegacyWildcard) {
      try {
        await resolveRolePermissions(roleId, legacyPermissions);
        // Retry explicit check after conversion
        const retryCheck = await checkPermission(roleId, requiredPermission);
        if (retryCheck.allowed) {
          return true;
        }
        // If still not allowed after conversion, check if it's in available list (for Admin)
        if (isAdmin) {
          const allAvailable = getAllAvailablePermissions();
          const allPermsList: string[] = [];
          for (const modulePerms of Object.values(allAvailable)) {
            if (Array.isArray(modulePerms)) {
              allPermsList.push(...modulePerms);
            }
          }
          if (allPermsList.includes(requiredPermission)) {
            return true;
          }
        }
      } catch (error: any) {
        // If conversion fails, fall back to legacy check (for safety)
        // For Admin with wildcard, always allow (legacy behavior)
        if (isAdmin) {
          return true;
        }
      }
    }

    // Check exact permission (legacy)
    if (legacyPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check wildcard permissions (legacy)
    const permissionParts = requiredPermission.split('.');
    for (let i = permissionParts.length; i > 0; i--) {
      const wildcardPermission = permissionParts.slice(0, i).join('.') + '.*';
      if (legacyPermissions.includes(wildcardPermission)) {
        return true;
      }
    }

    return false;
  } catch (error: any) {
    logger.error(`Effective permission check error for role ${roleName}: ${error.message}`, error);
    return false; // Fail closed
  }
}

/**
 * Inspect permissions for a role
 */
export async function inspectRolePermissions(
  roleId: string,
  inspectorId?: string,
  inspectorUsername?: string
): Promise<PermissionInspectionResult> {
  try {
    let role;
    try {
      // Use explicit select to avoid querying category column if it doesn't exist
      role = await prisma.role.findUnique({
        where: { id: roleId },
        select: {
          id: true,
          name: true,
          status: true,
          permissions: true,
          // Don't select category - may not exist yet
          rolePermissions: true,
          users: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    } catch (dbError: any) {
      logger.error(`Database error fetching role ${roleId}:`, {
        message: dbError?.message,
        stack: dbError?.stack,
      });
      throw new Error(`Failed to fetch role ${roleId}: ${dbError?.message || 'Database error'}`);
    }

    if (!role) {
      throw new Error(`Role ${roleId} not found`);
    }

    // PART 3: Include role status in inspection
    const roleStatus = (role as any).status || 'ACTIVE';
    const isDeactivated = roleStatus === 'DEACTIVATED';
    const isSystemLocked = roleStatus === 'SYSTEM_LOCKED';

    // PART 3: Add warning if role is deactivated
    const warnings: string[] = [];
    if (isDeactivated) {
      warnings.push(`Role "${role.name}" is DEACTIVATED. Permissions are frozen and not granted at runtime.`);
    }

    // Get legacy permissions for compatibility resolution
    let legacyPermissions: string[] = [];
    const permissionsValue = role.permissions;
    if (permissionsValue) {
      if (Array.isArray(permissionsValue)) {
        const perms = permissionsValue as unknown[];
        legacyPermissions = perms.filter((p): p is string => typeof p === 'string');
      } else if (typeof permissionsValue === 'string') {
        legacyPermissions = [permissionsValue];
      }
    }

    // Resolve explicit permissions (with auto-conversion if needed)
    let resolvedPermissions: string[] = [];
    try {
      resolvedPermissions = await resolveRolePermissions(roleId, legacyPermissions);
    } catch (resolveError: any) {
      logger.warn(`Failed to resolve permissions for role ${roleId}: ${resolveError?.message}`);
      // Continue with empty resolved permissions - explicit permissions will still work
      resolvedPermissions = [];
    }

  // Get all available permissions to build complete matrix
  const allPermissions = getAllAvailablePermissions();

  // Build permission inspection details
  const modules: Record<string, ModuleInspection> = {};
  // Warnings already initialized above with deactivation warning
  let totalPermissions = 0;
  let effectiveAllowedCount = 0; // Runtime effective access
  let explicitlyDefinedCount = 0; // Explicitly granted or denied
  let systemRestrictedCount = 0; // Hard system blocks
  let sensitiveCount = 0;
  let cannotDetermineCount = 0;
  
  // Track access sources for effective access summary
  const accessSources = new Set<'explicit' | 'legacy' | 'system'>();
  const normalizedRoleName = role.name?.trim().toLowerCase() || '';
  const isAdmin = normalizedRoleName === 'admin';
  const hasExplicit = await hasExplicitPermissions(roleId);
  const hasLegacyWildcard = legacyPermissions.includes('*') || legacyPermissions.includes('admin.*');

  // Process each module
  for (const [moduleName, modulePerms] of Object.entries(allPermissions)) {
    const moduleInspection: ModuleInspection = {
      module: moduleName,
      submodules: {},
      moduleLevelPermissions: [],
    };

    // Process each permission in the module
    for (const permString of modulePerms) {
      try {
        totalPermissions++;
        const parsed = parsePermission(permString);
        
        if (!parsed) {
          warnings.push(`Invalid permission format: ${permString}`);
          cannotDetermineCount++;
          continue;
        }

      // Check if this permission is explicitly granted
      const rolePermission = role.rolePermissions.find(
        (rp) =>
          rp.module === parsed.module &&
          rp.submodule === (parsed.submodule ?? null) &&
          rp.action === parsed.action
      );

      // Check effective access (what actually works at runtime)
      let effectiveAllowed = false;
      try {
        effectiveAllowed = await checkEffectivePermission(roleId, role.name, legacyPermissions, permString);
      } catch (effError: any) {
        logger.warn(`Failed to check effective permission ${permString}: ${effError.message}`);
        // Fall back to explicit check
      }

      // Check explicit permission (for source classification)
      let explicitCheck: { allowed: boolean; reason?: string } = { allowed: false, reason: 'Permission check failed' };
      try {
        explicitCheck = await checkPermission(roleId, permString);
      } catch (checkError: any) {
        logger.warn(`Failed to check explicit permission ${permString}: ${checkError.message}`);
      }

      const isSensitive = SENSITIVE_PERMISSIONS.includes(permString as any);

      // Determine source and reason based on effective access AND explicit state
      // Initialize with defaults - will be overwritten by specific checks
      let source: PermissionSource = 'deny_by_default';
      let reason: string = 'No explicit permission granted (deny by default)';
      let isEffectiveAllowed = effectiveAllowed;

      // Check Admin/system-level access
      if (isAdmin && hasExplicit && !explicitCheck.allowed) {
        // Admin has access via system rule (available permissions list)
        const allAvailable = getAllAvailablePermissions();
        const allPermsList: string[] = [];
        for (const modulePerms of Object.values(allAvailable)) {
          if (Array.isArray(modulePerms)) {
            allPermsList.push(...modulePerms);
          }
        }
        if (allPermsList.includes(permString) && effectiveAllowed) {
          source = 'system_grant';
          reason = 'Granted via Admin role system rules (all available permissions)';
          accessSources.add('system');
          isEffectiveAllowed = true;
        }
      }

      // Check explicit permission
      if (source === 'deny_by_default' && rolePermission) {
        explicitlyDefinedCount++;
        if (rolePermission.granted) {
          source = 'explicit_grant';
          const createdByStr = rolePermission.createdBy ? ` by ${rolePermission.createdBy}` : '';
          const createdAtStr = rolePermission.createdAt ? ` on ${rolePermission.createdAt instanceof Date ? rolePermission.createdAt.toISOString() : String(rolePermission.createdAt)}` : '';
          reason = `Explicitly granted${createdByStr}${createdAtStr}`;
          accessSources.add('explicit');
        } else {
          source = 'explicit_deny';
          reason = `Explicitly denied${rolePermission.createdBy ? ` by ${rolePermission.createdBy}` : ''}`;
          isEffectiveAllowed = false; // Explicit deny overrides effective
        }
      }

      // Check legacy migration
      if (source === 'deny_by_default' && effectiveAllowed && (resolvedPermissions.includes(permString) || hasLegacyWildcard)) {
        source = 'legacy_migration';
        reason = 'Access granted through legacy permission system (compatibility mode active)';
        accessSources.add('legacy');
        if (!rolePermission) {
          // Not explicitly defined, but effective via legacy
          isEffectiveAllowed = true;
        }
      }

      // Check system restrictions (sensitive permissions)
      if (source === 'deny_by_default' && isSensitive && !effectiveAllowed) {
        source = 'system_restriction';
        reason = 'Sensitive permission denied by default (requires explicit grant)';
        systemRestrictedCount++;
        isEffectiveAllowed = false;
      }

      // Check cannot determine
      if (source === 'deny_by_default' && (!explicitCheck || explicitCheck.allowed === undefined)) {
        source = 'cannot_determine';
        reason = explicitCheck?.reason || 'Permission status could not be determined';
        cannotDetermineCount++;
      }

      // Final fallback: if still deny_by_default but effective access exists, update source
      if (source === 'deny_by_default' && effectiveAllowed) {
        // Effective access but not explicitly defined - likely legacy or system
        source = hasLegacyWildcard ? 'legacy_migration' : 'system_grant';
        reason = 'Access granted via compatibility rules';
        if (hasLegacyWildcard) {
          accessSources.add('legacy');
        } else {
          accessSources.add('system');
        }
        isEffectiveAllowed = true;
      } else if (source === 'deny_by_default' && !effectiveAllowed) {
        // No effective access - deny by default
        isEffectiveAllowed = false;
      }

      // Update effective allowed count
      if (isEffectiveAllowed) {
        effectiveAllowedCount++;
      }

      if (isSensitive) {
        sensitiveCount++;
      }

      // Query last usage for sensitive permissions from ActionAuditLog
      let lastUsed: Date | null = null;
      if (isSensitive && isEffectiveAllowed) {
        try {
          const lastUsage = await prisma.actionAuditLog.findFirst({
            where: {
              permissionUsed: permString,
              result: 'allowed',
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              createdAt: true,
            },
          });
          lastUsed = lastUsage?.createdAt || null;
        } catch (error: any) {
          logger.warn(`Failed to query last usage for ${permString}: ${error.message}`);
        }
      }

      // Determine status based on effective access (runtime result)
      let status: 'allowed' | 'denied' | 'cannot_determine' = 'denied';
      if (isEffectiveAllowed) {
        status = 'allowed';
      } else if (source === 'cannot_determine') {
        status = 'cannot_determine';
      } else {
        status = 'denied';
      }

      // Map source/status to resolution reason for clear UI explanation
      let resolutionReason: ResolutionReason = 'NOT_GRANTED_TO_ROLE';
      if (status === 'allowed') {
        // Any allowed status means explicitly granted (regardless of source mechanism)
        resolutionReason = 'EXPLICITLY_GRANTED';
      } else if (status === 'denied') {
        // Check source to determine the reason for denial
        // Note: 'inherited_role' is in PermissionSource type but not currently assigned in logic
        switch (source) {
          case 'explicit_deny':
            resolutionReason = 'NOT_GRANTED_TO_ROLE';
            break;
          case 'system_restriction':
            resolutionReason = 'SYSTEM_RESTRICTED';
            break;
          case 'deny_by_default':
          case 'cannot_determine':
          case 'explicit_grant':
          case 'system_grant':
          case 'legacy_migration':
          default:
            // Fallback for deny_by_default and any other denied sources
            // Note: 'inherited_role' would map to 'INHERITED_DENY' when implemented
            resolutionReason = 'NOT_GRANTED_TO_ROLE';
            break;
        }
      } else {
        // cannot_determine status
        resolutionReason = 'NOT_GRANTED_TO_ROLE';
      }

      const detail: PermissionInspectionDetail = {
        permission: permString,
        module: parsed.module,
        submodule: parsed.submodule ?? null,
        action: parsed.action,
        status,
        source,
        resolutionReason,
        reason,
        isSensitive,
        auditRequired: isSensitive, // Sensitive permissions require audit logging
        lastUsed: lastUsed || undefined,
        grantedAt: rolePermission?.createdAt || undefined,
        grantedBy: rolePermission?.createdBy || undefined,
      };

      // Categorize by submodule
      if (parsed.submodule) {
        if (!moduleInspection.submodules[parsed.submodule]) {
          moduleInspection.submodules[parsed.submodule] = {
            submodule: parsed.submodule,
            permissions: [],
          };
        }
        moduleInspection.submodules[parsed.submodule].permissions.push(detail);
      } else {
        moduleInspection.moduleLevelPermissions.push(detail);
      }
      } catch (permError: any) {
        logger.error(`Error processing permission ${permString} in module ${moduleName}:`, {
          message: permError?.message,
          stack: permError?.stack,
          permission: permString,
          module: moduleName,
        });
        warnings.push(`Error processing permission ${permString}: ${permError?.message || 'Unknown error'}`);
        cannotDetermineCount++;
        // Continue processing other permissions
      }
    }

    // Only include modules that have permissions
    if (Object.keys(moduleInspection.submodules).length > 0 || moduleInspection.moduleLevelPermissions.length > 0) {
      modules[moduleName] = moduleInspection;
    }
  }

  // Calculate effective access summary
  const effectiveAccessLevel: EffectiveAccessLevel = 
    effectiveAllowedCount === totalPermissions ? 'full' :
    effectiveAllowedCount > totalPermissions * 0.5 ? 'partial' :
    'restricted';
  
  const enforcementStatus: 'active' | 'compatibility_mode' = 
    hasExplicit ? 'active' : 'compatibility_mode';
  
  const grantedVia: ('explicit' | 'legacy' | 'system')[] = Array.from(accessSources);
  if (grantedVia.length === 0 && effectiveAllowedCount > 0) {
    // Default to system if we have effective access but no explicit source
    grantedVia.push('system');
  }
  
  let effectiveAccessDescription = '';
  if (effectiveAccessLevel === 'full') {
    effectiveAccessDescription = `Full access — ${effectiveAllowedCount} permissions granted`;
  } else if (effectiveAccessLevel === 'partial') {
    effectiveAccessDescription = `Partial access — ${effectiveAllowedCount} of ${totalPermissions} permissions granted`;
  } else {
    effectiveAccessDescription = `Restricted access — ${effectiveAllowedCount} of ${totalPermissions} permissions granted`;
  }
  
  if (enforcementStatus === 'compatibility_mode') {
    effectiveAccessDescription += ' via legacy compatibility rules';
  } else if (grantedVia.includes('legacy')) {
    effectiveAccessDescription += ' via legacy and explicit permissions';
  } else {
    effectiveAccessDescription += ' via explicit permissions';
  }
  
  const effectiveAccess: EffectiveAccessSummary = {
    level: effectiveAccessLevel,
    description: effectiveAccessDescription,
    grantedVia,
    enforcementStatus,
  };

  // Check for legacy compatibility (informational, not a warning)
  const explicitPermCount = role.rolePermissions.length;
  const resolvedPermCount = resolvedPermissions.length;
  if (explicitPermCount === 0 && resolvedPermCount === 0 && legacyPermissions.length > 0 && !hasLegacyWildcard) {
    // This is informational - legacy compatibility is working correctly
    // No warning needed - access is being granted via legacy rules
  } else if (hasLegacyWildcard && !hasExplicit) {
    // Admin or wildcard role - auto-conversion will happen on first access
    // This is normal and safe - no warning needed
  }

  return {
    inspectedEntity: {
      type: 'role',
      id: role.id,
      name: role.name,
      status: roleStatus, // PART 3: Include role status
    },
    inspectionMetadata: {
      timestamp: new Date(),
      resolverVersion: '1.0.0',
      inspectorId,
      inspectorUsername,
    },
    effectiveAccess,
    permissions: {
      modules,
      summary: {
        totalPermissions,
        effectiveAllowed: isDeactivated ? 0 : effectiveAllowedCount, // PART 3: Deactivated roles have 0 effective access
        explicitlyDefined: explicitlyDefinedCount,
        systemRestricted: systemRestrictedCount,
        sensitive: sensitiveCount,
        cannotDetermine: cannotDetermineCount,
      },
    },
    warnings, // PART 3: Already includes deactivation warning
  };
  } catch (error: any) {
    logger.error(`Error in inspectRolePermissions for role ${roleId}:`, {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    throw error;
  }
}

/**
 * Inspect permissions for a user (aggregates all their roles)
 */
export async function inspectUserPermissions(
  userId: string,
  inspectorId?: string,
  inspectorUsername?: string
): Promise<PermissionInspectionResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
    },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  if (!user.role) {
    throw new Error(`User ${userId} has no role assigned`);
  }

  // For now, users have a single role - inspect that role
  // Future: If multi-role support is added, aggregate permissions here
  const roleInspection = await inspectRolePermissions(user.role.id, inspectorId, inspectorUsername);

  // Update entity info for user
  return {
    ...roleInspection,
    inspectedEntity: {
      type: 'user',
      id: user.id,
      name: user.username || user.email || user.id,
      roles: [user.role.name],
    },
  };
}

/**
 * Log inspection event for audit
 */
export async function logInspectionEvent(
  inspectorId: string,
  inspectorUsername: string,
  inspectedType: 'role' | 'user',
  inspectedId: string,
  inspectedName: string,
  reason?: string
): Promise<void> {
  try {
    // Create inspection log entry (could be stored in ActionAuditLog or a separate table)
    logger.info(`Permission inspection: ${inspectorUsername} (${inspectorId}) inspected ${inspectedType} ${inspectedName} (${inspectedId})${reason ? ` - Reason: ${reason}` : ''}`);
    
    // Get inspector's role for logging
    const inspector = await prisma.user.findUnique({
      where: { id: inspectorId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            status: true,
            permissions: true,
            // Don't select category - may not exist yet
          },
        },
      },
    });

    // Log to ActionAuditLog
    await prisma.actionAuditLog.create({
      data: {
        userId: inspectorId,
        username: inspectorUsername,
        roleId: inspector?.roleId || 'unknown',
        roleName: inspector?.role?.name || 'unknown',
        permissionUsed: 'permissions.inspect',
        action: 'inspect',
        entityType: inspectedType,
        entityId: inspectedId,
        requestPath: `/api/permissions/inspect?type=${inspectedType}&id=${inspectedId}`,
        requestMethod: 'GET',
        requestContext: reason ? { reason, inspectedName } : { inspectedName },
        result: 'allowed',
      },
    });
  } catch (error: any) {
    logger.error(`Failed to log inspection event: ${error.message}`, error);
    // Don't throw - logging failure shouldn't break inspection
  }
}
