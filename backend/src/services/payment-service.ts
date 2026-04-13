/**
 * PaymentService - Business logic for Payment processing
 * Implements atomic transactions, double-entry bookkeeping, and refunds
 */

import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { DealService } from './deal-service';
import { PaymentPlanService } from './payment-plan-service';
import { generateSystemId, validateManualUniqueId } from './id-generation-service';
import { IdService } from '../utils/id-service';
import { TransactionIdentityEngine } from './transactionIdentity.service';

export interface CreatePaymentPayload {
  dealId: string;
  amount: number;
  paymentType: 'token' | 'booking' | 'installment' | 'partial' | 'full' | 'refund';
  paymentMode: 'cash' | 'bank' | 'online_transfer' | 'card';
  transactionId?: string;
  referenceNumber?: string;
  date?: Date;
  remarks?: string;
  paymentId?: string;
  createdBy: string;
  installmentId?: string; // Link to specific installment if provided
  // Extended payment mode metadata (optional)
  bankName?: string;
  chequeNumber?: string;
  clearingStatus?: 'PENDING' | 'CLEARED' | 'BOUNCED';
}

export interface RefundPaymentPayload {
  originalPaymentId: string;
  amount: number;
  reason?: string;
  createdBy: string;
}

export class PaymentService {
  /**
   * Generate payment code (deprecated - use generateSystemId('pay') instead)
   * Kept for backward compatibility
   */
  static generatePaymentCode(): string {
    // This is now deprecated but kept for any legacy code
    // New code should use generateSystemId('pay')
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const random = Math.floor(100 + Math.random() * 900);
    return `PAY-${dateStr}-${random}`;
  }

