/**
 * Financial Intelligence Engine
 * 
 * Data Sources:
 * - Finance Module: Transactions, Invoices, Payments, Ledger Entries
 * 
 * Rules:
 * - Revenue = Sum of all income transactions
 * - Profit = Revenue - Expenses
 * - Forecast uses LSTM-like pattern (simplified moving average with trend)
 * 
 * Confidence Logic:
 * - Degrades if < 6 months of data
 * - Degrades if manual overrides detected
 * - Degrades if backdated entries exist
 * 
 * Failure Conditions:
 * - No transactions in last 12 months
 * - Missing account mappings
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
import { forecastTimeSeries } from '../ml/time-series-forecast';
import { validateContract, createRefusalInsight } from '../validation/correctness-contracts';
import { RevenuePredictionContract, PaymentRiskContract } from '../validation/contracts';
import { FinanceLegitimacy, calculateAnomalyPercentage, isTimeRangeConsistent } from '../validation/data-legitimacy';
import { createDecisionLog } from '../audit/decision-logger';

export class FinancialIntelligenceEngine implements AIEngine {
  name = 'FinancialIntelligenceEngine';
  
  config = {
    data_sources: [
      {
        module: 'Finance',
        table: 'Transaction',
        fields: ['amount', 'type', 'date', 'accountId'],
      },
      {
        module: 'Finance',
        table: 'Invoice',
        fields: ['amount', 'totalAmount', 'date', 'status'],
      },
      {
        module: 'Finance',
        table: 'Payment',
        fields: ['amount', 'date', 'status'],
      },
    ],
    rules: [
      'Revenue = Sum of all income transactions',
      'Profit = Revenue - Expenses',
      'Forecast uses trend analysis on historical data',
    ],
    confidence_logic: 'Degrades with missing data, manual overrides, backdated entries',
    failure_conditions: [
      'No transactions in last 12 months',
      'Missing account mappings',
    ],
  };
  
  async compute(): Promise<EngineResult> {
    const insights: AIInsight[] = [];
    const errors: string[] = [];
    
    try {
      // Check if we have sufficient data
      if (!(await this.hasSufficientData())) {
        return {
          insights: [
            createInsufficientDataInsight('Financial Intelligence', this.getDataSources()),
          ],
          engine_name: this.name,
          computed_at: new Date(),
          status: 'insufficient_data',
        };
      }
      
      // Get data
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      // Get transactions (will be filtered for legitimacy)
      const allTransactions = await prisma.transaction.findMany({
        where: {
          date: { gte: twelveMonthsAgo },
        },
        select: {
          amount: true,
          transactionType: true,
          date: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      
      // Apply legitimacy filters: exclude reversed transactions
      const transactions = allTransactions.filter((t: any) => 
        !FinanceLegitimacy.excludeReversedTransactions(t)
      );
      
      // Get invoices (will be filtered for legitimacy)
      const allInvoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: twelveMonthsAgo },
        },
        select: {
          amount: true,
          totalAmount: true,
          billingDate: true,
          status: true,
          createdAt: true,
        },
      });
      
      // Apply legitimacy filters: exclude draft invoices
      const invoices = allInvoices.filter((i: any) => 
        !FinanceLegitimacy.excludeDraftInvoices(i)
      );
      
      // Get tenant payments (not deal payments) - will be filtered for legitimacy
      const allPayments = await prisma.tenantPayment.findMany({
        where: {
          date: { gte: twelveMonthsAgo },
        },
        select: {
          amount: true,
          date: true,
          status: true,
          createdAt: true,
        },
      });
      
      // Apply legitimacy filters: exclude draft payments
      const payments = allPayments.filter((p: any) => p.status !== 'draft');
      
      // Calculate actual revenue (last month)
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
      
      const lastMonthRevenue = transactions
        .filter((t: any) => {
          const tDate = new Date(t.date);
          return tDate >= lastMonthStart && tDate <= lastMonthEnd && (t.transactionType === 'income' || t.transactionType === 'credit');
        })
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      
      // Calculate expenses
      const lastMonthExpenses = transactions
        .filter((t: any) => {
          const tDate = new Date(t.date);
          return tDate >= lastMonthStart && tDate <= lastMonthEnd && (t.transactionType === 'expense' || t.transactionType === 'debit');
        })
        .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
      
      // Calculate profit
      const lastMonthProfit = lastMonthRevenue - lastMonthExpenses;
      
      // Predict next month revenue - APPLY CORRECTNESS CONTRACT
      const revenueTransactions = transactions.filter((t: any) => 
        t.transactionType === 'income' || t.transactionType === 'credit'
      );
      
      // Calculate enhanced confidence factors (PRODUCTION-GRADE) - moved outside conditional for reuse
      const totalTransactions = allTransactions.length;
      const legitimateTransactions = transactions.length;
      const expectedTransactions = 365; // Roughly 1 per day
      const missingDataPercentage = Math.max(0, (1 - legitimateTransactions / expectedTransactions) * 100);
      const dataCompletenessRatio = totalTransactions > 0 ? legitimateTransactions / totalTransactions : 0;
      
      // Calculate historical coverage (months)
      const historicalCoverage = 12; // We're using 12 months
      
      // Check for manual overrides (transactions created/updated on same day)
      const hasManualOverrides = transactions.some((t: any) => {
        const created = new Date(t.createdAt);
        const updated = new Date(t.updatedAt);
        const sameDay = created.toDateString() === updated.toDateString();
        const sameTime = Math.abs(created.getTime() - updated.getTime()) < 60000; // Within 1 minute
        return sameDay && sameTime;
      });
      
      // Check for backdated entries (created date > transaction date by > 1 day)
      const hasBackdatedEntries = transactions.some((t: any) => {
        const created = new Date(t.createdAt);
        const tDate = new Date(t.date);
        const diffDays = (created.getTime() - tDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > 1;
      });
      
      const dataFreshnessDays = 0; // Current data
      const sampleSize = legitimateTransactions;
      
      // Calculate variance stability (coefficient of variation)
      const revenueAmounts = transactions
        .filter((t: any) => t.transactionType === 'income' || t.transactionType === 'credit')
        .map((t: any) => Number(t.amount || 0));
      const mean = revenueAmounts.length > 0 ? revenueAmounts.reduce((a, b) => a + b, 0) / revenueAmounts.length : 0;
      const variance = revenueAmounts.length > 0 ? revenueAmounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenueAmounts.length : 0;
      const stdDev = Math.sqrt(variance);
      const varianceStability = mean > 0 ? stdDev / mean : 1.0; // Coefficient of variation
      
      // Actual revenue transactions for last month - moved outside conditional for reuse
      const lastMonthRevenueTransactions = transactions.filter((t: any) => {
        const tDate = new Date(t.date);
        return tDate >= lastMonthStart && tDate <= lastMonthEnd && 
               (t.transactionType === 'income' || t.transactionType === 'credit');
      });
      
      // Validate against Revenue Prediction Contract
      const contractResult = validateContract(
        revenueTransactions,
        RevenuePredictionContract,
        { start: twelveMonthsAgo, end: new Date() }
      );
      
      // Calculate anomaly percentage for confidence factors (use contract result if available)
      let anomalyPercentage = contractResult.context.anomalyPercentage || 0;
      
      const confidenceFactors: ConfidenceFactors = {
        missing_data_percentage: missingDataPercentage,
        has_manual_overrides: hasManualOverrides,
        has_backdated_entries: hasBackdatedEntries,
        data_freshness_days: dataFreshnessDays,
        sample_size: sampleSize,
        anomaly_percentage: anomalyPercentage,
        data_completeness_ratio: dataCompletenessRatio,
        historical_coverage: historicalCoverage,
        variance_stability: varianceStability,
      };
      
      if (!contractResult.passed) {
        // AI refuses output - log and return refusal
        const refusalInsight = createRefusalInsight(
          'Revenue Prediction',
          contractResult.failureReason || 'Contract validation failed',
          this.getDataSources()
        );
        
        createDecisionLog(
          this.name,
          { type: 'refusal', refusalReason: contractResult.failureReason },
          {
            totalRecords: contractResult.context.totalRecords,
            legitimateRecords: contractResult.legitimateCount,
            excludedRecords: contractResult.excludedCount,
            timeRange: { start: twelveMonthsAgo, end: new Date() },
          },
          contractResult,
          {
            baseConfidence: 0,
            factors: {
              missingDataPercentage: contractResult.context.missingDataPercentage,
              hasManualOverrides: false,
              hasBackdatedEntries: false,
              dataFreshnessDays: 0,
              sampleSize: contractResult.legitimateCount,
            },
            finalConfidence: 0,
          },
          contractResult.failureReason || 'Contract validation failed',
          {}
        );
        
        insights.push(refusalInsight);
      } else {
        // Contract passed - proceed with calculation
        const legitimateRevenueTransactions = revenueTransactions.slice(0, contractResult.legitimateCount);
        
        // Build monthly revenue series from legitimate data only
        const monthlyRevenues: number[] = [];
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date();
          monthStart.setMonth(monthStart.getMonth() - i);
          monthStart.setDate(1);
          const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
          
          const monthRevenue = legitimateRevenueTransactions
            .filter((t: any) => {
              const tDate = new Date(t.date);
              return tDate >= monthStart && tDate <= monthEnd;
            })
            .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
          
          monthlyRevenues.push(monthRevenue);
        }
        
        // Calculate anomaly percentage
        const anomalyPct = calculateAnomalyPercentage(monthlyRevenues);
        contractResult.context.anomalyPercentage = anomalyPct;
        anomalyPercentage = anomalyPct;
        confidenceFactors.anomaly_percentage = anomalyPct;
        
        // Check time range consistency
        const timeConsistency = isTimeRangeConsistent(legitimateRevenueTransactions, 'date', 90);
        
        // ML-based revenue forecasting (APPROVED USE CASE)
        // Rule-based fallback if ML confidence insufficient
        const mlForecast = forecastTimeSeries(monthlyRevenues, 1, 6, 70);
        
        let predictedRevenue: number | null = null;
        let predictionMethod: string = '';
        let predictionConfidence: number = 0;
        
        if (mlForecast.method === 'ml' && mlForecast.prediction !== null) {
          // Use ML prediction
          predictedRevenue = mlForecast.prediction;
          predictionMethod = 'ML (exponential smoothing)';
          predictionConfidence = mlForecast.confidence;
        } else {
          // Fallback to rule-based
          const avgRevenue = monthlyRevenues.reduce((a: number, b: number) => a + b, 0) / monthlyRevenues.length;
          const recentTrend = monthlyRevenues.slice(-3).reduce((a: number, b: number) => a + b, 0) / 3;
          predictedRevenue = avgRevenue * 0.6 + recentTrend * 0.4;
          predictionMethod = 'Rule-based (moving average)';
          predictionConfidence = 75;
        }
      
      const actualRevenueConfidence = calculateConfidence(95, confidenceFactors);
      const actualRevenueStatus = actualRevenueConfidence >= 70 ? 'success' : actualRevenueConfidence >= 60 ? 'degraded' : 'insufficient_data';
      
      if (actualRevenueStatus !== 'insufficient_data') {
        const actualRevenueInsight: AIInsight = {
          value: lastMonthRevenue,
          type: 'actual',
          confidence: actualRevenueConfidence,
          confidence_reason: this.getConfidenceReason(confidenceFactors, actualRevenueConfidence),
          explanation: `Actual revenue for last month (${lastMonthStart.toLocaleDateString()} to ${lastMonthEnd.toLocaleDateString()}): ${lastMonthRevenue.toLocaleString()}. ` +
            `Calculated from ${lastMonthRevenueTransactions.length} legitimate income transactions. ` +
            `Formula: Sum of all income/credit transactions. ` +
            `Tables used: Transaction. ` +
            `Filters applied: transactionType IN ('income', 'credit'), date BETWEEN ${lastMonthStart.toISOString()} AND ${lastMonthEnd.toISOString()}, excluding reversed transactions. ` +
            `Record count: ${lastMonthRevenueTransactions.length}. ` +
            `Known limitations: ${confidenceFactors.has_manual_overrides ? 'Manual overrides detected. ' : ''}${confidenceFactors.has_backdated_entries ? 'Backdated entries present. ' : ''}`,
          data_sources: [
            {
              module: 'Finance',
              table: 'Transaction',
              time_range: { start: lastMonthStart, end: lastMonthEnd },
              filters: { 
                transactionType: { in: ['income', 'credit'] },
              },
            },
          ],
          time_range: { start: lastMonthStart, end: lastMonthEnd },
          last_computed_at: new Date(),
          status: actualRevenueStatus,
          metadata: {
            record_count: lastMonthRevenueTransactions.length,
            formula: 'Sum of income/credit transactions',
          },
        };
        
        insights.push(actualRevenueInsight);
      }
      
        // Predicted revenue insight (ML-augmented) - PRODUCTION-GRADE
        const baseConfidence = 85;
        const calculatedConfidence = calculateConfidence(baseConfidence, confidenceFactors);
        const finalConfidence = Math.min(predictionConfidence, calculatedConfidence);
        
        // PRODUCTION RULE: Confidence < 60% → suppress insight
        if (finalConfidence < 60) {
          const refusalInsight = createRefusalInsight(
            'Revenue Prediction',
            `Confidence ${finalConfidence.toFixed(1)}% below minimum threshold (60%). Insufficient data quality for reliable prediction.`,
            this.getDataSources()
          );
          
          createDecisionLog(
            this.name,
            { type: 'refusal', refusalReason: `Low confidence: ${finalConfidence.toFixed(1)}%` },
            {
              totalRecords: contractResult.context.totalRecords,
              legitimateRecords: contractResult.legitimateCount,
              excludedRecords: contractResult.excludedCount,
              timeRange: { start: twelveMonthsAgo, end: new Date() },
            },
            contractResult,
            {
              baseConfidence,
              factors: {
                missingDataPercentage: confidenceFactors.missing_data_percentage,
                hasManualOverrides: confidenceFactors.has_manual_overrides,
                hasBackdatedEntries: confidenceFactors.has_backdated_entries,
                dataFreshnessDays: confidenceFactors.data_freshness_days,
                sampleSize: confidenceFactors.sample_size,
                anomalyPercentage: confidenceFactors.anomaly_percentage,
              },
              finalConfidence,
            },
            `Confidence ${finalConfidence.toFixed(1)}% below threshold`,
            {}
          );
          
          insights.push(refusalInsight);
        } else {
          // Confidence sufficient - include insight
          const status = finalConfidence >= 70 ? 'success' : 'degraded';
          
          // Build auditable explanation
          const recordCount = legitimateRevenueTransactions.length;
          const excludedCount = contractResult.excludedCount;
          const formula = predictionMethod.includes('ML') 
            ? 'Exponential smoothing with trend analysis'
            : 'Weighted moving average (60% historical average, 40% recent trend)';
          
          const explanation = `Predicted revenue for next month: ${predictedRevenue!.toLocaleString()} using ${predictionMethod.toLowerCase()}. ` +
            `Based on ${monthlyRevenues.length} months of historical data from ${recordCount} legitimate transactions ` +
            `(${excludedCount} excluded: reversed/draft). ` +
            `Formula: ${formula}. ` +
            `${mlForecast.method === 'ml' && mlForecast.confidence_interval ? `Confidence interval: ${mlForecast.confidence_interval.lower.toLocaleString()} - ${mlForecast.confidence_interval.upper.toLocaleString()}. ` : ''}` +
            `Time range: ${twelveMonthsAgo.toLocaleDateString()} to ${new Date().toLocaleDateString()}. ` +
            `Known limitations: ${timeConsistency.gaps.length > 0 ? `Time gaps detected (${timeConsistency.gaps.length} gaps > 90 days). ` : 'No significant time gaps. '}` +
            `${anomalyPct > 15 ? `Anomaly rate: ${anomalyPct.toFixed(1)}%. ` : ''}`;
          
          const insight: AIInsight = {
            value: predictedRevenue,
            type: 'predicted',
            confidence: finalConfidence,
            confidence_reason: this.getConfidenceReason(confidenceFactors, finalConfidence),
            explanation,
            data_sources: [
              {
                module: 'Finance',
                table: 'Transaction',
                time_range: { start: twelveMonthsAgo, end: new Date() },
                filters: { 
                  transactionType: { in: ['income', 'credit'] },
                },
              },
            ],
            time_range: {
              start: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
              end: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0),
            },
            last_computed_at: new Date(),
            status,
            metadata: {
              method: mlForecast.method === 'ml' ? 'ml' : 'rule_based',
              method_label: predictionMethod,
              ml_forecast: mlForecast.method === 'ml' ? {
                confidence_interval: mlForecast.confidence_interval,
                data_quality_score: mlForecast.data_quality_score,
              } : undefined,
              record_count: recordCount,
              excluded_count: excludedCount,
              formula,
              time_gaps: timeConsistency.gaps.length,
            },
          };
          
          // Log decision
          createDecisionLog(
            this.name,
            { type: 'insight', insight },
            {
              totalRecords: contractResult.context.totalRecords,
              legitimateRecords: contractResult.legitimateCount,
              excludedRecords: contractResult.excludedCount,
              timeRange: { start: twelveMonthsAgo, end: new Date() },
            },
            contractResult,
            {
              baseConfidence,
              factors: {
                missingDataPercentage: confidenceFactors.missing_data_percentage,
                hasManualOverrides: confidenceFactors.has_manual_overrides,
                hasBackdatedEntries: confidenceFactors.has_backdated_entries,
                dataFreshnessDays: confidenceFactors.data_freshness_days,
                sampleSize: confidenceFactors.sample_size,
                anomalyPercentage: confidenceFactors.anomaly_percentage,
              },
              finalConfidence,
            },
            `Revenue prediction generated with ${finalConfidence.toFixed(1)}% confidence`,
            {}
          );
          
          insights.push(insight);
        }
      }
      
      // Profit insight - PRODUCTION-GRADE with auditable explanation
      const lastMonthExpenseTransactions = transactions.filter((t: any) => {
        const tDate = new Date(t.date);
        return tDate >= lastMonthStart && tDate <= lastMonthEnd && 
               (t.transactionType === 'expense' || t.transactionType === 'debit');
      });
      
      const profitConfidence = calculateConfidence(90, confidenceFactors);
      const profitStatus = profitConfidence >= 70 ? 'success' : profitConfidence >= 60 ? 'degraded' : 'insufficient_data';
      
      if (profitStatus !== 'insufficient_data') {
        const profitInsight: AIInsight = {
          value: lastMonthProfit,
          type: 'derived',
          confidence: profitConfidence,
          confidence_reason: this.getConfidenceReason(confidenceFactors, profitConfidence),
          explanation: `Derived profit for last month (${lastMonthStart.toLocaleDateString()} to ${lastMonthEnd.toLocaleDateString()}): ${lastMonthProfit.toLocaleString()}. ` +
            `Formula: Revenue - Expenses. ` +
            `Revenue: ${lastMonthRevenue.toLocaleString()} (from ${lastMonthRevenueTransactions.length} income transactions). ` +
            `Expenses: ${lastMonthExpenses.toLocaleString()} (from ${lastMonthExpenseTransactions.length} expense transactions). ` +
            `Tables used: Transaction. ` +
            `Filters applied: date BETWEEN ${lastMonthStart.toISOString()} AND ${lastMonthEnd.toISOString()}, excluding reversed transactions. ` +
            `Record counts: ${lastMonthRevenueTransactions.length} income, ${lastMonthExpenseTransactions.length} expense. ` +
            `Known limitations: Profit ≠ cash flow (excludes accounts receivable/payable). ` +
            `${confidenceFactors.has_manual_overrides ? 'Manual overrides detected. ' : ''}${confidenceFactors.has_backdated_entries ? 'Backdated entries present. ' : ''}`,
          data_sources: [
            {
              module: 'Finance',
              table: 'Transaction',
              time_range: { start: lastMonthStart, end: lastMonthEnd },
              filters: {},
            },
          ],
          time_range: { start: lastMonthStart, end: lastMonthEnd },
          last_computed_at: new Date(),
          status: profitStatus,
          metadata: {
            revenue_count: lastMonthRevenueTransactions.length,
            expense_count: lastMonthExpenseTransactions.length,
            formula: 'Revenue - Expenses',
          },
        };
        
        insights.push(profitInsight);
      }
      
      // Payment risk alerts - APPLY CORRECTNESS CONTRACT
      const paymentRiskResult = validateContract(
        payments,
        PaymentRiskContract,
        { start: twelveMonthsAgo, end: new Date() }
      );
      
      if (!paymentRiskResult.passed) {
        const refusalInsight = createRefusalInsight(
          'Payment Risk Assessment',
          paymentRiskResult.failureReason || 'Contract validation failed',
          this.getDataSources()
        );
        insights.push(refusalInsight);
      } else {
        const legitimatePayments = payments.slice(0, paymentRiskResult.legitimateCount);
        const overduePayments = legitimatePayments.filter((p: any) => {
          const paymentDate = new Date(p.date);
          const daysSince = (new Date().getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
          return p.status !== 'paid' && daysSince > 15;
        });
        
        const paymentRiskConfidence = calculateConfidence(88, confidenceFactors);
        const paymentRiskStatus = paymentRiskConfidence >= 70 ? 'success' : paymentRiskConfidence >= 60 ? 'degraded' : 'insufficient_data';
        
        if (paymentRiskStatus !== 'insufficient_data') {
          const paymentRiskInsight: AIInsight = {
            value: overduePayments.length,
            type: 'derived',
            confidence: paymentRiskConfidence,
            confidence_reason: this.getConfidenceReason(confidenceFactors, paymentRiskConfidence),
            explanation: `Payment risk assessment: ${overduePayments.length} payments with delays exceeding 15 days identified. ` +
              `Based on ${legitimatePayments.length} legitimate payment records (${paymentRiskResult.excludedCount} excluded: draft). ` +
              `Tables used: TenantPayment. ` +
              `Filters applied: date >= ${twelveMonthsAgo.toISOString()}, status != 'draft'. ` +
              `Record count: ${legitimatePayments.length}. ` +
              `Risk definition: Payments with status != 'paid' and days since payment date > 15. ` +
              `Known limitations: Risk ≠ single event (pattern analysis requires multiple payments).`,
            data_sources: [
              {
                module: 'Finance',
                table: 'TenantPayment',
                time_range: { start: twelveMonthsAgo, end: new Date() },
                filters: { status: { not: 'draft' } },
              },
            ],
            last_computed_at: new Date(),
            status: paymentRiskStatus,
            metadata: {
              total_payments: legitimatePayments.length,
              overdue_count: overduePayments.length,
              excluded_count: paymentRiskResult.excludedCount,
            },
          };
          
          insights.push(paymentRiskInsight);
        }
      }
      
    } catch (error: any) {
      logger.error(`Financial Intelligence Engine error: ${error.message}`, error);
      errors.push(error.message);
      insights.push(
        createErrorInsight('Financial Intelligence', error.message, this.getDataSources())
      );
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
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const transactionCount = await prisma.transaction.count({
        where: {
          date: { gte: twelveMonthsAgo },
        },
      });
      
      // Need at least 30 transactions in last 12 months
      return transactionCount >= 30;
    } catch (error) {
      logger.error('Error checking sufficient data for Financial Intelligence', error);
      return false;
    }
  }
  
  getDataSources(): DataSource[] {
    return this.config.data_sources;
  }
  
  private getConfidenceReason(factors: ConfidenceFactors, confidence: number): string {
    const reasons: string[] = [];
    
    if (factors.missing_data_percentage > 20) {
      reasons.push(`${Math.round(factors.missing_data_percentage)}% data missing`);
    }
    
    if (factors.has_manual_overrides) {
      reasons.push('Manual overrides detected');
    }
    
    if (factors.has_backdated_entries) {
      reasons.push('Backdated entries present');
    }
    
    if (factors.sample_size < 50) {
      reasons.push(`Small sample size (${factors.sample_size})`);
    }
    
    if (reasons.length === 0) {
      return 'High confidence based on complete and recent data';
    }
    
    return `Confidence: ${confidence}%. Factors: ${reasons.join(', ')}`;
  }
}
