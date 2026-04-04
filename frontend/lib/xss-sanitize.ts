/**
 * Frontend XSS Sanitization Utilities
 * Client-side sanitization using DOMPurify (when available)
 * Falls back to basic sanitization if DOMPurify is not available
 */

/**
 * Sanitize HTML string to prevent XSS attacks
 * Uses DOMPurify if available, otherwise uses basic sanitization
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Try to use DOMPurify if available
  if (typeof window !== 'undefined' && (window as any).DOMPurify) {
    try {
      return (window as any).DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'b', 'i', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'title', 'alt', 'src'],
      });
    } catch (error) {
      console.warn('DOMPurify sanitization failed, using fallback:', error);
    }
  }

  // Fallback: Basic sanitization
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
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
 * Sanitize user input for display
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return sanitizeText(input.trim());
}

