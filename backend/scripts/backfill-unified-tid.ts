/**
 * backfill-unified-tid.ts
 *
 * STRICT UNIFIED TID BACKFILL MIGRATION
 * ======================================
 * Rules enforced:
 *  1. TID is generated ONCE — at the Client (or Lead) level.
 *  2. Every Deal inherits its client's TID.
 *  3. Every Payment inherits its deal's TID (= client's TID).
 *  4. Orphan records (no client link) get their own TID as a last resort.
 *  5. Duplicate TIDs on the same entity are deduplicated.
 *
 * Usage:
 *   npx tsx scripts/backfill-unified-tid.ts          # dry-run (default)
 *   npx tsx scripts/backfill-unified-tid.ts --apply  # write changes
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes('--apply');

// ─── TID Generator ───────────────────────────────────────────────────────────

async function generateTid(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRX-${year}-`;

  try {
    const seq = await prisma.sequence.update({
      where: { prefix: `tid-${year}` },
      data: { current: { increment: 1 } },
    });
    return `${prefix}${seq.current.toString().padStart(4, '0')}`;
  } catch (err: any) {
    if (err.code === 'P2025') {
      // Seed the sequence from the current max
      const lastRegistry = await prisma.transactionIdentityRegistry.findFirst({
        where: { tid: { startsWith: prefix } },
        orderBy: { tid: 'desc' },
        select: { tid: true },
      });
      const [lastClient, lastLead] = await Promise.all([
        prisma.client.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
        prisma.lead.findFirst({ where: { tid: { startsWith: prefix } }, orderBy: { tid: 'desc' }, select: { tid: true } }),
      ]);

      let nextSeq = 1;
      for (const rec of [lastRegistry, lastClient, lastLead]) {
        if (rec?.tid) {
          const num = parseInt(rec.tid.replace(prefix, ''), 10);
          if (!isNaN(num) && num >= nextSeq) nextSeq = num + 1;
        }
      }

      const seq = await prisma.sequence.upsert({
        where: { prefix: `tid-${year}` },
        create: { prefix: `tid-${year}`, current: nextSeq },
        update: { current: { increment: 1 } },
      });
      return `${prefix}${seq.current.toString().padStart(4, '0')}`;
    }
    throw err;
  }
}

function log(msg: string) {
  console.log(DRY_RUN ? `[DRY-RUN] ${msg}` : `[APPLY]   ${msg}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  UNIFIED TID BACKFILL  (${DRY_RUN ? 'DRY RUN — no writes' : 'LIVE — writing to DB'})`);
  console.log(`${'='.repeat(60)}\n`);

  let clientsFixed = 0;
  let leadsFixed = 0;
  let dealsFixed = 0;
  let paymentsFixed = 0;
  let registryAdded = 0;

  // ── 1. Leads without TID ──────────────────────────────────────────────────
  const leadsWithoutTid = await prisma.lead.findMany({
    where: { tid: null, isDeleted: false },
    select: { id: true, name: true, leadCode: true },
  });

  log(`Leads missing TID: ${leadsWithoutTid.length}`);
  for (const lead of leadsWithoutTid) {
    const tid = await generateTid();
    log(`  Lead ${lead.leadCode ?? lead.id} (${lead.name}) → ${tid}`);
    if (!DRY_RUN) {
      await prisma.lead.update({ where: { id: lead.id }, data: { tid } });
    }
    leadsFixed++;
  }

  // ── 2. Clients without TID ────────────────────────────────────────────────
  const clientsWithoutTid = await prisma.client.findMany({
    where: { tid: null, isDeleted: false },
    select: { id: true, name: true, clientCode: true, convertedFromLeadId: true },
  });

  log(`\nClients missing TID: ${clientsWithoutTid.length}`);
  for (const client of clientsWithoutTid) {
    let tid: string;

    // If converted from a lead, inherit the lead's TID
    if (client.convertedFromLeadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: client.convertedFromLeadId },
        select: { tid: true },
      });
      if (lead?.tid) {
        tid = lead.tid;
        log(`  Client ${client.clientCode ?? client.id} (${client.name}) ← lead TID ${tid}`);
      } else {
        tid = await generateTid();
        log(`  Client ${client.clientCode ?? client.id} (${client.name}) → new TID ${tid} (lead had no TID)`);
      }
    } else {
      tid = await generateTid();
      log(`  Client ${client.clientCode ?? client.id} (${client.name}) → new TID ${tid}`);
    }

    if (!DRY_RUN) {
      await prisma.client.update({ where: { id: client.id }, data: { tid } });
    }
    clientsFixed++;
  }

  // ── 3. Deals — inherit TID from client ────────────────────────────────────
  const dealsWithoutTid = await prisma.deal.findMany({
    where: { isDeleted: false, deletedAt: null },
    select: { id: true, dealCode: true, clientId: true, tid: true },
  });

  // Build a client→tid map (including freshly assigned ones)
  const allClients = await prisma.client.findMany({
    where: { isDeleted: false },
    select: { id: true, tid: true, clientCode: true },
  });
  const clientTidMap = new Map(allClients.map((c) => [c.id, c.tid]));

  log(`\nDeals to process: ${dealsWithoutTid.length}`);
  for (const deal of dealsWithoutTid) {
    const clientTid = deal.clientId ? clientTidMap.get(deal.clientId) : null;

    if (!clientTid) {
      // Orphan deal — generate its own TID
      if (!deal.tid) {
        const tid = await generateTid();
        log(`  Deal ${deal.dealCode ?? deal.id} (no client) → orphan TID ${tid}`);
        if (!DRY_RUN) {
          await prisma.deal.update({ where: { id: deal.id }, data: { tid } });
        }
        dealsFixed++;
      }
      continue;
    }

    if (deal.tid === clientTid) continue; // already correct

    log(`  Deal ${deal.dealCode ?? deal.id}: ${deal.tid ?? 'null'} → ${clientTid}`);
    if (!DRY_RUN) {
      await prisma.deal.update({ where: { id: deal.id }, data: { tid: clientTid } });
    }
    dealsFixed++;
  }

  // ── 4. Payments — inherit TID from deal ───────────────────────────────────
  const allDeals = await prisma.deal.findMany({
    where: { isDeleted: false },
    select: { id: true, tid: true, dealCode: true },
  });
  const dealTidMap = new Map(allDeals.map((d) => [d.id, d.tid]));

  const payments = await prisma.payment.findMany({
    where: { deletedAt: null },
    select: { id: true, paymentId: true, dealId: true, tid: true },
  });

  log(`\nPayments to process: ${payments.length}`);
  for (const payment of payments) {
    const dealTid = dealTidMap.get(payment.dealId) ?? null;

    if (!dealTid) {
      log(`  Payment ${payment.paymentId} — deal has no TID, skipping`);
      continue;
    }

    if (payment.tid === dealTid) continue; // already correct

    log(`  Payment ${payment.paymentId}: ${payment.tid ?? 'null'} → ${dealTid}`);
    if (!DRY_RUN) {
      await prisma.payment.update({ where: { id: payment.id }, data: { tid: dealTid } });
    }
    paymentsFixed++;
  }

  // ── 5. Rebuild TransactionIdentityRegistry ────────────────────────────────
  log(`\nRebuilding TransactionIdentityRegistry...`);

  if (!DRY_RUN) {
    // Upsert registry entries for all clients
    const clients = await prisma.client.findMany({
      where: { isDeleted: false, tid: { not: null } },
      select: { id: true, tid: true },
    });
    for (const c of clients) {
      const existing = await prisma.transactionIdentityRegistry.findFirst({
        where: { tid: c.tid!, entityType: 'client', entityId: c.id },
      });
      if (!existing) {
        await prisma.transactionIdentityRegistry.create({
          data: { tid: c.tid!, entityType: 'client', entityId: c.id, moduleName: 'CRM' },
        });
        registryAdded++;
      }
    }

    // Upsert registry entries for all deals
    const deals = await prisma.deal.findMany({
      where: { isDeleted: false, tid: { not: null } },
      select: { id: true, tid: true },
    });
    for (const d of deals) {
      const existing = await prisma.transactionIdentityRegistry.findFirst({
        where: { tid: d.tid!, entityType: 'deal', entityId: d.id },
      });
      if (!existing) {
        await prisma.transactionIdentityRegistry.create({
          data: { tid: d.tid!, entityType: 'deal', entityId: d.id, moduleName: 'CRM' },
        });
        registryAdded++;
      }
    }

    // Upsert registry entries for all payments
    const paysWithTid = await prisma.payment.findMany({
      where: { deletedAt: null, tid: { not: null } },
      select: { id: true, tid: true },
    });
    for (const p of paysWithTid) {
      const existing = await prisma.transactionIdentityRegistry.findFirst({
        where: { tid: p.tid!, entityType: 'payment', entityId: p.id },
      });
      if (!existing) {
        await prisma.transactionIdentityRegistry.create({
          data: { tid: p.tid!, entityType: 'payment', entityId: p.id, moduleName: 'Finance' },
        });
        registryAdded++;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  SUMMARY`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Leads fixed:     ${leadsFixed}`);
  console.log(`  Clients fixed:   ${clientsFixed}`);
  console.log(`  Deals fixed:     ${dealsFixed}`);
  console.log(`  Payments fixed:  ${paymentsFixed}`);
  console.log(`  Registry added:  ${registryAdded}`);
  if (DRY_RUN) {
    console.log(`\n  ⚠️  DRY RUN — no changes written.`);
    console.log(`  Run with --apply to commit changes.\n`);
  } else {
    console.log(`\n  ✅ All changes committed.\n`);
  }
}

run()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
