const { Logger } = require('../utils/logger');
const yaml = require('yaml');

/**
 * KagentYAMLGenerator - Génère les manifestes YAML kagent à partir des workflows AutoWeave
 * Convertit les workflows AutoWeave en CRDs Kubernetes compatibles kagent
 */
class KagentYAMLGenerator {
    constructor() {
        this.logger = new Logger('KagentYAMLGenerator');
    }

    /**
     * Génère les manifestes kagent à partir d'un workflow AutoWeave
     */
    generateFromWorkflow(workflow) {
        this.logger.info(`Generating kagent YAML for workflow: ${workflow.name}`);
        
        try {
            // Sanitize name for Kubernetes compatibility
            const sanitizedName = this.sanitizeName(workflow.name);
            
            // Generate main agent CRD
            const agent = this.generateAgentCRD(workflow, sanitizedName);
            
            // Generate custom tools if needed
            const tools = this.generateCustomTools(workflow, sanitizedName);
            
            this.logger.success(`Generated kagent YAML for ${workflow.name}`);
            
            return {
                agent,
                tools
            };
            
        } catch (error) {
            this.logger.error('Failed to generate kagent YAML:', error);
            throw error;
        }
    }

    /**
     * Génère la CRD Agent principal
     */
    generateAgentCRD(workflow, sanitizedName) {
        const agent = {
            apiVersion: 'kagent.dev/v1alpha1',
            kind: 'Agent',
            metadata: {
                name: sanitizedName,
                namespace: 'default',
                labels: {
                    'autoweave.dev/generated': 'true',
                    'autoweave.dev/workflow-id': workflow.id,
                    'autoweave.dev/version': 'v1'
                },
                annotations: {
                    'autoweave.dev/original-name': workflow.name,
                    'autoweave.dev/description': workflow.description,
                    'autoweave.dev/created-at': new Date().toISOString()
                }
            },
            spec: {
                description: workflow.description,
                systemMessage: this.generateSystemPrompt(workflow),
                tools: this.mapWorkflowToolsAsObjects(workflow),
                modelConfig: 'default-model-config',  // Reference to a ModelConfig resource
                stream: false
            }
        };

        return agent;
    }

    /**
     * Génère le prompt système pour l'agent
     */
    generateSystemPrompt(workflow) {
        const basePrompt = `You are an autonomous AI agent created by AutoWeave.

Name: ${workflow.name}
Description: ${workflow.description}

Your capabilities include:
${workflow.requiredModules.map(module => `- ${module.name}: ${module.description}`).join('\n')}

Your workflow steps:
${workflow.steps.map((step, index) => `${index + 1}. ${step.action}: ${step.description}`).join('\n')}

Always be helpful, accurate, and follow the workflow steps systematically.
Use the available tools to accomplish your tasks effectively.
Report your progress and any issues encountered.`;

        return basePrompt;
    }

    /**
     * Mappe les modules de workflow aux outils kagent
     */
    mapWorkflowTools(workflow) {
        const tools = [];
        
        workflow.requiredModules.forEach(module => {
            switch (module.type) {
                case 'file_system':
                    tools.push('file-reader', 'file-writer');
                    break;
                case 'kubernetes':
                    tools.push('kubectl', 'k8s-logs', 'k8s-status');
                    break;
                case 'coding_assistant':
                    tools.push('code-analyzer', 'code-generator');
                    break;
                case 'monitoring':
                    tools.push('metrics-collector', 'alert-manager');
                    break;
                case 'mcp_server':
                    // Custom MCP server - will be handled in generateCustomTools
                    tools.push(`mcp-${this.sanitizeName(module.name)}`);
                    break;
                default:
                    tools.push(this.sanitizeName(module.name));
            }
        });

        return [...new Set(tools)]; // Remove duplicates
    }

    /**
     * Mappe les modules de workflow aux outils kagent en tant qu'objets
     */
    mapWorkflowToolsAsObjects(workflow) {
        const toolNames = this.mapWorkflowTools(workflow);
        
        // Convert tool names to objects as expected by kagent
        // kagent expects: type + mcpServer/agent object
        return toolNames.map(toolName => ({
            type: 'McpServer',
            mcpServer: {
                url: `http://mcp-server:3000/tools/${toolName}`,
                timeout: 30000
            }
        }));
    }

    /**
     * Détermine le type d'outil basé sur son nom
     */
    getToolType(toolName) {
        // kagent only supports "McpServer" or "Agent" types
        if (toolName.startsWith('mcp-')) {
            return 'McpServer';
        }
        
        // All other tools should be MCP servers
        return 'McpServer';
    }

