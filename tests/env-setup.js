/**
 * Environment Setup for Tests
 * Sets up test environment variables and configurations
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Redis configuration for tests
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.REDIS_TEST_DB = '15'; // Use DB 15 for tests

// USB daemon test configuration
process.env.USB_MOCK_MODE = 'true';
process.env.USB_DEBOUNCE_WINDOW = '50'; // Faster for tests
process.env.USB_BATCH_SIZE = '5';
process.env.USB_BATCH_FLUSH_INTERVAL = '100';

// Plugin loader test configuration
process.env.PLUGIN_SANDBOX_ENABLED = 'true';
process.env.PLUGIN_VALIDATION_STRICT = 'true';
process.env.PLUGIN_WORKER_TIMEOUT = '5000';
process.env.PLUGIN_MAX_MEMORY = '128MB';
process.env.PLUGIN_MAX_CPU = '50%';

// Performance test configuration
process.env.PERF_TEST_ITERATIONS = '10';
process.env.PERF_TEST_LOAD_TARGET = '250'; // ms
process.env.PERF_TEST_MEMORY_LIMIT = '1048576'; // 1MB

// Security test configuration
process.env.SECURITY_TEST_TIMEOUT = '10000';
process.env.SECURITY_VIOLATION_ACTION = 'log'; // Don't throw in tests

// Logging configuration
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.LOG_FORMAT = 'json';

// Disable telemetry in tests
process.env.TELEMETRY_DISABLED = 'true';
process.env.METRICS_DISABLED = 'true';

// Enable garbage collection for memory tests
if (typeof global.gc === 'undefined') {
  // Try to expose gc if not already available
  try {
    global.gc = require('vm').runInNewContext('gc');
  } catch (e) {
    // GC not available, tests will note this
    console.warn('Garbage collection not available for memory tests. Run node with --expose-gc for accurate memory testing.');
  }
}