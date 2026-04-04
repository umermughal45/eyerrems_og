export interface CreateActivityParams {
    type: 'property' | 'unit' | 'tenant' | 'lease' | 'sale' | 'buyer' | 'block' | 'lead' | 'client' | 'deal' | 'dealer' | 'communication';
    action: 'created' | 'updated' | 'deleted';
    entityId: string;
    entityName?: string;
    message: string;
    userId?: string;
    metadata?: any;
}
export declare function createActivity(params: CreateActivityParams): Promise<void>;
//# sourceMappingURL=activity.d.ts.map