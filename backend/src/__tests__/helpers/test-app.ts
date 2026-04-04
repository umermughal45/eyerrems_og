/**
 * Test App Setup
 * Creates Express app instance for testing
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateEnv } from '../../utils/env-validation';

// Import all routes
import authRoutes from '../../routes/auth';
import roleRoutes from '../../routes/roles';
import notificationRoutes from '../../routes/notifications';
import propertiesRoutes from '../../routes/properties';
import unitsRoutes from '../../routes/units';
import tenantsRoutes from '../../routes/tenants';
import leasesRoutes from '../../routes/leases';
import salesRoutes from '../../routes/sales';
import buyersRoutes from '../../routes/buyers';
import blocksRoutes from '../../routes/blocks';
import floorsRoutes from '../../routes/floors';
import statsRoutes from '../../routes/stats';
import uploadRoutes from '../../routes/upload';
import chatRoutes from '../../routes/chat';
import employeesRoutes from '../../routes/employees';
import attendanceRoutes from '../../routes/attendance';
import payrollRoutes from '../../routes/payroll';
import leaveRoutes from '../../routes/leave';
import crmRoutes from '../../routes/crm';
import financeRoutes from '../../routes/finance';
import backupRoutes from '../../routes/backup';
import tenantPortalRoutes from '../../routes/tenant-portal';
import bulkRoutes from '../../routes/bulk';
import excelBulkRoutes from '../../routes/excel-bulk';
import propertiesEnhancedRoutes from '../../routes/properties-enhanced';
import financeEnhancedRoutes from '../../routes/finance-enhanced';
import crmEnhancedRoutes from '../../routes/crm-enhanced';
import financeReportsRoutes from '../../routes/finance-reports';
import locationRoutes from '../../routes/locations';
import advancedOptionsRoutes from '../../routes/advanced-options';
import secureFilesRoutes from '../../routes/secure-files';
import recycleBinRoutes from '../../routes/recycle-bin';
import subsidiariesRoutes from '../../routes/subsidiaries';

import { csrfProtection } from '../../middleware/csrf';
import { errorResponse } from '../../utils/error-handler';

/**
 * Create Express app for testing
 * Mirrors production app setup but with test-specific configurations
 */
export async function createTestApp(): Promise<express.Application> {
  const app = express();

  // Trust proxy for testing
  app.set('trust proxy', 1);

  // CORS - Allow all origins in test
  app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-csrf-token',
      'X-CSRF-Token',
      'X-Device-Id',
      'X-Session-Id',
    ],
    credentials: true,
  }));

  // Security middleware (relaxed for testing)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Rate limiting (very permissive for testing)
  const testLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // Very high limit for tests
    message: { error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(testLimiter);

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CSRF protection (enabled for testing CSRF scenarios)
  app.use(csrfProtection);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', environment: 'test' });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/properties', propertiesRoutes);
  app.use('/api/properties-enhanced', propertiesEnhancedRoutes);
  app.use('/api/units', unitsRoutes);
  app.use('/api/tenants', tenantsRoutes);
  app.use('/api/leases', leasesRoutes);
  app.use('/api/sales', salesRoutes);
  app.use('/api/buyers', buyersRoutes);
  app.use('/api/blocks', blocksRoutes);
  app.use('/api/floors', floorsRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/employees', employeesRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/payroll', payrollRoutes);
  app.use('/api/leave', leaveRoutes);
  app.use('/api/crm', crmRoutes);
  app.use('/api/crm-enhanced', crmEnhancedRoutes);
  app.use('/api/finance', financeRoutes);
  app.use('/api/finance-enhanced', financeEnhancedRoutes);
  app.use('/api/finance-reports', financeReportsRoutes);
  app.use('/api/backup', backupRoutes);
  app.use('/api/tenant-portal', tenantPortalRoutes);
  app.use('/api/bulk', bulkRoutes);
  app.use('/api/excel-bulk', excelBulkRoutes);
  app.use('/api/locations', locationRoutes);
  app.use('/api/advanced-options', advancedOptionsRoutes);
  app.use('/api/secure-files', secureFilesRoutes);
  app.use('/api/recycle-bin', recycleBinRoutes);
  app.use('/api/subsidiaries', subsidiariesRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    return errorResponse(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
  });

  // Global error handler
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('Test app error:', error);
    return errorResponse(res, error.message || 'Internal server error', error.statusCode || 500);
  });

  return app;
}