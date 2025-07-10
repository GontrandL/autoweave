# Mock Mode Reference

## Overview

Comprehensive guide to AutoWeave's mock mode system, enabling development and testing when external services are unavailable or not configured.

## Mock Mode Architecture

### 1. Mock Mode Activation Matrix

| Service | Mock Trigger | Mock Status | Real Functionality | Mock Functionality |
|---------|--------------|-------------|-------------------|-------------------|
| **kagent/Kubernetes** | No kubectl/kubeconfig | ACTIVE | Deploy to K8s | Mock deployment responses |
| **OpenAI API** | No API key | ACTIVE | Real AI responses | Predefined responses |
| **Qdrant** | No QDRANT_HOST | ACTIVE | Vector storage | In-memory vectors |
| **Memgraph** | No MEMGRAPH_HOST | ACTIVE | Graph storage | In-memory graph |
| **SillyTavern** | Port 8081 unavailable | ACTIVE | Real chat interface | Mock chat responses |
| **Appsmith** | Port 8080 unavailable | ACTIVE | Real dashboard | Mock dashboard data |
| **ANP Registries** | No external registries | ACTIVE | Real agent discovery | Local mock agents |

### 2. Mock Mode Detection

#### Automatic Mock Detection
```javascript
const MockModeDetector = {
    detectMockModes() {
        const mockStatus = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            services: {},
            overall: {
                mockCount: 0,
                realCount: 0,
                percentage: 0
            }
        };

        // Detect each service mock mode
        mockStatus.services = {
            kubernetes: this.detectKubernetesMockMode(),
            openai: this.detectOpenAIMockMode(),
            memory: this.detectMemoryMockMode(),
            interfaces: this.detectInterfacesMockMode(),
            anp: this.detectANPMockMode()
        };

        // Calculate overall mock percentage
        const services = Object.values(mockStatus.services);
        mockStatus.overall.mockCount = services.filter(s => s.mockMode).length;
        mockStatus.overall.realCount = services.filter(s => !s.mockMode).length;
        mockStatus.overall.percentage = Math.round(
            (mockStatus.overall.mockCount / services.length) * 100
        );

        return mockStatus;
    },

    detectKubernetesMockMode() {
        const hasKubeconfig = this.checkKubeconfig();
        const hasKubectl = this.checkKubectl();
        const kagentInstalled = this.checkKagent();

        return {
            service: 'kubernetes',
            mockMode: !hasKubeconfig || !hasKubectl || !kagentInstalled,
            reasons: {
                kubeconfig: hasKubeconfig,
                kubectl: hasKubectl,
                kagent: kagentInstalled
            },
            impact: 'Agents will not be deployed to Kubernetes',
            fallback: 'Mock deployment responses with fake pod statuses'
        };
    },

    detectOpenAIMockMode() {
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        const hasValidKey = hasApiKey && process.env.OPENAI_API_KEY.startsWith('sk-');

        return {
            service: 'openai',
            mockMode: !hasValidKey,
            reasons: {
                apiKey: hasApiKey,
                validFormat: hasValidKey
            },
            impact: 'Agent creation will use predefined responses',
            fallback: 'Anthropic or OpenRouter API if configured'
        };
    },

    detectMemoryMockMode() {
        const qdrantConfigured = !!process.env.QDRANT_HOST;
        const memgraphConfigured = !!process.env.MEMGRAPH_HOST;

        return {
            service: 'memory',
            mockMode: !qdrantConfigured && !memgraphConfigured,
            reasons: {
                qdrant: qdrantConfigured,
                memgraph: memgraphConfigured
            },
            impact: 'Memory system will use in-memory storage',
            fallback: 'Temporary memory without persistence'
        };
    },

    detectInterfacesMockMode() {
        // Check if port-forwarded services are available
        const sillyTavernAvailable = this.checkPortAvailable(8081);
        const appsmithAvailable = this.checkPortAvailable(8080);

        return {
            service: 'interfaces',
            mockMode: !sillyTavernAvailable || !appsmithAvailable,
            reasons: {
                sillytavern: sillyTavernAvailable,
                appsmith: appsmithAvailable
            },
            impact: 'External interfaces unavailable',
            fallback: 'ChatUI interface only'
        };
    },

    detectANPMockMode() {
        const externalRegistries = process.env.EXTERNAL_ANP_REGISTRIES;
        const hasExternalRegistries = externalRegistries && externalRegistries.length > 0;

        return {
            service: 'anp',
            mockMode: !hasExternalRegistries,
            reasons: {
                externalRegistries: hasExternalRegistries
            },
            impact: 'Only local agents available',
            fallback: 'Built-in AutoWeave agents only'
        };
    }
};
```

