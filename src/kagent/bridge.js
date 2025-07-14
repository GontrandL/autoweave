const k8s = require('@kubernetes/client-node');
const yaml = require('yaml');
const { Logger } = require('../utils/logger');
const { RetryHelper } = require('../utils/retry');
const { ValidationError } = require('../utils/validation');
const { KagentYAMLGenerator } = require('./yaml-generator');

class KagentError extends Error {
    constructor(message, code = 'KAGENT_ERROR', details = null) {
        super(message);
        this.name = 'KagentError';
        this.code = code;
        this.details = details;
    }
}

class KagentBridge {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('KagentBridge');

        // Kubernetes client setup with error handling
        this.kc = new k8s.KubeConfig();
        try {
            if (config.kubernetes?.inCluster) {
                this.kc.loadFromCluster();
            } else {
                this.kc.loadFromDefault();
            }
        } catch (error) {
            // In test environment, use mock configuration
            if (process.env.NODE_ENV === 'test') {
                this.logger.warn('Using mock Kubernetes configuration for tests');
                this.mockMode = true;
            } else {
                throw new KagentError('Failed to load Kubernetes configuration', 'K8S_CONFIG_ERROR', error);
            }
        }

        // Initialize APIs (or mocks in test mode)
        if (this.mockMode) {
            this.k8sApi = this.createMockApi();
            this.coreApi = this.createMockCoreApi();
            this.appsApi = this.createMockAppsApi();
        } else {
            this.k8sApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
            this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
            this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
        }

        // YAML generator
        this.yamlGenerator = new KagentYAMLGenerator();

