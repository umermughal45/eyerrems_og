/**
 * Centralized ID Generation Service
 *
 * Generates system IDs in format: {prefix}-{YY}-{####}
 * - prefix: module identifier (prop, pay, cli, lead, deal, etc.)
 * - YY: last 2 digits of current year
 * - ####: 4-digit incremental counter per module per year
 *
 * Features:
 * - Atomic operations to prevent race conditions
 * - Year-based counter reset
 * - Continues from highest existing ID
 * - Thread-safe using database transactions
 */
import { Prisma } from '../prisma/client';
export type ModulePrefix = 'prop' | 'pay' | 'cli' | 'lead' | 'deal' | 'dl' | 'rcp' | 'inv' | 'txn' | 'je' | 'vch' | 'ten' | 'tkt' | 'ntc' | 'emp' | 'ldg';
export declare function generateSequenceNumber(prefix: string): Promise<number>;
/**
 * Generate system ID for a module
 * Format: {prefix}-{YY}-{####}
 *
 * @param modulePrefix - Module prefix (prop, pay, cli, etc.)
 * @param tx - Optional transaction client for atomic operations
 * @returns Generated system ID
 */
export declare function generateSystemId(modulePrefix: ModulePrefix, tx?: Prisma.TransactionClient): Promise<string>;
/**
 * Validate manual unique ID
 * Ensures it doesn't conflict with system IDs
 *
 * @param manualId - User-provided manual ID
 * @param modulePrefix - Module prefix to check against
 * @param excludeId - Optional ID to exclude from check (for updates)
 * @param tx - Optional transaction client
 * @returns true if valid, throws error if invalid
 */
export declare function validateManualUniqueId(manualId: string, modulePrefix: ModulePrefix, excludeId?: string, tx?: Prisma.TransactionClient): Promise<boolean>;
/**
 * Validate TID (Transaction ID) - must be unique across Property, Deal, Client, Lead, Employee, and Tenant
 *
 * @param tid - Transaction ID to validate
 * @param excludePropertyId - Optional property ID to exclude from check (for updates)
 * @param excludeDealId - Optional deal ID to exclude from check (for updates)
 * @param excludeClientId - Optional client ID to exclude from check (for updates)
 * @param excludeLeadId - Optional lead ID to exclude from check (for updates)
 * @param excludeEmployeeId - Optional employee ID to exclude from check (for updates)
 * @param excludeTenantId - Optional tenant ID to exclude from check (for updates)
 * @param tx - Optional transaction client
 * @returns true if valid, throws error if invalid
 */
export declare function validateTID(tid: string, excludePropertyId?: string, excludeDealId?: string, excludeClientId?: string, excludeLeadId?: string, excludeEmployeeId?: string, excludeTenantId?: string, tx?: Prisma.TransactionClient): Promise<boolean>;
/**
 * Generate a prefixed ID for special cases like converted entities
 * Format: {customPrefix}-{XXXX}
 * Example: L-CLI-0001 for lead-converted clients
 *
 * @param customPrefix - The custom prefix (e.g., 'L-CLI')
 * @param entityType - The entity type for uniqueness checking
 * @param tx - Optional transaction client
 * @returns Generated prefixed ID
 */
export declare function generatePrefixedId(customPrefix: string, entityType: ModulePrefix, tx?: Prisma.TransactionClient): Promise<string>;
/**
 * Extract year and counter from system ID
 * Useful for migration or analysis
 */
export declare function parseSystemId(systemId: string): {
    prefix: string;
    year: number;
    counter: number;
} | null;
//# sourceMappingURL=id-generation-service.d.ts.map