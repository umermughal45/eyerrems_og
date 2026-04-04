"use strict";
/**
 * Expanded Chart of Accounts Seed Data
 * Real Estate ERP - Comprehensive COA with Hierarchy and Cash Flow Mapping
 *
 * IMPORTANT: This seed adds NEW accounts only. Existing accounts (1000, 1010, 1100, 2000, 3000, 4000, 5000, 5100)
 * are preserved and updated to be parent (non-postable) accounts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedExpandedChartOfAccounts = seedExpandedChartOfAccounts;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedExpandedChartOfAccounts() {
    console.log('Seeding Expanded Chart of Accounts...');
    // Get existing accounts to use as parents
    const existingAccounts = await prisma.account.findMany({
        where: { code: { in: ['1000', '1010', '1100', '2000', '3000', '4000', '5000', '5100'] } },
    });
    const accountMap = {};
    existingAccounts.forEach(acc => {
        accountMap[acc.code] = acc.id;
    });
    // Update existing accounts to be parent (non-postable) accounts
    for (const account of existingAccounts) {
        await prisma.account.update({
            where: { id: account.id },
            data: {
                isPostable: false,
                cashFlowCategory: account.code === '3000' ? 'Financing' : 'Operating',
            },
        });
    }
    // ASSETS - Cash Account Children (1000)
    const cashParentId = accountMap['1000'];
    if (cashParentId) {
        await createAccountIfNotExists({
            code: '1001',
            name: 'Cash on Hand',
            type: 'Asset',
            description: 'Physical cash on hand',
            parentId: cashParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '1002',
            name: 'Petty Cash',
            type: 'Asset',
            description: 'Petty cash fund',
            parentId: cashParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '1003',
            name: 'Cash in Transit',
            type: 'Asset',
            description: 'Cash in transit between locations',
            parentId: cashParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // ASSETS - Bank Account Children (1010)
    const bankParentId = accountMap['1010'];
    if (bankParentId) {
        await createAccountIfNotExists({
            code: '1011',
            name: 'Operating Bank Account',
            type: 'Asset',
            description: 'Primary operating bank account',
            parentId: bankParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '1012',
            name: 'Escrow Bank Account',
            type: 'Asset',
            description: 'Escrow account for client funds',
            parentId: bankParentId,
            isPostable: true,
            cashFlowCategory: 'Escrow',
        });
        await createAccountIfNotExists({
            code: '1013',
            name: 'Trust Bank Account',
            type: 'Asset',
            description: 'Trust account for client funds',
            parentId: bankParentId,
            isPostable: true,
            cashFlowCategory: 'Escrow',
        });
        await createAccountIfNotExists({
            code: '1014',
            name: 'Savings Account',
            type: 'Asset',
            description: 'Savings account',
            parentId: bankParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // ASSETS - Accounts Receivable Children (1100)
    const arParentId = accountMap['1100'];
    if (arParentId) {
        await createAccountIfNotExists({
            code: '1101',
            name: 'Trade Receivables - Sales',
            type: 'Asset',
            description: 'Receivables from property sales',
            parentId: arParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '1102',
            name: 'Trade Receivables - Rentals',
            type: 'Asset',
            description: 'Receivables from rental income',
            parentId: arParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '1103',
            name: 'Receivables - Advances',
            type: 'Asset',
            description: 'Receivables from customer advances',
            parentId: arParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '1104',
            name: 'Receivables - Overdue',
            type: 'Asset',
            description: 'Overdue receivables',
            parentId: arParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // ASSETS - Customer Advances & Deposits (1200) - NEW PARENT
    const customerAdvancesParent = await createAccountIfNotExists({
        code: '1200',
        name: 'Customer Advances & Deposits',
        type: 'Asset',
        description: 'Customer advances and deposits received',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '1201',
        name: 'Customer Advances - Sales',
        type: 'Asset',
        description: 'Advances received for property sales',
        parentId: customerAdvancesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '1202',
        name: 'Customer Deposits - Rentals',
        type: 'Asset',
        description: 'Deposits received for rentals',
        parentId: customerAdvancesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '1203',
        name: 'Security Deposits Held',
        type: 'Asset',
        description: 'Security deposits held in company accounts',
        parentId: customerAdvancesParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    // ASSETS - Escrow & Trust Accounts (1300) - NEW PARENT
    const escrowParent = await createAccountIfNotExists({
        code: '1300',
        name: 'Escrow & Trust Accounts',
        type: 'Asset',
        description: 'Escrow and trust accounts for client funds',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '1301',
        name: 'Escrow - Sales Proceeds',
        type: 'Asset',
        description: 'Escrow account for sales proceeds',
        parentId: escrowParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '1302',
        name: 'Escrow - Rental Deposits',
        type: 'Asset',
        description: 'Escrow account for rental deposits',
        parentId: escrowParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '1303',
        name: 'Escrow - Contractor Retainage',
        type: 'Asset',
        description: 'Escrow account for contractor retainage',
        parentId: escrowParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    // ASSETS - Property Assets (1400) - NEW PARENT
    const propertyAssetsParent = await createAccountIfNotExists({
        code: '1400',
        name: 'Property Assets',
        type: 'Asset',
        description: 'Property inventory and construction assets',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '1401',
        name: 'Property Inventory - For Sale',
        type: 'Asset',
        description: 'Properties held for sale',
        parentId: propertyAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '1402',
        name: 'Property Inventory - Under Construction',
        type: 'Asset',
        description: 'Properties under construction',
        parentId: propertyAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '1403',
        name: 'Work in Progress (WIP)',
        type: 'Asset',
        description: 'Work in progress - construction costs',
        parentId: propertyAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '1404',
        name: 'Construction Costs - Capitalized',
        type: 'Asset',
        description: 'Capitalized construction costs',
        parentId: propertyAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    // ASSETS - Other Assets (1500) - NEW PARENT
    const otherAssetsParent = await createAccountIfNotExists({
        code: '1500',
        name: 'Other Assets',
        type: 'Asset',
        description: 'Other assets',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '1501',
        name: 'Prepaid Expenses',
        type: 'Asset',
        description: 'Prepaid expenses',
        parentId: otherAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '1502',
        name: 'Deposits Paid',
        type: 'Asset',
        description: 'Deposits paid to vendors',
        parentId: otherAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '1503',
        name: 'Other Receivables',
        type: 'Asset',
        description: 'Other receivables',
        parentId: otherAssetsParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // LIABILITIES - Dealer Payable Children (2000)
    const dealerPayableParentId = accountMap['2000'];
    if (dealerPayableParentId) {
        await createAccountIfNotExists({
            code: '2001',
            name: 'Dealer Commissions Payable',
            type: 'Liability',
            description: 'Commissions owed to dealers',
            parentId: dealerPayableParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '2002',
            name: 'Dealer Advances Paid',
            type: 'Liability',
            description: 'Advances paid to dealers',
            parentId: dealerPayableParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // LIABILITIES - Customer Deposits & Advances (2100) - NEW PARENT
    const customerDepositsParent = await createAccountIfNotExists({
        code: '2100',
        name: 'Customer Deposits & Advances',
        type: 'Liability',
        description: 'Customer deposits and advances received',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2101',
        name: 'Customer Advances - Sales',
        type: 'Liability',
        description: 'Advances received for property sales',
        parentId: customerDepositsParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2102',
        name: 'Security Deposits - Rentals',
        type: 'Liability',
        description: 'Security deposits received for rentals',
        parentId: customerDepositsParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '2103',
        name: 'Customer Deposits - Refundable',
        type: 'Liability',
        description: 'Refundable customer deposits',
        parentId: customerDepositsParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // LIABILITIES - Escrow Liabilities (2200) - NEW PARENT
    const escrowLiabilitiesParent = await createAccountIfNotExists({
        code: '2200',
        name: 'Escrow Liabilities',
        type: 'Liability',
        description: 'Escrow liabilities for client funds',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '2201',
        name: 'Escrow Payable - Sales',
        type: 'Liability',
        description: 'Escrow payable for sales',
        parentId: escrowLiabilitiesParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '2202',
        name: 'Escrow Payable - Rentals',
        type: 'Liability',
        description: 'Escrow payable for rentals',
        parentId: escrowLiabilitiesParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    await createAccountIfNotExists({
        code: '2203',
        name: 'Escrow Payable - Contractor',
        type: 'Liability',
        description: 'Escrow payable to contractors',
        parentId: escrowLiabilitiesParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    // LIABILITIES - Deferred Revenue (2300) - NEW PARENT
    const deferredRevenueParent = await createAccountIfNotExists({
        code: '2300',
        name: 'Deferred Revenue',
        type: 'Liability',
        description: 'Deferred revenue',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2301',
        name: 'Deferred Revenue - Sales',
        type: 'Liability',
        description: 'Deferred revenue from sales',
        parentId: deferredRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2302',
        name: 'Deferred Revenue - Rentals',
        type: 'Liability',
        description: 'Deferred revenue from rentals',
        parentId: deferredRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2303',
        name: 'Unearned Commission',
        type: 'Liability',
        description: 'Unearned commission',
        parentId: deferredRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // LIABILITIES - Contractor Payables (2400) - NEW PARENT
    const contractorPayablesParent = await createAccountIfNotExists({
        code: '2400',
        name: 'Contractor Payables',
        type: 'Liability',
        description: 'Amounts owed to contractors',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2401',
        name: 'Contractor Payable - Construction',
        type: 'Liability',
        description: 'Amounts owed to construction contractors',
        parentId: contractorPayablesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2402',
        name: 'Contractor Payable - Maintenance',
        type: 'Liability',
        description: 'Amounts owed to maintenance contractors',
        parentId: contractorPayablesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2403',
        name: 'Retainage Payable',
        type: 'Liability',
        description: 'Retainage held from contractors',
        parentId: contractorPayablesParent.id,
        isPostable: true,
        cashFlowCategory: 'Escrow',
    });
    // LIABILITIES - Other Payables (2500) - NEW PARENT
    const otherPayablesParent = await createAccountIfNotExists({
        code: '2500',
        name: 'Other Payables',
        type: 'Liability',
        description: 'Other payables',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2501',
        name: 'Accrued Expenses',
        type: 'Liability',
        description: 'Accrued expenses',
        parentId: otherPayablesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2502',
        name: 'Taxes Payable',
        type: 'Liability',
        description: 'Taxes payable',
        parentId: otherPayablesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '2503',
        name: 'Other Payables',
        type: 'Liability',
        description: 'Other payables',
        parentId: otherPayablesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // EQUITY - Owner Equity Children (3000)
    const ownerEquityParentId = accountMap['3000'];
    if (ownerEquityParentId) {
        await createAccountIfNotExists({
            code: '3001',
            name: 'Capital Contributions',
            type: 'Equity',
            description: 'Capital contributions from owners',
            parentId: ownerEquityParentId,
            isPostable: true,
            cashFlowCategory: 'Financing',
        });
        await createAccountIfNotExists({
            code: '3002',
            name: 'Retained Earnings',
            type: 'Equity',
            description: 'Retained earnings',
            parentId: ownerEquityParentId,
            isPostable: true,
            cashFlowCategory: 'Financing',
        });
        await createAccountIfNotExists({
            code: '3003',
            name: 'Current Year Earnings',
            type: 'Equity',
            description: 'Current year earnings',
            parentId: ownerEquityParentId,
            isPostable: true,
            cashFlowCategory: 'Financing',
        });
    }
    // REVENUE - Deal Revenue Children (4000)
    const dealRevenueParentId = accountMap['4000'];
    if (dealRevenueParentId) {
        await createAccountIfNotExists({
            code: '4001',
            name: 'Revenue - Property Sales',
            type: 'Revenue',
            description: 'Revenue from property sales',
            parentId: dealRevenueParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '4002',
            name: 'Revenue - Property Rentals',
            type: 'Revenue',
            description: 'Revenue from property rentals',
            parentId: dealRevenueParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '4003',
            name: 'Revenue - Commission Income',
            type: 'Revenue',
            description: 'Commission income',
            parentId: dealRevenueParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '4004',
            name: 'Revenue - Other Services',
            type: 'Revenue',
            description: 'Revenue from other services',
            parentId: dealRevenueParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // REVENUE - Project-Wise Revenue (4100) - NEW PARENT
    const projectRevenueParent = await createAccountIfNotExists({
        code: '4100',
        name: 'Project-Wise Revenue',
        type: 'Revenue',
        description: 'Revenue by project',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    // Note: Project-specific accounts (4101, 4102, etc.) should be created dynamically
    // when projects are set up. Example accounts shown below:
    await createAccountIfNotExists({
        code: '4101',
        name: 'Revenue - Project A',
        type: 'Revenue',
        description: 'Revenue from Project A',
        parentId: projectRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '4102',
        name: 'Revenue - Project B',
        type: 'Revenue',
        description: 'Revenue from Project B',
        parentId: projectRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // REVENUE - Unit-Wise Revenue (4200) - NEW PARENT
    const unitRevenueParent = await createAccountIfNotExists({
        code: '4200',
        name: 'Unit-Wise Revenue',
        type: 'Revenue',
        description: 'Revenue by unit',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '4201',
        name: 'Revenue - Unit Sales',
        type: 'Revenue',
        description: 'Revenue from unit sales',
        parentId: unitRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '4202',
        name: 'Revenue - Unit Rentals',
        type: 'Revenue',
        description: 'Revenue from unit rentals',
        parentId: unitRevenueParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // EXPENSES - Commission Expense Children (5000)
    const commissionExpenseParentId = accountMap['5000'];
    if (commissionExpenseParentId) {
        await createAccountIfNotExists({
            code: '5001',
            name: 'Dealer Commission Expense',
            type: 'Expense',
            description: 'Commission expense for dealers',
            parentId: commissionExpenseParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '5002',
            name: 'Broker Commission Expense',
            type: 'Expense',
            description: 'Commission expense for brokers',
            parentId: commissionExpenseParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '5003',
            name: 'Referral Commission Expense',
            type: 'Expense',
            description: 'Commission expense for referrals',
            parentId: commissionExpenseParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // EXPENSES - Refunds/Write-offs Children (5100)
    const refundExpenseParentId = accountMap['5100'];
    if (refundExpenseParentId) {
        await createAccountIfNotExists({
            code: '5101',
            name: 'Refunds - Sales Cancellations',
            type: 'Expense',
            description: 'Refunds for sales cancellations',
            parentId: refundExpenseParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '5102',
            name: 'Refunds - Rental Deposits',
            type: 'Expense',
            description: 'Refunds for rental deposits',
            parentId: refundExpenseParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
        await createAccountIfNotExists({
            code: '5103',
            name: 'Write-offs - Bad Debts',
            type: 'Expense',
            description: 'Write-offs for bad debts',
            parentId: refundExpenseParentId,
            isPostable: true,
            cashFlowCategory: 'Operating',
        });
    }
    // EXPENSES - Construction & WIP Costs (5200) - NEW PARENT
    const constructionCostsParent = await createAccountIfNotExists({
        code: '5200',
        name: 'Construction & WIP Costs',
        type: 'Expense',
        description: 'Construction and work in progress costs',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '5201',
        name: 'Construction Materials',
        type: 'Expense',
        description: 'Cost of construction materials',
        parentId: constructionCostsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '5202',
        name: 'Construction Labor',
        type: 'Expense',
        description: 'Cost of construction labor',
        parentId: constructionCostsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '5203',
        name: 'Construction Overhead',
        type: 'Expense',
        description: 'Construction overhead costs',
        parentId: constructionCostsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '5204',
        name: 'WIP Expense - Project A',
        type: 'Expense',
        description: 'Work in progress expense for Project A',
        parentId: constructionCostsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    await createAccountIfNotExists({
        code: '5205',
        name: 'WIP Expense - Project B',
        type: 'Expense',
        description: 'Work in progress expense for Project B',
        parentId: constructionCostsParent.id,
        isPostable: true,
        cashFlowCategory: 'Investing',
    });
    // EXPENSES - Maintenance & Repairs (5300) - NEW PARENT
    const maintenanceParent = await createAccountIfNotExists({
        code: '5300',
        name: 'Maintenance & Repairs',
        type: 'Expense',
        description: 'Property maintenance and repair expenses',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5301',
        name: 'Property Maintenance',
        type: 'Expense',
        description: 'Property maintenance expenses',
        parentId: maintenanceParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5302',
        name: 'Repairs & Renovations',
        type: 'Expense',
        description: 'Repairs and renovation expenses',
        parentId: maintenanceParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5303',
        name: 'Contractor Payments - Maintenance',
        type: 'Expense',
        description: 'Payments to maintenance contractors',
        parentId: maintenanceParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // EXPENSES - Operating Expenses (5400) - NEW PARENT
    const operatingExpensesParent = await createAccountIfNotExists({
        code: '5400',
        name: 'Operating Expenses',
        type: 'Expense',
        description: 'General operating expenses',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5401',
        name: 'Property Management Fees',
        type: 'Expense',
        description: 'Property management fees',
        parentId: operatingExpensesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5402',
        name: 'Utilities Expense',
        type: 'Expense',
        description: 'Utilities expenses',
        parentId: operatingExpensesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5403',
        name: 'Insurance Expense',
        type: 'Expense',
        description: 'Insurance expenses',
        parentId: operatingExpensesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5404',
        name: 'Property Taxes Expense',
        type: 'Expense',
        description: 'Property taxes expenses',
        parentId: operatingExpensesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5405',
        name: 'Legal & Professional Fees',
        type: 'Expense',
        description: 'Legal and professional fees',
        parentId: operatingExpensesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5406',
        name: 'Marketing & Advertising',
        type: 'Expense',
        description: 'Marketing and advertising expenses',
        parentId: operatingExpensesParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    // EXPENSES - Depreciation & Amortization (5500) - NEW PARENT
    const depreciationParent = await createAccountIfNotExists({
        code: '5500',
        name: 'Depreciation & Amortization',
        type: 'Expense',
        description: 'Depreciation and amortization expenses (non-cash)',
        parentId: null,
        isPostable: false,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5501',
        name: 'Depreciation Expense',
        type: 'Expense',
        description: 'Depreciation expense (non-cash)',
        parentId: depreciationParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    await createAccountIfNotExists({
        code: '5502',
        name: 'Amortization Expense',
        type: 'Expense',
        description: 'Amortization expense (non-cash)',
        parentId: depreciationParent.id,
        isPostable: true,
        cashFlowCategory: 'Operating',
    });
    console.log('Expanded Chart of Accounts seeded successfully!');
}
async function createAccountIfNotExists(data) {
    const existing = await prisma.account.findUnique({
        where: { code: data.code },
    });
    if (existing) {
        // Update existing account with new fields if needed
        return await prisma.account.update({
            where: { id: existing.id },
            data: {
                isPostable: data.isPostable,
                cashFlowCategory: data.cashFlowCategory,
                parentId: data.parentId,
            },
        });
    }
    return await prisma.account.create({
        data: {
            code: data.code,
            name: data.name,
            type: data.type,
            description: data.description || null,
            parentId: data.parentId,
            isPostable: data.isPostable,
            cashFlowCategory: data.cashFlowCategory,
            isActive: true,
        },
    });
}
if (require.main === module) {
    seedExpandedChartOfAccounts()
        .catch((e) => {
        console.error(e);
        process.exit(1);
    })
        .finally(async () => {
        await prisma.$disconnect();
    });
}
//# sourceMappingURL=chart-of-accounts-expanded.js.map