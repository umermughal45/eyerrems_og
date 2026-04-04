/**
 * PaymentPlanService - Business logic for Payment Plans and Installments
 * Handles installment creation, AR ledger entries, and payment tracking
 */

import { Prisma } from '../prisma/client';
import prisma from '../prisma/client';
import { LedgerService } from './ledger-service';
import {
  calculatePaymentPlanSummary,
  calculateInstallmentSummary,
  calculateDealCompletionStatus,
  validatePaymentPlan,
  calculateInstallmentStatus,
} from '../utils/payment-plan-utils';

export type InstallmentType = 'monthly' | 'quarterly' | 'bi-annual' | 'annual' | 'custom' | 'milestone';

export interface CreatePaymentPlanPayload {
  dealId: string;
  clientId: string;
  numberOfInstallments: number;
  totalAmount: number;
  startDate: Date;
  installmentType?: InstallmentType; // Type of installment plan
  downPayment?: number; // Down payment amount (becomes first installment)
  installmentAmounts?: number[]; // Optional: custom amounts per installment (for custom type)
  dueDates?: Date[]; // Optional: custom due dates (for custom type)
  paymentModes?: string[]; // Optional: payment mode per installment
  notes?: string;
}

export interface UpdateInstallmentPayload {
  installmentId?: string; // Optional since it's passed as parameter
  amount?: number;
  dueDate?: Date;
  paymentMode?: string;
  notes?: string;
}

export class PaymentPlanService {
  /**
   * Generate installments based on installment type
   */
  private static generateInstallments(params: {
    installmentType: InstallmentType;
    downPayment: number;
    remainingAmount: number;
    numberOfInstallments: number;
    startDate: Date;
    customAmounts?: number[];
    customDueDates?: Date[];
  }): Array<{ installmentNumber: number; amount: number; dueDate: Date; notes?: string }> {
    const { installmentType, downPayment, remainingAmount, numberOfInstallments, startDate, customAmounts, customDueDates } = params;
    const installments: Array<{ installmentNumber: number; amount: number; dueDate: Date; notes?: string }> = [];

    // Add down payment as first installment if provided
    if (downPayment > 0) {
      installments.push({
        installmentNumber: 1,
        amount: downPayment,
        dueDate: new Date(startDate),
        notes: 'Down Payment',
      });
    }

    // Generate remaining installments based on type
    if (installmentType === 'custom') {
      // Custom installments - use provided amounts and dates
      if (!customAmounts || !customDueDates || customAmounts.length !== customDueDates.length) {
        throw new Error('Custom installments require equal number of amounts and due dates');
      }

      const startIndex = downPayment > 0 ? 1 : 0;
      for (let i = 0; i < customAmounts.length; i++) {
        installments.push({
          installmentNumber: startIndex + i + 1,
          amount: customAmounts[i],
          dueDate: customDueDates[i],
        });
      }
    } else {
      // Auto-generate installments based on type
      const monthsPerInstallment = this.getMonthsPerInstallment(installmentType);
      const remainingInstallments = numberOfInstallments - (downPayment > 0 ? 1 : 0);

      if (remainingInstallments <= 0) {
        throw new Error('Number of installments must be greater than 0 (or 1 if down payment is provided)');
      }

      // Calculate installment amount (with rounding adjustment on last)
      const baseAmount = remainingAmount / remainingInstallments;
      let totalAllocated = 0;

      for (let i = 0; i < remainingInstallments; i++) {
        const isLast = i === remainingInstallments - 1;
        const amount = isLast
          ? Math.round((remainingAmount - totalAllocated) * 100) / 100 // Round last to account for precision
          : Math.round(baseAmount * 100) / 100;

        totalAllocated += amount;

        // Calculate due date
        const dueDate = new Date(startDate);
        if (downPayment > 0) {
          // If down payment exists, first regular installment starts after the period
          dueDate.setMonth(dueDate.getMonth() + (i + 1) * monthsPerInstallment);
        } else {
          // If no down payment, first installment is at start date
          dueDate.setMonth(dueDate.getMonth() + i * monthsPerInstallment);
        }

        installments.push({
          installmentNumber: (downPayment > 0 ? 2 : 1) + i,
          amount,
          dueDate,
        });
      }
    }

    return installments;
  }

