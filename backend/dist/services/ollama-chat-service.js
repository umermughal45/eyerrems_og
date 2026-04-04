"use strict";
/**
 * Ollama Chat Service
 *
 * Connects to local Ollama instance for AI chat functionality.
 * Uses Phi-3 Mini model for informational responses only.
 *
 * Configuration:
 * - Ollama URL: http://localhost:11434
 * - Model: phi3
 *
 * Rules:
 * - Informational assistant only
 * - No hallucination of features
 * - No emojis, jokes, or opinions
 * - Returns "information not available" for unknown queries
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ollamaChatService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'phi3';
const OLLAMA_TIMEOUT = 120000; // 2 minutes for LLM responses
// System prompt for informational assistant
const SYSTEM_PROMPT = `You are an informational assistant for a Real Estate ERP software system. Your role is to help users understand and navigate the software features.

STRICT RULES:
1. You ONLY provide information about this software system
2. You answer concisely and clearly in plain text
3. You do NOT hallucinate features - only describe what exists
4. If information is not available or you are unsure, respond with: "This information is not available in the system."
5. No emojis, no jokes, no opinions, no creative responses
6. Keep responses factual and professional
7. Do not ask follow-up questions unless clarification is essential

SOFTWARE MODULES AVAILABLE:
- Dashboard: Overview of key metrics and quick actions
- Properties: Property management, listings, valuations
- Tenants: Tenant management, lease tracking, communications
- Finance: Transactions, vouchers, accounts, ledgers, financial reports
- CRM: Leads, clients, deals, sales pipeline management
- HR: Employee management, attendance, payroll, leave management
- Construction: Project tracking, materials, contractors, progress monitoring
- Support: Ticket system for tenant and internal support
- AI Intelligence: Analytics, insights, and predictions

When users ask about features, explain them briefly without speculation. If unsure about a feature, state that the information is not available.`;
/**
 * Ollama Chat Service Class
 */
class OllamaChatService {
    constructor() {
        this.baseUrl = OLLAMA_BASE_URL;
        this.model = OLLAMA_MODEL;
    }
    /**
     * Check if Ollama service is available
     */
    async isAvailable() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000,
            });
            return response.status === 200;
        }
        catch (error) {
            logger_1.default.warn('Ollama service not available');
            return false;
        }
    }
    /**
     * Check if the configured model is available
     */
    async isModelAvailable() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/api/tags`, {
                timeout: 5000,
            });
            if (response.data?.models) {
                const models = response.data.models;
                return models.some(m => m.name.includes(this.model));
            }
            return false;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Send a chat message to Ollama
     */
    async chat(userMessage, conversationHistory = []) {
        try {
            // Validate input
            if (!userMessage || typeof userMessage !== 'string') {
                return {
                    success: false,
                    message: '',
                    error: 'Invalid message provided',
                };
            }
            // Trim and validate message length
            const trimmedMessage = userMessage.trim();
            if (trimmedMessage.length === 0) {
                return {
                    success: false,
                    message: '',
                    error: 'Message cannot be empty',
                };
            }
            if (trimmedMessage.length > 4000) {
                return {
                    success: false,
                    message: '',
                    error: 'Message too long. Please keep messages under 4000 characters.',
                };
            }
            // Build the full prompt with system context and history
            const fullPrompt = this.buildPrompt(trimmedMessage, conversationHistory);
            logger_1.default.info(`Ollama Chat: Processing message (${trimmedMessage.length} chars)`);
            // Call Ollama API
            const response = await axios_1.default.post(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: fullPrompt,
                stream: false,
                options: {
                    temperature: 0.3, // Lower temperature for more factual responses
                    top_p: 0.9,
                    num_predict: 500, // Limit response length
                },
            }, {
                timeout: OLLAMA_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.data?.response) {
                const cleanResponse = this.cleanResponse(response.data.response);
                logger_1.default.info(`Ollama Chat: Response generated successfully`);
                return {
                    success: true,
                    message: cleanResponse,
                    model: response.data.model,
                    duration: response.data.total_duration
                        ? Math.round(response.data.total_duration / 1000000) // Convert nanoseconds to milliseconds
                        : undefined,
                };
            }
            return {
                success: false,
                message: '',
                error: 'No response received from AI model',
            };
        }
        catch (error) {
            const axiosError = error;
            // Handle specific error cases
            if (axiosError.code === 'ECONNREFUSED') {
                logger_1.default.error('Ollama Chat: Connection refused - Ollama may not be running');
                return {
                    success: false,
                    message: '',
                    error: 'AI service is not available. Please ensure Ollama is running.',
                };
            }
            if (axiosError.code === 'ETIMEDOUT' || axiosError.code === 'ECONNABORTED') {
                logger_1.default.error('Ollama Chat: Request timed out');
                return {
                    success: false,
                    message: '',
                    error: 'AI response timed out. Please try again with a shorter question.',
                };
            }
            if (axiosError.response?.status === 404) {
                logger_1.default.error(`Ollama Chat: Model ${this.model} not found`);
                return {
                    success: false,
                    message: '',
                    error: `AI model "${this.model}" is not installed. Please run: ollama pull ${this.model}`,
                };
            }
            logger_1.default.error(`Ollama Chat Error: ${axiosError.message}`, axiosError);
            return {
                success: false,
                message: '',
                error: 'An error occurred while processing your request.',
            };
        }
    }
    /**
     * Build the full prompt with system context and conversation history
     */
    buildPrompt(userMessage, history) {
        let prompt = `${SYSTEM_PROMPT}\n\n`;
        // Add conversation history (limited to last 5 exchanges for context)
        const recentHistory = history.slice(-10); // Last 5 user+assistant pairs
        if (recentHistory.length > 0) {
            prompt += 'Previous conversation:\n';
            for (const msg of recentHistory) {
                if (msg.role === 'user') {
                    prompt += `User: ${msg.content}\n`;
                }
                else if (msg.role === 'assistant') {
                    prompt += `Assistant: ${msg.content}\n`;
                }
            }
            prompt += '\n';
        }
        prompt += `User: ${userMessage}\nAssistant:`;
        return prompt;
    }
    /**
     * Clean and sanitize the AI response
     */
    cleanResponse(response) {
        let cleaned = response.trim();
        // Remove any potential prompt leakage
        if (cleaned.toLowerCase().startsWith('assistant:')) {
            cleaned = cleaned.substring(10).trim();
        }
        // Remove emojis (as per requirements)
        cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
        cleaned = cleaned.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols and Pictographs
        cleaned = cleaned.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and Map
        cleaned = cleaned.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Flags
        cleaned = cleaned.replace(/[\u{2600}-\u{26FF}]/gu, ''); // Misc symbols
        cleaned = cleaned.replace(/[\u{2700}-\u{27BF}]/gu, ''); // Dingbats
        // Clean up extra whitespace
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        // If response is empty after cleaning, provide fallback
        if (!cleaned) {
            cleaned = 'This information is not available in the system.';
        }
        return cleaned;
    }
    /**
     * Get service status
     */
    async getStatus() {
        const available = await this.isAvailable();
        const modelAvailable = available ? await this.isModelAvailable() : false;
        return {
            available,
            model: this.model,
            modelAvailable,
            url: this.baseUrl,
        };
    }
}
// Export singleton instance
exports.ollamaChatService = new OllamaChatService();
//# sourceMappingURL=ollama-chat-service.js.map