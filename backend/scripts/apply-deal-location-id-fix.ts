/**
 * Script to apply the Deal locationId and subsidiaryOptionId columns fix
 * This script applies the SQL migration that adds locationId and subsidiaryOptionId to Deal table
 * 
 * Usage:
 *   tsx scripts/apply-deal-location-id-fix.ts
 * 
 * Or via npm:
 *   npm run apply-deal-location-id-fix
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName} 
      AND column_name = ${columnName}
    `;
    return result.length > 0;
  } catch (error) {
    console.error(`Error checking column ${columnName} in ${tableName}:`, error);
    return false;
  }
}

async function applyMigration() {
  console.log('🔍 Checking if Deal locationId and subsidiaryOptionId columns exist...\n');

  const locationIdExists = await checkColumnExists('Deal', 'locationId');
  const subsidiaryOptionIdExists = await checkColumnExists('Deal', 'subsidiaryOptionId');

  if (locationIdExists && subsidiaryOptionIdExists) {
    console.log('✅ Both columns already exist. Migration not needed.');
    await prisma.$disconnect();
    return;
  }

  if (!locationIdExists) {
    console.log('❌ Deal.locationId column is missing');
  }
  if (!subsidiaryOptionIdExists) {
    console.log('❌ Deal.subsidiaryOptionId column is missing');
  }

  console.log('\n📦 Reading migration SQL file...\n');
  
  const migrationPath = join(__dirname, '..', 'prisma', 'migrations', 'fix_deal_location_id.sql');
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration SQL file found\n');
    console.log('🔧 Applying migration SQL directly...\n');
    
    // Execute the migration SQL
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration SQL applied successfully!\n');

    // Verify again
    console.log('🔍 Verifying migration...\n');
    const locationIdNowExists = await checkColumnExists('Deal', 'locationId');
    const subsidiaryOptionIdNowExists = await checkColumnExists('Deal', 'subsidiaryOptionId');

    if (locationIdNowExists) {
      console.log('✅ Deal.locationId column now exists');
    } else {
      console.log('❌ Deal.locationId column still missing');
    }

    if (subsidiaryOptionIdNowExists) {
      console.log('✅ Deal.subsidiaryOptionId column now exists');
    } else {
      console.log('❌ Deal.subsidiaryOptionId column still missing');
    }

    if (locationIdNowExists && subsidiaryOptionIdNowExists) {
      console.log('\n✅ All columns verified successfully!');
    } else {
      console.log('\n⚠️  Some columns are still missing. Please check the migration manually.');
    }
  } catch (error: any) {
    console.error('❌ Error applying migration SQL:', error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log('⚠️  Some columns may already exist. This is okay.\n');
      // Check what actually exists
      const locationIdExists = await checkColumnExists('Deal', 'locationId');
      const subsidiaryOptionIdExists = await checkColumnExists('Deal', 'subsidiaryOptionId');
      if (locationIdExists && subsidiaryOptionIdExists) {
        console.log('✅ Both columns exist. Migration successful.');
      }
    } else {
      console.error('Full error:', error);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
applyMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

