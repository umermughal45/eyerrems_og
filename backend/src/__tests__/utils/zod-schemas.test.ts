/**
 * Unit tests for Zod validation schemas
 */

import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

describe('Zod Validation Schemas', () => {
  describe('paginationSchema', () => {
    it('should validate correct pagination input', () => {
      const input = { page: '1', limit: '10' };
      const result = paginationSchema.parse(input);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should default to page 1 when page is missing', () => {
      const input = { limit: '20' };
      const result = paginationSchema.parse(input);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should default to limit 10 when limit is missing', () => {
      const input = { page: '2' };
      const result = paginationSchema.parse(input);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should transform string numbers to integers', () => {
      const input = { page: '5', limit: '25' };
      const result = paginationSchema.parse(input);
      
      expect(typeof result.page).toBe('number');
      expect(typeof result.limit).toBe('number');
      expect(result.page).toBe(5);
      expect(result.limit).toBe(25);
    });

    it('should reject non-numeric page values', () => {
      const input = { page: 'abc', limit: '10' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should reject non-numeric limit values', () => {
      const input = { page: '1', limit: 'xyz' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should reject negative page numbers', () => {
      const input = { page: '-1', limit: '10' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should reject zero page numbers', () => {
      const input = { page: '0', limit: '10' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should reject negative limit', () => {
      const input = { page: '1', limit: '-5' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should reject zero limit', () => {
      const input = { page: '1', limit: '0' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should enforce maximum limit of 100', () => {
      const input = { page: '1', limit: '101' };
      
      expect(() => paginationSchema.parse(input)).toThrow();
    });

    it('should accept limit of exactly 100', () => {
      const input = { page: '1', limit: '100' };
      const result = paginationSchema.parse(input);
      
      expect(result.limit).toBe(100);
    });

    it('should handle empty string as undefined', () => {
      const input = { page: '', limit: '' };
      const result = paginationSchema.parse(input);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});

