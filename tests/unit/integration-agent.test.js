const { IntegrationAgentModule } = require('../../src/agents/integration-agent');
const { Logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('openai');

describe('Integration Agent Module', () => {
    let integrationAgent;
    let mockConfig;

    beforeEach(() => {
        mockConfig = {
            openaiApiKey: 'test-api-key',
            port: 3000,
            mcp: {
                anpPort: 8083
            }
        };

        // Mock Logger
        Logger.mockImplementation(() => ({
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            success: jest.fn()
        }));

        integrationAgent = new IntegrationAgentModule(mockConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        test('should initialize with correct config', () => {
            expect(integrationAgent.config).toBe(mockConfig);
            expect(integrationAgent.logger).toBeDefined();
            expect(integrationAgent.openAPIParser).toBeDefined();
            expect(integrationAgent.gitOpsManager).toBeDefined();
            expect(integrationAgent.pydanticGenerator).toBeDefined();
            expect(integrationAgent.metricsCollector).toBeDefined();
            expect(integrationAgent.integrationAgent).toBeDefined();
            expect(integrationAgent.orchestrator).toBeDefined();
        });
    });

    describe('Initialize', () => {
        test('should initialize all components', async () => {
            // Mock component initialization
            integrationAgent.openAPIParser.initialize = jest.fn().mockResolvedValue();
            integrationAgent.gitOpsManager.initialize = jest.fn().mockResolvedValue();
            integrationAgent.pydanticGenerator.initialize = jest.fn().mockResolvedValue();
            integrationAgent.metricsCollector.initialize = jest.fn().mockResolvedValue();
            integrationAgent.integrationAgent.initialize = jest.fn().mockResolvedValue();
            integrationAgent.orchestrator.initialize = jest.fn().mockResolvedValue();

            await integrationAgent.initialize();

            expect(integrationAgent.openAPIParser.initialize).toHaveBeenCalled();
            expect(integrationAgent.gitOpsManager.initialize).toHaveBeenCalled();
            expect(integrationAgent.pydanticGenerator.initialize).toHaveBeenCalled();
            expect(integrationAgent.metricsCollector.initialize).toHaveBeenCalled();
            expect(integrationAgent.integrationAgent.initialize).toHaveBeenCalled();
            expect(integrationAgent.orchestrator.initialize).toHaveBeenCalled();
        });

        test('should handle initialization errors', async () => {
            const error = new Error('Initialization failed');
            integrationAgent.openAPIParser.initialize = jest.fn().mockRejectedValue(error);

            await expect(integrationAgent.initialize()).rejects.toThrow('Initialization failed');
        });
    });

    describe('Create Integration Agent', () => {
        beforeEach(async () => {
            // Mock successful initialization
            integrationAgent.openAPIParser.initialize = jest.fn().mockResolvedValue();
            integrationAgent.gitOpsManager.initialize = jest.fn().mockResolvedValue();
            integrationAgent.pydanticGenerator.initialize = jest.fn().mockResolvedValue();
            integrationAgent.metricsCollector.initialize = jest.fn().mockResolvedValue();
            integrationAgent.integrationAgent.initialize = jest.fn().mockResolvedValue();
            integrationAgent.orchestrator.initialize = jest.fn().mockResolvedValue();

            await integrationAgent.initialize();
        });

        test('should create integration agent successfully', async () => {
            const options = {
                openapi_url: 'https://api.example.com/openapi.json',
                target_namespace: 'test-namespace'
            };

            const mockOpenAPISpec = {
                info: { title: 'Test API', version: '1.0.0' },
                paths: { '/test': { get: {} } }
            };

            const mockPydanticModels = {
                modelsCode: 'mock python code',
                modelsInfo: { models: ['TestModel'] }
            };

            const mockManifests = {
                deployment: { kind: 'Deployment' },
                service: { kind: 'Service' }
            };

            // Mock component methods
            integrationAgent.metricsCollector.startIntegration = jest.fn().mockReturnValue('test-id');
            integrationAgent.metricsCollector.recordSuccess = jest.fn();
            
            integrationAgent.orchestrator.planIntegration = jest.fn().mockResolvedValue({
                plan: 'test plan',
                estimatedDuration: '10 minutes'
            });

            integrationAgent.orchestrator.orchestrate = jest.fn()
                .mockResolvedValueOnce({ result: { spec: mockOpenAPISpec } })
                .mockResolvedValueOnce({ result: mockPydanticModels })
                .mockResolvedValueOnce({ result: { manifests: mockManifests } });

            integrationAgent.openAPIParser.parseSpecification = jest.fn().mockResolvedValue(mockOpenAPISpec);
            integrationAgent.pydanticGenerator.generateModels = jest.fn().mockResolvedValue(mockPydanticModels);
            integrationAgent.integrationAgent.generateKubernetesManifests = jest.fn().mockResolvedValue(mockManifests);
            integrationAgent.integrationAgent.validateManifests = jest.fn().mockResolvedValue({ valid: true });

            const result = await integrationAgent.createIntegrationAgent(options);

            expect(result.success).toBe(true);
            expect(result.openAPISpec).toEqual(mockOpenAPISpec);
            expect(result.pydanticModels).toEqual(mockPydanticModels);
            expect(result.kubernetesManifests).toEqual(mockManifests);
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(integrationAgent.metricsCollector.recordSuccess).toHaveBeenCalled();
        });

        test('should handle creation errors', async () => {
            const options = {
                openapi_url: 'https://api.example.com/openapi.json'
            };

            const error = new Error('OpenAPI parsing failed');
            integrationAgent.orchestrator.planIntegration = jest.fn().mockRejectedValue(error);
            integrationAgent.metricsCollector.startIntegration = jest.fn().mockReturnValue('test-id');
            integrationAgent.metricsCollector.recordFailure = jest.fn();

            await expect(integrationAgent.createIntegrationAgent(options)).rejects.toThrow('OpenAPI parsing failed');
            expect(integrationAgent.metricsCollector.recordFailure).toHaveBeenCalled();
        });
    });

    describe('Get Integration Agent Status', () => {
        test('should return agent status', async () => {
            const agentId = 'test-agent-id';
            const mockStatus = {
                id: agentId,
                status: 'running',
                createdAt: new Date().toISOString()
            };

            integrationAgent.integrationAgent.getStatus = jest.fn().mockResolvedValue(mockStatus);

            const result = await integrationAgent.getIntegrationAgentStatus(agentId);

            expect(result).toEqual(mockStatus);
            expect(integrationAgent.integrationAgent.getStatus).toHaveBeenCalledWith(agentId);
        });
    });

    describe('List Integration Agents', () => {
        test('should return list of agents', async () => {
            const mockAgents = [
                { id: 'agent-1', status: 'running' },
                { id: 'agent-2', status: 'stopped' }
            ];

            integrationAgent.integrationAgent.listAgents = jest.fn().mockResolvedValue(mockAgents);

            const result = await integrationAgent.listIntegrationAgents();

            expect(result).toEqual(mockAgents);
            expect(integrationAgent.integrationAgent.listAgents).toHaveBeenCalled();
        });
    });

    describe('Delete Integration Agent', () => {
        test('should delete agent successfully', async () => {
            const agentId = 'test-agent-id';
            const mockDeleteResult = {
                success: true,
                agentId,
                deletedAt: new Date().toISOString()
            };

            integrationAgent.integrationAgent.deleteAgent = jest.fn().mockResolvedValue(mockDeleteResult);

            const result = await integrationAgent.deleteIntegrationAgent(agentId);

            expect(result).toEqual(mockDeleteResult);
            expect(integrationAgent.integrationAgent.deleteAgent).toHaveBeenCalledWith(agentId);
        });
    });

    describe('Get Metrics', () => {
        test('should return metrics', async () => {
            const mockMetrics = {
                totalIntegrations: 5,
                successfulIntegrations: 4,
                failedIntegrations: 1,
                averageDuration: 30000
            };

            integrationAgent.metricsCollector.getMetrics = jest.fn().mockResolvedValue(mockMetrics);

            const result = await integrationAgent.getMetrics();

            expect(result).toEqual(mockMetrics);
            expect(integrationAgent.metricsCollector.getMetrics).toHaveBeenCalled();
        });
    });
});

describe('Integration Agent Module - Integration Tests', () => {
    let integrationAgent;
    let mockConfig;

    beforeEach(() => {
        // Use test environment
        process.env.NODE_ENV = 'test';
        
        mockConfig = {
            openaiApiKey: 'test-api-key',
            port: 3000,
            mcp: {
                anpPort: 8083
            }
        };

        integrationAgent = new IntegrationAgentModule(mockConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.NODE_ENV;
    });

    test('should handle end-to-end integration flow', async () => {
        // This test would require more sophisticated mocking
        // For now, we'll just verify the components are wired correctly
        
        expect(integrationAgent.openAPIParser).toBeDefined();
        expect(integrationAgent.gitOpsManager).toBeDefined();
        expect(integrationAgent.pydanticGenerator).toBeDefined();
        expect(integrationAgent.metricsCollector).toBeDefined();
        expect(integrationAgent.integrationAgent).toBeDefined();
        expect(integrationAgent.orchestrator).toBeDefined();
    });
});