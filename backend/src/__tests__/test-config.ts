/**
 * Test Configuration
 * Centralized configuration for all tests
 */

export const TEST_CONFIG = {
  // Database
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db',
    timeout: 30000,
  },
  
  // Authentication
  auth: {
    jwtSecret: 'test-secret-key-for-jwt-signing-very-long-and-secure',
    tokenExpiry: '1h',
    refreshTokenExpiry: '7d',
  },
  
  // Test data
  testData: {
    adminUser: {
      email: 'admin@test.com',
      password: 'password123',
      username: 'admin',
    },
    regularUser: {
      email: 'user@test.com',
      password: 'password123',
      username: 'user',
    },
    deviceId: 'test-device-123',
  },
  
  // API endpoints
  endpoints: {
    auth: {
      login: '/api/auth/login',
      roleLogin: '/api/auth/role-login',
      inviteLogin: '/api/auth/invite-login',
      refresh: '/api/auth/refresh',
      logout: '/api/auth/logout',
      me: '/api/auth/me',
    },
    crm: {
      leads: '/api/crm/leads',
      clients: '/api/crm/clients',
      deals: '/api/crm/deals',
      communications: '/api/crm/communications',
    },
    properties: {
      properties: '/api/properties',
      units: '/api/units',
      blocks: '/api/blocks',
      floors: '/api/floors',
    },
    tenants: {
      tenants: '/api/tenants',
      payments: '/api/tenants/payments',
      convert: '/api/tenants/convert-from-client',
    },
    finance: {
      accounts: '/api/finance/accounts',
      transactions: '/api/finance/transactions',
      invoices: '/api/finance/invoices',
      journalEntries: '/api/finance/journal-entries',
    },
    employees: {
      employees: '/api/employees',
      attendance: '/api/attendance',
      payroll: '/api/payroll',
      leave: '/api/leave',
    },
  },
  
  // Test timeouts
  timeouts: {
    api: 10000,
    database: 30000,
    integration: 60000,
  },
  
  // Validation patterns
  patterns: {
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    phone: /^\+?[\d\s\-\(\)]+$/,
    propertyCode: /^prop-\d{2}-\d{4}$/,
    clientCode: /^cli-\d{2}-\d{4}$/,
    leadCode: /^lead-\d{2}-\d{4}$/,
    dealCode: /^dl-\d{2}-\d{4}$/,
    tenantCode: /^TENANT-\d{8}-\d{4}$/,
    employeeCode: /^emp-\d{2}-\d{4}$/,
    unitCode: /^unit-\d{2}-\d{4}$/,
    invoiceNumber: /^INV-\d{8}-\d{3}$/,
  },
  
  // Expected response structures
  responseStructures: {
    success: {
      success: true,
      data: expect.any(Object),
    },
    successWithPagination: {
      success: true,
      data: expect.any(Array),
      pagination: {
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      },
    },
    error: {
      success: false,
      error: expect.any(String),
    },
    validationError: {
      success: false,
      error: 'Validation error',
      details: expect.any(Array),
    },
  },
  
  // Common test scenarios
  scenarios: {
    pagination: {
      default: { page: 1, limit: 10 },
      large: { page: 1, limit: 100 },
      invalid: { page: 0, limit: 1000 },
    },
    dateRanges: {
      today: () => new Date().toISOString().split('T')[0],
      tomorrow: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        return date.toISOString().split('T')[0];
      },
      nextWeek: () => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString();
      },
      nextMonth: () => {
        const date = new Date();
        date.setMonth(date.getMonth() + 1);
        return date.toISOString();
      },
    },
  },
  
  // Error messages
  errorMessages: {
    auth: {
      noToken: 'Authentication required',
      invalidToken: 'Invalid token',
      noPermission: 'Insufficient permissions',
      csrfRequired: 'CSRF token required',
    },
    validation: {
      required: 'is required',
      invalid: 'is invalid',
      tooShort: 'is too short',
      tooLong: 'is too long',
    },
    database: {
      notFound: 'not found',
      uniqueConstraint: 'Unique constraint violation',
      foreignKey: 'Foreign key constraint violation',
    },
  },
  
  // Performance thresholds
  performance: {
    maxResponseTime: 5000, // 5 seconds
    maxDatabaseQueryTime: 1000, // 1 second
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
  },
};

export default TEST_CONFIG;