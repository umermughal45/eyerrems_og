
import prisma from './client';

const accounts = [
  // 1. ASSETS
  { code: '1', name: 'Assets', type: 'Asset', level: 1, accountType: 'Header', isPostable: false, normalBalance: 'Debit' },
  { code: '11', name: 'Current Assets', type: 'Asset', level: 2, accountType: 'Header', isPostable: false, parentCode: '1', normalBalance: 'Debit' },
  { code: '111', name: 'Cash and Cash Equivalents', type: 'Asset', level: 3, accountType: 'Header', isPostable: false, parentCode: '11', normalBalance: 'Debit' },
  { code: '1111', name: 'Cash on Hand', type: 'Asset', level: 4, accountType: 'Header', isPostable: false, parentCode: '111', normalBalance: 'Debit' },
  { code: '111101', name: 'Petty Cash', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1111', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  { code: '111102', name: 'Cash Drawer', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1111', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  
  { code: '1112', name: 'Bank Accounts', type: 'Asset', level: 4, accountType: 'Header', isPostable: false, parentCode: '111', normalBalance: 'Debit' },
  { code: '111201', name: 'Main Operating Account', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1112', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  { code: '111202', name: 'Payroll Account', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1112', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  
  // Trust Accounts (Restricted)
  { code: '112', name: 'Trust Assets', type: 'Asset', level: 3, accountType: 'Header', isPostable: false, parentCode: '11', normalBalance: 'Debit' },
  { code: '1121', name: 'Client Trust Accounts', type: 'Asset', level: 4, accountType: 'Header', isPostable: false, parentCode: '112', normalBalance: 'Debit' },
  { code: '112101', name: 'Client Advances – Trust', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1121', normalBalance: 'Debit', cashFlowCategory: 'Escrow', trustFlag: true },
  { code: '112102', name: 'Security Deposits – Trust', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1121', normalBalance: 'Debit', cashFlowCategory: 'Escrow', trustFlag: true },

  { code: '113', name: 'Accounts Receivable', type: 'Asset', level: 3, accountType: 'Header', isPostable: false, parentCode: '11', normalBalance: 'Debit' },
  { code: '1131', name: 'Trade Receivables', type: 'Asset', level: 4, accountType: 'Header', isPostable: false, parentCode: '113', normalBalance: 'Debit' },
  { code: '113101', name: 'Rent Receivable', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1131', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  { code: '113102', name: 'Service Charge Receivable', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1131', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  
  { code: '12', name: 'Non-Current Assets', type: 'Asset', level: 2, accountType: 'Header', isPostable: false, parentCode: '1', normalBalance: 'Debit' },
  { code: '121', name: 'Property, Plant and Equipment', type: 'Asset', level: 3, accountType: 'Header', isPostable: false, parentCode: '12', normalBalance: 'Debit' },
  { code: '1211', name: 'Land and Buildings', type: 'Asset', level: 4, accountType: 'Header', isPostable: false, parentCode: '121', normalBalance: 'Debit' },
  { code: '121101', name: 'Investment Properties', type: 'Asset', level: 5, accountType: 'Posting', isPostable: true, parentCode: '1211', normalBalance: 'Debit', cashFlowCategory: 'Investing' },

  // 2. LIABILITIES
  { code: '2', name: 'Liabilities', type: 'Liability', level: 1, accountType: 'Header', isPostable: false, normalBalance: 'Credit' },
  { code: '21', name: 'Current Liabilities', type: 'Liability', level: 2, accountType: 'Header', isPostable: false, parentCode: '2', normalBalance: 'Credit' },
  
  // Trust Liabilities (must match Trust Assets)
  { code: '211', name: 'Trust Liabilities', type: 'Liability', level: 3, accountType: 'Header', isPostable: false, parentCode: '21', normalBalance: 'Credit' },
  { code: '2111', name: 'Client Payables', type: 'Liability', level: 4, accountType: 'Header', isPostable: false, parentCode: '211', normalBalance: 'Credit' },
  { code: '211101', name: 'Client Advances Payable', type: 'Liability', level: 5, accountType: 'Posting', isPostable: true, parentCode: '2111', normalBalance: 'Credit', cashFlowCategory: 'Escrow', trustFlag: true },
  { code: '211102', name: 'Security Deposits Payable', type: 'Liability', level: 5, accountType: 'Posting', isPostable: true, parentCode: '2111', normalBalance: 'Credit', cashFlowCategory: 'Escrow', trustFlag: true },

  { code: '212', name: 'Accounts Payable', type: 'Liability', level: 3, accountType: 'Header', isPostable: false, parentCode: '21', normalBalance: 'Credit' },
  { code: '2121', name: 'Trade Payables', type: 'Liability', level: 4, accountType: 'Header', isPostable: false, parentCode: '212', normalBalance: 'Credit' },
  { code: '212101', name: 'Vendor Payables', type: 'Liability', level: 5, accountType: 'Posting', isPostable: true, parentCode: '2121', normalBalance: 'Credit', cashFlowCategory: 'Operating' },
  
  // 3. EQUITY
  { code: '3', name: 'Equity', type: 'Equity', level: 1, accountType: 'Header', isPostable: false, normalBalance: 'Credit' },
  { code: '31', name: 'Capital', type: 'Equity', level: 2, accountType: 'Header', isPostable: false, parentCode: '3', normalBalance: 'Credit' },
  { code: '3100', name: 'Owner Capital', type: 'Equity', level: 3, accountType: 'Header', isPostable: false, parentCode: '31', normalBalance: 'Credit' },
  { code: '310001', name: 'Paid-in Capital', type: 'Equity', level: 5, accountType: 'Posting', isPostable: true, parentCode: '3100', normalBalance: 'Credit', cashFlowCategory: 'Financing' },
  
  { code: '32', name: 'Retained Earnings', type: 'Equity', level: 2, accountType: 'Header', isPostable: false, parentCode: '3', normalBalance: 'Credit' },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', level: 3, accountType: 'Header', isPostable: false, parentCode: '32', normalBalance: 'Credit' },
  { code: '320001', name: 'Retained Earnings', type: 'Equity', level: 5, accountType: 'Posting', isPostable: true, parentCode: '3200', normalBalance: 'Credit' },
  
  { code: '33', name: 'Current Year Profit', type: 'Equity', level: 2, accountType: 'Header', isPostable: false, parentCode: '3', normalBalance: 'Credit' },
  { code: '3300', name: 'Profit and Loss', type: 'Equity', level: 3, accountType: 'Header', isPostable: false, parentCode: '33', normalBalance: 'Credit' },
  { code: '330001', name: 'Current Year Earnings', type: 'Equity', level: 5, accountType: 'Posting', isPostable: true, parentCode: '3300', normalBalance: 'Credit' },

  // 4. REVENUE
  { code: '4', name: 'Revenue', type: 'Revenue', level: 1, accountType: 'Header', isPostable: false, normalBalance: 'Credit' },
  { code: '41', name: 'Property Income', type: 'Revenue', level: 2, accountType: 'Header', isPostable: false, parentCode: '4', normalBalance: 'Credit' },
  { code: '411', name: 'Rental Income', type: 'Revenue', level: 3, accountType: 'Header', isPostable: false, parentCode: '41', normalBalance: 'Credit' },
  { code: '4111', name: 'Residential Rent', type: 'Revenue', level: 4, accountType: 'Header', isPostable: false, parentCode: '411', normalBalance: 'Credit' },
  { code: '411101', name: 'Apartment Rent', type: 'Revenue', level: 5, accountType: 'Posting', isPostable: true, parentCode: '4111', normalBalance: 'Credit', cashFlowCategory: 'Operating' },
  { code: '411102', name: 'Commercial Rent', type: 'Revenue', level: 5, accountType: 'Posting', isPostable: true, parentCode: '4111', normalBalance: 'Credit', cashFlowCategory: 'Operating' },

  { code: '42', name: 'Service Income', type: 'Revenue', level: 2, accountType: 'Header', isPostable: false, parentCode: '4', normalBalance: 'Credit' },
  { code: '421', name: 'Maintenance Income', type: 'Revenue', level: 3, accountType: 'Header', isPostable: false, parentCode: '42', normalBalance: 'Credit' },
  { code: '4211', name: 'Maintenance Charges', type: 'Revenue', level: 4, accountType: 'Header', isPostable: false, parentCode: '421', normalBalance: 'Credit' },
  { code: '421101', name: 'Maintenance Fees', type: 'Revenue', level: 5, accountType: 'Posting', isPostable: true, parentCode: '4211', normalBalance: 'Credit', cashFlowCategory: 'Operating' },

  // 5. EXPENSES
  { code: '5', name: 'Expenses', type: 'Expense', level: 1, accountType: 'Header', isPostable: false, normalBalance: 'Debit' },
  { code: '51', name: 'Selling Expenses', type: 'Expense', level: 2, accountType: 'Header', isPostable: false, parentCode: '5', normalBalance: 'Debit' },
  { code: '511', name: 'Commission', type: 'Expense', level: 3, accountType: 'Header', isPostable: false, parentCode: '51', normalBalance: 'Debit' },
  { code: '5111', name: 'Agent Commission', type: 'Expense', level: 4, accountType: 'Header', isPostable: false, parentCode: '511', normalBalance: 'Debit' },
  { code: '511101', name: 'Sales Commission', type: 'Expense', level: 5, accountType: 'Posting', isPostable: true, parentCode: '5111', normalBalance: 'Debit', cashFlowCategory: 'Operating' },

  { code: '52', name: 'Property Expenses', type: 'Expense', level: 2, accountType: 'Header', isPostable: false, parentCode: '5', normalBalance: 'Debit' },
  { code: '521', name: 'Maintenance', type: 'Expense', level: 3, accountType: 'Header', isPostable: false, parentCode: '52', normalBalance: 'Debit' },
  { code: '5211', name: 'Repairs', type: 'Expense', level: 4, accountType: 'Header', isPostable: false, parentCode: '521', normalBalance: 'Debit' },
  { code: '521101', name: 'General Repairs', type: 'Expense', level: 5, accountType: 'Posting', isPostable: true, parentCode: '5211', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  { code: '521102', name: 'Cleaning', type: 'Expense', level: 5, accountType: 'Posting', isPostable: true, parentCode: '5211', normalBalance: 'Debit', cashFlowCategory: 'Operating' },

  { code: '53', name: 'Administrative Expenses', type: 'Expense', level: 2, accountType: 'Header', isPostable: false, parentCode: '5', normalBalance: 'Debit' },
  { code: '531', name: 'Office Expenses', type: 'Expense', level: 3, accountType: 'Header', isPostable: false, parentCode: '53', normalBalance: 'Debit' },
  { code: '5311', name: 'Utilities', type: 'Expense', level: 4, accountType: 'Header', isPostable: false, parentCode: '531', normalBalance: 'Debit' },
  { code: '531101', name: 'Electricity', type: 'Expense', level: 5, accountType: 'Posting', isPostable: true, parentCode: '5311', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
  { code: '531102', name: 'Water', type: 'Expense', level: 5, accountType: 'Posting', isPostable: true, parentCode: '5311', normalBalance: 'Debit', cashFlowCategory: 'Operating' },

  { code: '54', name: 'Tax Expenses', type: 'Expense', level: 2, accountType: 'Header', isPostable: false, parentCode: '5', normalBalance: 'Debit' },
  { code: '541', name: 'Property Tax', type: 'Expense', level: 3, accountType: 'Header', isPostable: false, parentCode: '54', normalBalance: 'Debit' },
  { code: '5411', name: 'Local Taxes', type: 'Expense', level: 4, accountType: 'Header', isPostable: false, parentCode: '541', normalBalance: 'Debit' },
  { code: '541101', name: 'Municipal Tax', type: 'Expense', level: 5, accountType: 'Posting', isPostable: true, parentCode: '5411', normalBalance: 'Debit', cashFlowCategory: 'Operating' },
];

async function main() {
  console.log('🌱 Seeding Chart of Accounts...');

  for (const account of accounts) {
    // Find parent ID if parentCode exists
    let parentId: string | null = null;
    if (account.parentCode) {
      const parent = await prisma.account.findUnique({
        where: { code: account.parentCode },
      });
      if (parent) {
        parentId = parent.id;
      } else {
        console.warn(`⚠️ Parent account not found for ${account.code} (Parent: ${account.parentCode}). Skipping hierarchy.`);
      }
    }

    await prisma.account.upsert({
      where: { code: account.code },
      update: {
        name: account.name,
        type: account.type,
        level: account.level,
        accountType: account.accountType,
        isPostable: account.isPostable,
        normalBalance: account.normalBalance,
        cashFlowCategory: account.cashFlowCategory || null,
        trustFlag: account.trustFlag || false,
        parentId: parentId,
      },
      create: {
        code: account.code,
        name: account.name,
        type: account.type,
        level: account.level,
        accountType: account.accountType,
        isPostable: account.isPostable,
        normalBalance: account.normalBalance,
        cashFlowCategory: account.cashFlowCategory || null,
        trustFlag: account.trustFlag || false,
        parentId: parentId,
      },
    });
    console.log(`✅ Upserted account: ${account.code} - ${account.name}`);
  }

  console.log('✅ Chart of Accounts seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