## Mock Service Implementations

### 1. Kubernetes Mock Service

#### Mock KagentBridge
```javascript
class MockKagentBridge {
    constructor() {
        this.isInitialized = true;
        this.developmentMode = true;
        this.mockAgents = new Map();
        this.mockNamespaces = ['default', 'autoweave-system'];
    }

    async initialize() {
        console.log('🎭 Kagent Mock Mode: Initialized successfully');
        return true;
    }

    async deployAgent(workflow) {
        const agentId = workflow.id || `mock-agent-${Date.now()}`;
        
        // Simulate deployment delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockDeployment = {
            id: agentId,
            name: workflow.name || 'mock-agent',
            status: 'Running',
            phase: 'Active',
            createdAt: new Date().toISOString(),
            namespace: workflow.namespace || 'default',
            pods: [{
                name: `${agentId}-pod`,
                status: 'Running',
                ready: true,
                restarts: 0
            }],
            mock: true
        };

        this.mockAgents.set(agentId, mockDeployment);
        
        console.log(`🎭 Mock Agent Deployed: ${agentId}`);
        return mockDeployment;
    }

    async getAgentStatus(agentId) {
        const agent = this.mockAgents.get(agentId);
        
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        // Simulate random status changes
        const statuses = ['Running', 'Pending', 'Succeeded'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        agent.status = randomStatus;
        agent.lastUpdate = new Date().toISOString();

        return agent;
    }

    async deleteAgent(agentId) {
        const deleted = this.mockAgents.delete(agentId);
        
        if (deleted) {
            console.log(`🎭 Mock Agent Deleted: ${agentId}`);
            return { deleted: true, agentId };
        } else {
            throw new Error(`Agent ${agentId} not found`);
        }
    }

    async listAgents(namespace = 'default') {
        const agents = Array.from(this.mockAgents.values())
            .filter(agent => agent.namespace === namespace);

        return {
            agents,
            total: agents.length,
            namespace,
            mock: true
        };
    }

    async getClusterInfo() {
        return {
            cluster: 'mock-cluster',
            version: 'v1.28.0-mock',
            nodes: [
                {
                    name: 'mock-node-1',
                    status: 'Ready',
                    version: 'v1.28.0'
                }
            ],
            namespaces: this.mockNamespaces,
            mock: true
        };
    }

    async shutdown() {
        this.mockAgents.clear();
        console.log('🎭 Kagent Mock Mode: Shutdown completed');
    }
}
```

### 2. OpenAI Mock Service

