/**
 * AI Intelligence API Routes
 * 
 * Provides read-only access to AI insights
 * Never modifies data, creates transactions, or changes accounting
 */

import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiIntelligenceService } from '../services/ai-intelligence';
import { successResponse, errorResponse } from '../utils/error-handler';
import logger from '../utils/logger';

const router = (express as any).Router();

/**
 * GET /api/ai-intelligence/overview
 * Get overview insights from all engines
 */
router.get('/overview', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const insights = await aiIntelligenceService.getOverviewInsights();
    return successResponse(res, { insights }, 200);
  } catch (error: any) {
    logger.error(`AI Intelligence overview error: ${error.message}`, error);
    return errorResponse(res, error.message || 'Failed to get AI insights', 500);
  }
});

/**
 * GET /api/ai-intelligence/engines
 * Get insights from all engines
 */
router.get('/engines', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const results = await aiIntelligenceService.getAllInsights();
    return successResponse(res, { engines: results }, 200);
  } catch (error: any) {
    logger.error(`AI Intelligence engines error: ${error.message}`, error);
    return errorResponse(res, error.message || 'Failed to get AI insights', 500);
  }
});

/**
 * GET /api/ai-intelligence/engines/:engineName
 * Get insights from a specific engine
 */
router.get('/engines/:engineName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { engineName } = req.params;
    const result = await aiIntelligenceService.getEngineInsights(engineName);
    return successResponse(res, result, 200);
  } catch (error: any) {
    logger.error(`AI Intelligence engine error: ${error.message}`, error);
    return errorResponse(res, error.message || 'Failed to get engine insights', 500);
  }
});

/**
 * POST /api/ai-intelligence/assistant/query
 * Process AI Assistant query (retrieval-only)
 */
router.post('/assistant/query', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { query } = req.body;
    
    if (!query || typeof query !== 'string') {
      return errorResponse(res, 'Query is required and must be a string', 400);
    }
    
    const result = await aiIntelligenceService.processAssistantQuery(query);
    return successResponse(res, result, 200);
  } catch (error: any) {
    logger.error(`AI Assistant query error: ${error.message}`, error);
    return errorResponse(res, error.message || 'Failed to process query', 500);
  }
});

/**
 * POST /api/ai-intelligence/cache/invalidate/:engineName
 * Invalidate cache for a specific engine (admin only)
 */
router.post('/cache/invalidate/:engineName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { engineName } = req.params;
    aiIntelligenceService.invalidateEngineCache(engineName);
    return successResponse(res, { message: `Cache invalidated for ${engineName}` }, 200);
  } catch (error: any) {
    logger.error(`AI Intelligence cache invalidation error: ${error.message}`, error);
    return errorResponse(res, error.message || 'Failed to invalidate cache', 500);
  }
});

/**
 * POST /api/ai-intelligence/cache/clear
 * Clear all AI Intelligence caches (admin only)
 */
router.post('/cache/clear', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    aiIntelligenceService.invalidateAllCaches();
    return successResponse(res, { message: 'All caches cleared' }, 200);
  } catch (error: any) {
    logger.error(`AI Intelligence cache clear error: ${error.message}`, error);
    return errorResponse(res, error.message || 'Failed to clear cache', 500);
  }
});

export default router;
