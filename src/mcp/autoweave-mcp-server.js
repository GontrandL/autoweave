const { Logger } = require('../utils/logger');
const express = require('express');
const { ConfigurationIntelligence } = require('../core/config-intelligence');
const { FreshSourcesService } = require('../services/fresh-sources-service');

/**
 * AutoWeaveMCPServer - Expose les capacités d'AutoWeave via Model Context Protocol
 * Implémente la spécification MCP pour permettre aux LLMs d'utiliser AutoWeave
 */
class AutoWeaveMCPServer {
    constructor(config, autoweaveInstance) {
        this.logger = new Logger('AutoWeaveMCPServer');
        this.config = config;
        this.autoweave = autoweaveInstance;
        this.app = express();
        this.app.use(express.json());
        
        // Services
        this.freshSources = new FreshSourcesService(config);
        this.configIntelligence = null; // Initialized after autoweave
        
        // MCP Metadata
        this.serverInfo = {
            name: 'autoweave-mcp-server',
            version: '1.0.0',
            description: 'AutoWeave Configuration Intelligence via MCP',
            capabilities: {
                tools: true,
                resources: true,
                prompts: true
            }
        };
        
        // Tool definitions conforming to MCP spec
        this.tools = {
            'create-config': {
                description: 'Generate intelligent configuration from natural language intent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        intent: {
                            type: 'string',
                            description: 'Natural language description of desired configuration'
                        },
                        options: {
                            type: 'object',
                            properties: {
                                platform: { type: 'string', enum: ['kubernetes', 'docker-compose', 'helm'] },
                                namespace: { type: 'string' },
                                includeObservability: { type: 'boolean' }
                            }
                        }
                    },
                    required: ['intent']
                }
            },
            
            'find-fresh-sources': {
                description: 'Find latest versions of packages across registries',
                inputSchema: {
                    type: 'object',
                    properties: {
                        packages: {
                            type: 'object',
                            properties: {
                                docker: { type: 'array', items: { type: 'string' } },
                                npm: { type: 'array', items: { type: 'string' } },
                                helm: { type: 'array', items: { type: 'string' } },
                                github: { type: 'array', items: { type: 'string' } }
                            }
                        }
                    },
                    required: ['packages']
                }
            },
            
            'search-package': {
                description: 'Search for packages across multiple registries',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Package name or search term'
                        },
                        registries: {
                            type: 'array',
                            items: { type: 'string', enum: ['docker', 'npm', 'helm', 'github'] }
                        }
                    },
                    required: ['query']
                }
            },
            
            'check-outdated': {
                description: 'Check if a package version is outdated',
                inputSchema: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['docker', 'npm', 'helm'] },
                        name: { type: 'string' },
                        currentVersion: { type: 'string' }
                    },
                    required: ['type', 'name', 'currentVersion']
                }
            },
            
            'generate-gitops': {
                description: 'Generate GitOps-ready configuration with best practices',
                inputSchema: {
                    type: 'object',
                    properties: {
                        application: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                type: { type: 'string' },
                                components: { type: 'array', items: { type: 'string' } }
                            }
                        },
                        gitops: {
                            type: 'object',
                            properties: {
                                repository: { type: 'string' },
                                branch: { type: 'string' },
                                path: { type: 'string' }
                            }
                        }
                    },
                    required: ['application']
                }
            }
        };
        
        // Resource definitions
        this.resources = {
            'configuration-templates': {
                description: 'Available configuration templates',
                mimeType: 'application/json'
            },
            'fresh-sources-cache': {
                description: 'Cached latest versions information',
                mimeType: 'application/json'
            }
        };
        
        // Prompts for common use cases
        this.prompts = {
            'setup-dev-environment': {
                description: 'Set up a complete development environment',
                template: 'Create a development environment with {ide}, {language} support, and {tools}. Include debugging capabilities and hot reload.'
            },
            'deploy-application': {
                description: 'Deploy an application with best practices',
                template: 'Deploy {application} to {platform} with high availability, monitoring, and automatic scaling. Use latest stable versions.'
            }
        };
    }

    /**
     * Initialize MCP server
     */
    async initialize() {
        this.logger.info('Initializing AutoWeave MCP Server...');
        
        // Initialize config intelligence after autoweave is ready
        if (this.autoweave?.agentWeaver && this.autoweave?.memoryManager) {
            this.configIntelligence = new ConfigurationIntelligence(
                this.config,
                this.autoweave.agentWeaver,
                this.autoweave.memoryManager
            );
        }
        
        // Set up MCP routes
        this.setupRoutes();
        
        this.logger.success('AutoWeave MCP Server initialized');
    }

    /**
     * Set up MCP protocol routes
     */
    setupRoutes() {
        // MCP Discovery endpoint
        this.app.get('/mcp/v1', (req, res) => {
            res.json({
                protocol: 'mcp/v1',
                server: this.serverInfo,
                capabilities: this.serverInfo.capabilities
            });
        });
        
        // List available tools
        this.app.get('/mcp/v1/tools', (req, res) => {
            res.json({
                tools: Object.entries(this.tools).map(([name, tool]) => ({
                    name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                }))
            });
        });
        
        // Execute tool
        this.app.post('/mcp/v1/tools/:toolName', async (req, res) => {
            const { toolName } = req.params;
            const input = req.body;
            
            try {
                const result = await this.executeTool(toolName, input);
                res.json({
                    success: true,
                    result
                });
            } catch (error) {
                this.logger.error(`Tool execution failed for ${toolName}:`, error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // List resources
        this.app.get('/mcp/v1/resources', (req, res) => {
            res.json({
                resources: Object.entries(this.resources).map(([name, resource]) => ({
                    name,
                    description: resource.description,
                    mimeType: resource.mimeType
                }))
            });
        });
        
        // Get resource
        this.app.get('/mcp/v1/resources/:resourceName', async (req, res) => {
            const { resourceName } = req.params;
            
            try {
                const content = await this.getResource(resourceName);
                res.json({
                    name: resourceName,
                    content
                });
            } catch (error) {
                res.status(404).json({
                    error: `Resource not found: ${resourceName}`
                });
            }
        });
        
        // List prompts
        this.app.get('/mcp/v1/prompts', (req, res) => {
            res.json({
                prompts: Object.entries(this.prompts).map(([name, prompt]) => ({
                    name,
                    description: prompt.description,
                    template: prompt.template
                }))
            });
        });
    }

    /**
     * Execute MCP tool
     */
    async executeTool(toolName, input) {
        this.logger.info(`Executing MCP tool: ${toolName}`);
        
        switch (toolName) {
            case 'create-config':
                if (!this.configIntelligence) {
                    throw new Error('Configuration Intelligence not initialized');
                }
                return await this.configIntelligence.generateConfiguration(
                    input.intent,
                    input.options || {}
                );
                
            case 'find-fresh-sources':
                return await this.freshSources.findLatestVersions(input.packages);
                
            case 'search-package':
                const searchOptions = {};
                if (input.registries) {
                    // Convert registries array to include flags
                    input.registries.forEach(reg => {
                        searchOptions[`include${reg.charAt(0).toUpperCase() + reg.slice(1)}`] = true;
                    });
                }
                return await this.freshSources.searchPackage(input.query, searchOptions);
                
            case 'check-outdated':
                return await this.freshSources.checkIfOutdated(
                    input.type,
                    input.name,
                    input.currentVersion
                );
                
            case 'generate-gitops':
                return await this.generateGitOpsConfig(input);
                
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    /**
     * Get MCP resource
     */
    async getResource(resourceName) {
        switch (resourceName) {
            case 'configuration-templates':
                return this.getConfigurationTemplates();
                
            case 'fresh-sources-cache':
                return this.getFreshSourcesCache();
                
            default:
                throw new Error(`Unknown resource: ${resourceName}`);
        }
    }

    /**
     * Get available configuration templates
     */
    getConfigurationTemplates() {
        return {
            templates: [
                {
                    name: 'kubernetes-deployment',
                    description: 'Standard Kubernetes deployment with service',
                    variables: ['appName', 'image', 'port', 'replicas']
                },
                {
                    name: 'docker-compose-stack',
                    description: 'Docker Compose application stack',
                    variables: ['services', 'networks', 'volumes']
                },
                {
                    name: 'helm-chart',
                    description: 'Helm chart with standard structure',
                    variables: ['chartName', 'version', 'values']
                },
                {
                    name: 'gitops-application',
                    description: 'ArgoCD/Flux application manifest',
                    variables: ['appName', 'repo', 'path', 'targetRevision']
                }
            ]
        };
    }

    /**
     * Get cached fresh sources information
     */
    async getFreshSourcesCache() {
        // In a real implementation, this would return cached data
        return {
            cached: false,
            message: 'Fresh sources are fetched on demand'
        };
    }

    /**
     * Generate GitOps configuration
     */
    async generateGitOpsConfig(input) {
        const { application, gitops = {} } = input;
        
        // Find fresh versions for components
        const components = {
            docker: application.components || []
        };
        const freshVersions = await this.freshSources.findLatestVersions(components);
        
        // Generate GitOps structure
        const config = {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            metadata: {
                name: application.name,
                namespace: 'argocd',
                labels: {
                    'autoweave.io/generated': 'true',
                    'autoweave.io/type': application.type
                }
            },
            spec: {
                project: 'default',
                source: {
                    repoURL: gitops.repository || 'https://github.com/your-org/your-gitops-repo',
                    targetRevision: gitops.branch || 'main',
                    path: gitops.path || `apps/${application.name}`
                },
                destination: {
                    server: 'https://kubernetes.default.svc',
                    namespace: application.namespace || 'default'
                },
                syncPolicy: {
                    automated: {
                        prune: true,
                        selfHeal: true
                    },
                    syncOptions: [
                        'CreateNamespace=true'
                    ]
                }
            }
        };
        
        // Generate manifests
        const manifests = {
            'application.yaml': config,
            'kustomization.yaml': {
                apiVersion: 'kustomize.config.k8s.io/v1beta1',
                kind: 'Kustomization',
                resources: application.components.map(c => `${c}.yaml`)
            }
        };
        
        // Add component manifests with fresh versions
        for (const component of application.components) {
            const version = freshVersions.docker[component]?.latest || 'latest';
            manifests[`${component}.yaml`] = {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: {
                    name: component.split('/').pop(),
                    labels: {
                        app: component.split('/').pop(),
                        version: version
                    }
                },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: {
                            app: component.split('/').pop()
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: component.split('/').pop()
                            }
                        },
                        spec: {
                            containers: [{
                                name: component.split('/').pop(),
                                image: `${component}:${version}`,
                                ports: [{
                                    containerPort: 8080
                                }]
                            }]
                        }
                    }
                }
            };
        }
        
        return {
            gitops: config,
            manifests,
            versions: freshVersions,
            instructions: [
                `1. Create directory: ${gitops.path || `apps/${application.name}`}`,
                '2. Save each manifest to its respective file',
                '3. Commit and push to your GitOps repository',
                '4. Apply the application.yaml to your ArgoCD instance'
            ]
        };
    }

    /**
     * Start MCP server
     */
    start(port) {
        const mcpPort = port || this.config.mcpPort || 3002;
        
        this.app.listen(mcpPort, () => {
            this.logger.success(`AutoWeave MCP Server listening on port ${mcpPort}`);
            this.logger.info(`MCP endpoint: http://localhost:${mcpPort}/mcp/v1`);
        });
    }
}

module.exports = { AutoWeaveMCPServer };