const express = require('express');
const { Logger } = require('../utils/logger');

const router = express.Router();
const logger = new Logger('Routes');

// Import route modules
const memoryRoutes = require('./memory');
const agentRoutes = require('./agents');
const chatRoutes = require('./chat');
const healthRoutes = require('./health');
const kagentRoutes = require('./kagent');
const configRoutes = require('./config');
const selfAwarenessRoutes = require('./self-awareness');
const searchRoutes = require('./search');
const codingMemoryRoutes = require('./coding-memory');

/**
 * Routes Index - Central routing configuration for AutoWeave API
 * Provides organized route mounting and service injection
 */
class RoutesIndex {
    constructor() {
        this.routes = {
            memory: memoryRoutes,
            agents: agentRoutes,
            chat: chatRoutes,
            health: healthRoutes,
            kagent: kagentRoutes,
            config: configRoutes,
            selfAwareness: selfAwarenessRoutes,
            search: searchRoutes,
            codingMemory: codingMemoryRoutes
        };
        
        this.services = {
            memoryManager: null,
            agentService: null,
            integrationAgentModule: null,
            chatService: null,
            healthService: null,
            kagentService: null,
            configIntelligence: null,
            freshSources: null,
            debuggingAgent: null
        };
    }
    
    /**
     * Configure all routes with services
     */
    configure(app, services = {}) {
        logger.info('Configuring AutoWeave API routes...');
        
        // Store services
        this.services = { ...this.services, ...services };
        
        // Inject services into routes
        this.injectServices();
        
        // Mount routes
        this.mountRoutes(app);
        
        // Add root endpoints
        this.addRootEndpoints(app);
        
        logger.success('API routes configured successfully');
    }
    
    /**
     * Inject services into route modules
     */
    injectServices() {
        if (this.services.memoryManager && this.routes.memory.setMemoryManager) {
            this.routes.memory.setMemoryManager(this.services.memoryManager);
        }
        
        if (this.services.agentService && this.routes.agents.setAgentService) {
            this.routes.agents.setAgentService(this.services.agentService);
        }
        
        if (this.services.integrationAgentModule && this.routes.agents.setIntegrationAgentModule) {
            this.routes.agents.setIntegrationAgentModule(this.services.integrationAgentModule);
        }
        
        if (this.services.chatService && this.routes.chat.setChatService) {
            this.routes.chat.setChatService(this.services.chatService);
        }
        
        if (this.services.healthService && this.routes.health.setHealthService) {
            this.routes.health.setHealthService(this.services.healthService);
        }
        
        if (this.services.kagentService && this.routes.kagent.setKagentService) {
            this.routes.kagent.setKagentService(this.services.kagentService);
        }
        
        if (this.routes.config.setServices) {
            this.routes.config.setServices({
                configIntelligence: this.services.configIntelligence,
                freshSources: this.services.freshSources,
                debuggingAgent: this.services.debuggingAgent
            });
        }
        
        logger.debug('Services injected into routes');
    }
    
    /**
     * Mount all routes to the app
     */
    mountRoutes(app) {
        // API routes with versioning
        app.use('/api/v1/memory', this.routes.memory);
        app.use('/api/v1/agents', this.routes.agents);
        app.use('/api/v1/chat', this.routes.chat);
        app.use('/api/v1/health', this.routes.health);
        app.use('/api/v1/kagent', this.routes.kagent);
        app.use('/api/v1/config', this.routes.config.router);
        app.use('/api/v1/self-awareness', this.routes.selfAwareness);
        app.use('/api/v1/search', this.routes.search);
        app.use('/api/v1/memory/code', this.routes.codingMemory);
        
        // Backward compatibility routes (without versioning)
        app.use('/api/memory', this.routes.memory);
        app.use('/api/agents', this.routes.agents);
        app.use('/api/chat', this.routes.chat);
        app.use('/api/health', this.routes.health);
        app.use('/api/kagent', this.routes.kagent);
        app.use('/api/config', this.routes.config.router);
        app.use('/api/sources', this.routes.config.router);
        app.use('/api/debug', this.routes.config.router);
        app.use('/api/gitops', this.routes.config.router);
        app.use('/api/self-awareness', this.routes.selfAwareness);
        app.use('/api/search', this.routes.search);
        app.use('/api/memory/code', this.routes.codingMemory);
        
        logger.debug('Routes mounted to Express app');
    }
    
