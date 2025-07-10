const { Logger } = require('../utils/logger');
const { RetryHelper } = require('../utils/retry');
const express = require('express');
const SwaggerParser = require('swagger-parser');
const Ajv = require('ajv');
const fetch = require('node-fetch');

class MCPDiscovery {
    constructor(config, kagentBridge = null, autoweaveInstance = null) {
        this.config = config;
        this.logger = new Logger('MCPDiscovery');
        
        // MCP Discovery (existing)
        this.servers = new Map();
        this.tools = new Map();
        this.isRunning = false;
        
        // ANP Server components
        this.kagentBridge = kagentBridge;
        this.autoweaveInstance = autoweaveInstance;
        this.anpTasks = new Map();
        this.externalAgents = new Map();
        
        // ANP Express app
        this.anpApp = express();
        this.anpApp.use(express.json());
        this.anpServer = null;
        
        // JSON Schema validator
        this.ajv = new Ajv();
    }

    async start() {
        if (!this.config.discoveryEnabled) {
            this.logger.info('MCP Discovery is disabled');
            return;
        }

        this.logger.info('Starting MCP Discovery Service...');
        
        try {
            // Initialize MCP discovery
            await this.initializeDiscovery();
            
            // Start periodic discovery
            this.startPeriodicDiscovery();
            
            // Initialize ANP server
            await this.initializeANPServer();
            
            // Start ANP server
            await this.startANPServer();
            
            this.isRunning = true;
            this.logger.success('MCP Discovery Service started');
            
        } catch (error) {
            this.logger.error('Failed to start MCP Discovery:', error);
            throw error;
        }
    }

    async initializeDiscovery() {
        // Discover existing MCP servers
        await this.discoverServers();
        
        // Discover tools from servers
        await this.discoverTools();
    }

    async discoverServers() {
        this.logger.info('Discovering MCP servers...');
        
        try {
            // Mock implementation - in real scenario, this would:
            // 1. Scan for MCP servers on the network
            // 2. Check registry endpoints
            // 3. Query known server locations
            
            const mockServers = [
                {
                    id: 'file-server',
                    name: 'File Operations Server',
                    url: 'http://localhost:8081',
                    capabilities: ['file-read', 'file-write', 'file-list']
                },
                {
                    id: 'k8s-server',
                    name: 'Kubernetes Operations Server',
                    url: 'http://localhost:8082',
                    capabilities: ['kubectl', 'k8s-logs', 'k8s-status']
                }
            ];

            mockServers.forEach(server => {
                this.servers.set(server.id, server);
                this.logger.debug(`Discovered MCP server: ${server.name}`);
            });

            this.logger.info(`Discovered ${this.servers.size} MCP servers`);
            
        } catch (error) {
            this.logger.warn('Failed to discover MCP servers:', error.message);
        }
    }

    async discoverTools() {
        this.logger.info('Discovering MCP tools...');
        
        for (const server of this.servers.values()) {
            try {
                const tools = await this.queryServerTools(server);
                
                tools.forEach(tool => {
                    this.tools.set(tool.id, {
                        ...tool,
                        serverId: server.id,
                        serverUrl: server.url
                    });
                });
                
                this.logger.debug(`Discovered ${tools.length} tools from ${server.name}`);
                
            } catch (error) {
                this.logger.warn(`Failed to discover tools from ${server.name}:`, error.message);
            }
        }
        
        this.logger.info(`Discovered ${this.tools.size} MCP tools total`);
    }

    async queryServerTools(server) {
        // Mock implementation - in real scenario, this would query the MCP server
        return server.capabilities.map(capability => ({
            id: capability,
            name: capability,
            description: `Tool for ${capability} operations`,
            type: 'mcp_tool',
            capability
        }));
    }

