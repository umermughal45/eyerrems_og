/**
 * Finance Operations Extension Service
 * Refund, Transfer, Merge - additive only, no modification of existing records.
 * All operations create NEW vouchers and maintain full audit trail.
 */
import { FinancialOperationType, FinancialOperationStatus } from '@prisma/client';
export type OperationRequestPayload = {
    operationType: FinancialOperationType;
    reason: string;
    dealId?: string;
    amount?: number;
    partialAmount?: number;
    sourcePaymentId?: string;
    sourceClientId?: string;
    targetClientId?: string;
    sourceDealId?: string;
    targetDealId?: string;
    sourcePropertyId?: string;
    targetPropertyId?: string;
};
/**
 * Compute transferable balance for a payment (amount not yet refunded/transferred/merged).
 * Used for Transfer and Merge validation.
 */
export declare function getTransferableBalance(paymentId: string): Promise<{
    transferableBalance: number;
    paymentAmount: number;
}>;
export declare function createOperationRequest(payload: OperationRequestPayload, requestedByUserId: string): Promise<{
    deal: {
        id: string;
        title: string;
        dealCode: string | null;
    } | null;
    references: {
        id: string;
        createdAt: Date;
        role: string;
        operationId: string;
        refType: string;
        refId: string;
    }[];
    requestedBy: {
        id: string;
        username: string;
    } | null;
} & {
    status: import(".prisma/client").$Enums.FinancialOperationStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    dealId: string | null;
    amount: number | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
    postedByUserId: string | null;
    postedAt: Date | null;
    operationType: import(".prisma/client").$Enums.FinancialOperationType;
    reason: string;
    partialAmount: number | null;
    requestedByUserId: string | null;
    voucherId: string | null;
}>;
export declare function approveOperation(operationId: string, approvedByUserId: string): Promise<{
    deal: {
        id: string;
        title: string;
        dealCode: string | null;
    } | null;
    approvedBy: {
        id: string;
        username: string;
    } | null;
    references: {
        id: string;
        createdAt: Date;
        role: string;
        operationId: string;
        refType: string;
        refId: string;
    }[];
    requestedBy: {
        id: string;
        username: string;
    } | null;
} & {
    status: import(".prisma/client").$Enums.FinancialOperationStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    dealId: string | null;
    amount: number | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
    postedByUserId: string | null;
    postedAt: Date | null;
    operationType: import(".prisma/client").$Enums.FinancialOperationType;
    reason: string;
    partialAmount: number | null;
    requestedByUserId: string | null;
    voucherId: string | null;
}>;
export declare function rejectOperation(operationId: string): Promise<{
    references: {
        id: string;
        createdAt: Date;
        role: string;
        operationId: string;
        refType: string;
        refId: string;
    }[];
    requestedBy: {
        id: string;
        username: string;
    } | null;
} & {
    status: import(".prisma/client").$Enums.FinancialOperationStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    dealId: string | null;
    amount: number | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
    postedByUserId: string | null;
    postedAt: Date | null;
    operationType: import(".prisma/client").$Enums.FinancialOperationType;
    reason: string;
    partialAmount: number | null;
    requestedByUserId: string | null;
    voucherId: string | null;
}>;
/**
 * Execute (post) an approved operation - creates NEW voucher only.
 * No modification of existing payments, vouchers, or records.
 */
