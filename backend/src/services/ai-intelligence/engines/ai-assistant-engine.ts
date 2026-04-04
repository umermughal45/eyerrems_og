/**
 * AI Assistant Engine (Retrieval-Only)
 * 
 * Data Sources:
 * - All Modules: Read-only data retrieval
 * 
 * Rules:
 * - NO data modification
 * - NO transaction creation
 * - ONLY retrieval and analysis
 * - Answer questions based on available data
 * 
 * Confidence Logic:
 * - Degrades if requested data not available
 * - Degrades if query unclear
 * 
 * Failure Conditions:
 * - Invalid query
 * - Insufficient data for query
 */

import prisma from '../../../prisma/client';
import {
  AIEngine,
  EngineResult,
  AIInsight,
  DataSource,
  createInsufficientDataInsight,
  createErrorInsight,
} from '../types';
import logger from '../../../utils/logger';

export class AIAssistantEngine implements AIEngine {
  name = 'AIAssistantEngine';
  
  config = {
    data_sources: [
      {
        module: 'All',
        description: 'Read-only access to all modules for data retrieval',
      },
    ],
    rules: [
      'NO data modification',
      'NO transaction creation',
      'ONLY retrieval and analysis',
      'Answer questions based on available data',
    ],
    confidence_logic: 'Degrades if requested data not available or query unclear',
    failure_conditions: ['Invalid query', 'Insufficient data for query'],
  };
  
  /**
   * Process a query and return relevant insights
   * This is a retrieval-only engine - it never modifies data
   */
  async processQuery(query: string): Promise<EngineResult> {
    const insights: AIInsight[] = [];
    const errors: string[] = [];
    
    try {
      // Simple query processing (in production, this would use NLP/AI)
      const lowerQuery = query.toLowerCase();
      
      // Revenue queries
      if (lowerQuery.includes('revenue') || lowerQuery.includes('income')) {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        
        const transactions = await prisma.transaction.findMany({
          where: {
            date: { gte: twelveMonthsAgo },
            transactionType: { in: ['income', 'credit'] },
          },
          select: {
            amount: true,
          },
        });
        
        const totalRevenue = transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
        
        insights.push({
          value: totalRevenue,
          type: 'actual',
          confidence: 95,
          confidence_reason: 'Based on actual transaction data',
          explanation: `Total revenue for last 12 months: ${totalRevenue.toLocaleString()}`,
          data_sources: [
            {
              module: 'Finance',
              table: 'Transaction',
              time_range: { start: twelveMonthsAgo, end: new Date() },
              filters: { transactionType: { in: ['income', 'credit'] } },
            },
          ],
          last_computed_at: new Date(),
          status: 'success',
        });
      }
      
      // Property queries
      if (lowerQuery.includes('property') || lowerQuery.includes('properties')) {
        const propertyCount = await prisma.property.count({
          where: { isDeleted: false },
        });
        
        insights.push({
          value: propertyCount,
          type: 'actual',
          confidence: 100,
          confidence_reason: 'Based on property count',
          explanation: `Total properties in system: ${propertyCount}`,
          data_sources: [
            {
              module: 'Properties',
              table: 'Property',
              filters: { isDeleted: false },
            },
          ],
          last_computed_at: new Date(),
          status: 'success',
        });
      }
      
      // Employee queries
      if (lowerQuery.includes('employee') || lowerQuery.includes('staff')) {
        const employeeCount = await prisma.employee.count({
          where: { isDeleted: false, status: 'active' },
        });
        
        insights.push({
          value: employeeCount,
          type: 'actual',
          confidence: 100,
          confidence_reason: 'Based on employee count',
          explanation: `Active employees: ${employeeCount}`,
          data_sources: [
            {
              module: 'HR',
              table: 'Employee',
              filters: { isDeleted: false, status: 'active' },
            },
          ],
          last_computed_at: new Date(),
          status: 'success',
        });
      }
      
      if (insights.length === 0) {
        return {
          insights: [
            createInsufficientDataInsight('AI Assistant Query', this.getDataSources()),
          ],
          engine_name: this.name,
          computed_at: new Date(),
          status: 'insufficient_data',
        };
      }
      
    } catch (error: any) {
      logger.error(`AI Assistant Engine error: ${error.message}`, error);
      errors.push(error.message);
      insights.push(createErrorInsight('AI Assistant', error.message, this.getDataSources()));
    }
    
    return {
      insights,
      engine_name: this.name,
      computed_at: new Date(),
      status: errors.length > 0 ? 'error' : 'success',
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  
  async compute(): Promise<EngineResult> {
    // AI Assistant doesn't compute automatically
    // It only responds to queries via processQuery()
    return {
      insights: [
        {
          value: 'Query-based engine',
          type: 'actual',
          confidence: 100,
          confidence_reason: 'AI Assistant is query-based',
          explanation: 'AI Assistant engine is retrieval-only and responds to queries. Use processQuery() method.',
          data_sources: this.getDataSources(),
          last_computed_at: new Date(),
          status: 'success',
        },
      ],
      engine_name: this.name,
      computed_at: new Date(),
      status: 'success',
    };
  }
  
  async hasSufficientData(): Promise<boolean> {
    // AI Assistant can work with any available data
    return true;
  }
  
  getDataSources(): DataSource[] {
    return [
      {
        module: 'All',
        table: 'All',
      },
    ];
  }
}
