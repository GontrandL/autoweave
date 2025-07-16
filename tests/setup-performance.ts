/**
 * Performance Test Setup
 * Configuration for performance and load testing
 */

import { performance } from 'perf_hooks';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  loadTimeTarget: 250, // ms
  memoryLeakTarget: 1024 * 1024, // 1MB
  latencyTarget: 100, // ms
  shutdownTarget: 5000, // ms
  iterations: {
    load: 1000,
    memory: 1000,
    concurrent: 50,
  },
};

// Global performance tracking
let performanceMetrics: {
  testName: string;
  startTime: number;
  endTime?: number;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter?: NodeJS.MemoryUsage;
  iterations?: number;
  measurements: number[];
} | null = null;

// Performance test utilities
global.performanceTestUtils = {
  startMeasurement(testName: string, iterations?: number) {
    if (global.gc) global.gc();
    
    performanceMetrics = {
      testName,
      startTime: performance.now(),
      memoryBefore: process.memoryUsage(),
      iterations,
      measurements: [],
    };
  },

  addMeasurement(value: number) {
    if (performanceMetrics) {
      performanceMetrics.measurements.push(value);
    }
  },

  endMeasurement() {
    if (!performanceMetrics) {
      throw new Error('No measurement started');
    }

    if (global.gc) global.gc();
    
    performanceMetrics.endTime = performance.now();
    performanceMetrics.memoryAfter = process.memoryUsage();
    
    const results = {
      duration: performanceMetrics.endTime - performanceMetrics.startTime,
      memoryIncrease: performanceMetrics.memoryAfter.heapUsed - performanceMetrics.memoryBefore.heapUsed,
      measurements: performanceMetrics.measurements,
      average: performanceMetrics.measurements.length > 0 
        ? performanceMetrics.measurements.reduce((a, b) => a + b) / performanceMetrics.measurements.length
        : 0,
      p95: performanceMetrics.measurements.length > 0
        ? performanceMetrics.measurements.sort((a, b) => a - b)[Math.floor(performanceMetrics.measurements.length * 0.95)]
        : 0,
      max: performanceMetrics.measurements.length > 0
        ? Math.max(...performanceMetrics.measurements)
        : 0,
    };

    console.log(`Performance Results for ${performanceMetrics.testName}:`, {
      duration: `${results.duration.toFixed(2)}ms`,
      memoryIncrease: `${(results.memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      average: `${results.average.toFixed(2)}ms`,
      p95: `${results.p95.toFixed(2)}ms`,
      max: `${results.max.toFixed(2)}ms`,
      iterations: performanceMetrics.iterations || performanceMetrics.measurements.length,
    });

    performanceMetrics = null;
    return results;
  },

  async measureAsyncOperation<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  },

  async measureMultipleOperations<T>(
    operation: () => Promise<T>,
    iterations: number,
    concurrency = 1
  ): Promise<{ results: T[]; durations: number[]; stats: any }> {
    const durations: number[] = [];
    const results: T[] = [];

    if (concurrency === 1) {
      // Sequential execution
      for (let i = 0; i < iterations; i++) {
        const { result, duration } = await this.measureAsyncOperation(operation);
        results.push(result);
        durations.push(duration);
      }
    } else {
      // Concurrent execution
      const batches = Math.ceil(iterations / concurrency);
      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from(
          { length: Math.min(concurrency, iterations - batch * concurrency) },
          () => this.measureAsyncOperation(operation)
        );
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.map(r => r.result));
        durations.push(...batchResults.map(r => r.duration));
      }
    }

    const stats = {
      average: durations.reduce((a, b) => a + b) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      p50: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.5)],
      p95: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)],
      p99: durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.99)],
    };

    return { results, durations, stats };
  },

  config: PERFORMANCE_CONFIG,
};

// Custom performance matchers
expect.extend({
  toMeetLoadTimeTarget(received: number) {
    const target = PERFORMANCE_CONFIG.loadTimeTarget;
    const pass = received <= target;
    return {
      message: () => pass
        ? `expected load time ${received}ms not to meet target ${target}ms`
        : `expected load time ${received}ms to meet target ${target}ms`,
      pass,
    };
  },

  toNotLeakMemory(received: number, cycles: number) {
    const target = PERFORMANCE_CONFIG.memoryLeakTarget;
    const pass = received <= target;
    return {
      message: () => pass
        ? `expected memory increase ${(received / 1024 / 1024).toFixed(2)}MB not to be within leak threshold for ${cycles} cycles`
        : `expected memory increase ${(received / 1024 / 1024).toFixed(2)}MB to be within leak threshold ${(target / 1024 / 1024).toFixed(2)}MB for ${cycles} cycles`,
      pass,
    };
  },

  toMeetLatencyTarget(received: number) {
    const target = PERFORMANCE_CONFIG.latencyTarget;
    const pass = received <= target;
    return {
      message: () => pass
        ? `expected latency ${received}ms not to meet target ${target}ms`
        : `expected latency ${received}ms to meet target ${target}ms`,
      pass,
    };
  },
});

// Increase timeout for performance tests
jest.setTimeout(300000); // 5 minutes for performance tests

// Force garbage collection before each performance test
beforeEach(() => {
  if (global.gc) {
    global.gc();
  }
});

// Monitor memory usage during performance tests
let memoryMonitor: NodeJS.Timeout | null = null;
const memoryReadings: number[] = [];

beforeEach(() => {
  memoryReadings.length = 0;
  
  // Start memory monitoring
  memoryMonitor = setInterval(() => {
    memoryReadings.push(process.memoryUsage().heapUsed);
  }, 1000);
});

afterEach(() => {
  if (memoryMonitor) {
    clearInterval(memoryMonitor);
    memoryMonitor = null;
  }

  // Check for memory growth during test
  if (memoryReadings.length > 2) {
    const initialMemory = memoryReadings[0];
    const finalMemory = memoryReadings[memoryReadings.length - 1];
    const growthRate = (finalMemory - initialMemory) / initialMemory;

    if (growthRate > 0.5) { // 50% growth
      console.warn(
        `Potential memory leak detected: ${(growthRate * 100).toFixed(1)}% growth during test`
      );
    }
  }
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toMeetLoadTimeTarget(): R;
      toNotLeakMemory(cycles: number): R;
      toMeetLatencyTarget(): R;
    }
  }

  var performanceTestUtils: {
    startMeasurement(testName: string, iterations?: number): void;
    addMeasurement(value: number): void;
    endMeasurement(): any;
    measureAsyncOperation<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }>;
    measureMultipleOperations<T>(
      operation: () => Promise<T>,
      iterations: number,
      concurrency?: number
    ): Promise<{ results: T[]; durations: number[]; stats: any }>;
    config: typeof PERFORMANCE_CONFIG;
  };
}

export {};