#!/usr/bin/env tsx
/**
 * Data Migration Script: Property and Unit Schema Updates
 *
 * This script migrates existing data from JSON fields to new structured columns:
 * - Property: salePrice and amenities from documents JSON to direct fields
 * - Unit: Extract unitType and utilities from description field to new columns
 */
declare function migratePropertyData(): Promise<void>;
declare function migrateUnitData(): Promise<void>;
declare function validateMigration(): Promise<void>;
export { migratePropertyData, migrateUnitData, validateMigration };
//# sourceMappingURL=migrate-property-unit-data.d.ts.map