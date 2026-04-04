/**
 * Jest test setup file
 * Runs before all tests
 */

import { PrismaClient } from '@prisma/client';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-very-long-and-secure';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.FRONTEND_ORIGIN = 'http://localhost:3000';

// Increase test timeout for database operations
jest.setTimeout(30000);

// Global test database instance
const prisma = new PrismaClient();

// Global setup - runs once before all tests
beforeAll(async () => {
  // Ensure database connection
  try {
    await prisma.$connect();
    console.log('✅ Test database connected');
  } catch (error) {
    console.error('❌ Test database connection failed:', error);
    throw error;
  }
});

// Global teardown - runs once after all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log('✅ Test database disconnected');
});

// Suppress console logs during tests (optional)
// Uncomment if you want cleaner test output
// const originalConsole = global.console;
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: originalConsole.error, // Keep errors visible
// };