export declare function executeOperation(operationId: string, postedByUserId: string): Promise<{
    voucher: {
        type: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        dealId: string | null;
        amount: number;
        date: Date;
        journalEntryId: string | null;
        referenceNumber: string | null;
        propertyId: string | null;
        description: string | null;
        preparedByUserId: string | null;
        approvedByUserId: string | null;
        paymentMethod: string;
        voucherNumber: string;
        postingDate: Date | null;
        accountId: string;
        expenseCategoryId: string | null;
        postedByUserId: string | null;
        postedAt: Date | null;
        unitId: string | null;
        payeeType: string | null;
        payeeId: string | null;
        reversedVoucherId: string | null;
        reversedByUserId: string | null;
        reversedAt: Date | null;
    } | null;
    deal: {
        id: string;
        title: string;
        dealCode: string | null;
    } | null;
    approvedBy: {
        id: string;
        username: string;
    } | null;
    references: {
        id: string;
        createdAt: Date;
        role: string;
        operationId: string;
        refType: string;
        refId: string;
    }[];
    postedBy: {
        id: string;
        username: string;
    } | null;
    requestedBy: {
        id: string;
        username: string;
    } | null;
} & {
    status: import(".prisma/client").$Enums.FinancialOperationStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    dealId: string | null;
    amount: number | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
    postedByUserId: string | null;
    postedAt: Date | null;
    operationType: import(".prisma/client").$Enums.FinancialOperationType;
    reason: string;
    partialAmount: number | null;
    requestedByUserId: string | null;
    voucherId: string | null;
}>;
export declare function listOperations(filters?: {
    status?: FinancialOperationStatus;
    operationType?: FinancialOperationType;
    dealId?: string;
    limit?: number;
    offset?: number;
}): Promise<{
    rows: ({
        voucher: {
            type: string;
            status: string;
            id: string;
            amount: number;
            voucherNumber: string;
        } | null;
        deal: {
            id: string;
            title: string;
            dealCode: string | null;
        } | null;
        approvedBy: {
            id: string;
            username: string;
        } | null;
        references: {
            id: string;
            createdAt: Date;
            role: string;
            operationId: string;
            refType: string;
            refId: string;
        }[];
        postedBy: {
            id: string;
            username: string;
        } | null;
        requestedBy: {
            id: string;
            username: string;
        } | null;
    } & {
        status: import(".prisma/client").$Enums.FinancialOperationStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        dealId: string | null;
        amount: number | null;
        approvedAt: Date | null;
        approvedByUserId: string | null;
        postedByUserId: string | null;
        postedAt: Date | null;
        operationType: import(".prisma/client").$Enums.FinancialOperationType;
        reason: string;
        partialAmount: number | null;
        requestedByUserId: string | null;
        voucherId: string | null;
    })[];
    total: number;
}>;
export declare function getOperationById(id: string): Promise<({
    voucher: {
        type: string;
        status: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        attachments: import("@prisma/client/runtime/library").JsonValue | null;
        dealId: string | null;
        amount: number;
        date: Date;
        journalEntryId: string | null;
        referenceNumber: string | null;
        propertyId: string | null;
        description: string | null;
        preparedByUserId: string | null;
        approvedByUserId: string | null;
        paymentMethod: string;
        voucherNumber: string;
        postingDate: Date | null;
        accountId: string;
        expenseCategoryId: string | null;
        postedByUserId: string | null;
        postedAt: Date | null;
        unitId: string | null;
        payeeType: string | null;
        payeeId: string | null;
        reversedVoucherId: string | null;
        reversedByUserId: string | null;
        reversedAt: Date | null;
    } | null;
    deal: {
        id: string;
        clientId: string | null;
        title: string;
        dealCode: string | null;
    } | null;
    approvedBy: {
        id: string;
        username: string;
    } | null;
    lines: {
        id: string;
        createdAt: Date;
        amount: number | null;
        role: string;
        entityType: string;
        entityId: string;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        operationId: string;
    }[];
    references: {
        id: string;
        createdAt: Date;
        role: string;
        operationId: string;
        refType: string;
        refId: string;
    }[];
    postedBy: {
        id: string;
        username: string;
    } | null;
    requestedBy: {
        id: string;
        username: string;
    } | null;
} & {
    status: import(".prisma/client").$Enums.FinancialOperationStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    dealId: string | null;
    amount: number | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
    postedByUserId: string | null;
    postedAt: Date | null;
    operationType: import(".prisma/client").$Enums.FinancialOperationType;
    reason: string;
    partialAmount: number | null;
    requestedByUserId: string | null;
    voucherId: string | null;
}) | null>;
export declare function getOperationsByDealId(dealId: string): Promise<({
    voucher: {
        type: string;
        status: string;
        id: string;
        amount: number;
        voucherNumber: string;
    } | null;
    approvedBy: {
        id: string;
        username: string;
    } | null;
    references: {
        id: string;
        createdAt: Date;
        role: string;
        operationId: string;
        refType: string;
        refId: string;
    }[];
    postedBy: {
        id: string;
        username: string;
    } | null;
    requestedBy: {
        id: string;
        username: string;
    } | null;
} & {
    status: import(".prisma/client").$Enums.FinancialOperationStatus;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    dealId: string | null;
    amount: number | null;
    approvedAt: Date | null;
    approvedByUserId: string | null;
    postedByUserId: string | null;
    postedAt: Date | null;
    operationType: import(".prisma/client").$Enums.FinancialOperationType;
    reason: string;
    partialAmount: number | null;
    requestedByUserId: string | null;
    voucherId: string | null;
})[]>;
//# sourceMappingURL=finance-operations-service.d.ts.map