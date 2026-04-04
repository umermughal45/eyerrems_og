/**
 * API Request/Response Logging Middleware
 * Logs all API requests and responses for audit and debugging
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface LoggedRequest extends Request {
  startTime?: number;
  user?: {
    id: string;
    username?: string;
    role?: string;
  };
}

export function apiLoggingMiddleware(req: LoggedRequest, res: Response, next: NextFunction) {
  req.startTime = Date.now();
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Log request
  logger.info('API Request', {
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
  res.send = function (body: any) {
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    logger.info('API Response', {
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
function sanitizeRequestBody(body: any): any {
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

