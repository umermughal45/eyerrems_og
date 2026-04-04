"use strict";
/**
 * Permission Comparison Service
 *
 * Compares permission sets to ensure reassignment changes permission lineage.
 * Used to prevent semantic bypasses where roles have equivalent permissions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPermissionFingerprint = createPermissionFingerprint;
exports.calculatePermissionSimilarity = calculatePermissionSimilarity;
exports.arePermissionsEquivalent = arePermissionsEquivalent;
exports.calculatePermissionDelta = calculatePermissionDelta;
const permission_service_1 = require("./permission-service");
/**
 * Create permission fingerprint from role permissions
 */
async function createPermissionFingerprint(roleId) {
    const permissions = await (0, permission_service_1.getRolePermissions)(roleId);
    const granted = new Set();
    const denied = new Set();
    for (const perm of permissions) {
        const path = perm.submodule
            ? `${perm.module}.${perm.submodule}.${perm.action}`
            : `${perm.module}.${perm.action}`;
        if (perm.granted) {
            granted.add(path);
        }
        else {
            denied.add(path);
        }
    }
    return {
        granted,
        denied,
        total: granted.size + denied.size,
    };
}
/**
 * Calculate similarity between two permission fingerprints
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function calculatePermissionSimilarity(from, to) {
    if (from.total === 0 && to.total === 0) {
        return 1.0; // Both have no permissions = identical
    }
    if (from.total === 0 || to.total === 0) {
        return 0.0; // One has permissions, other doesn't = completely different
    }
    // Calculate Jaccard similarity for granted permissions
    const grantedIntersection = new Set([...from.granted].filter(x => to.granted.has(x)));
    const grantedUnion = new Set([...from.granted, ...to.granted]);
    const grantedSimilarity = grantedUnion.size > 0
        ? grantedIntersection.size / grantedUnion.size
        : 0;
    // Calculate Jaccard similarity for denied permissions
    const deniedIntersection = new Set([...from.denied].filter(x => to.denied.has(x)));
    const deniedUnion = new Set([...from.denied, ...to.denied]);
    const deniedSimilarity = deniedUnion.size > 0
        ? deniedIntersection.size / deniedUnion.size
        : 0;
    // Weighted average (granted permissions are more important)
    const totalSimilarity = (grantedSimilarity * 0.7) + (deniedSimilarity * 0.3);
    return totalSimilarity;
}
/**
 * Check if two permission sets are equivalent
 * Returns true if similarity >= 95% (considered equivalent)
 */
async function arePermissionsEquivalent(fromRoleId, toRoleId) {
    const fromFingerprint = await createPermissionFingerprint(fromRoleId);
    const toFingerprint = await createPermissionFingerprint(toRoleId);
    const similarity = calculatePermissionSimilarity(fromFingerprint, toFingerprint);
    // ≥95% similarity = equivalent (invalid reassignment)
    return similarity >= 0.95;
}
/**
 * Calculate permission delta between two roles
 */
async function calculatePermissionDelta(fromRoleId, toRoleId) {
    const fromFingerprint = await createPermissionFingerprint(fromRoleId);
    const toFingerprint = await createPermissionFingerprint(toRoleId);
    const added = [...toFingerprint.granted].filter(perm => !fromFingerprint.granted.has(perm));
    const removed = [...fromFingerprint.granted].filter(perm => !toFingerprint.granted.has(perm));
    const unchanged = [...fromFingerprint.granted].filter(perm => toFingerprint.granted.has(perm));
    return {
        added: added.sort(),
        removed: removed.sort(),
        unchanged: unchanged.sort(),
    };
}
//# sourceMappingURL=permission-comparison.js.map