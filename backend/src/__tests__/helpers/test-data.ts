/**
 * Test Data Helpers
 * Utilities for creating test data and managing test database
 */

import { PrismaClient, User, Role } from '@prisma/client';
import { hashPassword } from '../../utils/password';
import request from 'supertest';
import express from 'express';

const prisma = new PrismaClient();

/**
 * Clean up all test data from database
 * Order matters due to foreign key constraints
 */
export async function cleanupDatabase(): Promise<void> {
  // Delete in reverse dependency order
  await prisma.communication.deleteMany();
  await prisma.dealInstallment.deleteMany();
  await prisma.dealProperty.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.contactPerson.deleteMany();
  await prisma.client.deleteMany();
  await prisma.lead.deleteMany();
  
  await prisma.tenantPayment.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.lease.deleteMany();
  
  await prisma.saleInstallment.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.buyer.deleteMany();
  
  await prisma.unit.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.block.deleteMany();
  await prisma.property.deleteMany();
  
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.payroll.deleteMany();
  await prisma.employee.deleteMany();
  
  await prisma.voucherLine.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.message.deleteMany();
  await prisma.attachment.deleteMany();
  
  await prisma.csrfToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.deviceApproval.deleteMany();
  await prisma.roleInviteLink.deleteMany();
  
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  
  await prisma.location.deleteMany();
  await prisma.subsidiaryOption.deleteMany();
}

/**
 * Create test role with permissions
 */
export async function createTestRole(
  name: string,
  permissions: string[]
): Promise<Role> {
  return await prisma.role.create({
    data: {
      name,
      permissions,
    },
  });
}

/**
 * Create test user
 */
export async function createTestUser(data: {
  username?: string;
  email: string;
  password: string;
  roleId: string;
  deviceApprovalStatus?: string;
}): Promise<User> {
  const hashedPassword = await hashPassword(data.password);
  
  return await prisma.user.create({
    data: {
      username: data.username || data.email.split('@')[0],
      email: data.email,
      password: hashedPassword,
      roleId: data.roleId,
      deviceApprovalStatus: data.deviceApprovalStatus || 'approved',
    },
  });
}

/**
 * Create authentication headers for testing
 * Performs login and returns Authorization and CSRF headers
 */
export async function createAuthHeaders(
  app: express.Application,
  email: string,
  password: string,
  deviceId: string = 'test-device-123'
): Promise<{ Authorization: string; 'X-CSRF-Token': string }> {
  // Determine login endpoint based on email
  const isAdmin = email.includes('admin');
  const loginEndpoint = isAdmin ? '/api/auth/login' : '/api/auth/role-login';
  
  const loginData = isAdmin 
    ? { email, password, deviceId }
    : { username: email.split('@')[0], password, deviceId };

  const response = await request(app)
    .post(loginEndpoint)
    .send(loginData);

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.body.error || 'Unknown error'}`);
  }

  const { token, csrfToken } = response.body;
  
  return {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': csrfToken,
  };
}

/**
 * Create test property
 */
export async function createTestProperty(data: {
  name: string;
  type: string;
  address: string;
  status?: string;
  propertyCode?: string;
}) {
  return await prisma.property.create({
    data: {
      name: data.name,
      type: data.type,
      address: data.address,
      status: data.status || 'Active',
      propertyCode: data.propertyCode || `prop-24-${Math.floor(1000 + Math.random() * 9000)}`,
    },
  });
}

/**
 * Create test client
 */
export async function createTestClient(data: {
  name: string;
  email?: string;
  phone?: string;
  clientCode?: string;
}) {
  return await prisma.client.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      clientCode: data.clientCode || `cli-24-${Math.floor(1000 + Math.random() * 9000)}`,
    },
  });
}

/**
 * Create test lead
 */
export async function createTestLead(data: {
  name: string;
  email?: string;
  phone?: string;
  priority?: string;
  status?: string;
  leadCode?: string;
}) {
  return await prisma.lead.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      priority: data.priority || 'medium',
      status: data.status || 'new',
      leadCode: data.leadCode || `lead-24-${Math.floor(1000 + Math.random() * 9000)}`,
    },
  });
}

/**
 * Create test unit
 */
export async function createTestUnit(data: {
  unitName: string;
  propertyId: string;
  blockId?: string;
  type?: string;
  status?: string;
  monthlyRent?: number;
}) {
  return await prisma.unit.create({
    data: {
      unitName: data.unitName,
      propertyId: data.propertyId,
      blockId: data.blockId,
      status: data.status || 'Vacant',
      monthlyRent: data.monthlyRent,
    },
  });
}

/**
 * Create test tenant
 */
export async function createTestTenant(data: {
  name: string;
  unitId: string;
  email?: string;
  phone?: string;
  tenantCode?: string;
  isActive?: boolean;
}) {
  return await prisma.tenant.create({
    data: {
      name: data.name,
      unitId: data.unitId,
      email: data.email,
      phone: data.phone,
      tenantCode: data.tenantCode || `tenant-24-${Math.floor(1000 + Math.random() * 9000)}`,
      isActive: data.isActive !== false,
      outstandingBalance: 0,
      advanceBalance: 0,
    },
  });
}

/**
 * Create test employee
 */
export async function createTestEmployee(data: {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  employeeId?: string;
  isActive?: boolean;
}) {
  return await prisma.employee.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      position: data.position || 'Staff',
      department: data.department || 'General',
      employeeId: data.employeeId || `emp-24-${Math.floor(1000 + Math.random() * 9000)}`,
      status: data.isActive === false ? 'inactive' : 'active',
      salary: 50000,
    },
  });
}

/**
 * Create test deal
 */
export async function createTestDeal(data: {
  title: string;
  clientId: string;
  propertyId: string;
  dealAmount: number;
  dealCode?: string;
  stage?: string;
  status?: string;
}) {
  return await prisma.deal.create({
    data: {
      title: data.title,
      clientId: data.clientId,
      propertyId: data.propertyId,
      dealAmount: data.dealAmount,
      dealCode: data.dealCode || `deal-24-${Math.floor(1000 + Math.random() * 9000)}`,
      stage: data.stage || 'prospecting',
      status: data.status || 'open',
      role: 'buyer',
    },
  });
}

/**
 * Wait for async operations to complete
 */
export async function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}@test.com`;
}

/**
 * Generate unique test code
 */
export function generateTestCode(prefix: string): string {
  const date = new Date().toISOString().slice(2, 4); // YY
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${random}`;
}