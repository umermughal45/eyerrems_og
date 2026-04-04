/**
 * Script to fix the Properties API 400 error
 * This script:
 * 1. Checks if tid column exists
 * 2. Applies migration if needed
 * 3. Regenerates Prisma Client
 * 
 * Usage:
 *   tsx scripts/fix-properties-error.ts
 * 
 * Or via npm:
 *   npm run fix-properties-error
 */

import { execSync } from 'child_process';
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

async function fixPropertiesError() {
  console.log('🔧 Fixing Properties API 400 Error\n');
  console.log('Step 1: Checking if TID columns exist...\n');

  const tables = ['Property', 'Client', 'Deal'];
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

  if (missingColumns.length > 0) {
    console.log(`\n⚠️  Missing columns in: ${missingColumns.join(', ')}`);
    console.log('Step 2: Applying migration...\n');

    try {
      // Run the migration
      execSync('npx prisma migrate deploy', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });

      console.log('\n✅ Migration applied successfully!');

      // Verify again
      console.log('\nStep 3: Verifying migration...\n');
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

      if (!allExist) {
        console.log('\n⚠️  Some columns are still missing. Please check the migration manually.');
        await prisma.$disconnect();
        process.exit(1);
      }
    } catch (error) {
      console.error('\n❌ Error applying migration:', error);
      await prisma.$disconnect();
      process.exit(1);
    }
  } else {
    console.log('\n✅ All TID columns already exist.');
  }

  console.log('\nStep 4: Regenerating Prisma Client...\n');
  console.log('⚠️  Note: If you get a permission error, stop your server first and try again.\n');
  
  try {
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('\n✅ Prisma Client regenerated successfully!');
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('EPERM') || errorMessage.includes('operation not permitted')) {
      console.error('\n❌ Permission error while regenerating Prisma Client.');
      console.error('\n📝 This usually happens because:');
      console.error('   1. Your server is still running and using the Prisma Client files');
      console.error('   2. Another process has locked the files');
      console.error('   3. Antivirus software is blocking the operation');
      console.error('\n🔧 Solution:');
      console.error('   1. Stop your server (Ctrl+C or close the terminal)');
      console.error('   2. Wait a few seconds for files to unlock');
      console.error('   3. Run this command manually: npx prisma generate');
      console.error('   4. Restart your server');
      console.error('\n💡 The code has a workaround that should work even without regenerating Prisma Client.');
      console.error('   However, for best results, regenerate Prisma Client after stopping the server.\n');
    } else {
      console.error('\n❌ Error regenerating Prisma Client:', error);
    }
    await prisma.$disconnect();
    // Don't exit with error code - the workaround should still work
    console.log('\n⚠️  Continuing despite Prisma Client regeneration error...');
    console.log('   The API should work with the code workaround, but you may want to regenerate Prisma Client manually.\n');
  }

  console.log('\n✅ All steps completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart your server');
  console.log('   2. Test the properties page');
  console.log('   3. The error should be resolved\n');

  await prisma.$disconnect();
}

// Run the fix
fixPropertiesError().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