#### Mock OpenAI Client
```javascript
class MockOpenAIClient {
    constructor() {
        this.mockResponses = {
            agentCreation: [
                {
                    role: 'assistant',
                    content: JSON.stringify({
                        workflow: {
                            name: 'file-processor',
                            description: 'Processes files and generates reports',
                            steps: [
                                { action: 'read-file', input: 'data.csv' },
                                { action: 'process-data', format: 'json' },
                                { action: 'generate-report', output: 'report.pdf' }
                            ]
                        },
                        deployment: {
                            image: 'autoweave/file-processor:latest',
                            resources: { cpu: '100m', memory: '256Mi' },
                            env: [{ name: 'LOG_LEVEL', value: 'info' }]
                        }
                    })
                },
                {
                    role: 'assistant',
                    content: JSON.stringify({
                        workflow: {
                            name: 'log-monitor',
                            description: 'Monitors system logs and sends alerts',
                            steps: [
                                { action: 'watch-logs', source: '/var/log/system.log' },
                                { action: 'filter-errors', severity: 'error' },
                                { action: 'send-alert', webhook: 'https://alerts.example.com' }
                            ]
                        },
                        deployment: {
                            image: 'autoweave/log-monitor:latest',
                            resources: { cpu: '50m', memory: '128Mi' },
                            volumes: [{ name: 'logs', path: '/var/log' }]
                        }
                    })
                }
            ],
            chat: [
                'I can help you create and manage AI agents. What kind of agent would you like to build?',
                'Based on your description, I\'ll create a workflow that handles your requirements efficiently.',
                'The agent has been successfully created and deployed to your AutoWeave cluster.',
                'Let me analyze your request and generate the appropriate agent configuration.'
            ]
        };
    }

    async createChatCompletion(params) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        const userMessage = params.messages[params.messages.length - 1].content;
        
        // Detect if this is agent creation request
        if (this.isAgentCreationRequest(userMessage)) {
            const randomResponse = this.mockResponses.agentCreation[
                Math.floor(Math.random() * this.mockResponses.agentCreation.length)
            ];
            
            return {
                choices: [randomResponse],
                usage: {
                    prompt_tokens: userMessage.length / 4,
                    completion_tokens: randomResponse.content.length / 4,
                    total_tokens: (userMessage.length + randomResponse.content.length) / 4
                },
                model: 'gpt-3.5-turbo-mock',
                mock: true
            };
        } else {
            // Regular chat response
            const randomResponse = this.mockResponses.chat[
                Math.floor(Math.random() * this.mockResponses.chat.length)
            ];
            
            return {
                choices: [{
                    role: 'assistant',
                    content: randomResponse
                }],
                usage: {
                    prompt_tokens: userMessage.length / 4,
                    completion_tokens: randomResponse.length / 4,
                    total_tokens: (userMessage.length + randomResponse.length) / 4
                },
                model: 'gpt-3.5-turbo-mock',
                mock: true
            };
        }
    }

    isAgentCreationRequest(message) {
        const agentKeywords = [
            'create agent', 'build agent', 'make agent',
            'agent for', 'agent that', 'workflow',
            'deploy', 'automate', 'process'
        ];
        
        return agentKeywords.some(keyword => 
            message.toLowerCase().includes(keyword)
        );
    }

    async listModels() {
        return {
            data: [
                {
                    id: 'gpt-3.5-turbo-mock',
                    object: 'model',
                    created: Date.now(),
                    owned_by: 'autoweave-mock'
                },
                {
                    id: 'gpt-4-mock',
                    object: 'model',
                    created: Date.now(),
                    owned_by: 'autoweave-mock'
                }
            ],
            mock: true
        };
    }
}
```

### 3. Memory System Mock Services