  /**
   * Get account IDs for payment mode (for double-entry)
   */
  static async getPaymentAccounts(paymentMode: string): Promise<{ debitAccountId: string; creditAccountId: string }> {
    // Lookup accounts by alias or code
    const cashAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { code: '1000' },
          { name: { contains: 'Cash', mode: 'insensitive' } },
        ],
        isActive: true,
      },
    });

    const bankAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { code: '1010' },
          { name: { contains: 'Bank', mode: 'insensitive' } },
        ],
        isActive: true,
      },
    });

    const arAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { code: '1100' },
          { name: { contains: 'Accounts Receivable', mode: 'insensitive' } },
        ],
        isActive: true,
      },
    });

    if (!cashAccount || !bankAccount || !arAccount) {
      throw new Error('Required accounts not found in Chart of Accounts. Please seed accounts first.');
    }

    const debitAccountId = paymentMode === 'cash' ? cashAccount.id : bankAccount.id;
    const creditAccountId = arAccount.id;

    return { debitAccountId, creditAccountId };
  }

  /**
   * Get TRUST debit account for payment mode (token/booking/security deposit)
   * Prioritizes accounts with trustFlag=true or codes starting with 1121
   */
  static async getTrustDebitAccount(paymentMode: string): Promise<string> {
    // Find trust cash/bank accounts
    const trustCash = await prisma.account.findFirst({
      where: {
        AND: [{ isActive: true }],
        OR: [
          { trustFlag: true, name: { contains: 'Cash', mode: 'insensitive' } },
          { code: { startsWith: '1121' }, name: { contains: 'Cash', mode: 'insensitive' } },
          { cashFlowCategory: 'Escrow' },
        ],
      },
      orderBy: { code: 'asc' },
    });

    const trustBank = await prisma.account.findFirst({
      where: {
        AND: [{ isActive: true }],
        OR: [
          { trustFlag: true, name: { contains: 'Bank', mode: 'insensitive' } },
          { code: { startsWith: '1121' }, name: { contains: 'Bank', mode: 'insensitive' } },
          { cashFlowCategory: 'Escrow' },
        ],
      },
      orderBy: { code: 'asc' },
    });

    const selected = paymentMode === 'cash' ? trustCash : trustBank;
    if (!selected) {
      throw new Error('Trust Cash/Bank account not found. Please create 1121xx trust accounts or mark trustFlag=true.');
    }
    return selected.id;
  }

  /**
   * Get liability account for client advances (trust/escrow payable)
   */
  static async getClientAdvanceLiabilityAccount(): Promise<string> {
    const advanceLiability = await prisma.account.findFirst({
      where: {
        AND: [{ isActive: true }, { type: 'Liability' }],
        OR: [
          { code: { startsWith: '211' } },
          { code: '211101' },
          { code: '211102' },
          { name: { contains: 'Advance', mode: 'insensitive' } },
          { name: { contains: 'Deposit', mode: 'insensitive' } },
          { name: { contains: 'Security', mode: 'insensitive' } },
        ],
      },
      orderBy: { code: 'asc' },
    });
    if (!advanceLiability) {
      throw new Error('Client Advances liability account not found. Please create a 2110xx advance payable account.');
    }
    return advanceLiability.id;
  }

  /**
   * Create payment with atomic transaction and double-entry bookkeeping
   */
  static async createPayment(payload: CreatePaymentPayload): Promise<any> {
    // Validate deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: {
        payments: {
          where: { deletedAt: null },
        },
      },
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.isDeleted || deal.deletedAt) {
      throw new Error('Cannot create payment for deleted deal');
    }

    // Inherit T-ID strictly from Deal → Client lineage. Never generate a new TID here.
    let tid = deal.tid;
    if (!tid) {
      // Fallback: try to inherit from the client directly
      if (deal.clientId) {
        const clientRecord = await prisma.client.findUnique({
          where: { id: deal.clientId },
          select: { tid: true },
        });
        tid = clientRecord?.tid ?? null;
      }
      if (!tid) {
        throw new Error(
          `Deal ${deal.id} has no TID and its client has no TID. ` +
          `Run the TID backfill migration before recording payments.`
        );
      }
    }

    // Validate amount
    if (payload.amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Determine if this is an advance (token/booking)
    const isAdvance = payload.paymentType === 'token' || payload.paymentType === 'booking';
    // Get debit account IDs for double-entry
    const debitAccountId = isAdvance
      ? await this.getTrustDebitAccount(payload.paymentMode === 'cash' ? 'cash' : 'bank')
      : (await this.getPaymentAccounts(payload.paymentMode)).debitAccountId;
    // Determine credit account based on payment type
    // Advances (token/booking) must credit Client Advances Payable (liability), not AR
    const creditAccountId = isAdvance
      ? await this.getClientAdvanceLiabilityAccount()
      : (await this.getPaymentAccounts(payload.paymentMode)).creditAccountId;

    const paymentDate = payload.date || new Date();
    const inheritedTid = tid;
    // Validate manual unique ID if provided
    const { manualUniqueId } = payload as any;
    if (manualUniqueId) {
      await validateManualUniqueId(manualUniqueId, 'pay');
    }

    // Generate system ID: PAYxxxx
    const paymentCode = payload.paymentId || await IdService.generateEntityId('PAY');

    // Atomic transaction
    const finalPaymentResult = await prisma.$transaction(async (tx) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          paymentId: paymentCode,
          tid,
          dealId: payload.dealId,
          amount: payload.amount,
          paymentType: payload.paymentType,
          paymentMode: payload.paymentMode,
          transactionId: payload.transactionId || null,
          referenceNumber: payload.referenceNumber || null,
          date: paymentDate,
          remarks: payload.remarks || null,
          createdByUserId: payload.createdBy,
          manualUniqueId: manualUniqueId?.trim() || null,
          bankName: payload.bankName || null,
          chequeNumber: payload.chequeNumber || null,
          clearingStatus: payload.clearingStatus || 'PENDING',
        },
      });

      // Create double-entry ledger entries
      const remarks = `${payload.paymentType} payment via ${payload.paymentMode}${payload.remarks ? ` - ${payload.remarks}` : ''}`;

      // Get account names for legacy compatibility
      const debitAccount = await tx.account.findUnique({ where: { id: debitAccountId } });
      const creditAccount = await tx.account.findUnique({ where: { id: creditAccountId } });

      // Validate journal lines before posting
      const journalLines = [
        { accountId: debitAccountId, debit: payload.amount, credit: 0 },
        { accountId: creditAccountId, debit: 0, credit: payload.amount },
      ];
      const { AccountValidationService } = await import('./account-validation-service');
      await AccountValidationService.validateJournalEntry(journalLines);

      // Debit: Cash/Bank (Operating) or Trust Cash/Bank (for advances)
      await tx.ledgerEntry.create({
        data: {
          dealId: payload.dealId,
          paymentId: payment.id,
          debitAccountId,
          creditAccountId: null,
          accountDebit: debitAccount?.name || '', // Legacy field
          accountCredit: '', // Legacy field
          amount: payload.amount,
          remarks: `Payment received: ${remarks}`,
          date: paymentDate,
        },
      });

      // Credit: Accounts Receivable OR Client Advances Payable (for token/booking)
      await tx.ledgerEntry.create({
        data: {
          dealId: payload.dealId,
          paymentId: payment.id,
          debitAccountId: null,
          creditAccountId,
          accountDebit: '', // Legacy field
          accountCredit: creditAccount?.name || '', // Legacy field
          amount: payload.amount,
          remarks: `Payment received: ${remarks}`,
          date: paymentDate,
        },
      });

      // CREATE UNIFIED LEDGER ENTRIES
      const tidForLedger = inheritedTid;
      const totalPaidAfterPayment = (deal.totalPaid || 0) + payload.amount;
      const outstandingAfterPayment = Math.max((deal.dealAmount || 0) - totalPaidAfterPayment, 0);

      // Client Ledger Record
      await tx.ledgerEntry.create({
        data: {
          dealId: deal.id,
          paymentId: payment.id,
          accountDebit: 'UNIFIED_CLIENT',
          accountCredit: 'UNIFIED_PAYMENT_RECEIVED',
          amount: payload.amount,
          remarks: `[TID:${tidForLedger}] [LEDGER:CLIENT] [TYPE:PAYMENT_RECEIVED] Outstanding:${outstandingAfterPayment} Payment for deal: ${deal.title}`,
          date: paymentDate,
        }
      });

      // Property Ledger Record
      if (deal.propertyId) {
        await tx.ledgerEntry.create({
          data: {
            dealId: deal.id,
            paymentId: payment.id,
            accountDebit: 'UNIFIED_PROPERTY',
            accountCredit: 'UNIFIED_PAYMENT_RECEIVED',
            amount: payload.amount,
            remarks: `[TID:${tidForLedger}] [LEDGER:PROPERTY] [TYPE:PAYMENT_RECEIVED] Outstanding:${outstandingAfterPayment} Payment received for property: ${deal.title}`,
            date: paymentDate,
          }
        });
      }

      // Dealer Ledger Record (Commission)
      if (deal.dealerId && deal.commissionAmount > 0) {
        // Calculate proportional commission if needed, or just record event
        await tx.ledgerEntry.create({
          data: {
            dealId: deal.id,
            paymentId: payment.id,
            accountDebit: 'UNIFIED_DEALER',
            accountCredit: 'UNIFIED_COMMISSION_RECORDED',
            amount: 0,
            remarks: `[TID:${tidForLedger}] [LEDGER:DEALER] [TYPE:COMMISSION_RECORDED] Outstanding:${deal.commissionAmount} Commission milestone for deal: ${deal.title}`,
            date: paymentDate,
          }
        });
      }

      // Recompute deal status
      await tx.deal.update({
        where: { id: payload.dealId },
        data: {
          totalPaid: totalPaidAfterPayment,
          updatedAt: new Date(),
        },
      });

      // Recompute deal status
      await DealService.recomputeDealStatus(payload.dealId, tx);

      // Sync payment plan if it exists (check if installmentId is in payload)
      // Note: installmentId should be passed in the payload for installment payments
      const installmentId = payload.installmentId;
      if (installmentId) {
        const { PaymentPlanService } = await import('./payment-plan-service');
        await PaymentPlanService.syncPaymentPlanAfterPayment(
          payload.dealId,
          payload.amount,
          installmentId,
          tx
        );
      } else {
        // Sync anyway to update totals
        const { PaymentPlanService } = await import('./payment-plan-service');
        await PaymentPlanService.syncPaymentPlanAfterPayment(payload.dealId, payload.amount, undefined, tx);
      }

      // Return payment with ledger entries
      const paymentResult = await tx.payment.findUnique({
        where: { id: payment.id },
        include: {
          deal: {
            include: {
              client: { select: { id: true, name: true, clientCode: true } },
              property: { select: { id: true, name: true, propertyCode: true } },
            },
          },
          ledgerEntries: true,
        },
      });

      return paymentResult;
    }).then(async (paymentResult) => {
      // After payment transaction completes, automatically create receipt
      // This ensures payment shows up in receipts list (like "Record Payment" does)
      try {
        const { ReceiptService } = await import('./receipt-service');
        const deal = await prisma.deal.findUnique({
          where: { id: payload.dealId },
          select: { clientId: true },
        });

        if (deal && deal.clientId && paymentResult) {
          // Determine payment method (Cash or Bank) from paymentMode
          // paymentMode is lowercase: 'cash' | 'bank' | 'online_transfer' | 'card'
          const paymentMethod = payload.paymentMode === 'cash'
            ? 'Cash'
            : 'Bank';

          // Create receipt with FIFO allocation to installments
          // Skip payment creation since payment already exists (avoid duplicate)
          await ReceiptService.createReceipt({
            dealId: payload.dealId,
            clientId: deal.clientId,
            amount: payload.amount,
            method: paymentMethod,
            date: paymentDate,
            notes: payload.remarks || `Payment ${paymentCode}`,
            receivedBy: payload.createdBy,
            existingPaymentId: paymentResult.id, // Link to existing payment
            skipPaymentCreation: true, // Don't create duplicate payment
            // Treat token/booking as advance: credit liability instead of AR
            isAdvance: isAdvance,
          });
        }
      } catch (receiptError: any) {
        // Log error but don't fail payment creation if receipt creation fails
        console.error('Failed to create receipt for payment:', receiptError);
        // Payment is still created successfully, receipt creation is optional
      }

      return paymentResult;
    });

    // Attach T-ID to Identity Engine Registry
    if (tid && finalPaymentResult) {
      await TransactionIdentityEngine.attachTid(tid, 'payment', finalPaymentResult.id, 'Finance');
    }

    return finalPaymentResult;
  }

  /**
   * Create refund payment (reverses original payment)
   */
  static async refundPayment(payload: RefundPaymentPayload): Promise<any> {
    const originalPayment = await prisma.payment.findUnique({
      where: { id: payload.originalPaymentId },
      include: {
        deal: true,
      },
    });

    if (!originalPayment) {
      throw new Error('Original payment not found');
    }

    if (originalPayment.deletedAt) {
      throw new Error('Cannot refund deleted payment');
    }

    if (payload.amount > originalPayment.amount) {
      throw new Error('Refund amount cannot exceed original payment amount');
    }

    // Determine original accounts from ledger to reverse accurately
    const originalLedgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        paymentId: originalPayment.id,
        deletedAt: null,
      },
    });
    const originalDebit = originalLedgerEntries.find((e) => !!e.debitAccountId);
    const originalCredit = originalLedgerEntries.find((e) => !!e.creditAccountId);
    if (!originalDebit || !originalCredit) {
      throw new Error('Original ledger accounts not found for refund reversal');
    }
    const debitAccountId = originalDebit.debitAccountId!;
    const creditAccountId = originalCredit.creditAccountId!;

    const refundDate = new Date();
    // Generate system ID for refund: pay-YY-####
    const refundCode = await generateSystemId('pay');

    return await prisma.$transaction(async (tx) => {
      // Create refund payment record
      const refund = await tx.payment.create({
        data: {
          paymentId: refundCode,
          dealId: originalPayment.dealId,
          amount: payload.amount,
          paymentType: 'refund',
          paymentMode: originalPayment.paymentMode,
          date: refundDate,
          remarks: `Refund of ${originalPayment.paymentId}: ${payload.reason || 'No reason provided'}`,
          refundOfPaymentId: originalPayment.id,
          createdByUserId: payload.createdBy,
        },
      });

      // Create reversed ledger entries (opposite of original)
      const remarks = `Refund of ${originalPayment.paymentId}: ${payload.reason || 'No reason provided'}`;

      // Get account names for legacy compatibility
      const debitAccount = await tx.account.findUnique({ where: { id: debitAccountId } });
      const creditAccount = await tx.account.findUnique({ where: { id: creditAccountId } });

      // Credit: Cash/Bank Account (opposite of original debit)
      await tx.ledgerEntry.create({
        data: {
          dealId: originalPayment.dealId,
          paymentId: refund.id,
          debitAccountId: null,
          creditAccountId: debitAccountId, // Reversed
          accountDebit: '', // Legacy field
          accountCredit: debitAccount?.name || '', // Legacy field
          amount: payload.amount,
          remarks: `Refund: ${remarks}`,
          date: refundDate,
        },
      });

      // Debit: Accounts Receivable (opposite of original credit)
      await tx.ledgerEntry.create({
        data: {
          dealId: originalPayment.dealId,
          paymentId: refund.id,
          debitAccountId: creditAccountId, // Reversed
          creditAccountId: null,
          accountDebit: creditAccount?.name || '', // Legacy field
          accountCredit: '', // Legacy field
          amount: payload.amount,
          remarks: `Refund: ${remarks}`,
          date: refundDate,
        },
      });

      // Recompute deal status
      await DealService.recomputeDealStatus(originalPayment.dealId, tx);

      // Sync payment plan (refund reduces paid amount)
      const { PaymentPlanService } = await import('./payment-plan-service');
      await PaymentPlanService.syncPaymentPlanAfterPayment(
        originalPayment.dealId,
        -payload.amount, // Negative amount for refund
        undefined,
        tx
      );

      return await tx.payment.findUnique({
        where: { id: refund.id },
        include: {
          deal: true,
          refundOf: true,
          ledgerEntries: true,
        },
      });
    });
  }

  /**
   * Update payment and sync payment plan
   */
  static async updatePayment(
    paymentId: string,
    updates: {
      amount?: number;
      paymentType?: string;
      paymentMode?: string;
      transactionId?: string;
      referenceNumber?: string;
      date?: Date;
      remarks?: string;
      installmentId?: string;
    }
  ): Promise<any> {
    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        deal: true,
        ledgerEntries: true,
      },
    });

    if (!existingPayment) {
      throw new Error('Payment not found');
    }

    if (existingPayment.deletedAt) {
      throw new Error('Cannot update deleted payment');
    }

    const oldAmount = existingPayment.amount;
    const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
    const amountDifference = newAmount - oldAmount;

    return await prisma.$transaction(async (tx) => {
      // Update payment
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          amount: updates.amount !== undefined ? updates.amount : undefined,
          paymentType: updates.paymentType || undefined,
          paymentMode: updates.paymentMode || undefined,
          transactionId: updates.transactionId !== undefined ? updates.transactionId : undefined,
          referenceNumber: updates.referenceNumber !== undefined ? updates.referenceNumber : undefined,
          date: updates.date || undefined,
          remarks: updates.remarks !== undefined ? updates.remarks : undefined,
          installmentId: updates.installmentId !== undefined ? updates.installmentId : undefined,
        },
      });

      // Update ledger entries if amount or date changed
      if (amountDifference !== 0 || updates.date) {
        for (const ledgerEntry of existingPayment.ledgerEntries) {
          if (!ledgerEntry.deletedAt) {
            await tx.ledgerEntry.update({
              where: { id: ledgerEntry.id },
              data: {
                amount: newAmount,
                date: updates.date || ledgerEntry.date,
                remarks: `Payment ${updatedPayment.paymentId} - ${updates.remarks || ledgerEntry.remarks || 'Updated'}`,
              },
            });
          }
        }
      }

      // Sync payment plan if amount changed
      if (amountDifference !== 0) {
        // First, reverse the old amount, then apply the new amount
        // We'll recalculate from scratch using syncPaymentPlanAfterPayment with the difference
        const { PaymentPlanService } = await import('./payment-plan-service');

        // If amount increased, add the difference
        // If amount decreased, subtract the difference (negative)
        await PaymentPlanService.syncPaymentPlanAfterPayment(
          existingPayment.dealId,
          amountDifference,
          updates.installmentId || existingPayment.installmentId || undefined,
          tx
        );
      }

      // Recompute deal status
      await DealService.recomputeDealStatus(existingPayment.dealId, tx);

      return await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          deal: {
            include: {
              client: { select: { id: true, name: true, clientCode: true } },
              property: { select: { id: true, name: true, propertyCode: true } },
            },
          },
          ledgerEntries: true,
        },
      });
    });
  }

  /**
   * Soft delete payment (creates reversal entries and moves to recycle bin)
   */
  static async deletePayment(paymentId: string, userId: string, userName?: string): Promise<void> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        deal: {
          include: {
            client: { select: { name: true } },
            property: { select: { name: true } },
          },
        },
        ledgerEntries: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.deletedAt) {
      throw new Error('Payment already deleted');
    }

    const paymentName = `Payment ${payment.paymentId} - ${payment.deal?.client?.name || 'Unknown'} - ${payment.deal?.property?.name || 'Unknown'}`;

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Soft delete payment
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          deletedAt: now,
          deletedBy: userId,
        },
      });

      // Soft delete associated ledger entries
      await tx.ledgerEntry.updateMany({
        where: { paymentId },
        data: {
          deletedAt: now,
          deletedBy: userId,
        },
      });

      // Add to recycle bin (separate transaction since it uses its own transaction)
      const expiresAt = new Date('2099-12-31T23:59:59.999Z');
      await tx.deletedRecord.create({
        data: {
          entityType: 'payment',
          entityId: paymentId,
          entityName: paymentName,
          entityData: payment as any,
          deletedBy: userId,
          deletedByName: userName,
          deletedAt: now,
          expiresAt,
        },
      });

      // Recompute deal status
      await DealService.recomputeDealStatus(payment.dealId, tx);

      // Sync payment plan (deletion reduces paid amount)
      const { PaymentPlanService: PaymentPlanServiceDelete } = await import('./payment-plan-service');
      await PaymentPlanServiceDelete.syncPaymentPlanAfterPayment(
        payment.dealId,
        -payment.amount, // Negative amount for deletion
        payment.installmentId || undefined,
        tx
      );
    });
  }
}

