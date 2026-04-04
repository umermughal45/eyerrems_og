/**
 * Voucher Type Enforcement Regression Tests
 * 
 * Tests to ensure voucher behavior is deterministic, rule-based, and type-safe:
 * - BPV/CPV: Only debit allowed, system auto-generates credit to bank/cash
 * - BRV/CRV: Only credit allowed, system auto-generates debit to bank/cash
 * - JV: Both debit and credit allowed, no system lines, must balance
 * - Backend rejects manual bank/cash entries
 * - System lines are generated exactly once
 * - UI totals match backend totals
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/test-app';
import { 
  createTestUser, 
  createTestRole, 
  cleanupDatabase, 
  createAuthHeaders,
} from '../helpers/test-data';

const prisma = new PrismaClient();
let app: express.Application;
let authHeaders: { Authorization: string; 'X-CSRF-Token': string };
let userId: string;
let bankAccountId: string;
let cashAccountId: string;
let expenseAccountId: string;
let revenueAccountId: string;

describe('Voucher Type Enforcement - Regression Tests', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    
    // Create user with finance permissions
    const financeRole = await createTestRole('Finance Manager', [
      'finance.*',
      'properties.view',
      'tenants.view',
      'crm.view',
    ]);
    const user = await createTestUser({
      email: 'finance@test.com',
      password: 'password123',
      roleId: financeRole.id,
    });
    userId = user.id;
    authHeaders = await createAuthHeaders(app, 'finance@test.com', 'password123');

    // Create test accounts
    // Bank account (1112...) - Must be Level 5, Posting type, and postable
    const bankAccount = await prisma.account.create({
      data: {
        name: 'Test Bank Account',
        code: '111201',
        type: 'Asset',
        level: 5,
        accountType: 'Posting',
        isPostable: true,
        isActive: true,
      },
    });
    bankAccountId = bankAccount.id;

    // Cash account (1111...)
    const cashAccount = await prisma.account.create({
      data: {
        name: 'Test Cash Account',
        code: '111101',
        type: 'Asset',
        level: 5,
        accountType: 'Posting',
        isPostable: true,
        isActive: true,
      },
    });
    cashAccountId = cashAccount.id;

    // Expense account
    const expenseAccount = await prisma.account.create({
      data: {
        name: 'Test Expense Account',
        code: '500101',
        type: 'Expense',
        level: 5,
        accountType: 'Posting',
        isPostable: true,
        isActive: true,
      },
    });
    expenseAccountId = expenseAccount.id;

    // Revenue account
    const revenueAccount = await prisma.account.create({
      data: {
        name: 'Test Revenue Account',
        code: '400101',
        type: 'Revenue',
        level: 5,
        accountType: 'Posting',
        isPostable: true,
        isActive: true,
      },
    });
    revenueAccountId = revenueAccount.id;
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('BPV (Bank Payment Voucher) - Regression Tests', () => {
    it('should reject manual credit entries', async () => {
      const voucherData = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test BPV',
        referenceNumber: 'CHQ-001',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense line',
          },
          {
            accountId: expenseAccountId,
            debit: 0,
            credit: 500, // INVALID: Credit not allowed in BPV
            description: 'Invalid credit line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Manual credit entries are not allowed');
    });

    it('should reject manual bank account line', async () => {
      const voucherData = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test BPV',
        referenceNumber: 'CHQ-002',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense line',
          },
          {
            accountId: bankAccountId, // INVALID: Manual bank line
            debit: 0,
            credit: 1000,
            description: 'Manual bank line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('System account lines cannot be submitted from UI');
    });

    it('should auto-generate exactly one bank credit line', async () => {
      const voucherData = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test BPV',
        referenceNumber: 'CHQ-003',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense line 1',
          },
          {
            accountId: expenseAccountId,
            debit: 500,
            credit: 0,
            description: 'Expense line 2',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      const voucher = response.body.data;
      const systemLines = voucher.lines.filter((line: any) => 
        line.accountId === bankAccountId && 
        line.description?.includes('[SYSTEM]')
      );
      
      expect(systemLines.length).toBe(1);
      expect(systemLines[0].debit).toBe(0);
      expect(systemLines[0].credit).toBe(1500); // Sum of user debits
    });

    it('should balance correctly (user debits = system credit)', async () => {
      const userDebit1 = 1000;
      const userDebit2 = 500;
      const expectedSystemCredit = userDebit1 + userDebit2;

      const voucherData = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test BPV',
        referenceNumber: 'CHQ-004',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: userDebit1,
            credit: 0,
            description: 'Expense line 1',
          },
          {
            accountId: expenseAccountId,
            debit: userDebit2,
            credit: 0,
            description: 'Expense line 2',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      
      const totalDebit = voucher.lines.reduce((sum: number, line: any) => sum + line.debit, 0);
      const totalCredit = voucher.lines.reduce((sum: number, line: any) => sum + line.credit, 0);
      
      expect(totalDebit).toBe(expectedSystemCredit);
      expect(totalCredit).toBe(expectedSystemCredit);
      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    });
  });

  describe('BRV (Bank Receipt Voucher) - Regression Tests', () => {
    it('should reject manual debit entries', async () => {
      const voucherData = {
        type: 'BRV',
        date: new Date().toISOString(),
        paymentMethod: 'Transfer',
        accountId: bankAccountId,
        description: 'Test BRV',
        referenceNumber: 'TXN-001',
        lines: [
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Revenue line',
          },
          {
            accountId: revenueAccountId,
            debit: 500, // INVALID: Debit not allowed in BRV
            credit: 0,
            description: 'Invalid debit line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Manual debit entries are not allowed');
    });

    it('should auto-generate exactly one bank debit line', async () => {
      const voucherData = {
        type: 'BRV',
        date: new Date().toISOString(),
        paymentMethod: 'Transfer',
        accountId: bankAccountId,
        description: 'Test BRV',
        referenceNumber: 'TXN-002',
        lines: [
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Revenue line 1',
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 500,
            description: 'Revenue line 2',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      
      const voucher = response.body.data;
      const systemLines = voucher.lines.filter((line: any) => 
        line.accountId === bankAccountId && 
        line.description?.includes('[SYSTEM]')
      );
      
      expect(systemLines.length).toBe(1);
      expect(systemLines[0].debit).toBe(1500); // Sum of user credits
      expect(systemLines[0].credit).toBe(0);
    });
  });

  describe('CPV (Cash Payment Voucher) - Regression Tests', () => {
    it('should reject manual credit entries', async () => {
      const voucherData = {
        type: 'CPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: cashAccountId,
        description: 'Test CPV',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense line',
          },
          {
            accountId: expenseAccountId,
            debit: 0,
            credit: 500, // INVALID: Credit not allowed in CPV
            description: 'Invalid credit line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Manual credit entries are not allowed');
    });

    it('should auto-generate exactly one cash credit line', async () => {
      const voucherData = {
        type: 'CPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: cashAccountId,
        description: 'Test CPV',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      const systemLines = voucher.lines.filter((line: any) => 
        line.accountId === cashAccountId && 
        line.description?.includes('[SYSTEM]')
      );
      
      expect(systemLines.length).toBe(1);
      expect(systemLines[0].credit).toBe(1000);
    });
  });

  describe('CRV (Cash Receipt Voucher) - Regression Tests', () => {
    it('should reject manual debit entries', async () => {
      const voucherData = {
        type: 'CRV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: cashAccountId,
        description: 'Test CRV',
        lines: [
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Revenue line',
          },
          {
            accountId: revenueAccountId,
            debit: 500, // INVALID: Debit not allowed in CRV
            credit: 0,
            description: 'Invalid debit line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Manual debit entries are not allowed');
    });

    it('should auto-generate exactly one cash debit line', async () => {
      const voucherData = {
        type: 'CRV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: cashAccountId,
        description: 'Test CRV',
        lines: [
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Revenue line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      const systemLines = voucher.lines.filter((line: any) => 
        line.accountId === cashAccountId && 
        line.description?.includes('[SYSTEM]')
      );
      
      expect(systemLines.length).toBe(1);
      expect(systemLines[0].debit).toBe(1000);
    });
  });

  describe('JV (Journal Voucher) - Regression Tests', () => {
    it('should reject unbalanced entries', async () => {
      const voucherData = {
        type: 'JV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: expenseAccountId, // JV doesn't use bank/cash, but accountId is required
        description: 'Test JV',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Debit line',
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 500, // INVALID: Unbalanced (1000 debit ≠ 500 credit)
            description: 'Credit line',
          },
        ],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Journal Voucher must balance');
    });

    it('should not generate system lines', async () => {
      const voucherData = {
        type: 'JV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: expenseAccountId,
        description: 'Test JV',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Debit line',
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Credit line',
          },
        ],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      
      // JV should have no system lines
      const systemLines = voucher.lines.filter((line: any) => 
        line.description?.includes('[SYSTEM]')
      );
      
      expect(systemLines.length).toBe(0);
      expect(voucher.lines.length).toBe(2); // Only user lines
    });

    it('should accept balanced entries', async () => {
      const voucherData = {
        type: 'JV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: expenseAccountId,
        description: 'Test JV',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Debit line',
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Credit line',
          },
        ],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      
      const totalDebit = voucher.lines.reduce((sum: number, line: any) => sum + line.debit, 0);
      const totalCredit = voucher.lines.reduce((sum: number, line: any) => sum + line.credit, 0);
      
      expect(totalDebit).toBe(1000);
      expect(totalCredit).toBe(1000);
      expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    });
  });

  describe('Data Integrity Safeguards', () => {
    it('should enforce exactly one system line for BPV', async () => {
      const voucherData = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test BPV',
        referenceNumber: 'CHQ-INTEGRITY',
        payeeType: 'Vendor',
        payeeId: 'test-payee',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense line',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      const systemLines = voucher.lines.filter((line: any) => 
        line.accountId === bankAccountId && 
        line.description?.includes('[SYSTEM]')
      );
      
      // Exactly one system line
      expect(systemLines.length).toBe(1);
    });

    it('should enforce zero system lines for JV', async () => {
      const voucherData = {
        type: 'JV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: expenseAccountId,
        description: 'Test JV',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Debit line',
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 1000,
            description: 'Credit line',
          },
        ],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(voucherData);

      expect(response.status).toBe(201);
      const voucher = response.body.data;
      const systemLines = voucher.lines.filter((line: any) => 
        line.description?.includes('[SYSTEM]')
      );
      
      // Zero system lines for JV
      expect(systemLines.length).toBe(0);
    });
  });
});