#### Mock Qdrant Client
```javascript
class MockQdrantClient {
    constructor() {
        this.collections = new Map();
        this.vectors = new Map();
        this.nextId = 1;
    }

    async createCollection(collectionName, config) {
        this.collections.set(collectionName, {
            name: collectionName,
            config: config,
            status: 'green',
            vectors_count: 0,
            indexed_vectors_count: 0,
            points_count: 0,
            segments_count: 1,
            created_at: new Date().toISOString(),
            mock: true
        });

        console.log(`🎭 Mock Qdrant: Collection '${collectionName}' created`);
        return { result: true, status: 'ok' };
    }

    async upsert(collectionName, points) {
        if (!this.collections.has(collectionName)) {
            throw new Error(`Collection '${collectionName}' not found`);
        }

        const collectionVectors = this.vectors.get(collectionName) || [];
        
        points.forEach(point => {
            const id = point.id || this.nextId++;
            collectionVectors.push({
                id,
                vector: point.vector,
                payload: point.payload || {},
                created_at: new Date().toISOString(),
                mock: true
            });
        });

        this.vectors.set(collectionName, collectionVectors);
        
        // Update collection stats
        const collection = this.collections.get(collectionName);
        collection.vectors_count = collectionVectors.length;
        collection.points_count = collectionVectors.length;

        console.log(`🎭 Mock Qdrant: ${points.length} points upserted to '${collectionName}'`);
        return { result: points.map(p => ({ id: p.id || this.nextId - 1, status: 'ok' })) };
    }

    async search(collectionName, searchParams) {
        if (!this.collections.has(collectionName)) {
            throw new Error(`Collection '${collectionName}' not found`);
        }

        const collectionVectors = this.vectors.get(collectionName) || [];
        
        // Mock search by returning random vectors with decreasing scores
        const limit = searchParams.limit || 10;
        const results = collectionVectors
            .slice(0, limit)
            .map((vector, index) => ({
                id: vector.id,
                score: 0.9 - (index * 0.1), // Decreasing scores
                payload: vector.payload,
                vector: searchParams.with_vector ? vector.vector : undefined,
                mock: true
            }));

        console.log(`🎭 Mock Qdrant: Search in '${collectionName}' returned ${results.length} results`);
        return { result: results };
    }

    async getCollection(collectionName) {
        const collection = this.collections.get(collectionName);
        if (!collection) {
            throw new Error(`Collection '${collectionName}' not found`);
        }

        return { result: collection };
    }

    async listCollections() {
        return {
            result: {
                collections: Array.from(this.collections.values())
            }
        };
    }

    async healthCheck() {
        return {
            status: 'ok',
            version: '1.7.0-mock',
            uptime: Math.floor(Math.random() * 86400), // Random uptime
            mock: true
        };
    }
}
```

#### Mock Memgraph Client
```javascript
class MockMemgraphClient {
    constructor() {
        this.nodes = new Map();
        this.relationships = new Map();
        this.nextNodeId = 1;
        this.nextRelId = 1;
    }

    async connect() {
        console.log('🎭 Mock Memgraph: Connected successfully');
        return true;
    }

    async createNode(labels, properties) {
        const nodeId = this.nextNodeId++;
        const node = {
            id: nodeId,
            labels: Array.isArray(labels) ? labels : [labels],
            properties: properties || {},
            created_at: new Date().toISOString(),
            mock: true
        };

        this.nodes.set(nodeId, node);
        console.log(`🎭 Mock Memgraph: Node created with ID ${nodeId}`);
        return node;
    }

    async createRelationship(fromNodeId, toNodeId, type, properties) {
        const relId = this.nextRelId++;
        const relationship = {
            id: relId,
            startNodeId: fromNodeId,
            endNodeId: toNodeId,
            type: type,
            properties: properties || {},
            created_at: new Date().toISOString(),
            mock: true
        };

        this.relationships.set(relId, relationship);
        console.log(`🎭 Mock Memgraph: Relationship '${type}' created between ${fromNodeId} and ${toNodeId}`);
        return relationship;
    }

    async findNodes(label, properties) {
        const matchingNodes = Array.from(this.nodes.values())
            .filter(node => {
                // Check label match
                if (label && !node.labels.includes(label)) {
                    return false;
                }
                
                // Check properties match
                if (properties) {
                    for (const [key, value] of Object.entries(properties)) {
                        if (node.properties[key] !== value) {
                            return false;
                        }
                    }
                }
                
                return true;
            });

        console.log(`🎭 Mock Memgraph: Found ${matchingNodes.length} nodes matching criteria`);
        return matchingNodes;
    }

    async executeQuery(query, parameters) {
        // Mock query execution with sample results
        const mockResults = [
            {
                nodes: Array.from(this.nodes.values()).slice(0, 5),
                relationships: Array.from(this.relationships.values()).slice(0, 3),
                metadata: {
                    query: query,
                    parameters: parameters,
                    execution_time: Math.random() * 100,
                    mock: true
                }
            }
        ];

        console.log(`🎭 Mock Memgraph: Executed query: ${query}`);
        return mockResults;
    }

    async getStats() {
        return {
            nodes: this.nodes.size,
            relationships: this.relationships.size,
            labels: new Set(Array.from(this.nodes.values()).flatMap(n => n.labels)).size,
            relationship_types: new Set(Array.from(this.relationships.values()).map(r => r.type)).size,
            memory_usage: Math.floor(Math.random() * 1000000), // Random memory usage
            mock: true
        };
    }

    async close() {
        console.log('🎭 Mock Memgraph: Connection closed');
    }
}
```

