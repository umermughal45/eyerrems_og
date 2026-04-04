"use strict";
/**
 * Permission System Type Definitions
 *
 * Centralized type definitions for the permission system.
 * Following TypeScript best practices and enterprise standards.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SENSITIVE_PERMISSIONS = exports.RESTRICTED_ACTIONS = exports.STANDARD_ACTIONS = void 0;
/**
 * Standard permission actions
 */
exports.STANDARD_ACTIONS = [
    'view',
    'create',
    'edit',
    'delete',
    'approve',
    'export',
];
/**
 * Restricted permission actions (require explicit grant)
 */
exports.RESTRICTED_ACTIONS = [
    'override',
];
/**
 * Sensitive permissions requiring special handling
 */
exports.SENSITIVE_PERMISSIONS = [
    'ai.override_decision',
    'ai.view_explanations',
    'finance.modify_posted_entries',
    'finance.delete_transactions',
    'audit.view_logs',
];
//# sourceMappingURL=types.js.map