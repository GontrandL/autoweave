const express = require('express');
const { Logger } = require('@autoweave/shared');
const { Validator } = require('@autoweave/shared');

const router = express.Router();
const logger = new Logger('ChatRoutes');

// Chat service will be set by AutoWeave core
let chatService = null;

// Middleware to check if chat service is initialized
const checkChatService = (req, res, next) => {
    if (!chatService) {
        return res.status(503).json({
            error: 'Chat service not initialized',
            message: 'Please initialize the chat service before using these endpoints'
        });
    }
    next();
};

// Set chat service (called by AutoWeave core)
router.setChatService = (service) => {
    chatService = service;
    logger.info('Chat service set for routes');
};

/**
 * @route POST /api/chat
 * @desc OpenAI-compatible chat completions endpoint for SillyTavern
 */
router.post('/', checkChatService, async (req, res) => {
    try {
        const { 
            messages, 
            model = 'autoweave-agent', 
            max_tokens = 1000, 
            temperature = 0.7,
            stream = false,
            user = 'anonymous'
        } = req.body;
        
        // Validation
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: {
                    message: 'Messages array is required',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'messages_required'
                }
            });
        }
        
        if (messages.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Messages array cannot be empty',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'messages_empty'
                }
            });
        }
        
        // Extract the last user message
        const userMessage = messages.filter(msg => msg.role === 'user').pop();
        if (!userMessage) {
            return res.status(400).json({
                error: {
                    message: 'No user message found in messages array',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'no_user_message'
                }
            });
        }
        
        logger.info(`Chat request from ${user}: "${userMessage.content}"`);
        
        // Process with streaming support
        if (stream) {
            return handleStreamingChat(req, res, {
                message: userMessage.content,
                model,
                max_tokens,
                temperature,
                conversationContext: messages,
                user
            });
        }
        
        // Process the message
        const response = await chatService.processChatMessage(userMessage.content, {
            model,
            max_tokens,
            temperature,
            conversationContext: messages,
            user
        });
        
        // Return OpenAI-compatible response
        const chatResponse = {
            id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: response.content
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: response.promptTokens || 0,
                completion_tokens: response.completionTokens || 0,
                total_tokens: response.totalTokens || 0
            }
        };
        
        res.json(chatResponse);
        
    } catch (error) {
        logger.error('Chat processing error:', error);
        
        // OpenAI-compatible error response
        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'autoweave_error',
                code: 'processing_failed'
            }
        });
    }
});

/**
 * Handle streaming chat responses
 */