## Mock Mode Configuration

### 1. Mock Mode Settings
```javascript
const MockModeConfig = {
    // Global mock mode settings
    enabled: process.env.NODE_ENV === 'development' || process.env.MOCK_MODE === 'true',
    
    // Service-specific mock configurations
    services: {
        kubernetes: {
            enabled: !process.env.KUBECONFIG || process.env.KAGENT_MOCK === 'true',
            responses: {
                deploymentDelay: 1000,
                defaultNamespace: 'default',
                mockPodStatuses: ['Running', 'Pending', 'Succeeded']
            }
        },
        openai: {
            enabled: !process.env.OPENAI_API_KEY || process.env.OPENAI_MOCK === 'true',
            responses: {
                apiDelay: 1500,
                randomizeResponses: true,
                includeUsageStats: true
            }
        },
        memory: {
            enabled: !process.env.QDRANT_HOST || process.env.MEMORY_MOCK === 'true',
            responses: {
                maxVectors: 10000,
                searchDelay: 500,
                persistData: false
            }
        }
    },
    
    // Development helpers
    development: {
        logMockCalls: true,
        showMockWarnings: true,
        includeDebugInfo: true
    }
};
```

### 2. Mock Mode Status Endpoint
```javascript
// Mock mode status endpoint
app.get('/mock-status', (req, res) => {
    const mockStatus = MockModeDetector.detectMockModes();
    
    // Add configuration information
    mockStatus.configuration = MockModeConfig;
    
    // Add usage statistics
    mockStatus.statistics = {
        mockCalls: getMockCallStatistics(),
        realCalls: getRealCallStatistics(),
        performance: getMockPerformanceStats()
    };
    
    res.json(mockStatus);
});

// Mock mode toggle endpoint (development only)
app.post('/mock-mode/:service/:action', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Mock mode toggle only available in development' });
    }
    
    const { service, action } = req.params;
    const validServices = ['kubernetes', 'openai', 'memory'];
    const validActions = ['enable', 'disable'];
    
    if (!validServices.includes(service) || !validActions.includes(action)) {
        return res.status(400).json({ error: 'Invalid service or action' });
    }
    
    // Toggle mock mode for service
    const envVar = `${service.toUpperCase()}_MOCK`;
    process.env[envVar] = action === 'enable' ? 'true' : 'false';
    
    res.json({
        service,
        action,
        mockMode: action === 'enable',
        message: `Mock mode ${action}d for ${service}`
    });
});
```

## Mock Data Management

### 1. Mock Data Sources
```javascript
const MockDataManager = {
    // Load mock data from files or generate dynamically
    loadMockData(service, dataType) {
        const mockDataPath = `./mock-data/${service}/${dataType}.json`;
        
        try {
            if (require('fs').existsSync(mockDataPath)) {
                return require(mockDataPath);
            }
        } catch (error) {
            console.warn(`Failed to load mock data from ${mockDataPath}:`, error.message);
        }
        
        // Fallback to generated mock data
        return this.generateMockData(service, dataType);
    },
    
    generateMockData(service, dataType) {
        switch (service) {
            case 'kubernetes':
                return this.generateKubernetesMockData(dataType);
            case 'openai':
                return this.generateOpenAIMockData(dataType);
            case 'memory':
                return this.generateMemoryMockData(dataType);
            default:
                return {};
        }
    },
    
    generateKubernetesMockData(dataType) {
        switch (dataType) {
            case 'agents':
                return Array.from({ length: 5 }, (_, i) => ({
                    id: `mock-agent-${i + 1}`,
                    name: `agent-${i + 1}`,
                    status: 'Running',
                    created: new Date(Date.now() - Math.random() * 86400000).toISOString()
                }));
            case 'namespaces':
                return ['default', 'autoweave-system', 'kube-system'];
            default:
                return [];
        }
    }
};
```

