"use strict";
/**
 * Voucher Validation Engine
 * Accounting-grade, centralized validation for BPV, BRV, CPV, CRV, JV.
 * All rules enforced before save. No auto-fix, no downgrade to warnings.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherValidationEngine = void 0;
const client_1 = __importDefault(require("../prisma/client"));
const account_validation_service_1 = require("./account-validation-service");
function accountCategory(t) {
    const u = (t || '').toLowerCase();
    if (u === 'asset')
        return 'ASSET';
    if (u === 'liability')
        return 'LIABILITY';
    if (u === 'revenue')
        return 'INCOME';
    if (u === 'expense')
        return 'EXPENSE';
    if (u === 'equity')
        return 'EQUITY';
    return 'ASSET';
}
function controlType(acc) {
    const c = (acc.code || '').trim();
    const n = (acc.name || '').toLowerCase();
    if (c.startsWith('1111') || c.startsWith('111101') || c.startsWith('111102') || n.includes('cash'))
        return 'CASH';
    if (c.startsWith('1112') || c.startsWith('111201') || c.startsWith('111202') || n.includes('bank'))
        return 'BANK';
    if (c.startsWith('113') || n.includes('receivable'))
        return 'AR';
    if (c.startsWith('212') || n.includes('payable'))
        return 'AP';
    return 'NONE';
}
const RULES = {
    BPV: {
        name: 'Bank Payment Voucher',
        control: 'BANK',
        controlSide: 'credit',
        debitAllowed: ['EXPENSE', 'ASSET', 'LIABILITY'],
        creditAllowed: ['BANK'],
        forbiddenDebit: ['INCOME'],
        forbiddenControl: ['CASH'],
        forbiddenLineControl: ['CASH', 'BANK'],
        message: {
            control: 'BPV must credit exactly one Bank account. Cash accounts are not allowed.',
            debit: 'BPV debit side allows only Expense, Asset, or Accounts Payable.',
            noCredit: 'BPV line items must be debit only. Credit is auto-posted to Bank.',
        },
    },
    BRV: {
        name: 'Bank Receipt Voucher',
        control: 'BANK',
        controlSide: 'debit',
        creditAllowed: ['INCOME', 'ASSET', 'LIABILITY', 'EQUITY'],
        debitAllowed: ['BANK'],
        forbiddenCredit: ['EXPENSE'],
        forbiddenControl: ['CASH'],
        forbiddenLineControl: ['CASH', 'BANK'],
        message: {
            control: 'BRV must debit exactly one Bank account. Cash accounts are not allowed.',
            credit: 'BRV credit side allows only Revenue, Accounts Receivable, Liability, or Equity.',
            noDebit: 'BRV line items must be credit only. Debit is auto-posted to Bank.',
        },
    },
    CPV: {
        name: 'Cash Payment Voucher',
        control: 'CASH',
        controlSide: 'credit',
        debitAllowed: ['EXPENSE', 'ASSET', 'LIABILITY'],
        creditAllowed: ['CASH'],
        forbiddenDebit: ['INCOME'],
        forbiddenControl: ['BANK'],
        forbiddenLineControl: ['CASH', 'BANK'],
        message: {
            control: 'CPV must credit exactly one Cash account. Bank accounts are not allowed.',
            debit: 'CPV debit side allows only Expense, Asset, or Accounts Payable.',
            noCredit: 'CPV line items must be debit only. Credit is auto-posted to Cash.',
        },
    },
    CRV: {
        name: 'Cash Receipt Voucher',
        control: 'CASH',
        controlSide: 'debit',
        creditAllowed: ['INCOME', 'ASSET', 'LIABILITY', 'EQUITY'],
        debitAllowed: ['CASH'],
        forbiddenCredit: ['EXPENSE'],
        forbiddenControl: ['BANK'],
        forbiddenLineControl: ['CASH', 'BANK'],
        message: {
            control: 'CRV must debit exactly one Cash account. Bank accounts are not allowed.',
            credit: 'CRV credit side allows only Revenue, Accounts Receivable, Liability, or Equity.',
            noDebit: 'CRV line items must be credit only. Debit is auto-posted to Cash.',
        },
    },
    JV: {
        name: 'Journal Voucher',
        control: null,
        forbiddenLineControl: ['CASH', 'BANK', 'AR', 'AP'],
        allowedCategories: ['ASSET', 'LIABILITY', 'EXPENSE', 'EQUITY', 'INCOME'],
        message: {
            noControl: 'JV cannot use Cash, Bank, Accounts Receivable, or Accounts Payable. Use BPV/BRV/CPV/CRV for those.',
        },
    },
};
class VoucherValidationEngine {
    /**
     * Run all validations before save. Throws on first violation.
     * Call this before any voucher create/update DB write.
     */
    static async validate(payload, tx) {
        const client = tx || client_1.default;
        if (!payload.type || !payload.lines?.length) {
            throw new Error('Voucher type and at least one line are required.');
        }
        const t = payload.type;
        if (!['BPV', 'BRV', 'CPV', 'CRV', 'JV'].includes(t)) {
            throw new Error(`Invalid voucher type: ${t}. Allowed: BPV, BRV, CPV, CRV, JV.`);
        }
        if (t === 'JV') {
            await this.validateJV(payload, RULES.JV, client);
            return;
        }
        const rule = RULES[t];
        await this.validateCashBankVoucher(payload, rule, t, client);
    }
    static async validateJV(payload, rule, client) {
        const lines = payload.lines;
        if (lines.length < 2) {
            throw new Error('Journal Voucher must have at least 2 line items (minimum double-entry).');
        }
        const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Journal Voucher must balance. Total debits: ${totalDebit.toFixed(2)}, Total credits: ${totalCredit.toFixed(2)}.`);
        }
        if (totalDebit <= 0 || totalCredit <= 0) {
            throw new Error('Journal Voucher totals must be greater than zero.');
        }
        for (const line of lines) {
            if (!line.accountId) {
                throw new Error('Every JV line must have an account.');
            }
            const acc = await client.account.findUnique({ where: { id: line.accountId } });
            if (!acc) {
                throw new Error(`Account not found: ${line.accountId}`);
            }
            await account_validation_service_1.AccountValidationService.validateAccountPostable(line.accountId);
            const meta = {
                id: acc.id,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                level: acc.level,
                accountType: acc.accountType || '',
                isPostable: acc.isPostable,
            };
            const ct = controlType(meta);
            if (rule.forbiddenLineControl.includes(ct)) {
                throw new Error(`${rule.message.noControl} Account ${meta.code} - ${meta.name} is ${ct}.`);
            }
            const debit = line.debit || 0;
            const credit = line.credit || 0;
            if (debit > 0 && credit > 0) {
                throw new Error('Each line must be one-sided. Debit and credit cannot both be greater than zero.');
            }
            if (debit <= 0 && credit <= 0) {
                throw new Error('Zero-value lines are not allowed.');
            }
        }
    }
    static async validateCashBankVoucher(payload, rule, t, client) {
        if (!payload.accountId) {
            throw new Error(`${t} requires a primary ${rule.control === 'BANK' ? 'bank' : 'cash'} account.`);
        }
        const primary = await client.account.findUnique({ where: { id: payload.accountId } });
        if (!primary) {
            throw new Error(`Primary account not found: ${payload.accountId}`);
        }
        await account_validation_service_1.AccountValidationService.validateAccountPostable(payload.accountId);
        const primaryMeta = {
            id: primary.id,
            code: primary.code,
            name: primary.name,
            type: primary.type,
            level: primary.level,
            accountType: primary.accountType || '',
            isPostable: primary.isPostable,
        };
        const primaryCtrl = controlType(primaryMeta);
        const wantCtrl = rule.control;
        if (primaryCtrl !== wantCtrl) {
            throw new Error(`${rule.message.control} Selected account ${primary.code} - ${primary.name} is not a ${rule.control} account.`);
        }
        const forbiddenCtrl = rule.forbiddenControl;
        if (forbiddenCtrl.includes(primaryCtrl)) {
            throw new Error(rule.message.control);
        }
        const userLines = payload.lines.filter((l) => l.accountId !== payload.accountId);
        if (!userLines.length) {
            throw new Error(`${t} must have at least one user-entered line (excluding the control account).`);
        }
        for (const line of userLines) {
            if (!line.accountId) {
                throw new Error('Every line must have an account.');
            }
            const acc = await client.account.findUnique({ where: { id: line.accountId } });
            if (!acc) {
                throw new Error(`Line account not found: ${line.accountId}`);
            }
            await account_validation_service_1.AccountValidationService.validateAccountPostable(line.accountId);
            const meta = {
                id: acc.id,
                code: acc.code,
                name: acc.name,
                type: acc.type,
                level: acc.level,
                accountType: acc.accountType || '',
                isPostable: acc.isPostable,
            };
            const ct = controlType(meta);
            const forbiddenLine = rule.forbiddenLineControl;
            if (forbiddenLine.includes(ct)) {
                throw new Error(`System account lines cannot be submitted. ${t} automatically generates the ${rule.control} account line. Remove ${meta.code} - ${meta.name} from lines.`);
            }
            const debit = line.debit || 0;
            const credit = line.credit || 0;
            if (t === 'BPV' || t === 'CPV') {
                const r = rule;
                if (credit > 0) {
                    throw new Error(r.message.noCredit);
                }
                if (debit <= 0) {
                    throw new Error(`${t} line items must have debit amounts (expense or payable accounts).`);
                }
                const cat = accountCategory(meta.type);
                const forbiddenDebit = r.forbiddenDebit;
                if (forbiddenDebit.includes(cat)) {
                    throw new Error(`${r.message.debit} ${meta.code} - ${meta.name} is ${meta.type}.`);
                }
                const allowed = r.debitAllowed;
                if (!allowed.includes(cat)) {
                    throw new Error(`${r.message.debit} ${meta.code} - ${meta.name} is ${meta.type}.`);
                }
            }
            else {
                const r = rule;
                if (debit > 0) {
                    throw new Error(r.message.noDebit);
                }
                if (credit <= 0) {
                    throw new Error(`${t} line items must have credit amounts (income, receivable, or advance).`);
                }
                const cat = accountCategory(meta.type);
                const forbiddenCredit = r.forbiddenCredit;
                if (forbiddenCredit.includes(cat)) {
                    throw new Error(`${r.message.credit} ${meta.code} - ${meta.name} is ${meta.type}.`);
                }
                const creditAllowed = ['INCOME', 'ASSET', 'LIABILITY', 'EQUITY'];
                const creditOk = creditAllowed.includes(cat);
                if (!creditOk) {
                    throw new Error(`${r.message.credit} ${meta.code} - ${meta.name} is ${meta.type}.`);
                }
            }
            if (debit > 0 && credit > 0) {
                throw new Error('Each line must be one-sided.');
            }
            if (debit <= 0 && credit <= 0) {
                throw new Error('Zero-value lines are not allowed.');
            }
        }
        const userDebit = userLines.reduce((s, l) => s + (l.debit || 0), 0);
        const userCredit = userLines.reduce((s, l) => s + (l.credit || 0), 0);
        if (t === 'BPV' || t === 'CPV') {
            if (userDebit <= 0) {
                throw new Error(`${t} requires at least one debit entry with amount > 0.`);
            }
        }
        else {
            if (userCredit <= 0) {
                throw new Error(`${t} requires at least one credit entry with amount > 0.`);
            }
        }
    }
}
exports.VoucherValidationEngine = VoucherValidationEngine;
//# sourceMappingURL=voucher-validation-engine.js.map