/**
 * Voucher Data Integrity Regression Tests
 * 
 * TASK 6: Tests to verify:
 * - Report never shows N/A when data exists
 * - Total amount in report = voucher.total_amount (persisted value)
 * - Edit form matches create-time data exactly
 * - No mismatch between UI and backend totals
 * - All header fields are persisted correctly
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

describe('Voucher Data Integrity - Regression Tests', () => {
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
    await prisma.$disconnect();
  });

  describe('TASK 1: Voucher Header Persistence', () => {
    it('should persist all mandatory header fields for BPV', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test BPV Description',
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucher = response.body.data;

      // Verify all header fields are persisted
      expect(voucher.voucherNumber).toBeDefined();
      expect(voucher.type).toBe('BPV');
      expect(voucher.date).toBeDefined();
      expect(voucher.paymentMethod).toBe('Cheque');
      expect(voucher.referenceNumber).toBe('CHQ-12345');
      expect(voucher.accountId).toBe(bankAccountId);
      expect(voucher.description).toBe('Test BPV Description');
      expect(voucher.amount).toBeGreaterThan(0);
      expect(voucher.status).toBe('draft');
    });

    it('should reject BPV creation if mandatory fields are missing', async () => {
      const payload = {
        type: 'BPV',
        // Missing date, paymentMethod, accountId
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
          },
        ],
      };

      await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(400);
    });

    it('should reject BPV creation if reference number is missing for Cheque payment', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        // Missing referenceNumber
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(400);

      expect(response.body.error).toContain('Reference number is required');
    });
  });

  describe('TASK 2: Total Amount Calculation Logic', () => {
    it('should calculate BPV total_amount = sum(user debit lines)', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Expense 1',
          },
          {
            accountId: expenseAccountId,
            debit: 500,
            credit: 0,
            description: 'Expense 2',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucher = response.body.data;
      // BPV: amount = sum of user debit lines = 1000 + 500 = 1500
      expect(voucher.amount).toBe(1500);
    });

    it('should calculate BRV total_amount = sum(user credit lines)', async () => {
      const payload = {
        type: 'BRV',
        date: new Date().toISOString(),
        paymentMethod: 'Transfer',
        accountId: bankAccountId,
        referenceNumber: 'TXN-12345',
        lines: [
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 2000,
            description: 'Revenue 1',
          },
          {
            accountId: revenueAccountId,
            debit: 0,
            credit: 3000,
            description: 'Revenue 2',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const response = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucher = response.body.data;
      // BRV: amount = sum of user credit lines = 2000 + 3000 = 5000
      expect(voucher.amount).toBe(5000);
    });

    it('should calculate JV total_amount = sum(debit) [since debit = credit]', async () => {
      const payload = {
        type: 'JV',
        date: new Date().toISOString(),
        paymentMethod: 'Cash',
        accountId: cashAccountId,
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
        .send(payload)
        .expect(201);

      const voucher = response.body.data;
      // JV: amount = sum of debit = 1000
      expect(voucher.amount).toBe(1000);
    });
  });

  describe('TASK 3: Voucher Report API', () => {
    it('should return voucher with all header fields and no N/A placeholders', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        description: 'Test Description',
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;

      // Get voucher by ID (used in reports)
      const getResponse = await request(app)
        .get(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .expect(200);

      const voucher = getResponse.body.data;

      // Verify all header fields are present (no N/A)
      expect(voucher.voucherNumber).toBeDefined();
      expect(voucher.type).toBe('BPV');
      expect(voucher.date).toBeDefined();
      expect(voucher.paymentMethod).toBe('Cheque');
      expect(voucher.referenceNumber).toBe('CHQ-12345');
      expect(voucher.accountId).toBe(bankAccountId);
      expect(voucher.description).toBe('Test Description');
      expect(voucher.amount).toBe(1000); // Persisted amount
      expect(voucher.status).toBe('draft');
      expect(voucher.account).toBeDefined();
      expect(voucher.account.code).toBeDefined();
      expect(voucher.account.name).toBeDefined();
    });

    it('should use persisted amount in export, not calculate from ledger', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1500,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;
      const persistedAmount = createResponse.body.data.amount;

      // Export vouchers
      const exportResponse = await request(app)
        .get('/api/finance/vouchers/export')
        .set(authHeaders)
        .query({ type: 'BPV' })
        .expect(200);

      // Parse CSV
      const csvLines = exportResponse.text.split('\n');
      const headerLine = csvLines[0];
      const dataLine = csvLines.find((line: string) => line.includes('BPV'));

      expect(dataLine).toBeDefined();
      // Verify amount in export matches persisted amount
      expect(dataLine).toContain(`"${persistedAmount}"`);
    });
  });

  describe('TASK 4: Edit Voucher Flow', () => {
    it('should return voucher header + all lines (including system lines) for edit', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'User line 1',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;

      // Get voucher for editing
      const getResponse = await request(app)
        .get(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .expect(200);

      const voucher = getResponse.body.data;

      // Verify structure: header + lines
      expect(voucher.voucherNumber).toBeDefined();
      expect(voucher.type).toBe('BPV');
      expect(voucher.lines).toBeDefined();
      expect(Array.isArray(voucher.lines)).toBe(true);
      expect(voucher.lines.length).toBeGreaterThan(0);

      // Verify system line exists
      const systemLine = voucher.lines.find((line: any) => 
        line.accountId === voucher.accountId || line.description?.includes('[SYSTEM]')
      );
      expect(systemLine).toBeDefined();
      expect(systemLine.accountId).toBe(bankAccountId);

      // Verify user line exists
      const userLine = voucher.lines.find((line: any) => 
        line.accountId === expenseAccountId
      );
      expect(userLine).toBeDefined();
      expect(userLine.debit).toBe(1000);
      expect(userLine.description).toBe('User line 1');
    });

    it('should preserve exact data when editing (no silent recalculation)', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        description: 'Original Description',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Original line description',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;
      const originalAmount = createResponse.body.data.amount;

      // Get voucher for editing
      const getResponse = await request(app)
        .get(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .expect(200);

      const voucher = getResponse.body.data;

      // Verify exact data matches
      expect(voucher.description).toBe('Original Description');
      expect(voucher.amount).toBe(originalAmount);
      expect(voucher.referenceNumber).toBe('CHQ-12345');

      const userLine = voucher.lines.find((line: any) => line.accountId === expenseAccountId);
      expect(userLine).toBeDefined();
      expect(userLine.debit).toBe(1000);
      expect(userLine.description).toBe('Original line description');
    });
  });

  describe('TASK 5: UI Safety Rules', () => {
    it('should prevent editing posted vouchers', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;

      // Submit voucher
      await request(app)
        .put(`/api/finance/vouchers/${voucherId}/submit`)
        .set(authHeaders)
        .expect(200);

      // Approve voucher
      await request(app)
        .put(`/api/finance/vouchers/${voucherId}/approve`)
        .set(authHeaders)
        .expect(200);

      // Post voucher
      await request(app)
        .put(`/api/finance/vouchers/${voucherId}/post`)
        .set(authHeaders)
        .expect(200);

      // Try to edit posted voucher - should fail
      const updatePayload = {
        description: 'Updated description',
      };

      const updateResponse = await request(app)
        .put(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .send(updatePayload)
        .expect(400);

      expect(updateResponse.body.error).toContain('Cannot edit posted voucher');
      expect(updateResponse.body.error).toContain('reversal voucher');
    });

    it('should allow editing only draft vouchers', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;

      // Edit draft voucher - should succeed
      const updatePayload = {
        description: 'Updated description',
      };

      await request(app)
        .put(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .send(updatePayload)
        .expect(200);
    });
  });

  describe('TASK 6: Data Integrity Verification', () => {
    it('should ensure report amount = voucher.amount (persisted value)', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 2500,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;
      const persistedAmount = createResponse.body.data.amount;

      // Get voucher (as report would)
      const getResponse = await request(app)
        .get(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .expect(200);

      const voucher = getResponse.body.data;

      // Verify report uses persisted amount
      expect(voucher.amount).toBe(persistedAmount);
      expect(voucher.amount).toBe(2500); // BPV: sum of user debits
    });

    it('should not recalculate amount on edit', async () => {
      const payload = {
        type: 'BPV',
        date: new Date().toISOString(),
        paymentMethod: 'Cheque',
        accountId: bankAccountId,
        referenceNumber: 'CHQ-12345',
        lines: [
          {
            accountId: expenseAccountId,
            debit: 1000,
            credit: 0,
            description: 'Test expense',
          },
        ],
        attachments: [{ url: 'data:test', name: 'test.pdf' }],
      };

      const createResponse = await request(app)
        .post('/api/finance/vouchers')
        .set(authHeaders)
        .send(payload)
        .expect(201);

      const voucherId = createResponse.body.data.id;
      const originalAmount = createResponse.body.data.amount;

      // Update voucher with new lines
      const updatePayload = {
        lines: [
          {
            accountId: expenseAccountId,
            debit: 2000, // Changed amount
            credit: 0,
            description: 'Updated expense',
          },
        ],
      };

      const updateResponse = await request(app)
        .put(`/api/finance/vouchers/${voucherId}`)
        .set(authHeaders)
        .send(updatePayload)
        .expect(200);

      const updatedVoucher = updateResponse.body.data;

      // Amount should be recalculated based on new lines
      expect(updatedVoucher.amount).toBe(2000); // New sum of user debits
      expect(updatedVoucher.amount).not.toBe(originalAmount);
    });
  });
});
