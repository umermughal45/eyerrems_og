/**
 * Transaction Risk Engine
 * 
 * Data Sources:
 * - Finance Module: Transactions, Payments, Invoices
 * 
 * Rules:
 * - Detect duplicate transactions
 * - Identify abnormal amounts (statistical outliers)
 * - Flag suspicious patterns (rapid transactions, unusual timing)
 * 
 * Confidence Logic:
 * - Degrades if transaction history is short
 * - Degrades if patterns are unclear
 * 
 * Failure Conditions:
 * - No transaction history
 * - Insufficient data for pattern analysis
 */

import prisma from '../../../prisma/client';
import {
  AIEngine,
  EngineResult,
  AIInsight,
  DataSource,
  calculateConfidence,
  createInsufficientDataInsight,
  createErrorInsight,
  ConfidenceFactors,
} from '../types';
import logger from '../../../utils/logger';
import { detectPaymentTrend } from '../ml/behavior-trend-detection';

export class TransactionRiskEngine implements AIEngine {
  name = 'TransactionRiskEngine';
  
  config = {
    data_sources: [
      {
        module: 'Finance',
        table: 'Transaction',
        fields: ['id', 'amount', 'date', 'type', 'description', 'createdAt'],
      },
      {
        module: 'Finance',
        table: 'Payment',
        fields: ['id', 'amount', 'date', 'status', 'createdAt'],
      },
      {
        module: 'Finance',
        table: 'Invoice',
        fields: ['id', 'amount', 'invoiceNumber', 'date', 'createdAt'],
      },
    ],
    rules: [
      'Duplicate detection: Same amount, same day, similar description',
      'Abnormal amount: > 3 standard deviations from mean',
      'Suspicious pattern: Multiple transactions in short time window',
    ],
    confidence_logic: 'Degrades with short history or unclear patterns',
    failure_conditions: ['No transaction history', 'Insufficient data for pattern analysis'],
  };
  
