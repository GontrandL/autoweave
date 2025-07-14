const { AgentWeaver } = require('./agent-weaver');
const { MCPDiscovery } = require('../mcp/discovery');
const { Logger } = require('../utils/logger');
const HybridMemoryManager = require('../memory/hybrid-memory');
const express = require('express');

class AutoWeave {
    constructor(config, kagentBridge) {
        this.config = config;
        this.kagentBridge = kagentBridge;
        this.logger = new Logger('AutoWeave');

        // Core Components
        this.agentWeaver = new AgentWeaver(config.agentWeaver);
        this.mcpDiscovery = new MCPDiscovery(config.mcp);
        this.memoryManager = new HybridMemoryManager(config.memory);

        // State
        this.createdWorkflows = new Map();
        this.deployedAgents = new Map();
        this.server = null;
    }

    async initialize() {
        this.logger.info('Initializing AutoWeave components...');

        // 1. Initialize MCP Discovery
        await this.mcpDiscovery.start();

        // 2. Initialize Agent Weaver
        await this.agentWeaver.initialize();

        // 3. Initialize Memory System
        await this.memoryManager.initialize();

        // 4. Discover available kagent tools
        this.availableKagentTools = this.kagentBridge.availableTools || [];
        this.logger.info(`Available kagent tools: ${this.availableKagentTools.length}`);

        // 5. Start web interface
        await this.startWebInterface();

        this.logger.info('AutoWeave initialization complete');
    }

    async createAndDeployAgent(description, userId = 'system') {
        this.logger.info(`Creating and deploying agent: "${description}"`);

        try {
            // 1. Generate workflow with Agent Weaver
            const workflow = await this.agentWeaver.generateWorkflow(description);
            this.createdWorkflows.set(workflow.id, workflow);

            // 2. Enhance workflow with kagent tools
            const enhancedWorkflow = await this.enhanceWithKagentTools(workflow);

            // 3. Create agent with memory
            const agentData = {
                id: workflow.id,
                name: workflow.name,
                description: workflow.description,
                status: 'created',
                config: enhancedWorkflow,
                namespace: this.config.kagent.namespace
            };

            await this.memoryManager.createAgentWithMemory(agentData, userId);

            // 4. Deploy to kagent
            const deployedAgent = await this.kagentBridge.deployAgent(enhancedWorkflow);
            this.deployedAgents.set(workflow.id, deployedAgent);

            // 5. Update agent status in memory
            await this.memoryManager.contextualMemory.addAgentMemory(
                workflow.id,
                `Agent ${workflow.name} deployed successfully`,
                {
                    action: 'deployment',
                    status: 'deployed',
                    timestamp: new Date().toISOString()
                }
            );

            this.logger.success(`Agent ${workflow.name} created and deployed successfully`);

            return {
                workflow: enhancedWorkflow,
                deployment: deployedAgent,
                status: 'deployed'
            };

        } catch (error) {
            this.logger.error('Failed to create and deploy agent:', error);
            throw error;
        }
    }

    async enhanceWithKagentTools(workflow) {
        this.logger.info('Enhancing workflow with kagent tools...');

        // Map required capabilities to available kagent tools
        const enhancedModules = workflow.requiredModules.map(module => {
            const kagentTools = this.findMatchingKagentTools(module);

            return {
                ...module,
                kagentTools,
                available: kagentTools.length > 0
            };
        });

        return {
            ...workflow,
            requiredModules: enhancedModules,
            kagentCompatible: enhancedModules.every(m => m.available)
        };
    }

    findMatchingKagentTools(module) {
        return this.availableKagentTools.filter(tool => {
            const toolName = tool.metadata.name.toLowerCase();
            const moduleType = module.type.toLowerCase();

            // Simple matching logic - can be enhanced
            return toolName.includes(moduleType) ||
                   moduleType.includes(toolName) ||
                   (module.keywords && module.keywords.some(k => toolName.includes(k)));
        });
    }

    async getAgentStatus(agentId) {
        const workflow = this.createdWorkflows.get(agentId);
        const deployment = this.deployedAgents.get(agentId);

        if (!workflow || !deployment) {
            return null;
        }

        // Get real-time status from kagent
        const kagentStatus = await this.kagentBridge.getAgentStatus(agentId);

        return {
            id: agentId,
            name: workflow.name,
            description: workflow.description,
            status: kagentStatus?.status || 'unknown',
            createdAt: deployment.createdAt,
            kagentDetails: kagentStatus
        };
    }

