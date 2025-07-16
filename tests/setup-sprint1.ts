/**
 * Sprint 1 Test Setup
 * Global setup for Sprint 1 component tests
 */

import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.USB_MOCK = 'true';
process.env.PLUGIN_SANDBOX = 'true';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress expected error messages during tests
  console.error = jest.fn((message) => {
    if (typeof message === 'string' && (
      message.includes('Permission denied') ||
      message.includes('Sandbox violation') ||
      message.includes('Access denied') ||
      message.includes('Worker crashed')
    )) {
      // Suppress expected errors
      return;
    }
    originalConsoleError(message);
  });

  console.warn = jest.fn((message) => {
    if (typeof message === 'string' && (
      message.includes('Plugin security warning') ||
      message.includes('Performance warning')
    )) {
      // Suppress expected warnings
      return;
    }
    originalConsoleWarn(message);
  });
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  // Log but don't fail tests for expected rejections
  if (reason instanceof Error && (
    reason.message.includes('Permission denied') ||
    reason.message.includes('Timeout') ||
    reason.message.includes('Worker terminated')
  )) {
    return;
  }
  
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global memory usage monitoring for performance tests
let initialMemory: NodeJS.MemoryUsage;

beforeEach(() => {
  if (global.gc) {
    global.gc();
  }
  initialMemory = process.memoryUsage();
});

afterEach(() => {
  if (global.gc) {
    global.gc();
  }
  
  const finalMemory = process.memoryUsage();
  const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  
  // Warn if test increased memory significantly
  if (memoryIncrease > 50 * 1024 * 1024) { // 50MB
    console.warn(`Test may have memory leak: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB increase`);
  }
});

// Custom matchers for Sprint 1 tests
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toBeValidUSBDevice(received: any) {
    const hasRequiredFields = (
      received &&
      typeof received.vendorId === 'number' &&
      typeof received.productId === 'number' &&
      typeof received.devicePath === 'string'
    );
    
    if (hasRequiredFields) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid USB device`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid USB device with vendorId, productId, and devicePath`,
        pass: false,
      };
    }
  },
  
  toHaveValidPluginManifest(received: any) {
    const hasRequiredFields = (
      received &&
      typeof received.name === 'string' &&
      typeof received.version === 'string' &&
      typeof received.entry === 'string'
    );
    
    if (hasRequiredFields) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have a valid plugin manifest`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have a valid plugin manifest with name, version, and entry`,
        pass: false,
      };
    }
  },
  
  toMeetPerformanceTarget(received: number, target: number, metric: string) {
    const pass = received <= target;
    if (pass) {
      return {
        message: () => `expected ${metric} ${received} not to meet performance target ${target}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${metric} ${received} to meet performance target ${target}`,
        pass: false,
      };
    }
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidUSBDevice(): R;
      toHaveValidPluginManifest(): R;
      toMeetPerformanceTarget(target: number, metric: string): R;
    }
  }
}

export {};