  /**
   * Get months per installment based on type
   */
  private static getMonthsPerInstallment(type: InstallmentType): number {
    switch (type) {
      case 'monthly':
        return 1;
      case 'quarterly':
        return 3;
      case 'bi-annual':
        return 6;
      case 'annual':
        return 12;
      case 'milestone':
        return 1; // Default to monthly for milestone (can be customized later)
      default:
        return 1;
    }
  }

  /**
   * Get account IDs for financial operations
   */
  private static async getAccounts(): Promise<{
    arAccountId: string;
    cashAccountId: string;
    bankAccountId: string;
  }> {
    const [arAccount, cashAccount, bankAccount] = await Promise.all([
      prisma.account.findFirst({
        where: {
          OR: [{ code: '1100' }, { name: { contains: 'Accounts Receivable', mode: 'insensitive' } }],
          isActive: true,
        },
      }),
      prisma.account.findFirst({
        where: {
          OR: [{ code: '1000' }, { name: { contains: 'Cash', mode: 'insensitive' } }],
          isActive: true,
        },
      }),
      prisma.account.findFirst({
        where: {
          OR: [{ code: '1010' }, { name: { contains: 'Bank', mode: 'insensitive' } }],
          isActive: true,
        },
      }),
    ]);

    if (!arAccount || !cashAccount || !bankAccount) {
      throw new Error('Required accounts not found in Chart of Accounts. Please seed accounts first.');
    }

    return {
      arAccountId: arAccount.id,
      cashAccountId: cashAccount.id,
      bankAccountId: bankAccount.id,
    };
  }

