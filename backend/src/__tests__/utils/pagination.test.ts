/**
 * Unit tests for pagination utilities
 */

import { parsePaginationQuery, calculatePagination, paginationSchema } from '../../utils/pagination';
import { ZodError } from 'zod';

describe('Pagination Utilities', () => {
  describe('parsePaginationQuery', () => {
    it('should parse valid pagination query parameters', () => {
      const query = { page: '2', limit: '20' };
      const result = parsePaginationQuery(query);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });

    it('should use default values when parameters are missing', () => {
      const query = {};
      const result = parsePaginationQuery(query);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should handle string numbers correctly', () => {
      const query = { page: '5', limit: '15' };
      const result = parsePaginationQuery(query);
      
      expect(result.page).toBe(5);
      expect(result.limit).toBe(15);
    });

    it('should enforce maximum limit of 100', () => {
      const query = { page: '1', limit: '200' };
      
      expect(() => parsePaginationQuery(query)).toThrow(ZodError);
    });

    it('should reject negative page numbers', () => {
      const query = { page: '-1', limit: '10' };
      
      expect(() => parsePaginationQuery(query)).toThrow(ZodError);
    });

    it('should reject zero page numbers', () => {
      const query = { page: '0', limit: '10' };
      
      expect(() => parsePaginationQuery(query)).toThrow(ZodError);
    });

    it('should reject negative limit', () => {
      const query = { page: '1', limit: '-5' };
      
      expect(() => parsePaginationQuery(query)).toThrow(ZodError);
    });
  });

  describe('calculatePagination', () => {
    it('should calculate pagination correctly', () => {
      const result = calculatePagination(2, 10, 95);
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(95);
      expect(result.totalPages).toBe(10);
      expect(result.skip).toBe(10);
    });

    it('should handle exact page divisions', () => {
      const result = calculatePagination(5, 10, 50);
      
      expect(result.totalPages).toBe(5);
      expect(result.skip).toBe(40);
    });

    it('should round up total pages for partial divisions', () => {
      const result = calculatePagination(1, 10, 95);
      
      expect(result.totalPages).toBe(10);
    });

    it('should handle empty results', () => {
      const result = calculatePagination(1, 10, 0);
      
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.skip).toBe(0);
    });

    it('should calculate skip correctly for different pages', () => {
      expect(calculatePagination(1, 10, 100).skip).toBe(0);
      expect(calculatePagination(2, 10, 100).skip).toBe(10);
      expect(calculatePagination(3, 10, 100).skip).toBe(20);
      expect(calculatePagination(10, 10, 100).skip).toBe(90);
    });
  });

  describe('paginationSchema', () => {
    it('should validate correct pagination input', () => {
      const valid = { page: '1', limit: '10' };
      const result = paginationSchema.parse(valid);
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should transform string numbers to integers', () => {
      const input = { page: '5', limit: '25' };
      const result = paginationSchema.parse(input);
      
      expect(typeof result.page).toBe('number');
      expect(typeof result.limit).toBe('number');
    });

    it('should reject non-numeric strings', () => {
      const invalid = { page: 'abc', limit: '10' };
      
      expect(() => paginationSchema.parse(invalid)).toThrow(ZodError);
    });
  });
});

