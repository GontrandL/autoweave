const request = require('supertest');
const express = require('express');
const { IntegrationAgentModule } = require('../../src/agents/integration-agent');

describe('Integration Agent API Tests', () => {
    let app;
    let integrationAgentModule;

    beforeAll(async () => {
        // Create Express app
        app = express();
        app.use(express.json());

        // Mock config
        const mockConfig = {
            openaiApiKey: 'test-api-key',
            port: 3000
        };

        // Create and initialize integration agent module
        integrationAgentModule = new IntegrationAgentModule(mockConfig);
        
        // Mock initialization for tests
        integrationAgentModule.openAPIParser.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.gitOpsManager.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.pydanticGenerator.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.metricsCollector.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.integrationAgent.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.orchestrator.initialize = jest.fn().mockResolvedValue();

        await integrationAgentModule.initialize();

        // Setup routes manually (simplified version of the actual routes)
        app.post('/api/agents/integration', async (req, res) => {
            try {
                const { openapi_url, target_namespace, git_repo, deploy_config } = req.body;
                
                if (!openapi_url) {
                    return res.status(400).json({
                        error: 'Missing required parameter: openapi_url'
                    });
                }
                
                const result = await integrationAgentModule.createIntegrationAgent({
                    openapi_url,
                    target_namespace,
                    git_repo,
                    deploy_config
                });
                
                res.json({
                    success: true,
                    message: 'Integration agent created successfully',
                    ...result
                });
                
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to create integration agent',
                    message: error.message
                });
            }
        });

        app.get('/api/agents/integration', async (req, res) => {
            try {
                const agents = await integrationAgentModule.listIntegrationAgents();
                res.json({
                    success: true,
                    agents,
                    count: agents.length
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to list integration agents',
                    message: error.message
                });
            }
        });

        app.get('/api/agents/integration/metrics', async (req, res) => {
            try {
                const metrics = await integrationAgentModule.getMetrics();
                res.json({
                    success: true,
                    metrics
                });
            } catch (error) {
                res.status(500).json({
                    error: 'Failed to get metrics',
                    message: error.message
                });
            }
        });
    });

    describe('POST /api/agents/integration', () => {
        test('should create integration agent successfully', async () => {
            const requestBody = {
                openapi_url: 'https://api.example.com/openapi.json',
                target_namespace: 'test-namespace'
            };

            // Mock the integration creation
            const mockResult = {
                success: true,
                plan: { estimatedDuration: '10 minutes' },
                openAPISpec: { info: { title: 'Test API' } },
                pydanticModels: { modelsCode: 'test code' },
                kubernetesManifests: { deployment: { kind: 'Deployment' } },
                duration: 5000
            };

            integrationAgentModule.createIntegrationAgent = jest.fn().mockResolvedValue(mockResult);

            const response = await request(app)
                .post('/api/agents/integration')
                .send(requestBody)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Integration agent created successfully');
            expect(response.body.plan).toBeDefined();
            expect(response.body.openAPISpec).toBeDefined();
            expect(integrationAgentModule.createIntegrationAgent).toHaveBeenCalledWith(requestBody);
        });

        test('should return 400 when openapi_url is missing', async () => {
            const requestBody = {
                target_namespace: 'test-namespace'
            };

            const response = await request(app)
                .post('/api/agents/integration')
                .send(requestBody)
                .expect(400);

            expect(response.body.error).toBe('Missing required parameter: openapi_url');
        });

        test('should handle creation errors', async () => {
            const requestBody = {
                openapi_url: 'https://api.example.com/openapi.json'
            };

            const error = new Error('OpenAPI parsing failed');
            integrationAgentModule.createIntegrationAgent = jest.fn().mockRejectedValue(error);

            const response = await request(app)
                .post('/api/agents/integration')
                .send(requestBody)
                .expect(500);

            expect(response.body.error).toBe('Failed to create integration agent');
            expect(response.body.message).toBe('OpenAPI parsing failed');
        });
    });

    describe('GET /api/agents/integration', () => {
        test('should list integration agents', async () => {
            const mockAgents = [
                { id: 'agent-1', status: 'running' },
                { id: 'agent-2', status: 'stopped' }
            ];

            integrationAgentModule.listIntegrationAgents = jest.fn().mockResolvedValue(mockAgents);

            const response = await request(app)
                .get('/api/agents/integration')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.agents).toEqual(mockAgents);
            expect(response.body.count).toBe(2);
        });

        test('should handle listing errors', async () => {
            const error = new Error('Database connection failed');
            integrationAgentModule.listIntegrationAgents = jest.fn().mockRejectedValue(error);

            const response = await request(app)
                .get('/api/agents/integration')
                .expect(500);

            expect(response.body.error).toBe('Failed to list integration agents');
            expect(response.body.message).toBe('Database connection failed');
        });
    });

    describe('GET /api/agents/integration/metrics', () => {
        test('should return integration metrics', async () => {
            const mockMetrics = {
                totalIntegrations: 10,
                successfulIntegrations: 8,
                failedIntegrations: 2,
                averageDuration: 25000,
                timestamp: new Date().toISOString()
            };

            integrationAgentModule.getMetrics = jest.fn().mockResolvedValue(mockMetrics);

            const response = await request(app)
                .get('/api/agents/integration/metrics')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.metrics).toEqual(mockMetrics);
        });

        test('should handle metrics errors', async () => {
            const error = new Error('Metrics collection failed');
            integrationAgentModule.getMetrics = jest.fn().mockRejectedValue(error);

            const response = await request(app)
                .get('/api/agents/integration/metrics')
                .expect(500);

            expect(response.body.error).toBe('Failed to get metrics');
            expect(response.body.message).toBe('Metrics collection failed');
        });
    });
});

