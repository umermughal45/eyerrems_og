/**
 * Properties API Tests
 * Tests properties, units, blocks, floors endpoints
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestApp } from '../helpers/test-app';
import { createTestUser, createTestRole, cleanupDatabase, createAuthHeaders } from '../helpers/test-data';

const prisma = new PrismaClient();
let app: express.Application;
let authHeaders: { Authorization: string; 'X-CSRF-Token': string };
let userId: string;

describe('Properties API', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    
    // Create user with properties permissions
    const propertiesRole = await createTestRole('Property Manager', [
      'properties.*',
      'units.*',
      'blocks.*',
      'floors.*',
    ]);
    const user = await createTestUser({
      email: 'properties@test.com',
      password: 'password123',
      roleId: propertiesRole.id,
    });
    userId = user.id;
    authHeaders = await createAuthHeaders(app, 'properties@test.com', 'password123');
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('Properties API', () => {
    describe('POST /api/properties', () => {
      it('should create property successfully', async () => {
        const propertyData = {
          name: 'Sunset Apartments',
          type: 'residential',
          address: '123 Sunset Blvd, Los Angeles, CA',
          status: 'Active',
          description: 'Luxury apartment complex',
          yearBuilt: 2020,
          totalArea: 5000.5,
          totalUnits: 50,
          salePrice: 2500000,
          amenities: ['parking', 'gym', 'pool'],
        };

        const response = await request(app)
          .post('/api/properties')
          .set(authHeaders)
          .send(propertyData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            name: 'Sunset Apartments',
            type: 'residential',
            address: '123 Sunset Blvd, Los Angeles, CA',
            status: 'Active',
            yearBuilt: 2020,
            totalArea: 5000.5,
            totalUnits: 50,
            salePrice: 2500000,
            amenities: ['parking', 'gym', 'pool'],
            propertyCode: expect.stringMatching(/^prop-\d{2}-\d{4}$/),
          },
        });
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/properties')
          .set(authHeaders)
          .send({
            name: '', // empty name
            type: '', // empty type
            address: '', // empty address
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
        expect(response.body.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: 'name',
              message: 'Property name is required',
            }),
            expect.objectContaining({
              path: 'type',
              message: 'Property type is required',
            }),
            expect.objectContaining({
              path: 'address',
              message: 'Address is required',
            }),
          ])
        );
      });

      it('should validate enum values', async () => {
        const response = await request(app)
          .post('/api/properties')
          .set(authHeaders)
          .send({
            name: 'Test Property',
            type: 'residential',
            address: '123 Test St',
            status: 'InvalidStatus', // invalid enum value
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });

      it('should validate image URL format', async () => {
        const response = await request(app)
          .post('/api/properties')
          .set(authHeaders)
          .send({
            name: 'Test Property',
            type: 'residential',
            address: '123 Test St',
            imageUrl: 'invalid-url', // invalid URL format
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });

      it('should handle duplicate property names', async () => {
        // Create first property
        await prisma.property.create({
          data: {
            name: 'Duplicate Property',
            type: 'residential',
            address: '123 First St',
            propertyCode: 'prop-24-0001',
          },
        });

        // Try to create second property with same name
        const response = await request(app)
          .post('/api/properties')
          .set(authHeaders)
          .send({
            name: 'Duplicate Property',
            type: 'commercial',
            address: '456 Second St',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Unique constraint violation');
      });
    });

    describe('GET /api/properties', () => {
      beforeEach(async () => {
        // Create test properties
        await prisma.property.createMany({
          data: [
            {
              name: 'Active Residential',
              type: 'residential',
              address: '123 Active St',
              status: 'Active',
              propertyCode: 'prop-24-0001',
              totalUnits: 10,
            },
            {
              name: 'Vacant Commercial',
              type: 'commercial',
              address: '456 Vacant Ave',
              status: 'Vacant',
              propertyCode: 'prop-24-0002',
              totalUnits: 5,
            },
            {
              name: 'Maintenance Property',
              type: 'residential',
              address: '789 Maintenance Rd',
              status: 'Maintenance',
              propertyCode: 'prop-24-0003',
              totalUnits: 8,
            },
          ],
        });
      });

      it('should get properties with pagination', async () => {
        const response = await request(app)
          .get('/api/properties?page=1&limit=10')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'Active Residential',
              type: 'residential',
              status: 'Active',
            }),
            expect.objectContaining({
              name: 'Vacant Commercial',
              type: 'commercial',
              status: 'Vacant',
            }),
          ]),
          pagination: {
            page: 1,
            limit: 10,
            total: 3,
            totalPages: 1,
          },
        });
      });

      it('should filter properties by status', async () => {
        const response = await request(app)
          .get('/api/properties?status=Active')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Active Residential');
      });

      it('should filter properties by type', async () => {
        const response = await request(app)
          .get('/api/properties?type=commercial')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Vacant Commercial');
      });

      it('should search properties by name', async () => {
        const response = await request(app)
          .get('/api/properties?search=residential')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
      });

      it('should validate pagination parameters', async () => {
        const response = await request(app)
          .get('/api/properties?page=0&limit=1000') // invalid values
          .set(authHeaders);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid pagination parameters');
      });
    });

    describe('GET /api/properties/:id', () => {
      it('should get property with units and blocks', async () => {
        const property = await prisma.property.create({
          data: {
            name: 'Detailed Property',
            type: 'residential',
            address: '123 Detail St',
            propertyCode: 'prop-24-0001',
          },
        });

        // Create block and unit
        const block = await prisma.block.create({
          data: {
            name: 'Block A',
            propertyId: property.id,
            blockCode: 'block-24-0001',
          },
        });

        await prisma.unit.create({
          data: {
            unitNumber: '101',
            propertyId: property.id,
            blockId: block.id,
            unitCode: 'unit-24-0001',
            type: 'apartment',
            status: 'Available',
            rentAmount: 1500,
          },
        });

        const response = await request(app)
          .get(`/api/properties/${property.id}`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            name: 'Detailed Property',
            blocks: expect.arrayContaining([
              expect.objectContaining({
                name: 'Block A',
              }),
            ]),
            units: expect.arrayContaining([
              expect.objectContaining({
                unitNumber: '101',
                type: 'apartment',
                rentAmount: 1500,
              }),
            ]),
          },
        });
      });

      it('should return 404 for non-existent property', async () => {
        const response = await request(app)
          .get('/api/properties/00000000-0000-0000-0000-000000000000')
          .set(authHeaders);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Property not found');
      });
    });

    describe('PUT /api/properties/:id', () => {
      it('should update property successfully', async () => {
        const property = await prisma.property.create({
          data: {
            name: 'Original Property',
            type: 'residential',
            address: '123 Original St',
            propertyCode: 'prop-24-0001',
            status: 'Active',
          },
        });

        const response = await request(app)
          .put(`/api/properties/${property.id}`)
          .set(authHeaders)
          .send({
            name: 'Updated Property',
            status: 'Maintenance',
            description: 'Updated description',
            totalUnits: 25,
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            name: 'Updated Property',
            status: 'Maintenance',
            description: 'Updated description',
            totalUnits: 25,
          },
        });
      });

      it('should validate partial update data', async () => {
        const property = await prisma.property.create({
          data: {
            name: 'Test Property',
            type: 'residential',
            address: '123 Test St',
            propertyCode: 'prop-24-0001',
          },
        });

        const response = await request(app)
          .put(`/api/properties/${property.id}`)
          .set(authHeaders)
          .send({
            yearBuilt: -2020, // invalid negative year
            totalArea: -100, // invalid negative area
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });
    });

    describe('DELETE /api/properties/:id', () => {
      it('should soft delete property', async () => {
        const property = await prisma.property.create({
          data: {
            name: 'Delete Property',
            type: 'residential',
            address: '123 Delete St',
            propertyCode: 'prop-24-0001',
          },
        });

        const response = await request(app)
          .delete(`/api/properties/${property.id}`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          message: 'Property deleted successfully',
        });

        // Verify soft delete
        const deletedProperty = await prisma.property.findUnique({
          where: { id: property.id },
        });
        expect(deletedProperty?.isDeleted).toBe(true);
      });

      it('should prevent deletion of property with active tenants', async () => {
        const property = await prisma.property.create({
          data: {
            name: 'Occupied Property',
            type: 'residential',
            address: '123 Occupied St',
            propertyCode: 'prop-24-0001',
          },
        });

        const unit = await prisma.unit.create({
          data: {
            unitNumber: '101',
            propertyId: property.id,
            unitCode: 'unit-24-0001',
            type: 'apartment',
            status: 'Occupied',
          },
        });

        await prisma.tenant.create({
          data: {
            name: 'Active Tenant',
            unitId: unit.id,
            tenantCode: 'tenant-24-0001',
            isActive: true,
          },
        });

        const response = await request(app)
          .delete(`/api/properties/${property.id}`)
          .set(authHeaders);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Cannot delete property with active tenants');
      });
    });
  });

  describe('Units API', () => {
    let propertyId: string;
    let blockId: string;

    beforeEach(async () => {
      const property = await prisma.property.create({
        data: {
          name: 'Unit Test Property',
          type: 'residential',
          address: '123 Unit St',
          propertyCode: 'prop-24-0001',
        },
      });
      propertyId = property.id;

      const block = await prisma.block.create({
        data: {
          name: 'Block A',
          propertyId,
          blockCode: 'block-24-0001',
        },
      });
      blockId = block.id;
    });

    describe('POST /api/units', () => {
      it('should create unit successfully', async () => {
        const unitData = {
          unitNumber: '101',
          propertyId,
          blockId,
          type: 'apartment',
          status: 'Available',
          bedrooms: 2,
          bathrooms: 2,
          area: 1200.5,
          rentAmount: 1800,
          description: 'Spacious 2BR apartment',
        };

        const response = await request(app)
          .post('/api/units')
          .set(authHeaders)
          .send(unitData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            unitNumber: '101',
            type: 'apartment',
            status: 'Available',
            bedrooms: 2,
            bathrooms: 2,
            area: 1200.5,
            rentAmount: 1800,
            unitCode: expect.stringMatching(/^unit-\d{2}-\d{4}$/),
          },
        });
      });

      it('should prevent duplicate unit numbers in same property', async () => {
        // Create first unit
        await prisma.unit.create({
          data: {
            unitNumber: '101',
            propertyId,
            unitCode: 'unit-24-0001',
            type: 'apartment',
            status: 'Available',
          },
        });

        // Try to create duplicate
        const response = await request(app)
          .post('/api/units')
          .set(authHeaders)
          .send({
            unitNumber: '101',
            propertyId,
            type: 'apartment',
            status: 'Available',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Unit number already exists in this property');
      });
    });

    describe('GET /api/units', () => {
      beforeEach(async () => {
        await prisma.unit.createMany({
          data: [
            {
              unitNumber: '101',
              propertyId,
              unitCode: 'unit-24-0001',
              type: 'apartment',
              status: 'Available',
              rentAmount: 1500,
            },
            {
              unitNumber: '102',
              propertyId,
              unitCode: 'unit-24-0002',
              type: 'apartment',
              status: 'Occupied',
              rentAmount: 1600,
            },
          ],
        });
      });

      it('should get units with filters', async () => {
        const response = await request(app)
          .get(`/api/units?propertyId=${propertyId}&status=Available`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].unitNumber).toBe('101');
      });
    });
  });

  describe('Authorization Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/properties');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should reject requests without proper permissions', async () => {
      const limitedRole = await createTestRole('Limited User', ['crm.view']);
      const limitedUser = await createTestUser({
        email: 'limited@test.com',
        password: 'password123',
        roleId: limitedRole.id,
      });
      const limitedHeaders = await createAuthHeaders(app, 'limited@test.com', 'password123');

      const response = await request(app)
        .post('/api/properties')
        .set(limitedHeaders)
        .send({
          name: 'Test Property',
          type: 'residential',
          address: '123 Test St',
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});