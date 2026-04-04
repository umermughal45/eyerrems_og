/**
 * File Upload Security Utilities
 * Validates MIME type, file signature (magic bytes), file size
 * Sanitizes filenames and ensures files are stored outside web root
 */
/**
 * Detect MIME type from file signature
 */
export declare function detectMimeType(buffer: Buffer): string | null;
/**
 * Validate file upload
 * Checks MIME type, file signature, and file size
 */
export declare function validateFileUpload(buffer: Buffer, declaredMimeType: string, filename?: string): Promise<{
    valid: boolean;
    error?: string;
    detectedMimeType?: string;
}>;
/**
 * Get secure upload directory (outside web root)
 */
export declare function getSecureUploadDir(): Promise<string>;
/**
 * Save file securely outside web root
 */
export declare function saveFileSecurely(buffer: Buffer, originalFilename: string, entityType: string, entityId: string): Promise<{
    filePath: string;
    relativePath: string;
    filename: string;
}>;
/**
 * Scan file for viruses (placeholder - integrate with actual antivirus service)
 * In production, integrate with ClamAV or cloud antivirus service
 */
export declare function scanFileForViruses(filePath: string): Promise<{
    clean: boolean;
    threat?: string;
}>;
/**
 * Delete file securely
 */
export declare function deleteFileSecurely(filePath: string): Promise<void>;
//# sourceMappingURL=file-security.d.ts.map