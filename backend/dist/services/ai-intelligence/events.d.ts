/**
 * AI Intelligence Event System
 *
 * Event-driven recalculation:
 * - AI recalculation must be event-driven
 * - Never on page load
 * - Triggered by data changes
 */
import { EventEmitter } from 'events';
export type AIEventType = 'finance.transaction.created' | 'finance.transaction.updated' | 'finance.invoice.created' | 'finance.payment.created' | 'property.created' | 'property.updated' | 'property.tenant.assigned' | 'property.tenant.removed' | 'construction.project.created' | 'construction.project.updated' | 'construction.expense.created' | 'hr.employee.created' | 'hr.employee.updated' | 'hr.attendance.created' | 'hr.payroll.created' | 'crm.lead.created' | 'crm.lead.updated' | 'crm.client.created' | 'crm.deal.created' | 'crm.deal.updated' | 'tenant.created' | 'tenant.updated' | 'tenant.payment.created';
declare class AIEventEmitter extends EventEmitter {
    /**
     * Emit an event and trigger cache invalidation
     */
    emit(event: AIEventType, ...args: any[]): boolean;
    /**
     * Invalidate cache based on event type
     */
    private invalidateCacheForEvent;
}
export declare const aiEvents: AIEventEmitter;
/**
 * Helper to emit AI events from other services
 */
export declare function emitAIEvent(event: AIEventType, data?: any): void;
export {};
//# sourceMappingURL=events.d.ts.map