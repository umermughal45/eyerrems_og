/**
 * Integration Tests for Deal → Payment → Ledger Workflow
 * Tests the complete accounting-grade flow
 */

import { PrismaClient } from '@prisma/client';
import { DealService } from '../services/deal-service';
import { PaymentService } from '../services/payment-service';
import { LedgerService } from '../services/ledger-service';

const prisma = new PrismaClient();

describe('Deal → Payment → Ledger Workflow', () => {
  let testClientId: string;
  let testPropertyId: string;
  let testDealId: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found for testing');
    }
    testUserId = user.id;

    // Create test client
    const client = await prisma.client.create({
      data: {
        name: 'Test Client',
        email: 'test@example.com',
        status: 'active',
        createdBy: testUserId,
      },
    });
    testClientId = client.id;

    // Create test property
    const property = await prisma.property.create({
      data: {
        name: 'Test Property',
        type: 'Residential',
        address: '123 Test St',
        status: 'Vacant',
      },
    });
    testPropertyId = property.id;

    // Ensure Chart of Accounts is seeded
    const accounts = await prisma.account.count();
    if (accounts === 0) {
      // Seed basic accounts inline to avoid import path issues
      const accountData = [
        { code: '1000', name: 'Cash Account', type: 'Asset', isActive: true },
        { code: '1010', name: 'Bank Account', type: 'Asset', isActive: true },
        { code: '1100', name: 'Accounts Receivable', type: 'Asset', isActive: true },
        { code: '2000', name: 'Dealer Payable', type: 'Liability', isActive: true },
        { code: '3000', name: 'Owner Equity', type: 'Equity', isActive: true },
        { code: '4000', name: 'Deal Revenue', type: 'Revenue', isActive: true },
        { code: '5000', name: 'Commission Expense', type: 'Expense', isActive: true },
      ];
      await prisma.account.createMany({ data: accountData });
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testDealId) {
      await prisma.payment.deleteMany({ where: { dealId: testDealId } });
      await prisma.ledgerEntry.deleteMany({ where: { dealId: testDealId } });
      await prisma.deal.delete({ where: { id: testDealId } });
    }
    if (testClientId) {
      await prisma.client.delete({ where: { id: testClientId } });
    }
    if (testPropertyId) {
      await prisma.property.delete({ where: { id: testPropertyId } });
    }
    await prisma.$disconnect();
  });

  test('Create deal with validation', async () => {
    const deal = await DealService.createDeal({
      title: 'Test Deal',
      clientId: testClientId,
      propertyId: testPropertyId,
      dealAmount: 500000,
      probability: 80,
      createdBy: testUserId,
    });

    expect(deal).toBeDefined();
    expect(deal.dealCode).toMatch(/^DEAL-\d{8}-\d{4}$/);
    expect(deal.dealAmount).toBe(500000);
    expect(deal.expectedRevenue).toBe(400000); // 500000 * 80 / 100
    expect(deal.status).toBe('open');

    testDealId = deal.id;
  });

  test('Create payment creates double-entry ledger entries', async () => {
    const payment = await PaymentService.createPayment({
      dealId: testDealId,
      amount: 50000,
      paymentType: 'booking',
      paymentMode: 'bank',
      createdBy: testUserId,
    });

    expect(payment).toBeDefined();
    expect(payment.paymentId).toMatch(/^PAY-\d{8}-\d{3}$/);

    // Verify ledger entries were created (2 entries: debit and credit)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { paymentId: payment.id, deletedAt: null },
    });

    expect(ledgerEntries.length).toBe(2);
    
    const debitEntry = ledgerEntries.find(e => e.debitAccountId !== null);
    const creditEntry = ledgerEntries.find(e => e.creditAccountId !== null);

    expect(debitEntry).toBeDefined();
    expect(creditEntry).toBeDefined();
    expect(debitEntry?.amount).toBe(50000);
    expect(creditEntry?.amount).toBe(50000);
  });

  test('Deal status recomputes after payment', async () => {
    const deal = await prisma.deal.findUnique({
      where: { id: testDealId },
      include: { payments: { where: { deletedAt: null } } },
    });

    expect(deal?.totalPaid).toBeGreaterThan(0);
    expect(deal?.status).toBe('in_progress'); // Partial payment
  });

  test('Full payment sets deal status to won', async () => {
    // Get current deal state
    const currentDeal = await prisma.deal.findUnique({
      where: { id: testDealId },
    });
    // Create remaining payment
    const remaining = 500000 - (currentDeal?.totalPaid || 0);
    if (remaining > 0) {
      await PaymentService.createPayment({
        dealId: testDealId,
        amount: remaining,
        paymentType: 'full',
        paymentMode: 'bank',
        createdBy: testUserId,
      });

      const updatedDeal = await prisma.deal.findUnique({
        where: { id: testDealId },
      });

      expect(updatedDeal?.status).toBe('won');
      expect(updatedDeal?.totalPaid).toBe(500000);
    }
  });

  test('Refund creates reversed ledger entries', async () => {
    const payments = await prisma.payment.findMany({
      where: { dealId: testDealId, deletedAt: null },
    });

    if (payments.length > 0) {
      const refund = await PaymentService.refundPayment({
        originalPaymentId: payments[0].id,
        amount: 10000,
        reason: 'Test refund',
        createdBy: testUserId,
      });

      expect(refund).toBeDefined();
      expect(refund.refundOfPaymentId).toBe(payments[0].id);

      // Verify reversed entries
      const refundEntries = await prisma.ledgerEntry.findMany({
        where: { paymentId: refund.id, deletedAt: null },
      });

      expect(refundEntries.length).toBe(2);
    }
  });

  test('Client ledger returns running balance', async () => {
    const ledger = await LedgerService.getClientLedger(testClientId);
    
    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger[0]).toHaveProperty('runningBalance');
    expect(ledger[0]).toHaveProperty('outstanding');
  });

  test('Company ledger calculates account balances', async () => {
    const result = await LedgerService.getCompanyLedger();
    
    expect(result.summary).toBeDefined();
    expect(result.summary).toHaveProperty('cashBalance');
    expect(result.summary).toHaveProperty('bankBalance');
    expect(result.summary).toHaveProperty('receivables');
    expect(result.entries.length).toBeGreaterThan(0);
  });
});

