#!/usr/bin/env ts-node

/**
 * Migration Runner Script
 * 
 * This script runs the database migration and data migration for the schema fixes.
 * It should be run after updating the Prisma schema.
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { migratePropertyData, migrateUnitData, validateMigration } from './src/scripts/migrate-property-unit-data';

const prisma = new PrismaClient();

async function runDatabaseMigration() {
  console.log('🔄 Running Prisma database migration...');
  
  try {
    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Push schema changes to database
    console.log('🚀 Pushing schema changes to database...');
    execSync('npx prisma db push', { stdio: 'inherit' });
    
    console.log('✅ Database migration completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
}

async function runDataMigration() {
  console.log('🔄 Running data migration...');
  
  try {
    await migratePropertyData();
    await migrateUnitData();
    await validateMigration();
    
    console.log('✅ Data migration completed successfully');
  } catch (error) {
    console.error('❌ Data migration failed:', error);
    throw error;
  }
}

async function verifySchemaChanges() {
  console.log('🔍 Verifying schema changes...');
  
  try {
    // Test that new columns exist by running a simple query
    await prisma.$queryRaw`SELECT "salePrice", "amenities" FROM "Property" LIMIT 1`;
    await prisma.$queryRaw`SELECT "unitType", "sizeSqFt", "securityDeposit", "utilitiesIncluded" FROM "Unit" LIMIT 1`;
    
    console.log('✅ Schema verification passed - all new columns exist');
  } catch (error) {
    console.error('❌ Schema verification failed:', error);
    console.error('This might indicate that the database migration did not complete successfully.');
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Property and Unit schema migration...');
  console.log('This will:');
  console.log('  1. Update database schema with new columns');
  console.log('  2. Migrate existing data from JSON fields to new columns');
  console.log('  3. Validate the migration results');
  console.log('');
  
  try {
    // Step 1: Run database migration
    await runDatabaseMigration();
    
    // Step 2: Verify schema changes
    await verifySchemaChanges();
    
    // Step 3: Run data migration
    await runDataMigration();
    
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test the API endpoints to ensure they work correctly');
    console.log('  2. Run the test suite: npm test');
    console.log('  3. Deploy the changes to your environment');
    console.log('');
    console.log('The following endpoints should now work without 400 errors:');
    console.log('  - POST /api/properties (with salePrice and amenities)');
    console.log('  - PUT /api/properties/:id (with salePrice and amenities)');
    console.log('  - POST /api/units (with unitType, sizeSqFt, securityDeposit, utilitiesIncluded)');
    console.log('  - PUT /api/units/:id (with unitType, sizeSqFt, securityDeposit, utilitiesIncluded)');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    console.error('');
    console.error('Please check the error above and fix any issues before retrying.');
    console.error('You may need to:');
    console.error('  1. Check your database connection');
    console.error('  2. Ensure Prisma schema is correct');
    console.error('  3. Verify database permissions');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
if (require.main === module) {
  main();
}