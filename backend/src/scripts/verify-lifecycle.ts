// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { TransactionIdentityEngine } from '../services/transactionIdentity.service';

const prisma = new PrismaClient();

async function runVerification() {
  console.log("Starting T-ID Lifecycle Verification...");
  try {
    // 1. Create a mock Lead
    const tid = await TransactionIdentityEngine.generateTransactionID();
    const lead = await prisma.lead.create({
      data: {
        name: "Test Verification Lead",
        phone: "555-0000",
        tid,
        status: "new"
      }
    });
    await TransactionIdentityEngine.attachTid(tid, 'lead', lead.id, 'CRM');
    console.log(`[PASS] Lead created with T-ID: ${tid}`);

    // 2. Convert to Client
    const client = await prisma.client.create({
      data: {
        name: "Test Verification Client",
        phone: "555-0000",
        tid: lead.tid,
        status: "active"
      }
    });
    await TransactionIdentityEngine.attachTid(client.tid, 'client', client.id, 'CRM');
    console.log(`[PASS] Client created sharing T-ID: ${client.tid}`);

    // 3. Create Deal
    const deal = await prisma.deal.create({
      data: {
        title: "Test Verification Deal",
        clientId: client.id,
        tid: client.tid,
        status: "open",
        stage: "Negotiation", // Provide required stage
        amount: 500000,       // Mock property required data
        dealAmount: 500000,
        currency: "PKR",
        dealDate: new Date()
      }
    });
    await TransactionIdentityEngine.attachTid(deal.tid, 'deal', deal.id, 'Properties');
    console.log(`[PASS] Deal created sharing T-ID: ${deal.tid}`);

    // Fetch the timeline from DB mimicking the API route
    const registryEntries = await prisma.transactionIdentityRegistry.findMany({
      where: { tid }
    });

    if (registryEntries.length >= 3) {
      console.log(`[PASS] Registry verified. Found ${registryEntries.length} linked records. Lifecycle matches perfectly!`);
    } else {
      console.error(`[FAIL] Registry does not match. Expected 3+, found ${registryEntries.length}`);
    }

    // Cleanup mock data
    await prisma.deal.delete({ where: { id: deal.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.transactionIdentityRegistry.deleteMany({ where: { tid } });
    
    console.log("Cleanup complete.");

  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runVerification();
