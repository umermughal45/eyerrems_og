import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const tidRegex = /^\d{4}-\d{2}-\d{4}$/;
const fmtTid = (d: Date, n: number) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(4, '0')}`;
const fmtCode = (p: string, n: number) => `${p}${String(n).padStart(4, '0')}`;

async function run() {
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  // Leads: seed canonical TID + LD code if missing/invalid.
  const leads = await prisma.lead.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, tid: true, leadCode: true },
  });
  const leadTidById = new Map<string, string>();
  let seqLeadTid = 1;
  let seqLeadCode = 1;
  for (const l of leads) {
    const newTid = tidRegex.test(l.tid || '') ? l.tid! : fmtTid(l.createdAt || new Date(), seqLeadTid++);
    const newCode = /^LD\d{4}$/.test(l.leadCode || '') ? l.leadCode! : fmtCode('LD', seqLeadCode++);
    leadTidById.set(l.id, newTid);
    if (apply && (newTid !== (l.tid || '') || newCode !== (l.leadCode || ''))) {
      await prisma.lead.update({ where: { id: l.id }, data: { tid: newTid, leadCode: newCode } });
    }
  }

  // Clients: preserve converted lead TID when available.
  const clients = await prisma.client.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, tid: true, clientCode: true, convertedFromLeadId: true },
  });
  const clientTidById = new Map<string, string>();
  let seqClientTid = 1;
  let seqClientCode = 1;
  for (const c of clients) {
    const inheritedTid = c.convertedFromLeadId ? leadTidById.get(c.convertedFromLeadId) : undefined;
    const newTid = inheritedTid || (tidRegex.test(c.tid || '') ? c.tid! : fmtTid(c.createdAt || new Date(), seqClientTid++));
    const newCode = /^CL\d{4}$/.test(c.clientCode || '') ? c.clientCode! : fmtCode('CL', seqClientCode++);
    clientTidById.set(c.id, newTid);
    if (apply && (newTid !== (c.tid || '') || newCode !== (c.clientCode || ''))) {
      await prisma.client.update({ where: { id: c.id }, data: { tid: newTid, clientCode: newCode } });
    }
  }

  // Dealers + Properties: canonical codes/TIDs for missing data only.
  const dealers = await prisma.dealer.findMany({ where: { isDeleted: false }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, tid: true, dealerCode: true } });
  let seqDealerTid = 1;
  let seqDealerCode = 1;
  for (const d of dealers) {
    const tid = tidRegex.test(d.tid || '') ? d.tid! : fmtTid(d.createdAt || new Date(), seqDealerTid++);
    const code = /^DL\d{4}$/.test(d.dealerCode || '') ? d.dealerCode! : fmtCode('DL', seqDealerCode++);
    if (apply && (tid !== (d.tid || '') || code !== (d.dealerCode || ''))) {
      await prisma.dealer.update({ where: { id: d.id }, data: { tid, dealerCode: code } });
    }
  }

  const properties = await prisma.property.findMany({ where: { isDeleted: false }, orderBy: { createdAt: 'asc' }, select: { id: true, createdAt: true, tid: true, propertyCode: true } });
  let seqPropertyTid = 1;
  let seqPropertyCode = 1;
  for (const p of properties) {
    const tid = tidRegex.test(p.tid || '') ? p.tid! : fmtTid(p.createdAt || new Date(), seqPropertyTid++);
    const code = /^PR\d{4}$/.test(p.propertyCode || '') ? p.propertyCode! : fmtCode('PR', seqPropertyCode++);
    if (apply && (tid !== (p.tid || '') || code !== (p.propertyCode || ''))) {
      await prisma.property.update({ where: { id: p.id }, data: { tid, propertyCode: code } });
    }
  }

  // Deals: enforce inheritance from client, otherwise generate.
  const deals = await prisma.deal.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true, tid: true, dealCode: true, clientId: true },
  });
  const dealTidById = new Map<string, string>();
  let seqDealTid = 1;
  let seqDealCode = 1;
  for (const d of deals) {
    const inheritedTid = d.clientId ? clientTidById.get(d.clientId) : undefined;
    const tid = inheritedTid || (tidRegex.test(d.tid || '') ? d.tid! : fmtTid(d.createdAt || new Date(), seqDealTid++));
    const code = /^DEAL\d{4}$/.test(d.dealCode || '') ? d.dealCode! : fmtCode('DEAL', seqDealCode++);
    dealTidById.set(d.id, tid);
    if (apply && (tid !== (d.tid || '') || code !== (d.dealCode || ''))) {
      await prisma.deal.update({ where: { id: d.id }, data: { tid, dealCode: code } });
    }
  }

  // Payments + installments: inherit deal TID.
  const payments = await prisma.payment.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true, dealId: true, tid: true, paymentId: true } });
  let seqPayCode = 1;
  for (const p of payments) {
    const tid = dealTidById.get(p.dealId) || p.tid || null;
    const code = /^PAY\d{4}$/.test(p.paymentId || '') ? p.paymentId : fmtCode('PAY', seqPayCode++);
    if (apply && ((tid || '') !== (p.tid || '') || code !== p.paymentId)) {
      await prisma.payment.update({ where: { id: p.id }, data: { tid: tid || undefined, paymentId: code } });
    }
  }

  const installments = await prisma.dealInstallment.findMany({ where: { isDeleted: false }, select: { id: true, dealId: true, tid: true } });
  for (const i of installments) {
    const tid = dealTidById.get(i.dealId) || i.tid || null;
    if (apply && (tid || '') !== (i.tid || '')) {
      await prisma.dealInstallment.update({ where: { id: i.id }, data: { tid: tid || undefined } });
    }
  }

  console.log(`Processed: leads=${leads.length}, clients=${clients.length}, dealers=${dealers.length}, properties=${properties.length}, deals=${deals.length}, payments=${payments.length}, installments=${installments.length}`);
  console.log(apply ? 'Migration applied successfully.' : 'Dry-run complete. Re-run with --apply to persist.');
}

run()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

