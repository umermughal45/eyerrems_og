/**
 * Employees API Tests
 * Tests employees, attendance, payroll, leave management
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
  createTestEmployee
} from '../helpers/test-data';

const prisma = new PrismaClient();
let app: express.Application;
let authHeaders: { Authorization: string; 'X-CSRF-Token': string };
let userId: string;

describe('Employees API', () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    
    // Create user with HR permissions
    const hrRole = await createTestRole('HR Manager', [
      'employees.*',
      'attendance.*',
      'payroll.*',
      'leave.*',
    ]);
    const user = await createTestUser({
      email: 'hr@test.com',
      password: 'password123',
      roleId: hrRole.id,
    });
    userId = user.id;
    authHeaders = await createAuthHeaders(app, 'hr@test.com', 'password123');
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  describe('Employees API', () => {
    describe('POST /api/employees', () => {
      it('should create employee successfully', async () => {
        const employeeData = {
          name: 'John Employee',
          email: 'john.employee@company.com',
          phone: '+1234567890',
          position: 'Software Engineer',
          department: 'IT',
          salary: 75000,
          hireDate: new Date().toISOString(),
          address: '123 Employee St',
          emergencyContact: 'Jane Employee - +1987654321',
          bankAccount: '1234567890',
          taxId: 'TAX123456',
        };

        const response = await request(app)
          .post('/api/employees')
          .set(authHeaders)
          .send(employeeData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            name: 'John Employee',
            email: 'john.employee@company.com',
            position: 'Software Engineer',
            department: 'IT',
            salary: 75000,
            isActive: true,
            employeeCode: expect.stringMatching(/^emp-\d{2}-\d{4}$/),
          },
        });
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/employees')
          .set(authHeaders)
          .send({
            name: '', // empty name
            email: 'invalid-email',
            salary: -1000, // negative salary
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });

      it('should prevent duplicate emails', async () => {
        // Create first employee
        await createTestEmployee({
          name: 'First Employee',
          email: 'duplicate@company.com',
        });

        // Try to create duplicate
        const response = await request(app)
          .post('/api/employees')
          .set(authHeaders)
          .send({
            name: 'Second Employee',
            email: 'duplicate@company.com',
            position: 'Manager',
            department: 'HR',
            salary: 60000,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Unique constraint violation');
      });
    });

    describe('GET /api/employees', () => {
      beforeEach(async () => {
        await prisma.employee.createMany({
          data: [
            {
              name: 'Active Employee',
              email: 'active@company.com',
              employeeCode: 'emp-24-0001',
              position: 'Developer',
              department: 'IT',
              salary: 70000,
              isActive: true,
            },
            {
              name: 'Inactive Employee',
              email: 'inactive@company.com',
              employeeCode: 'emp-24-0002',
              position: 'Designer',
              department: 'Design',
              salary: 65000,
              isActive: false,
            },
          ],
        });
      });

      it('should get employees with pagination', async () => {
        const response = await request(app)
          .get('/api/employees?page=1&limit=10')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              name: 'Active Employee',
              isActive: true,
            }),
            expect.objectContaining({
              name: 'Inactive Employee',
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

      it('should filter employees by department', async () => {
        const response = await request(app)
          .get('/api/employees?department=IT')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Active Employee');
      });

      it('should filter employees by status', async () => {
        const response = await request(app)
          .get('/api/employees?status=active')
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe('Active Employee');
      });
    });

    describe('PUT /api/employees/:id', () => {
      it('should update employee successfully', async () => {
        const employee = await createTestEmployee({
          name: 'Update Employee',
          email: 'update@company.com',
          position: 'Junior Developer',
          salary: 50000,
        });

        const response = await request(app)
          .put(`/api/employees/${employee.id}`)
          .set(authHeaders)
          .send({
            position: 'Senior Developer',
            salary: 80000,
            department: 'Engineering',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            position: 'Senior Developer',
            salary: 80000,
            department: 'Engineering',
          },
        });
      });
    });
  });

  describe('Attendance API', () => {
    let employeeId: string;

    beforeEach(async () => {
      const employee = await createTestEmployee({
        name: 'Attendance Employee',
        email: 'attendance@company.com',
      });
      employeeId = employee.id;
    });

    describe('POST /api/attendance', () => {
      it('should record attendance successfully', async () => {
        const attendanceData = {
          employeeId,
          date: new Date().toISOString().split('T')[0],
          checkIn: '09:00:00',
          checkOut: '17:00:00',
          status: 'present',
          hoursWorked: 8,
          notes: 'Regular working day',
        };

        const response = await request(app)
          .post('/api/attendance')
          .set(authHeaders)
          .send(attendanceData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            status: 'present',
            hoursWorked: 8,
            checkIn: '09:00:00',
            checkOut: '17:00:00',
          },
        });
      });

      it('should prevent duplicate attendance for same date', async () => {
        const today = new Date().toISOString().split('T')[0];
        
        // Create first attendance record
        await prisma.attendance.create({
          data: {
            employeeId,
            date: new Date(today),
            status: 'present',
            hoursWorked: 8,
          },
        });

        // Try to create duplicate
        const response = await request(app)
          .post('/api/attendance')
          .set(authHeaders)
          .send({
            employeeId,
            date: today,
            status: 'present',
            hoursWorked: 8,
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Attendance already recorded for this date');
      });

      it('should validate attendance status', async () => {
        const response = await request(app)
          .post('/api/attendance')
          .set(authHeaders)
          .send({
            employeeId,
            date: new Date().toISOString().split('T')[0],
            status: 'invalid-status',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation error');
      });
    });

    describe('GET /api/attendance', () => {
      beforeEach(async () => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        await prisma.attendance.createMany({
          data: [
            {
              employeeId,
              date: today,
              status: 'present',
              hoursWorked: 8,
              checkIn: '09:00:00',
              checkOut: '17:00:00',
            },
            {
              employeeId,
              date: yesterday,
              status: 'absent',
              hoursWorked: 0,
            },
          ],
        });
      });

      it('should get attendance records', async () => {
        const response = await request(app)
          .get(`/api/attendance?employeeId=${employeeId}`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              status: 'present',
              hoursWorked: 8,
            }),
            expect.objectContaining({
              status: 'absent',
              hoursWorked: 0,
            }),
          ]),
        });
      });

      it('should filter attendance by date range', async () => {
        const today = new Date().toISOString().split('T')[0];
        const response = await request(app)
          .get(`/api/attendance?startDate=${today}&endDate=${today}`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('present');
      });
    });
  });

  describe('Leave Management API', () => {
    let employeeId: string;

    beforeEach(async () => {
      const employee = await createTestEmployee({
        name: 'Leave Employee',
        email: 'leave@company.com',
      });
      employeeId = employee.id;

      // Create leave balance
      await prisma.leaveBalance.create({
        data: {
          employeeId,
          leaveType: 'annual',
          totalDays: 20,
          usedDays: 5,
          remainingDays: 15,
          year: new Date().getFullYear(),
        },
      });
    });

    describe('POST /api/leave/requests', () => {
      it('should create leave request successfully', async () => {
        const leaveData = {
          employeeId,
          leaveType: 'annual',
          startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
          days: 3,
          reason: 'Family vacation',
        };

        const response = await request(app)
          .post('/api/leave/requests')
          .set(authHeaders)
          .send(leaveData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            leaveType: 'annual',
            days: 3,
            reason: 'Family vacation',
            status: 'pending',
          },
        });
      });

      it('should validate leave balance', async () => {
        const response = await request(app)
          .post('/api/leave/requests')
          .set(authHeaders)
          .send({
            employeeId,
            leaveType: 'annual',
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            days: 20, // exceeds remaining balance
            reason: 'Long vacation',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Insufficient leave balance');
      });

      it('should validate date range', async () => {
        const response = await request(app)
          .post('/api/leave/requests')
          .set(authHeaders)
          .send({
            employeeId,
            leaveType: 'annual',
            startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // end before start
            days: 3,
            reason: 'Invalid dates',
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('End date must be after start date');
      });
    });

    describe('PUT /api/leave/requests/:id/approve', () => {
      it('should approve leave request', async () => {
        const leaveRequest = await prisma.leaveRequest.create({
          data: {
            employeeId,
            leaveType: 'annual',
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
            days: 3,
            reason: 'Vacation',
            status: 'pending',
          },
        });

        const response = await request(app)
          .put(`/api/leave/requests/${leaveRequest.id}/approve`)
          .set(authHeaders)
          .send({
            approverComments: 'Approved for vacation',
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            status: 'approved',
            approverComments: 'Approved for vacation',
          },
        });

        // Verify leave balance updated
        const updatedBalance = await prisma.leaveBalance.findFirst({
          where: { employeeId, leaveType: 'annual' },
        });
        expect(updatedBalance?.usedDays).toBe(8);
        expect(updatedBalance?.remainingDays).toBe(12);
      });
    });
  });

  describe('Payroll API', () => {
    let employeeId: string;

    beforeEach(async () => {
      const employee = await createTestEmployee({
        name: 'Payroll Employee',
        email: 'payroll@company.com',
        salary: 60000,
      });
      employeeId = employee.id;
    });

    describe('POST /api/payroll', () => {
      it('should generate payroll successfully', async () => {
        const payrollData = {
          employeeId,
          payPeriodStart: new Date(2024, 0, 1).toISOString(),
          payPeriodEnd: new Date(2024, 0, 31).toISOString(),
          basicSalary: 5000,
          allowances: 500,
          deductions: 800,
          netSalary: 4700,
          hoursWorked: 160,
          overtimeHours: 10,
          overtimePay: 200,
        };

        const response = await request(app)
          .post('/api/payroll')
          .set(authHeaders)
          .send(payrollData);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            basicSalary: 5000,
            allowances: 500,
            deductions: 800,
            netSalary: 4700,
            status: 'draft',
          },
        });
      });

      it('should validate salary calculations', async () => {
        const response = await request(app)
          .post('/api/payroll')
          .set(authHeaders)
          .send({
            employeeId,
            payPeriodStart: new Date(2024, 0, 1).toISOString(),
            payPeriodEnd: new Date(2024, 0, 31).toISOString(),
            basicSalary: 5000,
            allowances: 500,
            deductions: 800,
            netSalary: 5000, // incorrect calculation
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Net salary calculation is incorrect');
      });
    });

    describe('GET /api/payroll', () => {
      beforeEach(async () => {
        await prisma.payroll.createMany({
          data: [
            {
              employeeId,
              payPeriodStart: new Date(2024, 0, 1),
              payPeriodEnd: new Date(2024, 0, 31),
              basicSalary: 5000,
              netSalary: 4500,
              status: 'paid',
            },
            {
              employeeId,
              payPeriodStart: new Date(2024, 1, 1),
              payPeriodEnd: new Date(2024, 1, 28),
              basicSalary: 5000,
              netSalary: 4600,
              status: 'draft',
            },
          ],
        });
      });

      it('should get payroll records', async () => {
        const response = await request(app)
          .get(`/api/payroll?employeeId=${employeeId}`)
          .set(authHeaders);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              basicSalary: 5000,
              status: 'paid',
            }),
            expect.objectContaining({
              basicSalary: 5000,
              status: 'draft',
            }),
          ]),
        });
      });
    });
  });

  describe('Authorization Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/employees');

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
        .post('/api/employees')
        .set(limitedHeaders)
        .send({
          name: 'Test Employee',
          position: 'Staff',
          department: 'General',
          salary: 50000,
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Insufficient permissions');
    });
  });
});