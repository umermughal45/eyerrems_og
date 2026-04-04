/**
 * Script to check and fix database migration issues
 * This script:
 * 1. Checks which columns are missing in the Property table
 * 2. Applies the migration SQL directly if needed
 * 3. Provides clear error messages
 * 
 * Usage:
 *   tsx scripts/check-and-fix-migration.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = current_schema()
        AND LOWER(table_name) = LOWER(${tableName}) 
        AND LOWER(column_name) = LOWER(${columnName})
    `;
    return result.length > 0;
  } catch (error) {
    console.error(`Error checking column ${columnName} in ${tableName}:`, error);
    return false;
  }
}

async function applyMigrationSQL() {
  console.log('📦 Reading migration SQL file...\n');
  
  const migrationPath = join(__dirname, '..', 'prisma', 'migrations', '20251230000000_add_tid_columns', 'migration.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration SQL file found\n');
    console.log('🔧 Applying migration SQL directly...\n');
    
    // Execute the migration SQL
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration SQL applied successfully!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Error applying migration SQL:', error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('⚠️  Some columns may already exist. This is okay.\n');
      return true; // Continue anyway
    }
    return false;
  }
}

async function checkAndFix() {
  console.log('🔍 Checking Property table columns...\n');
  
  // Check all columns that should exist according to schema
  const expectedColumns = [
    'id', 'name', 'type', 'address', 'location', 'propertySubsidiary',
    'subsidiaryOptionId', 'status', 'imageUrl', 'description', 'yearBuilt',
    'totalArea', 'totalUnits', 'dealerId', 'isDeleted', 'createdAt', 'updatedAt',
    'propertyCode', 'city', 'documents', 'ownerName', 'ownerPhone',
    'previousTenants', 'rentAmount', 'rentEscalationPercentage', 'securityDeposit',
    'size', 'title', 'locationId', 'propertySubsidiaryId', 'manualUniqueId', 'tid'
  ];
  
  const missingColumns: string[] = [];
  const existingColumns: string[] = [];
  
  for (const column of expectedColumns) {
    const exists = await checkColumnExists('Property', column);
    if (exists) {
      existingColumns.push(column);
      console.log(`✅ Property.${column} exists`);
    } else {
      missingColumns.push(column);
      console.log(`❌ Property.${column} is MISSING`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Existing: ${existingColumns.length} columns`);
  console.log(`   Missing: ${missingColumns.length} columns`);
  
  if (missingColumns.length === 0) {
    console.log('\n✅ All columns exist! No migration needed.\n');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`\n⚠️  Missing columns: ${missingColumns.join(', ')}\n`);
  
  // If tid is missing, apply the migration
  if (missingColumns.includes('tid')) {
    console.log('🔧 Applying TID migration...\n');
    const success = await applyMigrationSQL();
    
    if (success) {
      // Verify tid column now exists
      console.log('🔍 Verifying tid column...\n');
      const tidExists = await checkColumnExists('Property', 'tid');
      if (tidExists) {
        console.log('✅ Property.tid column now exists!\n');
      } else {
        console.log('❌ Property.tid column still missing after migration.\n');
        console.log('💡 Try running: npx prisma migrate deploy\n');
      }
    }
  } else {
    console.log('⚠️  Other columns are missing. Please check your migrations.\n');
    console.log('💡 Try running: npx prisma migrate deploy\n');
  }
  
  console.log('📝 Next steps:');
  console.log('   1. Regenerate Prisma Client: npx prisma generate');
  console.log('   2. Restart your server');
  console.log('   3. Test the properties page\n');
  
  await prisma.$disconnect();
}

// Run the check
checkAndFix().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

