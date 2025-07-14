const { Logger } = require('../../utils/logger');
const { RetryHelper } = require('../../utils/retry');
const { Validator } = require('../../utils/validation');
const { KagentYAMLGenerator } = require('../../kagent/yaml-generator');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Core Integration Agent Class
 * Handles the main logic for transforming OpenAPI specs into Kubernetes agents
 */
class IntegrationAgent {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('IntegrationAgent');
        this.retryHelper = new RetryHelper();
        this.validator = new Validator();
        this.yamlGenerator = new KagentYAMLGenerator();
        
        // Agent storage
        this.agents = new Map();
        this.agentIdCounter = 0;
    }

    async initialize() {
        this.logger.info('Initializing Integration Agent...');
        
        try {
            // YAML generator doesn't need initialization
            
            // Verify required CLI tools
            await this.verifyDependencies();
            
            this.logger.success('Integration Agent initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Integration Agent:', error);
            throw error;
        }
    }

    /**
     * Verify required CLI dependencies
     */
    async verifyDependencies() {
        const requiredTools = ['kubeconform', 'conftest', 'kubectl'];
        
        for (const tool of requiredTools) {
            try {
                await this.executeCommand(tool, ['--version']);
                this.logger.debug(`✓ ${tool} is available`);
            } catch (error) {
                this.logger.warn(`⚠ ${tool} is not available - some features may be limited`);
            }
        }
    }

    /**
     * Generate Kubernetes manifests from OpenAPI specification
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} Generated manifests
     */
    async generateKubernetesManifests(options) {
        const { openAPISpec, pydanticModels, targetNamespace, deployConfig } = options;
        
        this.logger.info('Generating Kubernetes manifests...');
        
        try {
            // Create agent ID
            const agentId = `integration-agent-${++this.agentIdCounter}`;
            
            // Generate agent workflow from OpenAPI spec
            const agentWorkflow = await this.generateAgentWorkflow(openAPISpec, pydanticModels);
            
            // Generate Kubernetes manifests using existing YAML generator
            const manifests = await this.yamlGenerator.generate(agentWorkflow, {
                agentId,
                namespace: targetNamespace || 'default',
                deployConfig: deployConfig || {},
                labels: {
                    'autoweave.dev/agent-type': 'integration-agent',
                    'autoweave.dev/generated-from': 'openapi-spec'
                }
            });

            // Add integration-specific manifests
            const integrationManifests = await this.generateIntegrationManifests(agentId, openAPISpec, targetNamespace);
            
            const result = {
                agentId,
                manifests: {
                    ...manifests,
                    ...integrationManifests
                },
                workflow: agentWorkflow,
                metadata: {
                    openAPIVersion: openAPISpec.info?.version || 'unknown',
                    generatedAt: new Date().toISOString(),
                    targetNamespace
                }
            };

            // Store agent info
            this.agents.set(agentId, {
                ...result,
                status: 'generated',
                createdAt: new Date().toISOString()
            });

            this.logger.success('Kubernetes manifests generated successfully');
            return result;

        } catch (error) {
            this.logger.error('Failed to generate Kubernetes manifests:', error);
            throw error;
        }
    }

    /**
     * Generate agent workflow from OpenAPI specification
     * @param {Object} openAPISpec - OpenAPI specification
     * @param {Object} pydanticModels - Generated Pydantic models
     * @returns {Promise<Object>} Agent workflow
     */
    async generateAgentWorkflow(openAPISpec, pydanticModels) {
        const workflow = {
            name: `integration-agent-${openAPISpec.info?.title?.toLowerCase().replace(/\s+/g, '-') || 'api'}`,
            description: `Integration agent for ${openAPISpec.info?.title || 'API'} (${openAPISpec.info?.version || 'unknown'})`,
            steps: [],
            tools: [],
            environment: {},
            resources: {
                requests: {
                    cpu: '100m',
                    memory: '128Mi'
                },
                limits: {
                    cpu: '500m',
                    memory: '512Mi'
                }
            }
        };

        // Extract endpoints from OpenAPI spec
        if (openAPISpec.paths) {
            const endpoints = Object.keys(openAPISpec.paths);
            
            workflow.steps.push({
                name: 'initialize-api-client',
                description: 'Initialize API client with OpenAPI specification',
                action: 'setup',
                config: {
                    openapi_spec: openAPISpec,
                    base_url: openAPISpec.servers?.[0]?.url || 'https://api.example.com',
                    endpoints: endpoints
                }
            });

            // Add endpoint-specific steps
            for (const endpoint of endpoints.slice(0, 10)) { // Limit to first 10 endpoints
                const methods = Object.keys(openAPISpec.paths[endpoint]);
                
                for (const method of methods) {
                    workflow.steps.push({
                        name: `handle-${method}-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
                        description: `Handle ${method.toUpperCase()} requests to ${endpoint}`,
                        action: 'api-proxy',
                        config: {
                            method: method.toUpperCase(),
                            path: endpoint,
                            operation: openAPISpec.paths[endpoint][method]
                        }
                    });
                }
            }
        }

        // Add monitoring step
        workflow.steps.push({
            name: 'monitor-integration',
            description: 'Monitor integration health and metrics',
            action: 'monitor',
            config: {
                health_check_interval: '30s',
                metrics_endpoint: '/metrics',
                log_level: 'info'
            }
        });

        return workflow;
    }

    /**
     * Generate integration-specific manifests
     * @param {string} agentId - Agent ID
     * @param {Object} openAPISpec - OpenAPI specification
     * @param {string} targetNamespace - Target namespace
     * @returns {Promise<Object>} Integration manifests
     */
    async generateIntegrationManifests(agentId, openAPISpec, targetNamespace) {
        const manifests = {};

        // ConfigMap for OpenAPI spec
        manifests.configMap = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
                name: `${agentId}-openapi-spec`,
                namespace: targetNamespace || 'default',
                labels: {
                    'autoweave.dev/agent-id': agentId,
                    'autoweave.dev/component': 'openapi-spec'
                }
            },
            data: {
                'openapi.json': JSON.stringify(openAPISpec, null, 2)
            }
        };

        // Service for API proxy
        manifests.service = {
            apiVersion: 'v1',
            kind: 'Service',
            metadata: {
                name: `${agentId}-service`,
                namespace: targetNamespace || 'default',
                labels: {
                    'autoweave.dev/agent-id': agentId,
                    'autoweave.dev/component': 'api-proxy'
                }
            },
            spec: {
                selector: {
                    'autoweave.dev/agent-id': agentId
                },
                ports: [
                    {
                        name: 'http',
                        port: 8080,
                        targetPort: 8080
                    },
                    {
                        name: 'metrics',
                        port: 9090,
                        targetPort: 9090
                    }
                ]
            }
        };

        // ServiceMonitor for Prometheus
        manifests.serviceMonitor = {
            apiVersion: 'monitoring.coreos.com/v1',
            kind: 'ServiceMonitor',
            metadata: {
                name: `${agentId}-metrics`,
                namespace: targetNamespace || 'default',
                labels: {
                    'autoweave.dev/agent-id': agentId,
                    'autoweave.dev/component': 'metrics'
                }
            },
            spec: {
                selector: {
                    matchLabels: {
                        'autoweave.dev/agent-id': agentId
                    }
                },
                endpoints: [
                    {
                        port: 'metrics',
                        interval: '30s',
                        path: '/metrics'
                    }
                ]
            }
        };

        return manifests;
    }

    /**
     * Validate Kubernetes manifests
     * @param {Object} manifests - Manifests to validate
     * @returns {Promise<Object>} Validation results
     */
    async validateManifests(manifests) {
        this.logger.info('Validating Kubernetes manifests...');
        
        const validationResults = {
            kubeconform: { passed: false, errors: [] },
            conftest: { passed: false, errors: [] },
            kubectl: { passed: false, errors: [] }
        };

        try {
            // Create temporary directory for manifests
            const tempDir = path.join('/tmp', `autoweave-validation-${Date.now()}`);
            await fs.mkdir(tempDir, { recursive: true });

            // Write manifests to files
            const manifestFiles = [];
            for (const [name, manifest] of Object.entries(manifests.manifests || manifests)) {
                const filePath = path.join(tempDir, `${name}.yaml`);
                await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
                manifestFiles.push(filePath);
            }

            // Run kubeconform validation
            try {
                await this.executeCommand('kubeconform', ['-strict', '-summary', tempDir]);
                validationResults.kubeconform.passed = true;
                this.logger.success('✓ kubeconform validation passed');
            } catch (error) {
                validationResults.kubeconform.errors.push(error.message);
                this.logger.warn('⚠ kubeconform validation failed:', error.message);
            }

            // Run conftest validation
            try {
                await this.executeCommand('conftest', ['test', tempDir]);
                validationResults.conftest.passed = true;
                this.logger.success('✓ conftest validation passed');
            } catch (error) {
                validationResults.conftest.errors.push(error.message);
                this.logger.warn('⚠ conftest validation failed:', error.message);
            }

            // Run kubectl dry-run validation
            try {
                for (const file of manifestFiles) {
                    await this.executeCommand('kubectl', ['apply', '-f', file, '--dry-run=client']);
                }
                validationResults.kubectl.passed = true;
                this.logger.success('✓ kubectl dry-run validation passed');
            } catch (error) {
                validationResults.kubectl.errors.push(error.message);
                this.logger.warn('⚠ kubectl dry-run validation failed:', error.message);
            }

            // Cleanup
            await fs.rm(tempDir, { recursive: true, force: true });

            return validationResults;

        } catch (error) {
            this.logger.error('Validation failed:', error);
            throw error;
        }
    }

    /**
     * Execute shell command
     * @param {string} command - Command to execute
     * @param {Array} args - Command arguments
     * @returns {Promise<string>} Command output
     */
    async executeCommand(command, args) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Get agent status
     * @param {string} agentId - Agent ID
     * @returns {Promise<Object>} Agent status
     */
    async getStatus(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        return agent;
    }

    /**
     * List all agents
     * @returns {Promise<Array>} List of agents
     */
    async listAgents() {
        return Array.from(this.agents.values());
    }

    /**
     * Delete agent
     * @param {string} agentId - Agent ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Remove from storage
        this.agents.delete(agentId);

        return {
            success: true,
            agentId,
            deletedAt: new Date().toISOString()
        };
    }
}

module.exports = { IntegrationAgent };