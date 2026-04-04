/**
 * Finance Operations Extension Service
 * Refund, Transfer, Merge - additive only, no modification of existing records.
 * All operations create NEW vouchers and maintain full audit trail.
 */

import prisma from '../prisma/client';
import { FinancialOperationType, FinancialOperationStatus } from '@prisma/client';
import { VoucherService } from './voucher-service';
import { writeFinanceOperationLedger } from './finance-operation-ledger-service';
import { writeLedgerEntry } from './ledger-engine-service';
import logger from '../utils/logger';

export type OperationRequestPayload = {
  operationType: FinancialOperationType;
  reason: string;
  dealId?: string;
  amount?: number;
  partialAmount?: number;
  sourcePaymentId?: string;
  sourceClientId?: string;
  targetClientId?: string;
  sourceDealId?: string;
  targetDealId?: string;
  sourcePropertyId?: string;
  targetPropertyId?: string;
};

/**
 * Compute transferable balance for a payment (amount not yet refunded/transferred/merged).
 * Used for Transfer and Merge validation.
 */
export async function getTransferableBalance(paymentId: string): Promise<{
  transferableBalance: number;
  paymentAmount: number;
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { deal: { select: { id: true, clientId: true } } },
  });
  if (!payment) throw new Error('Payment not found');
  if (payment.deletedAt) throw new Error('Cannot operate on deleted payment');

  const paymentAmount = Number(payment.amount);
  const paymentRefId = payment.id;
  const dealIdRef = payment.dealId;
  const clientIdRef = payment.deal?.clientId;

  const postedOps = await prisma.financialOperation.findMany({
    where: { status: FinancialOperationStatus.POSTED },
    include: { references: true },
  });

  let consumed = 0;
  for (const op of postedOps) {
    const opAmount = op.partialAmount ?? op.amount ?? 0;
    const refs = op.references ?? [];
    const hasPaymentRef = refs.some((r: any) => r.refType === 'payment' && r.refId === paymentRefId);
    const hasDealRef =
      dealIdRef && refs.some((r: any) => r.refType === 'deal' && r.refId === dealIdRef && r.role === 'SOURCE');
    const hasClientRef =
      clientIdRef && refs.some((r: any) => r.refType === 'client' && r.refId === clientIdRef && r.role === 'SOURCE');

    if (op.operationType === 'REFUND' && hasPaymentRef) consumed += opAmount;
    if (op.operationType === 'TRANSFER' && hasPaymentRef) consumed += opAmount;
    if (op.operationType === 'MERGE' && (hasPaymentRef || hasDealRef)) consumed += opAmount;
  }

  const transferableBalance = Math.max(0, paymentAmount - consumed);
  return { transferableBalance, paymentAmount };
}

