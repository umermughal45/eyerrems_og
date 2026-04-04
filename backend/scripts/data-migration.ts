/**
 * Data Migration Script
 * Migrates existing ledger entries from string-based accounts to Chart of Accounts
 * Maps legacy account names to new account IDs via AccountAlias
 */

import { PrismaClient } from '@prisma/client';
import prisma from '../src/prisma/client';

async function migrateLedgerEntries() {
  console.log('Starting ledger entries migration...');

  // Get all ledger entries with string-based accounts
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      OR: [
        { debitAccountId: null },
        { creditAccountId: null },
      ],
    },
  });

  console.log(`Found ${entries.length} entries to migrate`);

  let migrated = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      const updates: any = {};

      // Migrate debit account
      if (!entry.debitAccountId && entry.accountDebit) {
        const accountAlias = await prisma.accountAlias.findUnique({
          where: { alias: entry.accountDebit },
          include: { account: true },
        });

        if (accountAlias && accountAlias.account.isActive) {
          updates.debitAccountId = accountAlias.accountId;
        } else {
          // Try fuzzy match
          const account = await prisma.account.findFirst({
            where: {
              name: { contains: entry.accountDebit, mode: 'insensitive' },
              isActive: true,
            },
          });

          if (account) {
            updates.debitAccountId = account.id;
            // Create alias for future use
            await prisma.accountAlias.upsert({
              where: { alias: entry.accountDebit },
              create: {
                alias: entry.accountDebit,
                accountId: account.id,
              },
              update: {},
            });
          } else {
            console.warn(`Could not find account for: ${entry.accountDebit}`);
          }
        }
      }

      // Migrate credit account
      if (!entry.creditAccountId && entry.accountCredit) {
        const accountAlias = await prisma.accountAlias.findUnique({
          where: { alias: entry.accountCredit },
          include: { account: true },
        });

        if (accountAlias && accountAlias.account.isActive) {
          updates.creditAccountId = accountAlias.accountId;
        } else {
          // Try fuzzy match
          const account = await prisma.account.findFirst({
            where: {
              name: { contains: entry.accountCredit, mode: 'insensitive' },
              isActive: true,
            },
          });

          if (account) {
            updates.creditAccountId = account.id;
            // Create alias for future use
            await prisma.accountAlias.upsert({
              where: { alias: entry.accountCredit },
              create: {
                alias: entry.accountCredit,
                accountId: account.id,
              },
              update: {},
            });
          } else {
            console.warn(`Could not find account for: ${entry.accountCredit}`);
          }
        }
      }

      // Update entry if we found accounts
      if (updates.debitAccountId || updates.creditAccountId) {
        await prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: updates,
        });
        migrated++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Error migrating entry ${entry.id}:`, error);
      failed++;
    }
  }

  console.log(`Migration complete: ${migrated} migrated, ${failed} failed`);
}

async function backfillDealTotals() {
  console.log('Backfilling deal totalPaid...');

  const deals = await prisma.deal.findMany({
    include: {
      payments: {
        where: { deletedAt: null },
      },
    },
  });

  let updated = 0;

  for (const deal of deals) {
    const totalPaid = deal.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);

    if (deal.totalPaid !== totalPaid) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { totalPaid },
      });
      updated++;
    }
  }

  console.log(`Backfilled ${updated} deals`);
}

async function backfillStageHistory() {
  console.log('Backfilling stage history...');

  const deals = await prisma.deal.findMany({
    include: {
      stageHistory: {
        orderBy: { changedAt: 'asc' },
      },
    },
  });

  let created = 0;

  for (const deal of deals) {
    // If no stage history exists, create initial entry
    if (deal.stageHistory.length === 0) {
      await prisma.stageHistory.create({
        data: {
          dealId: deal.id,
          toStage: deal.stage,
          probability: deal.probability,
          changedBy: deal.createdBy,
          changedAt: deal.createdAt,
        },
      });
      created++;
    }
  }

  console.log(`Created ${created} initial stage history entries`);
}

async function main() {
  console.log('Starting data migration...');

  try {
    await migrateLedgerEntries();
    await backfillDealTotals();
    await backfillStageHistory();

    console.log('Data migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { migrateLedgerEntries, backfillDealTotals, backfillStageHistory };

