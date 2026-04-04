/**
 * AI Chat API Routes
 * 
 * Provides REST API endpoints for AI chat functionality using Ollama.
 * 
 * Endpoints:
 * - POST /api/ai-chat - Send a message and get AI response
 * - GET /api/ai-chat/status - Check AI service availability
 */

import express, { Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ollamaChatService, ChatMessage } from '../services/ollama-chat-service';
import { successResponse, errorResponse } from '../utils/error-handler';
import logger from '../utils/logger';

const router = (express as any).Router();

/**
 * POST /api/ai-chat
 * Send a message to the AI assistant
 * 
 * Request body:
 * - message: string (required) - The user's message
 * - history: ChatMessage[] (optional) - Previous conversation messages
 * 
 * Response:
 * - success: boolean
 * - data: { response: string, model?: string, duration?: number }
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { message, history = [] } = req.body;
    
    // Validate message
    if (!message || typeof message !== 'string') {
      return errorResponse(res, 'Message is required and must be a string', 400);
    }
    
    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return errorResponse(res, 'Message cannot be empty', 400);
    }
    
    // Validate history format if provided
    if (history && !Array.isArray(history)) {
      return errorResponse(res, 'History must be an array', 400);
    }
    
    // Validate each history message
    const validHistory: ChatMessage[] = [];
    for (const msg of history) {
      if (
        msg &&
        typeof msg === 'object' &&
        typeof msg.content === 'string' &&
        (msg.role === 'user' || msg.role === 'assistant')
      ) {
        validHistory.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }
    
    logger.info(`AI Chat: Processing request from user ${req.user?.id || 'unknown'}`);
    
    // Send to Ollama service
    const result = await ollamaChatService.chat(trimmedMessage, validHistory);
    
    if (result.success) {
      return successResponse(res, {
        response: result.message,
        model: result.model,
        duration: result.duration,
      }, 200);
    }
    
    // Handle service errors
    return errorResponse(res, result.error || 'Failed to get AI response', 503);
    
  } catch (error: any) {
    logger.error(`AI Chat Error: ${error.message}`, error);
    return errorResponse(res, 'An error occurred while processing your request', 500);
  }
});

/**
 * GET /api/ai-chat/status
 * Check AI service availability
 * 
 * Response:
 * - available: boolean - Whether Ollama is running
 * - model: string - Configured model name
 * - modelAvailable: boolean - Whether the model is installed
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const status = await ollamaChatService.getStatus();
    return successResponse(res, status, 200);
  } catch (error: any) {
    logger.error(`AI Chat Status Error: ${error.message}`, error);
    return errorResponse(res, 'Failed to check AI service status', 500);
  }
});

export default router;
