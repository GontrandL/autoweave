import OpenAI from 'openai';
import SwaggerParser from '@apidevtools/swagger-parser';
import { 
    AgentWeaverConfig, 
    Workflow,
    ModelConfig, 
    ProcessMessageResponse, 
    ProcessMessageOptions,
    OpenAPISpec,
    OpenAPICapabilities,
    GenerateOpenAPIOptions
} from './types';

import { Logger } from './logger';

export class AgentWeaver {
    private config: AgentWeaverConfig;
    private logger: any;
    private openai: OpenAI;
    private mockMode: boolean = false;
    // private ajv: Ajv;
    private availableModels: ModelConfig[] = [
        {
            name: 'gpt-4-turbo-preview',
            context_window: 128000,
            capabilities: ['function_calling', 'json_mode', 'vision']
        },
        {
            name: 'gpt-3.5-turbo',
            context_window: 16385,
            capabilities: ['function_calling', 'json_mode']
        },
        {
            name: 'anthropic/claude-3-opus',
            context_window: 200000,
            capabilities: ['xml_tags', 'long_context']
        }
    ];

    constructor(config: AgentWeaverConfig) {
        this.config = config;
        this.logger = config.logger || new Logger('AgentWeaver');
        // this.ajv = new Ajv({ strict: false });
        
        // Support multiple AI providers
        if (!config.openaiApiKey) {
            throw new Error('OpenAI API key is required');
        }
        
        this.openai = new OpenAI({
            apiKey: config.openaiApiKey
        });
    }