export async function createOperationRequest(
  payload: OperationRequestPayload,
  requestedByUserId: string
) {
  const { operationType, reason, dealId, amount, partialAmount } = payload;
  if (!reason || reason.trim().length === 0) {
    throw new Error('Reason is mandatory for all finance operations');
  }

  // --- Validation: Transfer ---
  if (operationType === FinancialOperationType.TRANSFER) {
    if (!payload.sourcePaymentId) throw new Error('Transfer requires source payment');
    if (!payload.sourceClientId) throw new Error('Transfer requires source client');
    if (!payload.targetClientId) throw new Error('Transfer requires target client');
    if (payload.sourceClientId === payload.targetClientId) {
      throw new Error('Target Client must be different from Source Client');
    }
    const amt = payload.amount ?? payload.partialAmount;
    if (!amt || amt <= 0) throw new Error('Transfer amount must be positive');
    const { transferableBalance } = await getTransferableBalance(payload.sourcePaymentId);
    if (amt > transferableBalance) {
      throw new Error(`Amount ${amt} exceeds transferable balance ${transferableBalance.toFixed(2)}`);
    }
  }

  // --- Validation: Merge ---
  if (operationType === FinancialOperationType.MERGE) {
    const srcDeal = payload.sourceDealId;
    const tgtDeal = payload.targetDealId;
    const tgtProp = payload.targetPropertyId;
    if (!srcDeal || (!tgtDeal && !tgtProp)) {
      throw new Error('Merge requires source deal and target deal or property');
    }
    if (tgtDeal && srcDeal === tgtDeal) {
      throw new Error('Source and target deals must be different');
    }
    const amt = payload.amount ?? payload.partialAmount;
    if (!amt || amt <= 0) throw new Error('Merge amount must be positive');

    // Transferable balance: prefer payment-based, else we'd need deal-level advance (for now use payment)
    if (payload.sourcePaymentId) {
      const { transferableBalance } = await getTransferableBalance(payload.sourcePaymentId);
      if (amt > transferableBalance) {
        throw new Error(`Amount ${amt} exceeds available balance ${transferableBalance.toFixed(2)}`);
      }
    }

    // Target deal must be active
    if (tgtDeal) {
      const targetDeal = await prisma.deal.findUnique({
        where: { id: tgtDeal },
        select: { status: true, clientId: true },
      });
      if (!targetDeal) throw new Error('Target deal not found');
      const inactive = ['closed', 'cancelled', 'lost', 'inactive', 'sold'].includes(
        (targetDeal.status || '').toLowerCase()
      );
      if (inactive) throw new Error('Target deal is not active');

      // Same client
      const srcDealRecord = await prisma.deal.findUnique({
        where: { id: srcDeal },
        select: { clientId: true },
      });
      if (srcDealRecord && targetDeal.clientId && srcDealRecord.clientId !== targetDeal.clientId) {
        throw new Error('Target deal must belong to the same client as source');
      }
    }
  }

  // Prevent duplicate pending requests for same payment
  if (payload.sourcePaymentId) {
    const pending = await prisma.financialOperation.findFirst({
      where: {
        status: { in: [FinancialOperationStatus.REQUESTED, FinancialOperationStatus.APPROVED] },
        references: {
          some: {
            refType: 'payment',
            refId: payload.sourcePaymentId,
          },
        },
      },
    });
    if (pending) {
      throw new Error(
        `A pending ${pending.status} operation already exists for this payment. Complete or reject it before creating a new request.`
      );
    }
  }

  const refs: { refType: string; refId: string; role: string }[] = [];
  if (payload.sourcePaymentId) refs.push({ refType: 'payment', refId: payload.sourcePaymentId, role: 'SOURCE' });
  if (payload.sourceClientId) refs.push({ refType: 'client', refId: payload.sourceClientId, role: 'SOURCE' });
  if (payload.targetClientId) refs.push({ refType: 'client', refId: payload.targetClientId, role: 'TARGET' });
  if (payload.sourceDealId) refs.push({ refType: 'deal', refId: payload.sourceDealId, role: 'SOURCE' });
  if (payload.targetDealId) refs.push({ refType: 'deal', refId: payload.targetDealId, role: 'TARGET' });
  if (payload.sourcePropertyId) refs.push({ refType: 'property', refId: payload.sourcePropertyId, role: 'SOURCE' });
  if (payload.targetPropertyId) refs.push({ refType: 'property', refId: payload.targetPropertyId, role: 'TARGET' });

  const op = await prisma.financialOperation.create({
    data: {
      operationType,
      status: FinancialOperationStatus.REQUESTED,
      reason: reason.trim(),
      amount: amount ?? null,
      partialAmount: partialAmount ?? null,
      requestedByUserId,
      dealId: dealId ?? null,
      references: {
        create: refs.map((r) => ({
          refType: r.refType,
          refId: r.refId,
          role: r.role,
        })),
      },
    },
    include: {
      references: true,
      requestedBy: { select: { id: true, username: true } },
      deal: { select: { id: true, dealCode: true, title: true } },
    },
  });
  logger.info(`Finance operation created: ${op.id} type=${operationType} status=REQUESTED`);
  return op;
}