  /**
   * Create a payment plan with installments and AR ledger entries
   */
  static async createPaymentPlan(payload: CreatePaymentPlanPayload): Promise<any> {
    // Validate deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: { client: true },
    });

    if (!deal) {
      throw new Error('Deal not found');
    }

    if (deal.isDeleted || deal.deletedAt) {
      throw new Error('Cannot create payment plan for deleted deal');
    }

    // Validate client matches deal
    if (deal.clientId !== payload.clientId) {
      throw new Error('Client ID does not match deal client');
    }

    // Check if payment plan already exists
    const existingPlan = await prisma.paymentPlan.findUnique({
      where: { dealId: payload.dealId },
    });

    if (existingPlan) {
      throw new Error('Payment plan already exists for this deal');
    }

    // Validate payment plan data using utility
    const validation = validatePaymentPlan({
      numberOfInstallments: payload.numberOfInstallments,
      totalAmount: payload.totalAmount,
      installmentAmounts: payload.installmentAmounts,
      dueDates: payload.dueDates,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid payment plan data');
    }

    // Validate down payment
    const downPayment = payload.downPayment || 0;
    if (downPayment < 0 || downPayment > payload.totalAmount) {
      throw new Error('Down payment must be between 0 and total amount');
    }

    const remainingAmount = payload.totalAmount - downPayment;
    if (remainingAmount < 0) {
      throw new Error('Down payment cannot exceed total amount');
    }

    // Generate installments based on type
    const installmentType = payload.installmentType || 'monthly';
    const installmentsData = this.generateInstallments({
      installmentType,
      downPayment,
      remainingAmount,
      numberOfInstallments: payload.numberOfInstallments,
      startDate: payload.startDate,
      customAmounts: payload.installmentAmounts,
      customDueDates: payload.dueDates,
    });

    // Validate total equals deal amount
    const totalInstallments = installmentsData.reduce((sum: number, inst: { amount: number }) => sum + inst.amount, 0);
    if (Math.abs(totalInstallments - payload.totalAmount) > 0.01) {
      throw new Error(`Total installments (${totalInstallments}) must equal deal amount (${payload.totalAmount})`);
    }

    // Get accounts
    const accounts = await this.getAccounts();

    return await prisma.$transaction(async (tx) => {
      // Create payment plan
      const paymentPlan = await tx.paymentPlan.create({
        data: {
          dealId: payload.dealId,
          clientId: payload.clientId,
          numberOfInstallments: installmentsData.length,
          totalAmount: payload.totalAmount,
          startDate: payload.startDate,
          notes: payload.notes,
          installmentType: installmentType,
          downPayment: downPayment,
        },
      });

      // Create installments from generated data
      const installments = [];
      for (let i = 0; i < installmentsData.length; i++) {
        const instData = installmentsData[i];
        const paymentMode = payload.paymentModes?.[i] || null;
        const notes = instData.notes || payload.notes || null;

        // Create installment (AR entries will be created when deal is closed)
        const installment = await tx.dealInstallment.create({
          data: {
            paymentPlanId: paymentPlan.id,
            dealId: payload.dealId,
            clientId: payload.clientId,
            installmentNumber: instData.installmentNumber,
            amount: Math.round(instData.amount * 100) / 100,
            dueDate: instData.dueDate,
            paymentMode,
            notes,
            status: 'unpaid',
          },
        });

        installments.push(installment);
      }

      // If deal is already closed, create AR entries for installments
      if (deal.status === 'closed' || deal.stage === 'closed-won') {
        const { DealFinanceService } = await import('./deal-finance-service');
        const breakdown = (deal.valueBreakdown as any) || {};
        const commissionConfig = {
          type: breakdown.commissionType || (deal.commissionRate > 0 ? 'percentage' : 'none'),
          rate: breakdown.commissionRate || deal.commissionRate || 0,
          dealerShare: breakdown.dealerShare || 100,
          companyShare: breakdown.companyShare || 0,
        };

        // Create AR entries for each installment
        for (const installment of installments) {
          await LedgerService.createLedgerEntry(
            {
              dealId: payload.dealId,
              creditAccountId: accounts.arAccountId,
              amount: installment.amount,
              remarks: `Installment ${installment.installmentNumber} - Due ${installment.dueDate.toISOString().split('T')[0]}`,
              date: installment.dueDate,
            },
            tx
          );
        }
      }

      return {
        ...paymentPlan,
        installments,
      };
    });
  }

  /**
   * Update an installment (before payment is received)
   */
  static async updateInstallment(
    installmentId: string,
    payload: UpdateInstallmentPayload
  ): Promise<any> {
    const installment = await prisma.dealInstallment.findUnique({
      where: { id: installmentId },
      include: { ledgerEntry: true },
    });

    if (!installment) {
      throw new Error('Installment not found');
    }

    if (installment.status === 'paid') {
      throw new Error('Cannot update paid installment');
    }

    if (installment.isDeleted) {
      throw new Error('Cannot update deleted installment');
    }

    return await prisma.$transaction(async (tx) => {
      // Update installment
      const updated = await tx.dealInstallment.update({
        where: { id: installmentId },
        data: {
          amount: payload.amount !== undefined ? payload.amount : installment.amount,
          dueDate: payload.dueDate !== undefined ? payload.dueDate : installment.dueDate,
          paymentMode: payload.paymentMode !== undefined ? payload.paymentMode : installment.paymentMode,
          notes: payload.notes !== undefined ? payload.notes : installment.notes,
        },
      });

      // Update ledger entry if amount or date changed
      if (installment.ledgerEntryId && (payload.amount !== undefined || payload.dueDate !== undefined)) {
        await tx.ledgerEntry.update({
          where: { id: installment.ledgerEntryId },
          data: {
            amount: payload.amount !== undefined ? payload.amount : installment.amount,
            date: payload.dueDate !== undefined ? payload.dueDate : installment.dueDate,
            remarks: `Installment ${installment.installmentNumber} - Due ${updated.dueDate.toISOString().split('T')[0]}`,
          },
        });
      }

      return updated;
    });
  }

  /**
   * Record payment against an installment
   */
  static async recordInstallmentPayment(
    installmentId: string,
    paymentAmount: number,
    paymentMode: string,
    paymentDate: Date,
    paymentId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    const prismaClient = tx || prisma;

    const installment = await prismaClient.dealInstallment.findUnique({
      where: { id: installmentId },
      include: {
        deal: true,
        ledgerEntry: true,
      },
    });

    if (!installment) {
      throw new Error('Installment not found');
    }

    if (installment.isDeleted) {
      throw new Error('Cannot record payment for deleted installment');
    }

    const accounts = await this.getAccounts();

    // If already in a transaction, use the client directly, otherwise start a new transaction
    if (tx) {
      // Already in transaction, use the client directly
      return await this.recordInstallmentPaymentInTransaction(installmentId, paymentAmount, paymentMode, paymentDate, paymentId, prismaClient, accounts, installment);
    } else {
      // Start new transaction
      return await prisma.$transaction(async (client: Prisma.TransactionClient) => {
        return await this.recordInstallmentPaymentInTransaction(installmentId, paymentAmount, paymentMode, paymentDate, paymentId, client, accounts, installment);
      });
    }
  }

  /**
   * Internal method to record payment in transaction
   */
  private static async recordInstallmentPaymentInTransaction(
    installmentId: string,
    paymentAmount: number,
    paymentMode: string,
    paymentDate: Date,
    paymentId: string | undefined,
    client: Prisma.TransactionClient,
    accounts: { arAccountId: string; cashAccountId: string; bankAccountId: string },
    installment: any
  ): Promise<any> {
    // Calculate remaining amount
    const remainingAmount = installment.amount - installment.paidAmount;
    const paymentToApply = Math.min(paymentAmount, remainingAmount);

    // Determine payment account
    const paymentAccountId =
      paymentMode === 'cash' ? accounts.cashAccountId : accounts.bankAccountId;

    // Create payment record if paymentId provided
    let paymentRecord = null;
    if (paymentId) {
      paymentRecord = await client.payment.findUnique({
        where: { id: paymentId },
      });
    }

    // Update installment
    const newPaidAmount = installment.paidAmount + paymentToApply;
    const newStatus =
      newPaidAmount >= installment.amount
        ? 'paid'
        : newPaidAmount > 0
          ? 'partial'
          : 'unpaid';

    const updatedInstallment = await client.dealInstallment.update({
      where: { id: installmentId },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        paidDate: newStatus === 'paid' ? paymentDate : installment.paidDate,
      },
    });

    // Create ledger entries for payment
    // Debit: Cash/Bank
    await LedgerService.createLedgerEntry(
      {
        dealId: installment.dealId,
        paymentId: paymentRecord?.id,
        debitAccountId: paymentAccountId,
        amount: paymentToApply,
        remarks: `Payment for installment ${installment.installmentNumber}`,
        date: paymentDate,
      },
      client
    );

    // Credit: Accounts Receivable (reducing AR balance)
    await LedgerService.createLedgerEntry(
      {
        dealId: installment.dealId,
        paymentId: paymentRecord?.id,
        creditAccountId: accounts.arAccountId,
        amount: paymentToApply,
        remarks: `Payment received for installment ${installment.installmentNumber}`,
        date: paymentDate,
      },
      client
    );

    // If deal is closed, recognize revenue
    if (installment.deal.status === 'closed' || installment.deal.stage === 'closed-won') {
      // Revenue recognition is handled by DealFinanceService
      // We just need to ensure the payment is recorded
    }

    // Sync payment plan after payment
    await PaymentPlanService.syncPaymentPlanAfterPayment(
      installment.dealId,
      paymentToApply,
      installmentId,
      client
    );

    return updatedInstallment;
  }

  /**
   * Get payment plan for a deal
   */
  static async getPaymentPlanByDealId(dealId: string): Promise<any> {
    return await prisma.paymentPlan.findUnique({
      where: { dealId },
      include: {
        installments: {
          where: { isDeleted: false },
          orderBy: { installmentNumber: 'asc' },
        },
        deal: {
          include: {
            client: true,
          },
        },
      },
    });
  }

  /**
   * Get installment summary using utility functions
   */
  static async getInstallmentSummary(dealId: string): Promise<any> {
    const plan = await this.getPaymentPlanByDealId(dealId);

    if (!plan) {
      return {
        totalInstallments: 0,
        paidInstallments: 0,
        unpaidInstallments: 0,
        overdueInstallments: 0,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
      };
    }

    return calculateInstallmentSummary(plan.installments);
  }

  /**
   * Smart Payment Allocation
   * Automatically allocates payment across installments in order
   */
  static async smartAllocatePayment(
    dealId: string,
    paymentAmount: number,
    paymentMode: string,
    paymentDate: Date,
    createdBy: string,
    tx?: Prisma.TransactionClient
  ): Promise<{
    paymentApplied: number;
    excessIgnored: number;
    updatedInstallments: any[];
    summary: {
      totalAmount: number;
      paidAmount: number;
      remainingAmount: number;
      progress: number;
    };
    dealClosed: boolean;
  }> {
    const executeAllocation = async (actualClient: Prisma.TransactionClient) => {

      // Get deal and payment plan
      const deal = await actualClient.deal.findUnique({
        where: { id: dealId },
        include: {
          paymentPlan: {
            include: {
              installments: {
                where: { isDeleted: false },
                orderBy: { installmentNumber: 'asc' },
              },
            },
          },
        },
      });

      if (!deal) {
        throw new Error('Deal not found');
      }

      if (!deal.paymentPlan) {
        throw new Error('Payment plan not found for this deal');
      }

      const installments = deal.paymentPlan.installments;
      if (installments.length === 0) {
        throw new Error('No installments found in payment plan');
      }

      // Calculate total remaining amount
      const totalRemaining = installments.reduce(
        (sum, inst) => sum + (inst.amount - (inst.paidAmount || 0)),
        0
      );

      // Determine actual payment to apply (prevent over-payment)
      const paymentToApply = Math.min(paymentAmount, totalRemaining);
      const excessIgnored = Math.max(0, paymentAmount - totalRemaining);

      // Get accounts for ledger entries
      const accounts = await this.getAccounts();
      const paymentAccountId =
        paymentMode === 'cash' ? accounts.cashAccountId : accounts.bankAccountId;

      // Generate payment code
      const { PaymentService } = await import('./payment-service');
      const paymentCode = PaymentService.generatePaymentCode();

      // Create payment record
      const payment = await actualClient.payment.create({
        data: {
          paymentId: paymentCode,
          dealId: dealId,
          amount: paymentToApply,
          paymentType: 'installment',
          paymentMode: paymentMode as any,
          date: paymentDate,
          remarks: `Smart allocation payment - ${paymentToApply > 0 ? `Applied: ${paymentToApply}` : ''}${excessIgnored > 0 ? ` | Excess ignored: ${excessIgnored}` : ''}`,
          createdByUserId: createdBy,
        },
      });

      // Smart allocation logic: prioritize downpayment first, then regular installments
      let remainingPayment = paymentToApply;
      const updatedInstallments: any[] = [];

      // Separate downpayment and regular installments
      const downPaymentInstallment = installments.find((inst) => inst.type === 'down_payment');
      const regularInstallments = installments.filter((inst) => inst.type !== 'down_payment');

      // Process downpayment first if it exists and is not fully paid
      if (downPaymentInstallment && remainingPayment > 0) {
        const installmentRemaining = downPaymentInstallment.amount - (downPaymentInstallment.paidAmount || 0);

        if (installmentRemaining > 0) {
          const paymentForThisInstallment = Math.min(remainingPayment, installmentRemaining);
          const newPaidAmount = (downPaymentInstallment.paidAmount || 0) + paymentForThisInstallment;
          const newRemaining = downPaymentInstallment.amount - newPaidAmount;

          // Determine status using utility function
          const { calculateInstallmentStatus } = await import('../utils/payment-plan-utils');
          const status = calculateInstallmentStatus(
            downPaymentInstallment.amount,
            newPaidAmount,
            downPaymentInstallment.dueDate
          );

          // Update installment
          const updated = await actualClient.dealInstallment.update({
            where: { id: downPaymentInstallment.id },
            data: {
              paidAmount: newPaidAmount,
              status,
              paidDate: status === 'paid' ? paymentDate : downPaymentInstallment.paidDate,
            },
          });

          updatedInstallments.push({
            id: updated.id,
            installmentNumber: updated.installmentNumber,
            amount: updated.amount,
            paidAmount: updated.paidAmount,
            remaining: newRemaining,
            status: updated.status,
          });

          // Create ledger entries for this installment payment
          if (paymentForThisInstallment > 0) {
            // Debit: Cash/Bank
            await LedgerService.createLedgerEntry(
              {
                dealId: dealId,
                paymentId: payment.id,
                debitAccountId: paymentAccountId,
                amount: paymentForThisInstallment,
                remarks: `Payment for down payment`,
                date: paymentDate,
              },
              actualClient
            );

            // Credit: Accounts Receivable
            await LedgerService.createLedgerEntry(
              {
                dealId: dealId,
                paymentId: payment.id,
                creditAccountId: accounts.arAccountId,
                amount: paymentForThisInstallment,
                remarks: `Payment received for down payment`,
                date: paymentDate,
              },
              actualClient
            );
          }

          remainingPayment -= paymentForThisInstallment;
        }
      }

      // Then process regular installments in order
      for (const installment of regularInstallments) {
        if (remainingPayment <= 0) break;

        const installmentRemaining = installment.amount - (installment.paidAmount || 0);

        if (installmentRemaining <= 0) {
          // Already fully paid, skip
          continue;
        }

        const paymentForThisInstallment = Math.min(remainingPayment, installmentRemaining);
        const newPaidAmount = (installment.paidAmount || 0) + paymentForThisInstallment;
        const newRemaining = installment.amount - newPaidAmount;

        // Determine status using utility function
        const { calculateInstallmentStatus } = await import('../utils/payment-plan-utils');
        const status = calculateInstallmentStatus(
          installment.amount,
          newPaidAmount,
          installment.dueDate
        );

        // Update installment
        const updated = await actualClient.dealInstallment.update({
          where: { id: installment.id },
          data: {
            paidAmount: newPaidAmount,
            status,
            paidDate: status === 'paid' ? paymentDate : installment.paidDate,
          },
        });

        updatedInstallments.push({
          id: updated.id,
          installmentNumber: updated.installmentNumber,
          amount: updated.amount,
          paidAmount: updated.paidAmount,
          remaining: newRemaining,
          status: updated.status,
        });

        // Create ledger entries for this installment payment
        if (paymentForThisInstallment > 0) {
          // Debit: Cash/Bank
          await LedgerService.createLedgerEntry(
            {
              dealId: dealId,
              paymentId: payment.id,
              debitAccountId: paymentAccountId,
              amount: paymentForThisInstallment,
              remarks: `Payment for installment ${installment.installmentNumber}`,
              date: paymentDate,
            },
            actualClient
          );

          // Credit: Accounts Receivable
          await LedgerService.createLedgerEntry(
            {
              dealId: dealId,
              paymentId: payment.id,
              creditAccountId: accounts.arAccountId,
              amount: paymentForThisInstallment,
              remarks: `Payment received for installment ${installment.installmentNumber}`,
              date: paymentDate,
            },
            actualClient
          );
        }

        remainingPayment -= paymentForThisInstallment;
      }

      // Recalculate summary
      const allInstallments = await actualClient.dealInstallment.findMany({
        where: {
          paymentPlanId: deal.paymentPlan.id,
          isDeleted: false,
        },
      });

      const totalAmount = deal.dealAmount || 0;
      const paidAmount = allInstallments.reduce((sum, inst) => sum + (inst.paidAmount || 0), 0);
      const remainingAmount = Math.max(0, totalAmount - paidAmount);
      const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

      // Note: Deal model no longer has totalPaid field
      // Total paid is calculated from payments when needed

      // Auto-close deal if fully paid
      let dealClosed = false;
      if (remainingAmount <= 0.01) {
        await actualClient.deal.update({
          where: { id: dealId },
          data: {
            status: 'closed',
            stage: 'closed-won',
          },
        });
        dealClosed = true;

        // Trigger revenue recognition if needed
        // This can be extended later
      }

      return {
        paymentApplied: paymentToApply,
        excessIgnored,
        updatedInstallments,
        summary: {
          totalAmount,
          paidAmount,
          remainingAmount,
          progress: Math.round(progress * 100) / 100,
        },
        dealClosed,
      };
    };

    if (tx) {
      return await executeAllocation(tx);
    } else {
      return await prisma.$transaction(async (client: Prisma.TransactionClient) => {
        return await executeAllocation(client);
      });
    }
  }

  /**
   * Sync payment plan after payment is recorded
   * Updates installments, recalculates totals, and checks completion
   */
  static async syncPaymentPlanAfterPayment(
    dealId: string,
    paymentAmount: number,
    installmentId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<any> {
    const prismaClient = tx || prisma;

    try {
      const plan = await prismaClient.paymentPlan.findUnique({
        where: { dealId },
        include: {
          installments: {
            where: { isDeleted: false },
            orderBy: { installmentNumber: 'asc' },
          },
        },
      });

      if (!plan) {
        return null; // No payment plan exists
      }

      // If installmentId is provided, update that specific installment
      if (installmentId) {
        const installment = plan.installments.find((inst) => inst.id === installmentId);
        if (installment) {
          const newPaidAmount = Math.max(0, (installment.paidAmount || 0) + paymentAmount);
          const status = calculateInstallmentStatus(
            installment.amount,
            newPaidAmount,
            installment.dueDate
          );

          await prismaClient.dealInstallment.update({
            where: { id: installmentId },
            data: {
              paidAmount: newPaidAmount,
              status,
              paidDate: status === 'paid' ? new Date() : (newPaidAmount === 0 ? null : installment.paidDate),
            },
          });
        }
      } else if (paymentAmount > 0) {
        // Auto-allocate payment: prioritize downpayment first, then installments in order
        let remainingPayment = paymentAmount;
        const paymentDate = new Date();

        // First, find and allocate to downpayment if it exists and is not fully paid
        const downPaymentInstallment = plan.installments.find(
          (inst) => inst.type === 'down_payment'
        );

        if (downPaymentInstallment && remainingPayment > 0) {
          const downPaymentRemaining = downPaymentInstallment.amount - (downPaymentInstallment.paidAmount || 0);
          if (downPaymentRemaining > 0) {
            const paymentForDownPayment = Math.min(remainingPayment, downPaymentRemaining);
            const newPaidAmount = (downPaymentInstallment.paidAmount || 0) + paymentForDownPayment;
            const status = calculateInstallmentStatus(
              downPaymentInstallment.amount,
              newPaidAmount,
              downPaymentInstallment.dueDate
            );

            await prismaClient.dealInstallment.update({
              where: { id: downPaymentInstallment.id },
              data: {
                paidAmount: newPaidAmount,
                status,
                paidDate: status === 'paid' ? paymentDate : (downPaymentInstallment.paidDate || null),
              },
            });

            remainingPayment -= paymentForDownPayment;
          }
        }

        // Then allocate remaining payment to regular installments in order (excluding downpayment)
        if (remainingPayment > 0) {
          const regularInstallments = plan.installments
            .filter((inst) => inst.type !== 'down_payment')
            .sort((a, b) => a.installmentNumber - b.installmentNumber);

          for (const installment of regularInstallments) {
            if (remainingPayment <= 0) break;

            const installmentRemaining = installment.amount - (installment.paidAmount || 0);
            if (installmentRemaining <= 0) continue; // Skip if already fully paid

            const paymentForThisInstallment = Math.min(remainingPayment, installmentRemaining);
            const newPaidAmount = (installment.paidAmount || 0) + paymentForThisInstallment;
            const status = calculateInstallmentStatus(
              installment.amount,
              newPaidAmount,
              installment.dueDate
            );

            await prismaClient.dealInstallment.update({
              where: { id: installment.id },
              data: {
                paidAmount: newPaidAmount,
                status,
                paidDate: status === 'paid' ? paymentDate : (installment.paidDate || null),
              },
            });

            remainingPayment -= paymentForThisInstallment;
          }
        }
      } else if (paymentAmount < 0) {
        // When deleting a payment (negative amount), we need to recalculate all installments
        // Find all installments that might have been affected by this payment
        // This happens when payment was allocated via FIFO or other methods
        // We'll recalculate all installments from scratch based on remaining payments
        const allPayments = await prismaClient.payment.findMany({
          where: {
            dealId,
            deletedAt: null,
            installmentId: { not: null },
          },
          select: {
            installmentId: true,
            amount: true,
          },
        });

        // Group payments by installment
        const installmentPayments: Record<string, number> = {};
        allPayments.forEach((p) => {
          if (p.installmentId) {
            installmentPayments[p.installmentId] = (installmentPayments[p.installmentId] || 0) + (p.amount || 0);
          }
        });

        // Also check receipt allocations
        const receipts = await prismaClient.dealReceipt.findMany({
          where: {
            dealId,
          },
          include: {
            allocations: true,
          },
        });

        receipts.forEach((receipt) => {
          receipt.allocations.forEach((alloc) => {
            installmentPayments[alloc.installmentId] = (installmentPayments[alloc.installmentId] || 0) + (alloc.amountAllocated || 0);
          });
        });

        // Update all installments based on recalculated payments
        for (const installment of plan.installments) {
          const totalPaidForInstallment = installmentPayments[installment.id] || 0;
          const status = calculateInstallmentStatus(
            installment.amount,
            totalPaidForInstallment,
            installment.dueDate
          );

          await prismaClient.dealInstallment.update({
            where: { id: installment.id },
            data: {
              paidAmount: totalPaidForInstallment,
              status,
              paidDate: status === 'paid' ? (installment.paidDate || new Date()) : (totalPaidForInstallment === 0 ? null : installment.paidDate),
            },
          });
        }
      }

      // Recalculate payment plan summary
      const updatedPlan = await prismaClient.paymentPlan.findUnique({
        where: { dealId },
        include: {
          installments: {
            where: { isDeleted: false },
            orderBy: { installmentNumber: 'asc' },
          },
        },
      });

      if (!updatedPlan) return null;

      const summary = calculatePaymentPlanSummary(updatedPlan.installments);

      // Update payment plan with new totals
      const syncedPlan = await prismaClient.paymentPlan.update({
        where: { dealId },
        data: {
          totalExpected: summary.totalExpected,
          totalPaid: summary.totalPaid,
          remaining: summary.remaining,
          status: summary.status,
        },
      });

      // Check if deal should be marked as completed
      const deal = await prismaClient.deal.findUnique({
        where: { id: dealId },
      });

      if (deal) {
        const completionStatus = calculateDealCompletionStatus(deal.dealAmount, summary.totalPaid);
        if (completionStatus.isCompleted && deal.status !== 'closed' && deal.stage !== 'closed-won') {
          await prismaClient.deal.update({
            where: { id: dealId },
            data: {
              status: 'closed',
              stage: 'closed-won',
              actualClosingDate: deal.actualClosingDate || new Date(),
            },
          });
        }
      }

      return {
        ...syncedPlan,
        installments: updatedPlan.installments,
        summary,
      };
    } catch (error) {
      console.error('Error syncing payment plan:', error);
      throw error;
    }
  }

  /**
   * Recalculate payment plan totals (useful after installment updates)
   */
  static async recalculatePaymentPlan(dealId: string, tx?: Prisma.TransactionClient): Promise<any> {
    const prismaClient = tx || prisma;

    try {
      const plan = await prismaClient.paymentPlan.findUnique({
        where: { dealId },
        include: {
          installments: {
            where: { isDeleted: false },
            orderBy: { installmentNumber: 'asc' },
          },
        },
      });

      if (!plan) {
        return null;
      }

      // Recalculate all installment statuses based on current paid amounts
      for (const installment of plan.installments) {
        const status = calculateInstallmentStatus(
          installment.amount,
          installment.paidAmount,
          installment.dueDate
        );

        await prismaClient.dealInstallment.update({
          where: { id: installment.id },
          data: {
            status,
            paidDate: status === 'paid' && !installment.paidDate ? new Date() : installment.paidDate,
          },
        });
      }

      // Get updated installments
      const updatedPlan = await prismaClient.paymentPlan.findUnique({
        where: { dealId },
        include: {
          installments: {
            where: { isDeleted: false },
            orderBy: { installmentNumber: 'asc' },
          },
        },
      });

      if (!updatedPlan) return null;

      const summary = calculatePaymentPlanSummary(updatedPlan.installments);

      // Update payment plan
      const recalculatedPlan = await prismaClient.paymentPlan.update({
        where: { dealId },
        data: {
          totalExpected: summary.totalExpected,
          totalPaid: summary.totalPaid,
          remaining: summary.remaining,
          status: summary.status,
        },
      });

      return {
        ...recalculatedPlan,
        installments: updatedPlan.installments,
        summary,
      };
    } catch (error) {
      console.error('Error recalculating payment plan:', error);
      throw error;
    }
  }
}

