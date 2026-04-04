/**
 * Account Validation Service
 * Implements posting rules and validations for Chart of Accounts
 */
import type { Account } from '@prisma/client';
export declare class AccountValidationService {
    /**
     * Validate that an account is postable
     * ❌ Header accounts → posting blocked
     * ✅ Only Level-5 Posting accounts can receive journal entries
     */
    static validateAccountPostable(accountId: string): Promise<void>;
    /**
     * Validate trust/escrow account usage
     * Trust accounts CANNOT:
     * - Pay expenses (❌ These accounts cannot pay expenses)
     * - Receive revenue (❌ These accounts cannot receive revenue)
     * Trust accounts CAN:
     * - Transfer to other trust accounts
     * - Transfer to/from trust liability accounts (211101, 211102)
     * - Refund to clients
     */
    static validateTrustAccountUsage(accountId: string, transactionType: 'debit' | 'credit', counterpartAccountId?: string): Promise<void>;
    /**
     * Validate revenue posting rule
     * ❌ Revenue NEVER posts to Cash
     * ❌ Revenue MUST go through Receivable first
     *
     * Proper flow:
     * 1. Recognize revenue: Dr Receivable, Cr Revenue
     * 2. Collect payment: Dr Cash, Cr Receivable
     */
    static validateRevenuePosting(debitAccountId: string, creditAccountId: string): Promise<void>;
    /**
     * Validate advance posting rule
     * Advances must go to liability accounts (2101, 2102)
     */
    static validateAdvancePosting(debitAccountId: string, creditAccountId: string): Promise<void>;
    /**
     * Validate double-entry balance
     */
    static validateDoubleEntryBalance(lines: Array<{
        debit: number;
        credit: number;
    }>): void;
    /**
     * Validate account type and balance calculation
     */
    static calculateAccountBalance(account: Account, debitTotal: number, creditTotal: number): number;
    /**
     * Get accounts filtered by postability for UI dropdowns
     */
    static getPostableAccounts(filters?: {
        type?: string;
        cashFlowCategory?: string;
    }): Promise<Account[]>;
    /**
     * Get accounts for specific UI dropdowns
     */
    static getAccountsForDropdown(dropdownType: 'journal' | 'voucher' | 'transaction' | 'invoice-tenant' | 'invoice-income' | 'payment-debit' | 'payment-credit'): Promise<Account[]>;
    /**
     * Validate escrow balance rule
     * Trust Assets (112101, 112102) must equal Client Liabilities (211101, 211102)
     * This is a hard stop if balance is negative
     */
    static validateEscrowBalance(): Promise<{
        isValid: boolean;
        message: string;
    }>;
    /**
     * Validate property/unit ID requirement for revenue/expense accounts
     * Property ID is mandatory for REMS (Real Estate Management System)
     * Unit ID is required for Sale/Rent accuracy
     */
    static validatePropertyUnitRequirement(accountId: string, propertyId?: string, unitId?: string): Promise<void>;
    /**
     * Comprehensive validation for journal entry
     * Validates all rules before allowing posting
     */
    static validateJournalEntry(lines: Array<{
        accountId: string;
        debit: number;
        credit: number;
        propertyId?: string;
        unitId?: string;
    }>): Promise<void>;
}
//# sourceMappingURL=account-validation-service.d.ts.map