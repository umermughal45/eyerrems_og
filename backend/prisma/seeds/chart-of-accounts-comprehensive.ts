/**
 * Comprehensive Chart of Accounts Seed Data
 * Real Estate ERP - Full 5-Level Hierarchical COA
 * Based on user specification with exact account codes and structure
 */

// Use the app's centralized Prisma client (with adapter) so engine options are valid.
import prisma from '../../src/prisma/client';

interface AccountData {
  code: string;
  name: string;
  level: number;
  accountType: 'Header' | 'Control' | 'Posting';
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  normalBalance: 'Debit' | 'Credit';
  description?: string;
  parentCode?: string;
  trustFlag?: boolean;
}

const accounts: AccountData[] = [
  // ========== ASSETS (1xxx) ==========
  // Level 1 - Root
  { code: '1000', name: 'Assets', level: 1, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', description: 'Root asset group' },
  
  // Level 2 - Current Assets
  { code: '1100', name: 'Current Assets', level: 2, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', description: 'Assets expected to convert within 12 months', parentCode: '1000' },
  
  // Level 3 - Cash & Bank Accounts
  { code: '1110', name: 'Cash & Bank Accounts', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', description: 'All liquid funds (Operating + Trust separated)', parentCode: '1100' },
  
  // Level 4 - Operating Cash Accounts
  { code: '1111', name: 'Operating Cash Accounts', level: 4, accountType: 'Control', type: 'Asset', normalBalance: 'Debit', description: 'Company physical cash (NOT client money)', parentCode: '1110' },
  
  // Level 5 - Posting Accounts
  { code: '111101', name: 'Main Cash', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1111' },
  { code: '111102', name: 'Petty Cash', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1111' },
  
  // Level 4 - Operating Bank Accounts
  { code: '1112', name: 'Operating Bank Accounts', level: 4, accountType: 'Control', type: 'Asset', normalBalance: 'Debit', description: 'Company bank accounts only', parentCode: '1110' },
  
  // Level 5 - Posting Accounts
  { code: '111201', name: 'Meezan Bank – Operating', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1112' },
  { code: '111202', name: 'HBL – Operating', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1112' },
  
  // Level 3 - Trust / Escrow Accounts
  { code: '1120', name: 'Trust / Escrow Accounts', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', description: 'Client money — legally separated', parentCode: '1100' },
  
  // Level 4 - Client Trust Accounts
  { code: '1121', name: 'Client Trust Accounts', level: 4, accountType: 'Control', type: 'Asset', normalBalance: 'Debit', parentCode: '1120', trustFlag: true },
  
  // Level 5 - Posting Accounts
  { code: '112101', name: 'Client Advances – Trust', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1121', trustFlag: true },
  { code: '112102', name: 'Security Deposits – Trust', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1121', trustFlag: true },
  
  // Level 3 - Accounts Receivable
  { code: '1130', name: 'Accounts Receivable', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', parentCode: '1100' },
  
  // Level 4 - Client Receivables
  { code: '1131', name: 'Client Receivables', level: 4, accountType: 'Control', type: 'Asset', normalBalance: 'Debit', parentCode: '1130' },
  
  // Level 5 - Posting Accounts
  { code: '113101', name: 'Property Sale Receivable', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1131' },
  { code: '113102', name: 'Rental Receivable', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1131' },
  
  // Level 4 - Dealer / Agent Receivable
  { code: '1132', name: 'Dealer / Agent Receivable', level: 4, accountType: 'Control', type: 'Asset', normalBalance: 'Debit', parentCode: '1130' },
  
  // Level 5 - Posting Accounts
  { code: '113201', name: 'Dealer Recoverable', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1132' },
  
  // Level 3 - Inventory – Properties
  { code: '1140', name: 'Inventory – Properties', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', parentCode: '1100' },
  
  // Level 4 - Properties Held for Sale
  { code: '1141', name: 'Properties Held for Sale', level: 4, accountType: 'Control', type: 'Asset', normalBalance: 'Debit', parentCode: '1140' },
  
  // Level 5 - Posting Accounts
  { code: '114101', name: 'Project A – Unsold Units', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1141' },
  { code: '114102', name: 'Project B – Unsold Units', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1141' },
  
  // Level 3 - Prepaid Expenses
  { code: '1150', name: 'Prepaid Expenses', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', parentCode: '1100' },
  
  // Level 5 - Posting Accounts
  { code: '115101', name: 'Prepaid Rent', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1150' },
  { code: '115102', name: 'Prepaid Utilities', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1150' },
  
  // Level 2 - Fixed Assets
  { code: '1200', name: 'Fixed Assets', level: 2, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', parentCode: '1000' },
  
  // Level 3 - Property & Equipment
  { code: '1210', name: 'Property & Equipment', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Debit', parentCode: '1200' },
  
  // Level 5 - Posting Accounts
  { code: '121101', name: 'Office Equipment', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1210' },
  { code: '121102', name: 'Furniture & Fixtures', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Debit', parentCode: '1210' },
  
  // Level 3 - Accumulated Depreciation
  { code: '1220', name: 'Accumulated Depreciation', level: 3, accountType: 'Header', type: 'Asset', normalBalance: 'Credit', description: 'Contra Asset', parentCode: '1200' },
  
  // Level 5 - Posting Accounts
  { code: '122101', name: 'Acc. Dep – Equipment', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Credit', parentCode: '1220' },
  { code: '122102', name: 'Acc. Dep – Furniture', level: 5, accountType: 'Posting', type: 'Asset', normalBalance: 'Credit', parentCode: '1220' },
  
  // ========== LIABILITIES (2xxx) ==========
  // Level 1 - Root
  { code: '2000', name: 'Liabilities', level: 1, accountType: 'Header', type: 'Liability', normalBalance: 'Credit' },
  
  // Level 2 - Current Liabilities
  { code: '2100', name: 'Current Liabilities', level: 2, accountType: 'Header', type: 'Liability', normalBalance: 'Credit', parentCode: '2000' },
  
  // Level 3 - Client Liabilities
  { code: '2110', name: 'Client Liabilities', level: 3, accountType: 'Header', type: 'Liability', normalBalance: 'Credit', parentCode: '2100' },
  
  // Level 5 - Posting Accounts (Balances must equal Trust Assets)
  { code: '211101', name: 'Client Advances Payable', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2110', trustFlag: true },
  { code: '211102', name: 'Security Deposits Payable', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2110', trustFlag: true },
  
  // Level 3 - Accounts Payable
  { code: '2120', name: 'Accounts Payable', level: 3, accountType: 'Header', type: 'Liability', normalBalance: 'Credit', parentCode: '2100' },
  
  // Level 5 - Posting Accounts
  { code: '212101', name: 'Vendor Payable', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2120' },
  { code: '212102', name: 'Contractor Payable', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2120' },
  
  // Level 3 - Dealer / Agent Payable
  { code: '2130', name: 'Dealer / Agent Payable', level: 3, accountType: 'Header', type: 'Liability', normalBalance: 'Credit', parentCode: '2100' },
  
  // Level 5 - Posting Accounts
  { code: '213101', name: 'Commission Payable', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2130' },
  
  // Level 3 - Tax & Withholding Payable
  { code: '2140', name: 'Tax & Withholding Payable', level: 3, accountType: 'Header', type: 'Liability', normalBalance: 'Credit', parentCode: '2100' },
  
  // Level 5 - Posting Accounts
  { code: '214101', name: 'Sales Tax Payable', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2140' },
  { code: '214102', name: 'Income Tax Withholding', level: 5, accountType: 'Posting', type: 'Liability', normalBalance: 'Credit', parentCode: '2140' },
  
  // ========== EQUITY (3xxx) ==========
  // Level 1 - Root
  { code: '3000', name: 'Equity', level: 1, accountType: 'Header', type: 'Equity', normalBalance: 'Credit' },
  
  // Level 4 - Control Accounts (No direct posting except system closing)
  { code: '3100', name: 'Owner Capital', level: 4, accountType: 'Control', type: 'Equity', normalBalance: 'Credit', parentCode: '3000' },
  { code: '3200', name: 'Retained Earnings', level: 4, accountType: 'Control', type: 'Equity', normalBalance: 'Credit', parentCode: '3000' },
  { code: '3300', name: 'Current Year Profit', level: 4, accountType: 'Control', type: 'Equity', normalBalance: 'Credit', parentCode: '3000' },
  
  // ========== INCOME (4xxx) ==========
  // Level 1 - Root
  { code: '4000', name: 'Revenue', level: 1, accountType: 'Header', type: 'Revenue', normalBalance: 'Credit' },
  
  // Level 2 - Property Revenue
  { code: '4100', name: 'Property Revenue', level: 2, accountType: 'Header', type: 'Revenue', normalBalance: 'Credit', parentCode: '4000' },
  
  // Level 5 - Posting Accounts
  { code: '411101', name: 'Property Sale Revenue', level: 5, accountType: 'Posting', type: 'Revenue', normalBalance: 'Credit', parentCode: '4100' },
  { code: '411102', name: 'Rental Income', level: 5, accountType: 'Posting', type: 'Revenue', normalBalance: 'Credit', parentCode: '4100' },
  
  // Level 2 - Service Income
  { code: '4200', name: 'Service Income', level: 2, accountType: 'Header', type: 'Revenue', normalBalance: 'Credit', parentCode: '4000' },
  
  // Level 5 - Posting Accounts
  { code: '421101', name: 'Property Management Fees', level: 5, accountType: 'Posting', type: 'Revenue', normalBalance: 'Credit', parentCode: '4200' },
  { code: '421102', name: 'Late Payment Penalties', level: 5, accountType: 'Posting', type: 'Revenue', normalBalance: 'Credit', parentCode: '4200' },
  
  // ========== EXPENSES (5xxx) ==========
  // Level 1 - Root
  { code: '5000', name: 'Expenses', level: 1, accountType: 'Header', type: 'Expense', normalBalance: 'Debit' },
  
  // Level 2 - Selling Expenses
  { code: '5100', name: 'Selling Expenses', level: 2, accountType: 'Header', type: 'Expense', normalBalance: 'Debit', parentCode: '5000' },
  
  // Level 5 - Posting Accounts
  { code: '511101', name: 'Commission Expense', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5100' },
  { code: '511102', name: 'Marketing Expense', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5100' },
  
  // Level 2 - Property Expenses
  { code: '5200', name: 'Property Expenses', level: 2, accountType: 'Header', type: 'Expense', normalBalance: 'Debit', parentCode: '5000' },
  
  // Level 5 - Posting Accounts
  { code: '521101', name: 'Maintenance & Repairs', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5200' },
  { code: '521102', name: 'Utilities Expense', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5200' },
  
  // Level 2 - Administrative Expenses
  { code: '5300', name: 'Administrative Expenses', level: 2, accountType: 'Header', type: 'Expense', normalBalance: 'Debit', parentCode: '5000' },
  
  // Level 5 - Posting Accounts
  { code: '531101', name: 'Salaries', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5300' },
  { code: '531102', name: 'Office Expense', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5300' },
  
  // Level 2 - Tax & Adjustments
  { code: '5400', name: 'Tax & Adjustments', level: 2, accountType: 'Header', type: 'Expense', normalBalance: 'Debit', parentCode: '5000' },
  
  // Level 5 - Posting Accounts
  { code: '541101', name: 'Tax Expense', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5400' },
  { code: '541102', name: 'Refunds & Write-offs', level: 5, accountType: 'Posting', type: 'Expense', normalBalance: 'Debit', parentCode: '5400' },
];

export async function seedComprehensiveChartOfAccounts() {
  console.log('Seeding Comprehensive Chart of Accounts...');

  // Create a map to track created accounts by code
  const accountMap = new Map<string, string>();

  // Sort accounts by level and code to ensure parents are created first
  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.code.localeCompare(b.code);
  });

  for (const accountData of sortedAccounts) {
    // Find parent ID if parentCode is specified
    let parentId: string | null = null;
    if (accountData.parentCode) {
      parentId = accountMap.get(accountData.parentCode) || null;
      if (!parentId && accountData.parentCode) {
        console.warn(`Warning: Parent account ${accountData.parentCode} not found for ${accountData.code}`);
      }
    }

    // Determine if account is postable (only Level 5 Posting accounts)
    const isPostable = accountData.level === 5 && accountData.accountType === 'Posting';

    // Check if account already exists
    const existing = await prisma.account.findUnique({
      where: { code: accountData.code },
    });

    if (existing) {
      // Update existing account
      const updated = await prisma.account.update({
        where: { id: existing.id },
        data: {
          name: accountData.name,
          type: accountData.type,
          description: accountData.description || null,
          level: accountData.level,
          accountType: accountData.accountType,
          normalBalance: accountData.normalBalance,
          isPostable,
          trustFlag: accountData.trustFlag || false,
          parentId,
          isActive: true,
        },
      });
      accountMap.set(accountData.code, updated.id);
      console.log(`Updated account: ${accountData.code} - ${accountData.name}`);
    } else {
      // Create new account
      const created = await prisma.account.create({
        data: {
          code: accountData.code,
          name: accountData.name,
          type: accountData.type,
          description: accountData.description || null,
          level: accountData.level,
          accountType: accountData.accountType,
          normalBalance: accountData.normalBalance,
          isPostable,
          trustFlag: accountData.trustFlag || false,
          parentId,
          isActive: true,
        },
      });
      accountMap.set(accountData.code, created.id);
      console.log(`Created account: ${accountData.code} - ${accountData.name} (Level ${accountData.level}, ${accountData.accountType})`);
    }
  }

  console.log(`\nChart of Accounts seeded successfully! Created/Updated ${accountMap.size} accounts.`);
  console.log('\nAccount Summary:');
  console.log(`- Level 1 (Header): ${accounts.filter(a => a.level === 1).length}`);
  console.log(`- Level 2 (Header): ${accounts.filter(a => a.level === 2).length}`);
  console.log(`- Level 3 (Header): ${accounts.filter(a => a.level === 3).length}`);
  console.log(`- Level 4 (Control): ${accounts.filter(a => a.level === 4).length}`);
  console.log(`- Level 5 (Posting): ${accounts.filter(a => a.level === 5).length}`);
  console.log(`- Trust Accounts: ${accounts.filter(a => a.trustFlag).length}`);
}

if (require.main === module) {
  seedComprehensiveChartOfAccounts()
    .catch((e) => {
      console.error('Error seeding chart of accounts:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

