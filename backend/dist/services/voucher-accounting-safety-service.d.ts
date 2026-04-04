/**
 * VoucherAccountingSafetyService - ERP-Grade Accounting Safety Enforcement
 *
 * CRITICAL RULES:
 * - All validations MUST be server-side (backend authority)
 * - Prevent posting in closed periods
 * - Prevent duplicate posting (idempotency)
 * - Enforce negative balance prevention
 * - Enforce property/unit linkage for property-related transactions
 * - Enforce daily cash limits for CPV
 * - Support invoice allocation for BRV
 */
import { Prisma } from '../prisma/client';
export type VoucherType = 'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV';
export interface FinancialPeriod {
    id: string;
    startDate: Date;
    endDate: Date;
    status: 'open' | 'closed' | 'locked';
    fiscalYear: string;
}
export interface CashLimitConfig {
    dailyLimit: number;
    allowNegative: boolean;
    warningThreshold: number;
}
export declare class VoucherAccountingSafetyService {
    /**
     * Validate financial period is open for posting
     * Prevents posting in closed/locked periods
     */
    static validateFinancialPeriod(postingDate: Date, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
        period?: FinancialPeriod;
    }>;
    /**
     * Validate idempotency - prevent double posting
     * Checks if voucher is already posted
     */
    static validateIdempotency(voucherId: string, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
        alreadyPosted?: boolean;
    }>;
    /**
     * Validate cash balance and daily limits for CPV
     * Enforces daily cash limits and prevents negative balances
     */
    static validateCashBalance(accountId: string, creditAmount: number, // Amount being credited (reducing cash)
    voucherDate: Date, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
        currentBalance?: number;
        dailyTotal?: number;
    }>;
    /**
     * Validate bank balance (prevent negative unless explicitly allowed)
     */
    static validateBankBalance(accountId: string, creditAmount: number, // Amount being credited (reducing bank)
    tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
        currentBalance?: number;
    }>;
    /**
     * Validate property/unit linkage is mandatory for property-related vouchers
     */
    static validatePropertyUnitLinkage(type: VoucherType, propertyId: string | undefined, unitId: string | undefined, lines: Array<{
        propertyId?: string;
        unitId?: string;
    }>, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate duplicate reference numbers (cheque/transfer)
     */
    static validateDuplicateReference(type: VoucherType, paymentMethod: string, referenceNumber: string | undefined, voucherId: string | undefined, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
    }>;
    /**
     * Validate invoice allocation for BRV (Bank Receipt Voucher)
     * Supports partial payment allocation against open invoices
     */
    static validateInvoiceAllocation(invoiceAllocations: Array<{
        invoiceId: string;
        amount: number;
    }> | undefined, totalAmount: number, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
        allocatedTotal?: number;
    }>;
    /**
     * Validate lines, one-sided entries, and totals (global rule)
     * - Each line must have exactly one side > 0 (debit or credit, not both)
     * - No zero lines
     * - Total debit must equal total credit and be > 0
     * - JV requires minimum 2 lines
     */
    static validateLinesAndTotals(type: VoucherType, lines: Array<{
        debit: number;
        credit: number;
    }>): {
        valid: boolean;
        error?: string;
        totalDebit?: number;
        totalCredit?: number;
    };
    /**
     * Validate journal voucher cash/bank account usage requires elevated approval
     */
    static validateJournalVoucherCashBank(lines: Array<{
        accountId: string;
    }>, hasElevatedApproval: boolean, tx?: Prisma.TransactionClient): Promise<{
        valid: boolean;
        error?: string;
    }>;
}
//# sourceMappingURL=voucher-accounting-safety-service.d.ts.map