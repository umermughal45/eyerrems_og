import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateEnv } from './utils/env-validation';
import authRoutes from './routes/auth';
import roleRoutes from './routes/roles';
import userRoutes from './routes/users';
import permissionsRoutes from './routes/permissions';
import notificationRoutes from './routes/notifications';
import remindersRoutes from './routes/reminders';
import notificationLogsRoutes from './routes/notification-logs';
import propertiesRoutes from './routes/properties';
import unitsRoutes from './routes/units';
import tenantsRoutes from './routes/tenants';
import leasesRoutes from './routes/leases';
import salesRoutes from './routes/sales';
import buyersRoutes from './routes/buyers';
import blocksRoutes from './routes/blocks';
import floorsRoutes from './routes/floors';
import statsRoutes from './routes/stats';
import uploadRoutes from './routes/upload';
import chatRoutes from './routes/chat';
import employeesRoutes from './routes/employees';
import attendanceRoutes from './routes/attendance';
import payrollRoutes from './routes/payroll';
import leaveRoutes from './routes/leave';
import transactionsRoutes from './routes/transactions';
import crmRoutes from './routes/crm';
import financeRoutes from './routes/finance';
import backupRoutes from './routes/backup';
import tenantPortalRoutes from './routes/tenant-portal';
import bulkRoutes from './routes/bulk';
import excelBulkRoutes from './routes/excel-bulk';
import propertiesEnhancedRoutes from './routes/properties-enhanced';
import financeEnhancedRoutes from './routes/finance-enhanced';
import crmEnhancedRoutes from './routes/crm-enhanced';
import crmLeadImportRoutes from './routes/crm-lead-import';
import financeReportsRoutes from './routes/finance-reports';
import financialReportsRoutes from './routes/financial-reports';
import locationRoutes from './routes/locations';
import advancedOptionsRoutes from './routes/advanced-options';
import secureFilesRoutes from './routes/secure-files';
import recycleBinRoutes from './routes/recycle-bin';
import subsidiariesRoutes from './routes/subsidiaries';
import accountsRoutes from './routes/accounts';
import entityAccountsRoutes from './routes/entity-accounts';
import fraudDetectionRoutes from './routes/fraud-detection';
import filesRoutes from './routes/files';
import constructionRoutes from './routes/construction';
import aiIntelligenceRoutes from './routes/ai-intelligence';
import aiChatRoutes from './routes/ai-chat';
import exportJobRoutes from './routes/export-jobs';
import financeOperationsRoutes from './routes/finance-operations';
import settingsRoutes from './routes/settings';
import currencyRoutes from './routes/currency';
import mailRoutes from './routes/mail';
import companyAuthRoutes from './routes/company-auth';
import companiesRoutes from './routes/companies';
import { csrfProtection } from './middleware/csrf';
import { apiLoggingMiddleware } from './middleware/api-logging';
import path from 'path';
import logger from './utils/logger';
import { errorResponse } from './utils/error-handler';
import prisma from './prisma/client';
import { startReminderScheduler } from './services/reminder-engine/scheduler/reminderScheduler';
import { startReminderWorker } from './services/reminder-engine/queue/reminderWorker';
import { registerAutomationRuleHandlers } from './services/reminder-engine/rules/automationRules';
import net from 'net';

async function canConnectTcp(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function parseRedisHostPort(redisUrl: string): { host: string; port: number } {
  const u = new URL(redisUrl);
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port ? parseInt(u.port, 10) : 6379,
  };
}

// Global error handlers to prevent app from crashing
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Validate environment variables at startup, but don't crash
try {
  validateEnv();
} catch (error) {
  console.error('⚠️ Environment validation warning: Some required variables are missing.');
  console.error(error);
  // We no longer process.exit(1) here to allow the app to bind to the port
}

const app: any = express();

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(req.method, req.url);
  next();
});

let env;
try {
  env = validateEnv();
} catch (e) { /* ignore */ }
const PORT = process.env.PORT || 5000;

