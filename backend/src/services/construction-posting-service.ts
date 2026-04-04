/**
 * Construction Posting Service
 * Handles all financial postings from Construction module to Finance module
 * Enforces mandatory dimensions and posting rules
 */

import prisma from '../prisma/client';
import { AccountValidationService } from './account-validation-service';
import logger from '../utils/logger';

export interface ConstructionPostingDimensions {
  projectId: string;
  costCodeId: string;
  sourceModule: 'Construction';
  referenceDocumentId: string;
  referenceDocumentType: string; // 'MaterialIssue', 'LaborApproval', 'EquipmentUsage', etc.
  approvalMetadata?: {
    approvedBy: string;
    approvedAt: Date;
    userId: string;
  };
}

export interface PostingRule {
  eventType: string;
  debitAccountCode?: string;
  creditAccountCode?: string;
  description?: string;
}

export class ConstructionPostingService {
  /**
   * Get posting rule for an event type
   */
  static async getPostingRule(eventType: string): Promise<PostingRule | null> {
    const rule = await prisma.constructionPostingRule.findUnique({
      where: { eventType },
    });

    if (!rule || !rule.isActive) {
      return null;
    }

    return {
      eventType: rule.eventType,
      debitAccountCode: rule.debitAccountCode || undefined,
      creditAccountCode: rule.creditAccountCode || undefined,
      description: rule.description || undefined,
    };
  }

  /**
   * Validate mandatory dimensions
   */
  static validateDimensions(dimensions: ConstructionPostingDimensions): void {
    if (!dimensions.projectId) {
      throw new Error('Project ID is mandatory for construction postings');
    }
    if (!dimensions.costCodeId) {
      throw new Error('Cost Code ID is mandatory for construction postings');
    }
    if (dimensions.sourceModule !== 'Construction') {
      throw new Error('Source module must be "Construction"');
    }
    if (!dimensions.referenceDocumentId) {
      throw new Error('Reference Document ID is mandatory');
    }
  }

  /**
   * Get account by code
   */
  static async getAccountByCode(code: string): Promise<string> {
    const account = await prisma.account.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!account) {
      throw new Error(`Account not found with code: ${code}`);
    }