### 2. Mock Performance Optimization
```javascript
const MockPerformanceOptimizer = {
    // Cache mock responses for better performance
    responseCache: new Map(),
    cacheTimeout: 30000, // 30 seconds
    
    getCachedResponse(key) {
        const cached = this.responseCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    },
    
    setCachedResponse(key, data) {
        this.responseCache.set(key, {
            data,
            timestamp: Date.now()
        });
    },
    
    // Simulate realistic delays
    async simulateDelay(service, operation) {
        const delays = {
            kubernetes: { deploy: 2000, status: 500, delete: 1000 },
            openai: { chat: 1500, models: 300 },
            memory: { search: 800, upsert: 600 }
        };
        
        const delay = delays[service]?.[operation] || 500;
        const variance = delay * 0.3; // 30% variance
        const actualDelay = delay + (Math.random() - 0.5) * variance;
        
        await new Promise(resolve => setTimeout(resolve, actualDelay));
    }
};
```

## Mock Mode Validation

### 1. Mock Response Validation
```javascript
const MockValidator = {
    validateMockResponse(service, operation, response) {
        const schemas = {
            kubernetes: {
                deploy: {
                    required: ['id', 'status', 'createdAt'],
                    optional: ['name', 'namespace', 'pods']
                },
                status: {
                    required: ['id', 'status', 'lastUpdate'],
                    optional: ['phase', 'pods', 'events']
                }
            },
            openai: {
                chat: {
                    required: ['choices', 'usage', 'model'],
                    optional: ['id', 'created']
                }
            }
        };
        
        const schema = schemas[service]?.[operation];
        if (!schema) return true;
        
        // Validate required fields
        for (const field of schema.required) {
            if (!(field in response)) {
                console.warn(`Mock response missing required field: ${field}`);
                return false;
            }
        }
        
        return true;
    }
};
```

## Usage Examples

### 1. Check Mock Mode Status
```javascript
// Check if service is in mock mode
const mockStatus = MockModeDetector.detectMockModes();

if (mockStatus.services.kubernetes.mockMode) {
    console.log('⚠️  Kubernetes in mock mode - agents will not be deployed');
}

if (mockStatus.overall.percentage > 50) {
    console.log(`🎭 System running in ${mockStatus.overall.percentage}% mock mode`);
}
```

### 2. Conditional Behavior Based on Mock Mode
```javascript
// Conditional behavior based on mock mode
async function createAgent(description) {
    const mockStatus = MockModeDetector.detectMockModes();
    
    if (mockStatus.services.openai.mockMode) {
        console.log('🎭 Using mock OpenAI responses');
        // Show user that responses are simulated
    }
    
    if (mockStatus.services.kubernetes.mockMode) {
        console.log('🎭 Agent will not be deployed to real Kubernetes');
        // Adjust user expectations
    }
    
    // Proceed with agent creation
    return await agentWeaver.createAgent(description);
}
```

### 3. Mock Mode Development Tools
```bash
#!/bin/bash
# Mock mode management script

# Enable full mock mode for development
enable_full_mock() {
    export KAGENT_MOCK=true
    export OPENAI_MOCK=true
    export MEMORY_MOCK=true
    echo "🎭 Full mock mode enabled"
}

# Disable all mock modes
disable_all_mocks() {
    unset KAGENT_MOCK
    unset OPENAI_MOCK
    unset MEMORY_MOCK
    echo "✅ All mock modes disabled"
}

# Show current mock status
show_mock_status() {
    curl -s http://localhost:3000/mock-status | jq '.services'
}

case "$1" in
    enable)
        enable_full_mock
        ;;
    disable)
        disable_all_mocks
        ;;
    status)
        show_mock_status
        ;;
    *)
        echo "Usage: $0 {enable|disable|status}"
        ;;
esac
```

Cette référence complète du mode mock permet à AutoWeave de fonctionner de manière prévisible même lorsque les services externes ne sont pas disponibles, facilitant grandement le développement et les tests.