export async function approveOperation(operationId: string, approvedByUserId: string) {
  const op = await prisma.financialOperation.findUnique({
    where: { id: operationId },
    include: { references: true },
  });
  if (!op) throw new Error('Operation not found');
  if (op.status !== FinancialOperationStatus.REQUESTED) {
    throw new Error(`Operation must be REQUESTED to approve. Current: ${op.status}`);
  }

  return prisma.financialOperation.update({
    where: { id: operationId },
    data: {
      status: FinancialOperationStatus.APPROVED,
      approvedByUserId,
      approvedAt: new Date(),
    },
    include: {
      references: true,
      requestedBy: { select: { id: true, username: true } },
      approvedBy: { select: { id: true, username: true } },
      deal: { select: { id: true, dealCode: true, title: true } },
    },
  });
}

export async function rejectOperation(operationId: string) {
  const op = await prisma.financialOperation.findUnique({ where: { id: operationId } });
  if (!op) throw new Error('Operation not found');
  if (op.status !== FinancialOperationStatus.REQUESTED) {
    throw new Error(`Operation must be REQUESTED to reject. Current: ${op.status}`);
  }

  return prisma.financialOperation.update({
    where: { id: operationId },
    data: { status: FinancialOperationStatus.REJECTED },
    include: { references: true, requestedBy: { select: { id: true, username: true } } },
  });
}

/**
 * Execute (post) an approved operation - creates NEW voucher only.
 * No modification of existing payments, vouchers, or records.
 */
export async function executeOperation(operationId: string, postedByUserId: string) {
  const op = await prisma.financialOperation.findUnique({
    where: { id: operationId },
    include: { references: true, deal: true },
  });
  if (!op) throw new Error('Operation not found');
  if (op.status !== FinancialOperationStatus.APPROVED) {
    throw new Error(`Operation must be APPROVED to execute. Current: ${op.status}`);
  }

  let voucherId: string | null = null;

  if (op.operationType === FinancialOperationType.REFUND) {
    voucherId = await executeRefund(op, postedByUserId);
  } else if (op.operationType === FinancialOperationType.TRANSFER) {
    voucherId = await executeTransfer(op, postedByUserId);
  } else if (op.operationType === FinancialOperationType.MERGE) {
    voucherId = await executeMerge(op, postedByUserId);
  } else {
    throw new Error(`Unsupported operation type: ${op.operationType}`);
  }

  return prisma.financialOperation.update({
    where: { id: operationId },
    data: {
      status: FinancialOperationStatus.POSTED,
      postedByUserId,
      postedAt: new Date(),
      voucherId,
    },
    include: {
      references: true,
      voucher: true,
      requestedBy: { select: { id: true, username: true } },
      approvedBy: { select: { id: true, username: true } },
      postedBy: { select: { id: true, username: true } },
      deal: { select: { id: true, dealCode: true, title: true } },
    },
  });
}

