const { OpenAI } = require('openai');
const { Logger } = require('@autoweave/shared');
const { Validator } = require('@autoweave/shared');
const { RetryHelper } = require('@autoweave/shared');
const SwaggerParser = require('swagger-parser');
const Ajv = require('ajv');

class AgentWeaver {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('AgentWeaver');
        
        // Support multiple AI providers
        if (config.openrouterApiKey) {
            this.logger.info('Using OpenRouter API');
            this.openai = new OpenAI({
                apiKey: config.openrouterApiKey,
                baseURL: 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': 'https://github.com/autoweave/autoweave',
                    'X-Title': 'AutoWeave'
                }
            });
        } else if (config.openaiApiKey) {
            this.openai = new OpenAI({
                apiKey: config.openaiApiKey
            });
        } else {
            throw new Error('OpenAI or OpenRouter API key is required');
        }
    }

    async initialize() {
        this.logger.info('Initializing Agent Weaver...');
        
        // Skip OpenAI test in test environment
        if (process.env.NODE_ENV === 'test') {
            this.logger.warn('Using mock OpenAI for tests');
            this.mockMode = true;
            return;
        }
        
        // Test OpenAI connection
        try {
            await this.openai.models.list();
            this.logger.success('OpenAI connection verified');
        } catch (error) {
            this.logger.error('Failed to connect to OpenAI:', error);
            
            // If it's an invalid API key, use mock mode for development
            if (error.code === 'invalid_api_key' || this.config.openaiApiKey.includes('test')) {
                this.logger.warn('Using mock mode for OpenAI due to invalid API key');
                this.mockMode = true;
                return;
            }
            
            throw error;
        }
    }

    async generateWorkflow(description) {
        // Use appropriate model based on provider
        const model = this.config.openrouterApiKey ? 
            'openai/gpt-3.5-turbo' : // OpenRouter model that supports functions
            this.config.model || 'gpt-4';
        this.logger.info(`Generating workflow from description: "${description}"`);
        
        // Validate input
        Validator.validateAgentDescription(description);
        
        // Use mock workflow in test mode
        if (this.mockMode) {
            return this.generateMockWorkflow(description);
        }
        
        try {
            const workflow = await RetryHelper.withRetry(
                () => this.processDescription(description),
                {
                    maxAttempts: 3,
                    delay: 1000,
                    shouldRetry: (error) => error.message.includes('rate limit')
                }
            );
            
            this.logger.success(`Generated workflow: ${workflow.name}`);
            return workflow;
            
        } catch (error) {
            this.logger.error('Failed to generate workflow:', error);
            throw error;
        }
    }

    async processDescription(description) {
        const prompt = this.buildPrompt(description);
        
        const response = await this.openai.chat.completions.create({
            model: this.config.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert AI agent architect that converts natural language descriptions into structured agent workflows for Kubernetes deployment via kagent.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens
        });

        const result = response.choices[0].message.content;
        
        try {
            const workflow = JSON.parse(result);
            return this.validateAndEnhanceWorkflow(workflow, description);
        } catch (error) {
            this.logger.error('Failed to parse OpenAI response:', error);
            throw new Error('Invalid workflow structure generated');
        }
    }

    buildPrompt(description) {
        return `
Convert the following natural language description into a structured agent workflow.

Description: "${description}"

Return a JSON object with this exact structure:
{
    "id": "unique-id",
    "name": "agent-name",
    "description": "detailed description",
    "requiredModules": [
        {
            "name": "module-name",
            "type": "module-type",
            "description": "what this module does"
        }
    ],
    "steps": [
        {
            "action": "action-name",
            "description": "what this step does"
        }
    ],
    "modelConfig": {
        "name": "gpt-4",
        "temperature": 0.7
    }
}

Available module types:
- file_system: For reading/writing files
- kubernetes: For Kubernetes operations
- coding_assistant: For code analysis and generation
- monitoring: For system monitoring
- mcp_server: For custom MCP server integration

Guidelines:
1. Generate a unique ID using timestamp
2. Create a descriptive but concise name (lowercase, hyphens only)
3. Break down the task into logical steps
4. Choose appropriate modules based on the description
5. Ensure the workflow is executable and complete

Return only the JSON object, no additional text.
        `;
    }

    validateAndEnhanceWorkflow(workflow, originalDescription) {
        // Generate ID if not provided
        if (!workflow.id) {
            workflow.id = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        }

        // Validate required fields
        if (!workflow.name) {
            throw new Error('Workflow must have a name');
        }

        if (!workflow.description) {
            workflow.description = originalDescription;
        }

        if (!workflow.requiredModules || workflow.requiredModules.length === 0) {
            throw new Error('Workflow must have at least one required module');
        }

        // Sanitize name for Kubernetes compatibility
        workflow.name = this.sanitizeName(workflow.name);

        // Ensure steps exist
        if (!workflow.steps) {
            workflow.steps = [];
        }

        // Set default model config
        if (!workflow.modelConfig) {
            workflow.modelConfig = {
                name: 'gpt-4',
                temperature: 0.7
            };
        }

        // Validate Kubernetes naming
        Validator.validateKubernetesName(workflow.name);

        return workflow;
    }

    sanitizeName(name) {
        return name.toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '')
                  .substring(0, 63); // Kubernetes limit
    }

    async shutdown() {
        this.logger.info('Shutting down Agent Weaver...');
        // No persistent connections to close
    }

    generateMockWorkflow(description) {
        const id = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const name = this.sanitizeName(description.split(' ').slice(0, 3).join('-'));
        
        return {
            id,
            name,
            description,
            requiredModules: [
                {
                    name: 'file-reader',
                    type: 'file_system',
                    description: 'Read files from filesystem'
                }
            ],
            steps: [
                {
                    action: 'process_files',
                    description: 'Process files based on description'
                }
            ],
            modelConfig: {
                name: 'gpt-4',
                temperature: 0.7
            }
        };
    }

    async processMessage(message, options = {}) {
        this.logger.info(`Processing message: "${message}"`);

        // Use mock response in test mode
        if (this.mockMode) {
            return this.generateMockMessageResponse(message);
        }

        try {
            const response = await RetryHelper.withRetry(async () => {
                const completion = await this.openai.chat.completions.create({
                    model: options.model || 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are AutoWeave, an AI assistant that helps users manage and create autonomous agents. You can create, deploy, and manage agents using natural language commands. Be helpful, concise, and actionable in your responses.'
                        },
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    max_tokens: options.maxTokens || 1000,
                    temperature: options.temperature || 0.7
                });

                return {
                    content: completion.choices[0].message.content,
                    promptTokens: completion.usage.prompt_tokens,
                    completionTokens: completion.usage.completion_tokens,
                    totalTokens: completion.usage.total_tokens
                };
            }, { maxAttempts: 3 });

            this.logger.success('Message processed successfully');
            return response;

        } catch (error) {
            this.logger.error('Failed to process message:', error);
            throw error;
        }
    }

    generateMockMessageResponse(message) {
        return {
            content: `This is a mock response to: "${message}". AutoWeave is ready to help you manage agents and workflows.`,
            promptTokens: 30,
            completionTokens: 20,
            totalTokens: 50
        };
    }

    // Chat service compatibility methods
    async processChatMessage(message, options = {}) {
        this.logger.info(`Processing chat message: "${message}"`);
        
        // Extract conversation context if provided
        const conversationContext = options.conversationContext || [];
        
        // Use mock response in test mode
        if (this.mockMode) {
            return this.generateMockMessageResponse(message);
        }

        try {
            const messages = [
                {
                    role: 'system',
                    content: 'You are AutoWeave, an AI assistant that helps users manage and create autonomous agents. You can create, deploy, and manage agents using natural language commands. Be helpful, concise, and actionable in your responses.'
                }
            ];
            
            // Add conversation context if available
            if (conversationContext.length > 0) {
                messages.push(...conversationContext);
            } else {
                messages.push({
                    role: 'user',
                    content: message
                });
            }

            const response = await RetryHelper.withRetry(async () => {
                const completion = await this.openai.chat.completions.create({
                    model: options.model || 'gpt-4',
                    messages,
                    max_tokens: options.max_tokens || options.maxTokens || 1000,
                    temperature: options.temperature || 0.7,
                    stream: options.stream || false
                });

                return {
                    content: completion.choices[0].message.content,
                    promptTokens: completion.usage.prompt_tokens,
                    completionTokens: completion.usage.completion_tokens,
                    totalTokens: completion.usage.total_tokens
                };
            }, { maxAttempts: 3 });

            this.logger.success('Chat message processed successfully');
            return response;

        } catch (error) {
            this.logger.error('Failed to process chat message:', error);
            throw error;
        }
    }

    // Memory management methods
    async addToMemory(message, userId, metadata = {}) {
        this.logger.info(`Adding to memory for user ${userId}: "${message}"`);
        
        if (!this.memoryManager) {
            this.logger.warn('Memory manager not available, using fallback');
            return { id: Date.now().toString(), message, userId, metadata };
        }
        
        try {
            const result = await this.memoryManager.contextualMemory.addUserMemory(
                userId,
                message,
                {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    source: 'agent-weaver'
                }
            );
            
            this.logger.success(`Memory added for user ${userId}`);
            return result;
        } catch (error) {
            this.logger.error('Failed to add to memory:', error);
            return { id: Date.now().toString(), message, userId, metadata, error: true };
        }
    }

    async getMemory(userId, options = {}) {
        this.logger.info(`Getting memory for user ${userId}`);
        
        if (!this.memoryManager) {
            this.logger.warn('Memory manager not available, returning empty');
            return [];
        }
        
        try {
            const result = await this.memoryManager.contextualMemory.searchMemory(
                "user history",
                userId,
                {
                    type: options.type || 'all',
                    limit: options.limit || 10
                }
            );
            
            this.logger.success(`Retrieved ${result.length} memories for user ${userId}`);
            return result;
        } catch (error) {
            this.logger.error('Failed to get memory:', error);
            return [];
        }
    }

    async clearMemory(userId) {
        this.logger.info(`Clearing memory for user ${userId}`);
        
        if (!this.memoryManager) {
            this.logger.warn('Memory manager not available, cannot clear');
            return false;
        }
        
        try {
            await this.memoryManager.contextualMemory.deleteUserMemory(userId);
            this.logger.success(`Memory cleared for user ${userId}`);
            return true;
        } catch (error) {
            this.logger.error('Failed to clear memory:', error);
            return false;
        }
    }

    // ========== ANP OPENAPI 3.1 GENERATION ==========

    async generateOpenAPISpec(workflow, options = {}) {
        this.logger.info(`Generating OpenAPI 3.1 spec for workflow: ${workflow.name}`);
        
        try {
            // Use mock in test mode
            if (this.mockMode) {
                return this.generateMockOpenAPISpec(workflow);
            }
            
            const spec = await RetryHelper.withRetry(
                () => this.processWorkflowToOpenAPI(workflow, options),
                {
                    maxAttempts: 3,
                    delay: 1000,
                    shouldRetry: (error) => error.message.includes('rate limit')
                }
            );
            
            // Validate the generated spec
            await this.validateOpenAPISpec(spec);
            
            this.logger.success(`OpenAPI 3.1 spec generated for ${workflow.name}`);
            return spec;
            
        } catch (error) {
            this.logger.error('Failed to generate OpenAPI spec:', error);
            throw error;
        }
    }

    async processWorkflowToOpenAPI(workflow, options = {}) {
        const prompt = this.buildOpenAPIPrompt(workflow, options);
        
        const response = await this.openai.chat.completions.create({
            model: this.config.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert API architect that converts agent workflows into valid OpenAPI 3.1 specifications. Generate complete, valid OpenAPI specs that describe agent capabilities as RESTful APIs.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3, // Lower temperature for more structured output
            max_tokens: this.config.maxTokens
        });

        const result = response.choices[0].message.content;
        
        try {
            const spec = JSON.parse(result);
            return this.enhanceOpenAPISpec(spec, workflow);
        } catch (error) {
            this.logger.error('Failed to parse OpenAPI response:', error);
            throw new Error('Invalid OpenAPI specification generated');
        }
    }

    buildOpenAPIPrompt(workflow, options = {}) {
        const includeExamples = options.includeExamples !== false;
        const includeWebhooks = options.includeWebhooks === true;
        
        return `
Convert the following agent workflow into a valid OpenAPI 3.1 specification.

Workflow Details:
- Name: ${workflow.name}
- Description: ${workflow.description}
- Required Modules: ${JSON.stringify(workflow.requiredModules, null, 2)}
- Steps: ${JSON.stringify(workflow.steps, null, 2)}

Generate a complete OpenAPI 3.1 specification with:

1. **Info Section**: title, version, description
2. **Server**: Base URL for the agent API
3. **Paths**: REST endpoints for each workflow step/capability
4. **Components**: Schemas for request/response models
5. **Security**: API key authentication
${includeExamples ? '6. **Examples**: Request/response examples for each endpoint' : ''}
${includeWebhooks ? '7. **Webhooks**: Callback endpoints for async operations' : ''}

For each required module, create appropriate REST endpoints:
- file_system: /files (GET, POST, PUT, DELETE)
- kubernetes: /k8s/resources (GET, POST, PUT, DELETE)
- coding_assistant: /code/analyze, /code/generate
- monitoring: /metrics, /health
- mcp_server: /mcp/tools, /mcp/execute

For each workflow step, create an execution endpoint:
- POST /execute/{step-action}

Ensure the specification is:
- Valid OpenAPI 3.1 format
- Uses proper HTTP methods and status codes
- Includes comprehensive schema definitions
- Has security schemes defined
- Contains detailed descriptions

Return only the JSON specification, no additional text.
        `;
    }

    enhanceOpenAPISpec(spec, workflow) {
        // Ensure required OpenAPI 3.1 fields
        if (!spec.openapi) {
            spec.openapi = '3.1.0';
        }
        
        // Enhance info section
        if (!spec.info) {
            spec.info = {};
        }
        
        spec.info.title = spec.info.title || `${workflow.name} Agent API`;
        spec.info.version = spec.info.version || '1.0.0';
        spec.info.description = spec.info.description || workflow.description;
        
        // Add agent metadata
        spec.info['x-agent-id'] = workflow.id;
        spec.info['x-agent-name'] = workflow.name;
        spec.info['x-agent-type'] = 'autoweave-agent';
        spec.info['x-anp-version'] = '1.0.0';
        
        // Ensure servers section
        if (!spec.servers || spec.servers.length === 0) {
            spec.servers = [
                {
                    url: `http://localhost:3000/api/agents/${workflow.id}`,
                    description: 'AutoWeave Agent API'
                }
            ];
        }
        
        // Ensure security schemes
        if (!spec.components) {
            spec.components = {};
        }
        
        if (!spec.components.securitySchemes) {
            spec.components.securitySchemes = {
                apiKey: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key'
                },
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            };
        }
        
        // Add global security
        if (!spec.security) {
            spec.security = [
                { apiKey: [] },
                { bearerAuth: [] }
            ];
        }
        
        // Add common response schemas
        if (!spec.components.schemas) {
            spec.components.schemas = {};
        }
        
        spec.components.schemas.Error = {
            type: 'object',
            properties: {
                error: {
                    type: 'string',
                    description: 'Error message'
                },
                code: {
                    type: 'integer',
                    description: 'Error code'
                },
                timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Error timestamp'
                }
            },
            required: ['error', 'timestamp']
        };
        
        spec.components.schemas.Success = {
            type: 'object',
            properties: {
                success: {
                    type: 'boolean',
                    description: 'Operation success status'
                },
                data: {
                    type: 'object',
                    description: 'Response data'
                },
                timestamp: {
                    type: 'string',
                    format: 'date-time',
                    description: 'Response timestamp'
                }
            },
            required: ['success', 'timestamp']
        };
        
        return spec;
    }

    async validateOpenAPISpec(spec) {
        this.logger.debug('Validating OpenAPI 3.1 specification...');
        
        try {
            // Use swagger-parser to validate the spec
            await SwaggerParser.validate(spec);
            
            // Additional ANP-specific validation
            this.validateANPCompliance(spec);
            
            this.logger.success('OpenAPI specification validation passed');
            return true;
            
        } catch (error) {
            this.logger.error('OpenAPI specification validation failed:', error);
            throw new Error(`Invalid OpenAPI specification: ${error.message}`);
        }
    }

    validateANPCompliance(spec) {
        // ANP-specific validation rules
        const errors = [];
        
        // Check for required ANP metadata
        if (!spec.info['x-agent-id']) {
            errors.push('Missing x-agent-id in info section');
        }
        
        if (!spec.info['x-agent-name']) {
            errors.push('Missing x-agent-name in info section');
        }
        
        if (!spec.info['x-anp-version']) {
            errors.push('Missing x-anp-version in info section');
        }
        
        // Check for required endpoints
        if (!spec.paths) {
            errors.push('No paths defined in specification');
        }
        
        // Check for security schemes
        if (!spec.components?.securitySchemes) {
            errors.push('No security schemes defined');
        }
        
        if (errors.length > 0) {
            throw new Error(`ANP compliance validation failed: ${errors.join(', ')}`);
        }
    }

    generateMockOpenAPISpec(workflow) {
        return {
            openapi: '3.1.0',
            info: {
                title: `${workflow.name} Agent API`,
                version: '1.0.0',
                description: workflow.description,
                'x-agent-id': workflow.id,
                'x-agent-name': workflow.name,
                'x-agent-type': 'autoweave-agent',
                'x-anp-version': '1.0.0'
            },
            servers: [
                {
                    url: `http://localhost:3000/api/agents/${workflow.id}`,
                    description: 'AutoWeave Agent API (Mock)'
                }
            ],
            paths: {
                '/health': {
                    get: {
                        summary: 'Health check',
                        operationId: 'getHealth',
                        responses: {
                            '200': {
                                description: 'Agent is healthy',
                                content: {
                                    'application/json': {
                                        schema: {
                                            '$ref': '#/components/schemas/Success'
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                '/execute': {
                    post: {
                        summary: 'Execute agent workflow',
                        operationId: 'executeWorkflow',
                        requestBody: {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            input: {
                                                type: 'string',
                                                description: 'Input data for the workflow'
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        responses: {
                            '200': {
                                description: 'Workflow executed successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            '$ref': '#/components/schemas/Success'
                                        }
                                    }
                                }
                            },
                            '400': {
                                description: 'Invalid input',
                                content: {
                                    'application/json': {
                                        schema: {
                                            '$ref': '#/components/schemas/Error'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            components: {
                securitySchemes: {
                    apiKey: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key'
                    },
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                },
                schemas: {
                    Success: {
                        type: 'object',
                        properties: {
                            success: {
                                type: 'boolean',
                                description: 'Operation success status'
                            },
                            data: {
                                type: 'object',
                                description: 'Response data'
                            },
                            timestamp: {
                                type: 'string',
                                format: 'date-time',
                                description: 'Response timestamp'
                            }
                        },
                        required: ['success', 'timestamp']
                    },
                    Error: {
                        type: 'object',
                        properties: {
                            error: {
                                type: 'string',
                                description: 'Error message'
                            },
                            code: {
                                type: 'integer',
                                description: 'Error code'
                            },
                            timestamp: {
                                type: 'string',
                                format: 'date-time',
                                description: 'Error timestamp'
                            }
                        },
                        required: ['error', 'timestamp']
                    }
                }
            },
            security: [
                { apiKey: [] },
                { bearerAuth: [] }
            ]
        };
    }

    async getOpenAPICapabilities(workflow) {
        this.logger.debug(`Getting OpenAPI capabilities for workflow: ${workflow.name}`);
        
        try {
            const spec = await this.generateOpenAPISpec(workflow);
            
            // Extract capabilities from the OpenAPI spec
            const capabilities = {
                endpoints: [],
                schemas: Object.keys(spec.components?.schemas || {}),
                security: spec.security || [],
                operations: []
            };
            
            // Parse paths to extract endpoints and operations
            Object.entries(spec.paths || {}).forEach(([path, pathItem]) => {
                Object.entries(pathItem).forEach(([method, operation]) => {
                    if (method !== 'parameters' && method !== 'summary' && method !== 'description') {
                        capabilities.endpoints.push({
                            path,
                            method: method.toUpperCase(),
                            operationId: operation.operationId,
                            summary: operation.summary,
                            description: operation.description
                        });
                        
                        capabilities.operations.push(operation.operationId);
                    }
                });
            });
            
            return capabilities;
            
        } catch (error) {
            this.logger.error('Failed to get OpenAPI capabilities:', error);
            throw error;
        }
    }

    // Method to set memory manager after initialization
    setMemoryManager(manager) {
        this.memoryManager = manager;
        this.logger.info('Memory manager set successfully');
    }
}

module.exports = { AgentWeaver };