    return account.id;
  }

  /**
   * Post Material Issue to Finance
   * DR: WIP/Expense (based on project accounting mode)
   * CR: Inventory
   */
  static async postMaterialIssue(
    issueId: string,
    dimensions: ConstructionPostingDimensions,
    amount: number,
    userId: string
  ): Promise<string> {
    this.validateDimensions(dimensions);

    // Get project to determine accounting mode
    const project = await prisma.constructionProject.findUnique({
      where: { id: dimensions.projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${dimensions.projectId}`);
    }

    // Get posting rule
    const rule = await this.getPostingRule('MaterialIssue');
    
    // Determine accounts based on accounting mode and rule
    let debitAccountCode: string;
    let creditAccountCode: string;

    if (rule) {
      debitAccountCode = rule.debitAccountCode || (project.accountingMode === 'WIP' ? '5201' : '5301'); // WIP or Direct Expense
      creditAccountCode = rule.creditAccountCode || '1401'; // Inventory
    } else {
      // Default accounts
      debitAccountCode = project.accountingMode === 'WIP' ? '5201' : '5301';
      creditAccountCode = '1401';
    }

    const debitAccountId = await this.getAccountByCode(debitAccountCode);
    const creditAccountId = await this.getAccountByCode(creditAccountCode);

    // Validate accounts are postable
    await AccountValidationService.validateAccountPostable(debitAccountId);
    await AccountValidationService.validateAccountPostable(creditAccountId);

    // Create journal entry
    const entryNumber = this.generateEntryNumber('JV');
    const voucherNo = this.generateVoucherNumber('CONST');

    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        voucherNo,
        date: new Date(),
        description: rule?.description || `Material Issue - Project: ${project.code}`,
        narration: `Material Issue ${issueId} - Cost Code: ${dimensions.costCodeId}`,
        status: 'posted',
        preparedByUserId: userId,
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
              description: `Material Issue - ${project.code}`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: amount,
              description: `Inventory Reduction - Material Issue`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
          ],
        },
      },
    });

    // Update issue with journal entry ID
    await prisma.constructionIssue.update({
      where: { id: issueId },
      data: { journalEntryId: journalEntry.id, status: 'posted' },
    });

    logger.info(`Material Issue ${issueId} posted to Finance: ${journalEntry.id}`);
    return journalEntry.id;
  }

  /**
   * Post Labor Approval to Finance
   * DR: WIP/Expense
   * CR: Payroll Accrual
   */
  static async postLaborApproval(
    laborId: string,
    dimensions: ConstructionPostingDimensions,
    amount: number,
    userId: string
  ): Promise<string> {
    this.validateDimensions(dimensions);

    const project = await prisma.constructionProject.findUnique({
      where: { id: dimensions.projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${dimensions.projectId}`);
    }

    const rule = await this.getPostingRule('LaborApproval');
    
    let debitAccountCode: string;
    let creditAccountCode: string;

    if (rule) {
      debitAccountCode = rule.debitAccountCode || (project.accountingMode === 'WIP' ? '5201' : '5301');
      creditAccountCode = rule.creditAccountCode || '2401'; // Payroll Accrual
    } else {
      debitAccountCode = project.accountingMode === 'WIP' ? '5201' : '5301';
      creditAccountCode = '2401';
    }

    const debitAccountId = await this.getAccountByCode(debitAccountCode);
    const creditAccountId = await this.getAccountByCode(creditAccountCode);

    await AccountValidationService.validateAccountPostable(debitAccountId);
    await AccountValidationService.validateAccountPostable(creditAccountId);

    const entryNumber = this.generateEntryNumber('JV');
    const voucherNo = this.generateVoucherNumber('CONST');

    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        voucherNo,
        date: new Date(),
        description: rule?.description || `Labor Cost - Project: ${project.code}`,
        narration: `Labor Approval ${laborId} - Cost Code: ${dimensions.costCodeId}`,
        status: 'posted',
        preparedByUserId: userId,
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
              description: `Labor Cost - ${project.code}`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: amount,
              description: `Payroll Accrual - Labor`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
          ],
        },
      },
    });

    await prisma.constructionLabor.update({
      where: { id: laborId },
      data: { journalEntryId: journalEntry.id, status: 'posted' },
    });

    logger.info(`Labor Approval ${laborId} posted to Finance: ${journalEntry.id}`);
    return journalEntry.id;
  }

  /**
   * Post Equipment Usage to Finance
   * DR: WIP/Expense
   * CR: Equipment Recovery (Internal)
   */
  static async postEquipmentUsage(
    usageId: string,
    dimensions: ConstructionPostingDimensions,
    amount: number,
    userId: string
  ): Promise<string> {
    this.validateDimensions(dimensions);

    const project = await prisma.constructionProject.findUnique({
      where: { id: dimensions.projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${dimensions.projectId}`);
    }

    const rule = await this.getPostingRule('EquipmentUsage');
    
    let debitAccountCode: string;
    let creditAccountCode: string;

    if (rule) {
      debitAccountCode = rule.debitAccountCode || (project.accountingMode === 'WIP' ? '5201' : '5301');
      creditAccountCode = rule.creditAccountCode || '1501'; // Equipment Recovery
    } else {
      debitAccountCode = project.accountingMode === 'WIP' ? '5201' : '5301';
      creditAccountCode = '1501';
    }

    const debitAccountId = await this.getAccountByCode(debitAccountCode);
    const creditAccountId = await this.getAccountByCode(creditAccountCode);

    await AccountValidationService.validateAccountPostable(debitAccountId);
    await AccountValidationService.validateAccountPostable(creditAccountId);

    const entryNumber = this.generateEntryNumber('JV');
    const voucherNo = this.generateVoucherNumber('CONST');

    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        voucherNo,
        date: new Date(),
        description: rule?.description || `Equipment Usage - Project: ${project.code}`,
        narration: `Equipment Usage ${usageId} - Cost Code: ${dimensions.costCodeId}`,
        status: 'posted',
        preparedByUserId: userId,
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
              description: `Equipment Cost - ${project.code}`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: amount,
              description: `Equipment Recovery - Internal`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
          ],
        },
      },
    });

    await prisma.constructionEquipmentUsage.update({
      where: { id: usageId },
      data: { journalEntryId: journalEntry.id, status: 'posted' },
    });

    logger.info(`Equipment Usage ${usageId} posted to Finance: ${journalEntry.id}`);
    return journalEntry.id;
  }

  /**
   * Post Subcontractor Invoice to Finance
   * DR: WIP/Expense
   * CR: Accounts Payable
   */
  static async postSubcontractorInvoice(
    invoiceId: string,
    dimensions: ConstructionPostingDimensions,
    amount: number,
    userId: string
  ): Promise<string> {
    this.validateDimensions(dimensions);

    const project = await prisma.constructionProject.findUnique({
      where: { id: dimensions.projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${dimensions.projectId}`);
    }

    const rule = await this.getPostingRule('SubcontractorInvoice');
    
    let debitAccountCode: string;
    let creditAccountCode: string;

    if (rule) {
      debitAccountCode = rule.debitAccountCode || (project.accountingMode === 'WIP' ? '5201' : '5301');
      creditAccountCode = rule.creditAccountCode || '2001'; // Accounts Payable
    } else {
      debitAccountCode = project.accountingMode === 'WIP' ? '5201' : '5301';
      creditAccountCode = '2001';
    }

    const debitAccountId = await this.getAccountByCode(debitAccountCode);
    const creditAccountId = await this.getAccountByCode(creditAccountCode);

    await AccountValidationService.validateAccountPostable(debitAccountId);
    await AccountValidationService.validateAccountPostable(creditAccountId);

    const entryNumber = this.generateEntryNumber('JV');
    const voucherNo = this.generateVoucherNumber('CONST');

    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        voucherNo,
        date: new Date(),
        description: rule?.description || `Subcontractor Invoice - Project: ${project.code}`,
        narration: `Subcontractor Invoice ${invoiceId} - Cost Code: ${dimensions.costCodeId}`,
        status: 'posted',
        preparedByUserId: userId,
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debit: amount,
              credit: 0,
              description: `Subcontractor Cost - ${project.code}`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: amount,
              description: `Accounts Payable - Subcontractor`,
              constructionProjectId: dimensions.projectId,
              costCodeId: dimensions.costCodeId,
              sourceModule: dimensions.sourceModule,
              referenceDocumentId: dimensions.referenceDocumentId,
              approvalMetadata: dimensions.approvalMetadata || undefined,
            },
          ],
        },
      },
    });

    logger.info(`Subcontractor Invoice ${invoiceId} posted to Finance: ${journalEntry.id}`);
    return journalEntry.id;
  }

  /**
   * Post Client Billing (Milestone) to Finance
   * DR: Accounts Receivable
   * CR: Revenue (+ Retention if applicable)
   */
  static async postClientBilling(
    milestoneId: string,
    dimensions: ConstructionPostingDimensions,
    billingAmount: number,
    retentionAmount: number,
    userId: string
  ): Promise<string> {
    this.validateDimensions(dimensions);

    const project = await prisma.constructionProject.findUnique({
      where: { id: dimensions.projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${dimensions.projectId}`);
    }

    const rule = await this.getPostingRule('ClientBilling');
    
    const revenueAccountCode = rule?.creditAccountCode || '4001'; // Revenue
    const arAccountCode = '1101'; // Accounts Receivable
    const retentionAccountCode = '2103'; // Retention Payable

    const revenueAccountId = await this.getAccountByCode(revenueAccountCode);
    const arAccountId = await this.getAccountByCode(arAccountCode);
    const retentionAccountId = retentionAmount > 0 ? await this.getAccountByCode(retentionAccountCode) : null;

    await AccountValidationService.validateAccountPostable(revenueAccountId);
    await AccountValidationService.validateAccountPostable(arAccountId);
    if (retentionAccountId) {
      await AccountValidationService.validateAccountPostable(retentionAccountId);
    }

    const entryNumber = this.generateEntryNumber('JV');
    const voucherNo = this.generateVoucherNumber('CONST');

    const lines: any[] = [
      {
        accountId: arAccountId,
        debit: billingAmount,
        credit: 0,
        description: `Client Billing - ${project.code}`,
        constructionProjectId: dimensions.projectId,
        costCodeId: dimensions.costCodeId,
        sourceModule: dimensions.sourceModule,
        referenceDocumentId: dimensions.referenceDocumentId,
        approvalMetadata: dimensions.approvalMetadata || undefined,
      },
      {
        accountId: revenueAccountId,
        debit: 0,
        credit: billingAmount - retentionAmount,
        description: `Revenue - Milestone Billing`,
        constructionProjectId: dimensions.projectId,
        costCodeId: dimensions.costCodeId,
        sourceModule: dimensions.sourceModule,
        referenceDocumentId: dimensions.referenceDocumentId,
        approvalMetadata: dimensions.approvalMetadata || undefined,
      },
    ];

    if (retentionAmount > 0 && retentionAccountId) {
      lines.push({
        accountId: retentionAccountId,
        debit: 0,
        credit: retentionAmount,
        description: `Retention - Milestone Billing`,
        constructionProjectId: dimensions.projectId,
        costCodeId: dimensions.costCodeId,
        sourceModule: dimensions.sourceModule,
        referenceDocumentId: dimensions.referenceDocumentId,
        approvalMetadata: dimensions.approvalMetadata || undefined,
      });
    }

    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        voucherNo,
        date: new Date(),
        description: rule?.description || `Client Billing - Project: ${project.code}`,
        narration: `Milestone Billing ${milestoneId}`,
        status: 'posted',
        preparedByUserId: userId,
        lines: {
          create: lines,
        },
      },
    });

    logger.info(`Client Billing ${milestoneId} posted to Finance: ${journalEntry.id}`);
    return journalEntry.id;
  }

  /**
   * Post Project Close (WIP to COGS)
   * DR: Cost of Goods Sold
   * CR: WIP
   */
  static async postProjectClose(
    projectId: string,
    wipAmount: number,
    userId: string
  ): Promise<string> {
    const project = await prisma.constructionProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    if (project.accountingMode !== 'WIP') {
      throw new Error('Project close posting only applicable for WIP accounting mode');
    }

    const rule = await this.getPostingRule('ProjectClose');
    
    const cogsAccountCode = rule?.debitAccountCode || '5101'; // COGS
    const wipAccountCode = '5201'; // WIP

    const cogsAccountId = await this.getAccountByCode(cogsAccountCode);
    const wipAccountId = await this.getAccountByCode(wipAccountCode);

    await AccountValidationService.validateAccountPostable(cogsAccountId);
    await AccountValidationService.validateAccountPostable(wipAccountId);

    const entryNumber = this.generateEntryNumber('JV');
    const voucherNo = this.generateVoucherNumber('CONST');

    const journalEntry = await prisma.journalEntry.create({
      data: {
        entryNumber,
        voucherNo,
        date: new Date(),
        description: rule?.description || `Project Close - ${project.code}`,
        narration: `Project Close - WIP Transfer to COGS`,
        status: 'posted',
        preparedByUserId: userId,
        lines: {
          create: [
            {
              accountId: cogsAccountId,
              debit: wipAmount,
              credit: 0,
              description: `COGS - Project Close`,
              constructionProjectId: projectId,
              sourceModule: 'Construction',
              referenceDocumentId: projectId,
              approvalMetadata: {
                approvedBy: userId,
                approvedAt: new Date(),
                userId,
              },
            },
            {
              accountId: wipAccountId,
              debit: 0,
              credit: wipAmount,
              description: `WIP Reduction - Project Close`,
              constructionProjectId: projectId,
              sourceModule: 'Construction',
              referenceDocumentId: projectId,
              approvalMetadata: {
                approvedBy: userId,
                approvedAt: new Date(),
                userId,
              },
            },
          ],
        },
      },
    });

    logger.info(`Project Close ${projectId} posted to Finance: ${journalEntry.id}`);
    return journalEntry.id;
  }

  /**
   * Generate journal entry number
   */
  private static generateEntryNumber(prefix: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const random = Math.floor(100 + Math.random() * 900).toString();
    return `${prefix}-${year}${month}${day}-${random}`;
  }

  /**
   * Generate voucher number
   */
  private static generateVoucherNumber(prefix: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000).toString();
    return `${prefix}-${year}${month}${day}-${random}`;
  }
}
