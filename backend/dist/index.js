"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_validation_1 = require("./utils/env-validation");
const auth_1 = __importDefault(require("./routes/auth"));
const roles_1 = __importDefault(require("./routes/roles"));
const users_1 = __importDefault(require("./routes/users"));
const permissions_1 = __importDefault(require("./routes/permissions"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const reminders_1 = __importDefault(require("./routes/reminders"));
const notification_logs_1 = __importDefault(require("./routes/notification-logs"));
const properties_1 = __importDefault(require("./routes/properties"));
const units_1 = __importDefault(require("./routes/units"));
const tenants_1 = __importDefault(require("./routes/tenants"));
const leases_1 = __importDefault(require("./routes/leases"));
const sales_1 = __importDefault(require("./routes/sales"));
const buyers_1 = __importDefault(require("./routes/buyers"));
const blocks_1 = __importDefault(require("./routes/blocks"));
const floors_1 = __importDefault(require("./routes/floors"));
const stats_1 = __importDefault(require("./routes/stats"));
const upload_1 = __importDefault(require("./routes/upload"));
const chat_1 = __importDefault(require("./routes/chat"));
const employees_1 = __importDefault(require("./routes/employees"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const payroll_1 = __importDefault(require("./routes/payroll"));
const leave_1 = __importDefault(require("./routes/leave"));
const transactions_1 = __importDefault(require("./routes/transactions"));
const crm_1 = __importDefault(require("./routes/crm"));
const finance_1 = __importDefault(require("./routes/finance"));
const backup_1 = __importDefault(require("./routes/backup"));
const tenant_portal_1 = __importDefault(require("./routes/tenant-portal"));
const bulk_1 = __importDefault(require("./routes/bulk"));
const excel_bulk_1 = __importDefault(require("./routes/excel-bulk"));
const properties_enhanced_1 = __importDefault(require("./routes/properties-enhanced"));
const finance_enhanced_1 = __importDefault(require("./routes/finance-enhanced"));
const crm_enhanced_1 = __importDefault(require("./routes/crm-enhanced"));
const crm_lead_import_1 = __importDefault(require("./routes/crm-lead-import"));
const finance_reports_1 = __importDefault(require("./routes/finance-reports"));
const financial_reports_1 = __importDefault(require("./routes/financial-reports"));
const locations_1 = __importDefault(require("./routes/locations"));
const advanced_options_1 = __importDefault(require("./routes/advanced-options"));
const secure_files_1 = __importDefault(require("./routes/secure-files"));
const recycle_bin_1 = __importDefault(require("./routes/recycle-bin"));
const subsidiaries_1 = __importDefault(require("./routes/subsidiaries"));
const accounts_1 = __importDefault(require("./routes/accounts"));
const entity_accounts_1 = __importDefault(require("./routes/entity-accounts"));
const fraud_detection_1 = __importDefault(require("./routes/fraud-detection"));
const files_1 = __importDefault(require("./routes/files"));
const construction_1 = __importDefault(require("./routes/construction"));
const ai_intelligence_1 = __importDefault(require("./routes/ai-intelligence"));
const ai_chat_1 = __importDefault(require("./routes/ai-chat"));
const export_jobs_1 = __importDefault(require("./routes/export-jobs"));
const finance_operations_1 = __importDefault(require("./routes/finance-operations"));
const settings_1 = __importDefault(require("./routes/settings"));
const currency_1 = __importDefault(require("./routes/currency"));
const mail_1 = __importDefault(require("./routes/mail"));
const company_auth_1 = __importDefault(require("./routes/company-auth"));
const companies_1 = __importDefault(require("./routes/companies"));
const csrf_1 = require("./middleware/csrf");
const api_logging_1 = require("./middleware/api-logging");
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./utils/logger"));
const error_handler_1 = require("./utils/error-handler");
const client_1 = __importDefault(require("./prisma/client"));
const reminderScheduler_1 = require("./services/reminder-engine/scheduler/reminderScheduler");
const reminderWorker_1 = require("./services/reminder-engine/queue/reminderWorker");
const automationRules_1 = require("./services/reminder-engine/rules/automationRules");
const net_1 = __importDefault(require("net"));
async function canConnectTcp(host, port, timeoutMs = 800) {
    return await new Promise((resolve) => {
        const socket = new net_1.default.Socket();
        let done = false;
        const finish = (ok) => {
            if (done)
                return;
            done = true;
            try {
                socket.destroy();
            }
            catch { /* ignore */ }
            resolve(ok);
        };
        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
        socket.connect(port, host);
    });
}
function parseRedisHostPort(redisUrl) {
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
    (0, env_validation_1.validateEnv)();
}
catch (error) {
    console.error('⚠️ Environment validation warning: Some required variables are missing.');
    console.error(error);
    // We no longer process.exit(1) here to allow the app to bind to the port
}
const app = (0, express_1.default)();
// Request logger
app.use((req, res, next) => {
    console.log(req.method, req.url);
    next();
});
let env;
try {
    env = (0, env_validation_1.validateEnv)();
}
catch (e) { /* ignore */ }
const PORT = process.env.PORT || 5000;
// Trust proxy - Required for Railway, Vercel, and other cloud platforms
// This allows Express to correctly identify client IPs behind reverse proxies
// Trust only 1 proxy hop (standard for most cloud platforms)
// This is more secure than trusting all proxies
app.set('trust proxy', 1);
// Initialize Reminder Engine (scheduler, worker, automation rules)
if (process.env.NODE_ENV !== 'test') {
    try {
        (0, automationRules_1.registerAutomationRuleHandlers)();
        if (process.env.USE_REDIS_QUEUE !== 'true') {
            logger_1.default.warn('⚠️ Redis queue disabled — running in development mode (synchronous reminders)');
            (0, reminderScheduler_1.startReminderScheduler)();
        }
        else if (!process.env.REDIS_URL) {
            logger_1.default.warn('⚠️ Reminder Engine queue disabled: REDIS_URL is not set');
            logger_1.default.warn('   Reminders will be created, but delivery will not be queued/sent.');
            (0, reminderScheduler_1.startReminderScheduler)();
        }
        else {
            const redisUrl = process.env.REDIS_URL;
            const { host, port } = parseRedisHostPort(redisUrl);
            let started = false;
            const tryStart = async () => {
                if (started)
                    return;
                const ok = await canConnectTcp(host, port);
                if (!ok) {
                    logger_1.default.warn(`⚠️ Reminder Engine waiting for Redis at ${host}:${port}`);
                    return;
                }
                started = true;
                (0, reminderScheduler_1.startReminderScheduler)();
                (0, reminderWorker_1.startReminderWorker)();
                logger_1.default.info('✅ Reminder Engine initialized (queue enabled)');
            };
            // Try immediately, then keep retrying without spamming stack traces
            void tryStart();
            const interval = setInterval(() => {
                void tryStart().then(() => {
                    if (started)
                        clearInterval(interval);
                });
            }, 30000);
        }
    }
    catch (error) {
        logger_1.default.error('❌ Failed to initialize Reminder Engine', {
            error: error?.message || String(error),
        });
    }
}
// CORS configuration - MUST be before other middleware
const allowedOrigins = [
    'https://eyerrems-og.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'https://eyerremsog-production.up.railway.app/api'
];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-csrf-token', 'X-CSRF-Token', 'X-Device-Id', 'X-Session-Id'],
    credentials: true,
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
// Cookie parser - MUST be before CSRF middleware to read cookies
app.use((0, cookie_parser_1.default)());
// SECURITY: Helmet for security headers
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false
}));
// SECURITY: Rate limiting - More lenient in development
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const limiter = (0, express_rate_limit_1.default)({
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
app.use('/api/', api_logging_1.apiLoggingMiddleware);
// Stricter rate limiting for auth endpoints
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 10 * 60 * 1000, // 10 minutes
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
app.use(express_1.default.json({ limit: '50mb' })); // Limit JSON payload size (supports base64 images)
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// CSRF Protection for state-changing routes
// Note: Applied before routes to protect state-changing requests
app.use('/api', (req, res, next) => {
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
    logger_1.default.info('CSRF check for POST/PUT/DELETE', {
        method: req.method,
        path: path,
        url: req.url,
    });
    return (0, csrf_1.csrfProtection)(req, res, next);
});
// Serve secure files (authenticated endpoint)
app.use('/api/secure-files', secure_files_1.default);
// New centralized file handling routes
app.use('/api/files', files_1.default);
// Note: The /api/secure-files/:entityType/:entityId/:filename route is handled by secureFilesRoutes above
// This wildcard route is kept for backward compatibility but should not be used for new uploads
// All new files should use the structured route: /api/secure-files/:entityType/:entityId/:filename
// Legacy static file serving (deprecated - use secure-files endpoint)
// Keep for backward compatibility but files should be moved outside web root
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'public', 'uploads')));
// Routes
// Primary API auth routes (recommended)
app.use('/api/auth', auth_1.default);
// Backward-compatible alias so calls to /auth/* also work in production
// (useful if frontend is configured without the /api prefix)
app.use('/auth', auth_1.default);
app.use('/api/roles', roles_1.default);
app.use('/api/users', users_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/reminders', reminders_1.default);
app.use('/api/notification-logs', notification_logs_1.default);
// Backward/compatibility aliases for clients that accidentally double-prefix "/api"
// e.g. frontend baseURL="/api" calling "/api/reminders" -> "/api/api/reminders"
app.use('/api/api/notifications', notifications_1.default);
app.use('/api/api/reminders', reminders_1.default);
app.use('/api/api/notification-logs', notification_logs_1.default);
app.use('/api/properties', properties_1.default);
app.use('/api/locations', locations_1.default);
// Mount subsidiaries routes with logging
app.use('/api/subsidiaries', subsidiaries_1.default);
logger_1.default.info('✅ Subsidiaries routes mounted at /api/subsidiaries');
app.use('/api/units', units_1.default);
app.use('/api/tenants', tenants_1.default);
app.use('/api/leases', leases_1.default);
app.use('/api/sales', sales_1.default);
app.use('/api/buyers', buyers_1.default);
app.use('/api/blocks', blocks_1.default);
app.use('/api/floors', floors_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/hr/employees', employees_1.default);
app.use('/api/hr/attendance', attendance_1.default);
app.use('/api/hr/payroll', payroll_1.default);
app.use('/api/hr/leave', leave_1.default);
app.use('/api/transactions', transactions_1.default);
app.use('/api/crm', crm_1.default);
app.use('/api/finance', finance_1.default);
app.use('/api/finance-operations', finance_operations_1.default);
app.use('/api/finance-enhanced', finance_enhanced_1.default);
app.use('/api/finance-reports', finance_reports_1.default);
app.use('/api/financial-reports', financial_reports_1.default);
app.use('/api/fraud-detection', fraud_detection_1.default);
app.use('/api/accounts', accounts_1.default);
app.use('/api/entity-accounts', entity_accounts_1.default);
app.use('/api/properties-enhanced', properties_enhanced_1.default);
app.use('/api/crm-enhanced', crm_enhanced_1.default);
app.use('/api/crm-enhanced', crm_lead_import_1.default);
app.use('/api/advanced-options', advanced_options_1.default);
app.use('/api/backup', backup_1.default);
app.use('/api/tenant-portal', tenant_portal_1.default);
app.use('/api/bulk', bulk_1.default);
app.use('/api/bulk/excel', excel_bulk_1.default);
app.use('/api/recycle-bin', recycle_bin_1.default);
app.use('/api/construction', construction_1.default);
app.use('/api/ai-intelligence', ai_intelligence_1.default);
app.use('/api/ai-chat', ai_chat_1.default);
app.use('/api/permissions', permissions_1.default);
app.use('/api', export_jobs_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/currencies', currency_1.default);
app.use('/api/mail', mail_1.default);
// ─── Company Isolation Layer ─────────────────────────────────────────────────
app.use('/api/company-auth', company_auth_1.default);
app.use('/api/companies', companies_1.default);
// Health check with DB connection test
app.get('/api/health', async (req, res) => {
    try {
        // Check DB connection
        await client_1.default.$queryRaw `SELECT 1`;
        res.json({
            status: 'ok',
            message: 'REMS Backend is running',
            database: 'connected'
        });
    }
    catch (error) {
        logger_1.default.error('Health check failed - Database connection error:', error);
        // Don't crash, just report the error in the health check
        res.status(200).json({
            status: 'ok',
            message: 'REMS Backend is running (Database disconnected)',
            error: error.message
        });
    }
});
// 404 handler
app.use((req, res) => {
    logger_1.default.warn('404 - Route not found', {
        method: req.method,
        path: req.path,
        url: req.url,
        originalUrl: req.originalUrl || req.url,
    });
    res.status(404).json({ error: 'Route not found' });
});
// Error handling middleware
app.use((err, req, res, next) => {
    (0, error_handler_1.errorResponse)(res, err, err?.statusCode || 500);
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
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            logger_1.default.error(`❌ Port ${PORT} is already in use.`);
            logger_1.default.error(`   Please stop the process using port ${PORT} or change the PORT environment variable.`);
            logger_1.default.error(`   To find the process: netstat -ano | findstr :${PORT}`);
            logger_1.default.error(`   To kill it: taskkill /PID <PID> /F`);
            process.exit(1);
        }
        else {
            logger_1.default.error('❌ Server error:', error);
            process.exit(1);
        }
    });
}
// trigger restart
//# sourceMappingURL=index.js.map