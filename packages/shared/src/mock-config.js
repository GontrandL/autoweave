/**
 * Mock Configuration for AutoWeave
 * Centralizes all mock settings and responses
 */

const mockConfig = {
  "enableMocks": false,
  "mockDefaults": {
    "mem0": {
      "apiKey": "test-api-key",
      "baseUrl": "http://localhost:8000",
      "responses": {
        "health": {
          "status": "healthy",
          "mode": "mock"
        },
        "memory": {
          "id": "mock-memory-id",
          "content": "Mock memory content"
        }
      }
    },
    "memgraph": {
      "host": "localhost",
      "port": 7687,
      "responses": {
        "topology": {
          "nodes": 10,
          "edges": 15,
          "status": "connected"
        }
      }
    },
    "redis": {
      "host": "localhost",
      "port": 6379,
      "responses": {
        "cached": true,
        "ttl": 3600
      }
    }
  }
};

// Helper to check if mocks should be enabled
mockConfig.shouldUseMock = (serviceName) => {
    if (mockConfig.enableMocks) return true;
    
    // Check service-specific environment variables
    const envVar = `MOCK_${serviceName.toUpperCase()}`;
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
