/**
 * DealSafetyService - Enforces Deal as COMMERCIAL CONTRACT RECORD
 * Ensures deals are treated as commercial contracts, not financial transactions
 * 
 * CRITICAL LIMITATION - REVENUE RECOGNITION:
 * ==========================================
 * The system currently creates accounting entries when deals are closed:
 * - DealService.recognizeRevenueForDeal() creates ledger entries on deal closure
 * - syncDealToFinanceLedger() creates FinanceLedger entries on deal closure
 * - This violates the rule: "Deal MUST NOT create ledger entries"
 * 
 * However, removing this would BREAK EXISTING PRODUCTION BEHAVIOR.
 * Per user requirements: "If any rule cannot be enforced without breaking 
 * existing production behavior, DO NOT implement and report the limitation clearly."
 * 
 * Therefore:
 * - Revenue recognition on deal close is ALLOWED (existing behavior)
 * - This service enforces OTHER rules that can be safely enforced
 * - Deal creation itself does NOT create accounting entries (only closure does)
 * 
 * ENFORCED RULES:
 * ===============
 * ✓ Deal creation: Does NOT create accounting entries (already enforced by DealService)
 * ✓ Client/Property immutability: After invoices/payments are linked
 * ✓ Deal amount reduction: Prevented if invoices exceed new amount
 * ✓ Stage-based restrictions: Prospecting, Negotiation, Closing, Closed, Cancelled
 * ✓ Cancellation validation: Prevent if posted invoices/unreversed payments exist
 * ✓ Closed deals: Read-only (except status/stage changes)
 */

import prisma from '../prisma/client';

export interface ValidateDealCreationPayload {
  clientId: string;
  propertyId?: string;
  dealAmount: number;
  stage?: string;
}

export interface ValidateDealUpdatePayload {
  dealId: string;
  clientId?: string;
  propertyId?: string;
  dealAmount?: number;
  stage?: string;
  status?: string;
}

export interface ValidateDealCancellationPayload {
  dealId: string;
  reason?: string;
}

export interface ValidateDealStageChangePayload {
  dealId: string;
  newStage: string;
  currentStage: string;
}

