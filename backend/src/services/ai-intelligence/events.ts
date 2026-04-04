/**
 * AI Intelligence Event System
 * 
 * Event-driven recalculation:
 * - AI recalculation must be event-driven
 * - Never on page load
 * - Triggered by data changes
 */

import { EventEmitter } from 'events';
import logger from '../../utils/logger';
import { aiCache } from './cache';

export type AIEventType =
  | 'finance.transaction.created'
  | 'finance.transaction.updated'
  | 'finance.invoice.created'
  | 'finance.payment.created'
  | 'property.created'
  | 'property.updated'
  | 'property.tenant.assigned'
  | 'property.tenant.removed'
  | 'construction.project.created'
  | 'construction.project.updated'
  | 'construction.expense.created'
  | 'hr.employee.created'
  | 'hr.employee.updated'
  | 'hr.attendance.created'
  | 'hr.payroll.created'
  | 'crm.lead.created'
  | 'crm.lead.updated'
  | 'crm.client.created'
  | 'crm.deal.created'
  | 'crm.deal.updated'
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.payment.created';

class AIEventEmitter extends EventEmitter {
  /**
   * Emit an event and trigger cache invalidation
   */
  emit(event: AIEventType, ...args: any[]): boolean {
    logger.debug(`AI Event: ${event}`);

    // Invalidate relevant cache entries
    this.invalidateCacheForEvent(event);

    return super.emit(event, ...args);
  }

  /**
   * Invalidate cache based on event type
   */
  private invalidateCacheForEvent(event: AIEventType): void {
    if (event.startsWith('finance.')) {
      aiCache.invalidatePattern('^financial-intelligence:');
      aiCache.invalidatePattern('^transaction-risk:');
    }

    if (event.startsWith('property.')) {
      aiCache.invalidatePattern('^asset-intelligence:');
    }

    if (event.startsWith('construction.')) {
      aiCache.invalidatePattern('^construction-intelligence:');
    }

    if (event.startsWith('hr.')) {
      aiCache.invalidatePattern('^workforce-intelligence:');
    }

    if (event.startsWith('crm.')) {
      aiCache.invalidatePattern('^crm-revenue-intelligence:');
    }

    if (event.startsWith('tenant.')) {
      aiCache.invalidatePattern('^tenant-intelligence:');
    }

    // Operational anomalies depend on all modules
    aiCache.invalidatePattern('^operational-anomaly:');
  }
}

export const aiEvents = new AIEventEmitter();

/**
 * Helper to emit AI events from other services
 */
export function emitAIEvent(event: AIEventType, data?: any): void {
  aiEvents.emit(event, data);
}