    /**
     * Add root API endpoints
     */
    addRootEndpoints(app) {
        // API Info
        app.get('/api', (req, res) => {
            res.json({
                name: 'AutoWeave API',
                version: '0.1.0',
                description: 'Self-Weaving Agent Orchestrator API',
                timestamp: new Date().toISOString(),
                endpoints: {
                    agents: '/api/agents',
                    chat: '/api/chat',
                    memory: '/api/memory',
                    kagent: '/api/kagent',
                    health: '/api/health',
                    selfAwareness: '/api/self-awareness',
                    search: '/api/search',
                    codingMemory: '/api/memory/code'
                },
                documentation: {
                    agents: 'CRUD operations for AI agents',
                    chat: 'OpenAI-compatible chat completions',
                    memory: 'Hybrid memory system (mem0 + GraphRAG)',
                    kagent: 'Kubernetes native agent runtime',
                    health: 'System health and monitoring',
                    selfAwareness: 'System consciousness and synchronization',
                    search: 'Web, code, and documentation search capabilities',
                    codingMemory: 'Intelligent code memory with context and relations'
                },
                features: [
                    'Natural language agent creation',
                    'Kubernetes native deployment',
                    'Hybrid memory system',
                    'SillyTavern integration',
                    'Real-time monitoring'
                ]
            });
        });
        
        // API Health (simple version)
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                version: '0.1.0'
            });
        });
        
        // API Status (detailed version)
        app.get('/status', async (req, res) => {
            try {
                const status = {
                    autoweave: 'healthy',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    version: '0.1.0',
                    environment: process.env.NODE_ENV || 'development',
                    services: {}
                };
                
                // Check service health
                if (this.services.healthService) {
                    try {
                        const healthCheck = await this.services.healthService.getSystemHealth();
                        status.services = healthCheck.components || {};
                        status.overall = healthCheck.status || 'unknown';
                    } catch (error) {
                        status.services.healthService = 'error';
                        status.overall = 'degraded';
                    }
                } else {
                    status.services = {
                        memoryManager: this.services.memoryManager ? 'available' : 'unavailable',
                        agentService: this.services.agentService ? 'available' : 'unavailable',
                        chatService: this.services.chatService ? 'available' : 'unavailable',
                        kagentService: this.services.kagentService ? 'available' : 'unavailable'
                    };
                    
                    const availableServices = Object.values(status.services).filter(s => s === 'available').length;
                    const totalServices = Object.keys(status.services).length;
                    
                    if (availableServices === totalServices) {
                        status.overall = 'healthy';
                    } else if (availableServices > totalServices / 2) {
                        status.overall = 'degraded';
                    } else {
                        status.overall = 'unhealthy';
                    }
                }
                
                res.json(status);
                
            } catch (error) {
                logger.error('Status check failed:', error);
                res.status(500).json({
                    status: 'error',
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            }
        });
        
        // Catch-all for undefined API routes
        app.use('/api/*', (req, res) => {
            res.status(404).json({
                error: 'API endpoint not found',
                path: req.path,
                method: req.method,
                available_endpoints: [
                    'GET /api',
                    'GET /api/agents',
                    'POST /api/agents',
                    'GET /api/chat/models',
                    'POST /api/chat',
                    'GET /api/memory/health',
                    'POST /api/memory/search',
                    'GET /api/kagent/tools',
                    'GET /api/health'
                ]
            });
        });
        
        logger.debug('Root endpoints added');
    }
    
    /**
     * Get route statistics
     */
    getRouteStats() {
        return {
            routes: Object.keys(this.routes).length,
            services: Object.values(this.services).filter(s => s !== null).length,
            configured: Object.values(this.services).every(s => s !== null)
        };
    }
}

// Create and export singleton instance
const routesIndex = new RoutesIndex();

module.exports = {
    RoutesIndex,
    routesIndex,
    
    // Export individual routes for direct access
    memoryRoutes,
    agentRoutes,
    chatRoutes,
    healthRoutes,
    kagentRoutes
};