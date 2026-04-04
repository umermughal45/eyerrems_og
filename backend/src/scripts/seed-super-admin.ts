/**
 * Seed script: Creates the super admin company and account.
 * Run once after applying the add_company_isolation migration:
 *   npx ts-node src/scripts/seed-super-admin.ts
 *
 * You can customize the credentials below before running.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Customize these before running ──────────────────────────────────────────
const SUPER_ADMIN_EMAIL = 'superadmin@eyerrems.com';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin@2026!'; // Change this immediately after first login
const SUPER_ADMIN_NAME = 'Super Admin';
// ─────────────────────────────────────────────────────────────────────────────

async function seedSuperAdmin() {
  console.log('🚀 Seeding super admin account...\n');

  // 1. Check if already seeded
  const existing = await prisma.companyUser.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (existing) {
    console.log('⚠️  Super admin already exists:', SUPER_ADMIN_EMAIL);
    console.log('   Delete the existing record first if you want to re-seed.');
    process.exit(0);
  }

  // 2. Create the "SYSTEM" company for the super admin
  let systemCompany = await prisma.company.findUnique({
    where: { companyCode: 'SYSTEM' },
  });

  if (!systemCompany) {
    systemCompany = await prisma.company.create({
      data: {
        companyName: 'EyerREMS System',
        companyCode: 'SYSTEM',
        companyEmail: SUPER_ADMIN_EMAIL,
        status: 'active',
      },
    });

    await prisma.companySettings.create({
      data: {
        companyId: systemCompany.id,
        currencyCode: 'PKR',
        currencySymbol: 'Rs',
        timezone: 'Asia/Karachi',
        invoicePrefix: 'SYS',
      },
    });

    console.log('✅ System company created (companyCode: SYSTEM)');
  } else {
    console.log('ℹ️  System company already exists, skipping.');
  }

  // 3. Hash password
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);

  // 4. Create super admin user
  const superAdmin = await prisma.companyUser.create({
    data: {
      companyId: systemCompany.id,
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      passwordHash,
      role: 'super_admin',
      isSuperAdmin: true,
      isActive: true,
    },
  });

  console.log('\n✅ Super admin seeded successfully!');
  console.log('─'.repeat(50));
  console.log('  Login URL : /company-login');
  console.log('  Email     :', SUPER_ADMIN_EMAIL);
  console.log('  Password  :', SUPER_ADMIN_PASSWORD);
  console.log('─'.repeat(50));
  console.log('\n⚠️  IMPORTANT: Change the password immediately after first login!\n');
}

seedSuperAdmin()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
