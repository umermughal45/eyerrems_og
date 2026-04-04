/**
 * Finance API Tests
 * Tests accounts, transactions, invoices, payments, journal entries
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
  createTestProperty,
  createTestClient,
  createTestTenant
} from '../helpers/test-data';

const prisma = new PrismaClient();
let app: express.Application;
let authHeaders: { Authorization: string; 'X-CSRF-Token': string };
let userId: string;

describe('Finance API', () => {
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
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('Accounts API', () => {
    describe('POST /api/finance/accounts', () => {
      it('should create account successfully', async () => {
        const accountData = {
          name: 'Cash Account',
          type: 'asset',
          code: 'CASH-001',
          description: 'Main cash account',
          isActive: true,
        };

        const response = await request(app)
          .post('/api/finance/accounts')
          .set(authHeaders)
          .send(accountData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            name: 'Cash Account',
            type: 'asset',
            code: 'CASH-001',
            description: 'Main cash account',
            isActive: true,
            balance: 0,
          },
        });
      });

      it('should validate account type', async () => {
        const response = await request(app)
          .post('/api/finance/accounts')
          .set(authHeaders)
          .send({
            name: 'Invalid Account',
            type: 'invalid-type',
            code: 'INV-001',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });

      it('should prevent duplicate account codes', async () => {
        // Create first account
        await prisma.account.create({
          data: {
            name: 'First Account',
            type: 'asset',
            code: 'DUP-001',
            balance: 0,
          },
        });

        // Try to create duplicate
        const response = await request(app)
          .post('/api/finance/accounts')
          .set(authHeaders)
          .send({
            name: 'Second Account',
            type: 'liability',
            code: 'DUP-001',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Unique constraint violation');
      });
    });

    describe('GET /api/finance/accounts', () => {
      beforeEach(async () => {
        await prisma.account.createMany({
          data: [
            {
              name: 'Cash',
              type: 'asset',
              code: 'CASH-001',
              balance: 10000,
              isActive: true,
            },
            {
              name: 'Accounts Payable',
              type: 'liability',
              code: 'AP-001',
              balance: 5000,
              isActive: true,
            },
            {
              name: 'Revenue',
              type: 'revenue',
              code: 'REV-001',
              balance: 15000,
              isActive: true,
            },
          ],
        });
      });

      it('should get accounts with balances', async () => {
        const response = await request(app)
          .get('/api/finance/accounts')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'Cash',
              type: 'asset',
              balance: 10000,
            }),
            expect.objectContaining({
              name: 'Accounts Payable',
              type: 'liability',
              balance: 5000,
            }),
          ]),
        });
      });

      it('should filter accounts by type', async () => {
        const response = await request(app)
          .get('/api/finance/accounts?type=asset')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Cash');
      });
    });
  });

  describe('Transactions API', () => {
    let cashAccountId: string;
    let revenueAccountId: string;

    beforeEach(async () => {
      const cashAccount = await prisma.account.create({
        data: {
          name: 'Cash',
          type: 'asset',
          code: 'CASH-001',
          balance: 10000,
        },
      });
      cashAccountId = cashAccount.id;

      const revenueAccount = await prisma.account.create({
        data: {
          name: 'Revenue',
          type: 'revenue',
          code: 'REV-001',
          balance: 0,
        },
      });
      revenueAccountId = revenueAccount.id;
    });

    describe('POST /api/finance/transactions', () => {
      it('should create transaction successfully', async () => {
        const transactionData = {
          description: 'Rent payment received',
          amount: 1500,
          type: 'income',
          category: 'rent',
          accountId: cashAccountId,
          referenceNumber: 'TXN-001',
          transactionDate: new Date().toISOString(),
        };

        const response = await request(app)
          .post('/api/finance/transactions')
          .set(authHeaders)
          .send(transactionData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            description: 'Rent payment received',
            amount: 1500,
            type: 'income',
            category: 'rent',
            referenceNumber: 'TXN-001',
          },
        });

        // Verify account balance updated
        const updatedAccount = await prisma.account.findUnique({
          where: { id: cashAccountId },
        });
        expect(updatedAccount?.balance).toBe(11500);
      });

      it('should validate transaction amount', async () => {
        const response = await request(app)
          .post('/api/finance/transactions')
          .set(authHeaders)
          .send({
            description: 'Invalid transaction',
            amount: -100, // negative amount
            type: 'income',
            accountId: cashAccountId,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });

      it('should validate account exists', async () => {
        const response = await request(app)
          .post('/api/finance/transactions')
          .set(authHeaders)
          .send({
            description: 'Invalid account transaction',
            amount: 100,
            type: 'income',
            accountId: '00000000-0000-0000-0000-000000000000',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Foreign key constraint violation');
      });
    });

    describe('GET /api/finance/transactions', () => {
      beforeEach(async () => {
        await prisma.transaction.createMany({
          data: [
            {
              description: 'Rent Income',
              amount: 2000,
              type: 'income',
              category: 'rent',
              accountId: cashAccountId,
              transactionDate: new Date(),
              createdBy: userId,
            },
            {
              description: 'Office Expense',
              amount: 500,
              type: 'expense',
              category: 'office',
              accountId: cashAccountId,
              transactionDate: new Date(),
              createdBy: userId,
            },
          ],
        });
      });

      it('should get transactions with pagination', async () => {
        const response = await request(app)
          .get('/api/finance/transactions?page=1&limit=10')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              description: 'Rent Income',
              type: 'income',
              amount: 2000,
            }),
            expect.objectContaining({
              description: 'Office Expense',
              type: 'expense',
              amount: 500,
            }),
          ]),
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          },
        });
      });

      it('should filter transactions by type', async () => {
        const response = await request(app)
          .get('/api/finance/transactions?type=income')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].description).toBe('Rent Income');
      });

      it('should filter transactions by date range', async () => {
        const today = new Date().toISOString().split('T')[0];
        const response = await request(app)
          .get(`/api/finance/transactions?startDate=${today}&endDate=${today}`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });
    });
  });

  describe('Invoices API', () => {
    let clientId: string;

    beforeEach(async () => {
      const client = await createTestClient({
        name: 'Invoice Client',
        email: 'invoice@example.com',
      });
      clientId = client.id;
    });

    describe('POST /api/finance/invoices', () => {
      it('should create invoice successfully', async () => {
        const invoiceData = {
          clientId,
          invoiceNumber: 'INV-001',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [
            {
              description: 'Monthly Rent',
              quantity: 1,
              unitPrice: 1500,
              amount: 1500,
            },
            {
              description: 'Maintenance Fee',
              quantity: 1,
              unitPrice: 100,
              amount: 100,
            },
          ],
          subtotal: 1600,
          taxAmount: 160,
          totalAmount: 1760,
          notes: 'Payment due within 30 days',
        };

        const response = await request(app)
          .post('/api/finance/invoices')
          .set(authHeaders)
          .send(invoiceData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            invoiceNumber: 'INV-001',
            subtotal: 1600,
            taxAmount: 160,
            totalAmount: 1760,
            status: 'pending',
            items: expect.arrayContaining([
              expect.objectContaining({
                description: 'Monthly Rent',
                amount: 1500,
              }),
            ]),
          },
        });
      });

      it('should validate invoice items', async () => {
        const response = await request(app)
          .post('/api/finance/invoices')
          .set(authHeaders)
          .send({
            clientId,
            invoiceNumber: 'INV-002',
            items: [], // empty items
            totalAmount: 100,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invoice must have at least one item');
      });

      it('should validate amount calculations', async () => {
        const response = await request(app)
          .post('/api/finance/invoices')
          .set(authHeaders)
          .send({
            clientId,
            invoiceNumber: 'INV-003',
            items: [
              {
                description: 'Item 1',
                quantity: 2,
                unitPrice: 100,
                amount: 200,
              },
            ],
            subtotal: 200,
            totalAmount: 500, // doesn't match subtotal
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Total amount does not match calculated amount');
      });
    });

    describe('GET /api/finance/invoices', () => {
      beforeEach(async () => {
        await prisma.invoice.createMany({
          data: [
            {
              clientId,
              invoiceNumber: 'INV-001',
              issueDate: new Date(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              subtotal: 1000,
              totalAmount: 1100,
              status: 'pending',
              createdBy: userId,
            },
            {
              clientId,
              invoiceNumber: 'INV-002',
              issueDate: new Date(),
              dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // overdue
              subtotal: 2000,
              totalAmount: 2200,
              status: 'overdue',
              createdBy: userId,
            },
          ],
        });
      });

      it('should get invoices with client info', async () => {
        const response = await request(app)
          .get('/api/finance/invoices')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              invoiceNumber: 'INV-001',
              status: 'pending',
              totalAmount: 1100,
              client: expect.objectContaining({
                name: 'Invoice Client',
              }),
            }),
          ]),
        });
      });

      it('should filter invoices by status', async () => {
        const response = await request(app)
          .get('/api/finance/invoices?status=overdue')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].invoiceNumber).toBe('INV-002');
      });
    });

    describe('PUT /api/finance/invoices/:id/status', () => {
      it('should update invoice status', async () => {
        const invoice = await prisma.invoice.create({
          data: {
            clientId,
            invoiceNumber: 'INV-STATUS',
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            subtotal: 1000,
            totalAmount: 1100,
            status: 'pending',
            createdBy: userId,
          },
        });

        const response = await request(app)
          .put(`/api/finance/invoices/${invoice.id}/status`)
          .set(authHeaders)
          .send({
            status: 'paid',
            paidDate: new Date().toISOString(),
            paymentMethod: 'bank_transfer',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            status: 'paid',
            paidDate: expect.any(String),
          },
        });
      });
    });
  });

  describe('Journal Entries API', () => {
    let cashAccountId: string;
    let revenueAccountId: string;

    beforeEach(async () => {
      const cashAccount = await prisma.account.create({
        data: {
          name: 'Cash',
          type: 'asset',
          code: 'CASH-001',
          balance: 0,
        },
      });
      cashAccountId = cashAccount.id;

      const revenueAccount = await prisma.account.create({
        data: {
          name: 'Revenue',
          type: 'revenue',
          code: 'REV-001',
          balance: 0,
        },
      });
      revenueAccountId = revenueAccount.id;
    });

    describe('POST /api/finance/journal-entries', () => {
      it('should create balanced journal entry', async () => {
        const journalData = {
          description: 'Rent payment received',
          referenceNumber: 'JE-001',
          entryDate: new Date().toISOString(),
          lines: [
            {
              accountId: cashAccountId,
              debit: 1500,
              credit: 0,
              description: 'Cash received',
            },
            {
              accountId: revenueAccountId,
              debit: 0,
              credit: 1500,
              description: 'Rent revenue',
            },
          ],
        };

        const response = await request(app)
          .post('/api/finance/journal-entries')
          .set(authHeaders)
          .send(journalData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            description: 'Rent payment received',
            referenceNumber: 'JE-001',
            totalDebit: 1500,
            totalCredit: 1500,
            status: 'draft',
            lines: expect.arrayContaining([
              expect.objectContaining({
                debit: 1500,
                credit: 0,
              }),
              expect.objectContaining({
                debit: 0,
                credit: 1500,
              }),
            ]),
          },
        });
      });

      it('should reject unbalanced journal entry', async () => {
        const response = await request(app)
          .post('/api/finance/journal-entries')
          .set(authHeaders)
          .send({
            description: 'Unbalanced entry',
            lines: [
              {
                accountId: cashAccountId,
                debit: 1000,
                credit: 0,
              },
              {
                accountId: revenueAccountId,
                debit: 0,
                credit: 500, // doesn't balance
              },
            ],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Journal entry must be balanced (debits = credits)');
      });

      it('should require at least 2 lines', async () => {
        const response = await request(app)
          .post('/api/finance/journal-entries')
          .set(authHeaders)
          .send({
            description: 'Single line entry',
            lines: [
              {
                accountId: cashAccountId,
                debit: 1000,
                credit: 0,
              },
            ],
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Journal entry must have at least 2 lines');
      });
    });

    describe('POST /api/finance/journal-entries/:id/post', () => {
      it('should post journal entry and update account balances', async () => {
        const journalEntry = await prisma.journalEntry.create({
          data: {
            description: 'Test entry',
            referenceNumber: 'JE-POST',
            entryDate: new Date(),
            totalDebit: 1000,
            totalCredit: 1000,
            status: 'draft',
            preparedBy: userId,
            lines: {
              create: [
                {
                  accountId: cashAccountId,
                  debit: 1000,
                  credit: 0,
                  description: 'Cash debit',
                },
                {
                  accountId: revenueAccountId,
                  debit: 0,
                  credit: 1000,
                  description: 'Revenue credit',
                },
              ],
            },
          },
        });

        const response = await request(app)
          .post(`/api/finance/journal-entries/${journalEntry.id}/post`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            status: 'posted',
          },
        });

        // Verify account balances updated
        const updatedCash = await prisma.account.findUnique({
          where: { id: cashAccountId },
        });
        const updatedRevenue = await prisma.account.findUnique({
          where: { id: revenueAccountId },
        });

        expect(updatedCash?.balance).toBe(1000);
        expect(updatedRevenue?.balance).toBe(1000);
      });
    });
  });

  describe('Authorization Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/finance/accounts');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject requests without proper permissions', async () => {
      const limitedRole = await createTestRole('Limited User', ['properties.view']);
      const limitedUser = await createTestUser({
        email: 'limited@test.com',
        password: 'password123',
        roleId: limitedRole.id,
      });
      const limitedHeaders = await createAuthHeaders(app, 'limited@test.com', 'password123');

      const response = await request(app)
        .post('/api/finance/accounts')
        .set(limitedHeaders)
        .send({
          name: 'Test Account',
          type: 'asset',
          code: 'TEST-001',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});