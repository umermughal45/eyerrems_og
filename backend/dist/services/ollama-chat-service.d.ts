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
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ChatResponse {
    success: boolean;
    message: string;
    error?: string;
    model?: string;
    duration?: number;
}
/**
 * Ollama Chat Service Class
 */
declare class OllamaChatService {
    private baseUrl;
    private model;
    constructor();
    /**
     * Check if Ollama service is available
     */
    isAvailable(): Promise<boolean>;
    /**
     * Check if the configured model is available
     */
    isModelAvailable(): Promise<boolean>;
    /**
     * Send a chat message to Ollama
     */
    chat(userMessage: string, conversationHistory?: ChatMessage[]): Promise<ChatResponse>;
    /**
     * Build the full prompt with system context and conversation history
     */
    private buildPrompt;
    /**
     * Clean and sanitize the AI response
     */
    private cleanResponse;
    /**
     * Get service status
     */
    getStatus(): Promise<{
        available: boolean;
        model: string;
        modelAvailable: boolean;
        url: string;
    }>;
}
export declare const ollamaChatService: OllamaChatService;
export {};
//# sourceMappingURL=ollama-chat-service.d.ts.map