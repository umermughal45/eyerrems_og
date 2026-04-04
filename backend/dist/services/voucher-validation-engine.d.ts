/**
 * Voucher Validation Engine
 * Accounting-grade, centralized validation for BPV, BRV, CPV, CRV, JV.
 * All rules enforced before save. No auto-fix, no downgrade to warnings.
 */
import type { Prisma } from '../prisma/client';
export type VoucherType = 'BPV' | 'BRV' | 'CPV' | 'CRV' | 'JV';
export type ControlType = 'CASH' | 'BANK' | 'AR' | 'AP' | 'NONE';
export type AccountCategory = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
export interface VoucherLineInput {
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
    propertyId?: string;
    unitId?: string;
}
export interface VoucherPayload {
    type: VoucherType;
    date: Date;
    paymentMethod: string;
    accountId: string;
    description?: string;
    referenceNumber?: string;
    lines: VoucherLineInput[];
}
export declare class VoucherValidationEngine {
    /**
     * Run all validations before save. Throws on first violation.
     * Call this before any voucher create/update DB write.
     */
    static validate(payload: VoucherPayload, tx?: Prisma.TransactionClient): Promise<void>;
    private static validateJV;
    private static validateCashBankVoucher;
}
//# sourceMappingURL=voucher-validation-engine.d.ts.map