async function executeRefund(op: any, userId: string): Promise<string> {
  const paymentRef = op.references?.find(
    (r: any) => r.refType === 'payment' && r.role === 'SOURCE'
  );
  if (!paymentRef) throw new Error('Refund operation requires source payment reference');

  const payment = await prisma.payment.findUnique({
    where: { id: paymentRef.refId },
    include: { deal: { include: { client: true } } },
  });
  if (!payment) throw new Error('Source payment not found');
  if (payment.deletedAt) throw new Error('Cannot refund a deleted payment');

  const refundAmount = op.partialAmount ?? op.amount ?? payment.amount;
  if (refundAmount <= 0 || refundAmount > payment.amount) {
    throw new Error(`Invalid refund amount: ${refundAmount}. Original payment: ${payment.amount}`);
  }

  const isBank =
    payment.paymentMode === 'bank' ||
    payment.paymentMode === 'online_transfer' ||
    payment.paymentMode === 'card' ||
    payment.paymentMode === 'Cheque' ||
    payment.paymentMode === 'Transfer' ||
    payment.paymentMode === 'Online';
  const voucherType = isBank ? 'BPV' : 'CPV';
  const paymentMethod = isBank ? 'Transfer' : 'Cash';

  const bankOrCashAccounts = await prisma.account.findMany({
    where: {
      isActive: true,
      OR: [
        { code: { startsWith: '1112' } },
        { code: { startsWith: '1111' } },
      ],
    },
    orderBy: { code: 'asc' },
    take: 5,
  });
  const bankAccount = bankOrCashAccounts.find((a) => a.code.startsWith('1112'));
  const cashAccount = bankOrCashAccounts.find((a) => a.code.startsWith('1111'));
  const accountId = isBank
    ? (bankAccount?.id ?? bankOrCashAccounts[0]?.id)
    : (cashAccount?.id ?? bankOrCashAccounts[0]?.id);
  if (!accountId) throw new Error('No bank/cash account found in Chart of Accounts');

  const advanceAccounts = await prisma.account.findMany({
    where: {
      isActive: true,
      OR: [{ code: { contains: 'advance' } }, { name: { contains: 'Advance', mode: 'insensitive' } }],
    },
    take: 5,
  });
  const advanceAccountId = advanceAccounts[0]?.id;
  if (!advanceAccountId) throw new Error('No advance/receivable account found. Configure Chart of Accounts.');

  const desc = `Refund - ${op.reason} - Ref Payment ${payment.paymentId}`;
  const lines = [
    { accountId: advanceAccountId, debit: refundAmount, credit: 0, description: desc },
    { accountId, debit: 0, credit: refundAmount, description: desc },
  ];

  const voucher = await VoucherService.createVoucher({
    type: voucherType as any,
    date: new Date(),
    paymentMethod: paymentMethod as any,
    accountId,
    description: desc,
    referenceNumber: `REF-${payment.paymentId}`,
    dealId: op.dealId ?? payment.dealId,
    payeeType: 'Client',
    payeeId: payment.deal?.clientId ?? undefined,
    lines,
    preparedByUserId: userId,
    attachments: [{ url: 'data:text/plain;base64,UmVmdW5kIHZvdWNoZXIgLSBzeXN0ZW0gZ2VuZXJhdGVk', name: 'Refund-System.txt' }],
  });

  await VoucherService.submitVoucher(voucher.id, userId);
  await VoucherService.approveVoucher(voucher.id, userId);
  await VoucherService.postVoucher(voucher.id, userId);

  const clientId = payment.deal?.clientId;
  if (clientId) {
    await writeFinanceOperationLedger(
      [
        {
          entityType: 'Client',
          entityId: clientId,
          accountId: advanceAccountId,
          amount: refundAmount,
          side: 'debit',
          sourceType: 'refund',
          operationId: op.id,
          voucherId: voucher.id,
          paymentId: payment.id,
          description: desc,
        },
      ],
      prisma
    );
    await writeLedgerEntry({
      transactionUuid: op.id,
      entryDate: new Date(),
      accountId: advanceAccountId,
      entityType: 'client',
      entityId: clientId,
      debitAmount: refundAmount,
      creditAmount: 0,
      narration: desc,
      sourceType: 'refund',
      status: 'posted',
    });
  }

  return voucher.id;
}

