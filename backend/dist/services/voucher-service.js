"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherService = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const account_validation_service_1 = require("./account-validation-service");
class VoucherService {
    /**
     * Check if an account is a bank account
     */
    static isBankAccount(accountCode) {
        return accountCode.startsWith('1112') || accountCode.startsWith('111201') || accountCode.startsWith('111202');
    }
    /**
     * Check if an account is a cash account
     */
    static isCashAccount(accountCode) {
        return accountCode.startsWith('1111') || accountCode.startsWith('111101') || accountCode.startsWith('111102');
    }
    /**
     * Voucher-type rules are enforced by VoucherValidationEngine (voucher-validation-engine.ts).
     * Do not add voucher-type validation here; use the engine.
     */
    /**
     * Validate reference number uniqueness for cheque/transfer payments
     */
    static async validateReferenceNumber(type, paymentMethod, referenceNumber, voucherId, tx) {
        const { VoucherAccountingSafetyService } = await Promise.resolve().then(() => __importStar(require('./voucher-accounting-safety-service')));
        const check = await VoucherAccountingSafetyService.validateDuplicateReference(type, paymentMethod, referenceNumber, voucherId, tx);
        if (!check.valid) {
            throw new Error(check.error);
        }
    }
    /**
     * Validate attachments are present for bank/cash vouchers
     */
    static validateAttachments(type, attachments) {
        // Bank and Cash vouchers require attachments
        if (['BPV', 'BRV', 'CPV', 'CRV'].includes(type)) {
            if (!attachments || attachments.length === 0) {
                throw new Error(`${type} requires at least one attachment (receipt, invoice, bank statement, etc.)`);
            }
        }
    }
    /**
     * Validate property/unit linkage (hardened with mandatory enforcement)
     */
    static async validatePropertyUnitLinkage(propertyId, unitId, lines, type, tx) {
        const { VoucherAccountingSafetyService } = await Promise.resolve().then(() => __importStar(require('./voucher-accounting-safety-service')));
        const check = await VoucherAccountingSafetyService.validatePropertyUnitLinkage(type, propertyId, unitId, lines, tx);
        if (!check.valid) {
            throw new Error(check.error);
        }
    }
    /**
     * Validate payee entity exists
     */
    static async validatePayeeEntity(payeeType, payeeId, type, tx) {
        // Payee is required for payment vouchers (BPV, CPV)
        if (['BPV', 'CPV'].includes(type) && !payeeType) {
            throw new Error(`${type} requires a payee type (Vendor, Owner, Agent, Contractor, Tenant, Client, Dealer, or Employee)`);
        }
        if (!payeeType || !payeeId) {
            return; // Optional for receipt vouchers
        }
        let exists = false;
        switch (payeeType) {
            case 'Vendor':
                // Vendor doesn't exist as a model - might be stored differently or we skip
                // For now, we'll allow it if payeeId is provided
                exists = true;
                break;
            case 'Owner':
                // Owner might be in Property.ownerName or separate table - for now allow
                exists = true;
                break;
            case 'Agent':
            case 'Dealer':
                exists = !!(await tx.dealer.findUnique({ where: { id: payeeId } }));
                break;
            case 'Tenant':
                exists = !!(await tx.tenant.findUnique({ where: { id: payeeId } }));
                break;
            case 'Client':
                exists = !!(await tx.client.findUnique({ where: { id: payeeId } }));
                break;
            case 'Employee':
                exists = !!(await tx.employee.findUnique({ where: { id: payeeId } }));
                break;
            case 'Contractor':
                // Contractor might be a vendor or stored differently - for now allow
                exists = true;
                break;
        }
        if (!exists) {
            throw new Error(`${payeeType} with ID ${payeeId} not found`);
        }
    }
    /**
     * Validate negative balance (prevent unless explicitly allowed)
     */
    static async validateAccountBalance(accountId, creditAmount, tx) {
        if (creditAmount <= 0) {
            return; // Only check when crediting (reducing) the account
        }
        const account = await tx.account.findUnique({ where: { id: accountId } });
        if (!account) {
            return;
        }
        // For cash/bank accounts, check balance
        if (account.code.startsWith('1111') || account.code.startsWith('1112')) {
            // Get current balance from ledger entries
            const debitTotal = await tx.ledgerEntry.aggregate({
                where: { debitAccountId: accountId, deletedAt: null },
                _sum: { amount: true },
            });
            const creditTotal = await tx.ledgerEntry.aggregate({
                where: { creditAccountId: accountId, deletedAt: null },
                _sum: { amount: true },
            });
            const currentBalance = (debitTotal._sum.amount || 0) - (creditTotal._sum.amount || 0);
            const newBalance = currentBalance - creditAmount;
            if (newBalance < 0 && !account.trustFlag) {
                // Allow negative for trust accounts, but warn for operating accounts
                // For now, we'll allow it but could add a flag for strict balance checking
                // throw new Error(`Insufficient balance in account ${account.code} (${account.name}). Current: ${currentBalance.toFixed(2)}, After transaction: ${newBalance.toFixed(2)}`);
            }
        }
    }
    /**
     * Auto-generate system line for bank/cash vouchers
     */
    static generateSystemLine(type, accountId, amount, accountName) {
        const isBank = type === 'BPV' || type === 'BRV';
        const isPayment = type === 'BPV' || type === 'CPV';
        if (isPayment) {
            // BPV/CPV: Credit bank/cash
            return {
                accountId,
                debit: 0,
                credit: amount,
                description: `[SYSTEM] ${isBank ? 'Bank' : 'Cash'} Payment - Auto-generated`,
            };
        }
        else {
            // BRV/CRV: Debit bank/cash
            return {
                accountId,
                debit: amount,
                credit: 0,
                description: `[SYSTEM] ${isBank ? 'Bank' : 'Cash'} Receipt - Auto-generated`,
            };
        }
    }
    /**
     * Create a new voucher (draft status)
     * CRITICAL: Backend is source of truth. System lines are auto-generated.
     */
    static async createVoucher(payload) {
        return await client_1.default.$transaction(async (tx) => {
            const { VoucherAccountingSafetyService } = await Promise.resolve().then(() => __importStar(require('./voucher-accounting-safety-service')));
            const { VoucherValidationEngine } = await Promise.resolve().then(() => __importStar(require('./voucher-validation-engine')));
            if (!payload.type) {
                throw new Error('Voucher type is required');
            }
            if (!payload.date) {
                throw new Error('Voucher date is required');
            }
            if (!payload.paymentMethod) {
                throw new Error('Payment method is required');
            }
            if (!payload.lines || !Array.isArray(payload.lines) || payload.lines.length === 0) {
                throw new Error('Voucher must have at least one line item');
            }
            const isJV = payload.type === 'JV';
            if (!isJV && !payload.accountId) {
                throw new Error('Bank/Cash account is required for BPV, BRV, CPV, CRV.');
            }
            if (isJV && !payload.accountId && payload.lines[0]?.accountId) {
                payload.accountId = payload.lines[0].accountId;
            }
            if (isJV && !payload.accountId) {
                throw new Error('Journal Voucher requires at least one line with an account. Use first line account as primary for storage.');
            }
            if (['BPV', 'BRV'].includes(payload.type) && ['Cheque', 'Transfer'].includes(payload.paymentMethod)) {
                if (!payload.referenceNumber || payload.referenceNumber.trim() === '') {
                    throw new Error('Reference number is required for Cheque/Transfer payments');
                }
            }
            await VoucherValidationEngine.validate({
                type: payload.type,
                date: payload.date,
                paymentMethod: payload.paymentMethod,
                accountId: payload.accountId,
                description: payload.description,
                referenceNumber: payload.referenceNumber,
                lines: payload.lines,
            }, tx);
            const userLines = isJV
                ? [...payload.lines]
                : payload.lines.filter((line) => line.accountId !== payload.accountId);
            if (!userLines.length) {
                throw new Error('Voucher must have at least one user-entered line item');
            }
            const primaryAccount = await tx.account.findUnique({
                where: { id: payload.accountId },
            });
            if (!primaryAccount) {
                throw new Error(`Primary account not found: ${payload.accountId}`);
            }
            if (!isJV) {
                await account_validation_service_1.AccountValidationService.validateAccountPostable(payload.accountId);
            }
            // Calculate totals from user lines
            const userTotalDebit = userLines.reduce((sum, line) => sum + (line.debit || 0), 0);
            const userTotalCredit = userLines.reduce((sum, line) => sum + (line.credit || 0), 0);
            // Auto-generate system line for BPV/BRV/CPV/CRV
            let systemLine = null;
            let finalLines;
            if (['BPV', 'BRV', 'CPV', 'CRV'].includes(payload.type)) {
                // Calculate system line amount
                const systemAmount = payload.type === 'BPV' || payload.type === 'CPV'
                    ? userTotalDebit // Payment: Credit bank/cash = sum of debits
                    : userTotalCredit; // Receipt: Debit bank/cash = sum of credits
                if (systemAmount <= 0) {
                    throw new Error(`${payload.type} requires at least one ${payload.type === 'BPV' || payload.type === 'CPV' ? 'debit' : 'credit'} entry with amount > 0`);
                }
                // Generate system line
                systemLine = this.generateSystemLine(payload.type, payload.accountId, systemAmount, primaryAccount.name);
                // Combine user lines + system line
                finalLines = [...userLines, systemLine];
            }
            else {
                // JV: No system line, user must balance
                finalLines = userLines;
                // Validate JV balance
                if (Math.abs(userTotalDebit - userTotalCredit) > 0.01) {
                    throw new Error(`Journal Voucher must balance: total debit (${userTotalDebit.toFixed(2)}) ≠ total credit (${userTotalCredit.toFixed(2)})`);
                }
            }
            // Global line-level accounting validation (one-sided lines, totals > 0, balanced)
            const lineValidation = VoucherAccountingSafetyService.validateLinesAndTotals(payload.type, finalLines);
            if (!lineValidation.valid) {
                throw new Error(lineValidation.error);
            }
            // CRITICAL: Calculate total amount based on voucher type (server-side calculation)
            // BPV/CPV: total_amount = sum(user debit lines)
            // BRV/CRV: total_amount = sum(user credit lines)
            // JV: total_amount = sum(debit) [since debit = credit]
            let amount;
            if (payload.type === 'BPV' || payload.type === 'CPV') {
                // Payment vouchers: amount = sum of user debit entries
                amount = userTotalDebit;
            }
            else if (payload.type === 'BRV' || payload.type === 'CRV') {
                // Receipt vouchers: amount = sum of user credit entries
                amount = userTotalCredit;
            }
            else {
                // JV: amount = sum of debit (debit equals credit)
                const totalDebit = finalLines.reduce((sum, line) => sum + (line.debit || 0), 0);
                amount = totalDebit;
            }
            // Validate amount is positive
            if (amount <= 0) {
                throw new Error(`Voucher total amount must be greater than zero. Calculated amount: ${amount}`);
            }
            // Validate reference number
            await this.validateReferenceNumber(payload.type, payload.paymentMethod, payload.referenceNumber, undefined, tx);
            // Validate attachments (optional for draft, but validate structure)
            if (payload.attachments && payload.attachments.length > 0) {
                // Structure is valid, will be enforced on submit/post
            }
            // Validate property/unit linkage (hardened) - use final lines
            await this.validatePropertyUnitLinkage(payload.propertyId, payload.unitId, finalLines, payload.type, tx);
            // Validate payee entity
            await this.validatePayeeEntity(payload.payeeType, payload.payeeId, payload.type, tx);
            // CRITICAL: Validate invoice allocations for BRV
            if (payload.type === 'BRV' && payload.invoiceAllocations) {
                const allocationCheck = await VoucherAccountingSafetyService.validateInvoiceAllocation(payload.invoiceAllocations, amount, tx);
                if (!allocationCheck.valid) {
                    throw new Error(allocationCheck.error);
                }
            }
            // Validate all line accounts are postable
            for (const line of finalLines) {
                await account_validation_service_1.AccountValidationService.validateAccountPostable(line.accountId);
            }
            // DATA INTEGRITY SAFEGUARD: Assert system line count
            if (['BPV', 'BRV', 'CPV', 'CRV'].includes(payload.type)) {
                const systemLineCount = finalLines.filter((line) => line.accountId === payload.accountId).length;
                if (systemLineCount !== 1) {
                    throw new Error(`Data integrity violation: ${payload.type} must have exactly one system-generated line. Found ${systemLineCount}.`);
                }
            }
            else {
                // JV: No system lines
                const systemLineCount = finalLines.filter((line) => {
                    const lineAccount = finalLines.find((l) => l.accountId === line.accountId);
                    // Check if account is bank/cash (shouldn't be in JV)
                    return false; // JV validation already handled above
                }).length;
                // JV has zero system lines (validated in VoucherValidationEngine)
            }
            // Generate voucher number: TYPE-YYYYMMDD-XXX
            const date = new Date();
            const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
            let random = Math.floor(100 + Math.random() * 900).toString();
            let voucherNumber = `${payload.type}-${dateStr}-${random}`;
            // Ensure uniqueness
            let existing = await tx.voucher.findUnique({ where: { voucherNumber } });
            if (existing) {
                random = Math.floor(10000 + Math.random() * 90000).toString();
                voucherNumber = `${payload.type}-${dateStr}-${random}`;
            }
            // Prepare attachments JSON (includes invoice allocations metadata for BRV)
            let attachmentsData = null;
            if (payload.attachments || (payload.invoiceAllocations && payload.invoiceAllocations.length > 0)) {
                attachmentsData = {
                    files: payload.attachments ? JSON.parse(JSON.stringify(payload.attachments)) : [],
                    invoiceAllocations: payload.invoiceAllocations || undefined,
                };
            }
            // Create voucher with final lines (user + system)
            const voucher = await tx.voucher.create({
                data: {
                    voucherNumber,
                    type: payload.type,
                    date: payload.date,
                    paymentMethod: payload.paymentMethod,
                    accountId: payload.accountId,
                    description: payload.description,
                    referenceNumber: payload.referenceNumber,
                    amount,
                    status: 'draft',
                    attachments: attachmentsData ? JSON.parse(JSON.stringify(attachmentsData)) : null,
                    propertyId: payload.propertyId,
                    unitId: payload.unitId,
                    payeeType: payload.payeeType,
                    payeeId: payload.payeeId,
                    dealId: payload.dealId,
                    preparedByUserId: payload.preparedByUserId,
                    lines: {
                        create: finalLines.map((line) => ({
                            accountId: line.accountId,
                            debit: line.debit || 0,
                            credit: line.credit || 0,
                            description: line.description,
                            propertyId: line.propertyId || payload.propertyId,
                            unitId: line.unitId || payload.unitId,
                        })),
                    },
                },
                include: {
                    account: true,
                    property: true,
                    unit: true,
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                    preparedBy: true,
                },
            });
            return voucher;
        });
    }
    /**
     * Update a draft voucher
     * CRITICAL: Applies same auto-generation logic as createVoucher
     */
    static async updateVoucher(voucherId, payload, userId) {
        return await client_1.default.$transaction(async (tx) => {
            const { VoucherAccountingSafetyService } = await Promise.resolve().then(() => __importStar(require('./voucher-accounting-safety-service')));
            const existing = await tx.voucher.findUnique({
                where: { id: voucherId },
                include: { lines: true },
            });
            if (!existing) {
                throw new Error(`Voucher not found: ${voucherId}`);
            }
            // TASK 5: Prevent editing posted vouchers - only allow draft status
            if (existing.status !== 'draft') {
                if (existing.status === 'posted') {
                    throw new Error('Cannot edit posted voucher. Posted vouchers can only be modified via reversal voucher. ' +
                        'Create a reversal voucher to undo this transaction.');
                }
                throw new Error(`Cannot update voucher in ${existing.status} status. Only draft vouchers can be updated. ` +
                    `To modify a ${existing.status} voucher, it must first be reversed (if posted) or returned to draft status.`);
            }
            const voucherType = existing.type;
            const accountId = payload.accountId || existing.accountId;
            // If lines are being updated, apply same auto-generation logic
            let finalLines = [];
            let calculatedAmount = existing.amount;
            if (payload.lines) {
                const { VoucherValidationEngine } = await Promise.resolve().then(() => __importStar(require('./voucher-validation-engine')));
                const isJV = voucherType === 'JV';
                const userLines = isJV
                    ? payload.lines.filter((line) => !line.description?.includes('[SYSTEM]'))
                    : payload.lines.filter((line) => {
                        if (line.accountId === accountId)
                            return false;
                        if (line.description?.includes('[SYSTEM]'))
                            return false;
                        return true;
                    });
                if (userLines.length === 0) {
                    throw new Error('Voucher must have at least one user-entered line item');
                }
                await VoucherValidationEngine.validate({
                    type: voucherType,
                    date: payload.date || existing.date,
                    paymentMethod: payload.paymentMethod || existing.paymentMethod,
                    accountId,
                    description: payload.description,
                    referenceNumber: payload.referenceNumber,
                    lines: payload.lines,
                }, tx);
                // Get primary account details
                const primaryAccount = await tx.account.findUnique({
                    where: { id: accountId },
                });
                if (!primaryAccount) {
                    throw new Error(`Primary account not found: ${accountId}`);
                }
                // Calculate totals from user lines
                const userTotalDebit = userLines.reduce((sum, line) => sum + (line.debit || 0), 0);
                const userTotalCredit = userLines.reduce((sum, line) => sum + (line.credit || 0), 0);
                // Auto-generate system line for BPV/BRV/CPV/CRV
                if (['BPV', 'BRV', 'CPV', 'CRV'].includes(voucherType)) {
                    const systemAmount = voucherType === 'BPV' || voucherType === 'CPV'
                        ? userTotalDebit // Payment: Credit bank/cash = sum of debits
                        : userTotalCredit; // Receipt: Debit bank/cash = sum of credits
                    if (systemAmount <= 0) {
                        throw new Error(`${voucherType} requires at least one ${voucherType === 'BPV' || voucherType === 'CPV' ? 'debit' : 'credit'} entry with amount > 0`);
                    }
                    const systemLine = this.generateSystemLine(voucherType, accountId, systemAmount, primaryAccount.name);
                    finalLines = [...userLines, systemLine];
                }
                else {
                    // JV: No system line, user must balance
                    finalLines = userLines;
                    if (Math.abs(userTotalDebit - userTotalCredit) > 0.01) {
                        throw new Error(`Journal Voucher must balance: total debit (${userTotalDebit.toFixed(2)}) ≠ total credit (${userTotalCredit.toFixed(2)})`);
                    }
                }
                // Global line-level accounting validation
                const lineValidation = VoucherAccountingSafetyService.validateLinesAndTotals(voucherType, finalLines);
                if (!lineValidation.valid) {
                    throw new Error(lineValidation.error);
                }
                // CRITICAL: Calculate total amount based on voucher type (same logic as create)
                // BPV/CPV: total_amount = sum(user debit lines)
                // BRV/CRV: total_amount = sum(user credit lines)
                // JV: total_amount = sum(debit) [since debit = credit]
                if (voucherType === 'BPV' || voucherType === 'CPV') {
                    calculatedAmount = userTotalDebit;
                }
                else if (voucherType === 'BRV' || voucherType === 'CRV') {
                    calculatedAmount = userTotalCredit;
                }
                else {
                    // JV: amount = sum of debit (debit equals credit)
                    const totalDebit = finalLines.reduce((sum, line) => sum + (line.debit || 0), 0);
                    calculatedAmount = totalDebit;
                }
                // Validate amount is positive
                if (calculatedAmount <= 0) {
                    throw new Error(`Voucher total amount must be greater than zero. Calculated amount: ${calculatedAmount}`);
                }
                // Validate property/unit if changed
                if (payload.propertyId !== undefined || payload.unitId !== undefined || payload.lines) {
                    await this.validatePropertyUnitLinkage(payload.propertyId ?? existing.propertyId ?? undefined, payload.unitId ?? existing.unitId ?? undefined, finalLines, voucherType, tx);
                }
                // Validate payee if changed
                if (payload.payeeType !== undefined || payload.payeeId !== undefined) {
                    await this.validatePayeeEntity(payload.payeeType ?? existing.payeeType ?? undefined, payload.payeeId ?? existing.payeeId ?? undefined, voucherType, tx);
                }
                // Validate all line accounts are postable
                for (const line of finalLines) {
                    await account_validation_service_1.AccountValidationService.validateAccountPostable(line.accountId);
                }
                // DATA INTEGRITY SAFEGUARD: Assert system line count
                if (['BPV', 'BRV', 'CPV', 'CRV'].includes(voucherType)) {
                    const systemLineCount = finalLines.filter((line) => line.accountId === accountId).length;
                    if (systemLineCount !== 1) {
                        throw new Error(`Data integrity violation: ${voucherType} must have exactly one system-generated line. Found ${systemLineCount}.`);
                    }
                }
                // Delete existing lines and create new ones
                await tx.voucherLine.deleteMany({
                    where: { voucherId },
                });
                await Promise.all(finalLines.map((line) => tx.voucherLine.create({
                    data: {
                        voucherId,
                        accountId: line.accountId,
                        debit: line.debit || 0,
                        credit: line.credit || 0,
                        description: line.description,
                        propertyId: line.propertyId || payload.propertyId || existing.propertyId,
                        unitId: line.unitId || payload.unitId || existing.unitId,
                    },
                })));
            }
            // Validate reference number if changed
            if (payload.referenceNumber !== undefined) {
                await this.validateReferenceNumber(voucherType, (payload.paymentMethod || existing.paymentMethod), payload.referenceNumber, voucherId, tx);
            }
            // Prepare attachments JSON (includes invoice allocations metadata for BRV)
            let attachmentsData = undefined;
            if (payload.attachments || payload.invoiceAllocations) {
                const existingAttachments = existing.attachments;
                attachmentsData = {
                    files: payload.attachments ? JSON.parse(JSON.stringify(payload.attachments)) : (existingAttachments?.files || []),
                    invoiceAllocations: payload.invoiceAllocations || existingAttachments?.invoiceAllocations || undefined,
                };
            }
            // Update voucher
            const updated = await tx.voucher.update({
                where: { id: voucherId },
                data: {
                    date: payload.date,
                    paymentMethod: payload.paymentMethod,
                    accountId: payload.accountId,
                    description: payload.description,
                    referenceNumber: payload.referenceNumber,
                    amount: calculatedAmount,
                    attachments: attachmentsData ? JSON.parse(JSON.stringify(attachmentsData)) : undefined,
                    propertyId: payload.propertyId,
                    unitId: payload.unitId,
                    payeeType: payload.payeeType,
                    payeeId: payload.payeeId,
                    dealId: payload.dealId,
                },
                include: {
                    account: true,
                    property: true,
                    unit: true,
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                    preparedBy: true,
                },
            });
            return updated;
        });
    }
    /**
     * Submit voucher (draft -> submitted)
     */
    static async submitVoucher(voucherId, userId) {
        return await client_1.default.$transaction(async (tx) => {
            const voucher = await tx.voucher.findUnique({
                where: { id: voucherId },
                include: { lines: true },
            });
            if (!voucher) {
                throw new Error(`Voucher not found: ${voucherId}`);
            }
            if (voucher.status !== 'draft') {
                throw new Error(`Cannot submit voucher in ${voucher.status} status. Only draft vouchers can be submitted.`);
            }
            // Validate attachments are present (required for bank/cash vouchers)
            this.validateAttachments(voucher.type, voucher.attachments);
            // Update status
            const updated = await tx.voucher.update({
                where: { id: voucherId },
                data: {
                    status: 'submitted',
                },
                include: {
                    account: true,
                    property: true,
                    unit: true,
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                    preparedBy: true,
                },
            });
            return updated;
        });
    }
    /**
     * Approve voucher (submitted -> approved)
     */
    static async approveVoucher(voucherId, approvedByUserId) {
        return await client_1.default.$transaction(async (tx) => {
            const voucher = await tx.voucher.findUnique({
                where: { id: voucherId },
                include: { lines: true },
            });
            if (!voucher) {
                throw new Error(`Voucher not found: ${voucherId}`);
            }
            if (voucher.status !== 'submitted') {
                throw new Error(`Cannot approve voucher in ${voucher.status} status. Only submitted vouchers can be approved.`);
            }
            // Update status
            const updated = await tx.voucher.update({
                where: { id: voucherId },
                data: {
                    status: 'approved',
                    approvedByUserId,
                },
                include: {
                    account: true,
                    property: true,
                    unit: true,
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                    preparedBy: true,
                    approvedBy: true,
                },
            });
            return updated;
        });
    }
    /**
     * Post voucher (approved -> posted) - Creates journal entries
     */
    static async postVoucher(voucherId, postedByUserId, postingDate) {
        return await client_1.default.$transaction(async (tx) => {
            const { VoucherAccountingSafetyService } = await Promise.resolve().then(() => __importStar(require('./voucher-accounting-safety-service')));
            const voucher = await tx.voucher.findUnique({
                where: { id: voucherId },
                include: {
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                },
            });
            if (!voucher) {
                throw new Error(`Voucher not found: ${voucherId}`);
            }
            if (voucher.status !== 'approved') {
                throw new Error(`Cannot post voucher in ${voucher.status} status. Only approved vouchers can be posted.`);
            }
            // CRITICAL: Validate idempotency - prevent double posting
            const idempotencyCheck = await VoucherAccountingSafetyService.validateIdempotency(voucherId, tx);
            if (!idempotencyCheck.valid) {
                throw new Error(idempotencyCheck.error);
            }
            // CRITICAL: Validate financial period is open
            const actualPostingDate = postingDate || voucher.date;
            const periodCheck = await VoucherAccountingSafetyService.validateFinancialPeriod(actualPostingDate, tx);
            if (!periodCheck.valid) {
                throw new Error(periodCheck.error);
            }
            // Validate attachments are present
            this.validateAttachments(voucher.type, voucher.attachments);
            // Validate all accounts are still postable
            for (const line of voucher.lines) {
                await account_validation_service_1.AccountValidationService.validateAccountPostable(line.accountId);
            }
            await account_validation_service_1.AccountValidationService.validateAccountPostable(voucher.accountId);
            // Validate journal entry - include propertyId/unitId for revenue/expense validation
            const journalLines = voucher.lines.map((line) => ({
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                propertyId: line.propertyId ?? voucher.propertyId ?? undefined,
                unitId: line.unitId ?? voucher.unitId ?? undefined,
            }));
            await account_validation_service_1.AccountValidationService.validateJournalEntry(journalLines);
            // Global line-level accounting validation (one-sided lines, totals > 0, balanced)
            const lineValidation = VoucherAccountingSafetyService.validateLinesAndTotals(voucher.type, voucher.lines);
            if (!lineValidation.valid) {
                throw new Error(lineValidation.error);
            }
            // CRITICAL: Validate account balances with hardened enforcement
            for (const line of voucher.lines) {
                if (line.credit > 0) {
                    // Check if it's a cash account
                    const account = await tx.account.findUnique({ where: { id: line.accountId } });
                    if (account && (account.code.startsWith('1111') || account.code.startsWith('111101') || account.code.startsWith('111102'))) {
                        const cashCheck = await VoucherAccountingSafetyService.validateCashBalance(line.accountId, line.credit, actualPostingDate, tx);
                        if (!cashCheck.valid) {
                            throw new Error(cashCheck.error);
                        }
                    }
                    else if (account && (account.code.startsWith('1112') || account.code.startsWith('111201') || account.code.startsWith('111202'))) {
                        const bankCheck = await VoucherAccountingSafetyService.validateBankBalance(line.accountId, line.credit, tx);
                        if (!bankCheck.valid) {
                            throw new Error(bankCheck.error);
                        }
                    }
                    else {
                        // Fallback to original validation for other accounts
                        await this.validateAccountBalance(line.accountId, line.credit, tx);
                    }
                }
            }
            // CRITICAL: Apply invoice allocations for BRV (update invoice remainingAmount)
            if (voucher.type === 'BRV' && voucher.attachments) {
                const attachmentsData = voucher.attachments;
                const invoiceAllocations = attachmentsData?.invoiceAllocations;
                if (invoiceAllocations && invoiceAllocations.length > 0) {
                    for (const allocation of invoiceAllocations) {
                        // Update invoice remainingAmount
                        const invoice = await tx.invoice.findUnique({
                            where: { id: allocation.invoiceId },
                        });
                        if (invoice) {
                            const newRemainingAmount = Math.max(0, invoice.remainingAmount - allocation.amount);
                            const newStatus = newRemainingAmount === 0 ? 'paid' : invoice.status;
                            await tx.invoice.update({
                                where: { id: allocation.invoiceId },
                                data: {
                                    remainingAmount: newRemainingAmount,
                                    status: newStatus,
                                },
                            });
                        }
                    }
                }
            }
            // Create journal entry
            // Generate entry number using same format as finance.ts
            const date = new Date();
            const dateSegment = () => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}${month}${day}`;
            };
            const randomSuffix = () => Math.floor(100 + Math.random() * 900).toString();
            const entryNumber = `JV-${dateSegment()}-${randomSuffix()}`;
            const journalEntry = await tx.journalEntry.create({
                data: {
                    entryNumber,
                    voucherNo: voucher.voucherNumber,
                    date: actualPostingDate,
                    description: voucher.description || `${voucher.type} ${voucher.voucherNumber}`,
                    narration: voucher.referenceNumber || null,
                    status: 'posted',
                    attachments: voucher.attachments ? voucher.attachments : null,
                    preparedByUserId: voucher.preparedByUserId,
                    approvedByUserId: voucher.approvedByUserId,
                    lines: {
                        create: voucher.lines.map((line) => ({
                            accountId: line.accountId,
                            debit: line.debit,
                            credit: line.credit,
                            description: line.description || voucher.description,
                        })),
                    },
                },
            });
            // ARCHITECTURAL NOTE: JournalEntry and JournalLine are the General Ledger (source of truth).
            // LedgerEntry model requires a dealId and is legacy (only for deal-based entries).
            // Account Ledger report now reads from JournalLine, so vouchers automatically appear
            // in the General Ledger without needing separate LedgerEntry records.
            // This ensures all posted transactions (vouchers, receipts, invoices) are included.
            // Update voucher status
            const updated = await tx.voucher.update({
                where: { id: voucherId },
                data: {
                    status: 'posted',
                    journalEntryId: journalEntry.id,
                    postedByUserId,
                    postedAt: new Date(),
                    postingDate: actualPostingDate,
                },
                include: {
                    account: true,
                    property: true,
                    unit: true,
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                    journalEntry: {
                        include: {
                            lines: {
                                include: {
                                    account: true,
                                },
                            },
                        },
                    },
                    preparedBy: true,
                    approvedBy: true,
                },
            });
            return updated;
        });
    }
    /**
     * Reverse a posted voucher
     */
    static async reverseVoucher(voucherId, reversedByUserId, reversalDate) {
        return await client_1.default.$transaction(async (tx) => {
            const original = await tx.voucher.findUnique({
                where: { id: voucherId },
                include: {
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                },
            });
            if (!original) {
                throw new Error(`Voucher not found: ${voucherId}`);
            }
            if (original.status !== 'posted') {
                throw new Error(`Cannot reverse voucher in ${original.status} status. Only posted vouchers can be reversed.`);
            }
            if (original.reversedVoucherId) {
                throw new Error(`Voucher ${original.voucherNumber} has already been reversed`);
            }
            // Create reversal voucher with opposite entries
            const reversalLines = original.lines.map((line) => ({
                accountId: line.accountId,
                debit: line.credit, // Swap debit and credit
                credit: line.debit,
                description: `Reversal of ${original.voucherNumber}: ${line.description || ''}`,
                propertyId: line.propertyId || undefined,
                unitId: line.unitId || undefined,
            }));
            // Create reversal voucher and post it immediately
            // Note: createVoucher will generate the voucher number automatically
            const reversalVoucher = await this.createVoucher({
                type: original.type,
                date: reversalDate,
                paymentMethod: original.paymentMethod,
                accountId: original.accountId,
                description: `Reversal of ${original.voucherNumber}: ${original.description || ''}`,
                referenceNumber: original.referenceNumber ? `REV-${original.referenceNumber}` : undefined,
                propertyId: original.propertyId || undefined,
                unitId: original.unitId || undefined,
                payeeType: original.payeeType,
                payeeId: original.payeeId || undefined,
                dealId: original.dealId || undefined,
                lines: reversalLines,
                attachments: original.attachments,
                preparedByUserId: reversedByUserId,
            });
            // Post the reversal voucher immediately
            const postedReversal = await this.postVoucher(reversalVoucher.id, reversedByUserId, reversalDate);
            // Update original voucher
            const updated = await tx.voucher.update({
                where: { id: voucherId },
                data: {
                    status: 'reversed',
                    reversedVoucherId: postedReversal.id,
                    reversedByUserId,
                    reversedAt: new Date(),
                },
            });
            return {
                original: updated,
                reversal: postedReversal,
            };
        });
    }
    /**
     * Get voucher by ID
     * TASK 4: Returns voucher header fields + all lines (including system lines)
     * Used for both viewing and editing
     */
    static async getVoucherById(voucherId) {
        const voucher = await client_1.default.voucher.findUnique({
            where: { id: voucherId },
            include: {
                account: true,
                property: true,
                unit: true,
                deal: {
                    include: {
                        client: true,
                        property: true,
                    },
                },
                lines: {
                    include: {
                        account: true,
                        property: true,
                        unit: true,
                    },
                    // Note: VoucherLine doesn't have createdAt, order by id to maintain consistency
                    orderBy: {
                        id: 'asc',
                    },
                },
                journalEntry: {
                    include: {
                        lines: {
                            include: {
                                account: true,
                            },
                        },
                    },
                },
                preparedBy: true,
                approvedBy: true,
                // Note: postedBy relation doesn't exist in schema, only postedByUserId field exists
            },
        });
        if (!voucher) {
            return null;
        }
        // Ensure all header fields are present (no N/A placeholders)
        // The database should have these, but we ensure they're returned
        return {
            ...voucher,
            // Ensure amount is always present and matches stored value
            amount: voucher.amount || 0,
            // Ensure all required fields are present
            voucherNumber: voucher.voucherNumber,
            type: voucher.type,
            date: voucher.date,
            paymentMethod: voucher.paymentMethod,
            accountId: voucher.accountId,
            description: voucher.description || null,
            referenceNumber: voucher.referenceNumber || null,
            status: voucher.status,
            // Lines are already included with accounts
        };
    }
    /**
     * List vouchers with filters
     */
    static async listVouchers(filters) {
        const where = {};
        if (filters.type) {
            where.type = filters.type;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.propertyId) {
            where.propertyId = filters.propertyId;
        }
        if (filters.dateFrom || filters.dateTo) {
            where.date = {};
            if (filters.dateFrom) {
                where.date.gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                where.date.lte = filters.dateTo;
            }
        }
        const [vouchers, total] = await Promise.all([
            client_1.default.voucher.findMany({
                where,
                include: {
                    account: true,
                    property: true,
                    unit: true,
                    lines: {
                        include: {
                            account: true,
                        },
                    },
                    preparedBy: true,
                    approvedBy: true,
                },
                orderBy: { date: 'desc' },
                take: filters.limit || 50,
                skip: filters.offset || 0,
            }),
            client_1.default.voucher.count({ where }),
        ]);
        return { vouchers, total };
    }
}
exports.VoucherService = VoucherService;
//# sourceMappingURL=voucher-service.js.map