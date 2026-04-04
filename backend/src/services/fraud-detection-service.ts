
import prisma from '../prisma/client';

export interface RedFlag {
  type: 'Duplicate Payment' | 'Round Amount' | 'Weekend Posting' | 'Manual Control Account Entry' | 'High Value';
  severity: 'Low' | 'Medium' | 'High';
  description: string;
  transactionId: string;
  date: Date;
  amount: number;
  details?: any;
}

export class FraudDetectionService {
  /**
   * Detect potential duplicate payments
   * Same amount, same client, within 24 hours
   */
  static async detectDuplicatePayments(startDate?: Date, endDate?: Date): Promise<RedFlag[]> {
    const where: any = {
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        deal: {
          include: {
            client: true,
          },
        },
      },
    });

    const redFlags: RedFlag[] = [];

    for (let i = 0; i < payments.length; i++) {
      const current = payments[i];
      
      // Look ahead for duplicates
      for (let j = i + 1; j < payments.length; j++) {
        const next = payments[j];
        
        // Stop if date difference is > 24 hours
        if (next.date.getTime() - current.date.getTime() > 24 * 60 * 60 * 1000) {
          break;
        }

        if (
          current.amount === next.amount &&
          current.dealId === next.dealId &&
          current.paymentMode === next.paymentMode
        ) {
          redFlags.push({
            type: 'Duplicate Payment',
            severity: 'High',
            description: `Potential duplicate payment of ${current.amount} for client ${current.deal?.client?.name}`,
            transactionId: next.id,
            date: next.date,
            amount: next.amount,
            details: {
              originalPaymentId: current.id,
              originalDate: current.date,
            },
          });
        }
      }
    }

    return redFlags;
  }

  /**
   * Detect round amount transactions (e.g., 1000.00, 5000.00)
   * Often used in fabricated transactions
   */
  static async detectRoundAmounts(startDate?: Date, endDate?: Date, threshold: number = 1000): Promise<RedFlag[]> {
    const where: any = {
      deletedAt: null,
      amount: { gte: threshold },
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    const redFlags: RedFlag[] = [];

    for (const entry of entries) {
      if (entry.amount % 100 === 0) { // Multiples of 100
        redFlags.push({
          type: 'Round Amount',
          severity: 'Medium',
          description: `Round amount transaction detected: ${entry.amount}`,
          transactionId: entry.id,
          date: entry.date,
          amount: entry.amount,
          details: {
            debitAccount: entry.debitAccount?.name,
            creditAccount: entry.creditAccount?.name,
          },
        });
      }
    }

    return redFlags;
  }

  /**
   * Detect transactions posted on weekends
   */
  static async detectWeekendPostings(startDate?: Date, endDate?: Date): Promise<RedFlag[]> {
    const where: any = {
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        debitAccount: true,
        creditAccount: true,
      },
    });

    const redFlags: RedFlag[] = [];

    for (const entry of entries) {
      const day = entry.date.getDay();
      if (day === 0 || day === 6) { // 0 = Sunday, 6 = Saturday
        redFlags.push({
          type: 'Weekend Posting',
          severity: 'Low',
          description: `Transaction posted on a weekend (${entry.date.toDateString()})`,
          transactionId: entry.id,
          date: entry.date,
          amount: entry.amount,
          details: {
            debitAccount: entry.debitAccount?.name,
            creditAccount: entry.creditAccount?.name,
          },
        });
      }
    }

    return redFlags;
  }

  /**
   * Generate comprehensive Red Flags Report
   */
  static async generateRedFlagsReport(startDate?: Date, endDate?: Date): Promise<RedFlag[]> {
    const [duplicates, roundAmounts, weekendPostings] = await Promise.all([
      this.detectDuplicatePayments(startDate, endDate),
      this.detectRoundAmounts(startDate, endDate),
      this.detectWeekendPostings(startDate, endDate),
    ]);

    return [
      ...duplicates,
      ...roundAmounts,
      ...weekendPostings,
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
