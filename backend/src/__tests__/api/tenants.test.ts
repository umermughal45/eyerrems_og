/**
 * Tenants API Tests
 * Tests tenant CRUD, payments, lease management
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/test-app';
import { 
  createTestUser, 
  createTestRole, 
  cleanupDatabase, 
  createAuthHeaders,
  createTestProperty,
  createTestUnit,
  createTestClient
} from '../helpers/test-data';

const prisma = new PrismaClient();
let app: express.Application;
let authHeaders: { Authorization: string; 'X-CSRF-Token': string };
let userId: string;

describe('Tenants API', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    
    // Create user with tenant permissions
    const tenantRole = await createTestRole('Tenant Manager', [
      'tenants.*',
      'properties.view',
      'units.view',
      'finance.view',
    ]);
    const user = await createTestUser({
      email: 'tenants@test.com',
      password: 'password123',
      roleId: tenantRole.id,
    });
    userId = user.id;
    authHeaders = await createAuthHeaders(app, 'tenants@test.com', 'password123');
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('POST /api/tenants', () => {
    let propertyId: string;
    let unitId: string;

    beforeEach(async () => {
      const property = await createTestProperty({
        name: 'Tenant Test Property',
        type: 'residential',
        address: '123 Tenant St',
      });
      propertyId = property.id;

      const unit = await prisma.unit.create({
        data: {
          unitNumber: '101',
          propertyId,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Available',
          rentAmount: 1500,
        },
      });
      unitId = unit.id;
    });

    it('should create tenant successfully', async () => {
      const tenantData = {
        tid: 'TEN-001',
        name: 'John Tenant',
        email: 'john.tenant@example.com',
        phone: '+1234567890',
        unitId,
        cnic: '12345-6789012-3',
        address: '456 Tenant Ave',
        emergencyContact: 'Jane Tenant - +1987654321',
        leaseStartDate: new Date().toISOString(),
        leaseEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyRent: 1500,
        securityDeposit: 3000,
      };

      const response = await request(app)
        .post('/api/tenants')
        .set(authHeaders)
        .send(tenantData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'John Tenant',
          email: 'john.tenant@example.com',
          phone: '+1234567890',
          cnic: '12345-6789012-3',
          tenantCode: expect.stringMatching(/^TENANT-\d{8}-\d{4}$/),
          isActive: true,
          outstandingBalance: 0,
          advanceBalance: 0,
        },
      });

      // Verify unit status updated to Occupied
      const updatedUnit = await prisma.unit.findUnique({
        where: { id: unitId },
      });
      expect(updatedUnit?.status).toBe('Occupied');
    });

    it('should reject tenant for occupied unit', async () => {
      // Create existing tenant
      await prisma.tenant.create({
        data: {
          name: 'Existing Tenant',
          unitId,
          tenantCode: 'tenant-24-0001',
          isActive: true,
          outstandingBalance: 0,
          advanceBalance: 0,
        },
      });

      const response = await request(app)
        .post('/api/tenants')
        .set(authHeaders)
        .send({
          name: 'New Tenant',
          unitId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Unit is already occupied');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/tenants')
        .set(authHeaders)
        .send({
          name: '', // empty name
          unitId: 'invalid-uuid', // invalid UUID
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/tenants', () => {
    beforeEach(async () => {
      const property = await createTestProperty({
        name: 'List Test Property',
        type: 'residential',
        address: '123 List St',
      });

      const unit1 = await prisma.unit.create({
        data: {
          unitNumber: '101',
          propertyId: property.id,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Occupied',
        },
      });

      const unit2 = await prisma.unit.create({
        data: {
          unitNumber: '102',
          propertyId: property.id,
          unitCode: 'unit-24-0002',
          type: 'apartment',
          status: 'Occupied',
        },
      });

      await prisma.tenant.createMany({
        data: [
          {
            name: 'Active Tenant',
            unitId: unit1.id,
            tenantCode: 'tenant-24-0001',
            isActive: true,
            outstandingBalance: 0,
            advanceBalance: 500,
          },
          {
            name: 'Inactive Tenant',
            unitId: unit2.id,
            tenantCode: 'tenant-24-0002',
            isActive: false,
            outstandingBalance: 1500,
            advanceBalance: 0,
          },
        ],
      });
    });

    it('should get tenants with pagination', async () => {
      const response = await request(app)
        .get('/api/tenants?page=1&limit=10')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            name: 'Active Tenant',
            isActive: true,
          }),
          expect.objectContaining({
            name: 'Inactive Tenant',
            isActive: false,
          }),
        ]),
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should filter tenants by status', async () => {
      const response = await request(app)
        .get('/api/tenants?status=active')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Active Tenant');
    });

    it('should search tenants by name', async () => {
      const response = await request(app)
        .get('/api/tenants?search=active')
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Active Tenant');
    });
  });

  describe('GET /api/tenants/:id', () => {
    it('should get tenant with unit and payment history', async () => {
      const property = await createTestProperty({
        name: 'Detail Test Property',
        type: 'residential',
        address: '123 Detail St',
      });

      const unit = await prisma.unit.create({
        data: {
          unitNumber: '201',
          propertyId: property.id,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Occupied',
          rentAmount: 2000,
        },
      });

      const tenant = await prisma.tenant.create({
        data: {
          name: 'Detail Tenant',
          email: 'detail@example.com',
          unitId: unit.id,
          tenantCode: 'tenant-24-0001',
          isActive: true,
          outstandingBalance: 500,
          advanceBalance: 1000,
        },
      });

      // Create payment history
      await prisma.tenantPayment.create({
        data: {
          tenantId: tenant.id,
          amount: 2000,
          paymentType: 'rent',
          paymentMethod: 'bank_transfer',
          paymentDate: new Date(),
          createdBy: userId,
        },
      });

      const response = await request(app)
        .get(`/api/tenants/${tenant.id}`)
        .set(authHeaders);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'Detail Tenant',
          email: 'detail@example.com',
          outstandingBalance: 500,
          advanceBalance: 1000,
          unit: {
            unitNumber: '201',
            rentAmount: 2000,
            property: {
              name: 'Detail Test Property',
            },
          },
          payments: expect.arrayContaining([
            expect.objectContaining({
              amount: 2000,
              paymentType: 'rent',
            }),
          ]),
        },
      });
    });

    it('should return 404 for non-existent tenant', async () => {
      const response = await request(app)
        .get('/api/tenants/00000000-0000-0000-0000-000000000000')
        .set(authHeaders);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Tenant not found');
    });
  });

  describe('PUT /api/tenants/:id', () => {
    it('should update tenant successfully', async () => {
      const property = await createTestProperty({
        name: 'Update Test Property',
        type: 'residential',
        address: '123 Update St',
      });

      const unit = await prisma.unit.create({
        data: {
          unitNumber: '301',
          propertyId: property.id,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Occupied',
        },
      });

      const tenant = await prisma.tenant.create({
        data: {
          name: 'Original Tenant',
          email: 'original@example.com',
          unitId: unit.id,
          tenantCode: 'tenant-24-0001',
          isActive: true,
          outstandingBalance: 0,
          advanceBalance: 0,
        },
      });

      const response = await request(app)
        .put(`/api/tenants/${tenant.id}`)
        .set(authHeaders)
        .send({
          name: 'Updated Tenant',
          email: 'updated@example.com',
          phone: '+1111111111',
          emergencyContact: 'Emergency Contact',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'Updated Tenant',
          email: 'updated@example.com',
          phone: '+1111111111',
          emergencyContact: 'Emergency Contact',
        },
      });
    });
  });

  describe('POST /api/tenants/convert-from-client/:clientId', () => {
    it('should convert client to tenant successfully', async () => {
      const property = await createTestProperty({
        name: 'Convert Test Property',
        type: 'residential',
        address: '123 Convert St',
      });

      const unit = await prisma.unit.create({
        data: {
          unitNumber: '401',
          propertyId: property.id,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Available',
        },
      });

      const client = await createTestClient({
        name: 'Client to Convert',
        email: 'convert@example.com',
        phone: '+1234567890',
      });

      const response = await request(app)
        .post(`/api/tenants/convert-from-client/${client.id}`)
        .set(authHeaders)
        .send({
          unitId: unit.id,
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'Client to Convert',
          email: 'convert@example.com',
          phone: '+1234567890',
          tenantCode: expect.stringMatching(/^TENANT-\d{8}-\d{4}$/),
        },
      });

      // Verify unit is now occupied
      const updatedUnit = await prisma.unit.findUnique({
        where: { id: unit.id },
      });
      expect(updatedUnit?.status).toBe('Occupied');
    });

    it('should reject conversion for occupied unit', async () => {
      const property = await createTestProperty({
        name: 'Occupied Test Property',
        type: 'residential',
        address: '123 Occupied St',
      });

      const unit = await prisma.unit.create({
        data: {
          unitNumber: '501',
          propertyId: property.id,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Occupied',
        },
      });

      // Create existing tenant
      await prisma.tenant.create({
        data: {
          name: 'Existing Tenant',
          unitId: unit.id,
          tenantCode: 'tenant-24-0001',
          isActive: true,
          outstandingBalance: 0,
          advanceBalance: 0,
        },
      });

      const client = await createTestClient({
        name: 'Client to Convert',
      });

      const response = await request(app)
        .post(`/api/tenants/convert-from-client/${client.id}`)
        .set(authHeaders)
        .send({
          unitId: unit.id,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Unit is already occupied');
    });
  });

  describe('Tenant Payments', () => {
    let tenantId: string;

    beforeEach(async () => {
      const property = await createTestProperty({
        name: 'Payment Test Property',
        type: 'residential',
        address: '123 Payment St',
      });

      const unit = await prisma.unit.create({
        data: {
          unitNumber: '601',
          propertyId: property.id,
          unitCode: 'unit-24-0001',
          type: 'apartment',
          status: 'Occupied',
          rentAmount: 1800,
        },
      });

      const tenant = await prisma.tenant.create({
        data: {
          name: 'Payment Tenant',
          unitId: unit.id,
          tenantCode: 'tenant-24-0001',
          isActive: true,
          outstandingBalance: 1800,
          advanceBalance: 0,
        },
      });
      tenantId = tenant.id;
    });

    it('should record tenant payment successfully', async () => {
      const paymentData = {
        tenantId,
        amount: 1800,
        paymentType: 'rent',
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString(),
        description: 'Monthly rent payment',
        receiptNumber: 'RCP-001',
      };

      const response = await request(app)
        .post('/api/tenants/payments')
        .set(authHeaders)
        .send(paymentData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          amount: 1800,
          paymentType: 'rent',
          paymentMethod: 'cash',
          description: 'Monthly rent payment',
        },
      });

      // Verify tenant balance updated
      const updatedTenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      expect(updatedTenant?.outstandingBalance).toBe(0);
    });

    it('should validate payment amount', async () => {
      const response = await request(app)
        .post('/api/tenants/payments')
        .set(authHeaders)
        .send({
          tenantId,
          amount: -100, // negative amount
          paymentType: 'rent',
          paymentMethod: 'cash',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('Authorization Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/tenants');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject requests without proper permissions', async () => {
      const limitedRole = await createTestRole('Limited User', ['properties.view']);
      const limitedUser = await createTestUser({
        email: 'limited@test.com',
        password: 'password123',
        roleId: limitedRole.id,
      });
      const limitedHeaders = await createAuthHeaders(app, 'limited@test.com', 'password123');

      const response = await request(app)
        .post('/api/tenants')
        .set(limitedHeaders)
        .send({
          name: 'Test Tenant',
          unitId: '00000000-0000-0000-0000-000000000000',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});