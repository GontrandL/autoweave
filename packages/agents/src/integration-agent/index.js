const { Logger } = require('@autoweave/shared');
const { IntegrationAgent } = require('./integration-agent');
const { OpenAPIParser } = require('./openapi-parser');
const { GitOpsManager } = require('./gitops-manager');
const { PydanticGenerator } = require('./pydantic-generator');
const { MetricsCollector } = require('./metrics-collector');
const { LangChainOrchestrator } = require('./langchain-orchestrator');

/**
 * Module Integration Agent - Main Entry Point
 * Transforms OpenAPI specifications into Kubernetes-deployed agents
 */
class IntegrationAgentModule {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('IntegrationAgentModule');
        
        // Initialize components
        this.openAPIParser = new OpenAPIParser(config);
        this.gitOpsManager = new GitOpsManager(config);
        this.pydanticGenerator = new PydanticGenerator(config);
        this.metricsCollector = new MetricsCollector(config);
        this.integrationAgent = new IntegrationAgent(config);
        this.orchestrator = new LangChainOrchestrator(config);
    }

    async initialize() {
        this.logger.info('Initializing Integration Agent Module...');
        
        try {
            await this.openAPIParser.initialize();
            await this.gitOpsManager.initialize();
            await this.pydanticGenerator.initialize();
            await this.metricsCollector.initialize();
            await this.integrationAgent.initialize();
            await this.orchestrator.initialize();
            
            this.logger.success('Integration Agent Module initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Integration Agent Module:', error);
            throw error;
        }
    }

    /**
     * Main entry point for creating integration agents
     * @param {Object} options - Integration options
     * @param {string} options.openapi_url - OpenAPI specification URL
     * @param {string} options.target_namespace - Kubernetes namespace
     * @param {string} options.git_repo - Git repository for GitOps
     * @param {Object} options.deploy_config - Deployment configuration
     * @returns {Promise<Object>} Integration result
     */
    async createIntegrationAgent(options) {
        const startTime = Date.now();
        this.logger.info('Creating integration agent:', options);

        // Validate required parameters
        if (!options.openapi_url) {
            throw new Error('Missing required parameter: openapi_url');
        }

        try {
            // Start metrics collection
            const integrationId = this.metricsCollector.startIntegration(`integration-${Date.now()}`, options);

            // Use orchestrator for intelligent planning and execution
            const orchestrationContext = {
                integrationAgent: {
                    openAPIParser: this.openAPIParser,
                    pydanticGenerator: this.pydanticGenerator,
                    integrationAgent: this.integrationAgent,
                    gitOpsManager: this.gitOpsManager
                }
            };

            // Let the orchestrator plan the integration
            const integrationRequest = `Create an integration agent from OpenAPI specification at ${options.openapi_url} for deployment in namespace ${options.target_namespace || 'default'}${options.git_repo ? ` with GitOps deployment to ${options.git_repo}` : ''}`;
            
            this.logger.info('Planning integration with AI orchestrator...');
            const plan = await this.orchestrator.planIntegration(integrationRequest, orchestrationContext);

            // Execute the integration steps with orchestrator guidance
            this.logger.info('Executing integration steps...');
            
            // Step 1: Parse and validate OpenAPI specification
            this.logger.info('Parsing OpenAPI specification...');
            const openAPIResult = await this.orchestrator.orchestrate(
                `Parse and analyze the OpenAPI specification at ${options.openapi_url}`,
                orchestrationContext
            );
            const openAPISpec = openAPIResult.result?.spec || await this.openAPIParser.parseSpecification(options.openapi_url);

            // Step 2: Generate Pydantic models
            this.logger.info('Generating Pydantic models...');
            const pydanticResult = await this.orchestrator.orchestrate(
                `Generate Pydantic models from the parsed OpenAPI specification`,
                { ...orchestrationContext, openapi_spec: openAPISpec }
            );
            const pydanticModels = pydanticResult.result || await this.pydanticGenerator.generateModels(openAPISpec);

            // Step 3: Generate Kubernetes manifests
            this.logger.info('Generating Kubernetes manifests...');
            const manifestsResult = await this.orchestrator.orchestrate(
                `Generate Kubernetes manifests for deployment in namespace ${options.target_namespace || 'default'}`,
                { 
                    ...orchestrationContext, 
                    agent_config: { openAPISpec, pydanticModels },
                    namespace: options.target_namespace
                }
            );
            const kubernetesManifests = manifestsResult.result?.manifests || await this.integrationAgent.generateKubernetesManifests({
                openAPISpec,
                pydanticModels,
                targetNamespace: options.target_namespace,
                deployConfig: options.deploy_config
            });

            // Step 4: Validate manifests
            this.logger.info('Validating Kubernetes manifests...');
            await this.integrationAgent.validateManifests(kubernetesManifests);

            // Step 5: Deploy via GitOps (if requested)
            let deploymentResult = null;
            if (options.git_repo) {
                this.logger.info('Deploying via GitOps...');
                const gitOpsResult = await this.orchestrator.orchestrate(
                    `Deploy the generated manifests via GitOps to repository ${options.git_repo}`,
                    {
                        ...orchestrationContext,
                        manifests: kubernetesManifests,
                        git_repo: options.git_repo,
                        namespace: options.target_namespace
                    }
                );
                deploymentResult = gitOpsResult.result || await this.gitOpsManager.deployToGitOps({
                    manifests: kubernetesManifests,
                    gitRepo: options.git_repo,
                    targetNamespace: options.target_namespace
                });
            }

            // Record success metrics
            const duration = Date.now() - startTime;
            this.metricsCollector.recordSuccess(duration);

            const result = {
                success: true,
                plan,
                openAPISpec,
                pydanticModels,
                kubernetesManifests,
                deploymentResult,
                orchestrationResults: {
                    openAPI: openAPIResult,
                    pydantic: pydanticResult,
                    manifests: manifestsResult
                },
                duration,
                timestamp: new Date().toISOString()
            };

            this.logger.success('Integration agent created successfully in', duration + 'ms');
            return result;

        } catch (error) {
            // Record failure metrics
            const duration = Date.now() - startTime;
            this.metricsCollector.recordFailure(duration, error);

            this.logger.error('Failed to create integration agent:', error);
            throw error;
        }
    }

    /**
     * Get integration agent status
     * @param {string} agentId - Agent ID
     * @returns {Promise<Object>} Agent status
     */
    async getIntegrationAgentStatus(agentId) {
        return await this.integrationAgent.getStatus(agentId);
    }

    /**
     * List all integration agents
     * @returns {Promise<Array>} List of integration agents
     */
    async listIntegrationAgents() {
        return await this.integrationAgent.listAgents();
    }

    /**
     * Delete integration agent
     * @param {string} agentId - Agent ID
     * @returns {Promise<Object>} Deletion result
     */
    async deleteIntegrationAgent(agentId) {
        return await this.integrationAgent.deleteAgent(agentId);
    }

    /**
     * Get integration metrics
     * @returns {Promise<Object>} Metrics data
     */
    async getMetrics() {
        return await this.metricsCollector.getMetrics();
    }
}

module.exports = { IntegrationAgentModule };