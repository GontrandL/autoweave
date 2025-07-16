/**
 * Jest setup file for AutoWeave testing
 * This file runs before all tests and configures the testing environment
 */

import '@testing-library/jest-dom';

// Increase timeout for longer running tests
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in test output

// Global test setup
beforeAll(async () => {
  // Global setup code here
  console.log('🧪 AutoWeave Test Suite Starting...');
});

afterAll(async () => {
  // Global cleanup code here
  console.log('✅ AutoWeave Test Suite Complete');
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(), // Mock console.log
  debug: jest.fn(), // Mock console.debug
  info: jest.fn(), // Mock console.info
  warn: jest.fn(), // Mock console.warn
  error: jest.fn(), // Mock console.error
};

// Mock fetch for HTTP tests
global.fetch = jest.fn();

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});