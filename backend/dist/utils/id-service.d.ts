export declare class IdService {
    /**
     * Generate sequential Entity ID (e.g., LD0001, CL0001)
     */
    static generateEntityId(prefix: 'LD' | 'CL' | 'DL' | 'PR' | 'DEAL' | 'PAY'): Promise<string>;
    /**
     * Generate YYYY-MM-#### sequential TID
     */
    static generateTID(): Promise<string>;
}
//# sourceMappingURL=id-service.d.ts.map