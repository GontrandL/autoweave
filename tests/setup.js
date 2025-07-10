const { Logger } = require('../src/utils/logger');

// Disable logging during tests
Logger.setLevel('error');

// Global test timeout
jest.setTimeout(300000); // 5 minutes pour les tests E2E

// Setup global test helpers
global.testHelpers = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    waitFor: async (condition, timeout = 10000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (await condition()) return true;
            await global.testHelpers.sleep(100);
        }
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
};

// Cleanup function for tests
global.cleanupTestResources = async () => {
    // Add cleanup logic for test resources
    console.log('Cleaning up test resources...');
};

afterAll(async () => {
    await global.cleanupTestResources();
});