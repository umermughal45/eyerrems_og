/**
 * Logger Utility
 * Centralized logging using Winston
 * Replaces all console.log/error/warn statements
 */
import winston from 'winston';
declare const logger: winston.Logger;
/**
 * Stream interface for Morgan HTTP logging middleware
 * @example
 * ```typescript
 * import morgan from 'morgan';
 * import { stream } from './utils/logger';
 * app.use(morgan('combined', { stream }));
 * ```
 */
export declare const stream: {
    /**
     * Write log message to Winston logger
     * @param message - HTTP log message from Morgan
     */
    write: (message: string) => void;
};
export default logger;
//# sourceMappingURL=logger.d.ts.map