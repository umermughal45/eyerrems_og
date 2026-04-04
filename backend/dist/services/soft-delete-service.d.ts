/**
 * Soft Delete Service
 * Handles soft deletion of records and moves them to recycle bin
 * Records are kept indefinitely until manually removed
 */
interface SoftDeleteOptions {
    entityType: string;
    entityId: string;
    entityName: string;
    deletedBy?: string;
    deletedByName?: string;
}
/**
 * Soft delete a record - marks it as deleted and adds to recycle bin
 */
export declare function softDeleteRecord(options: SoftDeleteOptions): Promise<void>;
/**
 * Permanently delete expired records from recycle bin
 * DISABLED: Records are now kept indefinitely until manually removed
 * This function is kept for backward compatibility but does nothing
 */
export declare function cleanupExpiredRecords(): Promise<number>;
export declare const SoftDeleteService: {
    softDeleteRecord: typeof softDeleteRecord;
    cleanupExpiredRecords: typeof cleanupExpiredRecords;
};
export {};
//# sourceMappingURL=soft-delete-service.d.ts.map