// Trust proxy - Required for Railway, Vercel, and other cloud platforms
// This allows Express to correctly identify client IPs behind reverse proxies
// Trust only 1 proxy hop (standard for most cloud platforms)
// This is more secure than trusting all proxies
app.set('trust proxy', 1);

// Initialize Reminder Engine (scheduler, worker, automation rules)
if (process.env.NODE_ENV !== 'test') {
  try {
    registerAutomationRuleHandlers();
    if (process.env.USE_REDIS_QUEUE !== 'true') {
      logger.warn('⚠️ Redis queue disabled — running in development mode (synchronous reminders)');
      startReminderScheduler();
    } else if (!process.env.REDIS_URL) {
      logger.warn('⚠️ Reminder Engine queue disabled: REDIS_URL is not set');
      logger.warn('   Reminders will be created, but delivery will not be queued/sent.');
      startReminderScheduler();
    } else {
      const redisUrl = process.env.REDIS_URL;
      const { host, port } = parseRedisHostPort(redisUrl);

      let started = false;
      const tryStart = async () => {
        if (started) return;
        const ok = await canConnectTcp(host, port);
        if (!ok) {
          logger.warn(`⚠️ Reminder Engine waiting for Redis at ${host}:${port}`);
          return;
        }
        started = true;
        startReminderScheduler();
        startReminderWorker();
        logger.info('✅ Reminder Engine initialized (queue enabled)');
      };

      // Try immediately, then keep retrying without spamming stack traces
      void tryStart();
      const interval = setInterval(() => {
        void tryStart().then(() => {
          if (started) clearInterval(interval);
        });
      }, 30_000);
    }
  } catch (error: any) {
    logger.error('❌ Failed to initialize Reminder Engine', {
      error: error?.message || String(error),
    });
  }
}

// CORS configuration - MUST be before other middleware
const allowedOrigins = [
  'https://eyer-rems-v1-p3c3.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'https://eyer-rems-v1-production-ee31.up.railway.app'
];

const corsOptions = {
  origin: (origin: any, callback: any) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-csrf-token', 'X-CSRF-Token', 'X-Device-Id', 'X-Session-Id'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Cookie parser - MUST be before CSRF middleware to read cookies
app.use(cookieParser());

// SECURITY: Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: false
}));

// SECURITY: Rate limiting - More lenient in development
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 5000 : 100, // Higher limit in development (5000) vs production (100)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator that combines IP with user agent for better security
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    // Combine IP with user agent hash to prevent simple IP spoofing
    return `${ip}-${userAgent.substring(0, 50)}`;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return (req.path || '') === '/api/health';
  },
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// API Request/Response Logging (after rate limiting, before routes)
app.use('/api/', apiLoggingMiddleware);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: isDevelopment ? 300 : 50,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
  // Custom key generator that combines IP with user agent for better security
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    // Combine IP with user agent hash to prevent simple IP spoofing
    return `${ip}-${userAgent.substring(0, 50)}`;
  },
});

app.use('/api/auth/', authLimiter);

// Body parsing middleware
app.use((express as any).json({ limit: '50mb' })); // Limit JSON payload size (supports base64 images)
app.use((express as any).urlencoded({ extended: true, limit: '50mb' }));

// CSRF Protection for state-changing routes
// Note: Applied before routes to protect state-changing requests
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for safe methods and auth endpoints
  const path = req.path || req.url || '';
  const isAuthEndpoint = path.includes('/auth/login') ||
    path.includes('/auth/role-login') ||
    path.includes('/auth/invite-login') ||
    path.includes('/auth/refresh') ||
    path.includes('/company-auth/login') ||
    path.includes('/company-auth/me');

  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method || '') ||
    isAuthEndpoint ||
    path.includes('/health')) {
    return next();
  }

  // Log CSRF check for debugging
  logger.info('CSRF check for POST/PUT/DELETE', {
    method: req.method,
    path: path,
    url: req.url,
  });

  return csrfProtection(req as any, res, next);
});

// Serve secure files (authenticated endpoint)
app.use('/api/secure-files', secureFilesRoutes);

// New centralized file handling routes
app.use('/api/files', filesRoutes);

