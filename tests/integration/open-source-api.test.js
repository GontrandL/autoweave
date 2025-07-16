const request = require('supertest');
const express = require('express');
const { OpenSourceDiscoveryAgent } = require('../../src/agents/open-source-discovery-agent');
const { LicenseComplianceAgent } = require('../../src/agents/license-compliance-agent');
const openSourceRoutes = require('../../src/routes/open-source');

// Mock agents
jest.mock('../../src/agents/open-source-discovery-agent');
jest.mock('../../src/agents/license-compliance-agent');

describe('Open Source API Integration Tests', () => {
    let app;
    let mockDiscoveryAgent;
    let mockLicenseAgent;

    beforeEach(() => {
        // Create Express app
        app = express();
        app.use(express.json());
        
        // Mock the agents
        mockDiscoveryAgent = {
            discoverAlternatives: jest.fn(),
            generateMigrationReport: jest.fn(),
            analyzeCostSavings: jest.fn()
        };
        
        mockLicenseAgent = {
            auditLicenseCompliance: jest.fn(),
            calculateComplianceScore: jest.fn()
        };

        // Mock agent constructors
        OpenSourceDiscoveryAgent.mockImplementation(() => mockDiscoveryAgent);
        LicenseComplianceAgent.mockImplementation(() => mockLicenseAgent);

        // Set up mock configuration
        app.set('config', {
            freshSources: {
                enabled: true,
                sources: ['docker', 'npm', 'helm']
            }
        });
        
        app.set('memoryManager', {
            search: jest.fn(),
            store: jest.fn()
        });

        // Mount routes
        app.use('/api/open-source', openSourceRoutes);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/open-source/alternatives', () => {
        it('should discover alternatives for a given tool', async () => {
            const mockAlternatives = {
                alternatives: [
                    {
                        name: 'prometheus',
                        reason: 'Open source monitoring solution',
                        cncf_status: 'graduated',
                        maturity: 'stable',
                        estimatedCostSaving: { monthly: 500, yearly: 6000 }
                    },
                    {
                        name: 'grafana',
                        reason: 'Visualization and dashboarding',
                        cncf_status: 'graduated',
                        maturity: 'stable',
                        estimatedCostSaving: { monthly: 300, yearly: 3600 }
                    }
                ]
            };

            mockDiscoveryAgent.discoverAlternatives.mockResolvedValue(mockAlternatives);

            const response = await request(app)
                .get('/api/open-source/alternatives')
                .query({ tool: 'datadog' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockAlternatives);
            expect(mockDiscoveryAgent.discoverAlternatives).toHaveBeenCalledWith('datadog', {
                includeDocker: true,
                includeNpm: true,
                includeHelm: true
            });
        });

        it('should return 400 if tool parameter is missing', async () => {
            const response = await request(app)
                .get('/api/open-source/alternatives')
                .expect(400);

            expect(response.body.error).toBe('Tool parameter is required');
        });

        it('should handle errors from discovery agent', async () => {
            mockDiscoveryAgent.discoverAlternatives.mockRejectedValue(new Error('Discovery failed'));

            const response = await request(app)
                .get('/api/open-source/alternatives')
                .query({ tool: 'datadog' })
                .expect(500);

            expect(response.body.error).toBe('Failed to discover alternatives');
        });
    });

    describe('POST /api/open-source/audit-licenses', () => {
        it('should audit licenses for a project', async () => {
            const mockAuditReport = {
                summary: {
                    complianceScore: 85,
                    riskLevel: 'low',
                    totalDependencies: 150,
                    licenseTypes: ['MIT', 'Apache-2.0', 'BSD-3-Clause']
                },
                licenseAnalysis: {
                    analyzed: [
                        {
                            name: 'react',
                            license: 'MIT',
                            risk: 'low',
                            compatible: true
                        },
                        {
                            name: 'express',
                            license: 'MIT',
                            risk: 'low',
                            compatible: true
                        }
                    ]
                },
                recommendations: [
                    'Consider reviewing GPL dependencies',
                    'Update outdated packages'
                ],
                auditDate: new Date().toISOString()
            };

            mockLicenseAgent.auditLicenseCompliance.mockResolvedValue(mockAuditReport);

            const response = await request(app)
                .post('/api/open-source/audit-licenses')
                .send({ projectPath: '/path/to/project' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockAuditReport);
            expect(mockLicenseAgent.auditLicenseCompliance).toHaveBeenCalledWith('/path/to/project', {});
        });

        it('should return 400 if projectPath is missing', async () => {
            const response = await request(app)
                .post('/api/open-source/audit-licenses')
                .send({})
                .expect(400);

            expect(response.body.error).toBe('Project path is required');
        });

        it('should handle errors from license agent', async () => {
            mockLicenseAgent.auditLicenseCompliance.mockRejectedValue(new Error('Audit failed'));

            const response = await request(app)
                .post('/api/open-source/audit-licenses')
                .send({ projectPath: '/path/to/project' })
                .expect(500);

            expect(response.body.error).toBe('Failed to audit licenses');
        });
    });

    describe('GET /api/open-source/compliance-score', () => {
        it('should calculate compliance score for a project', async () => {
            const mockAuditReport = {
                summary: {
                    complianceScore: 92,
                    riskLevel: 'low',
                    totalDependencies: 200,
                    licenseTypes: ['MIT', 'Apache-2.0', 'BSD-3-Clause']
                },
                recommendations: [
                    'All dependencies are compliant',
                    'Consider documenting license choices',
                    'Regular audits recommended'
                ],
                auditDate: new Date().toISOString()
            };

            mockLicenseAgent.auditLicenseCompliance.mockResolvedValue(mockAuditReport);

            const response = await request(app)
                .get('/api/open-source/compliance-score')
                .query({ projectPath: '/path/to/project' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.complianceScore).toBe(92);
            expect(response.body.data.riskLevel).toBe('low');
            expect(response.body.data.recommendations).toHaveLength(3);
        });

        it('should return 400 if projectPath is missing', async () => {
            const response = await request(app)
                .get('/api/open-source/compliance-score')
                .expect(400);

            expect(response.body.error).toBe('Project path is required');
        });
    });

    describe('POST /api/open-source/migration-plan', () => {
        it('should generate migration plan between tools', async () => {
            const mockAlternatives = {
                alternatives: [
                    {
                        name: 'prometheus',
                        reason: 'Open source monitoring',
                        migrationComplexity: 'Medium',
                        estimatedCostSaving: { monthly: 500, yearly: 6000 }
                    }
                ]
            };

            const mockMigrationPlan = {
                fromTool: 'datadog',
                toTool: 'prometheus',
                phases: [
                    {
                        phase: 'Preparation',
                        duration: '2 weeks',
                        tasks: ['Setup Prometheus', 'Configure alerts']
                    },
                    {
                        phase: 'Migration',
                        duration: '3 weeks',
                        tasks: ['Migrate dashboards', 'Update monitoring']
                    }
                ],
                estimatedSavings: { monthly: 500, yearly: 6000 },
                riskAssessment: 'Medium'
            };

            mockDiscoveryAgent.discoverAlternatives.mockResolvedValue(mockAlternatives);
            mockDiscoveryAgent.generateMigrationReport.mockResolvedValue(mockMigrationPlan);

            const response = await request(app)
                .post('/api/open-source/migration-plan')
                .send({ fromTool: 'datadog', toTool: 'prometheus' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.fromTool).toBe('datadog');
            expect(response.body.data.toTool).toBe('prometheus');
            expect(response.body.data.phases).toHaveLength(2);
        });

        it('should return 400 if fromTool or toTool is missing', async () => {
            const response = await request(app)
                .post('/api/open-source/migration-plan')
                .send({ fromTool: 'datadog' })
                .expect(400);

            expect(response.body.error).toBe('Both fromTool and toTool are required');
        });

        it('should return 404 if target tool is not found in alternatives', async () => {
            const mockAlternatives = {
                alternatives: [
                    {
                        name: 'prometheus',
                        reason: 'Open source monitoring'
                    }
                ]
            };

            mockDiscoveryAgent.discoverAlternatives.mockResolvedValue(mockAlternatives);

            const response = await request(app)
                .post('/api/open-source/migration-plan')
                .send({ fromTool: 'datadog', toTool: 'grafana' })
                .expect(404);

            expect(response.body.error).toBe('Target tool not found in alternatives');
            expect(response.body.availableAlternatives).toEqual(['prometheus']);
        });
    });

    describe('GET /api/open-source/cost-analysis', () => {
        it('should analyze cost savings for multiple tools', async () => {
            const mockAlternatives1 = {
                alternatives: [
                    {
                        name: 'prometheus',
                        estimatedCostSaving: { monthly: 500, yearly: 6000 },
                        migrationComplexity: 'Medium',
                        recommendationLevel: 'recommended'
                    }
                ]
            };

            const mockAlternatives2 = {
                alternatives: [
                    {
                        name: 'grafana',
                        estimatedCostSaving: { monthly: 300, yearly: 3600 },
                        migrationComplexity: 'Low',
                        recommendationLevel: 'recommended'
                    }
                ]
            };

            mockDiscoveryAgent.discoverAlternatives
                .mockResolvedValueOnce(mockAlternatives1)
                .mockResolvedValueOnce(mockAlternatives2);

            const response = await request(app)
                .get('/api/open-source/cost-analysis')
                .query({ tools: 'datadog,splunk' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.totalSavings.monthly).toBe(800);
            expect(response.body.data.totalSavings.yearly).toBe(9600);
            expect(response.body.data.toolAnalysis).toHaveLength(2);
        });

        it('should return 400 if tools parameter is missing', async () => {
            const response = await request(app)
                .get('/api/open-source/cost-analysis')
                .expect(400);

            expect(response.body.error).toBe('Either tools list or projectPath is required');
        });
    });

    describe('POST /api/open-source/cncf-check', () => {
        it('should check CNCF compliance for a project', async () => {
            const mockAuditReport = {
                summary: {
                    complianceScore: 78,
                    totalDependencies: 100
                },
                licenseAnalysis: {
                    analyzed: [
                        {
                            name: 'kubernetes',
                            license: 'Apache-2.0',
                            cncf: true,
                            openSource: true
                        },
                        {
                            name: 'prometheus',
                            license: 'Apache-2.0',
                            cncf: true,
                            openSource: true
                        },
                        {
                            name: 'proprietary-tool',
                            license: 'Proprietary',
                            cncf: false,
                            openSource: false
                        }
                    ]
                }
            };

            const mockAlternatives = {
                alternatives: [
                    {
                        name: 'open-source-alternative',
                        reason: 'CNCF graduated project'
                    }
                ]
            };

            mockLicenseAgent.auditLicenseCompliance.mockResolvedValue(mockAuditReport);
            mockDiscoveryAgent.discoverAlternatives.mockResolvedValue(mockAlternatives);

            const response = await request(app)
                .post('/api/open-source/cncf-check')
                .send({ projectPath: '/path/to/project' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.cncfComponents).toBe(2);
            expect(response.body.data.cncfPercentage).toBe(67); // 2/3 * 100
            expect(response.body.data.recommendations).toHaveLength(1);
        });

        it('should return 400 if projectPath is missing', async () => {
            const response = await request(app)
                .post('/api/open-source/cncf-check')
                .send({})
                .expect(400);

            expect(response.body.error).toBe('Either projectPath or manifests array is required');
        });
    });

    describe('GET /api/open-source/health', () => {
        it('should return health status of open source services', async () => {
            const response = await request(app)
                .get('/api/open-source/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('healthy');
            expect(response.body.data.services).toHaveProperty('configurationIntelligence');
            expect(response.body.data.services).toHaveProperty('openSourceDiscovery');
            expect(response.body.data.services).toHaveProperty('licenseCompliance');
        });
    });

    describe('Error Handling', () => {
        it('should handle internal server errors gracefully', async () => {
            mockDiscoveryAgent.discoverAlternatives.mockRejectedValue(new Error('Internal error'));

            const response = await request(app)
                .get('/api/open-source/alternatives')
                .query({ tool: 'datadog' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Failed to discover alternatives');
            expect(response.body.details).toBe('Internal error');
        });

        it('should handle malformed JSON in POST requests', async () => {
            const response = await request(app)
                .post('/api/open-source/audit-licenses')
                .send('invalid json')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });

    describe('Integration with External Services', () => {
        it('should properly initialize agents with configuration', async () => {
            await request(app)
                .get('/api/open-source/alternatives')
                .query({ tool: 'datadog' })
                .expect(200);

            expect(OpenSourceDiscoveryAgent).toHaveBeenCalledWith(
                expect.objectContaining({
                    freshSources: expect.objectContaining({
                        enabled: true,
                        sources: ['docker', 'npm', 'helm']
                    })
                }),
                expect.objectContaining({
                    search: expect.any(Function),
                    store: expect.any(Function)
                })
            );
        });

        it('should handle memory manager integration', async () => {
            const mockMemoryManager = app.get('memoryManager');
            
            await request(app)
                .get('/api/open-source/alternatives')
                .query({ tool: 'datadog' })
                .expect(200);

            expect(LicenseComplianceAgent).toHaveBeenCalledWith(
                expect.any(Object),
                mockMemoryManager
            );
        });
    });
});

describe('Open Source API Performance Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mock fast responses
        OpenSourceDiscoveryAgent.mockImplementation(() => ({
            discoverAlternatives: jest.fn().mockResolvedValue({
                alternatives: [{ name: 'test', reason: 'test' }]
            })
        }));

        app.set('config', {});
        app.set('memoryManager', {});
        app.use('/api/open-source', openSourceRoutes);
    });

    it('should respond to alternatives endpoint within 1 second', async () => {
        const start = Date.now();
        
        await request(app)
            .get('/api/open-source/alternatives')
            .query({ tool: 'datadog' })
            .expect(200);

        const duration = Date.now() - start;
        expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent requests properly', async () => {
        const requests = Array(10).fill().map(() => 
            request(app)
                .get('/api/open-source/alternatives')
                .query({ tool: 'datadog' })
        );

        const responses = await Promise.all(requests);
        
        responses.forEach(response => {
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });
});