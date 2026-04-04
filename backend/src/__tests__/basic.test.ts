/**
 * Basic Test - Verify test setup is working
 */

describe('Basic Test Setup', () => {
  it('should run basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have test environment variables', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
  });

  it('should be able to import Prisma', async () => {
    const { PrismaClient } = await import('@prisma/client');
    expect(PrismaClient).toBeDefined();
  });
});