"use strict";
/**
 * AI Chat API Routes
 *
 * Provides REST API endpoints for AI chat functionality using Ollama.
 *
 * Endpoints:
 * - POST /api/ai-chat - Send a message and get AI response
 * - GET /api/ai-chat/status - Check AI service availability
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const ollama_chat_service_1 = require("../services/ollama-chat-service");
const error_handler_1 = require("../utils/error-handler");
const logger_1 = __importDefault(require("../utils/logger"));
const router = express_1.default.Router();
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
router.post('/', auth_1.authenticate, async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        // Validate message
        if (!message || typeof message !== 'string') {
            return (0, error_handler_1.errorResponse)(res, 'Message is required and must be a string', 400);
        }
        const trimmedMessage = message.trim();
        if (trimmedMessage.length === 0) {
            return (0, error_handler_1.errorResponse)(res, 'Message cannot be empty', 400);
        }
        // Validate history format if provided
        if (history && !Array.isArray(history)) {
            return (0, error_handler_1.errorResponse)(res, 'History must be an array', 400);
        }
        // Validate each history message
        const validHistory = [];
        for (const msg of history) {
            if (msg &&
                typeof msg === 'object' &&
                typeof msg.content === 'string' &&
                (msg.role === 'user' || msg.role === 'assistant')) {
                validHistory.push({
                    role: msg.role,
                    content: msg.content,
                });
            }
        }
        logger_1.default.info(`AI Chat: Processing request from user ${req.user?.id || 'unknown'}`);
        // Send to Ollama service
        const result = await ollama_chat_service_1.ollamaChatService.chat(trimmedMessage, validHistory);
        if (result.success) {
            return (0, error_handler_1.successResponse)(res, {
                response: result.message,
                model: result.model,
                duration: result.duration,
            }, 200);
        }
        // Handle service errors
        return (0, error_handler_1.errorResponse)(res, result.error || 'Failed to get AI response', 503);
    }
    catch (error) {
        logger_1.default.error(`AI Chat Error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, 'An error occurred while processing your request', 500);
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
router.get('/status', auth_1.authenticate, async (req, res) => {
    try {
        const status = await ollama_chat_service_1.ollamaChatService.getStatus();
        return (0, error_handler_1.successResponse)(res, status, 200);
    }
    catch (error) {
        logger_1.default.error(`AI Chat Status Error: ${error.message}`, error);
        return (0, error_handler_1.errorResponse)(res, 'Failed to check AI service status', 500);
    }
});
exports.default = router;
//# sourceMappingURL=ai-chat.js.map