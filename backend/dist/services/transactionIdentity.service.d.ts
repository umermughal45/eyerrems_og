export declare class TransactionIdentityEngine {
    /**
     * Generates a new unique Transaction ID in the format TRX-{YEAR}-{SEQUENCE}
     */
    static generateTransactionID(): Promise<string>;
    /**
     * Attaches a T-ID to an entity by creating a registry record
     */
    static attachTid(tid: string, entityType: string, entityId: string, moduleName: string): Promise<void>;
    /**
     * Looks up a T-ID for a given entity
     */
    static getTidForEntity(entityType: string, entityId: string): Promise<string | null>;
}
//# sourceMappingURL=transactionIdentity.service.d.ts.map