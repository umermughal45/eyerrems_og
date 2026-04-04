/**
 * Permission Inspector Service
 *
 * Provides read-only inspection of effective permissions with full explanations.
 * Used for compliance, debugging, and audit verification.
 *
 * NO MODIFICATIONS - READ-ONLY ONLY
 */
/**
 * Sensitive permissions that require special highlighting
 */
export declare const SENSITIVE_PERMISSIONS: readonly ["ai.override_decision", "ai.view_explanations", "finance.modify_posted_entries", "finance.delete_transactions", "audit.view_logs"];
/**
 * Permission source types
 */
export type PermissionSource = 'explicit_grant' | 'explicit_deny' | 'inherited_role' | 'system_restriction' | 'deny_by_default' | 'legacy_migration' | 'system_grant' | 'cannot_determine';
/**
 * Resolution reason for why a permission is allowed or denied
 * Used for clear, auditable explanations in the UI
 */
export type ResolutionReason = 'EXPLICITLY_GRANTED' | 'NOT_GRANTED_TO_ROLE' | 'MODULE_ACCESS_DISABLED' | 'SYSTEM_RESTRICTED' | 'REQUIRES_HIGHER_ROLE' | 'INHERITED_DENY';
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
    resolutionReason: ResolutionReason;
    reason: string;
    isSensitive: boolean;
    auditRequired?: boolean;
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
    moduleLevelPermissions: PermissionInspectionDetail[];
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
        status?: string;
        roles?: string[];
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
            effectiveAllowed: number;
            explicitlyDefined: number;
            systemRestricted: number;
            sensitive: number;
            cannotDetermine: number;
        };
    };
    warnings: string[];
}
/**
 * Inspect permissions for a role
 */
export declare function inspectRolePermissions(roleId: string, inspectorId?: string, inspectorUsername?: string): Promise<PermissionInspectionResult>;
/**
 * Inspect permissions for a user (aggregates all their roles)
 */
export declare function inspectUserPermissions(userId: string, inspectorId?: string, inspectorUsername?: string): Promise<PermissionInspectionResult>;
/**
 * Log inspection event for audit
 */
export declare function logInspectionEvent(inspectorId: string, inspectorUsername: string, inspectedType: 'role' | 'user', inspectedId: string, inspectedName: string, reason?: string): Promise<void>;
//# sourceMappingURL=permission-inspector.d.ts.map