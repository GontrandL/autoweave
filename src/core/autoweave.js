const { AgentWeaver } = require('./agent-weaver');
const { MCPDiscovery } = require('../mcp/discovery');
const { Logger } = require('../utils/logger');
const { AgentService } = require('../services/agent-service');
const { routesIndex } = require('../routes');
const HybridMemoryManager = require('../memory/hybrid-memory');
const { UIAgent } = require('../agui/ui-agent');
const { IntegrationAgentModule } = require('../agents/integration-agent');
const { AutoWeaveMCPServer } = require('../mcp/autoweave-mcp-server');
const { ConfigurationIntelligence } = require('./config-intelligence');
const { DebuggingAgent } = require('../agents/debugging-agent');
const { FreshSourcesService } = require('../services/fresh-sources-service');
const express = require('express');
const WebSocket = require('ws');

/**
 * AutoWeave - Version refactorisée avec architecture de services
 * Séparation claire des responsabilités et utilisation des services
 */
class AutoWeave {
    constructor(config, kagentBridge) {
        this.config = config;
        this.kagentBridge = kagentBridge;
        this.logger = new Logger('AutoWeave');

        // Core Components
        this.agentWeaver = new AgentWeaver(config.agentWeaver);
        this.mcpDiscovery = new MCPDiscovery(config.mcp, kagentBridge, this);
        this.memoryManager = new HybridMemoryManager(config.memory);

        // Services
        this.agentService = null;
        this.integrationAgentModule = null;
        this.server = null;
        this.isInitialized = false;
        
        // New services for meta-configuration
        this.mcpServer = new AutoWeaveMCPServer(config, this);
        this.configIntelligence = null; // Initialized after core components
        this.debuggingAgent = null; // Initialized after core components
        this.freshSources = new FreshSourcesService(config.freshSources);
        
        // AG-UI WebSocket clients
        this.aguiClients = new Map(); // clientId -> WebSocket connection
        
        // UI Agent for enhanced AG-UI event generation
        this.uiAgent = new UIAgent(config, this);
    }

    async initialize() {
        this.logger.info('Initializing AutoWeave with service architecture...');

        try {
            // 1. Initialize MCP Discovery (with timeout)
            try {
                await Promise.race([
                    this.mcpDiscovery.start(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('MCP Discovery timeout')), 30000))
                ]);
            } catch (error) {
                this.logger.warn('MCP Discovery failed, continuing:', error.message);
            }

            // 2. Initialize Agent Weaver
            await this.agentWeaver.initialize();

            // 3. Initialize Memory System
            await this.memoryManager.initialize();
            
            // 3.1. Pass memory manager to agent weaver
            this.agentWeaver.setMemoryManager(this.memoryManager);
            
            // 3.5. Initialize UI Agent
            await this.uiAgent.initialize();

            // 4. Initialize Agent Service (will handle kagent initialization)
            this.agentService = new AgentService(
                this.agentWeaver,
                this.kagentBridge,
                this.memoryManager
            );
            await this.agentService.initialize();

            // 4.5. Initialize Integration Agent Module
            this.integrationAgentModule = new IntegrationAgentModule(this.config);
            await this.integrationAgentModule.initialize();

            // 5. Initialize new meta-configuration services
            this.configIntelligence = new ConfigurationIntelligence(
                this.config,
                this.agentWeaver,
                this.memoryManager
            );
            
            this.debuggingAgent = new DebuggingAgent(
                this.config.debugging || {},
                this.agentWeaver, // Can be used as LLM
                this.memoryManager
            );
            
            // Initialize MCP server
            await this.mcpServer.initialize();

            // 6. Start web interface with services
            await this.startWebInterface();
            
            // 7. Start MCP server on separate port
            this.mcpServer.start(this.config.mcpPort || 3002);