// Note: The /api/secure-files/:entityType/:entityId/:filename route is handled by secureFilesRoutes above
// This wildcard route is kept for backward compatibility but should not be used for new uploads
// All new files should use the structured route: /api/secure-files/:entityType/:entityId/:filename

// Legacy static file serving (deprecated - use secure-files endpoint)
// Keep for backward compatibility but files should be moved outside web root
app.use('/uploads', (express as any).static(path.join(process.cwd(), 'public', 'uploads')));

// Routes
// Primary API auth routes (recommended)
app.use('/api/auth', authRoutes);
// Backward-compatible alias so calls to /auth/* also work in production
// (useful if frontend is configured without the /api prefix)
app.use('/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/notification-logs', notificationLogsRoutes);

// Backward/compatibility aliases for clients that accidentally double-prefix "/api"
// e.g. frontend baseURL="/api" calling "/api/reminders" -> "/api/api/reminders"
app.use('/api/api/notifications', notificationRoutes);
app.use('/api/api/reminders', remindersRoutes);
app.use('/api/api/notification-logs', notificationLogsRoutes);

app.use('/api/properties', propertiesRoutes);
app.use('/api/locations', locationRoutes);
// Mount subsidiaries routes with logging
app.use('/api/subsidiaries', subsidiariesRoutes);
logger.info('✅ Subsidiaries routes mounted at /api/subsidiaries');
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
app.use('/api/hr/employees', employeesRoutes);
app.use('/api/hr/attendance', attendanceRoutes);
app.use('/api/hr/payroll', payrollRoutes);
app.use('/api/hr/leave', leaveRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/finance-operations', financeOperationsRoutes);
app.use('/api/finance-enhanced', financeEnhancedRoutes);
app.use('/api/finance-reports', financeReportsRoutes);
app.use('/api/financial-reports', financialReportsRoutes);
app.use('/api/fraud-detection', fraudDetectionRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/entity-accounts', entityAccountsRoutes);
app.use('/api/properties-enhanced', propertiesEnhancedRoutes);
app.use('/api/crm-enhanced', crmEnhancedRoutes);
app.use('/api/crm-enhanced', crmLeadImportRoutes);
app.use('/api/advanced-options', advancedOptionsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/tenant-portal', tenantPortalRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/bulk/excel', excelBulkRoutes);
app.use('/api/recycle-bin', recycleBinRoutes);
app.use('/api/construction', constructionRoutes);
app.use('/api/ai-intelligence', aiIntelligenceRoutes);
app.use('/api/ai-chat', aiChatRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api', exportJobRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/currencies', currencyRoutes);
app.use('/api/mail', mailRoutes);

// ─── Company Isolation Layer ─────────────────────────────────────────────────
app.use('/api/company-auth', companyAuthRoutes);
app.use('/api/companies', companiesRoutes);

// Health check with DB connection test
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'REMS Backend is running',
      database: 'connected'
    });
  } catch (error: any) {
    logger.error('Health check failed - Database connection error:', error);
    // Don't crash, just report the error in the health check
    res.status(200).json({
      status: 'ok',
      message: 'REMS Backend is running (Database disconnected)',
      error: error.message
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  logger.warn('404 - Route not found', {
    method: req.method,
    path: req.path,
    url: req.url,
    originalUrl: (req as any).originalUrl || req.url,
  });
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  errorResponse(res, err, (err as { statusCode?: number })?.statusCode || 500);
});

// const server = app.listen(PORT, '0.0.0.0', () => {
//   logger.info(`🚀 Server running on port ${PORT}`);
//   logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
//   logger.info(`🌐 Server accessible at http://localhost:${PORT}`);
// });

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server errors
if (server && typeof server.on === 'function') {
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`❌ Port ${PORT} is already in use.`);
      logger.error(`   Please stop the process using port ${PORT} or change the PORT environment variable.`);
      logger.error(`   To find the process: netstat -ano | findstr :${PORT}`);
      logger.error(`   To kill it: taskkill /PID <PID> /F`);
      process.exit(1);
    } else {
      logger.error('❌ Server error:', error);
      process.exit(1);
    }
  });
}

// trigger restart
