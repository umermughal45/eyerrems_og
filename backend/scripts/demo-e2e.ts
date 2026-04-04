/**
 * End-to-End Demo Script
 * Demonstrates the complete workflow: Client → Property → Deal → Payment → Ledger
 * Based on the John Doe → Luxury Apartment example
 */

import { PrismaClient } from '@prisma/client';
import { DealService } from '../src/services/deal-service';
import { PaymentService } from '../src/services/payment-service';
import { LedgerService } from '../src/services/ledger-service';
import { seedChartOfAccounts } from '../prisma/seeds/chart-of-accounts';

const prisma = new PrismaClient();

async function runDemo() {
  console.log('=== Real Estate ERP: End-to-End Demo ===\n');

  try {
    // Step 1: Seed Chart of Accounts
    console.log('Step 1: Seeding Chart of Accounts...');
    await seedChartOfAccounts();
    console.log('✓ Chart of Accounts seeded\n');

    // Step 2: Create Client (John Doe)
    console.log('Step 2: Creating client (John Doe)...');
    const client = await prisma.client.upsert({
      where: { clientCode: 'CL-DEMO-001' },
      update: {},
      create: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        status: 'active',
        clientType: 'individual',
        clientCategory: 'regular',
        clientCode: 'CL-DEMO-001',
      },
    });
    console.log(`✓ Client created: ${client.name} (${client.id})\n`);

    // Step 3: Create Property (Luxury Apartment A-101)
    console.log('Step 3: Creating property (Luxury Apartment A-101)...');
    const property = await prisma.property.upsert({
      where: { propertyCode: 'PROP-DEMO-001' },
      update: {},
      create: {
        name: 'Luxury Apartment A-101',
        type: 'Residential',
        address: '123 Luxury Street',
        city: 'New York',
        status: 'Vacant',
        propertyCode: 'PROP-DEMO-001',
      },
    });
    console.log(`✓ Property created: ${property.name} (${property.id})\n`);

    // Step 4: Create Deal
    console.log('Step 4: Creating deal...');
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found. Please create a user first.');
    }

    const deal = await DealService.createDeal({
      title: 'Luxury Apartment Sale',
      clientId: client.id,
      propertyId: property.id,
      dealAmount: 500000,
      role: 'buyer',
      dealType: 'sale',
      stage: 'negotiation',
      probability: 80,
      createdBy: user.id,
    });
    console.log(`✓ Deal created: ${deal.title}`);
    console.log(`  Deal Code: ${deal.dealCode}`);
    console.log(`  Amount: Rs ${deal.dealAmount.toLocaleString("en-PK")}`);
    console.log(`  Expected Revenue: Rs ${deal.expectedRevenue?.toLocaleString("en-PK")}\n`);

    // Step 5: Record Payment (Rs 50,000 booking via bank)
    console.log('Step 5: Recording payment (Rs 50,000 booking via bank)...');
    const payment = await PaymentService.createPayment({
      dealId: deal.id,
      amount: 50000,
      paymentType: 'booking',
      paymentMode: 'bank',
      referenceNumber: 'CHQ-12345',
      remarks: 'Initial booking payment',
      createdBy: user.id,
    });
    console.log(`✓ Payment recorded: ${payment.paymentId}`);
    console.log(`  Amount: Rs ${payment.amount.toLocaleString("en-PK")}`);
    console.log(`  Type: ${payment.paymentType}`);
    console.log(`  Mode: ${payment.paymentMode}\n`);

    // Step 6: Verify Ledger Entries
    console.log('Step 6: Verifying ledger entries...');
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { paymentId: payment.id, deletedAt: null },
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    console.log(`✓ Created ${ledgerEntries.length} ledger entries:`);
    ledgerEntries.forEach((entry, idx) => {
      if (entry.debitAccountId) {
        console.log(`  Entry ${idx + 1} (Debit): ${entry.debitAccount?.name} +Rs ${entry.amount.toLocaleString("en-PK")}`);
      }
      if (entry.creditAccountId) {
        console.log(`  Entry ${idx + 1} (Credit): ${entry.creditAccount?.name} -Rs ${entry.amount.toLocaleString("en-PK")}`);
      }
    });
    console.log('');

    // Step 7: Check Deal Status
    console.log('Step 7: Checking deal status...');
    const updatedDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      include: {
        payments: { where: { deletedAt: null } },
      },
    });
    console.log(`✓ Deal Status: ${updatedDeal?.status}`);
    console.log(`  Total Paid: Rs ${updatedDeal?.totalPaid.toLocaleString("en-PK")}`);
    console.log(`  Outstanding: Rs ${(updatedDeal!.dealAmount - updatedDeal!.totalPaid).toLocaleString("en-PK")}\n`);

    // Step 8: View Client Ledger
    console.log('Step 8: Client Ledger Summary...');
    const clientLedger = await LedgerService.getClientLedger(client.id);
    clientLedger.forEach((row) => {
      if (row.paymentId) {
        console.log(`  ${row.paymentId}: Rs ${row.amount.toLocaleString("en-PK")} | Outstanding: Rs ${row.outstanding.toLocaleString("en-PK")}`);
      }
    });
    console.log('');

    // Step 9: View Company Ledger Summary
    console.log('Step 9: Company Ledger Summary...');
    const companyLedger = await LedgerService.getCompanyLedger();
    console.log(`  Cash Balance: Rs ${companyLedger.summary.cashBalance.toLocaleString("en-PK")}`);
    console.log(`  Bank Balance: Rs ${companyLedger.summary.bankBalance.toLocaleString("en-PK")}`);
    console.log(`  Receivables: Rs ${companyLedger.summary.receivables.toLocaleString("en-PK")}`);
    console.log(`  Payables: Rs ${companyLedger.summary.payables.toLocaleString("en-PK")}\n`);

    // Step 10: Demo Verification
    console.log('=== Demo Verification ===');
    console.log(`Deal: ${deal.dealCode} amount Rs ${deal.dealAmount.toLocaleString("en-PK")}`);
    console.log(`Payment: ${payment.paymentId} booking Rs ${payment.amount.toLocaleString("en-PK")} mode ${payment.paymentMode}`);
    console.log(`Ledger entries: ${ledgerEntries.length} (double-entry)`);
    console.log(`Client outstanding after payment: Rs ${(deal.dealAmount - payment.amount).toLocaleString("en-PK")}`);
    console.log('\n✓ Demo completed successfully!');

    return {
      client,
      property,
      deal,
      payment,
      ledgerEntries,
      companyLedger: companyLedger.summary,
    };
  } catch (error) {
    console.error('Demo failed:', error);
    throw error;
  }
}

if (require.main === module) {
  runDemo()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { runDemo };

