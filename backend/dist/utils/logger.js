"use strict";
/**
 * Logger Utility
 * Centralized logging using Winston
 * Replaces all console.log/error/warn statements
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logDir = path_1.default.join(process.cwd(), 'logs');
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
winston_1.default.addColors(colors);
// Define log format
const format = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Define transports
const transports = [
    // Console transport
    new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)),
    }),
    // File transport for errors
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'error.log'),
        level: 'error',
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    }),
    // File transport for all logs
    new winston_1.default.transports.File({
        filename: path_1.default.join(logDir, 'combined.log'),
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    }),
];
// Create logger instance
const logger = winston_1.default.createLogger({
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
exports.stream = {
    /**
     * Write log message to Winston logger
     * @param message - HTTP log message from Morgan
     */
    write: (message) => {
        logger.http(message.trim());
    },
};
exports.default = logger;
//# sourceMappingURL=logger.js.map