    async initialize(): Promise<void> {
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
            this.logger.info('OpenAI connection verified');
        } catch (error) {
            this.logger.error('Failed to connect to OpenAI:', error);
            throw error;
        }
    }

    async generateWorkflow(description: string, options: any = {}): Promise<Workflow> {
        this.logger.info('Generating workflow from description:', description);
        
        if (this.mockMode) {
            return this.generateMockWorkflow(description);
        }
        
        const prompt = `Generate a Kubernetes-based agent workflow for the following requirement:
"${description}"

The workflow should include:
1. Required environment variables
2. Kubernetes resources (deployments, services, configmaps)
3. Step-by-step execution plan
4. Required npm packages or container images

Respond in JSON format with this structure:
{
  "name": "agent-name",
  "description": "Brief description",
  "steps": [
    {
      "name": "step-name",
      "action": "action-type",
      "params": {},
      "dependsOn": []
    }
  ],
  "requirements": ["list of requirements"],
  "environment": {
    "KEY": "value"
  },
  "modules": [
    {
      "name": "module-name",
      "version": "version",
      "config": {}
    }
  ]
}`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.config.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating Kubernetes-based agent workflows. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            });

            const workflow = JSON.parse(completion.choices[0].message.content || '{}') as Workflow;
            
            // Validate and enhance workflow
            workflow.name = workflow.name || this.generateAgentName(description);
            workflow.steps = workflow.steps || [];
            workflow.requirements = workflow.requirements || [];
            workflow.environment = workflow.environment || {};
            workflow.modules = workflow.modules || [];
            
            // Add memory integration if requested
            if (options.includeMemory !== false) {
                workflow.modules.push({
                    name: '@autoweave/memory',
                    version: 'latest',
                    config: {
                        type: 'hybrid',
                        vectorStore: 'qdrant',
                        graphStore: 'memgraph'
                    }
                });
            }
            
            this.logger.info('Generated workflow:', workflow.name);
            return workflow;
            
        } catch (error) {
            this.logger.error('Failed to generate workflow:', error);
            throw error;
        }
    }

    async processMessage(
        message: string, 
        options: ProcessMessageOptions = {}
    ): Promise<ProcessMessageResponse> {
        try {
            const messages: any[] = [
                {
                    role: 'system',
                    content: options.system_prompt || 'You are a helpful AI assistant integrated with AutoWeave.'
                }
            ];
            
            // Add context from memory if available
            if (options.context) {
                messages.push(...options.context);
            }
            
            // Add user message
            messages.push({
                role: 'user',
                content: message
            });
            
            // Process with OpenAI
            const completion = await this.openai.chat.completions.create({
                model: options.model || this.config.model || 'gpt-3.5-turbo',
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.max_tokens || 1000,
                stream: false
            });
            
            const response = completion.choices[0].message.content || '';
            
            return {
                success: true,
                response,
                metadata: {
                    model: completion.model,
                    usage: completion.usage
                },
                tokens: completion.usage ? {
                    input: completion.usage.prompt_tokens,
                    output: completion.usage.completion_tokens,
                    total: completion.usage.total_tokens
                } : undefined
            };
            
        } catch (error: any) {
            this.logger.error('Failed to process message:', error);
            return {
                success: false,
                error: error.message,
                response: 'I encountered an error processing your message.'
            };
        }
    }

    async generateOpenAPISpec(
        agentDescription: string, 
        capabilities: string[], 
        options: GenerateOpenAPIOptions = {}
    ): Promise<OpenAPISpec> {
        const prompt = `Generate an OpenAPI 3.1 specification for an AI agent with the following description:
"${agentDescription}"

Capabilities: ${capabilities.join(', ')}

The API should follow ANP (Agent Network Protocol) standards and include:
1. Standard agent endpoints (/agent/info, /agent/process, /agent/health)
2. Capability-specific endpoints
3. Proper authentication schemes
4. Request/response schemas

Respond with a valid OpenAPI 3.1 JSON specification.`;

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.config.model || 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert at creating OpenAPI specifications for AI agents. Always respond with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.3,
                max_tokens: 4000,
                stream: false
            });

            const spec = JSON.parse(completion.choices[0].message.content || '{}') as OpenAPISpec;
            
            // Enhance with defaults
            spec.openapi = spec.openapi || '3.1.0';
            spec.info = spec.info || {
                title: this.generateAgentName(agentDescription),
                version: options.version || '1.0.0',
                description: agentDescription
            };
            
            spec.servers = spec.servers || [{
                url: options.baseUrl || 'http://localhost:3000',
                description: 'Local development server'
            }];
            
            // Validate with swagger-parser
            const parser = new SwaggerParser();
            await parser.validate(spec as any);
            
            return spec;
            
        } catch (error) {
            this.logger.error('Failed to generate OpenAPI spec:', error);
            throw error;
        }
    }

    async analyzeCapabilities(openApiSpec: OpenAPISpec): Promise<OpenAPICapabilities> {
        const capabilities: OpenAPICapabilities = {
            paths: [],
            methods: [],
            security: [],
            contentTypes: [],
            features: []
        };
        
        // Extract paths
        capabilities.paths = Object.keys(openApiSpec.paths || {});
        
        // Extract methods
        const methods = new Set<string>();
        Object.values(openApiSpec.paths || {}).forEach((pathItem: any) => {
            Object.keys(pathItem).forEach(method => {
                if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
                    methods.add(method.toUpperCase());
                }
            });
        });
        capabilities.methods = Array.from(methods);
        
        // Extract security schemes
        if (openApiSpec.components?.securitySchemes) {
            capabilities.security = Object.keys(openApiSpec.components.securitySchemes);
        }
        
        // Detect features
        if (capabilities.paths.some(p => p.includes('websocket'))) {
            capabilities.features.push('websocket');
        }
        if (capabilities.paths.some(p => p.includes('stream'))) {
            capabilities.features.push('streaming');
        }
        
        return capabilities;
    }

    selectModel(requirements: { contextLength?: number; capabilities?: string[] }): ModelConfig {
        const { contextLength = 0, capabilities = [] } = requirements;
        
        // Find models that meet requirements
        const suitableModels = this.availableModels.filter(model => {
            if (model.context_window < contextLength) return false;
            if (capabilities.some(cap => !model.capabilities.includes(cap))) return false;
            return true;
        });
        
        // Return the most capable model that meets requirements
        return suitableModels[0] || this.availableModels[0];
    }

    private generateAgentName(description: string): string {
        // Generate a kebab-case name from description
        return description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50);
    }

    private generateMockWorkflow(description: string): Workflow {
        return {
            name: this.generateAgentName(description),
            description: `Mock workflow for: ${description}`,
            steps: [
                {
                    name: 'initialize',
                    action: 'setup',
                    params: { mock: true }
                }
            ],
            requirements: ['mock-requirement'],
            environment: { MOCK: 'true' },
            modules: []
        };
    }
}