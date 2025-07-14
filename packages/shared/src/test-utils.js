/**
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
