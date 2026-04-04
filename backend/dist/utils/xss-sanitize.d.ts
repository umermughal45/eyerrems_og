/**
 * XSS Protection Utilities
 * Sanitizes user-generated content to prevent XSS attacks
 * Server-side sanitization for chat, notes, descriptions, etc.
 */
import { z } from 'zod';
/**
 * Sanitize HTML string by removing dangerous tags and attributes
 * This is a basic server-side sanitization - frontend should use DOMPurify
 */
export declare function sanitizeHtml(html: string): string;
/**
 * Sanitize plain text by HTML encoding
 */
export declare function sanitizeText(text: string): string;
/**
 * Sanitize user input for database storage
 * Removes null bytes and trims whitespace
 */
export declare function sanitizeInput(input: string): string;
/**
 * Validate and sanitize content using Zod
 */
export declare const contentSchema: z.ZodObject<{
    content: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
/**
 * Validate and sanitize description field
 */
export declare const descriptionSchema: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
/**
 * Validate and sanitize notes field
 */
export declare const notesSchema: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
/**
 * Sanitize filename to prevent path traversal and XSS
 */
export declare function sanitizeFilename(filename: string): string;
//# sourceMappingURL=xss-sanitize.d.ts.map