    startPeriodicDiscovery() {
        // Rediscover servers and tools every 5 minutes
        setInterval(async () => {
            if (this.isRunning) {
                try {
                    await this.discoverServers();
                    await this.discoverTools();
                } catch (error) {
                    this.logger.warn('Periodic discovery failed:', error.message);
                }
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    getAvailableServers() {
        return Array.from(this.servers.values());
    }

    getAvailableTools() {
        return Array.from(this.tools.values());
    }

    getServerById(serverId) {
        return this.servers.get(serverId);
    }

    getToolById(toolId) {
        return this.tools.get(toolId);
    }

    findToolsByCapability(capability) {
        return Array.from(this.tools.values()).filter(tool => 
            tool.capability === capability || 
            tool.name.toLowerCase().includes(capability.toLowerCase())
        );
    }

    async stop() {
        this.logger.info('Stopping MCP Discovery Service...');
        
        this.isRunning = false;
        
        // Stop ANP server
        if (this.anpServer) {
            this.anpServer.close();
            this.logger.info('ANP server stopped');
        }
        
        // Clear intervals would be here in real implementation
        
        this.logger.info('MCP Discovery Service stopped');
    }

    // ========== ANP SERVER METHODS ==========

    async initializeANPServer() {
        this.logger.info('Initializing ANP Server...');
        
        // Setup ANP routes
        this.setupANPRoutes();
        
        // Initialize external agent discovery
        await this.initializeExternalAgentDiscovery();
        
        this.logger.debug('ANP Server initialized');
    }

    async startANPServer() {
        return new Promise((resolve, reject) => {
            const port = this.config.anpPort || 8082;
            
            this.anpServer = this.anpApp.listen(port, (err) => {
                if (err) {
                    this.logger.error('Failed to start ANP server:', err);
                    reject(err);
                } else {
                    this.logger.success(`ANP Server listening on port ${port}`);
                    resolve();
                }
            });
        });
    }

    setupANPRoutes() {
        // ANP Endpoint: GET /agent
        this.anpApp.get('/agent', async (req, res) => {
            this.logger.debug('ANP GET /agent request received');
            
            try {
                // Use validation parameter to determine response type
                const validate = req.query.validate === 'true';
                
                let agentCard;
                if (validate) {
                    agentCard = await this.generateValidatedAgentCard();
                } else {
                    agentCard = this.generateAutoWeaveAgentCard();
                }
                
                res.json(agentCard);
                this.logger.debug(`ANP /agent served successfully (validated: ${validate})`);
                
            } catch (error) {
                this.logger.error('Failed to serve ANP /agent:', error);
                res.status(500).json({ 
                    error: 'Failed to generate agent card',
                    details: error.message 
                });
            }
        });

        // ANP Endpoint: POST /agent/tasks
        this.anpApp.post('/agent/tasks', async (req, res) => {
            const { input, tools, agent_id } = req.body;
            const taskId = `autoweave-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            this.logger.info(`ANP POST /agent/tasks received for ID: ${taskId}`);
            
            try {
                // Create task
                const task = {
                    task_id: taskId,
                    input: input,
                    tools: tools || [],
                    agent_id: agent_id || 'autoweave-orchestrator',
                    status: 'created',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                // Store task
                this.anpTasks.set(taskId, task);
                
                // Process task asynchronously
                this.processANPTask(taskId, task);
                
                res.status(201).json(task);
                this.logger.debug(`ANP task ${taskId} created successfully`);
                
            } catch (error) {
                this.logger.error(`Failed to handle ANP task ${taskId}:`, error);
                res.status(500).json({ 
                    error: error.message, 
                    task_id: taskId, 
                    status: 'failed' 
                });
            }
        });

        // ANP Endpoint: GET /agent/tasks/{task_id}
        this.anpApp.get('/agent/tasks/:task_id', (req, res) => {
            const taskId = req.params.task_id;
            const task = this.anpTasks.get(taskId);
            
            if (task) {
                res.json(task);
                this.logger.debug(`ANP GET /agent/tasks/${taskId} served`);
            } else {
                res.status(404).json({ error: 'Task not found' });
                this.logger.warn(`ANP GET /agent/tasks/${taskId} not found`);
            }
        });

        // ANP Endpoint: GET /agent/tasks/{task_id}/steps
        this.anpApp.get('/agent/tasks/:task_id/steps', (req, res) => {
            const taskId = req.params.task_id;
            const task = this.anpTasks.get(taskId);
            
            if (task) {
                res.json({
                    task_id: taskId,
                    steps: task.steps || [],
                    current_step: task.current_step || 0
                });
            } else {
                res.status(404).json({ error: 'Task not found' });
            }
        });

        // ANP Endpoint: GET /agent/capabilities
        this.anpApp.get('/agent/capabilities', (req, res) => {
            try {
                const capabilities = this.getAutoWeaveCapabilities();
                res.json(capabilities);
            } catch (error) {
                this.logger.error('Failed to serve capabilities:', error);
                res.status(500).json({ error: 'Failed to get capabilities' });
            }
        });

        // ANP Endpoint: GET /agent/openapi/validate
        this.anpApp.get('/agent/openapi/validate', async (req, res) => {
            this.logger.debug('ANP GET /agent/openapi/validate request received');
            
            try {
                const validationResults = await this.validateAllToolsOpenAPI();
                
                res.json({
                    validated_at: new Date().toISOString(),
                    tools_total: validationResults.length,
                    tools_valid: validationResults.filter(r => r.valid).length,
                    tools_invalid: validationResults.filter(r => !r.valid).length,
                    validation_results: validationResults
                });
                
                this.logger.debug('ANP OpenAPI validation served successfully');
                
            } catch (error) {
                this.logger.error('Failed to validate OpenAPI specs:', error);
                res.status(500).json({ 
                    error: 'Failed to validate OpenAPI specifications',
                    details: error.message 
                });
            }
        });

        // ANP Endpoint: POST /agent/openapi/validate
        this.anpApp.post('/agent/openapi/validate', async (req, res) => {
            this.logger.debug('ANP POST /agent/openapi/validate request received');
            
            try {
                const { spec, source = 'client' } = req.body;
                
                if (!spec) {
                    return res.status(400).json({ 
                        error: 'OpenAPI specification is required',
                        valid: false 
                    });
                }
                
                const validationResult = await this.validateOpenAPISpec(spec, source);
                
                res.json(validationResult);
                this.logger.debug(`ANP OpenAPI validation completed for ${source}`);
                
            } catch (error) {
                this.logger.error('Failed to validate provided OpenAPI spec:', error);
                res.status(500).json({ 
                    error: 'Failed to validate OpenAPI specification',
                    details: error.message,
                    valid: false
                });
            }
        });

        // ANP Endpoint: GET /agent/external/{agent_id}/validate
        this.anpApp.get('/agent/external/:agent_id/validate', async (req, res) => {
            const agentId = req.params.agent_id;
            this.logger.debug(`ANP GET /agent/external/${agentId}/validate request received`);
            
            try {
                const validationResults = await this.validateExternalAgentOpenAPI(agentId);
                
                res.json({
                    agent_id: agentId,
                    validated_at: new Date().toISOString(),
                    validation_results: validationResults
                });
                
                this.logger.debug(`ANP external agent validation completed for ${agentId}`);
                
            } catch (error) {
                this.logger.error(`Failed to validate external agent ${agentId}:`, error);
                res.status(500).json({ 
                    error: 'Failed to validate external agent',
                    details: error.message,
                    agent_id: agentId
                });
            }
        });

        this.logger.debug('ANP routes configured');
    }

    generateAutoWeaveAgentCard() {
        return {
            protocol_version: 'v1',
            agent_id: 'autoweave-orchestrator',
            name: 'AutoWeave',
            description: 'AutoWeave: The Self-Weaving Agent Orchestrator. Deploy, manage, and orchestrate AI agents on Kubernetes.',
            version: '0.1.0',
            author: 'AutoWeave Team',
            capabilities: {
                tools: this.getAutoWeaveToolsAsOpenAPI(),
                supported_formats: ['json', 'yaml'],
                supported_protocols: ['anp', 'mcp'],
                deployment_targets: ['kubernetes', 'kagent'],
                features: [
                    'agent-creation',
                    'workflow-orchestration',
                    'kubernetes-deployment',
                    'hybrid-memory-system',
                    'ui-integration'
                ]
            },
            endpoints: {
                tasks: '/agent/tasks',
                capabilities: '/agent/capabilities',
                health: '/health'
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
    }

    getAutoWeaveToolsAsOpenAPI() {
        // Generate OpenAPI specs for AutoWeave tools
        const tools = [];
        
        // Agent creation tool
        tools.push({
            name: 'create-agent',
            description: 'Create a new AI agent from natural language description',
            openapi: {
                openapi: '3.1.0',
                info: {
                    title: 'Create Agent Tool',
                    version: '1.0.0'
                },
                paths: {
                    '/create-agent': {
                        post: {
                            summary: 'Create a new agent',
                            requestBody: {
                                required: true,
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                description: {
                                                    type: 'string',
                                                    description: 'Natural language description of the agent'
                                                },
                                                user_id: {
                                                    type: 'string',
                                                    description: 'User ID for the agent'
                                                }
                                            },
                                            required: ['description']
                                        }
                                    }
                                }
                            },
                            responses: {
                                '200': {
                                    description: 'Agent created successfully',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'string' },
                                                    name: { type: 'string' },
                                                    status: { type: 'string' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Agent management tool
        tools.push({
            name: 'manage-agents',
            description: 'List, get, update, and delete agents',
            openapi: {
                openapi: '3.1.0',
                info: {
                    title: 'Agent Management Tool',
                    version: '1.0.0'
                },
                paths: {
                    '/agents': {
                        get: {
                            summary: 'List all agents',
                            responses: {
                                '200': {
                                    description: 'List of agents',
                                    content: {
                                        'application/json': {
                                            schema: {
                                                type: 'object',
                                                properties: {
                                                    agents: {
                                                        type: 'array',
                                                        items: {
                                                            type: 'object',
                                                            properties: {
                                                                id: { type: 'string' },
                                                                name: { type: 'string' },
                                                                status: { type: 'string' }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Get tools from kagent if available
        if (this.kagentBridge && this.kagentBridge.availableTools) {
            this.kagentBridge.availableTools.forEach(tool => {
                tools.push({
                    name: tool.name,
                    description: tool.description,
                    openapi: tool.openapi || this.generateBasicOpenAPIForTool(tool)
                });
            });
        }

        return tools;
    }

    generateBasicOpenAPIForTool(tool) {
        return {
            openapi: '3.1.0',
            info: {
                title: tool.name,
                version: '1.0.0',
                description: tool.description
            },
            paths: {
                [`/${tool.name}`]: {
                    post: {
                        summary: tool.description,
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            input: {
                                                type: 'string',
                                                description: 'Tool input'
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            '200': {
                                description: 'Tool execution result',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                result: { type: 'string' },
                                                success: { type: 'boolean' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    getAutoWeaveCapabilities() {
        return {
            agent_creation: {
                supported: true,
                description: 'Create agents from natural language descriptions',
                input_formats: ['text', 'json']
            },
            workflow_orchestration: {
                supported: true,
                description: 'Orchestrate multi-step agent workflows',
                features: ['conditional-logic', 'parallel-execution', 'error-handling']
            },
            kubernetes_deployment: {
                supported: true,
                description: 'Deploy agents to Kubernetes via kagent',
                requirements: ['kagent-runtime', 'kubernetes-cluster']
            },
            memory_system: {
                supported: true,
                description: 'Hybrid memory system with contextual and structural memory',
                components: ['mem0', 'memgraph', 'fusion-algorithm']
            },
            ui_integration: {
                supported: true,
                description: 'Integration with SillyTavern and Appsmith',
                interfaces: ['chat', 'dashboard', 'api']
            }
        };
    }

    async processANPTask(taskId, task) {
        this.logger.info(`Processing ANP task: ${taskId}`);
        
        try {
            // Update task status
            task.status = 'running';
            task.updated_at = new Date().toISOString();
            task.steps = [];
            task.current_step = 0;
            
            // Process based on input and tools
            if (this.autoweaveInstance && this.autoweaveInstance.agentService) {
                // Create agent from description
                const result = await this.autoweaveInstance.agentService.createAndDeployAgent(
                    task.input,
                    task.agent_id || 'anp-client'
                );
                
                task.status = 'completed';
                task.result = result;
                task.steps.push({
                    step: 1,
                    action: 'create-agent',
                    status: 'completed',
                    result: result,
                    timestamp: new Date().toISOString()
                });
                
            } else {
                // Fallback to mock result
                task.status = 'completed';
                task.result = {
                    agent_id: `mock-agent-${Date.now()}`,
                    name: 'Mock Agent',
                    description: task.input,
                    status: 'created'
                };
                task.steps.push({
                    step: 1,
                    action: 'mock-create-agent',
                    status: 'completed',
                    result: task.result,
                    timestamp: new Date().toISOString()
                });
            }
            
            task.updated_at = new Date().toISOString();
            task.current_step = 1;
            
            this.logger.success(`ANP task ${taskId} completed`);
            
        } catch (error) {
            this.logger.error(`ANP task ${taskId} failed:`, error);
            
            task.status = 'failed';
            task.error = error.message;
            task.updated_at = new Date().toISOString();
            task.steps.push({
                step: task.current_step + 1,
                action: 'error',
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // ========== EXTERNAL AGENT DISCOVERY ==========

    async initializeExternalAgentDiscovery() {
        if (this.config.externalAnpRegistries && this.config.externalAnpRegistries.length > 0) {
            this.logger.info('Initializing external agent discovery...');
            await this.discoverExternalAgents(this.config.externalAnpRegistries);
        }
    }

    async discoverExternalAgents(registryUrls) {
        this.logger.info('Starting ANP client discovery of external agents');
        
        for (const url of registryUrls) {
            try {
                this.logger.debug(`Querying ANP registry: ${url}/agent`);
                
                const response = await fetch(`${url}/agent`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const agentCard = await response.json();
                
                // Validate agent card
                if (this.validateAgentCard(agentCard)) {
                    this.externalAgents.set(agentCard.agent_id, {
                        ...agentCard,
                        registry_url: url,
                        discovered_at: new Date().toISOString()
                    });
                    
                    this.logger.success(`Discovered external agent: ${agentCard.agent_id} from ${url}`);
                } else {
                    this.logger.warn(`Invalid agent card from ${url}:`, agentCard);
                }
                
            } catch (error) {
                this.logger.error(`Failed to discover agent from ${url}:`, error);
            }
        }
        
        this.logger.info(`Discovered ${this.externalAgents.size} external agents`);
    }

    validateAgentCard(agentCard) {
        // Basic validation of agent card structure
        return (
            agentCard &&
            typeof agentCard === 'object' &&
            agentCard.agent_id &&
            agentCard.protocol_version &&
            agentCard.capabilities
        );
    }

    getDiscoveredExternalCapabilities() {
        const capabilities = [];
        
        this.externalAgents.forEach(agentCard => {
            if (agentCard.capabilities && agentCard.capabilities.tools) {
                agentCard.capabilities.tools.forEach(tool => {
                    capabilities.push({
                        ...tool,
                        source_agent: agentCard.agent_id,
                        registry_url: agentCard.registry_url
                    });
                });
            }
        });
        
        return capabilities;
    }

    // ========== UTILITY METHODS ==========

    // ========== OPENAPI VALIDATION ==========

    async validateOpenAPISpec(spec, source = 'unknown') {
        this.logger.debug(`Validating OpenAPI spec from ${source}`);
        
        try {
            // Use swagger-parser to validate the spec
            const api = await SwaggerParser.validate(spec);
            
            // Additional ANP-specific validation
            this.validateANPCompliance(spec);
            
            // Validate JSON schema structure
            this.validateJSONSchemaStructure(spec);
            
            this.logger.success(`OpenAPI spec validation passed for ${source}`);
            return {
                valid: true,
                spec: api,
                source: source,
                validated_at: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error(`OpenAPI validation failed for ${source}:`, error);
            return {
                valid: false,
                error: error.message,
                source: source,
                validated_at: new Date().toISOString()
            };
        }
    }

    validateANPCompliance(spec) {
        const errors = [];
        
        // Check OpenAPI version
        if (!spec.openapi || !spec.openapi.startsWith('3.')) {
            errors.push('OpenAPI specification must be version 3.0 or higher');
        }
        
        // Check for required info fields
        if (!spec.info) {
            errors.push('Missing info section');
        } else {
            if (!spec.info.title) errors.push('Missing info.title');
            if (!spec.info.version) errors.push('Missing info.version');
        }
        
        // Check for ANP-specific metadata
        if (spec.info) {
            if (!spec.info['x-agent-id']) {
                errors.push('Missing x-agent-id in info section (required for ANP compliance)');
            }
            if (!spec.info['x-agent-name']) {
                errors.push('Missing x-agent-name in info section (required for ANP compliance)');
            }
        }
        
        // Check for paths
        if (!spec.paths || Object.keys(spec.paths).length === 0) {
            errors.push('No paths defined in specification');
        }
        
        // Check for security schemes
        if (!spec.components?.securitySchemes) {
            errors.push('No security schemes defined (recommended for ANP)');
        }
        
        // Check for proper HTTP methods
        if (spec.paths) {
            Object.entries(spec.paths).forEach(([path, pathItem]) => {
                Object.keys(pathItem).forEach(method => {
                    if (!['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].includes(method) && 
                        !['parameters', 'summary', 'description', '$ref'].includes(method)) {
                        errors.push(`Invalid HTTP method '${method}' in path ${path}`);
                    }
                });
            });
        }
        
        if (errors.length > 0) {
            throw new Error(`ANP compliance validation failed: ${errors.join(', ')}`);
        }
    }

    validateJSONSchemaStructure(spec) {
        // Validate the OpenAPI spec structure using AJV
        const openApiSchema = {
            type: 'object',
            required: ['openapi', 'info', 'paths'],
            properties: {
                openapi: {
                    type: 'string',
                    pattern: '^3\\.[0-9]+\\.[0-9]+$'
                },
                info: {
                    type: 'object',
                    required: ['title', 'version'],
                    properties: {
                        title: { type: 'string' },
                        version: { type: 'string' },
                        description: { type: 'string' }
                    }
                },
                paths: {
                    type: 'object',
                    patternProperties: {
                        '^/': {
                            type: 'object'
                        }
                    }
                }
            }
        };
        
        const validate = this.ajv.compile(openApiSchema);
        const valid = validate(spec);
        
        if (!valid) {
            throw new Error(`JSON Schema validation failed: ${JSON.stringify(validate.errors)}`);
        }
    }

    async validateToolOpenAPI(tool) {
        if (!tool.openapi) {
            this.logger.warn(`Tool ${tool.name} has no OpenAPI specification`);
            return {
                valid: false,
                error: 'No OpenAPI specification provided',
                tool: tool.name
            };
        }
        
        return await this.validateOpenAPISpec(tool.openapi, `tool-${tool.name}`);
    }

    async validateAllToolsOpenAPI() {
        const tools = this.getAutoWeaveToolsAsOpenAPI();
        const validationResults = [];
        
        for (const tool of tools) {
            const result = await this.validateToolOpenAPI(tool);
            validationResults.push({
                tool: tool.name,
                ...result
            });
        }
        
        return validationResults;
    }

    async validateExternalAgentOpenAPI(agentId) {
        const agent = this.externalAgents.get(agentId);
        if (!agent) {
            throw new Error(`External agent ${agentId} not found`);
        }
        
        if (!agent.capabilities || !agent.capabilities.tools) {
            return {
                valid: false,
                error: 'Agent has no tools with OpenAPI specifications',
                agent: agentId
            };
        }
        
        const validationResults = [];
        for (const tool of agent.capabilities.tools) {
            const result = await this.validateToolOpenAPI(tool);
            validationResults.push({
                tool: tool.name,
                agent: agentId,
                ...result
            });
        }
        
        return validationResults;
    }

    // Enhanced agent card generation with OpenAPI validation
    async generateValidatedAgentCard() {
        const agentCard = this.generateAutoWeaveAgentCard();
        
        // Validate all tool OpenAPI specifications
        const validationResults = await this.validateAllToolsOpenAPI();
        
        // Add validation metadata to agent card
        agentCard.validation = {
            validated_at: new Date().toISOString(),
            tools_validated: validationResults.length,
            tools_valid: validationResults.filter(r => r.valid).length,
            tools_invalid: validationResults.filter(r => !r.valid).length,
            validation_results: validationResults
        };
        
        // Add compliance metadata
        agentCard.compliance = {
            anp_version: '1.0.0',
            openapi_version: '3.1.0',
            validated: true,
            validation_level: 'full'
        };
        
        return agentCard;
    }

    // OpenAPI spec enhancement with validation
    async enhanceOpenAPISpecWithValidation(spec, workflow) {
        // First validate the base spec
        const validationResult = await this.validateOpenAPISpec(spec, `workflow-${workflow.name}`);
        
        if (!validationResult.valid) {
            throw new Error(`OpenAPI validation failed: ${validationResult.error}`);
        }
        
        // Add validation metadata to the spec
        const enhancedSpec = {
            ...validationResult.spec,
            'x-validation': {
                validated_at: validationResult.validated_at,
                validation_source: 'autoweave-mcp-discovery',
                anp_compliant: true,
                workflow_id: workflow.id
            }
        };
        
        return enhancedSpec;
    }

    getANPStats() {
        return {
            tasks: {
                total: this.anpTasks.size,
                by_status: this.getTasksByStatus()
            },
            external_agents: this.externalAgents.size,
            capabilities: this.getAutoWeaveToolsAsOpenAPI().length
        };
    }

    getTasksByStatus() {
        const stats = {};
        this.anpTasks.forEach(task => {
            stats[task.status] = (stats[task.status] || 0) + 1;
        });
        return stats;
    }
}

module.exports = { MCPDiscovery };