/**
 * Voucher Validation Engine
 * Accounting-grade, centralized validation for BPV, BRV, CPV, CRV, JV.
 * All rules enforced before save. No auto-fix, no downgrade to warnings.
 */

import type { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { AccountValidationService } from './account-validation-service';

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

interface AccountMeta {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  accountType: string;
  isPostable: boolean | null;
}

function accountCategory(t: string): AccountCategory {
  const u = (t || '').toLowerCase();
  if (u === 'asset') return 'ASSET';
  if (u === 'liability') return 'LIABILITY';
  if (u === 'revenue') return 'INCOME';
  if (u === 'expense') return 'EXPENSE';
  if (u === 'equity') return 'EQUITY';
  return 'ASSET';
}

function controlType(acc: AccountMeta): ControlType {
  const c = (acc.code || '').trim();
  const n = (acc.name || '').toLowerCase();
  if (c.startsWith('1111') || c.startsWith('111101') || c.startsWith('111102') || n.includes('cash')) return 'CASH';
  if (c.startsWith('1112') || c.startsWith('111201') || c.startsWith('111202') || n.includes('bank')) return 'BANK';
  if (c.startsWith('113') || n.includes('receivable')) return 'AR';
  if (c.startsWith('212') || n.includes('payable')) return 'AP';
  return 'NONE';
}

const RULES = {
  BPV: {
    name: 'Bank Payment Voucher',
    control: 'BANK' as ControlType,
    controlSide: 'credit' as const,
    debitAllowed: ['EXPENSE', 'ASSET', 'LIABILITY'] as AccountCategory[],
    creditAllowed: ['BANK'] as ControlType[],
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
    control: 'BANK' as ControlType,
    controlSide: 'debit' as const,
    creditAllowed: ['INCOME', 'ASSET', 'LIABILITY', 'EQUITY'] as AccountCategory[],
    debitAllowed: ['BANK'] as ControlType[],
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
    control: 'CASH' as ControlType,
    controlSide: 'credit' as const,
    debitAllowed: ['EXPENSE', 'ASSET', 'LIABILITY'] as AccountCategory[],
    creditAllowed: ['CASH'] as ControlType[],
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
    control: 'CASH' as ControlType,
    controlSide: 'debit' as const,
    creditAllowed: ['INCOME', 'ASSET', 'LIABILITY', 'EQUITY'] as AccountCategory[],
    debitAllowed: ['CASH'] as ControlType[],
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
    forbiddenLineControl: ['CASH', 'BANK', 'AR', 'AP'] as ControlType[],
    allowedCategories: ['ASSET', 'LIABILITY', 'EXPENSE', 'EQUITY', 'INCOME'] as AccountCategory[],
    message: {
      noControl: 'JV cannot use Cash, Bank, Accounts Receivable, or Accounts Payable. Use BPV/BRV/CPV/CRV for those.',
    },
  },
} as const;

export class VoucherValidationEngine {
  /**
   * Run all validations before save. Throws on first violation.
   * Call this before any voucher create/update DB write.
   */
  static async validate(
    payload: VoucherPayload,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx || prisma;

    if (!payload.type || !payload.lines?.length) {
      throw new Error('Voucher type and at least one line are required.');
    }

    const t = payload.type as VoucherType;
    if (!['BPV', 'BRV', 'CPV', 'CRV', 'JV'].includes(t)) {
      throw new Error(`Invalid voucher type: ${t}. Allowed: BPV, BRV, CPV, CRV, JV.`);
    }

    if (t === 'JV') {
      await this.validateJV(payload, RULES.JV, client);
      return;
    }

    const rule = RULES[t] as typeof RULES.BPV | typeof RULES.BRV | typeof RULES.CPV | typeof RULES.CRV;
    await this.validateCashBankVoucher(payload, rule, t, client);
  }

  private static async validateJV(
    payload: VoucherPayload,
    rule: typeof RULES.JV,
    client: Prisma.TransactionClient | typeof prisma
  ): Promise<void> {
    const lines = payload.lines;

    if (lines.length < 2) {
      throw new Error('Journal Voucher must have at least 2 line items (minimum double-entry).');
    }

    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Journal Voucher must balance. Total debits: ${totalDebit.toFixed(2)}, Total credits: ${totalCredit.toFixed(2)}.`
      );
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

      await AccountValidationService.validateAccountPostable(line.accountId);

      const meta: AccountMeta = {
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
        throw new Error(
          `${rule.message.noControl} Account ${meta.code} - ${meta.name} is ${ct}.`
        );
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

  private static async validateCashBankVoucher(
    payload: VoucherPayload,
    rule: typeof RULES.BPV | typeof RULES.BRV | typeof RULES.CPV | typeof RULES.CRV,
    t: VoucherType,
    client: Prisma.TransactionClient | typeof prisma
  ): Promise<void> {
    if (!payload.accountId) {
      throw new Error(
        `${t} requires a primary ${rule.control === 'BANK' ? 'bank' : 'cash'} account.`
      );
    }

    const primary = await client.account.findUnique({ where: { id: payload.accountId } });
    if (!primary) {
      throw new Error(`Primary account not found: ${payload.accountId}`);
    }

    await AccountValidationService.validateAccountPostable(payload.accountId);

    const primaryMeta: AccountMeta = {
      id: primary.id,
      code: primary.code,
      name: primary.name,
      type: primary.type,
      level: primary.level,
      accountType: primary.accountType || '',
      isPostable: primary.isPostable,
    };
    const primaryCtrl = controlType(primaryMeta);

    const wantCtrl = rule.control as ControlType;
    if (primaryCtrl !== wantCtrl) {
      throw new Error(
        `${rule.message.control} Selected account ${primary.code} - ${primary.name} is not a ${rule.control} account.`
      );
    }
    const forbiddenCtrl = rule.forbiddenControl as readonly ControlType[];
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

      await AccountValidationService.validateAccountPostable(line.accountId);

      const meta: AccountMeta = {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        level: acc.level,
        accountType: acc.accountType || '',
        isPostable: acc.isPostable,
      };
      const ct = controlType(meta);

      const forbiddenLine = rule.forbiddenLineControl as readonly ControlType[];
      if (forbiddenLine.includes(ct)) {
        throw new Error(
          `System account lines cannot be submitted. ${t} automatically generates the ${rule.control} account line. Remove ${meta.code} - ${meta.name} from lines.`
        );
      }

      const debit = line.debit || 0;
      const credit = line.credit || 0;

      if (t === 'BPV' || t === 'CPV') {
        const r = rule as typeof RULES.BPV;
        if (credit > 0) {
          throw new Error(r.message.noCredit);
        }
        if (debit <= 0) {
          throw new Error(`${t} line items must have debit amounts (expense or payable accounts).`);
        }
        const cat = accountCategory(meta.type);
        const forbiddenDebit = r.forbiddenDebit as readonly AccountCategory[];
        if (forbiddenDebit.includes(cat)) {
          throw new Error(`${r.message.debit} ${meta.code} - ${meta.name} is ${meta.type}.`);
        }
        const allowed = r.debitAllowed as readonly AccountCategory[];
        if (!allowed.includes(cat)) {
          throw new Error(`${r.message.debit} ${meta.code} - ${meta.name} is ${meta.type}.`);
        }
      } else {
        const r = rule as typeof RULES.BRV;
        if (debit > 0) {
          throw new Error(r.message.noDebit);
        }
        if (credit <= 0) {
          throw new Error(`${t} line items must have credit amounts (income, receivable, or advance).`);
        }
        const cat = accountCategory(meta.type);
        const forbiddenCredit = r.forbiddenCredit as readonly AccountCategory[];
        if (forbiddenCredit.includes(cat)) {
          throw new Error(`${r.message.credit} ${meta.code} - ${meta.name} is ${meta.type}.`);
        }
        const creditAllowed: AccountCategory[] = ['INCOME', 'ASSET', 'LIABILITY', 'EQUITY'];
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
    } else {
      if (userCredit <= 0) {
        throw new Error(`${t} requires at least one credit entry with amount > 0.`);
      }
    }
  }
}
