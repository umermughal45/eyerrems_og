// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { TransactionIdentityEngine } from '../services/transactionIdentity.service';
import logger from '../utils/logger';

const prisma = new PrismaClient();

async function backfillTransactionIDs() {
  try {
    logger.info('Starting T-ID Backfill Process...');

    // 1. Process Leads
    const leads = await prisma.lead.findMany();
    for (const lead of leads) {
      let tid = lead.tid;
      if (!tid) {
        tid = await TransactionIdentityEngine.generateTransactionID();
        await prisma.lead.update({ where: { id: lead.id }, data: { tid } });
        logger.info(`Generated new T-ID for Lead ${lead.id}: ${tid}`);
      }
      if (tid) {
        await registerTID(tid, 'lead', lead.id, 'CRM');
      }
    }
    logger.info(`Processed ${leads.length} Leads`);

    // 2. Process Clients (inherit from Lead if possible)
    const clients = await prisma.client.findMany({ include: { lead: true } });
    for (const client of clients) {
      let tid = client.tid;
      
      // If client came from a lead, inherit lead's T-ID
      if (client.lead && client.lead.tid) {
        tid = client.lead.tid;
        // Correct client's tid to match the lead
        if (client.tid !== tid) {
          await prisma.client.update({ where: { id: client.id }, data: { tid } });
        }
      } else if (!tid) {
        tid = await TransactionIdentityEngine.generateTransactionID();
        await prisma.client.update({ where: { id: client.id }, data: { tid } });
      }

      if (tid) {
        await registerTID(tid, 'client', client.id, 'CRM');
      }
    }
    logger.info(`Processed ${clients.length} Clients`);

    // 3. Process Deals (inherit from Client)
    const deals = await prisma.deal.findMany({ include: { client: true } });
    for (const deal of deals) {
      let tid = deal.tid;

      if (deal.client && deal.client.tid) {
        tid = deal.client.tid;
        if (deal.tid !== tid) {
          await prisma.deal.update({ where: { id: deal.id }, data: { tid } });
        }
      } else if (!tid) {
        tid = await TransactionIdentityEngine.generateTransactionID();
        await prisma.deal.update({ where: { id: deal.id }, data: { tid } });
      }

      if (tid) {
        await registerTID(tid, 'deal', deal.id, 'Properties');
      }
    }
    logger.info(`Processed ${deals.length} Deals`);

    // 4. Process Invoices (Generate new T-ID optionally, or inherit from property if needed. For backfill, generating self is safest)
    const invoices = await prisma.invoice.findMany();
    for (const invoice of invoices) {
      let tid = invoice.tid;

      if (!tid) {
        tid = await TransactionIdentityEngine.generateTransactionID();
        await prisma.invoice.update({ where: { id: invoice.id }, data: { tid } });
      }

      if (tid) {
        await registerTID(tid, 'invoice', invoice.id, 'Finance');
      }
    }
    logger.info(`Processed ${invoices.length} Invoices`);

    // 5. Process Payments (inherit from Deal)
    const payments = await prisma.payment.findMany({ include: { deal: true } });
    for (const payment of payments) {
      let tid = payment.tid;

      if (payment.deal && payment.deal.tid) {
        tid = payment.deal.tid;
        if (payment.tid !== tid) {
          await prisma.payment.update({ where: { id: payment.id }, data: { tid } });
        }
      } else if (!tid) {
        tid = await TransactionIdentityEngine.generateTransactionID();
        await prisma.payment.update({ where: { id: payment.id }, data: { tid } });
      }

      if (tid) {
        await registerTID(tid, 'payment', payment.id, 'Finance');
      }
    }
    logger.info(`Processed ${payments.length} Payments`);

    logger.info('T-ID Backfill Process Complete');
  } catch (error) {
    logger.error(`Error during T-ID backfill: ${error}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper safely register TID without crashing on duplicates
async function registerTID(tid: string, entityType: string, entityId: string, moduleName: string) {
  try {
    // Check if registry entry exists
    const existing = (await prisma as any).transactionIdentityRegistry.findFirst({
      where: { tid, entityType, entityId }
    });

    if (!existing) {
      await TransactionIdentityEngine.attachTid(tid, entityType, entityId, moduleName);
    }
  } catch (error: any) {
    logger.warn(`Failed to register TID ${tid} for ${entityType} ${entityId}: ${error.message}`);
  }
}

// Run the script if executed directly
if (require.main === module) {
  backfillTransactionIDs();
}
