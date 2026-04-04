/**
 * Unit tests for error handler utilities
 */

import { successResponse, errorResponse } from '../../utils/error-handler';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Mock Express Response
const createMockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
};

describe('Error Handler Utilities', () => {
  describe('successResponse', () => {
    it('should return success response with data', () => {
      const res = createMockResponse() as Response;
      const data = { id: 1, name: 'Test' };
      
      successResponse(res, data);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should include pagination when provided', () => {
      const res = createMockResponse() as Response;
      const data = [1, 2, 3];
      const pagination = {
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
      };
      
      successResponse(res, data, 200, pagination);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination,
      });
    });

    it('should use custom status code', () => {
      const res = createMockResponse() as Response;
      
      successResponse(res, { created: true }, 201);
      
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('errorResponse', () => {
    it('should handle string errors', () => {
      const res = createMockResponse() as Response;
      
      errorResponse(res, 'Not found', 404);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not found',
      });
    });

    it('should handle Error objects', () => {
      const res = createMockResponse() as Response;
      const error = new Error('Something went wrong');
      
      errorResponse(res, error, 500);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
      });
    });

    it('should handle Zod validation errors', () => {
      const res = createMockResponse() as Response;
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['name'],
          message: 'Expected string, received number',
        },
      ]);
      
      errorResponse(res, zodError);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: [
          {
            path: 'name',
            message: 'Expected string, received number',
          },
        ],
      });
    });

    it('should handle Prisma unique constraint errors', () => {
      const res = createMockResponse() as Response;
      const prismaError = {
        code: 'P2002',
        meta: { target: ['email'] },
      } as unknown as Prisma.PrismaClientKnownRequestError;
      
      errorResponse(res, prismaError);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unique constraint violation',
        details: { field: ['email'] },
      });
    });

    it('should handle Prisma record not found errors', () => {
      const res = createMockResponse() as Response;
      const prismaError = {
        code: 'P2025',
      } as Prisma.PrismaClientKnownRequestError;
      
      errorResponse(res, prismaError);
      
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Record not found',
      });
    });

    it('should include details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const res = createMockResponse() as Response;
      const error = new Error('Test error');
      (error as any).details = { field: 'test' };
      
      errorResponse(res, error, 500, { custom: 'detail' });
      
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        details: { custom: 'detail' },
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not include details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const res = createMockResponse() as Response;
      
      errorResponse(res, 'Error', 500, { sensitive: 'data' });
      
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error',
      });
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});

