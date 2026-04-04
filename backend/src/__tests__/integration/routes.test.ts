/**
 * Integration tests for critical API endpoints
 * Tests actual HTTP requests to the API
 */

import request from 'supertest';
import express from 'express';
import { successResponse, errorResponse } from '../../utils/error-handler';
import { parsePaginationQuery, calculatePagination } from '../../utils/pagination';

// Mock app for testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Test route for pagination
  app.get('/test/pagination', (req, res) => {
    try {
      const { page, limit } = parsePaginationQuery(req.query);
      const skip = (page - 1) * limit;
      const total = 100; // Mock total
      const pagination = calculatePagination(page, limit, total);
      const data = Array.from({ length: limit }, (_, i) => ({ id: skip + i + 1 }));
      return successResponse(res, data, 200, pagination);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  // Test route for error handling
  app.get('/test/error', (req, res) => {
    const errorType = req.query.type as string;
    
    if (errorType === 'string') {
      return errorResponse(res, 'Test error message', 400);
    }
    if (errorType === 'error') {
      return errorResponse(res, new Error('Error object'), 500);
    }
    return successResponse(res, { message: 'Success' });
  });

  return app;
};

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('Pagination Endpoint', () => {
    it('should return paginated results with default values', async () => {
      const response = await request(app)
        .get('/test/pagination')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      });
    });

    it('should handle custom pagination parameters', async () => {
      const response = await request(app)
        .get('/test/pagination?page=2&limit=20')
        .expect(200);

      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(20);
      expect(response.body.data).toHaveLength(20);
    });

    it('should reject invalid pagination parameters', async () => {
      const response = await request(app)
        .get('/test/pagination?page=-1&limit=10')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });

    it('should enforce maximum limit', async () => {
      const response = await request(app)
        .get('/test/pagination?page=1&limit=200')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle string error messages', async () => {
      const response = await request(app)
        .get('/test/error?type=string')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Test error message');
    });

    it('should handle Error objects', async () => {
      const response = await request(app)
        .get('/test/error?type=error')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Error object');
    });

    it('should return success response when no error', async () => {
      const response = await request(app)
        .get('/test/error')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Success');
    });
  });

  describe('Response Format Standardization', () => {
    it('should always include success field', async () => {
      const successResponse = await request(app)
        .get('/test/pagination')
        .expect(200);

      expect(successResponse.body).toHaveProperty('success');
      expect(successResponse.body.success).toBe(true);

      const errorResponse = await request(app)
        .get('/test/error?type=string')
        .expect(400);

      expect(errorResponse.body).toHaveProperty('success');
      expect(errorResponse.body.success).toBe(false);
    });

    it('should include data field on success', async () => {
      const response = await request(app)
        .get('/test/pagination')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should include error field on failure', async () => {
      const response = await request(app)
        .get('/test/error?type=string')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });
});