    async processChatMessage(message, options = {}) {
        this.logger.info(`Processing chat message: "${message}"`);

        try {
            // Check if the message is an agent creation request
            if (this.isAgentCreationRequest(message)) {
                return await this.handleAgentCreationFromChat(message, options);
            }

            // Check if the message is about agent management
            if (this.isAgentManagementRequest(message)) {
                return await this.handleAgentManagementFromChat(message, options);
            }

            // Default: Use AgentWeaver to process the message
            const response = await this.agentWeaver.processMessage(message, {
                maxTokens: options.max_tokens,
                temperature: options.temperature,
                context: options.conversationContext
            });

            return {
                content: response.content || response,
                promptTokens: response.promptTokens || 0,
                completionTokens: response.completionTokens || 0,
                totalTokens: response.totalTokens || 0
            };

        } catch (error) {
            this.logger.error('Error processing chat message:', error);
            throw error;
        }
    }

    isAgentCreationRequest(message) {
        const keywords = ['create agent', 'new agent', 'make agent', 'agent for', 'deploy agent'];
        return keywords.some(keyword => message.toLowerCase().includes(keyword));
    }

    isAgentManagementRequest(message) {
        const keywords = ['list agents', 'show agents', 'agent status', 'delete agent', 'remove agent'];
        return keywords.some(keyword => message.toLowerCase().includes(keyword));
    }

    async handleAgentCreationFromChat(message, options) {
        try {
            // Extract agent description from the message
            const description = this.extractAgentDescription(message);
            
            // Create and deploy the agent
            const result = await this.createAndDeployAgent(description);
            
            return {
                content: `✅ Agent "${result.workflow.name}" created successfully!\n\n` +
                        `**ID:** ${result.workflow.id}\n` +
                        `**Description:** ${result.workflow.description}\n` +
                        `**Status:** ${result.status}\n` +
                        `**Capabilities:** ${result.workflow.requiredModules.map(m => m.type).join(', ')}\n\n` +
                        `The agent is now deployed and ready to use.`,
                promptTokens: 50,
                completionTokens: 100,
                totalTokens: 150
            };
        } catch (error) {
            return {
                content: `❌ Failed to create agent: ${error.message}\n\nPlease check the description and try again.`,
                promptTokens: 20,
                completionTokens: 30,
                totalTokens: 50
            };
        }
    }

    async handleAgentManagementFromChat(message, options) {
        try {
            if (message.toLowerCase().includes('list') || message.toLowerCase().includes('show')) {
                const agents = [];
                for (const [id, workflow] of this.createdWorkflows) {
                    const status = await this.getAgentStatus(id);
                    if (status) {
                        agents.push(status);
                    }
                }

                if (agents.length === 0) {
                    return {
                        content: "📋 No agents found. Use 'create agent' to create your first agent.",
                        promptTokens: 10,
                        completionTokens: 20,
                        totalTokens: 30
                    };
                }

                const agentList = agents.map(agent => 
                    `• **${agent.name}** (${agent.id})\n  Status: ${agent.status}\n  Description: ${agent.description}`
                ).join('\n\n');

                return {
                    content: `📋 **Active Agents (${agents.length}):**\n\n${agentList}`,
                    promptTokens: 20,
                    completionTokens: agents.length * 20,
                    totalTokens: 20 + agents.length * 20
                };
            }

            // Add more agent management commands here
            return {
                content: "🤖 Available agent management commands:\n\n" +
                        "• `list agents` - Show all agents\n" +
                        "• `create agent [description]` - Create a new agent\n" +
                        "• `agent status [id]` - Get agent status\n" +
                        "• `delete agent [id]` - Remove an agent",
                promptTokens: 15,
                completionTokens: 40,
                totalTokens: 55
            };

        } catch (error) {
            return {
                content: `❌ Error managing agents: ${error.message}`,
                promptTokens: 10,
                completionTokens: 20,
                totalTokens: 30
            };
        }
    }

