import prisma from './client';
import { hashPassword } from '../utils/password';

async function main() {
  console.log('🌱 Seeding database...');

  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      permissions: ['*'], // All permissions
    },
  });

  const hrManagerRole = await prisma.role.upsert({
    where: { name: 'HR Manager' },
    update: {},
    create: {
      name: 'HR Manager',
      permissions: ['hr.view', 'hr.create', 'hr.update', 'hr.delete'],
    },
  });

  const dealerRole = await prisma.role.upsert({
    where: { name: 'Dealer' },
    update: {},
    create: {
      name: 'Dealer',
      permissions: ['crm.view', 'crm.create', 'crm.update', 'properties.view'],
    },
  });

  const tenantRole = await prisma.role.upsert({
    where: { name: 'Tenant' },
    update: {},
    create: {
      name: 'Tenant',
      permissions: ['tenant.view', 'tenant.update'],
    },
  });

  const accountantRole = await prisma.role.upsert({
    where: { name: 'Accountant' },
    update: {},
    create: {
      name: 'Accountant',
      permissions: ['finance.view', 'finance.create', 'finance.update', 'finance.delete'],
    },
  });

  // Create default admin user
  const adminPassword = await hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@realestate.com' },
    update: {
      // Update password if user already exists (in case it was changed)
      password: adminPassword,
      roleId: adminRole.id,
      deviceApprovalStatus: 'approved',
    },
    create: {
      username: 'admin',
      email: 'admin@realestate.com',
      password: adminPassword,
      roleId: adminRole.id,
      deviceApprovalStatus: 'approved',
    },
  });

  // Create default departments
  const departments = [
    { code: 'ENG', name: 'Engineering', description: 'Software Development and Engineering' },
    { code: 'SAL', name: 'Sales', description: 'Sales and Business Development' },
    { code: 'MKT', name: 'Marketing', description: 'Marketing and Public Relations' },
    { code: 'HR', name: 'Human Resources', description: 'HR and Talent Acquisition' },
    { code: 'FIN', name: 'Finance', description: 'Finance and Accounting' },
    { code: 'OPS', name: 'Operations', description: 'Operations and Logistics' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }

  // Seed Expanded Chart of Accounts (load compiled JS to satisfy tsconfig rootDir)
  const path = await import('path');
  const expandedSeedsPath = path.resolve(process.cwd(), 'prisma', 'seeds', 'chart-of-accounts.js');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expandedSeeds: any = require(expandedSeedsPath);
  if (expandedSeeds && typeof expandedSeeds.seedExpandedChartOfAccounts === 'function') {
    await expandedSeeds.seedExpandedChartOfAccounts();
  }

  console.log('✅ Seeding completed!');
  console.log('📧 Admin credentials:');
  console.log('   Email: admin@realestate.com');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