async function executeTransfer(op: any, userId: string): Promise<string> {
  const paymentRef = op.references?.find((r: any) => r.refType === 'payment' && r.role === 'SOURCE');
  const srcClient = op.references?.find((r: any) => r.refType === 'client' && r.role === 'SOURCE');
  const tgtClient = op.references?.find((r: any) => r.refType === 'client' && r.role === 'TARGET');
  if (!srcClient || !tgtClient) {
    throw new Error('Transfer operation requires source and target client references');
  }

  const amount = op.amount ?? op.partialAmount;
  if (!amount || amount <= 0) throw new Error('Transfer requires positive amount');

  if (srcClient.refId === tgtClient.refId) {
    throw new Error('Target Client must be different from Source Client');
  }

  if (paymentRef) {
    const { transferableBalance } = await getTransferableBalance(paymentRef.refId);
    if (amount > transferableBalance) {
      throw new Error(`Amount ${amount} exceeds transferable balance ${transferableBalance.toFixed(2)}`);
    }
  }

  const srcBinding = await prisma.entityAccountBinding.findFirst({
    where: { entityType: 'Client', entityId: srcClient.refId },
    include: { account: true },
  });
  const tgtBinding = await prisma.entityAccountBinding.findFirst({
    where: { entityType: 'Client', entityId: tgtClient.refId },
    include: { account: true },
  });

  const srcAccountId = srcBinding?.accountId;
  const tgtAccountId = tgtBinding?.accountId;

  if (!srcAccountId || !tgtAccountId) {
    throw new Error(
      'Both clients must have advance accounts bound. Use Finance → Entity Accounts to bind Client advance accounts.'
    );
  }

  const refNum = paymentRef ? `TRF-PMT-${paymentRef.refId.slice(0, 8)}` : `TRF-${op.id.slice(0, 8)}`;
  const desc = `Transfer - ${op.reason} - Client to Client | Op ${op.id}`;
  const lines = [
    { accountId: tgtAccountId, debit: amount, credit: 0, description: desc },
    { accountId: srcAccountId, debit: 0, credit: amount, description: desc },
  ];

  const voucher = await VoucherService.createVoucher({
    type: 'JV',
    date: new Date(),
    paymentMethod: 'Transfer',
    accountId: srcAccountId,
    description: desc,
    referenceNumber: refNum,
    dealId: op.dealId ?? undefined,
    lines,
    preparedByUserId: userId,
  });

  await VoucherService.submitVoucher(voucher.id, userId);
  await VoucherService.approveVoucher(voucher.id, userId);
  await VoucherService.postVoucher(voucher.id, userId);

  await writeFinanceOperationLedger(
    [
      {
        entityType: 'Client',
        entityId: tgtClient.refId,
        accountId: tgtAccountId,
        amount,
        side: 'debit',
        sourceType: 'transfer',
        operationId: op.id,
        voucherId: voucher.id,
        paymentId: paymentRef?.refId,
        description: desc,
      },
      {
        entityType: 'Client',
        entityId: srcClient.refId,
        accountId: srcAccountId,
        amount,
        side: 'credit',
        sourceType: 'transfer',
        operationId: op.id,
        voucherId: voucher.id,
        paymentId: paymentRef?.refId,
        description: desc,
      },
    ],
    prisma
  );

  await writeLedgerEntry({
    transactionUuid: op.id,
    entryDate: new Date(),
    accountId: tgtAccountId,
    entityType: 'client',
    entityId: tgtClient.refId,
    debitAmount: amount,
    creditAmount: 0,
    narration: desc,
    sourceType: 'transfer',
    status: 'posted',
  });
  await writeLedgerEntry({
    transactionUuid: op.id,
    entryDate: new Date(),
    accountId: srcAccountId,
    entityType: 'client',
    entityId: srcClient.refId,
    debitAmount: 0,
    creditAmount: amount,
    narration: desc,
    sourceType: 'transfer',
    status: 'posted',
  });

  return voucher.id;
}

function toEntityType(refType: string): string {
  return refType === 'deal' ? 'Deal' : refType === 'property' ? 'Property' : refType;
}