            this.isInitialized = true;
            this.logger.success('✅ AutoWeave initialized with service architecture');
            this.logger.info('🔧 Configuration Intelligence enabled');
            this.logger.info('🐛 Debugging Agent ready');
            this.logger.info('🌐 MCP Server running on port ' + (this.config.mcpPort || 3002));

        } catch (error) {
            this.logger.error('Failed to initialize AutoWeave:', error);
            throw error;
        }
    }

    async startWebInterface() {
        // Skip web interface in test mode
        if (process.env.NODE_ENV === 'test') {
            this.logger.info('Skipping web interface in test mode');
            return;
        }

        const app = express();
        
        // Basic middleware
        app.use(express.json({ limit: '10mb' }));
        app.use(express.urlencoded({ extended: true }));

        // CORS middleware
        this.setupCORS(app);

        // Configure routes with services
        routesIndex.configure(app, {
            memoryManager: this.memoryManager,
            agentService: this.agentService,
            integrationAgentModule: this.integrationAgentModule,
            chatService: this.agentWeaver, // AgentWeaver handles chat
            kagentService: this.kagentBridge,
            healthService: this, // AutoWeave provides health info
            configIntelligence: this.configIntelligence,
            freshSources: this.freshSources,
            debuggingAgent: this.debuggingAgent
        });

        // Error handling middleware
        this.setupErrorHandling(app);

        // Start server
        this.server = app.listen(this.config.port, () => {
            this.logger.success(`🌐 AutoWeave API listening on port ${this.config.port}`);
            this.logEndpoints();
        });
    }

    setupCORS(app) {
        app.use((req, res, next) => {
            // Allow requests from Kind cluster pods and local development
            const allowedOrigins = [
                'http://localhost:8081',    // SillyTavern
                'http://localhost:8080',    // Appsmith
                'http://172.19.0.1:8081',   // Kind cluster SillyTavern
                'http://172.19.0.1:8080',   // Kind cluster Appsmith
                'http://127.0.0.1:8081',
                'http://127.0.0.1:8080'
            ];
            
            const origin = req.headers.origin;
            if (!origin || allowedOrigins.includes(origin)) {
                res.header('Access-Control-Allow-Origin', origin || '*');
            }
            
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Credentials', 'true');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
    }

    setupErrorHandling(app) {
        // Global error handler
        app.use((error, req, res, next) => {
            this.logger.error('Unhandled API error:', error);
            
            // Don't leak error details in production
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            res.status(error.status || 500).json({
                error: 'Internal server error',
                message: isDevelopment ? error.message : 'Something went wrong',
                timestamp: new Date().toISOString(),
                path: req.path,
                method: req.method
            });
        });

        // 404 handler
        app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.path,
                method: req.method,
                available: '/api'
            });
        });
    }

    logEndpoints() {
        this.logger.info('🚀 AutoWeave API Endpoints:');
        this.logger.info('  📋 Main API: http://localhost:' + this.config.port + '/api');
        this.logger.info('  🤖 Agents: http://localhost:' + this.config.port + '/api/agents');
        this.logger.info('  💬 Chat: http://localhost:' + this.config.port + '/api/chat');
        this.logger.info('  🧠 Memory: http://localhost:' + this.config.port + '/api/memory');
        this.logger.info('  ☸️  Kagent: http://localhost:' + this.config.port + '/api/kagent');
        this.logger.info('  ❤️  Health: http://localhost:' + this.config.port + '/api/health');
        this.logger.info('');
        this.logger.info('🖥️  External UIs:');
        this.logger.info('  💬 SillyTavern: http://localhost:8081');
        this.logger.info('  📊 Appsmith: http://localhost:8080');
        this.logger.info('  ☸️  kagent UI: kubectl port-forward -n kagent-system svc/kagent-ui 8080:80');
    }

    // Health service implementation for routes
    async getSystemHealth() {
        const components = {
            autoweave: {
                status: this.isInitialized ? 'healthy' : 'initializing',
                uptime: process.uptime(),
                version: '0.1.0'
            },
            agentWeaver: {
                status: this.agentWeaver.mockMode ? 'mock' : 'healthy',
                mock: this.agentWeaver.mockMode || false
            },
            mcpDiscovery: {
                status: this.mcpDiscovery.isRunning ? 'running' : 'stopped',
                servers: this.mcpDiscovery.discoveredServers?.length || 0
            },
            kagentBridge: {
                status: this.kagentBridge.isInitialized ? 'healthy' : 'not_ready',
                namespace: this.kagentBridge.config?.namespace || 'unknown',
                tools: this.kagentBridge.availableTools?.length || 0
            },
            memoryManager: {
                status: this.memoryManager.isInitialized ? 'healthy' : 'not_ready',
                contextual: this.memoryManager.contextualMemory ? 'available' : 'unavailable',
                structural: this.memoryManager.structuralMemory ? 'available' : 'unavailable'
            },
            agentService: {
                status: this.agentService?.isInitialized ? 'healthy' : 'not_ready',
                agents: this.agentService?.getStats().totalAgents || 0
            }
        };

        // Determine overall status
        const healthyComponents = Object.values(components).filter(c => 
            c.status === 'healthy' || c.status === 'running' || c.status === 'mock'
        ).length;
        const totalComponents = Object.keys(components).length;

        let overallStatus;
        if (healthyComponents === totalComponents) {
            overallStatus = 'healthy';
        } else if (healthyComponents >= totalComponents * 0.7) {
            overallStatus = 'degraded';
        } else {
            overallStatus = 'unhealthy';
        }

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '0.1.0',
            components
        };
    }

    async getDetailedHealth() {
        const health = await this.getSystemHealth();
        
        return {
            ...health,
            system: {
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid
            },
            configuration: {
                port: this.config.port,
                logLevel: this.config.logLevel,
                environment: process.env.NODE_ENV || 'development'
            }
        };
    }

    async getComponentsHealth() {
        const health = await this.getSystemHealth();
        return health.components;
    }

    async getReadinessStatus() {
        const components = await this.getComponentsHealth();
        const criticalComponents = ['autoweave', 'agentWeaver', 'memoryManager'];
        
        const failedChecks = [];
        const checks = [];

        for (const [name, component] of Object.entries(components)) {
            checks.push(name);
            
            if (criticalComponents.includes(name)) {
                if (!['healthy', 'running', 'mock'].includes(component.status)) {
                    failedChecks.push(name);
                }
            }
        }

        return {
            ready: failedChecks.length === 0,
            checks,
            failedChecks
        };
    }

    async getMetrics() {
        const agentStats = this.agentService?.getStats() || { totalAgents: 0, byStatus: {} };
        
        return {
            agents: agentStats,
            memory: {
                total: this.memoryManager.isInitialized ? 'available' : 'unavailable',
                contextual: this.memoryManager.contextualMemory ? 'active' : 'inactive',
                structural: this.memoryManager.structuralMemory ? 'active' : 'inactive'
            },
            kagent: {
                tools: this.kagentBridge.availableTools?.length || 0,
                namespace: this.kagentBridge.config?.namespace || 'unknown'
            },
            mcp: {
                servers: this.mcpDiscovery.discoveredServers?.length || 0,
                running: this.mcpDiscovery.isRunning
            },
            anp: this.mcpDiscovery.getANPStats ? this.mcpDiscovery.getANPStats() : null,
            agui: {
                connected_clients: this.aguiClients.size,
                clients: Array.from(this.aguiClients.keys())
            }
        };
    }

    // ========== HTTP SERVER METHODS ==========

    getHttpServer() {
        return this.server;
    }

    // ========== AG-UI WEBSOCKET METHODS ==========

    addAGUIClient(clientId, ws) {
        this.aguiClients.set(clientId, ws);
        this.logger.debug(`AG-UI client added: ${clientId}`);
        
        // Send enhanced welcome sequence using UI Agent
        this.sendEnhancedWelcome(clientId);
    }

    removeAGUIClient(clientId) {
        this.aguiClients.delete(clientId);
        this.logger.debug(`AG-UI client removed: ${clientId}`);
    }

    handleAGUIInput(clientId, event) {
        this.logger.debug(`Processing AG-UI input from ${clientId}:`, event);
        
        try {
            // Process based on event type
            switch (event.type) {
                case 'chat':
                    this.handleAGUIChatInput(clientId, event);
                    break;
                
                case 'input':
                    this.handleAGUIUserInput(clientId, event);
                    break;
                
                case 'command':
                    this.handleAGUICommand(clientId, event);
                    break;
                
                default:
                    this.logger.warn(`Unknown AG-UI event type: ${event.type}`);
                    this.sendAGUIEvent({
                        type: 'error',
                        content: {
                            message: `Unknown event type: ${event.type}`,
                            timestamp: new Date().toISOString()
                        }
                    }, clientId);
            }
            
        } catch (error) {
            this.logger.error(`Error processing AG-UI input from ${clientId}:`, error);
            this.sendAGUIEvent({
                type: 'error',
                content: {
                    message: 'Error processing your request',
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            }, clientId);
        }
    }

    async handleAGUIChatInput(clientId, event) {
        const message = event.content?.text || event.content?.message;
        
        if (!message) {
            this.sendAGUIEvent({
                type: 'error',
                content: {
                    message: 'No message content provided',
                    timestamp: new Date().toISOString()
                }
            }, clientId);
            return;
        }

        this.logger.info(`AG-UI chat from ${clientId}: "${message}"`);
        
        // Echo the message back first
        this.sendAGUIEvent({
            type: 'chat',
            content: {
                text: `Processing: "${message}"`,
                timestamp: new Date().toISOString(),
                sender: 'autoweave'
            }
        }, clientId);

        try {
            // Check if it's an agent creation request
            if (message.toLowerCase().includes('create') && message.toLowerCase().includes('agent')) {
                await this.handleAgentCreationRequest(clientId, message);
            } else {
                // General chat response
                const response = await this.agentWeaver.processMessage(message, {
                    user_id: clientId,
                    context: 'agui'
                });
                
                this.sendAGUIEvent({
                    type: 'chat',
                    content: {
                        text: response.content,
                        timestamp: new Date().toISOString(),
                        sender: 'autoweave',
                        tokens: response.totalTokens
                    }
                }, clientId);
            }
            
        } catch (error) {
            this.logger.error(`Error processing chat from ${clientId}:`, error);
            this.sendAGUIEvent({
                type: 'chat',
                content: {
                    text: 'Sorry, I encountered an error processing your message.',
                    timestamp: new Date().toISOString(),
                    sender: 'autoweave',
                    error: true
                }
            }, clientId);
        }
    }

    async handleAgentCreationRequest(clientId, message) {
        // Send a form to get more details
        this.sendAGUIEvent({
            type: 'display',
            content: {
                type: 'form',
                title: 'Create New Agent',
                schema: {
                    type: 'object',
                    properties: {
                        description: {
                            type: 'string',
                            title: 'Agent Description',
                            description: 'Describe what this agent should do',
                            default: message
                        },
                        name: {
                            type: 'string',
                            title: 'Agent Name (optional)',
                            description: 'Give your agent a name'
                        }
                    },
                    required: ['description']
                },
                action: 'create-agent',
                timestamp: new Date().toISOString()
            }
        }, clientId);
    }

    async handleAGUIUserInput(clientId, event) {
        const { action, values } = event.content || {};
        
        if (action === 'create-agent' && values?.description) {
            try {
                this.sendAGUIEvent({
                    type: 'chat',
                    content: {
                        text: `Creating agent: "${values.description}"`,
                        timestamp: new Date().toISOString(),
                        sender: 'autoweave'
                    }
                }, clientId);
                
                // Create the agent
                const agent = await this.agentService.createAndDeployAgent(
                    values.description,
                    clientId
                );
                
                this.sendAGUIEvent({
                    type: 'display',
                    content: {
                        type: 'success',
                        title: 'Agent Created Successfully',
                        data: {
                            id: agent.id,
                            name: agent.name,
                            status: agent.status,
                            created: agent.createdAt
                        },
                        timestamp: new Date().toISOString()
                    }
                }, clientId);
                
                this.sendAGUIEvent({
                    type: 'chat',
                    content: {
                        text: `✅ Agent "${agent.name}" created successfully! ID: ${agent.id}`,
                        timestamp: new Date().toISOString(),
                        sender: 'autoweave'
                    }
                }, clientId);
                
            } catch (error) {
                this.logger.error(`Error creating agent for ${clientId}:`, error);
                this.sendAGUIEvent({
                    type: 'display',
                    content: {
                        type: 'error',
                        title: 'Agent Creation Failed',
                        message: error.message,
                        timestamp: new Date().toISOString()
                    }
                }, clientId);
            }
        }
    }

    async handleAGUICommand(clientId, event) {
        const { command, args } = event.content || {};
        
        switch (command) {
            case 'list-agents':
                const agents = await this.agentService.listAgents();
                this.sendAGUIEvent({
                    type: 'display',
                    content: {
                        type: 'table',
                        title: 'Active Agents',
                        data: agents.agents || [],
                        columns: ['id', 'name', 'status', 'createdAt'],
                        timestamp: new Date().toISOString()
                    }
                }, clientId);
                break;
                
            case 'get-metrics':
                const metrics = await this.getMetrics();
                this.sendAGUIEvent({
                    type: 'display',
                    content: {
                        type: 'json',
                        title: 'System Metrics',
                        data: metrics,
                        timestamp: new Date().toISOString()
                    }
                }, clientId);
                break;
                
            default:
                this.sendAGUIEvent({
                    type: 'error',
                    content: {
                        message: `Unknown command: ${command}`,
                        timestamp: new Date().toISOString()
                    }
                }, clientId);
        }
    }

    sendAGUIEvent(event, targetClientId = null) {
        const message = JSON.stringify(event);
        
        if (targetClientId && this.aguiClients.has(targetClientId)) {
            const client = this.aguiClients.get(targetClientId);
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
                this.logger.debug(`AG-UI event sent to ${targetClientId}:`, event.type);
            } else {
                this.logger.warn(`Client ${targetClientId} is not ready for messages`);
            }
        } else if (!targetClientId) {
            // Broadcast to all clients
            let sentCount = 0;
            this.aguiClients.forEach((client, clientId) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                    sentCount++;
                }
            });
            this.logger.debug(`AG-UI event broadcast to ${sentCount} clients:`, event.type);
        } else {
            this.logger.warn(`Client ${targetClientId} not found or not connected`);
        }
    }

    getAGUIStats() {
        return {
            connected_clients: this.aguiClients.size,
            clients: Array.from(this.aguiClients.keys())
        };
    }

    // Simplified public API methods
    async createAgent(description, userId = 'system') {
        if (!this.agentService) {
            throw new Error('Agent service not initialized');
        }
        return await this.agentService.createAndDeployAgent(description, userId);
    }

    async listAgents() {
        if (!this.agentService) {
            throw new Error('Agent service not initialized');
        }
        return await this.agentService.listAgents();
    }

    async getAgent(agentId) {
        if (!this.agentService) {
            throw new Error('Agent service not initialized');
        }
        return await this.agentService.getAgentStatus(agentId);
    }

    async deleteAgent(agentId) {
        if (!this.agentService) {
            throw new Error('Agent service not initialized');
        }
        return await this.agentService.deleteAgent(agentId);
    }

    async processChat(message, options = {}) {
        return await this.agentWeaver.processMessage(message, options);
    }

    // ========== ENHANCED AG-UI METHODS WITH UI AGENT ==========

    async sendEnhancedWelcome(clientId) {
        try {
            if (this.uiAgent) {
                await this.uiAgent.generateWelcomeSequence(clientId);
            }
        } catch (error) {
            this.logger.error(`Failed to send enhanced welcome to ${clientId}:`, error);
        }
    }

    async handleEnhancedCommand(clientId, command, args) {
        try {
            if (!this.uiAgent) {
                throw new Error('UI Agent not available');
            }

            switch (command) {
                case 'system-health':
                    await this.uiAgent.generateSystemHealthDisplay(clientId);
                    break;
                    
                case 'list-agents':
                    await this.uiAgent.generateAgentListDisplay(clientId);
                    break;
                    
                case 'create-agent':
                    const description = args?.description || 'Default agent';
                    await this.uiAgent.generateAgentCreationFlow(clientId, description);
                    break;
                    
                default:
                    this.sendAGUIEvent({
                        type: 'error',
                        content: {
                            message: `Unknown enhanced command: ${command}`,
                            timestamp: new Date().toISOString()
                        }
                    }, clientId);
            }
            
        } catch (error) {
            this.logger.error(`Enhanced command failed for ${clientId}:`, error);
            this.sendAGUIEvent({
                type: 'error',
                content: {
                    message: 'Enhanced command processing failed',
                    details: error.message,
                    timestamp: new Date().toISOString()
                }
            }, clientId);
        }
    }

    async sendOperationStatus(clientId, operationId, status, message, progress = null) {
        if (this.uiAgent) {
            await this.uiAgent.generateOperationStatus(clientId, operationId, status, message, progress);
        }
    }

    async shutdown() {
        this.logger.info('Shutting down AutoWeave...');
        
        // Close all AG-UI WebSocket connections
        this.aguiClients.forEach((client, clientId) => {
            if (client.readyState === WebSocket.OPEN) {
                client.close();
            }
        });
        this.aguiClients.clear();
        this.logger.info('AG-UI WebSocket clients closed');
        
        // Stop web server
        if (this.server) {
            this.server.close();
        }
        
        // Shutdown services
        if (this.agentService) {
            await this.agentService.shutdown();
        }
        
        // Shutdown components
        await this.mcpDiscovery.stop();
        await this.agentWeaver.shutdown();
        
        if (this.memoryManager) {
            await this.memoryManager.shutdown();
        }
        
        this.isInitialized = false;
        // Shutdown UI Agent
        if (this.uiAgent) {
            await this.uiAgent.shutdown();
        }
        
        this.logger.success('AutoWeave shutdown complete');
    }
}

module.exports = { AutoWeave };