describe('Integration Agent Module - Real Integration Tests', () => {
    let integrationAgentModule;

    beforeAll(() => {
        // Set test environment
        process.env.NODE_ENV = 'test';
        
        const mockConfig = {
            openaiApiKey: 'test-api-key',
            port: 3000
        };

        integrationAgentModule = new IntegrationAgentModule(mockConfig);
    });

    afterAll(() => {
        delete process.env.NODE_ENV;
    });

    test('should initialize all components correctly', async () => {
        // Mock component initializations to avoid external dependencies
        integrationAgentModule.openAPIParser.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.gitOpsManager.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.pydanticGenerator.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.metricsCollector.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.integrationAgent.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.orchestrator.initialize = jest.fn().mockResolvedValue();

        await expect(integrationAgentModule.initialize()).resolves.not.toThrow();

        expect(integrationAgentModule.openAPIParser.initialize).toHaveBeenCalled();
        expect(integrationAgentModule.gitOpsManager.initialize).toHaveBeenCalled();
        expect(integrationAgentModule.pydanticGenerator.initialize).toHaveBeenCalled();
        expect(integrationAgentModule.metricsCollector.initialize).toHaveBeenCalled();
        expect(integrationAgentModule.integrationAgent.initialize).toHaveBeenCalled();
        expect(integrationAgentModule.orchestrator.initialize).toHaveBeenCalled();
    });

    test('should create valid integration workflow', async () => {
        // Initialize module
        integrationAgentModule.openAPIParser.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.gitOpsManager.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.pydanticGenerator.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.metricsCollector.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.integrationAgent.initialize = jest.fn().mockResolvedValue();
        integrationAgentModule.orchestrator.initialize = jest.fn().mockResolvedValue();

        await integrationAgentModule.initialize();

        // Mock a complete workflow
        const mockOpenAPISpec = {
            openapi: '3.0.0',
            info: { title: 'Pet Store API', version: '1.0.0' },
            paths: {
                '/pets': {
                    get: { summary: 'List pets' },
                    post: { summary: 'Create pet' }
                }
            }
        };

        const mockPydanticModels = {
            modelsCode: 'class Pet(BaseModel):\n    name: str\n    species: str',
            modelsInfo: { models: [{ name: 'Pet', type: 'model' }] }
        };

        const mockManifests = {
            deployment: {
                apiVersion: 'apps/v1',
                kind: 'Deployment',
                metadata: { name: 'pet-store-integration' }
            },
            service: {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'pet-store-service' }
            }
        };

        // Mock methods
        integrationAgentModule.metricsCollector.startIntegration = jest.fn().mockReturnValue('test-integration-id');
        integrationAgentModule.metricsCollector.recordSuccess = jest.fn();
        
        integrationAgentModule.orchestrator.planIntegration = jest.fn().mockResolvedValue({
            plan: { type: 'reasoning', content: 'Create Pet Store integration agent' },
            estimatedDuration: '15 minutes'
        });

        integrationAgentModule.orchestrator.orchestrate = jest.fn()
            .mockResolvedValueOnce({ result: { spec: mockOpenAPISpec } })
            .mockResolvedValueOnce({ result: mockPydanticModels })
            .mockResolvedValueOnce({ result: { manifests: mockManifests } });

        integrationAgentModule.openAPIParser.parseSpecification = jest.fn().mockResolvedValue(mockOpenAPISpec);
        integrationAgentModule.pydanticGenerator.generateModels = jest.fn().mockResolvedValue(mockPydanticModels);
        integrationAgentModule.integrationAgent.generateKubernetesManifests = jest.fn().mockResolvedValue(mockManifests);
        integrationAgentModule.integrationAgent.validateManifests = jest.fn().mockResolvedValue({ valid: true });

        const options = {
            openapi_url: 'https://petstore.swagger.io/v2/swagger.json',
            target_namespace: 'petstore'
        };

        const result = await integrationAgentModule.createIntegrationAgent(options);

        expect(result.success).toBe(true);
        expect(result.openAPISpec).toEqual(mockOpenAPISpec);
        expect(result.pydanticModels).toEqual(mockPydanticModels);
        expect(result.kubernetesManifests).toEqual(mockManifests);
        expect(result.plan).toBeDefined();
        expect(result.orchestrationResults).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);

        expect(integrationAgentModule.metricsCollector.recordSuccess).toHaveBeenCalled();
    });
});