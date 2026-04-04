/**
 * Script to apply the TID column migration
 * This script applies the migration that adds the tid column to Property, Client, and Deal tables
 * 
 * Usage:
 *   tsx scripts/apply-tid-migration.ts
 * 
 * Or via npm:
 *   npm run apply-tid-migration
 */

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = ${tableName} 
    AND column_name = ${columnName}
  `;
  return result.length > 0;
}

async function applyMigration() {
  console.log('🔍 Checking if TID columns exist...\n');

  const tables = ['Property', 'Client', 'Deal', 'Unit', 'Lease', 'Sale'];
  const missingColumns: string[] = [];

  for (const table of tables) {
    const exists = await checkColumnExists(table, 'tid');
    if (exists) {
      console.log(`✅ ${table}.tid column exists`);
    } else {
      console.log(`❌ ${table}.tid column is missing`);
      missingColumns.push(table);
    }
  }

  // Check indexes
  const uniqueIndexes = await prisma.$queryRaw<Array<{ indexname: string, tablename: string }>>`
    SELECT indexname, tablename 
    FROM pg_indexes 
    WHERE indexname LIKE '%_tid_key'
  `;
  console.log('\nExisting Unique TID Indexes:');
  uniqueIndexes.forEach(idx => console.log(`- ${idx.tablename}: ${idx.indexname}`));

  if (missingColumns.length === 0) {
    console.log('\n✅ All TID columns already exist. Migration might not be needed.');
    // await prisma.$disconnect();
    // return;
  }

  console.log(`\n⚠️  Missing columns in: ${missingColumns.join(', ')}`);
  console.log('📦 Applying migration...\n');

  try {
    // Run the migration
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });

    console.log('\n✅ Migration applied successfully!');

    // Verify again
    console.log('\n🔍 Verifying migration...\n');
    let allExist = true;
    for (const table of tables) {
      const exists = await checkColumnExists(table, 'tid');
      if (exists) {
        console.log(`✅ ${table}.tid column now exists`);
      } else {
        console.log(`❌ ${table}.tid column still missing`);
        allExist = false;
      }
    }

    if (allExist) {
      console.log('\n✅ All columns verified successfully!');
    } else {
      console.log('\n⚠️  Some columns are still missing. Please check the migration manually.');
    }
  } catch (error) {
    console.error('\n❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
applyMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

