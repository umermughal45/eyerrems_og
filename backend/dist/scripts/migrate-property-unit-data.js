#!/usr/bin/env tsx
"use strict";
/**
 * Data Migration Script: Property and Unit Schema Updates
 *
 * This script migrates existing data from JSON fields to new structured columns:
 * - Property: salePrice and amenities from documents JSON to direct fields
 * - Unit: Extract unitType and utilities from description field to new columns
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migratePropertyData = migratePropertyData;
exports.migrateUnitData = migrateUnitData;
exports.validateMigration = validateMigration;
const client_1 = __importDefault(require("../prisma/client"));
async function migratePropertyData() {
    console.log('🔄 Starting Property data migration...');
    try {
        // Get all properties with documents data
        const properties = await client_1.default.property.findMany({
            where: {
                documents: { not: null },
                isDeleted: false
            }
        });
        console.log(`📊 Found ${properties.length} properties with documents data`);
        let migratedCount = 0;
        let errorCount = 0;
        for (const property of properties) {
            try {
                const docs = property.documents;
                const updateData = {};
                // Migrate salePrice
                if (docs?.salePrice && typeof docs.salePrice === 'number') {
                    updateData.salePrice = docs.salePrice;
                }
                // Migrate amenities
                if (Array.isArray(docs?.amenities)) {
                    updateData.amenities = docs.amenities;
                }
                else if (!property.amenities || property.amenities.length === 0) {
                    updateData.amenities = [];
                }
                // Only update if we have data to migrate
                if (Object.keys(updateData).length > 0) {
                    await client_1.default.property.update({
                        where: { id: property.id },
                        data: updateData
                    });
                    console.log(`✅ Migrated property ${property.id}: ${property.name}`);
                    migratedCount++;
                }
            }
            catch (error) {
                console.error(`❌ Error migrating property ${property.id}:`, error);
                errorCount++;
            }
        }
        console.log(`✅ Property migration completed: ${migratedCount} migrated, ${errorCount} errors`);
    }
    catch (error) {
        console.error('❌ Property migration failed:', error);
        throw error;
    }
}
async function migrateUnitData() {
    console.log('🔄 Starting Unit data migration...');
    try {
        // Get all units with description data that might contain structured info
        const units = await client_1.default.unit.findMany({
            where: {
                description: { not: null },
                isDeleted: false
            }
        });
        console.log(`📊 Found ${units.length} units with description data`);
        let migratedCount = 0;
        let errorCount = 0;
        for (const unit of units) {
            try {
                const description = unit.description || '';
                const updateData = {};
                // Try to extract structured data from description
                // Look for patterns like "Type: 2BHK" or "Size: 1200 sqft"
                const typeMatch = description.match(/(?:Type|Unit Type):\s*([^\n|]+)/i);
                const sizeMatch = description.match(/(?:Size|Area):\s*(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sqft|square feet)/i);
                const depositMatch = description.match(/(?:Deposit|Security Deposit):\s*(\d+(?:\.\d+)?)/i);
                const utilitiesMatch = description.match(/(?:Utilities|Included):\s*([^\n|]+)/i);
                if (typeMatch) {
                    updateData.unitType = typeMatch[1].trim();
                }
                if (sizeMatch) {
                    updateData.sizeSqFt = parseFloat(sizeMatch[1]);
                }
                if (depositMatch) {
                    updateData.securityDeposit = parseFloat(depositMatch[1]);
                }
                if (utilitiesMatch) {
                    // Split utilities by comma and clean up
                    const utilities = utilitiesMatch[1]
                        .split(/[,|]/)
                        .map(u => u.trim())
                        .filter(u => u.length > 0);
                    updateData.utilitiesIncluded = utilities;
                }
                else {
                    updateData.utilitiesIncluded = [];
                }
                // Only update if we extracted some data
                if (Object.keys(updateData).length > 0) {
                    await client_1.default.unit.update({
                        where: { id: unit.id },
                        data: updateData
                    });
                    console.log(`✅ Migrated unit ${unit.id}: ${unit.unitName} (${Object.keys(updateData).join(', ')})`);
                    migratedCount++;
                }
            }
            catch (error) {
                console.error(`❌ Error migrating unit ${unit.id}:`, error);
                errorCount++;
            }
        }
        console.log(`✅ Unit migration completed: ${migratedCount} migrated, ${errorCount} errors`);
    }
    catch (error) {
        console.error('❌ Unit migration failed:', error);
        throw error;
    }
}
async function validateMigration() {
    console.log('🔍 Validating migration...');
    try {
        // Check properties
        const propertiesWithSalePrice = await client_1.default.property.count({
            where: { salePrice: { not: null } }
        });
        const propertiesWithAmenities = await client_1.default.property.count({
            where: { amenities: { isEmpty: false } }
        });
        // Check units
        const unitsWithType = await client_1.default.unit.count({
            where: { unitType: { not: null } }
        });
        const unitsWithSize = await client_1.default.unit.count({
            where: { sizeSqFt: { not: null } }
        });
        const unitsWithDeposit = await client_1.default.unit.count({
            where: { securityDeposit: { not: null } }
        });
        console.log('📊 Migration Results:');
        console.log(`   Properties with salePrice: ${propertiesWithSalePrice}`);
        console.log(`   Properties with amenities: ${propertiesWithAmenities}`);
        console.log(`   Units with unitType: ${unitsWithType}`);
        console.log(`   Units with sizeSqFt: ${unitsWithSize}`);
        console.log(`   Units with securityDeposit: ${unitsWithDeposit}`);
    }
    catch (error) {
        console.error('❌ Validation failed:', error);
        throw error;
    }
}
async function main() {
    console.log('🚀 Starting Property and Unit data migration...');
    try {
        await migratePropertyData();
        await migrateUnitData();
        await validateMigration();
        console.log('🎉 Migration completed successfully!');
    }
    catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
    finally {
        await client_1.default.$disconnect();
    }
}
// Run the migration
if (require.main === module) {
    main();
}
//# sourceMappingURL=migrate-property-unit-data.js.map