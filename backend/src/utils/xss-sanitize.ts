/**
 * XSS Protection Utilities
 * Sanitizes user-generated content to prevent XSS attacks
 * Server-side sanitization for chat, notes, descriptions, etc.
 */

import { z } from 'zod';

/**
 * Allowed HTML tags for sanitization (minimal safe set)
 */
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre',
];

/**
 * Allowed HTML attributes
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title'],
  img: ['src', 'alt', 'title'],
};

/**
 * Sanitize HTML string by removing dangerous tags and attributes
 * This is a basic server-side sanitization - frontend should use DOMPurify
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Remove script tags and event handlers
  let sanitized = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers like onclick="..."
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:text\/html/gi, '') // Remove data URIs with HTML
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ''); // Remove iframes

  // Remove style tags and style attributes (can contain XSS)
  sanitized = sanitized
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\s*style\s*=\s*["'][^"']*["']/gi, '');

  // Remove dangerous protocols
  sanitized = sanitized
    .replace(/href\s*=\s*["'](?!https?:\/\/|mailto:|tel:|#)[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["'](?!https?:\/\/|data:image\/)[^"']*["']/gi, 'src=""');

  return sanitized;
}

/**
 * Sanitize plain text by HTML encoding
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize user input for database storage
 * Removes null bytes and trims whitespace
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/\0/g, '') // Remove null bytes
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Validate and sanitize content using Zod
 */
export const contentSchema = z.object({
  content: z.string()
    .min(1, 'Content cannot be empty')
    .max(10000, 'Content exceeds maximum length')
    .transform((val) => sanitizeInput(sanitizeHtml(val))),
});

/**
 * Validate and sanitize description field
 */
export const descriptionSchema = z.string()
  .max(5000, 'Description exceeds maximum length')
  .optional()
  .transform((val) => val ? sanitizeInput(sanitizeHtml(val)) : undefined);

/**
 * Validate and sanitize notes field
 */
export const notesSchema = z.string()
  .max(10000, 'Notes exceed maximum length')
  .optional()
  .transform((val) => val ? sanitizeInput(sanitizeHtml(val)) : undefined);

/**
 * Sanitize filename to prevent path traversal and XSS
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'file';
  }

  // Remove path traversal attempts
  let sanitized = filename
    .replace(/\.\./g, '') // Remove ..
    .replace(/\//g, '_') // Replace / with _
    .replace(/\\/g, '_') // Replace \ with _
    .replace(/[<>:"|?*]/g, '_') // Remove Windows invalid chars
    .trim();

  // Remove leading dots and spaces
  sanitized = sanitized.replace(/^[.\s]+/, '');

  // Ensure filename is not empty
  if (!sanitized) {
    sanitized = 'file';
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    sanitized = sanitized.substring(0, 255 - ext.length) + ext;
  }

  return sanitized;
}

