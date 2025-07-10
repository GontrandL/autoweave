const { Logger } = require('../../utils/logger');
const { OpenAI } = require('openai');

/**
 * LangChain-style Orchestrator
 * Provides structured reasoning and tool calling for Integration Agent
 * Uses OpenAI's function calling capabilities similar to LangChain agents
 */
class LangChainOrchestrator {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('LangChainOrchestrator');
        
        // OpenAI client (reuse existing config)
        this.openai = new OpenAI({
            apiKey: config.openaiApiKey || config.agentWeaver?.openaiApiKey
        });
        
        // Tool registry
        this.tools = new Map();
        this.conversationHistory = [];
        
        // Register default tools
        this.registerDefaultTools();
    }

    async initialize() {
        this.logger.info('Initializing LangChain Orchestrator...');
        
        try {
            // Test OpenAI connection
            if (process.env.NODE_ENV !== 'test') {
                await this.openai.models.list();
            }
            
            this.logger.success('LangChain Orchestrator initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize LangChain Orchestrator:', error);
            throw error;
        }
    }

    /**
     * Register default tools for integration agent
     */
    registerDefaultTools() {
        // OpenAPI parsing tool
        this.registerTool({
            name: 'parse_openapi_spec',
            description: 'Parse and validate an OpenAPI specification from URL or file',
            parameters: {
                type: 'object',
                properties: {
                    spec_url: {
                        type: 'string',
                        description: 'URL or file path to OpenAPI specification'
                    }
                },
                required: ['spec_url']
            }
        });

        // Pydantic model generation tool
        this.registerTool({
            name: 'generate_pydantic_models',
            description: 'Generate Pydantic models from OpenAPI specification',
            parameters: {
                type: 'object',
                properties: {
                    openapi_spec: {
                        type: 'object',
                        description: 'OpenAPI specification object'
                    }
                },
                required: ['openapi_spec']
            }
        });

        // Kubernetes manifest generation tool
        this.registerTool({
            name: 'generate_kubernetes_manifests',
            description: 'Generate Kubernetes manifests for integration agent',
            parameters: {
                type: 'object',
                properties: {
                    agent_config: {
                        type: 'object',
                        description: 'Agent configuration including OpenAPI spec and models'
                    },
                    namespace: {
                        type: 'string',
                        description: 'Target Kubernetes namespace'
                    }
                },
                required: ['agent_config']
            }
        });

        // GitOps deployment tool
        this.registerTool({
            name: 'deploy_via_gitops',
            description: 'Deploy manifests via GitOps workflow',
            parameters: {
                type: 'object',
                properties: {
                    manifests: {
                        type: 'object',
                        description: 'Kubernetes manifests to deploy'
                    },
                    git_repo: {
                        type: 'string',
                        description: 'Git repository URL for GitOps'
                    },
                    namespace: {
                        type: 'string',
                        description: 'Target namespace'
                    }
                },
                required: ['manifests']
            }
        });

        // Analysis tool
        this.registerTool({
            name: 'analyze_api_complexity',
            description: 'Analyze OpenAPI specification complexity and provide recommendations',
            parameters: {
                type: 'object',
                properties: {
                    openapi_spec: {
                        type: 'object',
                        description: 'OpenAPI specification to analyze'
                    }
                },
                required: ['openapi_spec']
            }
        });

        this.logger.debug('Default tools registered');
    }

    /**
     * Register a tool
     * @param {Object} tool - Tool definition
     */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        this.logger.debug(`Tool registered: ${tool.name}`);
    }

    /**
     * Execute integration agent reasoning
     * @param {string} userInput - User input describing the integration request
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} Orchestration result
     */
    async orchestrate(userInput, context = {}) {
        this.logger.info('Starting orchestration:', { userInput, context });

        try {
            // Build messages with system prompt
            const messages = this.buildMessages(userInput, context);
            
            // Get available tools as functions
            const functions = this.getToolFunctions();
            
            // Call OpenAI with function calling
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages,
                functions,
                function_call: 'auto',
                temperature: 0.1,
                max_tokens: 2000
            });

            const result = await this.processResponse(response, context);
            
            // Add to conversation history
            this.addToHistory(userInput, result);
            
            return result;

        } catch (error) {
            this.logger.error('Orchestration failed:', error);
            throw error;
        }
    }

    /**
     * Build messages for OpenAI
     * @param {string} userInput - User input
     * @param {Object} context - Context information
     * @returns {Array} Messages array
     */
    buildMessages(userInput, context) {
        const systemPrompt = `You are an AI Integration Agent Orchestrator powered by AutoWeave.

Your role is to help users create integration agents from OpenAPI specifications. You have access to specialized tools for:
1. Parsing and validating OpenAPI specifications
2. Generating Pydantic models from API schemas
3. Creating Kubernetes manifests for deployment
4. Setting up GitOps workflows with Argo CD
5. Analyzing API complexity and providing recommendations

When a user requests an integration agent, follow these steps:
1. Parse and validate the OpenAPI specification
2. Analyze the API for complexity and patterns
3. Generate appropriate Pydantic models
4. Create Kubernetes deployment manifests
5. Set up GitOps deployment if requested

Always provide clear explanations of what you're doing and why. Be helpful and educational.

Current context: ${JSON.stringify(context, null, 2)}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-6), // Keep last 6 messages for context
            { role: 'user', content: userInput }
        ];

        return messages;
    }

    /**
     * Get tool functions in OpenAI format
     * @returns {Array} Functions array
     */
    getToolFunctions() {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }

    /**
     * Process OpenAI response and execute tools if needed
     * @param {Object} response - OpenAI response
     * @param {Object} context - Context information
     * @returns {Promise<Object>} Processed result
     */
    async processResponse(response, context) {
        const message = response.choices[0].message;
        
        if (message.function_call) {
            // Tool was called
            const toolResult = await this.executeTool(message.function_call, context);
            
            return {
                type: 'tool_execution',
                tool: message.function_call.name,
                arguments: JSON.parse(message.function_call.arguments),
                result: toolResult,
                reasoning: message.content || `Executed ${message.function_call.name}`,
                timestamp: new Date().toISOString()
            };
        } else {
            // Regular response
            return {
                type: 'reasoning',
                content: message.content,
                recommendations: this.extractRecommendations(message.content),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute a tool
     * @param {Object} functionCall - Function call from OpenAI
     * @param {Object} context - Context information
     * @returns {Promise<Object>} Tool execution result
     */
    async executeTool(functionCall, context) {
        const { name, arguments: args } = functionCall;
        const parsedArgs = JSON.parse(args);
        
        this.logger.info(`Executing tool: ${name}`, parsedArgs);

        try {
            switch (name) {
                case 'parse_openapi_spec':
                    return await this.executeOpenAPIParser(parsedArgs, context);
                
                case 'generate_pydantic_models':
                    return await this.executePydanticGenerator(parsedArgs, context);
                
                case 'generate_kubernetes_manifests':
                    return await this.executeManifestGenerator(parsedArgs, context);
                
                case 'deploy_via_gitops':
                    return await this.executeGitOpsDeployment(parsedArgs, context);
                
                case 'analyze_api_complexity':
                    return await this.executeComplexityAnalyzer(parsedArgs, context);
                
                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        } catch (error) {
            this.logger.error(`Tool execution failed for ${name}:`, error);
            return {
                success: false,
                error: error.message,
                tool: name,
                arguments: parsedArgs
            };
        }
    }

    /**
     * Execute OpenAPI parser tool
     */
    async executeOpenAPIParser(args, context) {
        const { openAPIParser } = context.integrationAgent || {};
        if (!openAPIParser) {
            throw new Error('OpenAPI Parser not available in context');
        }

        const spec = await openAPIParser.parseSpecification(args.spec_url);
        const metadata = openAPIParser.extractMetadata(spec);
        const analysis = openAPIParser.analyzeSpecification(spec);

        return {
            success: true,
            spec,
            metadata,
            analysis,
            message: `Successfully parsed OpenAPI spec: ${metadata.title} v${metadata.version}`
        };
    }

    /**
     * Execute Pydantic generator tool
     */
    async executePydanticGenerator(args, context) {
        const { pydanticGenerator } = context.integrationAgent || {};
        if (!pydanticGenerator) {
            throw new Error('Pydantic Generator not available in context');
        }

        const result = await pydanticGenerator.generateModels(args.openapi_spec);

        return {
            success: true,
            ...result,
            message: `Generated ${result.modelsInfo.models.length} Pydantic models`
        };
    }

    /**
     * Execute manifest generator tool
     */
    async executeManifestGenerator(args, context) {
        const { integrationAgent } = context.integrationAgent || {};
        if (!integrationAgent) {
            throw new Error('Integration Agent not available in context');
        }

        const manifests = await integrationAgent.generateKubernetesManifests({
            ...args.agent_config,
            targetNamespace: args.namespace
        });

        return {
            success: true,
            manifests,
            message: `Generated Kubernetes manifests for namespace: ${args.namespace || 'default'}`
        };
    }

    /**
     * Execute GitOps deployment tool
     */
    async executeGitOpsDeployment(args, context) {
        const { gitOpsManager } = context.integrationAgent || {};
        if (!gitOpsManager) {
            throw new Error('GitOps Manager not available in context');
        }

        const result = await gitOpsManager.deployToGitOps(args);

        return {
            success: true,
            ...result,
            message: `Deployed to GitOps repository: ${args.git_repo || 'default'}`
        };
    }

    /**
     * Execute complexity analyzer tool
     */
    async executeComplexityAnalyzer(args, context) {
        const { openAPIParser } = context.integrationAgent || {};
        if (!openAPIParser) {
            throw new Error('OpenAPI Parser not available in context');
        }

        const analysis = openAPIParser.analyzeSpecification(args.openapi_spec);
        const metadata = openAPIParser.extractMetadata(args.openapi_spec);

        return {
            success: true,
            analysis,
            metadata,
            recommendations: analysis.recommendations,
            complexity: analysis.complexity,
            message: `API complexity: ${analysis.complexity}, ${metadata.endpoints.length} endpoints`
        };
    }

    /**
     * Extract recommendations from AI response
     * @param {string} content - AI response content
     * @returns {Array} Extracted recommendations
     */
    extractRecommendations(content) {
        const recommendations = [];
        
        // Simple regex to extract bullet points or numbered lists
        const bulletPoints = content.match(/[-*•]\s+(.+)/g);
        const numberedPoints = content.match(/\d+\.\s+(.+)/g);
        
        if (bulletPoints) {
            recommendations.push(...bulletPoints.map(point => point.replace(/[-*•]\s+/, '')));
        }
        
        if (numberedPoints) {
            recommendations.push(...numberedPoints.map(point => point.replace(/\d+\.\s+/, '')));
        }
        
        return recommendations;
    }

    /**
     * Add interaction to conversation history
     * @param {string} userInput - User input
     * @param {Object} result - Orchestration result
     */
    addToHistory(userInput, result) {
        this.conversationHistory.push(
            { role: 'user', content: userInput },
            { role: 'assistant', content: this.formatResultForHistory(result) }
        );
        
        // Keep only last 20 messages to prevent context overflow
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-20);
        }
    }

    /**
     * Format result for conversation history
     * @param {Object} result - Orchestration result
     * @returns {string} Formatted content
     */
    formatResultForHistory(result) {
        if (result.type === 'tool_execution') {
            return `Executed ${result.tool}: ${result.result.message || 'Success'}`;
        } else {
            return result.content;
        }
    }

    /**
     * Plan integration steps
     * @param {string} request - Integration request
     * @param {Object} context - Context information
     * @returns {Promise<Object>} Integration plan
     */
    async planIntegration(request, context = {}) {
        const planningPrompt = `Create a detailed step-by-step plan for the following integration request:

Request: ${request}

Context: ${JSON.stringify(context, null, 2)}

Provide a structured plan with clear steps, estimated time, and required resources.`;

        const response = await this.orchestrate(planningPrompt, context);
        
        return {
            request,
            plan: response,
            estimatedDuration: this.estimateIntegrationDuration(response),
            requiredResources: this.identifyRequiredResources(response),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Estimate integration duration
     * @param {Object} response - Orchestration response
     * @returns {string} Estimated duration
     */
    estimateIntegrationDuration(response) {
        // Simple heuristic based on complexity indicators
        const content = response.content || JSON.stringify(response);
        
        if (content.includes('complex') || content.includes('many endpoints')) {
            return '30-60 minutes';
        } else if (content.includes('medium') || content.includes('moderate')) {
            return '15-30 minutes';
        } else {
            return '5-15 minutes';
        }
    }

    /**
     * Identify required resources
     * @param {Object} response - Orchestration response
     * @returns {Array} Required resources
     */
    identifyRequiredResources(response) {
        const resources = ['OpenAPI specification', 'Kubernetes cluster'];
        
        const content = response.content || JSON.stringify(response);
        
        if (content.includes('git') || content.includes('GitOps')) {
            resources.push('Git repository');
        }
        
        if (content.includes('auth') || content.includes('authentication')) {
            resources.push('API credentials');
        }
        
        if (content.includes('database') || content.includes('storage')) {
            resources.push('Database/storage');
        }
        
        return resources;
    }

    /**
     * Get conversation history
     * @returns {Array} Conversation history
     */
    getConversationHistory() {
        return this.conversationHistory;
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
        this.logger.debug('Conversation history cleared');
    }

    /**
     * Get registered tools
     * @returns {Array} Tool list
     */
    getRegisteredTools() {
        return Array.from(this.tools.values());
    }
}

module.exports = { LangChainOrchestrator };