"use strict";
/**
 * AI Decision Logger
 *
 * Production-grade audit logging for all AI outputs and refusals.
 * Every AI decision must be logged for:
 * - Full reproduction of past insights
 * - Regulatory and financial audits
 * - Debugging incorrect behavior
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiDecisionLogger = void 0;
exports.createDecisionLog = createDecisionLog;
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * In-memory audit log (production should use persistent storage)
 */
class AIDecisionLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 10000; // Keep last 10k decisions
    }
    /**
     * Log an AI decision
     */
    logDecision(log) {
        const fullLog = {
            ...log,
            id: `ai-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
        };
        this.logs.push(fullLog);
        // Keep only last maxLogs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        // Also log to Winston for production monitoring
        logger_1.default.info('AI Decision Logged', {
            engine: fullLog.engine,
            decisionType: fullLog.decision.type,
            confidence: fullLog.confidenceDetails.finalConfidence,
            status: fullLog.decision.insight?.status || 'refused',
            reason: fullLog.reason,
        });
    }
    /**
     * Get logs for a specific engine
     */
    getLogsForEngine(engine, limit = 100) {
        return this.logs
            .filter((log) => log.engine === engine)
            .slice(-limit)
            .reverse();
    }
    /**
     * Get logs for a time range
     */
    getLogsForTimeRange(start, end) {
        return this.logs.filter((log) => log.timestamp >= start && log.timestamp <= end);
    }
    /**
     * Get all logs (for audit purposes)
     */
    getAllLogs() {
        return [...this.logs];
    }
    /**
     * Clear logs (use with caution)
     */
    clearLogs() {
        this.logs = [];
    }
}
exports.aiDecisionLogger = new AIDecisionLogger();
/**
 * Helper to create a decision log entry
 */
function createDecisionLog(engine, decision, dataSnapshot, contractResult, confidenceDetails, reason, scope = {}) {
    exports.aiDecisionLogger.logDecision({
        engine,
        scope,
        decision,
        dataSnapshot,
        contractResult,
        version: {
            engineVersion: '1.0.0', // Should be read from package.json in production
        },
        confidenceDetails,
        reason,
    });
}
//# sourceMappingURL=decision-logger.js.map