/**
 * Script to add missing locationId and subsidiaryOptionId columns to Deal table
 * Run with: railway run --service EYER-REMS-v1 tsx scripts/fix-deal-location-id.ts
 */

import prisma from '../src/prisma/client';

async function fixDealColumns() {
  console.log('🔧 Fixing Deal table columns...\n');

  try {
    // Add locationId column
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Deal' AND column_name = 'locationId'
        ) THEN
          ALTER TABLE "Deal" ADD COLUMN "locationId" TEXT;
          RAISE NOTICE 'Added locationId column to Deal table';
        ELSE
          RAISE NOTICE 'locationId column already exists';
        END IF;
      END $$;
    `;
    console.log('✅ Checked locationId column');

    // Add subsidiaryOptionId column
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'Deal' AND column_name = 'subsidiaryOptionId'
        ) THEN
          ALTER TABLE "Deal" ADD COLUMN "subsidiaryOptionId" TEXT;
          RAISE NOTICE 'Added subsidiaryOptionId column to Deal table';
        ELSE
          RAISE NOTICE 'subsidiaryOptionId column already exists';
        END IF;
      END $$;
    `;
    console.log('✅ Checked subsidiaryOptionId column');

    // Create indexes
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Deal_locationId_idx" ON "Deal"("locationId");`;
    console.log('✅ Created locationId index');

    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "Deal_subsidiaryOptionId_idx" ON "Deal"("subsidiaryOptionId");`;
    console.log('✅ Created subsidiaryOptionId index');

    // Add foreign key constraint for locationId
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'Deal_locationId_fkey'
        ) THEN
          ALTER TABLE "Deal" ADD CONSTRAINT "Deal_locationId_fkey" 
          FOREIGN KEY ("locationId") 
          REFERENCES "Location"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
          RAISE NOTICE 'Added foreign key constraint Deal_locationId_fkey';
        ELSE
          RAISE NOTICE 'Foreign key constraint Deal_locationId_fkey already exists';
        END IF;
      END $$;
    `;
    console.log('✅ Checked locationId foreign key');

    // Add foreign key constraint for subsidiaryOptionId
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'SubsidiaryOption'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'Deal_subsidiaryOptionId_fkey'
        ) THEN
          ALTER TABLE "Deal" ADD CONSTRAINT "Deal_subsidiaryOptionId_fkey" 
          FOREIGN KEY ("subsidiaryOptionId") 
          REFERENCES "SubsidiaryOption"("id") 
          ON DELETE SET NULL ON UPDATE CASCADE;
          RAISE NOTICE 'Added foreign key constraint Deal_subsidiaryOptionId_fkey';
        ELSE
          RAISE NOTICE 'Foreign key constraint already exists or SubsidiaryOption table does not exist';
        END IF;
      END $$;
    `;
    console.log('✅ Checked subsidiaryOptionId foreign key');

    console.log('\n🎉 Successfully fixed Deal table columns!');
    console.log('Your properties page should work now. Please refresh your application.\n');
  } catch (error: any) {
    console.error('❌ Error fixing Deal table:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixDealColumns()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

