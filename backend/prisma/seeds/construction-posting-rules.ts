/**
 * Construction Posting Rules Seed
 * Default posting rules for Construction module events
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const postingRules = [
  {
    eventType: 'MaterialIssue',
    debitAccountCode: '5201', // WIP (default, can be overridden by project accounting mode)
    creditAccountCode: '1401', // Inventory
    description: 'Material Issue to Project - Inventory to WIP/Expense',
  },
  {
    eventType: 'LaborApproval',
    debitAccountCode: '5201', // WIP (default, can be overridden by project accounting mode)
    creditAccountCode: '2401', // Payroll Accrual
    description: 'Labor Cost Approval - WIP/Expense to Payroll Accrual',
  },
  {
    eventType: 'EquipmentUsage',
    debitAccountCode: '5201', // WIP (default, can be overridden by project accounting mode)
    creditAccountCode: '1501', // Equipment Recovery (Internal)
    description: 'Equipment Usage - WIP/Expense to Equipment Recovery',
  },
  {
    eventType: 'SubcontractorInvoice',
    debitAccountCode: '5201', // WIP (default, can be overridden by project accounting mode)
    creditAccountCode: '2001', // Accounts Payable
    description: 'Subcontractor Invoice - WIP/Expense to Accounts Payable',
  },
  {
    eventType: 'ClientBilling',
    debitAccountCode: '1101', // Accounts Receivable
    creditAccountCode: '4001', // Revenue
    description: 'Client Billing - AR to Revenue (+ Retention if applicable)',
  },
  {
    eventType: 'ProjectClose',
    debitAccountCode: '5101', // Cost of Goods Sold
    creditAccountCode: '5201', // WIP
    description: 'Project Close - WIP to COGS',
  },
];

export async function seedConstructionPostingRules() {
  console.log('🌱 Seeding Construction Posting Rules...');

  for (const rule of postingRules) {
    await prisma.constructionPostingRule.upsert({
      where: { eventType: rule.eventType },
      update: {
        debitAccountCode: rule.debitAccountCode,
        creditAccountCode: rule.creditAccountCode,
        description: rule.description,
        isActive: true,
      },
      create: {
        eventType: rule.eventType,
        debitAccountCode: rule.debitAccountCode,
        creditAccountCode: rule.creditAccountCode,
        description: rule.description,
        isActive: true,
      },
    });

    console.log(`✅ Posted rule: ${rule.eventType}`);
  }

  console.log('✅ Construction Posting Rules seeded successfully');
}

// Run if called directly
if (require.main === module) {
  seedConstructionPostingRules()
    .catch((error) => {
      console.error('❌ Error seeding Construction Posting Rules:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
