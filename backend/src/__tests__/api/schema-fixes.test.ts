import request from 'supertest';
import { app } from '../../app';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/test-app';
import { createTestUser, getAuthToken } from '../helpers/test-data';

describe('Schema Fixes - Property and Unit Endpoints', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    const { user, token } = await createTestUser();
    testUserId = user.id;
    authToken = token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('Property Endpoints', () => {
    describe('POST /api/properties', () => {
      it('should create property with salePrice and amenities as direct fields', async () => {
        const propertyData = {
          name: 'Test Property',
          type: 'residential',
          address: '123 Test Street',
          status: 'Active',
          salePrice: 500000,
          amenities: ['parking', 'gym', 'pool', 'security'],
          totalUnits: 10,
          yearBuilt: 2020,
          totalArea: 5000
        };

        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${authToken}`)
          .send(propertyData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.salePrice).toBe(500000);
        expect(response.body.data.amenities).toEqual(['parking', 'gym', 'pool', 'security']);
        expect(response.body.data.name).toBe('Test Property');
        expect(response.body.data.type).toBe('residential');
      });

      it('should create property without salePrice and amenities', async () => {
        const propertyData = {
          name: 'Basic Property',
          type: 'commercial',
          address: '456 Business Ave',
          status: 'Active'
        };

        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${authToken}`)
          .send(propertyData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.salePrice).toBeNull();
        expect(response.body.data.amenities).toEqual([]);
        expect(response.body.data.name).toBe('Basic Property');
      });

      it('should handle empty amenities array', async () => {
        const propertyData = {
          name: 'Empty Amenities Property',
          type: 'residential',
          address: '789 Empty St',
          amenities: []
        };

        const response = await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${authToken}`)
          .send(propertyData)
          .expect(201);

        expect(response.body.data.amenities).toEqual([]);
      });
    });

    describe('PUT /api/properties/:id', () => {
      let propertyId: string;

      beforeEach(async () => {
        const createResponse = await request(app)
          .post('/api/properties')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Update Test Property',
            type: 'residential',
            address: '123 Update St',
            salePrice: 300000,
            amenities: ['parking']
          });
        
        propertyId = createResponse.body.data.id;
      });

      it('should update property salePrice and amenities', async () => {
        const updateData = {
          salePrice: 600000,
          amenities: ['parking', 'gym', 'pool', 'garden', 'security']
        };

        const response = await request(app)
          .put(`/api/properties/${propertyId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.salePrice).toBe(600000);
        expect(response.body.data.amenities).toEqual(['parking', 'gym', 'pool', 'garden', 'security']);
      });

      it('should update only salePrice', async () => {
        const response = await request(app)
          .put(`/api/properties/${propertyId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ salePrice: 750000 })
          .expect(200);

        expect(response.body.data.salePrice).toBe(750000);
        expect(response.body.data.amenities).toEqual(['parking']); // Should remain unchanged
      });
    });
  });

  describe('Unit Endpoints', () => {
    let propertyId: string;

    beforeAll(async () => {
      const propertyResponse = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Unit Test Property',
          type: 'residential',
          address: '123 Unit Test St'
        });
      
      propertyId = propertyResponse.body.data.id;
    });

    describe('POST /api/units', () => {
      it('should create unit with all new fields', async () => {
        const unitData = {
          unitName: 'A-101',
          propertyId: propertyId,
          status: 'Vacant',
          monthlyRent: 2500,
          unitType: '2BHK',
          sizeSqFt: 1200,
          securityDeposit: 5000,
          utilitiesIncluded: ['water', 'electricity', 'gas'],
          description: 'Spacious 2-bedroom apartment'
        };

        const response = await request(app)
          .post('/api/units')
          .set('Authorization', `Bearer ${authToken}`)
          .send(unitData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.unitName).toBe('A-101');
        expect(response.body.data.unitType).toBe('2BHK');
        expect(response.body.data.sizeSqFt).toBe(1200);
        expect(response.body.data.securityDeposit).toBe(5000);
        expect(response.body.data.utilitiesIncluded).toEqual(['water', 'electricity', 'gas']);
        expect(response.body.data.monthlyRent).toBe(2500);
      });

      it('should create unit with minimal data', async () => {
        const unitData = {
          unitName: 'B-202',
          propertyId: propertyId,
          status: 'Vacant'
        };

        const response = await request(app)
          .post('/api/units')
          .set('Authorization', `Bearer ${authToken}`)
          .send(unitData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.unitName).toBe('B-202');
        expect(response.body.data.unitType).toBeNull();
        expect(response.body.data.sizeSqFt).toBeNull();
        expect(response.body.data.securityDeposit).toBeNull();
        expect(response.body.data.utilitiesIncluded).toEqual([]);
      });

      it('should handle empty utilitiesIncluded array', async () => {
        const unitData = {
          unitName: 'C-303',
          propertyId: propertyId,
          utilitiesIncluded: []
        };

        const response = await request(app)
          .post('/api/units')
          .set('Authorization', `Bearer ${authToken}`)
          .send(unitData)
          .expect(201);

        expect(response.body.data.utilitiesIncluded).toEqual([]);
      });
    });

    describe('PUT /api/units/:id', () => {
      let unitId: string;

      beforeEach(async () => {
        const createResponse = await request(app)
          .post('/api/units')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            unitName: 'Update-Test-Unit',
            propertyId: propertyId,
            unitType: '1BHK',
            sizeSqFt: 800,
            securityDeposit: 3000,
            utilitiesIncluded: ['water']
          });
        
        unitId = createResponse.body.data.id;
      });

      it('should update unit with new field values', async () => {
        const updateData = {
          unitType: '3BHK',
          sizeSqFt: 1500,
          securityDeposit: 7500,
          utilitiesIncluded: ['water', 'electricity', 'gas', 'internet'],
          monthlyRent: 3500
        };

        const response = await request(app)
          .put(`/api/units/${unitId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.unitType).toBe('3BHK');
        expect(response.body.data.sizeSqFt).toBe(1500);
        expect(response.body.data.securityDeposit).toBe(7500);
        expect(response.body.data.utilitiesIncluded).toEqual(['water', 'electricity', 'gas', 'internet']);
        expect(response.body.data.monthlyRent).toBe(3500);
      });

      it('should update only specific fields', async () => {
        const response = await request(app)
          .put(`/api/units/${unitId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ unitType: 'Studio', sizeSqFt: 600 })
          .expect(200);

        expect(response.body.data.unitType).toBe('Studio');
        expect(response.body.data.sizeSqFt).toBe(600);
        expect(response.body.data.securityDeposit).toBe(3000); // Should remain unchanged
        expect(response.body.data.utilitiesIncluded).toEqual(['water']); // Should remain unchanged
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid property data gracefully', async () => {
      const invalidData = {
        // Missing required fields
        salePrice: 'invalid-number',
        amenities: 'not-an-array'
      };

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation error');
    });

    it('should handle invalid unit data gracefully', async () => {
      const invalidData = {
        unitName: '', // Empty required field
        sizeSqFt: 'not-a-number',
        utilitiesIncluded: 'not-an-array'
      };

      const response = await request(app)
        .post('/api/units')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation error');
    });
  });
});