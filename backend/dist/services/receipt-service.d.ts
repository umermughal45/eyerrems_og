import { Prisma } from '../prisma/client';
export interface CreateReceiptPayload {
    dealId: string;
    clientId: string;
    amount: number;
    method: 'Cash' | 'Bank';
    date: Date | string;
    notes?: string;
    referenceNumber?: string;
    receivedBy?: string;
    existingPaymentId?: string;
    skipPaymentCreation?: boolean;
    manualUniqueId?: string;
    isAdvance?: boolean;
}
export interface ReceiptAllocationResult {
    receiptId: string;
    allocations: Array<{
        installmentId: string;
        installmentNumber: number;
        amountAllocated: number;
        status: string;
    }>;
    totalAllocated: number;
    remainingAmount: number;
}
export declare class ReceiptService {
    /**
     * Generate receipt number in format rcp-YY-####
     * Uses centralized ID generation service
     */
    static generateReceiptNumber(): Promise<string>;
    /**
     * Create receipt and automatically allocate to installments using FIFO
     */
    static createReceipt(payload: CreateReceiptPayload): Promise<ReceiptAllocationResult>;
    /**
     * FIFO Allocation Algorithm
     * Applies receipt amount to earliest Pending/Partial installments
     */
    static allocateReceiptFIFO(receiptId: string, dealId: string, receiptAmount: number, tx: Prisma.TransactionClient): Promise<Array<{
        installmentId: string;
        installmentNumber: number;
        amountAllocated: number;
        status: string;
    }>>;
    /**
     * Get receipts for a deal
     */
    static getReceiptsByDealId(dealId: string): Promise<({
        allocations: ({
            installment: {
                id: string;
                amount: number;
                dueDate: Date;
                installmentNumber: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            installmentId: string;
            receiptId: string;
            amountAllocated: number;
        })[];
        receivedByUser: {
            id: string;
            username: string;
            email: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        manualUniqueId: string | null;
        clientId: string;
        dealId: string;
        receiptNo: string;
        amount: number;
        method: string;
        date: Date;
        notes: string | null;
        receivedBy: string | null;
        pdfUrl: string | null;
        journalEntryId: string | null;
        referenceNumber: string | null;
    })[]>;
    /**
     * Get receipt by ID
     */
    static getReceiptById(receiptId: string): Promise<({
        client: {
            status: string;
            name: string;
            id: string;
            email: string | null;
            createdAt: Date;
            updatedAt: Date;
            phone: string | null;
            company: string | null;
            address: string | null;
            clientCode: string | null;
            clientNo: string | null;
            cnic: string | null;
            srNo: number | null;
            assignedAgentId: string | null;
            assignedDealerId: string | null;
            attachments: Prisma.JsonValue | null;
            billingAddress: string | null;
            city: string | null;
            clientCategory: string | null;
            clientType: string | null;
            cnicDocumentUrl: string | null;
            convertedFromLeadId: string | null;
            country: string | null;
            createdBy: string | null;
            isDeleted: boolean;
            postalCode: string | null;
            propertyInterest: string | null;
            tags: Prisma.JsonValue | null;
            updatedBy: string | null;
            manualUniqueId: string | null;
            propertySubsidiary: string | null;
            tid: string | null;
        };
        journalEntry: ({
            lines: ({
                account: {
                    level: number;
                    code: string;
                    type: string;
                    name: string;
                    id: string;
                    createdAt: Date;
                    updatedAt: Date;
                    description: string | null;
                    isActive: boolean;
                    parentId: string | null;
                    isPostable: boolean;
                    cashFlowCategory: string | null;
                    accountType: string;
                    normalBalance: string;
                    trustFlag: boolean;
                };
            } & {
                id: string;
                description: string | null;
                accountId: string;
                credit: number;
                debit: number;
                approvalMetadata: Prisma.JsonValue | null;
                referenceDocumentId: string | null;
                sourceModule: string | null;
                constructionProjectId: string | null;
                costCodeId: string | null;
                entryId: string;
            })[];
        } & {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: Prisma.JsonValue | null;
            date: Date;
            approvedByUserId: string | null;
            voucherNo: string | null;
            description: string | null;
            narration: string | null;
            entryNumber: string;
            preparedByUserId: string | null;
        }) | null;
        allocations: ({
            installment: {
                type: string | null;
                status: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                isDeleted: boolean;
                clientId: string;
                dealId: string;
                amount: number;
                notes: string | null;
                ledgerEntryId: string | null;
                dueDate: Date;
                paymentMode: string | null;
                remaining: number;
                installmentNumber: number;
                paymentPlanId: string;
                paidDate: Date | null;
                paidAmount: number;
                penalty: number;
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            installmentId: string;
            receiptId: string;
            amountAllocated: number;
        })[];
        deal: {
            client: {
                status: string;
                name: string;
                id: string;
                email: string | null;
                createdAt: Date;
                updatedAt: Date;
                phone: string | null;
                company: string | null;
                address: string | null;
                clientCode: string | null;
                clientNo: string | null;
                cnic: string | null;
                srNo: number | null;
                assignedAgentId: string | null;
                assignedDealerId: string | null;
                attachments: Prisma.JsonValue | null;
                billingAddress: string | null;
                city: string | null;
                clientCategory: string | null;
                clientType: string | null;
                cnicDocumentUrl: string | null;
                convertedFromLeadId: string | null;
                country: string | null;
                createdBy: string | null;
                isDeleted: boolean;
                postalCode: string | null;
                propertyInterest: string | null;
                tags: Prisma.JsonValue | null;
                updatedBy: string | null;
                manualUniqueId: string | null;
                propertySubsidiary: string | null;
                tid: string | null;
            } | null;
            property: {
                type: string;
                status: string;
                name: string;
                id: string;
                createdAt: Date;
                updatedAt: Date;
                address: string;
                city: string | null;
                isDeleted: boolean;
                manualUniqueId: string | null;
                propertySubsidiary: string | null;
                tid: string | null;
                dealerId: string | null;
                description: string | null;
                title: string | null;
                category: string | null;
                location: string | null;
                imageUrl: string | null;
                yearBuilt: number | null;
                totalArea: number | null;
                totalUnits: number;
                propertyCode: string | null;
                documents: Prisma.JsonValue | null;
                ownerName: string | null;
                ownerPhone: string | null;
                previousTenants: Prisma.JsonValue | null;
                rentAmount: number | null;
                rentEscalationPercentage: number | null;
                securityDeposit: number | null;
                size: number | null;
                locationId: string | null;
                amenities: string[];
                salePrice: number | null;
                subsidiaryOptionId: string | null;
            } | null;
        } & {
            status: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            attachments: Prisma.JsonValue | null;
            createdBy: string | null;
            isDeleted: boolean;
            tags: Prisma.JsonValue | null;
            updatedBy: string | null;
            manualUniqueId: string | null;
            tid: string | null;
            clientId: string | null;
            notes: string | null;
            dealerId: string | null;
            approvedAt: Date | null;
            propertyId: string | null;
            title: string;
            deletedAt: Date | null;
            deletedBy: string | null;
            role: string | null;
            unitId: string | null;
            locationId: string | null;
            subsidiaryOptionId: string | null;
            dealCode: string | null;
            dealAmount: number;
            commissionRate: number;
            stage: string;
            actualClosingDate: Date | null;
            approvedBy: string | null;
            commissionAmount: number;
            dealType: string | null;
            expectedClosingDate: Date | null;
            expectedRevenue: number | null;
            probability: number;
            requiresApproval: boolean;
            valueBreakdown: Prisma.JsonValue | null;
            dealDate: Date;
            totalPaid: number;
            listingPriceSnapshot: number | null;
            varianceAmount: number | null;
            varianceType: string | null;
        };
        receivedByUser: {
            id: string;
            username: string;
            email: string;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        manualUniqueId: string | null;
        clientId: string;
        dealId: string;
        receiptNo: string;
        amount: number;
        method: string;
        date: Date;
        notes: string | null;
        receivedBy: string | null;
        pdfUrl: string | null;
        journalEntryId: string | null;
        referenceNumber: string | null;
    }) | null>;
}
//# sourceMappingURL=receipt-service.d.ts.map