async function handleStreamingChat(req, res, options) {
    try {
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        const { message, model, max_tokens, temperature, conversationContext, user } = options;
        
        // Start streaming response
        const streamId = `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Send initial chunk
        const initialChunk = {
            id: streamId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                delta: { role: 'assistant' },
                finish_reason: null
            }]
        };
        
        res.write(`data: ${JSON.stringify(initialChunk)}\n\n`);
        
        // Process message with streaming
        const response = await chatService.processChatMessage(message, {
            model,
            max_tokens,
            temperature,
            conversationContext,
            user,
            stream: true,
            onChunk: (chunk) => {
                const chunkData = {
                    id: streamId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{
                        index: 0,
                        delta: { content: chunk },
                        finish_reason: null
                    }]
                };
                res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
            }
        });
        
        // Send final chunk
        const finalChunk = {
            id: streamId,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                delta: {},
                finish_reason: 'stop'
            }]
        };
        
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        
    } catch (error) {
        logger.error('Streaming chat error:', error);
        
        const errorChunk = {
            error: {
                message: error.message || 'Streaming error',
                type: 'autoweave_error',
                code: 'streaming_failed'
            }
        };
        
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
    }
}

/**
 * @route POST /api/chat/completions
 * @desc OpenAI-compatible chat completions endpoint
 */
router.post('/completions', checkChatService, async (req, res) => {
    try {
        const { 
            messages, 
            model = 'gpt-3.5-turbo', 
            max_tokens = 1000, 
            temperature = 0.7,
            stream = false,
            user = 'anonymous'
        } = req.body;
        
        // Validation
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: {
                    message: 'Messages array is required',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'messages_required'
                }
            });
        }
        
        if (messages.length === 0) {
            return res.status(400).json({
                error: {
                    message: 'Messages array cannot be empty',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'messages_empty'
                }
            });
        }
        
        // Extract the last user message
        const userMessage = messages.filter(msg => msg.role === 'user').pop();
        if (!userMessage) {
            return res.status(400).json({
                error: {
                    message: 'No user message found in messages array',
                    type: 'invalid_request_error',
                    param: 'messages',
                    code: 'no_user_message'
                }
            });
        }
        
        logger.info(`Chat completions request from ${user}: "${userMessage.content}"`);
        
        // Process with streaming support
        if (stream) {
            return handleStreamingChat(req, res, {
                message: userMessage.content,
                model,
                max_tokens,
                temperature,
                conversationContext: messages,
                user
            });
        }
        
        // Process the message
        const response = await chatService.processChatMessage(userMessage.content, {
            model,
            max_tokens,
            temperature,
            conversationContext: messages,
            user
        });
        
        // Return OpenAI-compatible response
        const chatResponse = {
            id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: response.content
                },
                finish_reason: 'stop'
            }],
            usage: {
                prompt_tokens: response.promptTokens || 0,
                completion_tokens: response.completionTokens || 0,
                total_tokens: response.totalTokens || 0
            }
        };
        
        res.json(chatResponse);
        
    } catch (error) {
        logger.error('Chat completions processing error:', error);
        
        // OpenAI-compatible error response
        res.status(500).json({
            error: {
                message: error.message || 'Internal server error',
                type: 'autoweave_error',
                code: 'processing_failed'
            }
        });
    }
});

/**
 * @route GET /api/chat/models
 * @desc List available models (OpenAI-compatible)
 */
router.get('/models', (req, res) => {
    const models = [
        {
            id: 'autoweave-agent',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'autoweave',
            permission: [],
            root: 'autoweave-agent',
            parent: null
        },
        {
            id: 'autoweave-memory',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'autoweave',
            permission: [],
            root: 'autoweave-memory',
            parent: null
        }
    ];
    
    res.json({
        object: 'list',
        data: models
    });
});

/**
 * @route POST /api/chat/memory
 * @desc Add message to conversation memory
 */
router.post('/memory', checkChatService, async (req, res) => {
    try {
        const { message, userId = 'anonymous', metadata = {} } = req.body;
        
        if (!message) {
            return res.status(400).json({
                error: 'Message is required',
                field: 'message'
            });
        }
        
        const result = await chatService.addToMemory(message, userId, metadata);
        
        res.json({
            success: true,
            message: 'Added to memory successfully',
            memoryId: result.id
        });
        
    } catch (error) {
        logger.error('Failed to add to memory:', error);
        res.status(500).json({
            error: 'Failed to add to memory',
            message: error.message
        });
    }
});

/**
 * @route GET /api/chat/memory/:userId
 * @desc Get conversation memory for user
 */
router.get('/memory/:userId', checkChatService, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10 } = req.query;
        
        const memory = await chatService.getMemory(userId, { limit: parseInt(limit) });
        
        res.json({
            success: true,
            userId,
            memory
        });
        
    } catch (error) {
        logger.error(`Failed to get memory for ${req.params.userId}:`, error);
        res.status(500).json({
            error: 'Failed to get memory',
            message: error.message
        });
    }
});

/**
 * @route DELETE /api/chat/memory/:userId
 * @desc Clear conversation memory for user
 */
router.delete('/memory/:userId', checkChatService, async (req, res) => {
    try {
        const { userId } = req.params;
        await chatService.clearMemory(userId);
        
        res.json({
            success: true,
            message: 'Memory cleared successfully',
            userId
        });
        
    } catch (error) {
        logger.error(`Failed to clear memory for ${req.params.userId}:`, error);
        res.status(500).json({
            error: 'Failed to clear memory',
            message: error.message
        });
    }
});

/**
 * @route GET /api/chat/health
 * @desc Health check for chat service
 */
router.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        chatService: chatService ? 'available' : 'unavailable',
        endpoints: {
            chat: '/api/chat',
            models: '/api/chat/models',
            memory: '/api/chat/memory',
            health: '/api/chat/health'
        }
    };
    
    res.json(health);
});

module.exports = router;