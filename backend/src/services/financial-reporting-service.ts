/**
 * Financial Reporting Service
 * Generates Trial Balance, Balance Sheet, P&L, Property Profitability, Escrow Report, and Aging Reports
 * 
 * Fixed to properly respect COA hierarchy and aggregate parent account balances from children
 */

import prisma from '../prisma/client';
import { AccountValidationService } from './account-validation-service';

export interface TrialBalanceEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  level?: number;
  isParent?: boolean;
}

export interface BalanceSheet {
  assets: {
    current: TrialBalanceEntry[];
    fixed: TrialBalanceEntry[];
    total: number;
  };
  liabilities: {
    current: TrialBalanceEntry[];
    total: number;
  };
  equity: {
    capital: TrialBalanceEntry[];
    retainedEarnings: TrialBalanceEntry[];
    currentYearProfit: TrialBalanceEntry[];
    total: number;
  };
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export interface ProfitAndLoss {
  revenue: {
    propertyRevenue: TrialBalanceEntry[];
    serviceIncome: TrialBalanceEntry[];
    total: number;
  };
  expenses: {
    selling: TrialBalanceEntry[];
    property: TrialBalanceEntry[];
    administrative: TrialBalanceEntry[];
    tax: TrialBalanceEntry[];
    total: number;
  };
  netProfit: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface PropertyProfitability {
  propertyId: string;
  propertyName: string;
  propertyCode?: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  profitMargin: number;
  revenueBreakdown: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
  expenseBreakdown: Array<{
    accountCode: string;
    accountName: string;
    amount: number;
  }>;
}

export interface EscrowReport {
  trustAssets: {
    accountCode: string;
    accountName: string;
    balance: number;
  }[];
  clientLiabilities: {
    accountCode: string;
    accountName: string;
    balance: number;
  }[];
  totalTrustAssets: number;
  totalClientLiabilities: number;
  difference: number;
  isBalanced: boolean;
  violations: string[];
}

export interface AgingEntry {
  accountId: string;
  accountCode: string;
  accountName: string;
  current: number; // 0-30 days
  days31_60: number; // 31-60 days
  days61_90: number; // 61-90 days
  days91_plus: number; // 91+ days
  total: number;
  oldestDate?: Date;
}

export class FinancialReportingService {
  /**
   * Calculate account balance from ledger entries
   */
  private static async calculateAccountBalance(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ debitTotal: number; creditTotal: number; balance: number }> {
    const where: any = {
      OR: [
        { debitAccountId: accountId },
        { creditAccountId: accountId },
      ],
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const [debitEntries, creditEntries] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { ...where, debitAccountId: accountId },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { ...where, creditAccountId: accountId },
        _sum: { amount: true },
      }),
    ]);

    const debitTotal = debitEntries._sum.amount || 0;
    const creditTotal = creditEntries._sum.amount || 0;

    // Get account to determine normal balance
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    let balance = 0;
    if (account?.normalBalance === 'Debit') {
      balance = debitTotal - creditTotal;
    } else {
      balance = creditTotal - debitTotal;
    }

