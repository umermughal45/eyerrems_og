/**
 * Permission System Migration Script
 *
 * Converts Admin wildcard permissions to explicit permission grants
 * Leaves other roles untouched (they will auto-convert on first access)
 *
 * This migration is:
 * - Idempotent (safe to run multiple times)
 * - Reversible (can be rolled back)
 * - Safe (doesn't break existing functionality)
 */
declare function migratePermissions(): Promise<void>;
export default migratePermissions;
//# sourceMappingURL=migrate-permissions.d.ts.map