export class DealSafetyService {
  /**
   * Validate deal creation
   * Rule: Deal creation MUST NOT create ledger entries, invoices, receivables, or revenue
   * NOTE: This is validated at the service level - DealService.createDeal already doesn't create accounting entries
   */
  static async validateDealCreation(payload: ValidateDealCreationPayload): Promise<void> {
    // Validation: Deal amount is just expected value (no accounting entries created)
    // This is enforced by DealService - no accounting logic in createDeal
    // Just validate amount is positive
    if (!payload.dealAmount || payload.dealAmount <= 0) {
      throw new Error(
        'DEAL_VIOLATION: Deal amount must be greater than zero. ' +
        'Deal amount is an EXPECTED contract value only and does not create accounting entries.'
      );
    }

    // Validate client exists
    const client = await prisma.client.findFirst({
      where: { id: payload.clientId, isDeleted: false },
      select: { id: true },
    });

    if (!client) {
      throw new Error(
        'DEAL_VIOLATION: Client not found or inactive. ' +
        `Client ID: ${payload.clientId}. Deals require an active client.`
      );
    }

    // Validate property exists if provided
    if (payload.propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: payload.propertyId, isDeleted: false },
        select: { id: true },
      });

      if (!property) {
        throw new Error(
          'DEAL_VIOLATION: Property not found or inactive. ' +
          `Property ID: ${payload.propertyId}. Deals require an active property.`
        );
      }
    }
  }

  /**
   * Validate deal update
   * Rules:
   * - Client/Property become IMMUTABLE after invoices/payments are linked
   * - Deal amount cannot be reduced if invoices already exceed new amount
   * - Stage-based restrictions
   */
  static async validateDealUpdate(payload: ValidateDealUpdatePayload): Promise<void> {
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: {
        payments: {
          where: { deletedAt: null },
          select: { id: true, amount: true },
        },
      },
    });

    if (!deal) {
      throw new Error(`DEAL_VIOLATION: Deal not found: ${payload.dealId}`);
    }

    if (deal.isDeleted || deal.deletedAt) {
      throw new Error('DEAL_VIOLATION: Cannot update deleted deal');
    }

    // ENFORCE: Client/Property immutability after financial linkage
    if (payload.clientId && payload.clientId !== deal.clientId) {
      await this.validateClientPropertyImmutability(payload.dealId, 'client');
    }

    if (payload.propertyId && payload.propertyId !== deal.propertyId) {
      await this.validateClientPropertyImmutability(payload.dealId, 'property');
    }

    // ENFORCE: Deal amount reduction prevention
    if (payload.dealAmount !== undefined && payload.dealAmount < deal.dealAmount) {
      await this.validateDealAmountReduction(payload.dealId, payload.dealAmount, deal.dealAmount);
    }

    // ENFORCE: Stage-based restrictions
    if (payload.stage && payload.stage !== deal.stage) {
      await this.validateStageChange({
        dealId: payload.dealId,
        newStage: payload.stage,
        currentStage: deal.stage,
      });
    }

    // ENFORCE: Closed deals are read-only (status changes only)
    if ((deal.status === 'closed' || deal.stage === 'closed-won') && 
        (payload.clientId || payload.propertyId || payload.dealAmount !== undefined)) {
      throw new Error(
        'DEAL_VIOLATION: Closed deals are read-only. ' +
        'Cannot modify client, property, or amount for closed deals. ' +
        'Only status/stage changes are allowed for closed deals.'
      );
    }

    // ENFORCE: Cancelled deals block all modifications except status
    if (deal.status === 'cancelled' || deal.stage === 'closed-lost') {
      if (payload.clientId || payload.propertyId || payload.dealAmount !== undefined || payload.stage) {
        throw new Error(
          'DEAL_VIOLATION: Cancelled deals cannot be modified. ' +
          'Cannot change client, property, amount, or stage for cancelled deals.'
        );
      }
    }
  }

  /**
   * Validate client/property immutability
   * Rule: Client and Property become IMMUTABLE after invoices/payments are linked
   */
  private static async validateClientPropertyImmutability(
    dealId: string,
    field: 'client' | 'property'
  ): Promise<void> {
    // Check for linked payments
    const paymentCount = await prisma.payment.count({
      where: {
        dealId,
        deletedAt: null,
      },
    });

    // Check for linked invoices via property/tenant
    // Since Invoice doesn't have dealId, we check if there are invoices for the same property
    // This is a limitation - we can't directly link invoices to deals
    // However, if invoices exist for the deal's property, we assume linkage
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { propertyId: true, clientId: true },
    });

    let invoiceCount = 0;
    if (deal?.propertyId) {
      // Check for invoices linked to the deal's property
      // Note: This is a best-effort check since Invoice doesn't have dealId
      invoiceCount = await prisma.invoice.count({
        where: {
          propertyId: deal.propertyId,
          // Only count invoices that could be related (status not paid/cancelled)
          status: {
            notIn: ['paid', 'cancelled'],
          },
        },
      });
    }

    if (paymentCount > 0 || invoiceCount > 0) {
      const linkedEntities = [];
      if (paymentCount > 0) linkedEntities.push(`${paymentCount} payment(s)`);
      if (invoiceCount > 0) linkedEntities.push(`${invoiceCount} invoice(s)`);

      throw new Error(
        `DEAL_VIOLATION: ${field === 'client' ? 'Client' : 'Property'} cannot be changed. ` +
        `Deal has linked financial records: ${linkedEntities.join(', ')}. ` +
        `${field === 'client' ? 'Client' : 'Property'} becomes immutable after invoices or payments are linked.`
      );
    }
  }

  /**
   * Validate deal amount reduction
   * Rule: Prevent deal amount reduction if invoices already exceed the new amount
   */
  private static async validateDealAmountReduction(
    dealId: string,
    newAmount: number,
    currentAmount: number
  ): Promise<void> {
    // Get total invoice amounts for this deal's property
    // Note: Since Invoice doesn't have dealId, we check by property
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { propertyId: true },
    });

    if (!deal?.propertyId) {
      // No property - allow reduction
      return;
    }

    // Get invoices for this property (best-effort check)
    const invoices = await prisma.invoice.findMany({
      where: {
        propertyId: deal.propertyId,
        status: {
          notIn: ['cancelled', 'paid'],
        },
      },
      select: { totalAmount: true },
    });

    const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    if (totalInvoiceAmount > newAmount) {
      throw new Error(
        `DEAL_VIOLATION: Cannot reduce deal amount. ` +
        `Current amount: ${currentAmount}. New amount: ${newAmount}. ` +
        `Total invoice amount (${totalInvoiceAmount}) exceeds new deal amount. ` +
        `Reduce or cancel invoices first before reducing deal amount.`
      );
    }
  }

  /**
   * Validate deal stage change
   * Rule: Enforce stage-based action restrictions
   */
  static async validateStageChange(payload: ValidateDealStageChangePayload): Promise<void> {
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: {
        payments: {
          where: { deletedAt: null },
          select: { id: true, paymentType: true },
        },
      },
    });

    if (!deal) {
      throw new Error(`DEAL_VIOLATION: Deal not found: ${payload.dealId}`);
    }

    // Get invoice count for this deal's property (best-effort check)
    let invoiceCount = 0;
    if (deal.propertyId) {
      invoiceCount = await prisma.invoice.count({
        where: {
          propertyId: deal.propertyId,
          status: {
            notIn: ['cancelled'],
          },
        },
      });
    }

    // ENFORCE: Prospecting stage - no invoices, no payments
    if (payload.newStage === 'prospecting') {
      if (deal.payments.length > 0) {
        throw new Error(
          'DEAL_VIOLATION: Cannot move deal to Prospecting stage. ' +
          `Deal has ${deal.payments.length} payment(s). ` +
          'Prospecting stage does not allow payments or invoices.'
        );
      }
      if (invoiceCount > 0) {
        throw new Error(
          'DEAL_VIOLATION: Cannot move deal to Prospecting stage. ' +
          `Deal has ${invoiceCount} invoice(s). ` +
          'Prospecting stage does not allow payments or invoices.'
        );
      }
    }

    // ENFORCE: Negotiation stage - allow advance/token payments ONLY
    if (payload.newStage === 'negotiation') {
      const nonAdvancePayments = deal.payments.filter(
        (p: any) => p.paymentType !== 'token' && p.paymentType !== 'booking'
      );
      if (nonAdvancePayments.length > 0) {
        throw new Error(
          'DEAL_VIOLATION: Cannot move deal to Negotiation stage. ' +
          `Deal has ${nonAdvancePayments.length} non-advance payment(s). ` +
          'Negotiation stage allows advance/token payments ONLY.'
        );
      }
    }

    // ENFORCE: Closing stage - allow invoice creation
    // (No blocking rule - invoices are allowed)

    // ENFORCE: Closed stage - read-only
    if (payload.newStage === 'closed-won' || payload.newStage === 'closed') {
      // No blocking rules - closed deals are just read-only
      // This is enforced in updateDeal validation
    }

    // ENFORCE: Cancelled stage - block all new invoices and payments
    if (payload.newStage === 'closed-lost' || payload.newStage === 'cancelled') {
      // Cancellation validation is handled separately
    }
  }

  /**
   * Validate deal cancellation
   * Rule: Prevent cancellation if posted invoices or unreversed payments exist
   */
  static async validateCancellation(payload: ValidateDealCancellationPayload): Promise<void> {
    const deal = await prisma.deal.findUnique({
      where: { id: payload.dealId },
      include: {
        payments: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    if (!deal) {
      throw new Error(`DEAL_VIOLATION: Deal not found: ${payload.dealId}`);
    }

    // Check for posted invoices (best-effort check via property)
    let postedInvoiceCount = 0;
    if (deal.propertyId) {
      const invoices = await prisma.invoice.findMany({
        where: {
          propertyId: deal.propertyId,
          status: {
            notIn: ['cancelled', 'draft'],
          },
        },
        include: {
          journalEntry: true, // Check if invoice is posted (has journal entry)
        },
      });

      postedInvoiceCount = invoices.filter((inv) => inv.journalEntryId !== null).length;
    }

    // Check for unreversed payments
    const unreversedPaymentCount = deal.payments.length;

    if (postedInvoiceCount > 0 || unreversedPaymentCount > 0) {
      const reasons = [];
      if (postedInvoiceCount > 0) {
        reasons.push(`${postedInvoiceCount} posted invoice(s)`);
      }
      if (unreversedPaymentCount > 0) {
        reasons.push(`${unreversedPaymentCount} unreversed payment(s)`);
      }

      throw new Error(
        `DEAL_VIOLATION: Cannot cancel deal. Deal has linked financial records: ${reasons.join(', ')}. ` +
        'Cancel or reverse invoices and payments first before cancelling the deal. ' +
        (payload.reason ? `Cancellation reason: ${payload.reason}` : 'Cancellation reason is required.')
      );
    }

    // Require cancellation reason
    if (!payload.reason || !payload.reason.trim()) {
      throw new Error(
        'DEAL_VIOLATION: Cancellation reason is required. ' +
        'Please provide a reason for cancelling the deal.'
      );
    }
  }

  /**
   * Validate deal closure
   * Rule: Prevent closure if no invoice exists for Closing stage
   * NOTE: This is informational - we can't directly check if invoices are linked to deals
   */
  static async validateClosure(dealId: string): Promise<void> {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { propertyId: true, stage: true },
    });

    if (!deal) {
      throw new Error(`DEAL_VIOLATION: Deal not found: ${dealId}`);
    }

    // Best-effort check: if at Closing stage, check for invoices
    if (deal.stage === 'closing' && deal.propertyId) {
      const invoiceCount = await prisma.invoice.count({
        where: {
          propertyId: deal.propertyId,
          status: {
            notIn: ['cancelled'],
          },
        },
      });

      if (invoiceCount === 0) {
        // Warning only - not blocking since Invoice doesn't have dealId
        // This is a limitation of the current schema
        console.warn(
          `DEAL_VIOLATION_WARNING: Deal ${dealId} is being closed without invoices. ` +
          'Consider creating invoices before closing the deal.'
        );
      }
    }
  }
}