async function executeMerge(op: any, userId: string): Promise<string> {
  const srcRef =
    op.references?.find((r: any) => r.refType === 'deal' && r.role === 'SOURCE') ??
    op.references?.find((r: any) => r.refType === 'property' && r.role === 'SOURCE');
  const tgtRef =
    op.references?.find((r: any) => r.refType === 'deal' && r.role === 'TARGET') ??
    op.references?.find((r: any) => r.refType === 'property' && r.role === 'TARGET');

  if (!srcRef || !tgtRef) {
    throw new Error('Merge operation requires source and target deal or property references');
  }

  if (srcRef.refType === tgtRef.refType && srcRef.refId === tgtRef.refId) {
    throw new Error('Source and target must be different');
  }

  const amount = op.amount ?? op.partialAmount;
  if (!amount || amount <= 0) throw new Error('Merge requires positive amount');

  const paymentRef = op.references?.find((r: any) => r.refType === 'payment' && r.role === 'SOURCE');
  if (paymentRef) {
    const { transferableBalance } = await getTransferableBalance(paymentRef.refId);
    if (amount > transferableBalance) {
      throw new Error(`Amount ${amount} exceeds available balance ${transferableBalance.toFixed(2)}`);
    }
  }

  if (tgtRef.refType === 'deal') {
    const targetDeal = await prisma.deal.findUnique({
      where: { id: tgtRef.refId },
      select: { status: true, clientId: true },
    });
    if (!targetDeal) throw new Error('Target deal not found');
    const inactive = ['closed', 'cancelled', 'lost', 'inactive', 'sold'].includes(
      (targetDeal.status || '').toLowerCase()
    );
    if (inactive) throw new Error('Target deal is not active');
  }

  const srcEntityType = toEntityType(srcRef.refType);
  const tgtEntityType = toEntityType(tgtRef.refType);

  let srcBinding = await prisma.entityAccountBinding.findFirst({
    where: { entityType: srcEntityType, entityId: srcRef.refId },
    include: { account: true },
  });
  if (!srcBinding) {
    srcBinding = await prisma.entityAccountBinding.findFirst({
      where: { entityType: srcRef.refType, entityId: srcRef.refId },
      include: { account: true },
    });
  }

  let tgtBinding = await prisma.entityAccountBinding.findFirst({
    where: { entityType: tgtEntityType, entityId: tgtRef.refId },
    include: { account: true },
  });
  if (!tgtBinding) {
    tgtBinding = await prisma.entityAccountBinding.findFirst({
      where: { entityType: tgtRef.refType, entityId: tgtRef.refId },
      include: { account: true },
    });
  }

  const srcAccountId = srcBinding?.accountId;
  const tgtAccountId = tgtBinding?.accountId;

  if (!srcAccountId || !tgtAccountId) {
    throw new Error(
      'Source and target must have advance accounts bound. Use Finance → Entity Accounts to bind advance accounts.'
    );
  }

  const refNum = `MRG-${op.id.slice(0, 8)}`;
  const desc = `Merge/Reallocation - ${op.reason} | Op ${op.id}`;
  const lines = [
    { accountId: tgtAccountId, debit: amount, credit: 0, description: desc },
    { accountId: srcAccountId, debit: 0, credit: amount, description: desc },
  ];

  const voucher = await VoucherService.createVoucher({
    type: 'JV',
    date: new Date(),
    paymentMethod: 'Transfer',
    accountId: srcAccountId,
    description: desc,
    referenceNumber: refNum,
    dealId: op.dealId ?? undefined,
    lines,
    preparedByUserId: userId,
  });

  await VoucherService.submitVoucher(voucher.id, userId);
  await VoucherService.approveVoucher(voucher.id, userId);
  await VoucherService.postVoucher(voucher.id, userId);

  const foEntityType = toEntityType(srcRef.refType);
  await writeFinanceOperationLedger(
    [
      {
        entityType: foEntityType as 'Deal' | 'Property',
        entityId: tgtRef.refId,
        accountId: tgtAccountId,
        amount,
        side: 'debit',
        sourceType: 'merge',
        operationId: op.id,
        voucherId: voucher.id,
        paymentId: paymentRef?.refId,
        description: desc,
      },
      {
        entityType: foEntityType as 'Deal' | 'Property',
        entityId: srcRef.refId,
        accountId: srcAccountId,
        amount,
        side: 'credit',
        sourceType: 'merge',
        operationId: op.id,
        voucherId: voucher.id,
        paymentId: paymentRef?.refId,
        description: desc,
      },
    ],
    prisma
  );

  const srcDeal = srcRef.refType === 'deal' ? await prisma.deal.findUnique({ where: { id: srcRef.refId }, select: { clientId: true, propertyId: true } }) : null;
  const tgtDeal = tgtRef.refType === 'deal' ? await prisma.deal.findUnique({ where: { id: tgtRef.refId }, select: { clientId: true, propertyId: true } }) : null;
  const srcPropId = srcRef.refType === 'property' ? srcRef.refId : srcDeal?.propertyId;
  const tgtPropId = tgtRef.refType === 'property' ? tgtRef.refId : tgtDeal?.propertyId;
  const clientId = srcDeal?.clientId ?? tgtDeal?.clientId;

  if (clientId) {
    await writeLedgerEntry({
      transactionUuid: op.id,
      entryDate: new Date(),
      accountId: srcAccountId,
      entityType: 'client',
      entityId: clientId,
      debitAmount: 0,
      creditAmount: amount,
      narration: desc,
      sourceType: 'merge',
      status: 'posted',
    });
    await writeLedgerEntry({
      transactionUuid: op.id,
      entryDate: new Date(),
      accountId: tgtAccountId,
      entityType: 'client',
      entityId: clientId,
      debitAmount: amount,
      creditAmount: 0,
      narration: desc,
      sourceType: 'merge',
      status: 'posted',
    });
  }
  if (srcPropId && tgtPropId) {
    await writeLedgerEntry({
      transactionUuid: op.id,
      entryDate: new Date(),
      accountId: srcAccountId,
      entityType: 'property',
      entityId: srcPropId,
      debitAmount: 0,
      creditAmount: amount,
      narration: desc,
      sourceType: 'merge',
      status: 'posted',
    });
    await writeLedgerEntry({
      transactionUuid: op.id,
      entryDate: new Date(),
      accountId: tgtAccountId,
      entityType: 'property',
      entityId: tgtPropId,
      debitAmount: amount,
      creditAmount: 0,
      narration: desc,
      sourceType: 'merge',
      status: 'posted',
    });
  }

  return voucher.id;
}