    return {
      debitTotal: Number(debitTotal.toFixed(2)),
      creditTotal: Number(creditTotal.toFixed(2)),
      balance: Number(balance.toFixed(2)),
    };
  }

  /**
   * Recursively calculate account balance including all child accounts
   * For parent accounts, this aggregates balances from all children
   */
  private static async calculateAccountBalanceWithChildren(
    accountId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{ debitTotal: number; creditTotal: number; balance: number }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
        },
      },
    });

    if (!account) {
      return { debitTotal: 0, creditTotal: 0, balance: 0 };
    }

    // If account has children, aggregate from children
    if (account.children && account.children.length > 0) {
      let totalDebit = 0;
      let totalCredit = 0;
      let totalBalance = 0;

      for (const child of account.children) {
        const childBalance = await this.calculateAccountBalanceWithChildren(
          child.id,
          startDate,
          endDate
        );
        totalDebit += childBalance.debitTotal;
        totalCredit += childBalance.creditTotal;
        totalBalance += childBalance.balance;
      }

      return {
        debitTotal: Number(totalDebit.toFixed(2)),
        creditTotal: Number(totalCredit.toFixed(2)),
        balance: Number(totalBalance.toFixed(2)),
      };
    }

    // If no children, calculate from ledger entries
    return this.calculateAccountBalance(accountId, startDate, endDate);
  }

  /**
   * Get all descendant accounts (children, grandchildren, etc.) for an account
   */
  private static async getAllDescendantAccounts(accountId: string): Promise<string[]> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        children: {
          where: { isActive: true },
          include: { children: true },
        },
      },
    });

    if (!account || !account.children || account.children.length === 0) {
      return [accountId];
    }

    const descendantIds: string[] = [accountId];
    for (const child of account.children) {
      const childDescendants = await this.getAllDescendantAccounts(child.id);
      descendantIds.push(...childDescendants);
    }

    return descendantIds;
  }

  /**
   * Generate Trial Balance
   * Shows all posting accounts with proper hierarchy aggregation
   */
  static async generateTrialBalance(
    startDate?: Date,
    endDate?: Date
  ): Promise<TrialBalanceEntry[]> {
    // Get all posting accounts (level 5) and parent accounts that need aggregation
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        OR: [
          { isPostable: true, level: 5 }, // Posting accounts
          { isPostable: false, accountType: { in: ['Header', 'Control'] } }, // Parent accounts for aggregation
        ],
      },
      include: {
        children: {
          where: { isActive: true },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    const entries: TrialBalanceEntry[] = [];

    for (const account of accounts) {
      // For posting accounts, calculate directly
      if (account.isPostable && account.level === 5) {
        let debitTotal = 0;
        let creditTotal = 0;
        let balance = 0;

        if (startDate) {
          const openingEnd = new Date(startDate);
          openingEnd.setMilliseconds(openingEnd.getMilliseconds() - 1);

          const opening = await this.calculateAccountBalance(account.id, undefined, openingEnd);
          const movement = await this.calculateAccountBalance(account.id, startDate, endDate);

          debitTotal = opening.debitTotal + movement.debitTotal;
          creditTotal = opening.creditTotal + movement.creditTotal;
        } else {
          const totals = await this.calculateAccountBalance(account.id, undefined, endDate);
          debitTotal = totals.debitTotal;
          creditTotal = totals.creditTotal;
        }

        if (account.normalBalance === 'Debit') {
          balance = debitTotal - creditTotal;
        } else {
          balance = creditTotal - debitTotal;
        }

        if (balance !== 0 || debitTotal > 0 || creditTotal > 0) {
          entries.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.type,
            normalBalance: account.normalBalance,
            debitTotal: Number(debitTotal.toFixed(2)),
            creditTotal: Number(creditTotal.toFixed(2)),
            balance: Number(balance.toFixed(2)),
            level: account.level,
            isParent: false,
          });
        }
      } else if (account.children && account.children.length > 0) {
        // For parent accounts, aggregate from children
        const aggregated = await this.calculateAccountBalanceWithChildren(
          account.id,
          startDate,
          endDate
        );

        if (aggregated.balance !== 0 || aggregated.debitTotal > 0 || aggregated.creditTotal > 0) {
          entries.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.type,
            normalBalance: account.normalBalance || 'Debit',
            debitTotal: aggregated.debitTotal,
            creditTotal: aggregated.creditTotal,
            balance: aggregated.balance,
            level: account.level,
            isParent: true,
          });
        }
      }
    }

    return entries;
  }

  /**
   * Generate Balance Sheet
   * Assets = Liabilities + Equity
   * Fixed to use proper account categorization and hierarchy
   */
  static async generateBalanceSheet(
    asOfDate?: Date
  ): Promise<BalanceSheet> {
    const endDate = asOfDate || new Date();

    // Get all accounts with hierarchy
    const allAccounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        children: {
          where: { isActive: true },
        },
        parent: true,
      },
      orderBy: [{ code: 'asc' }],
    });

    // Helper to determine if account is current asset (typically codes 11xx)
    const isCurrentAsset = (code: string) => {
      // Current assets: 11xx (Cash, Receivables, etc.)
      // Fixed assets: 12xx, 13xx, etc.
      return code.startsWith('11') && !code.startsWith('112'); // Exclude trust/escrow (112xx)
    };

    // Helper to determine if account is fixed asset
    const isFixedAsset = (code: string) => {
      return code.startsWith('12') || code.startsWith('13') || code.startsWith('14') || code.startsWith('15');
    };

    // Assets (1xxx) excluding trust/escrow accounts
    const assetAccounts = allAccounts.filter(a => 
      a.code.startsWith('1') && !a.trustFlag && a.type === 'Asset'
    );
    
    const currentAssetAccounts = assetAccounts.filter(a => 
      isCurrentAsset(a.code) || (a.parent && isCurrentAsset(a.parent.code))
    );
    
    const fixedAssetAccounts = assetAccounts.filter(a => 
      isFixedAsset(a.code) || (a.parent && isFixedAsset(a.parent.code))
    );

    // Liabilities (2xxx) - current liabilities (21xx)
    const liabilityAccounts = allAccounts.filter(a => 
      a.code.startsWith('2') && 
      (a.isPostable || (a.children && a.children.length > 0)) &&
      !a.trustFlag
    );

    // Equity (3xxx)
    const equityAccounts = allAccounts.filter(a => 
      a.code.startsWith('3') && 
      (a.isPostable || (a.children && a.children.length > 0))
    );

    const processAccounts = async (accounts: any[]) => {
      const entries: TrialBalanceEntry[] = [];
      for (const account of accounts) {
        const balances = await this.calculateAccountBalanceWithChildren(account.id, undefined, endDate);
        
        // Only include if has balance or has transactions
        if (balances.balance !== 0 || balances.debitTotal > 0 || balances.creditTotal > 0) {
          entries.push({
            accountId: account.id,
            accountCode: account.code,
            accountName: account.name,
            accountType: account.type,
            normalBalance: account.normalBalance || 'Debit',
            debitTotal: balances.debitTotal,
            creditTotal: balances.creditTotal,
            balance: balances.balance,
            level: account.level,
            isParent: account.children && account.children.length > 0,
          });
        }
      }
      return entries;
    };

    const [currentAssets, fixedAssets, liabilities, equity] = await Promise.all([
      processAccounts(currentAssetAccounts),
      processAccounts(fixedAssetAccounts),
      processAccounts(liabilityAccounts),
      processAccounts(equityAccounts),
    ]);

    // Calculate totals
    const currentAssetsTotal = currentAssets.reduce((sum, a) => {
      // For assets, use absolute value of balance (should be positive)
      return sum + Math.max(0, a.balance);
    }, 0);
    
    const fixedAssetsTotal = fixedAssets.reduce((sum, a) => {
      return sum + Math.max(0, a.balance);
    }, 0);
    
    const assetsTotal = currentAssetsTotal + fixedAssetsTotal;

    // For liabilities and equity, use absolute value (they should be credit balances)
    const liabilitiesTotal = liabilities.reduce((sum, l) => {
      return sum + Math.abs(l.balance);
    }, 0);
    
    const equityTotal = equity.reduce((sum, e) => {
      return sum + Math.abs(e.balance);
    }, 0);
    
    const totalLiabilitiesAndEquity = liabilitiesTotal + equityTotal;

    // Categorize equity by code prefixes (3100 = Capital, 3200 = Retained Earnings, 3300 = Current Year Profit)
    const capitalEquity = equity.filter(e => 
      e.accountCode.startsWith('3100') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('3100'))
    );
    
    const retainedEarningsEquity = equity.filter(e => 
      e.accountCode.startsWith('3200') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('3200'))
    );
    
    const currentYearProfitEquity = equity.filter(e => 
      e.accountCode.startsWith('3300') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('3300'))
    );

    return {
      assets: {
        current: currentAssets,
        fixed: fixedAssets,
        total: assetsTotal,
      },
      liabilities: {
        current: liabilities,
        total: liabilitiesTotal,
      },
      equity: {
        capital: capitalEquity,
        retainedEarnings: retainedEarningsEquity,
        currentYearProfit: currentYearProfitEquity,
        total: equityTotal,
      },
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(assetsTotal - totalLiabilitiesAndEquity) < 0.01,
    };
  }

  /**
   * Generate Profit & Loss Statement
   * Income – Expenses
   * Fixed to use account hierarchy instead of hardcoded codes
   */
  static async generateProfitAndLoss(
    startDate: Date,
    endDate: Date
  ): Promise<ProfitAndLoss> {
    // Get all accounts with hierarchy
    const allAccounts = await prisma.account.findMany({
      where: { isActive: true },
      include: {
        children: {
          where: { isActive: true },
        },
        parent: true,
      },
      orderBy: [{ code: 'asc' }],
    });

    // Revenue accounts (4xxx) - all revenue accounts
    const revenueAccounts = allAccounts.filter(a => 
      a.type === 'Revenue' && 
      a.code.startsWith('4') &&
      (a.isPostable || (a.children && a.children.length > 0))
    );

    // Expense accounts (5xxx) - all expense accounts
    const expenseAccounts = allAccounts.filter(a => 
      a.type === 'Expense' && 
      a.code.startsWith('5') &&
      (a.isPostable || (a.children && a.children.length > 0))
    );

    const processAccounts = async (accounts: any[]) => {
      const entries: TrialBalanceEntry[] = [];
      for (const account of accounts) {
        const balances = await this.calculateAccountBalanceWithChildren(account.id, startDate, endDate);
        
        // For P&L, we care about the period activity, not absolute balance
        // Revenue accounts typically have credit normal balance, expenses have debit
        entries.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          accountType: account.type,
          normalBalance: account.normalBalance || (account.type === 'Revenue' ? 'Credit' : 'Debit'),
          debitTotal: balances.debitTotal,
          creditTotal: balances.creditTotal,
          balance: balances.balance,
          level: account.level,
          isParent: account.children && account.children.length > 0,
        });
      }
      return entries;
    };

    const [revenueEntries, expenseEntries] = await Promise.all([
      processAccounts(revenueAccounts),
      processAccounts(expenseAccounts),
    ]);

    // Categorize revenue by code prefixes (411x = Property Revenue, 421x = Service Income)
    const propertyRevenue = revenueEntries.filter(e => 
      e.accountCode.startsWith('411') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('411'))
    );
    
    const serviceIncome = revenueEntries.filter(e => 
      e.accountCode.startsWith('421') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('421'))
    );

    // Categorize expenses by code prefixes
    const sellingExpenses = expenseEntries.filter(e => 
      e.accountCode.startsWith('511') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('511'))
    );
    
    const propertyExpenses = expenseEntries.filter(e => 
      e.accountCode.startsWith('521') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('521'))
    );
    
    const administrativeExpenses = expenseEntries.filter(e => 
      e.accountCode.startsWith('531') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('531'))
    );
    
    const taxExpenses = expenseEntries.filter(e => 
      e.accountCode.startsWith('541') || 
      (allAccounts.find(a => a.id === e.accountId)?.parent?.code?.startsWith('541'))
    );

    // Calculate totals - use absolute values for revenue/expense
    const totalRevenue = revenueEntries.reduce((sum, r) => {
      // Revenue should be positive (credit balance)
      return sum + Math.abs(r.creditTotal);
    }, 0);
    
    const totalExpenses = expenseEntries.reduce((sum, e) => {
      // Expenses should be positive (debit balance)
      return sum + Math.abs(e.debitTotal);
    }, 0);
    
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenue: {
        propertyRevenue,
        serviceIncome,
        total: totalRevenue,
      },
      expenses: {
        selling: sellingExpenses,
        property: propertyExpenses,
        administrative: administrativeExpenses,
        tax: taxExpenses,
        total: totalExpenses,
      },
      netProfit: Number(netProfit.toFixed(2)),
      period: { startDate, endDate },
    };
  }

  /**
   * Generate Property Profitability Report
   * Filtered by Property ID
   * Uses both LedgerEntry (via deals) and FinanceLedger (direct property mapping)
   */
  static async generatePropertyProfitability(
    propertyId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PropertyProfitability[]> {
    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = startDate;
    if (endDate) dateFilter.lte = endDate;

    // Build property filter
    const propertyFilter: any = {};
    if (propertyId) {
      propertyFilter.propertyId = propertyId;
    }

    // Get ledger entries from deals (revenue/expenses via deals)
    const ledgerEntryWhere: any = {
      deletedAt: null,
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    };

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: ledgerEntryWhere,
      include: {
        debitAccount: true,
        creditAccount: true,
        deal: {
          include: {
            property: true,
          },
        },
      },
    });

    // Get finance ledger entries (direct property mapping for expenses/income)
    const financeLedgerWhere: any = {
      isDeleted: false,
      ...(propertyId ? { propertyId } : {}),
      ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
    };

    const financeLedgerEntries = await prisma.financeLedger.findMany({
      where: financeLedgerWhere,
      include: {
        Property: true,
      },
    });

    // Group by property
    const propertyMap = new Map<string, PropertyProfitability>();

    // If specific property requested, initialize it even if no transactions found
    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, name: true, propertyCode: true },
      });

      if (property) {
        propertyMap.set(property.id, {
          propertyId: property.id,
          propertyName: property.name,
          propertyCode: property.propertyCode || undefined,
          revenue: 0,
          expenses: 0,
          netProfit: 0,
          profitMargin: 0,
          revenueBreakdown: [],
          expenseBreakdown: [],
        });
      }
    }

    // Process LedgerEntry (Deal-based)
    for (const entry of ledgerEntries) {
      const deal = entry.deal;
      if (!deal || !deal.property) continue;

      // Filter by propertyId if specified
      if (propertyId && deal.property.id !== propertyId) continue;

      const propId = deal.property.id;
      
      if (!propertyMap.has(propId)) {
        const property = await prisma.property.findUnique({
          where: { id: propId },
          select: { name: true, propertyCode: true },
        });
        propertyMap.set(propId, {
          propertyId: propId,
          propertyName: property?.name || 'Unknown Property',
          propertyCode: property?.propertyCode || undefined,
          revenue: 0,
          expenses: 0,
          netProfit: 0,
          profitMargin: 0,
          revenueBreakdown: [],
          expenseBreakdown: [],
        });
      }

      const profitability = propertyMap.get(propId);
      if (!profitability) continue; // Skip if property not found in map

      // Validate entry amount
      const entryAmount = typeof entry.amount === 'number' && !Number.isNaN(entry.amount) ? entry.amount : 0;

      // Process debit account (expense)
      if (entry.debitAccount && entry.debitAccount.type === 'Expense' && entryAmount !== 0) {
        profitability.expenses += entryAmount;
        const existing = profitability.expenseBreakdown.find(
          e => e.accountCode === entry.debitAccount!.code
        );
        if (existing) {
          existing.amount += entryAmount;
        } else {
          profitability.expenseBreakdown.push({
            accountCode: entry.debitAccount.code,
            accountName: entry.debitAccount.name || entry.debitAccount.code,
            amount: entryAmount,
          });
        }
      }

      // Process credit account (revenue)
      if (entry.creditAccount && entry.creditAccount.type === 'Revenue' && entryAmount !== 0) {
        profitability.revenue += entryAmount;
        const existing = profitability.revenueBreakdown.find(
          r => r.accountCode === entry.creditAccount!.code
        );
        if (existing) {
          existing.amount += entryAmount;
        } else {
          profitability.revenueBreakdown.push({
            accountCode: entry.creditAccount.code,
            accountName: entry.creditAccount.name || entry.creditAccount.code,
            amount: entryAmount,
          });
        }
      }
    }

    // Process FinanceLedger entries (direct property expenses/income)
    for (const entry of financeLedgerEntries) {
      if (!entry.propertyId) continue;

      if (!propertyMap.has(entry.propertyId)) {
        propertyMap.set(entry.propertyId, {
          propertyId: entry.propertyId,
          propertyName: entry.Property?.name || 'Unknown Property',
          propertyCode: entry.Property?.propertyCode || undefined,
          revenue: 0,
          expenses: 0,
          netProfit: 0,
          profitMargin: 0,
          revenueBreakdown: [],
          expenseBreakdown: [],
        });
      }

      const profitability = propertyMap.get(entry.propertyId);
      if (!profitability) continue; // Skip if property not found in map

      // Validate entry amount
      const entryAmount = typeof entry.amount === 'number' && !Number.isNaN(entry.amount) ? entry.amount : 0;
      if (entryAmount === 0) continue; // Skip zero-amount entries

      // Categorize by category field
      if (entry.category === 'Income' || entry.category === 'Revenue') {
        profitability.revenue += entryAmount;
        const existing = profitability.revenueBreakdown.find(
          r => r.accountCode === entry.category
        );
        if (existing) {
          existing.amount += entryAmount;
        } else {
          profitability.revenueBreakdown.push({
            accountCode: entry.category || 'Revenue',
            accountName: entry.description || entry.category || 'Revenue',
            amount: entryAmount,
          });
        }
      } else if (entry.category === 'Expense' || entry.category === 'Maintenance' || entry.category === 'Utility') {
        profitability.expenses += entryAmount;
        const existing = profitability.expenseBreakdown.find(
          e => e.accountCode === entry.category
        );
        if (existing) {
          existing.amount += entryAmount;
        } else {
          profitability.expenseBreakdown.push({
            accountCode: entry.category || 'Expense',
            accountName: entry.description || entry.category || 'Expense',
            amount: entryAmount,
          });
        }
      }
    }

    // Calculate net profit and margins
    const results = Array.from(propertyMap.values()).map(p => ({
      ...p,
      netProfit: Number((p.revenue - p.expenses).toFixed(2)),
      profitMargin: p.revenue > 0 
        ? Number(((p.revenue - p.expenses) / p.revenue * 100).toFixed(2))
        : p.revenue === 0 && p.expenses > 0 ? -100 : 0,
      revenue: Number(p.revenue.toFixed(2)),
      expenses: Number(p.expenses.toFixed(2)),
    }));

    return results;
  }

  /**
   * Generate Escrow Report
   * Trust Assets = Client Liabilities
   * Fixed to use trustFlag instead of hardcoded account codes
   */
  static async generateEscrowReport(): Promise<EscrowReport> {
    // Get all trust asset accounts (Asset accounts with trustFlag = true)
    const trustAssetAccounts = await prisma.account.findMany({
      where: {
        isActive: true,
        trustFlag: true,
        type: 'Asset',
        code: { startsWith: '1' }, // Assets start with 1
      },
      include: {
        children: {
          where: { isActive: true },
        },
      },
    });

    // Get all client liability accounts (Liability accounts with trustFlag = true)
    const clientLiabilityAccounts = await prisma.account.findMany({
      where: {
        isActive: true,
        trustFlag: true,
        type: 'Liability',
        code: { startsWith: '2' }, // Liabilities start with 2
      },
      include: {
        children: {
          where: { isActive: true },
        },
      },
    });

    // Calculate balances with hierarchy support
    const trustAssets = await Promise.all(
      trustAssetAccounts.map(async (account) => {
        const balances = await this.calculateAccountBalanceWithChildren(account.id);
        return {
          accountCode: account.code,
          accountName: account.name,
          balance: Math.max(0, balances.balance), // Trust assets should be positive
        };
      })
    );

    const clientLiabilities = await Promise.all(
      clientLiabilityAccounts.map(async (account) => {
        const balances = await this.calculateAccountBalanceWithChildren(account.id);
        return {
          accountCode: account.code,
          accountName: account.name,
          balance: Math.abs(balances.balance), // Liabilities are credit balances (absolute value)
        };
      })
    );

    const totalTrustAssets = trustAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalClientLiabilities = clientLiabilities.reduce((sum, l) => sum + l.balance, 0);
    const difference = totalTrustAssets - totalClientLiabilities;
    const isBalanced = Math.abs(difference) < 0.01;

    const violations: string[] = [];
    if (!isBalanced) {
      violations.push(
        `Escrow balance mismatch: Trust Assets (${totalTrustAssets.toFixed(2)}) ≠ Client Liabilities (${totalClientLiabilities.toFixed(2)})`
      );
    }

    if (totalTrustAssets < 0) {
      violations.push('Negative trust asset balance detected');
    }

    if (totalClientLiabilities < 0) {
      violations.push('Negative client liability balance detected');
    }

    return {
      trustAssets,
      clientLiabilities,
      totalTrustAssets: Number(totalTrustAssets.toFixed(2)),
      totalClientLiabilities: Number(totalClientLiabilities.toFixed(2)),
      difference: Number(difference.toFixed(2)),
      isBalanced,
      violations,
    };
  }

  /**
   * Generate Aging Report for Receivables/Payables
   * Improved to properly calculate aging buckets and handle account filtering
   */
  static async generateAgingReport(
    type: 'Receivable' | 'Payable',
    asOfDate?: Date
  ): Promise<AgingEntry[]> {
    const cutoffDate = asOfDate || new Date();
    const days30 = new Date(cutoffDate);
    days30.setDate(days30.getDate() - 30);
    const days60 = new Date(cutoffDate);
    days60.setDate(days60.getDate() - 60);
    const days90 = new Date(cutoffDate);
    days90.setDate(days90.getDate() - 90);

    // Get receivable or payable accounts using proper filtering
    const accounts = await prisma.account.findMany({
      where: {
        isActive: true,
        type: type === 'Receivable' ? 'Asset' : 'Liability',
        OR: [
          // Direct accounts (113xx for receivables, 212xx for payables)
          type === 'Receivable' 
            ? { code: { startsWith: '113' } }
            : { code: { startsWith: '212' } },
          // Or parent accounts that have children matching the pattern
          {
            children: {
              some: {
                isActive: true,
                code: type === 'Receivable' 
                  ? { startsWith: '113' }
                  : { startsWith: '212' },
              },
            },
          },
        ],
      },
      include: {
        children: {
          where: { isActive: true },
        },
      },
    });

    const agingEntries: AgingEntry[] = [];

    for (const account of accounts) {
      // Get all descendant account IDs (including children)
      const accountIds = await this.getAllDescendantAccounts(account.id);
      
      // Only process if this is a posting account or has posting children
      const isPostingAccount = account.isPostable && account.level === 5;
      const hasPostingChildren = account.children?.some(c => c.isPostable && c.level === 5);
      
      if (!isPostingAccount && !hasPostingChildren) continue;

      // Get all ledger entries for this account and its descendants
      const entries = await prisma.ledgerEntry.findMany({
        where: {
          OR: [
            { debitAccountId: { in: accountIds } },
            { creditAccountId: { in: accountIds } },
          ],
          deletedAt: null,
          date: { lte: cutoffDate },
        },
        orderBy: { date: 'asc' },
      });

      // Calculate running balance by date
      let runningBalance = 0;
      const balanceByDate = new Map<number, number>(); // Map of timestamp to balance

      for (const entry of entries) {
        const isDebit = entry.debitAccountId ? accountIds.includes(entry.debitAccountId) : false;
        const isCredit = entry.creditAccountId ? accountIds.includes(entry.creditAccountId) : false;
        
        if (type === 'Receivable') {
          // Receivables: debits increase, credits decrease
          runningBalance += isDebit ? entry.amount : -entry.amount;
        } else {
          // Payables: credits increase, debits decrease
          runningBalance += isCredit ? entry.amount : -entry.amount;
        }
        
        const timestamp = entry.date.getTime();
        balanceByDate.set(timestamp, runningBalance);
      }

      // Age the balances
      let current = 0;
      let days31_60 = 0;
      let days61_90 = 0;
      let days91_plus = 0;
      let oldestDate: Date | undefined;

      // Sort by date to age properly
      const sortedDates = Array.from(balanceByDate.keys()).sort((a, b) => a - b);

      for (const timestamp of sortedDates) {
        const entryDate = new Date(timestamp);
        if (!oldestDate || entryDate < oldestDate) {
          oldestDate = entryDate;
        }

        const daysDiff = Math.floor(
          (cutoffDate.getTime() - timestamp) / (1000 * 60 * 60 * 24)
        );

        const balance = balanceByDate.get(timestamp) || 0;

        if (daysDiff <= 30) {
          current = balance;
        } else if (daysDiff <= 60) {
          // Only count the portion that's 31-60 days old
          const olderThan60 = balanceByDate.get(sortedDates.find(d => 
            Math.floor((cutoffDate.getTime() - d) / (1000 * 60 * 60 * 24)) > 60
          ) || timestamp) || 0;
          days31_60 = Math.max(0, balance - olderThan60);
        } else if (daysDiff <= 90) {
          const olderThan90 = balanceByDate.get(sortedDates.find(d => 
            Math.floor((cutoffDate.getTime() - d) / (1000 * 60 * 60 * 24)) > 90
          ) || timestamp) || 0;
          days61_90 = Math.max(0, balance - olderThan90);
        } else {
          days91_plus = Math.max(0, balance);
        }
      }

      // Use the final balance for aging distribution
      const finalBalance = runningBalance;
      if (finalBalance > 0) {
        // Simple aging: distribute based on oldest entry
        if (oldestDate) {
          const oldestDays = Math.floor(
            (cutoffDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (oldestDays <= 30) {
            current = finalBalance;
          } else if (oldestDays <= 60) {
            days31_60 = finalBalance;
          } else if (oldestDays <= 90) {
            days61_90 = finalBalance;
          } else {
            days91_plus = finalBalance;
          }
        } else {
          current = finalBalance;
        }
      }

      const total = Math.abs(current + days31_60 + days61_90 + days91_plus);

      if (total > 0) {
        agingEntries.push({
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          current: Number(Math.abs(current).toFixed(2)),
          days31_60: Number(Math.abs(days31_60).toFixed(2)),
          days61_90: Number(Math.abs(days61_90).toFixed(2)),
          days91_plus: Number(Math.abs(days91_plus).toFixed(2)),
          total: Number(total.toFixed(2)),
          oldestDate,
        });
      }
    }

    return agingEntries;
  }
}
