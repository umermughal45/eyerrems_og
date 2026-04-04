/**
 * Logger Utility
 * Centralized logging using Winston
 * Replaces all console.log/error/warn statements
 */

import winston from 'winston';
import path from 'path';

const logDir = path.join(process.cwd(), 'logs');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`,
      ),
    ),
  }),
  // File transport for errors
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

/**
 * Stream interface for Morgan HTTP logging middleware
 * @example
 * ```typescript
 * import morgan from 'morgan';
 * import { stream } from './utils/logger';
 * app.use(morgan('combined', { stream }));
 * ```
 */
export const stream = {
  /**
   * Write log message to Winston logger
   * @param message - HTTP log message from Morgan
   */
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export default logger;