    /**
     * Génère les outils personnalisés si nécessaire
     */
    generateCustomTools(workflow, sanitizedName) {
        const customTools = [];

        workflow.requiredModules.forEach(module => {
            if (module.type === 'mcp_server' && module.custom) {
                const toolName = `${sanitizedName}-${this.sanitizeName(module.name)}`;
                
                const customTool = {
                    apiVersion: 'kagent.dev/v1alpha1',
                    kind: 'Tool',
                    metadata: {
                        name: toolName,
                        namespace: 'default',
                        labels: {
                            'autoweave.dev/generated': 'true',
                            'autoweave.dev/workflow-id': workflow.id,
                            'autoweave.dev/tool-type': 'mcp_server'
                        }
                    },
                    spec: {
                        type: 'mcp_server',
                        description: module.description || `Custom MCP server for ${module.name}`,
                        mcpServer: {
                            url: module.url || 'http://localhost:3000',
                            timeout: 30000,
                            retryCount: 3
                        },
                        capabilities: module.capabilities || ['custom']
                    }
                };

                customTools.push(customTool);
            }
        });

        return customTools;
    }

    /**
     * Sanitise un nom pour la compatibilité Kubernetes
     */
    sanitizeName(name) {
        return name.toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-')     // Replace invalid chars with dash
                  .replace(/-+/g, '-')             // Replace multiple dashes with single
                  .replace(/^-|-$/g, '')           // Remove leading/trailing dashes
                  .substring(0, 63);               // Kubernetes limit
    }

    /**
     * Valide un nom Kubernetes
     */
    validateKubernetesName(name) {
        const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
        return k8sNameRegex.test(name) && name.length <= 63;
    }

    /**
     * Génère le YAML complet pour le déploiement
     */
    generateDeploymentYAML(workflow) {
        const result = this.generateFromWorkflow(workflow);
        
        let yamlContent = '---\n';
        yamlContent += yaml.stringify(result.agent);
        
        if (result.tools && result.tools.length > 0) {
            result.tools.forEach(tool => {
                yamlContent += '\n---\n';
                yamlContent += yaml.stringify(tool);
            });
        }
        
        return yamlContent;
    }

    /**
     * Génère des ressources de monitoring
     */
    generateMonitoringResources(workflow, sanitizedName) {
        const serviceMonitor = {
            apiVersion: 'monitoring.coreos.com/v1',
            kind: 'ServiceMonitor',
            metadata: {
                name: `${sanitizedName}-monitor`,
                namespace: 'default',
                labels: {
                    'autoweave.dev/generated': 'true',
                    'autoweave.dev/workflow-id': workflow.id
                }
            },
            spec: {
                selector: {
                    matchLabels: {
                        'autoweave.dev/workflow-id': workflow.id
                    }
                },
                endpoints: [{
                    port: 'metrics',
                    interval: '30s',
                    path: '/metrics'
                }]
            }
        };

        return [serviceMonitor];
    }

    /**
     * Génère les politiques de sécurité
     */
    generateSecurityPolicies(workflow, sanitizedName) {
        const networkPolicy = {
            apiVersion: 'networking.k8s.io/v1',
            kind: 'NetworkPolicy',
            metadata: {
                name: `${sanitizedName}-network-policy`,
                namespace: 'default',
                labels: {
                    'autoweave.dev/generated': 'true',
                    'autoweave.dev/workflow-id': workflow.id
                }
            },
            spec: {
                podSelector: {
                    matchLabels: {
                        'autoweave.dev/workflow-id': workflow.id
                    }
                },
                policyTypes: ['Ingress', 'Egress'],
                ingress: [{
                    from: [{
                        namespaceSelector: {
                            matchLabels: {
                                name: 'kagent-system'
                            }
                        }
                    }]
                }],
                egress: [{
                    to: [],
                    ports: [{
                        protocol: 'TCP',
                        port: 443
                    }, {
                        protocol: 'TCP',
                        port: 80
                    }]
                }]
            }
        };

        return [networkPolicy];
    }

    /**
     * Valide la structure d'un workflow
     */
    validateWorkflow(workflow) {
        const requiredFields = ['id', 'name', 'description', 'requiredModules'];
        
        for (const field of requiredFields) {
            if (!workflow[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!Array.isArray(workflow.requiredModules) || workflow.requiredModules.length === 0) {
            throw new Error('Workflow must have at least one required module');
        }

        // Validate each module
        workflow.requiredModules.forEach((module, index) => {
            if (!module.name || !module.type) {
                throw new Error(`Module ${index} missing required fields: name, type`);
            }
        });

        // Validate Kubernetes name compatibility
        const sanitizedName = this.sanitizeName(workflow.name);
        if (!this.validateKubernetesName(sanitizedName)) {
            throw new Error(`Workflow name "${workflow.name}" cannot be converted to valid Kubernetes name`);
        }

        this.logger.info(`Workflow validation passed for: ${workflow.name}`);
        return true;
    }

    /**
     * Génère un manifeste complet avec toutes les ressources
     */
    generateCompleteManifest(workflow) {
        // Validate workflow first
        this.validateWorkflow(workflow);
        
        const sanitizedName = this.sanitizeName(workflow.name);
        const result = this.generateFromWorkflow(workflow);
        
        // Add monitoring resources
        const monitoringResources = this.generateMonitoringResources(workflow, sanitizedName);
        
        // Add security policies
        const securityPolicies = this.generateSecurityPolicies(workflow, sanitizedName);
        
        return {
            agent: result.agent,
            tools: result.tools,
            monitoring: monitoringResources,
            security: securityPolicies
        };
    }
}

module.exports = { KagentYAMLGenerator };