  async compute(): Promise<EngineResult> {
    const insights: AIInsight[] = [];
    const errors: string[] = [];
    
    try {
      if (!(await this.hasSufficientData())) {
        return {
          insights: [createInsufficientDataInsight('Transaction Risk', this.getDataSources())],
          engine_name: this.name,
          computed_at: new Date(),
          status: 'insufficient_data',
        };
      }
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Get transactions
      const transactions = await prisma.transaction.findMany({
        where: {
          date: { gte: sixMonthsAgo },
        },
        select: {
          id: true,
          amount: true,
          date: true,
          transactionType: true,
          description: true,
          createdAt: true,
        },
        orderBy: { date: 'desc' },
      });
      
      // Get tenant payments
      const payments = await prisma.tenantPayment.findMany({
        where: {
          date: { gte: sixMonthsAgo },
        },
        select: {
          id: true,
          amount: true,
          date: true,
          status: true,
          createdAt: true,
        },
      });
      
      // Get invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          id: true,
          amount: true,
          invoiceNumber: true,
          billingDate: true,
          createdAt: true,
        },
      });
      
      // Detect duplicate transactions
      const duplicateTransactions: Array<{ id: string; amount: number; date: Date }> = [];
      const transactionMap = new Map<string, number[]>();
      
      transactions.forEach((t: any) => {
        const key = `${t.amount}-${t.date.toISOString().split('T')[0]}`;
        if (!transactionMap.has(key)) {
          transactionMap.set(key, []);
        }
        transactionMap.get(key)!.push(Number(t.id));
      });
      
      transactionMap.forEach((ids, key) => {
        if (ids.length > 1) {
          const [amount, dateStr] = key.split('-');
          duplicateTransactions.push({
            id: ids[0].toString(),
            amount: Number(amount),
            date: new Date(dateStr),
          });
        }
      });
      
      // Detect abnormal amounts (statistical outliers)
      const amounts = transactions.map((t: any) => Number(t.amount || 0)).filter((a: number) => a > 0);
      if (amounts.length > 0) {
        const mean = amounts.reduce((a: number, b: number) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((sum: number, a: number) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        
        const abnormalTransactions = transactions.filter((t: any) => {
          const amount = Number(t.amount || 0);
          return amount > 0 && Math.abs(amount - mean) > 3 * stdDev;
        });
        
        // Suspicious patterns: multiple transactions in same hour
        const suspiciousPatterns: Array<{ count: number; timeWindow: string }> = [];
        const hourlyGroups = new Map<string, number>();
        
        transactions.forEach((t: any) => {
          const hourKey = `${t.date.toISOString().split('T')[0]}-${new Date(t.date).getHours()}`;
          hourlyGroups.set(hourKey, (hourlyGroups.get(hourKey) || 0) + 1);
        });
        
        hourlyGroups.forEach((count, hourKey) => {
          if (count >= 5) {
            suspiciousPatterns.push({ count, timeWindow: hourKey });
          }
        });
        
        // Calculate confidence factors
        const confidenceFactors: ConfidenceFactors = {
          missing_data_percentage: transactions.length < 30 ? 30 : 0,
          has_manual_overrides: false,
          has_backdated_entries: transactions.some((t: any) => {
            const created = new Date(t.createdAt);
            const tDate = new Date(t.date);
            return (created.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24) > 1;
          }),
          data_freshness_days: 0,
          sample_size: transactions.length,
        };
        
        // Duplicate transactions insight
        insights.push({
          value: duplicateTransactions.length,
          type: 'derived',
          confidence: calculateConfidence(90, confidenceFactors),
          confidence_reason: 'Based on transaction pattern analysis',
          explanation: `Detected ${duplicateTransactions.length} potential duplicate transactions (same amount, same date)`,
          data_sources: [
            {
              module: 'Finance',
              table: 'Transaction',
              time_range: { start: sixMonthsAgo, end: new Date() },
            },
          ],
          last_computed_at: new Date(),
          status: 'success',
          metadata: {
            duplicates: duplicateTransactions.slice(0, 10), // Limit to first 10
          },
        });
        
        // Abnormal amounts insight
        insights.push({
          value: abnormalTransactions.length,
          type: 'derived',
          confidence: calculateConfidence(85, confidenceFactors),
          confidence_reason: 'Statistical analysis of transaction amounts',
          explanation: `Identified ${abnormalTransactions.length} transactions with amounts > 3 standard deviations from mean (${mean.toFixed(2)})`,
          data_sources: [
            {
              module: 'Finance',
              table: 'Transaction',
              time_range: { start: sixMonthsAgo, end: new Date() },
            },
          ],
          last_computed_at: new Date(),
          status: 'success',
          metadata: {
            mean,
            stdDev,
            abnormal_count: abnormalTransactions.length,
          },
        });
        
        // Suspicious patterns insight
        insights.push({
          value: suspiciousPatterns.length,
          type: 'derived',
          confidence: calculateConfidence(80, confidenceFactors),
          confidence_reason: 'Based on transaction frequency patterns',
          explanation: `Detected ${suspiciousPatterns.length} time windows with 5+ transactions (potential suspicious activity)`,
          data_sources: [
            {
              module: 'Finance',
              table: 'Transaction',
              time_range: { start: sixMonthsAgo, end: new Date() },
            },
          ],
          last_computed_at: new Date(),
          status: 'success',
        });
        
        // ML-based payment behavior trend detection (APPROVED USE CASE)
        // Analyze payment delays over time
        const paymentDelays = payments
          .map((p: any) => {
            const paymentDate = new Date(p.date);
            const daysSince = (new Date().getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
            return p.status !== 'paid' ? daysSince : 0;
          })
          .filter((d: number) => d > 0);
        
        if (paymentDelays.length >= 6) {
          const trendResult = detectPaymentTrend(paymentDelays, true, 6, 70);
          
          if (trendResult.method === 'ml' && trendResult.trend !== null && trendResult.probability !== null) {
            insights.push({
              value: trendResult.probability,
              type: 'predicted',
              confidence: trendResult.confidence,
              confidence_reason: `ML-based trend detection (${trendResult.confidence.toFixed(1)}% confidence)`,
              explanation: `Payment behavior trend: ${trendResult.trend} (${trendResult.probability.toFixed(1)}% probability). ${trendResult.explanation}`,
              data_sources: [
                {
                  module: 'Finance',
                  table: 'Payment',
                  time_range: { start: sixMonthsAgo, end: new Date() },
                },
              ],
              last_computed_at: new Date(),
              status: trendResult.confidence >= 70 ? 'success' : 'degraded',
              metadata: {
                trend: trendResult.trend,
                method: trendResult.method,
                indicators: trendResult.indicators,
              },
            });
          }
        }
      }
      
    } catch (error: any) {
      logger.error(`Transaction Risk Engine error: ${error.message}`, error);
      errors.push(error.message);
      insights.push(createErrorInsight('Transaction Risk', error.message, this.getDataSources()));
    }
    
    return {
      insights,
      engine_name: this.name,
      computed_at: new Date(),
      status: errors.length > 0 ? 'error' : insights.some((i) => i.status === 'insufficient_data') ? 'insufficient_data' : 'success',
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  async hasSufficientData(): Promise<boolean> {
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const transactionCount = await prisma.transaction.count({
        where: {
          date: { gte: sixMonthsAgo },
        },
      });
      
      return transactionCount >= 10;
    } catch (error) {
      logger.error('Error checking sufficient data for Transaction Risk', error);
      return false;
    }
  }
  
  getDataSources(): DataSource[] {
    return this.config.data_sources;
  }
}
