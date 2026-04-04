/**
 * Authentication API Tests
 * Tests all auth endpoints: login, role-login, invite-login, refresh, logout
 */

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../utils/password';
import { createTestApp } from '../helpers/test-app';
import { createTestUser, createTestRole, cleanupDatabase } from '../helpers/test-data';

const prisma = new PrismaClient();
let app: express.Application;

describe('Auth API', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should login admin user successfully', async () => {
      const adminRole = await createTestRole('Admin', ['*']);
      const admin = await createTestUser({
        email: 'admin@test.com',
        password: 'password123',
        roleId: adminRole.id,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
          deviceId: 'test-device-123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        csrfToken: expect.any(String),
        sessionId: expect.any(String),
        deviceId: 'test-device-123',
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: {
            name: 'Admin',
          },
        },
      });
    });

    it('should reject invalid credentials', async () => {
      const adminRole = await createTestRole('Admin', ['*']);
      await createTestUser({
        email: 'admin@test.com',
        password: 'password123',
        roleId: adminRole.id,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid credentials',
      });
    });

    it('should reject non-admin users', async () => {
      const userRole = await createTestRole('User', ['properties.view']);
      await createTestUser({
        email: 'user@test.com',
        password: 'password123',
        roleId: userRole.id,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Only Admin can login directly',
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: '123', // too short
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation error');
    });
  });

  describe('POST /api/auth/role-login', () => {
    it('should login role user successfully', async () => {
      const userRole = await createTestRole('Manager', ['properties.*', 'crm.*']);
      const user = await createTestUser({
        username: 'manager1',
        email: 'manager@test.com',
        password: 'password123',
        roleId: userRole.id,
      });

      const response = await request(app)
        .post('/api/auth/role-login')
        .send({
          username: 'manager1',
          password: 'password123',
          deviceId: 'test-device-456',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          id: user.id,
          username: 'manager1',
          role: {
            name: 'Manager',
          },
        },
      });
    });

    it('should reject invalid username/password', async () => {
      const response = await request(app)
        .post('/api/auth/role-login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid credentials',
      });
    });
  });

  describe('POST /api/auth/invite-login', () => {
    it('should login with valid invite token', async () => {
      const userRole = await createTestRole('Employee', ['attendance.*']);
      
      // Create invite link
      const inviteLink = await prisma.roleInviteLink.create({
        data: {
          roleId: userRole.id,
          username: 'employee1',
          email: 'employee@test.com',
          password: await hashPassword('temppass123'),
          token: 'valid-invite-token-123',
          status: 'pending',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      const response = await request(app)
        .post('/api/auth/invite-login')
        .send({
          token: 'valid-invite-token-123',
          password: 'newpassword123',
          username: 'employee1',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
        user: {
          username: 'employee1',
          email: 'employee@test.com',
        },
      });

      // Verify invite link is used
      const updatedInvite = await prisma.roleInviteLink.findUnique({
        where: { id: inviteLink.id },
      });
      expect(updatedInvite?.status).toBe('used');
    });

    it('should reject expired invite token', async () => {
      const userRole = await createTestRole('Employee', ['attendance.*']);
      
      await prisma.roleInviteLink.create({
        data: {
          roleId: userRole.id,
          username: 'employee2',
          email: 'employee2@test.com',
          password: await hashPassword('temppass123'),
          token: 'expired-invite-token',
          status: 'pending',
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      });

      const response = await request(app)
        .post('/api/auth/invite-login')
        .send({
          token: 'expired-invite-token',
          password: 'newpassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid or expired invite token');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const adminRole = await createTestRole('Admin', ['*']);
      const admin = await createTestUser({
        email: 'admin@test.com',
        password: 'password123',
        roleId: adminRole.id,
      });

      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
        });

      const { refreshToken } = loginResponse.body;

      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toMatchObject({
        token: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const adminRole = await createTestRole('Admin', ['*']);
      await createTestUser({
        email: 'admin@test.com',
        password: 'password123',
        roleId: adminRole.id,
      });

      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
        });

      const { token, refreshToken } = loginResponse.body;

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({
          refreshToken,
        });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const adminRole = await createTestRole('Admin', ['*']);
      const admin = await createTestUser({
        email: 'admin@test.com',
        password: 'password123',
        roleId: adminRole.id,
      });

      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password123',
        });

      const { token } = loginResponse.body;

      // Get user info
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: {
            name: 'Admin',
            permissions: ['*'],
          },
        },
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });
  });
});