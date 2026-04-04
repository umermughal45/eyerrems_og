/**
 * Global Attachments Service
 * Handles file uploads and attachments across all entities
 */
interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}
export interface AttachmentData {
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
    entityType: string;
    entityId: string;
    propertyId?: string;
    tenantId?: string;
    uploadedBy?: string;
    description?: string;
}
/**
 * Create attachment record
 */
export declare function createAttachment(data: AttachmentData): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    fileUrl: string;
    fileName: string;
    entityType: string;
    entityId: string;
    fileType: string | null;
    fileSize: number | null;
    uploadedBy: string | null;
}>;
/**
 * Get attachments for an entity
 */
export declare function getAttachments(entityType: string, entityId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    fileUrl: string;
    fileName: string;
    entityType: string;
    entityId: string;
    fileType: string | null;
    fileSize: number | null;
    uploadedBy: string | null;
}[]>;
/**
 * Delete attachment (soft delete)
 */
export declare function deleteAttachment(attachmentId: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    fileUrl: string;
    fileName: string;
    entityType: string;
    entityId: string;
    fileType: string | null;
    fileSize: number | null;
    uploadedBy: string | null;
}>;
/**
 * Save uploaded file to disk
 */
export declare function saveUploadedFile(file: MulterFile, entityType: string, entityId: string): Promise<string>;
/**
 * Delete physical file
 */
export declare function deletePhysicalFile(fileUrl: string): Promise<void>;
/**
 * Update entity's documents array (for backward compatibility)
 */
export declare function updateEntityDocuments(entityType: string, entityId: string, documentUrl: string): Promise<{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isDeleted: boolean;
    tenantId: string | null;
    propertyId: string | null;
    description: string | null;
    fileUrl: string;
    fileName: string;
    entityType: string;
    entityId: string;
    fileType: string | null;
    fileSize: number | null;
    uploadedBy: string | null;
}>;
export {};
//# sourceMappingURL=attachments.d.ts.map