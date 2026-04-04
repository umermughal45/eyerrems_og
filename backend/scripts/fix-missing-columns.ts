/**
 * Script to fix missing database columns
 * This script:
 * 1. Adds tid column to Property, Client, Deal tables if missing
 * 2. Adds transactionType and purpose columns to FinanceLedger if missing
 * 3. Provides clear error messages
 * 
 * Usage:
 *   tsx scripts/fix-missing-columns.ts
 */

import { PrismaClient } from '@prisma/client';

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

async function addColumnIfMissing(tableName: string, columnName: string, columnType: string, defaultValue?: string) {
  const exists = await checkColumnExists(tableName, columnName);
  if (exists) {
    console.log(`✅ ${tableName}.${columnName} already exists`);
    return false;
  }

  console.log(`⚠️  ${tableName}.${columnName} is missing. Adding...`);
  
  try {
    const defaultValueClause = defaultValue ? `DEFAULT ${defaultValue}` : '';
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType} ${defaultValueClause}`
    );
    console.log(`✅ Added ${tableName}.${columnName}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error adding ${tableName}.${columnName}:`, error.message);
    return false;
  }
}

async function fixMissingColumns() {
  console.log('🔍 Checking for missing database columns...\n');

  let changesMade = false;

  // Check and add tid columns
  console.log('📋 Checking TID columns...\n');
  const tidTables = ['Property', 'Client', 'Deal'];
  for (const table of tidTables) {
    const added = await addColumnIfMissing(table, 'tid', 'TEXT', null);
    if (added) changesMade = true;
  }

  // Check and add subsidiaryOptionId to Property table
  console.log('\n📋 Checking Property.subsidiaryOptionId...\n');
  const addedSubsidiary = await addColumnIfMissing('Property', 'subsidiaryOptionId', 'TEXT', null);
  if (addedSubsidiary) {
    changesMade = true;
    // Create index if column was added
    try {
      const indexResult = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = current_schema()
          AND tablename = 'Property'
          AND indexname = 'Property_subsidiaryOptionId_idx'
      `;
      
      if (indexResult.length === 0) {
        console.log('📊 Creating index on Property.subsidiaryOptionId...');
        await prisma.$executeRawUnsafe(
          `CREATE INDEX "Property_subsidiaryOptionId_idx" ON "Property"("subsidiaryOptionId")`
        );
        console.log('✅ Created index on Property.subsidiaryOptionId');
        changesMade = true;
      }
    } catch (error: any) {
      console.warn('⚠️  Could not create index on Property.subsidiaryOptionId:', error.message);
    }

    // Add foreign key constraint if SubsidiaryOption table exists
    try {
      const tableExists = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = current_schema()
          AND LOWER(table_name) = 'subsidiaryoption'
      `;

      if (tableExists.length > 0) {
        const fkExists = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_schema = current_schema()
            AND table_name = 'Property'
            AND constraint_name = 'Property_subsidiaryOptionId_fkey'
        `;

        if (fkExists.length === 0) {
          console.log('📊 Creating foreign key constraint Property.subsidiaryOptionId -> SubsidiaryOption.id...');
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "Property" ADD CONSTRAINT "Property_subsidiaryOptionId_fkey" 
             FOREIGN KEY ("subsidiaryOptionId") REFERENCES "SubsidiaryOption"("id") ON DELETE SET NULL ON UPDATE CASCADE`
          );
          console.log('✅ Created foreign key constraint');
          changesMade = true;
        }
      }
    } catch (error: any) {
      console.warn('⚠️  Could not create foreign key constraint:', error.message);
    }
  }

  // Add unique index on tid if column was added
  for (const table of tidTables) {
    const exists = await checkColumnExists(table, 'tid');
    if (exists) {
      try {
        // Check if index exists
        const indexResult = await prisma.$queryRaw<Array<{ indexname: string }>>`
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = current_schema()
            AND tablename = ${table}
            AND indexname = ${`${table}_tid_key`}
        `;
        
        if (indexResult.length === 0) {
          console.log(`📊 Creating unique index on ${table}.tid...`);
          await prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX "${table}_tid_key" ON "${table}"("tid") WHERE "tid" IS NOT NULL`
          );
          console.log(`✅ Created unique index on ${table}.tid`);
          changesMade = true;
        } else {
          console.log(`✅ Index on ${table}.tid already exists`);
        }
      } catch (error: any) {
        console.warn(`⚠️  Could not create index on ${table}.tid:`, error.message);
      }
    }
  }

  // Check and add FinanceLedger columns
  console.log('\n📋 Checking FinanceLedger columns...\n');
  
  // Check if FinanceLedger table exists
  const tableExists = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = current_schema()
      AND LOWER(table_name) = 'financeledger'
  `;

  if (tableExists.length === 0) {
    console.log('⚠️  FinanceLedger table does not exist. Skipping FinanceLedger column checks.');
  } else {
    // Add transactionType if missing
    const addedTransactionType = await addColumnIfMissing('FinanceLedger', 'transactionType', 'TEXT');
    if (addedTransactionType) {
      changesMade = true;
      // Set default values for existing rows
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "FinanceLedger" SET "transactionType" = 'credit' WHERE "transactionType" IS NULL AND "amount" >= 0`
        );
        await prisma.$executeRawUnsafe(
          `UPDATE "FinanceLedger" SET "transactionType" = 'debit' WHERE "transactionType" IS NULL AND "amount" < 0`
        );
        console.log('✅ Set default transactionType values for existing FinanceLedger rows');
      } catch (error: any) {
        console.warn('⚠️  Could not set default transactionType values:', error.message);
      }
    }

    // Add purpose if missing
    const addedPurpose = await addColumnIfMissing('FinanceLedger', 'purpose', 'TEXT');
    if (addedPurpose) {
      changesMade = true;
      // Set default values for existing rows
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "FinanceLedger" SET "purpose" = COALESCE("category", 'general') WHERE "purpose" IS NULL`
        );
        console.log('✅ Set default purpose values for existing FinanceLedger rows');
      } catch (error: any) {
        console.warn('⚠️  Could not set default purpose values:', error.message);
      }
    }

    // Make dealId required if it's optional
    try {
      const dealIdNullable = await prisma.$queryRaw<Array<{ is_nullable: string }>>`
        SELECT is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = current_schema()
          AND table_name = 'FinanceLedger'
          AND column_name = 'dealId'
      `;
      
      if (dealIdNullable.length > 0 && dealIdNullable[0].is_nullable === 'YES') {
        // Check if there are any NULL dealId values
        const nullCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*) as count 
          FROM "FinanceLedger" 
          WHERE "dealId" IS NULL
        `;
        
        if (nullCount[0].count === BigInt(0)) {
          console.log('📊 Making dealId required in FinanceLedger...');
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "FinanceLedger" ALTER COLUMN "dealId" SET NOT NULL`
          );
          console.log('✅ Made dealId required in FinanceLedger');
          changesMade = true;
        } else {
          console.log(`⚠️  Cannot make dealId required: ${nullCount[0].count} rows have NULL dealId`);
        }
      }
    } catch (error: any) {
      console.warn('⚠️  Could not check/modify dealId constraint:', error.message);
    }

    // Create index on transactionType if it doesn't exist
    if (await checkColumnExists('FinanceLedger', 'transactionType')) {
      try {
        const indexResult = await prisma.$queryRaw<Array<{ indexname: string }>>`
          SELECT indexname 
          FROM pg_indexes 
          WHERE schemaname = current_schema()
            AND tablename = 'FinanceLedger'
            AND indexname = 'FinanceLedger_transactionType_idx'
        `;
        
        if (indexResult.length === 0) {
          console.log('📊 Creating index on FinanceLedger.transactionType...');
          await prisma.$executeRawUnsafe(
            `CREATE INDEX "FinanceLedger_transactionType_idx" ON "FinanceLedger"("transactionType")`
          );
          console.log('✅ Created index on FinanceLedger.transactionType');
          changesMade = true;
        }
      } catch (error: any) {
        console.warn('⚠️  Could not create index on transactionType:', error.message);
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  if (changesMade) {
    console.log('✅ Fixed missing columns!');
    console.log('\n📝 Next steps:');
    console.log('   1. Regenerate Prisma Client: npx prisma generate');
    console.log('   2. Restart your server');
    console.log('   3. Test the endpoints\n');
  } else {
    console.log('✅ All columns are present. No changes needed.\n');
  }

  await prisma.$disconnect();
}

// Run the fix
fixMissingColumns().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