    extractAgentDescription(message) {
        // Extract description from patterns like "create agent for X" or "make agent that does Y"
        const patterns = [
            /create agent (?:for |that |to )?(.+)/i,
            /make agent (?:for |that |to )?(.+)/i,
            /new agent (?:for |that |to )?(.+)/i,
            /agent (?:for |that |to )?(.+)/i
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        // Fallback: return the original message
        return message;
    }

    async startWebInterface() {
        // Skip web interface in test mode to avoid port conflicts
        if (process.env.NODE_ENV === 'test') {
            this.logger.info('Skipping web interface in test mode');
            return;
        }

        // Simple Express server for API/UI
        const app = express();
        
        // Initialize memory routes
        const memoryRoutes = require('../routes/memory');
        memoryRoutes.setMemoryManager(this.memoryManager);

        // Enable CORS for SillyTavern integration and Kind cluster
        app.use((req, res, next) => {
            // Allow requests from Kind cluster pods and local development
            const allowedOrigins = [
                '*', // Allow all for development
                'http://localhost:8081',
                'http://localhost:8080', 
                'http://172.19.0.1:8081',
                'http://172.19.0.1:8080'
            ];
            
            const origin = req.headers.origin;
            if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
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

        app.use(express.json());
        
        // Mount memory routes
        app.use('/api/memory', memoryRoutes);

        // Health check endpoint
        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                components: {
                    agentWeaver: 'running',
                    mcpDiscovery: this.mcpDiscovery.isRunning ? 'running' : 'stopped',
                    kagentBridge: this.kagentBridge.isInitialized ? 'running' : 'stopped',
                    memoryManager: this.memoryManager.isInitialized ? 'running' : 'stopped'
                }
            });
        });

        // Create agent endpoint
        app.post('/api/agents', async (req, res) => {
            try {
                const { description } = req.body;
                
                if (!description) {
                    return res.status(400).json({ error: 'Description is required' });
                }
                
                const result = await this.createAndDeployAgent(description);
                res.json(result);
            } catch (error) {
                this.logger.error('API error creating agent:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Get agent status endpoint
        app.get('/api/agents/:id', async (req, res) => {
            try {
                const status = await this.getAgentStatus(req.params.id);
                if (!status) {
                    return res.status(404).json({ error: 'Agent not found' });
                }
                res.json(status);
            } catch (error) {
                this.logger.error('API error getting agent status:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // List agents endpoint
        app.get('/api/agents', async (req, res) => {
            try {
                const agents = [];
                for (const [id, workflow] of this.createdWorkflows) {
                    const status = await this.getAgentStatus(id);
                    if (status) {
                        agents.push(status);
                    }
                }
                res.json(agents);
            } catch (error) {
                this.logger.error('API error listing agents:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Delete agent endpoint
        app.delete('/api/agents/:id', async (req, res) => {
            try {
                await this.kagentBridge.deleteAgent(req.params.id);
                this.createdWorkflows.delete(req.params.id);
                this.deployedAgents.delete(req.params.id);
                res.json({ message: 'Agent deleted successfully' });
            } catch (error) {
                this.logger.error('API error deleting agent:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Chat endpoint for SillyTavern integration (OpenAI-compatible)
        app.post('/api/chat', async (req, res) => {
            try {
                const { messages, model = 'autoweave-agent', max_tokens = 1000, temperature = 0.7 } = req.body;
                
                if (!messages || !Array.isArray(messages)) {
                    return res.status(400).json({ error: 'Messages array is required' });
                }

                // Extract the last user message
                const userMessage = messages.filter(msg => msg.role === 'user').pop();
                if (!userMessage) {
                    return res.status(400).json({ error: 'No user message found' });
                }

                this.logger.info(`Chat request: "${userMessage.content}"`);

                // Process the message with AgentWeaver
                const response = await this.processChatMessage(userMessage.content, {
                    model,
                    max_tokens,
                    temperature,
                    conversationContext: messages
                });

                // Return OpenAI-compatible response
                res.json({
                    id: `chatcmpl-${Date.now()}`,
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
                });

            } catch (error) {
                this.logger.error('API error processing chat:', error);
                res.status(500).json({ 
                    error: {
                        message: error.message,
                        type: 'autoweave_error',
                        code: 'processing_failed'
                    }
                });
            }
        });

        // Start server
        this.server = app.listen(this.config.port, () => {
            this.logger.success(`AutoWeave API listening on port ${this.config.port}`);
        });
    }

    async shutdown() {
        this.logger.info('Shutting down AutoWeave...');
        
        // Stop web server
        if (this.server) {
            this.server.close();
        }
        
        // Shutdown components
        await this.mcpDiscovery.stop();
        await this.agentWeaver.shutdown();
        
        // Shutdown memory manager
        if (this.memoryManager) {
            await this.memoryManager.shutdown();
        }
        
        this.logger.info('AutoWeave shutdown complete');
    }
}

module.exports = { AutoWeave };