"use strict";
/**
 * AI Intelligence Event System
 *
 * Event-driven recalculation:
 * - AI recalculation must be event-driven
 * - Never on page load
 * - Triggered by data changes
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiEvents = void 0;
exports.emitAIEvent = emitAIEvent;
const events_1 = require("events");
const logger_1 = __importDefault(require("../../utils/logger"));
const cache_1 = require("./cache");
class AIEventEmitter extends events_1.EventEmitter {
    /**
     * Emit an event and trigger cache invalidation
     */
    emit(event, ...args) {
        logger_1.default.debug(`AI Event: ${event}`);
        // Invalidate relevant cache entries
        this.invalidateCacheForEvent(event);
        return super.emit(event, ...args);
    }
    /**
     * Invalidate cache based on event type
     */
    invalidateCacheForEvent(event) {
        if (event.startsWith('finance.')) {
            cache_1.aiCache.invalidatePattern('^financial-intelligence:');
            cache_1.aiCache.invalidatePattern('^transaction-risk:');
        }
        if (event.startsWith('property.')) {
            cache_1.aiCache.invalidatePattern('^asset-intelligence:');
        }
        if (event.startsWith('construction.')) {
            cache_1.aiCache.invalidatePattern('^construction-intelligence:');
        }
        if (event.startsWith('hr.')) {
            cache_1.aiCache.invalidatePattern('^workforce-intelligence:');
        }
        if (event.startsWith('crm.')) {
            cache_1.aiCache.invalidatePattern('^crm-revenue-intelligence:');
        }
        if (event.startsWith('tenant.')) {
            cache_1.aiCache.invalidatePattern('^tenant-intelligence:');
        }
        // Operational anomalies depend on all modules
        cache_1.aiCache.invalidatePattern('^operational-anomaly:');
    }
}
exports.aiEvents = new AIEventEmitter();
/**
 * Helper to emit AI events from other services
 */
function emitAIEvent(event, data) {
    exports.aiEvents.emit(event, data);
}
//# sourceMappingURL=events.js.map