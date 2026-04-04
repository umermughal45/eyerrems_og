"use strict";
/**
 * API Request/Response Logging Middleware
 * Logs all API requests and responses for audit and debugging
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLoggingMiddleware = apiLoggingMiddleware;
const logger_1 = __importDefault(require("../utils/logger"));
function apiLoggingMiddleware(req, res, next) {
    req.startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Log request
    logger_1.default.info('API Request', {
        requestId,
        method: req.method,
        path: req.path,
        query: req.query,
        body: sanitizeRequestBody(req.body),
        user: req.user?.id,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
    });
    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
        const duration = req.startTime ? Date.now() - req.startTime : 0;
        logger_1.default.info('API Response', {
            requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            user: req.user?.id,
        });
        return originalSend.call(this, body);
    };
    next();
}
/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }
    return sanitized;
}
//# sourceMappingURL=api-logging.js.map