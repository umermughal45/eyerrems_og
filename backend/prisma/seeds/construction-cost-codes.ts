/**
 * Construction Cost Codes Seed
 * Standard hierarchical cost codes: Trade → Activity → Task
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const costCodes = [
  // Level 1: Trades
  { code: 'CIVIL', name: 'Civil Works', level: 1, parentId: null },
  { code: 'ELECTRICAL', name: 'Electrical Works', level: 1, parentId: null },
  { code: 'PLUMBING', name: 'Plumbing Works', level: 1, parentId: null },
  { code: 'MECHANICAL', name: 'Mechanical Works', level: 1, parentId: null },
  { code: 'FINISHING', name: 'Finishing Works', level: 1, parentId: null },
  { code: 'SITE', name: 'Site Works', level: 1, parentId: null },

  // Level 2: Activities (Civil)
  { code: 'CIVIL-FOUNDATION', name: 'Foundation', level: 2, parentCode: 'CIVIL' },
  { code: 'CIVIL-STRUCTURE', name: 'Structure', level: 2, parentCode: 'CIVIL' },
  { code: 'CIVIL-ROOFING', name: 'Roofing', level: 2, parentCode: 'CIVIL' },

  // Level 2: Activities (Electrical)
  { code: 'ELECTRICAL-WIRING', name: 'Wiring', level: 2, parentCode: 'ELECTRICAL' },
  { code: 'ELECTRICAL-FIXTURES', name: 'Fixtures', level: 2, parentCode: 'ELECTRICAL' },
  { code: 'ELECTRICAL-PANELS', name: 'Panels', level: 2, parentCode: 'ELECTRICAL' },

  // Level 2: Activities (Plumbing)
  { code: 'PLUMBING-PIPES', name: 'Pipes', level: 2, parentCode: 'PLUMBING' },
  { code: 'PLUMBING-FIXTURES', name: 'Fixtures', level: 2, parentCode: 'PLUMBING' },
  { code: 'PLUMBING-DRAINAGE', name: 'Drainage', level: 2, parentCode: 'PLUMBING' },

  // Level 2: Activities (Finishing)
  { code: 'FINISHING-PAINTING', name: 'Painting', level: 2, parentCode: 'FINISHING' },
  { code: 'FINISHING-TILES', name: 'Tiles', level: 2, parentCode: 'FINISHING' },
  { code: 'FINISHING-FLOORING', name: 'Flooring', level: 2, parentCode: 'FINISHING' },

  // Level 2: Activities (Site)
  { code: 'SITE-CLEARING', name: 'Site Clearing', level: 2, parentCode: 'SITE' },
  { code: 'SITE-EXCAVATION', name: 'Excavation', level: 2, parentCode: 'SITE' },
  { code: 'SITE-UTILITIES', name: 'Utilities', level: 2, parentCode: 'SITE' },
];

export async function seedConstructionCostCodes() {
  console.log('🌱 Seeding Construction Cost Codes...');

  // First, create all Level 1 (Trades)
  const level1Codes: Record<string, string> = {};
  for (const code of costCodes.filter(c => c.level === 1)) {
    const created = await prisma.costCode.upsert({
      where: { code: code.code },
      update: {
        name: code.name,
        level: code.level,
        parentId: null,
        isActive: true,
      },
      create: {
        code: code.code,
        name: code.name,
        level: code.level,
        parentId: null,
        isActive: true,
      },
    });
    level1Codes[code.code] = created.id;
    console.log(`✅ Created Level 1: ${code.code} - ${code.name}`);
  }

  // Then, create Level 2 (Activities) with parent references
  for (const code of costCodes.filter(c => c.level === 2)) {
    const parentId = level1Codes[(code as any).parentCode];
    if (!parentId) {
      console.warn(`⚠️  Parent not found for ${code.code}, skipping...`);
      continue;
    }

    await prisma.costCode.upsert({
      where: { code: code.code },
      update: {
        name: code.name,
        level: code.level,
        parentId: parentId,
        isActive: true,
      },
      create: {
        code: code.code,
        name: code.name,
        level: code.level,
        parentId: parentId,
        isActive: true,
      },
    });
    console.log(`✅ Created Level 2: ${code.code} - ${code.name}`);
  }

  console.log('✅ Construction Cost Codes seeded successfully');
}

// Run if called directly
if (require.main === module) {
  seedConstructionCostCodes()
    .catch((error) => {
      console.error('❌ Error seeding Construction Cost Codes:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