        // State
        this.deployedAgents = new Map();
        this.availableTools = [];
        this.isInitialized = false;
    }

    async initialize() {
        this.logger.info('Initializing kagent bridge...');

        try {
            // Verify kagent is installed with retries
            await RetryHelper.withRetry(
                () => this.verifyKagentInstallation(),
                {
                    maxAttempts: 3,
                    delay: 2000,
                    shouldRetry: (error) => error.code !== 'KAGENT_NOT_INSTALLED'
                }
            );

            // Discover available kagent tools
            await this.discoverKagentTools();

            // Setup monitoring
            await this.setupMonitoring();

            this.isInitialized = true;
            this.logger.success('kagent bridge initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize kagent bridge:', error);
            throw error;
        }
    }

    async verifyKagentInstallation() {
        try {
            // Check CRDs
            const crdApi = this.mockMode ? this.createMockCrdApi() : this.kc.makeApiClient(k8s.ApiextensionsV1Api);
            const crds = await crdApi.listCustomResourceDefinition();

            const kagentCRDs = crds.body.items.filter(crd =>
                crd.metadata.name.includes('kagent.dev')
            );

            if (kagentCRDs.length === 0) {
                throw new KagentError(
                    'kagent CRDs not found. Please install kagent first: kagent install',
                    'KAGENT_NOT_INSTALLED'
                );
            }

            this.logger.info(`Found ${kagentCRDs.length} kagent CRDs`);

            // Check namespace
            const namespaces = await this.coreApi.listNamespace();
            const kagentNS = namespaces.body.items.find(ns =>
                ns.metadata.name === (this.config.systemNamespace || 'kagent-system')
            );

            if (!kagentNS) {
                throw new KagentError(
                    `${this.config.systemNamespace || 'kagent-system'} namespace not found`,
                    'KAGENT_NAMESPACE_MISSING'
                );
            }

            // Check kagent controller pod
            const systemNamespace = this.config.systemNamespace || 'kagent-system';
            const pods = await this.coreApi.listNamespacedPod(systemNamespace);
            const controllerPod = pods.body.items.find(pod =>
                pod.metadata.labels?.['app.kubernetes.io/name'] === 'kagent' ||
                pod.metadata.labels?.app === 'kagent-controller' ||
                pod.metadata.name?.startsWith('kagent')
            );

            if (!controllerPod || controllerPod.status.phase !== 'Running') {
                throw new KagentError(
                    'kagent controller not running',
                    'KAGENT_CONTROLLER_NOT_READY'
                );
            }

            this.logger.success('kagent installation verified');

        } catch (error) {
            if (error instanceof KagentError) {
                throw error;
            }

            this.logger.error('Error verifying kagent installation:', error);
            throw new KagentError(
                'Failed to verify kagent installation',
                'KAGENT_VERIFICATION_FAILED',
                error
            );
        }
    }

    async discoverKagentTools() {
        try {
            this.logger.info('Discovering kagent tools...');

            const tools = await RetryHelper.withRetry(
                () => this.k8sApi.listNamespacedCustomObject(
                    'kagent.dev',
                    'v1alpha1',
                    this.config.namespace,
                    'tools'
                ),
                { maxAttempts: 3, delay: 1000 }
            );

            this.availableTools = tools.body.items || [];
            this.logger.info(`Discovered ${this.availableTools.length} kagent tools`);

            // Log available tools with details
            this.availableTools.forEach(tool => {
                this.logger.debug(`Tool: ${tool.metadata.name}`, {
                    description: tool.spec.description,
                    type: tool.spec.type,
                    status: tool.status?.phase
                });
            });

            // Create tool capability map
            this.toolCapabilities = this.createToolCapabilityMap();

        } catch (error) {
            this.logger.warn('Could not discover kagent tools:', error.message);
            this.availableTools = [];
            this.toolCapabilities = new Map();
        }
    }

    createToolCapabilityMap() {
        const capabilityMap = new Map();

        this.availableTools.forEach(tool => {
            const capabilities = [
                tool.metadata.name,
                ...(tool.spec.capabilities || []),
                ...(tool.metadata.labels ? Object.values(tool.metadata.labels) : [])
            ].map(cap => cap.toLowerCase());

            capabilities.forEach(capability => {
                if (!capabilityMap.has(capability)) {
                    capabilityMap.set(capability, []);
                }
                capabilityMap.get(capability).push(tool.metadata.name);
            });
        });

        return capabilityMap;
    }

    async deployAgent(agentWorkflow) {
        if (!this.isInitialized) {
            throw new KagentError('kagent bridge not initialized', 'NOT_INITIALIZED');
        }

        this.logger.info(`Deploying agent: ${agentWorkflow.name}`);

        try {
            // Validate workflow
            this.validateWorkflow(agentWorkflow);

            // Generate kagent YAML
            const kagentYAML = this.yamlGenerator.generateFromWorkflow(agentWorkflow);

            // Deploy with transaction-like behavior
            const deployedResources = [];

            try {
                // Deploy custom tools first
                for (const tool of kagentYAML.tools || []) {
                    const toolResult = await this.k8sApi.createNamespacedCustomObject(
                        'kagent.dev',
                        'v1alpha1',
                        this.config.namespace,
                        'tools',
                        tool
                    );
                    deployedResources.push({
                        type: 'tool',
                        name: tool.metadata.name,
                        resource: toolResult.body
                    });
                    this.logger.debug(`Deployed tool: ${tool.metadata.name}`);
                }

                // Deploy agent
                const agentResult = await this.k8sApi.createNamespacedCustomObject(
                    'kagent.dev',
                    'v1alpha1',
                    this.config.namespace,
                    'agents',
                    kagentYAML.agent
                );
                deployedResources.push({
                    type: 'agent',
                    name: kagentYAML.agent.metadata.name,
                    resource: agentResult.body
                });

                // Track deployment
                const deployedAgent = {
                    name: agentWorkflow.name,
                    kagentName: kagentYAML.agent.metadata.name,
                    namespace: this.config.namespace,
                    status: 'deploying',
                    createdAt: new Date(),
                    resources: deployedResources,
                    workflow: agentWorkflow
                };

                this.deployedAgents.set(agentWorkflow.id, deployedAgent);

                this.logger.success(`Agent ${agentWorkflow.name} deployed to kagent`);
                return deployedAgent;

            } catch (deployError) {
                // Rollback on failure
                this.logger.warn('Deployment failed, rolling back...');
                await this.rollbackDeployment(deployedResources);
                throw deployError;
            }

        } catch (error) {
            this.logger.error(`Failed to deploy agent ${agentWorkflow.name}:`, error);

            if (error.response?.body) {
                throw new KagentError(
                    `Kubernetes API error: ${error.response.body.message}`,
                    'K8S_API_ERROR',
                    error.response.body
                );
            }

            throw error;
        }
    }

    validateWorkflow(workflow) {
        if (!workflow.id || !workflow.name) {
            throw new ValidationError('Workflow must have id and name');
        }

        if (!workflow.requiredModules || workflow.requiredModules.length === 0) {
            throw new ValidationError('Workflow must have at least one required module');
        }

        // Validate Kubernetes name compatibility
        const k8sName = this.yamlGenerator.sanitizeName(workflow.name);
        if (k8sName.length === 0) {
            throw new ValidationError('Workflow name cannot be converted to valid Kubernetes name');
        }
    }

    async rollbackDeployment(deployedResources) {
        for (const resource of deployedResources.reverse()) {
            try {
                await this.k8sApi.deleteNamespacedCustomObject(
                    'kagent.dev',
                    'v1alpha1',
                    this.config.namespace,
                    `${resource.type}s`, // tools or agents
                    resource.name
                );
                this.logger.debug(`Rolled back ${resource.type}: ${resource.name}`);
            } catch (error) {
                this.logger.warn(`Failed to rollback ${resource.type} ${resource.name}:`, error.message);
            }
        }
    }

    async getAgentStatus(agentId) {
        const deployedAgent = this.deployedAgents.get(agentId);
        if (!deployedAgent) {
            return null;
        }

        try {
            const agent = await this.k8sApi.getNamespacedCustomObject(
                'kagent.dev',
                'v1alpha1',
                deployedAgent.namespace,
                'agents',
                deployedAgent.kagentName
            );

            // Get related pods/services for more detailed status
            const pods = await this.getAgentPods(deployedAgent.kagentName);

            return {
                ...deployedAgent,
                status: agent.body.status?.phase || 'unknown',
                kagentStatus: agent.body.status,
                pods,
                ready: agent.body.status?.phase === 'Ready',
                lastUpdated: new Date()
            };

        } catch (error) {
            this.logger.warn(`Could not get status for agent ${agentId}:`, error.message);
            return {
                ...deployedAgent,
                status: 'error',
                error: error.message
            };
        }
    }

    async getAgentPods(agentName) {
        try {
            const pods = await this.coreApi.listNamespacedPod(
                this.config.namespace,
                undefined,
                undefined,
                undefined,
                undefined,
                `app=${agentName}`
            );

            return pods.body.items.map(pod => ({
                name: pod.metadata.name,
                status: pod.status.phase,
                ready: pod.status.conditions?.find(c => c.type === 'Ready')?.status === 'True',
                restarts: pod.status.containerStatuses?.[0]?.restartCount || 0
            }));
        } catch (error) {
            this.logger.debug(`Could not get pods for agent ${agentName}:`, error.message);
            return [];
        }
    }

    async deleteAgent(agentId) {
        const deployedAgent = this.deployedAgents.get(agentId);
        if (!deployedAgent) {
            throw new KagentError(`Agent ${agentId} not found`, 'AGENT_NOT_FOUND');
        }

        try {
            // Delete agent
            await this.k8sApi.deleteNamespacedCustomObject(
                'kagent.dev',
                'v1alpha1',
                deployedAgent.namespace,
                'agents',
                deployedAgent.kagentName
            );

            // Delete associated tools if they were created by us
            for (const resource of deployedAgent.resources || []) {
                if (resource.type === 'tool') {
                    try {
                        await this.k8sApi.deleteNamespacedCustomObject(
                            'kagent.dev',
                            'v1alpha1',
                            deployedAgent.namespace,
                            'tools',
                            resource.name
                        );
                    } catch (error) {
                        this.logger.warn(`Failed to delete tool ${resource.name}:`, error.message);
                    }
                }
            }

            this.deployedAgents.delete(agentId);
            this.logger.success(`Agent ${agentId} deleted`);

        } catch (error) {
            this.logger.error(`Failed to delete agent ${agentId}:`, error);
            throw new KagentError(`Failed to delete agent: ${error.message}`, 'DELETE_FAILED', error);
        }
    }

    async setupMonitoring() {
        // Setup basic monitoring/health checks
        this.logger.debug('Setting up kagent monitoring...');

        // Could implement:
        // - Watch for agent status changes
        // - Setup metrics collection
        // - Health check endpoints
    }

    async shutdown() {
        this.logger.info('Shutting down kagent bridge...');

        // Cleanup any background processes
        // Close connections

        this.isInitialized = false;
        this.logger.info('kagent bridge shutdown complete');
    }

    // Mock methods for testing
    createMockApi() {
        return {
            listNamespacedCustomObject: async () => ({
                body: { items: [] }
            }),
            createNamespacedCustomObject: async () => ({
                body: { metadata: { name: 'mock-resource' } }
            }),
            getNamespacedCustomObject: async () => ({
                body: { status: { phase: 'Running' } }
            }),
            deleteNamespacedCustomObject: async () => ({
                body: {}
            })
        };
    }

    createMockCoreApi() {
        return {
            listNamespace: async () => ({
                body: { 
                    items: [
                        { metadata: { name: 'kagent-system' } },
                        { metadata: { name: 'default' } }
                    ]
                }
            }),
            listNamespacedPod: async () => ({
                body: {
                    items: [
                        {
                            metadata: { 
                                name: 'mock-pod',
                                labels: { app: 'kagent-controller' }
                            },
                            status: { 
                                phase: 'Running',
                                conditions: [{ type: 'Ready', status: 'True' }],
                                containerStatuses: [{ restartCount: 0 }]
                            }
                        }
                    ]
                }
            })
        };
    }

    createMockAppsApi() {
        return {};
    }

    createMockCrdApi() {
        return {
            listCustomResourceDefinition: async () => ({
                body: {
                    items: [
                        { metadata: { name: 'agents.kagent.dev' } },
                        { metadata: { name: 'tools.kagent.dev' } }
                    ]
                }
            })
        };
    }
}

module.exports = { KagentBridge, KagentError };