export async function listOperations(filters?: {
  status?: FinancialOperationStatus;
  operationType?: FinancialOperationType;
  dealId?: string;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.operationType) where.operationType = filters.operationType;
  if (filters?.dealId) where.dealId = filters.dealId;

  const [rows, total] = await Promise.all([
    prisma.financialOperation.findMany({
      where,
      include: {
        references: true,
        requestedBy: { select: { id: true, username: true } },
        approvedBy: { select: { id: true, username: true } },
        postedBy: { select: { id: true, username: true } },
        voucher: { select: { id: true, voucherNumber: true, type: true, amount: true, status: true } },
        deal: { select: { id: true, dealCode: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    }),
    prisma.financialOperation.count({ where }),
  ]);

  return { rows, total };
}

export async function getOperationById(id: string) {
  return prisma.financialOperation.findUnique({
    where: { id },
    include: {
      references: true,
      lines: true,
      requestedBy: { select: { id: true, username: true } },
      approvedBy: { select: { id: true, username: true } },
      postedBy: { select: { id: true, username: true } },
      voucher: true,
      deal: { select: { id: true, dealCode: true, title: true, clientId: true } },
    },
  });
}

export async function getOperationsByDealId(dealId: string) {
  return prisma.financialOperation.findMany({
    where: {
      OR: [{ dealId }, { references: { some: { refType: 'deal', refId: dealId } } }],
    },
    include: {
      references: true,
      requestedBy: { select: { id: true, username: true } },
      approvedBy: { select: { id: true, username: true } },
      postedBy: { select: { id: true, username: true } },
      voucher: { select: { id: true, voucherNumber: true, type: true, amount: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
