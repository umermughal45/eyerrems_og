/**
 * Chart of Accounts Seed Data
 * Real Estate ERP Standard COA
 */

// Reuse the shared Prisma client configuration (with adapter) used by the app.
// This avoids constructor/engine-type issues in Prisma 7.
import prisma from '../../src/prisma/client';

export async function seedChartOfAccounts() {
  console.log('Seeding Chart of Accounts...');

  // Check if accounts already exist
  const existingAccounts = await prisma.account.count();
  if (existingAccounts > 0) {
    console.log('Accounts already exist, skipping seed...');
    return;
  }

  // ASSETS
  const cashAccount = await prisma.account.create({
    data: {
      code: '1000',
      name: 'Cash Account',
      type: 'Asset',
      description: 'Cash on hand and petty cash',
      isActive: true,
    },
  });

  const bankAccount = await prisma.account.create({
    data: {
      code: '1010',
      name: 'Bank Account',
      type: 'Asset',
      description: 'Primary bank account',
      isActive: true,
    },
  });

  const arAccount = await prisma.account.create({
    data: {
      code: '1100',
      name: 'Accounts Receivable',
      type: 'Asset',
      description: 'Amounts owed by clients for deals',
      isActive: true,
    },
  });

  // LIABILITIES
  const dealerPayable = await prisma.account.create({
    data: {
      code: '2000',
      name: 'Dealer Payable',
      type: 'Liability',
      description: 'Commission owed to dealers',
      isActive: true,
    },
  });

  // EQUITY
  const ownerEquity = await prisma.account.create({
    data: {
      code: '3000',
      name: 'Owner Equity',
      type: 'Equity',
      description: 'Owner capital and retained earnings',
      isActive: true,
    },
  });

  // INCOME
  const dealRevenue = await prisma.account.create({
    data: {
      code: '4000',
      name: 'Deal Revenue',
      type: 'Revenue',
      description: 'Revenue from property sales and rentals',
      isActive: true,
    },
  });

  // EXPENSES
  const commissionExpense = await prisma.account.create({
    data: {
      code: '5000',
      name: 'Commission Expense',
      type: 'Expense',
      description: 'Commissions paid to dealers',
      isActive: true,
    },
  });

  const refundExpense = await prisma.account.create({
    data: {
      code: '5100',
      name: 'Refunds/Write-offs',
      type: 'Expense',
      description: 'Refunds and write-offs',
      isActive: true,
    },
  });

  // Create account aliases for migration compatibility
  await prisma.accountAlias.createMany({
    data: [
      { alias: 'Cash Account', accountId: cashAccount.id },
      { alias: 'Bank Account', accountId: bankAccount.id },
      { alias: 'Accounts Receivable', accountId: arAccount.id },
      { alias: 'Dealer Payable', accountId: dealerPayable.id },
      { alias: 'Owner Equity', accountId: ownerEquity.id },
      { alias: 'Deal Revenue', accountId: dealRevenue.id },
      { alias: 'Commission Expense', accountId: commissionExpense.id },
      { alias: 'Refunds/Write-offs', accountId: refundExpense.id },
    ],
  });

  console.log('Chart of Accounts seeded successfully!');
}

if (require.main === module) {
  seedChartOfAccounts()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

