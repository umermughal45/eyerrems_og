"use strict";
/**
 * AI Intelligence API Routes
 *
 * Provides read-only access to AI insights
 * Never modifies data, creates transactions, or changes accounting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const ai_intelligence_1 = require("../services/ai-intelligence");
const error_handler_1 = require("../utils/error-handler");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
/**
 * GET /api/ai-intelligence/overview
 * Get overview insights from all engines
 */
router.get('/overview', auth_1.authenticate, async (req, res) => {
    try {
        const insights = await ai_intelligence_1.aiIntelligenceService.getOverviewInsights();
        return (0, error_handler_1.successResponse)(res, { insights }, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Intelligence overview error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, error.message || 'Failed to get AI insights', 500);
    }
});
/**
 * GET /api/ai-intelligence/engines
 * Get insights from all engines
 */
router.get('/engines', auth_1.authenticate, async (req, res) => {
    try {
        const results = await ai_intelligence_1.aiIntelligenceService.getAllInsights();
        return (0, error_handler_1.successResponse)(res, { engines: results }, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Intelligence engines error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, error.message || 'Failed to get AI insights', 500);
    }
});
/**
 * GET /api/ai-intelligence/engines/:engineName
 * Get insights from a specific engine
 */
router.get('/engines/:engineName', auth_1.authenticate, async (req, res) => {
    try {
        const { engineName } = req.params;
        const result = await ai_intelligence_1.aiIntelligenceService.getEngineInsights(engineName);
        return (0, error_handler_1.successResponse)(res, result, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Intelligence engine error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, error.message || 'Failed to get engine insights', 500);
    }
});
/**
 * POST /api/ai-intelligence/assistant/query
 * Process AI Assistant query (retrieval-only)
 */
router.post('/assistant/query', auth_1.authenticate, async (req, res) => {
    try {
        const { query } = req.body;
        if (!query || typeof query !== 'string') {
            return (0, error_handler_1.errorResponse)(res, 'Query is required and must be a string', 400);
        }
        const result = await ai_intelligence_1.aiIntelligenceService.processAssistantQuery(query);
        return (0, error_handler_1.successResponse)(res, result, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Assistant query error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, error.message || 'Failed to process query', 500);
    }
});
/**
 * POST /api/ai-intelligence/cache/invalidate/:engineName
 * Invalidate cache for a specific engine (admin only)
 */
router.post('/cache/invalidate/:engineName', auth_1.authenticate, async (req, res) => {
    try {
        const { engineName } = req.params;
        ai_intelligence_1.aiIntelligenceService.invalidateEngineCache(engineName);
        return (0, error_handler_1.successResponse)(res, { message: `Cache invalidated for ${engineName}` }, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Intelligence cache invalidation error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, error.message || 'Failed to invalidate cache', 500);
    }
});
/**
 * POST /api/ai-intelligence/cache/clear
 * Clear all AI Intelligence caches (admin only)
 */
router.post('/cache/clear', auth_1.authenticate, async (req, res) => {
    try {
        ai_intelligence_1.aiIntelligenceService.invalidateAllCaches();
        return (0, error_handler_1.successResponse)(res, { message: 'All caches cleared' }, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Intelligence cache clear error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, error.message || 'Failed to clear cache', 500);
    }
});
exports.default = router;
//# sourceMappingURL=ai-intelligence.js.map