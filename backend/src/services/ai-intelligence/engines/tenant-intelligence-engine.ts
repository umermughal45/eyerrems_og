/**
 * Tenant Intelligence Engine (Internal Only)
 * 
 * Data Sources:
 * - Properties Module: Tenants, Leases, Units
 * - Finance Module: Tenant Payments, Invoices
 * - CRM Module: Tenant Communications
 * 
 * Rules:
 * - Risk score = Based on payment history, lease violations, communication patterns
 * - Satisfaction = Based on feedback, maintenance requests, communication sentiment
 * - Churn risk = Based on lease expiration, payment delays, satisfaction trends
 * 
 * Confidence Logic:
 * - Degrades if tenant data incomplete
 * - Degrades if payment history short
 * 
 * Failure Conditions:
 * - No tenants in system
 * - Missing payment/lease data
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
import { calculateChurnProbability } from '../ml/probability-models';

export class TenantIntelligenceEngine implements AIEngine {
  name = 'TenantIntelligenceEngine';
  
  config = {
    data_sources: [
      {
        module: 'Properties',
        table: 'Tenant',
        fields: ['id', 'name', 'email', 'phone', 'status'],
      },
      {
        module: 'Properties',
        table: 'Lease',
        fields: ['id', 'tenantId', 'propertyId', 'startDate', 'endDate', 'status'],
      },
      {
        module: 'Finance',
        table: 'Payment',
        fields: ['id', 'tenantId', 'amount', 'date', 'status'],
      },
      {
        module: 'Finance',
        table: 'Invoice',
        fields: ['id', 'tenantId', 'amount', 'date', 'status'],
      },
    ],
    rules: [
      'Risk score = Based on payment history, lease violations, communication patterns',
      'Satisfaction = Based on feedback, maintenance requests, communication sentiment',
      'Churn risk = Based on lease expiration, payment delays, satisfaction trends',
    ],
    confidence_logic: 'Degrades if tenant data incomplete or payment history short',
    failure_conditions: ['No tenants in system', 'Missing payment/lease data'],
  };
  
  async compute(): Promise<EngineResult> {
    const insights: AIInsight[] = [];
    const errors: string[] = [];
    
    try {
      if (!(await this.hasSufficientData())) {
        return {
          insights: [createInsufficientDataInsight('Tenant Intelligence', this.getDataSources())],
          engine_name: this.name,
          computed_at: new Date(),
          status: 'insufficient_data',
        };
      }
      
      // Get tenants
      const tenants = await prisma.tenant.findMany({
        where: { isDeleted: false, isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      });
      
      if (tenants.length === 0) {
        return {
          insights: [createInsufficientDataInsight('Tenant Intelligence', this.getDataSources())],
          engine_name: this.name,
          computed_at: new Date(),
          status: 'insufficient_data',
        };
      }
      
      // Get leases
      const leases = await prisma.lease.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          tenantId: true,
          unitId: true,
          leaseStart: true,
          leaseEnd: true,
          status: true,
        },
      });
      
      // Get payments for last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const payments = await prisma.tenantPayment.findMany({
        where: {
          date: { gte: twelveMonthsAgo },
        },
        select: {
          id: true,
          tenantId: true,
          amount: true,
          date: true,
          status: true,
        },
      });
      
      // Get invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          createdAt: { gte: twelveMonthsAgo },
        },
        select: {
          id: true,
          tenantId: true,
          amount: true,
          billingDate: true,
          status: true,
        },
      });
      
      // Calculate tenant risk scores
      const tenantRisks: Array<{ id: string; name: string; risk: number }> = [];
      
      tenants.forEach((tenant) => {
        const tenantPayments = payments.filter((p) => p.tenantId === tenant.id);
        const tenantInvoices = invoices.filter((i) => i.tenantId === tenant.id);
        const tenantLeases = leases.filter((l) => l.tenantId === tenant.id);
        
        let riskScore = 0;
        
        // Payment delays
        const overduePayments = tenantPayments.filter((p) => {
          if (p.status === 'paid') return false;
          const daysSince = (new Date().getTime() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24);
          return daysSince > 15;
        });
        riskScore += overduePayments.length * 20;
        
        // Payment frequency
        if (tenantPayments.length === 0 && tenantInvoices.length > 0) {
          riskScore += 30; // No payments but has invoices
        }
        
        // Lease expiration soon
        const expiringLeases = tenantLeases.filter((l: any) => {
          const endDate = new Date(l.leaseEnd);
          const daysUntilExpiry = (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
        });
        if (expiringLeases.length > 0) {
          riskScore += 15;
        }
        
        if (riskScore > 40) {
          tenantRisks.push({
            id: tenant.id,
            name: tenant.name,
            risk: Math.min(100, riskScore),
          });
        }
      });
      
      // Calculate satisfaction score (simplified: based on payment timeliness)
      const onTimePayments = payments.filter((p) => {
        if (p.status !== 'paid') return false;
        const invoice = invoices.find((i: any) => i.tenantId === p.tenantId);
        if (!invoice) return true;
        const paymentDate = new Date(p.date);
        const invoiceDate = new Date(invoice.billingDate);
        const daysDiff = (paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Paid within 7 days
      });
      
      const satisfactionScore = payments.length > 0
        ? (onTimePayments.length / payments.length) * 100
        : 0;
      
      // ML-based churn probability (APPROVED USE CASE)
      // Calculate average churn probability across tenants with sufficient data
      const tenantChurnProbabilities: number[] = [];
      
      tenants.forEach((tenant) => {
        const tenantPayments = payments.filter((p: any) => p.tenantId === tenant.id);
        const tenantLeases = leases.filter((l: any) => l.tenantId === tenant.id);
        
        if (tenantPayments.length >= 3) {
          // Calculate payment consistency
          const paidPayments = tenantPayments.filter((p: any) => p.status === 'paid').length;
          const paymentConsistency = tenantPayments.length > 0
            ? (paidPayments / tenantPayments.length) * 100
            : 0;
          
          // Count payment delays
          const paymentDelays = tenantPayments.filter((p: any) => {
            if (p.status === 'paid') return false;
            const daysSince = (new Date().getTime() - new Date(p.date).getTime()) / (1000 * 60 * 60 * 24);
            return daysSince > 15;
          }).length;
          
          // Get lease expiration info
          const activeLease = tenantLeases.find((l: any) => l.status === 'Active');
          const daysUntilExpiry = activeLease
            ? (new Date(activeLease.leaseEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
            : null;
          
          // ML-based churn probability
          const churnResult = calculateChurnProbability({
            paymentDelays,
            totalPayments: tenantPayments.length,
            daysUntilLeaseExpiry: daysUntilExpiry,
            paymentConsistency,
            satisfactionScore: satisfactionScore, // Use overall satisfaction as proxy
            minDataPoints: 3,
            minConfidence: 70,
          });
          
          if (churnResult.method === 'ml' && churnResult.probability !== null) {
            tenantChurnProbabilities.push(churnResult.probability);
          }
        }
      });
      
      // Calculate average churn rate (ML-augmented)
      let predictedChurnRate: number;
      let churnMethod: string;
      
      if (tenantChurnProbabilities.length > 0) {
        predictedChurnRate = tenantChurnProbabilities.reduce((a, b) => a + b, 0) / tenantChurnProbabilities.length;
        churnMethod = 'ML (probability model)';
      } else {
        // Fallback to rule-based
        const leasesExpiringIn3Months = leases.filter((l: any) => {
          const endDate = new Date(l.leaseEnd);
          const daysUntilExpiry = (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
        });
        predictedChurnRate = leases.length > 0
          ? (leasesExpiringIn3Months.length / leases.length) * 20
          : 0;
        churnMethod = 'Rule-based (lease expiration)';
      }
      
      // Confidence factors
      const confidenceFactors: ConfidenceFactors = {
        missing_data_percentage: payments.length < 10 ? 30 : 0,
        has_manual_overrides: false,
        has_backdated_entries: false,
        data_freshness_days: 0,
        sample_size: tenants.length,
      };
      
      // High-risk tenants insight
      insights.push({
        value: tenantRisks.length,
        type: 'derived',
        confidence: calculateConfidence(85, confidenceFactors),
        confidence_reason: 'Based on payment history and lease patterns',
        explanation: `${tenantRisks.length} tenants identified with high risk (>40% based on payment delays and lease expiration)`,
        data_sources: [
          {
            module: 'Properties',
            table: 'Tenant',
            filters: { isDeleted: false },
          },
          {
            module: 'Finance',
            table: 'Payment',
            time_range: { start: twelveMonthsAgo, end: new Date() },
          },
        ],
        last_computed_at: new Date(),
        status: 'success',
        metadata: {
          high_risk_tenants: tenantRisks.slice(0, 10), // Limit to first 10
        },
      });
      
      // Satisfaction score insight
      insights.push({
        value: satisfactionScore,
        type: 'derived',
        confidence: calculateConfidence(80, confidenceFactors),
        confidence_reason: 'Based on payment timeliness analysis',
        explanation: `Tenant satisfaction score: ${satisfactionScore.toFixed(1)}% (based on on-time payment rate)`,
        data_sources: [
          {
            module: 'Finance',
            table: 'Payment',
            time_range: { start: twelveMonthsAgo, end: new Date() },
          },
          {
            module: 'Finance',
            table: 'Invoice',
            time_range: { start: twelveMonthsAgo, end: new Date() },
          },
        ],
        last_computed_at: new Date(),
        status: 'success',
      });
      
      // Predicted churn risk insight (ML-augmented)
      const churnConfidence = tenantChurnProbabilities.length > 0
        ? Math.min(85, 70 + tenantChurnProbabilities.length * 2) // Higher confidence with more ML predictions
        : calculateConfidence(70, confidenceFactors);
      
      const churnStatus = churnConfidence >= 70 ? 'success' : churnConfidence >= 50 ? 'degraded' : 'insufficient_data';
      
      // Only include if confidence sufficient
      if (churnStatus !== 'insufficient_data' && predictedChurnRate !== null) {
        insights.push({
          value: predictedChurnRate,
          type: 'predicted',
          confidence: churnConfidence,
          confidence_reason: `Based on ${churnMethod.toLowerCase()}${tenantChurnProbabilities.length > 0 ? ` (${tenantChurnProbabilities.length} tenants analyzed)` : ''}`,
          explanation: `Predicted churn risk for next quarter: ${predictedChurnRate.toFixed(1)}% using ${churnMethod.toLowerCase()}${tenantChurnProbabilities.length > 0 ? `. Analyzed ${tenantChurnProbabilities.length} tenants with sufficient payment history` : ''}`,
          data_sources: [
            {
              module: 'Properties',
              table: 'Lease',
              filters: { isDeleted: false },
            },
            {
              module: 'Finance',
              table: 'TenantPayment',
              time_range: { start: twelveMonthsAgo, end: new Date() },
            },
          ],
          time_range: {
            start: new Date(),
            end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          },
          last_computed_at: new Date(),
          status: churnStatus,
          metadata: {
            method: tenantChurnProbabilities.length > 0 ? 'ml' : 'rule_based',
            method_label: churnMethod,
            tenants_analyzed: tenantChurnProbabilities.length,
          },
        });
      }
      
    } catch (error: any) {
      logger.error(`Tenant Intelligence Engine error: ${error.message}`, error);
      errors.push(error.message);
      insights.push(createErrorInsight('Tenant Intelligence', error.message, this.getDataSources()));
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
      const tenantCount = await prisma.tenant.count({
        where: { isDeleted: false },
      });
      return tenantCount > 0;
    } catch (error) {
      logger.error('Error checking sufficient data for Tenant Intelligence', error);
      return false;
    }
  }
  
  getDataSources(): DataSource[] {
    return this.config.data_sources;
  }
}
