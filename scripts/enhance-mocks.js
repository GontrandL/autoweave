#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function enhanceMocks() {
    console.log('🔧 Enhancing mock configurations...\n');
    
    // Create mock configuration file
    const mockConfig = {
        enableMocks: process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCKS === 'true',
        mockDefaults: {
            mem0: {
                apiKey: 'test-api-key',
                baseUrl: 'http://localhost:8000',
                responses: {
                    health: { status: 'healthy', mode: 'mock' },
                    memory: { id: 'mock-memory-id', content: 'Mock memory content' }
                }
            },
            memgraph: {
                host: 'localhost',
                port: 7687,
                responses: {
                    topology: { nodes: 10, edges: 15, status: 'connected' }
                }
            },
            redis: {
                host: 'localhost',
                port: 6379,
                responses: {
                    cached: true,
                    ttl: 3600
                }
            }
        }
    };
    
    // Save mock configuration
    await fs.writeFile(
        path.join('packages', 'shared', 'src', 'mock-config.js'),
        `/**
 * Mock Configuration for AutoWeave
 * Centralizes all mock settings and responses
 */

const mockConfig = ${JSON.stringify(mockConfig, null, 2)};

// Helper to check if mocks should be enabled
mockConfig.shouldUseMock = (serviceName) => {
    if (mockConfig.enableMocks) return true;
    
    // Check service-specific environment variables
    const envVar = \`MOCK_\${serviceName.toUpperCase()}\`;
    return process.env[envVar] === 'true';
};

// Helper to get mock response
mockConfig.getMockResponse = (service, operation) => {
    const serviceConfig = mockConfig.mockDefaults[service];
    if (!serviceConfig || !serviceConfig.responses) {
        return null;
    }
    return serviceConfig.responses[operation];
};

module.exports = mockConfig;
`
    );
    
    console.log('✅ Created mock configuration file');
    
    // Create environment validator
    const envValidator = `/**
 * Environment Configuration Validator
 * Ensures all required environment variables are set
 */

class EnvironmentValidator {
    constructor() {
        this.requiredVars = {
            // Core
            'NODE_ENV': { default: 'development', description: 'Environment mode' },
            'PORT': { default: '3000', description: 'Server port' },
            
            // AI Providers
            'OPENAI_API_KEY': { required: true, description: 'OpenAI API key' },
            
            // Memory Systems
            'MEM0_API_KEY': { required: false, description: 'mem0 API key' },
            'QDRANT_HOST': { default: 'localhost', description: 'Qdrant host' },
            'MEMGRAPH_HOST': { default: 'localhost', description: 'Memgraph host' },
            'REDIS_HOST': { default: 'localhost', description: 'Redis host' },
            
            // Mock Settings
            'ENABLE_MOCKS': { default: 'false', description: 'Enable mock mode globally' },
            'MOCK_MEM0': { default: 'false', description: 'Mock mem0 service' },
            'MOCK_MEMGRAPH': { default: 'false', description: 'Mock Memgraph service' },
            'MOCK_REDIS': { default: 'false', description: 'Mock Redis service' }
        };
    }
    
    validate() {
        const errors = [];
        const warnings = [];
        
        for (const [varName, config] of Object.entries(this.requiredVars)) {
            const value = process.env[varName];
            
            if (!value && config.required) {
                errors.push(\`Missing required environment variable: \${varName} - \${config.description}\`);
            } else if (!value && config.default) {
                process.env[varName] = config.default;
                warnings.push(\`Using default value for \${varName}: \${config.default}\`);
            }
        }
        
        return { errors, warnings };
    }
    
    generateEnvTemplate() {
        const lines = ['# AutoWeave Environment Configuration\\n'];
        
        for (const [varName, config] of Object.entries(this.requiredVars)) {
            lines.push(\`# \${config.description}\`);
            if (config.required) {
                lines.push(\`# REQUIRED\`);
            }
            lines.push(\`\${varName}=\${config.default || ''}\`);
            lines.push('');
        }
        
        return lines.join('\\n');
    }
}

module.exports = EnvironmentValidator;
`;
    
    await fs.writeFile(
        path.join('packages', 'shared', 'src', 'env-validator.js'),
        envValidator
    );
    
    console.log('✅ Created environment validator');
    
    // Create test utilities
    const testUtils = `/**
 * Test Utilities for AutoWeave
 * Common test helpers and mock factories
 */

const mockLogger = () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    success: jest.fn()
});

const mockMemoryClient = () => ({
    addAgentMemory: jest.fn().mockResolvedValue({ id: 'mock-memory-1' }),
    search: jest.fn().mockResolvedValue([{ memory: 'test', score: 0.9 }]),
    update: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true }),
    health: jest.fn().mockResolvedValue({ status: 'healthy' })
});

const mockGraphClient = () => ({
    createAgent: jest.fn().mockResolvedValue({ id: 'mock-agent-1' }),
    linkAgentToUser: jest.fn().mockResolvedValue({ success: true }),
    findRelatedAgents: jest.fn().mockResolvedValue([]),
    getSystemTopology: jest.fn().mockResolvedValue({ nodes: 5, edges: 10 })
});

const mockRedisClient = () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0)
});

const createTestContext = () => ({
    logger: mockLogger(),
    memoryClient: mockMemoryClient(),
    graphClient: mockGraphClient(),
    redisClient: mockRedisClient()
});

module.exports = {
    mockLogger,
    mockMemoryClient,
    mockGraphClient,
    mockRedisClient,
    createTestContext
};
`;
    
    await fs.writeFile(
        path.join('packages', 'shared', 'src', 'test-utils.js'),
        testUtils
    );
    
    console.log('✅ Created test utilities');
    
    // Update package.json to export these utilities
    const sharedPackageJson = JSON.parse(
        await fs.readFile(path.join('packages', 'shared', 'package.json'), 'utf8')
    );
    
    sharedPackageJson.exports = {
        '.': './src/index.js',
        './mock-config': './src/mock-config.js',
        './env-validator': './src/env-validator.js',
        './test-utils': './src/test-utils.js'
    };
    
    await fs.writeFile(
        path.join('packages', 'shared', 'package.json'),
        JSON.stringify(sharedPackageJson, null, 2) + '\n'
    );
    
    console.log('✅ Updated shared package exports');
    
    // Create shared index.js
    const sharedIndex = `/**
 * @autoweave/shared - Shared utilities and helpers
 */

// Re-export utilities
const utilsPath = './utils';
const fs = require('fs');
const path = require('path');

const exports = {};

// Dynamically export all utils
if (fs.existsSync(path.join(__dirname, 'utils'))) {
    const files = fs.readdirSync(path.join(__dirname, 'utils'));
    files.forEach(file => {
        if (file.endsWith('.js')) {
            const name = file.replace('.js', '');
            const moduleName = name.charAt(0).toUpperCase() + name.slice(1);
            try {
                exports[moduleName] = require(path.join(__dirname, 'utils', file));
            } catch (error) {
                console.warn(\`Failed to load utility \${file}:\`, error.message);
            }
        }
    });
}

// Export mock configuration and test utilities
exports.mockConfig = require('./mock-config');
exports.EnvironmentValidator = require('./env-validator');
exports.testUtils = require('./test-utils');

module.exports = exports;
`;
    
    await fs.writeFile(
        path.join('packages', 'shared', 'src', 'index.js'),
        sharedIndex
    );
    
    console.log('✅ Created shared index.js');
}

// Run the enhancer
enhanceMocks().catch(console.error);