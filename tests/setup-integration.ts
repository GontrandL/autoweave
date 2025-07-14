/**
 * Integration Test Setup
 * Configuration for integration tests with real services
 */

import { createClient, RedisClientType } from 'redis';

// Global Redis client for integration tests
let testRedisClient: RedisClientType;

// Setup Redis connection for integration tests
beforeAll(async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  testRedisClient = createClient({ 
    url: redisUrl,
    database: 15, // Use test database
  });
  
  try {
    await testRedisClient.connect();
    await testRedisClient.ping();
    console.log('✓ Redis connection established for integration tests');
  } catch (error) {
    console.error('✗ Redis connection failed:', error.message);
    console.log('Ensure Redis is running: docker run -d -p 6379:6379 redis:7-alpine');
    throw error;
  }
}, 30000);

// Cleanup Redis after tests
afterAll(async () => {
  if (testRedisClient) {
    await testRedisClient.disconnect();
  }
});

// Clean Redis state before each test
beforeEach(async () => {
  if (testRedisClient?.isReady) {
    await testRedisClient.flushDb();
  }
});

// Mock USB with real EventEmitter for integration tests
jest.mock('usb', () => {
  const { EventEmitter } = require('events');
  const usbEmitter = new EventEmitter();
  
  return {
    on: (event: string, handler: Function) => usbEmitter.on(event, handler),
    off: (event: string, handler: Function) => usbEmitter.off(event, handler),
    getDeviceList: jest.fn(() => []),
    findBySerialNumber: jest.fn(),
    findByIds: jest.fn(),
    _mockEmitter: usbEmitter, // Expose for tests
  };
});

// Increase timeout for integration tests
jest.setTimeout(60000); // 60 seconds

// Helper to get test Redis client
global.getTestRedisClient = () => testRedisClient;

// Integration test utilities
global.integrationTestUtils = {
  async waitForRedisMessage(stream: string, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const messages = await testRedisClient.xRead([
        { key: stream, id: '0' }
      ], { COUNT: 1, BLOCK: 100 });
      
      if (messages && messages[0]?.messages.length > 0) {
        return messages[0].messages[0];
      }
    }
    throw new Error(`No message received on stream ${stream} within ${timeout}ms`);
  },

  async cleanupRedisStreams() {
    const streams = ['aw:hotplug', 'aw:plugins', 'aw:events'];
    for (const stream of streams) {
      try {
        await testRedisClient.del(stream);
      } catch (error) {
        // Stream might not exist
      }
    }
  },

  createMockUSBDevice(vendorId: number, productId: number, extras: any = {}) {
    return {
      deviceDescriptor: {
        idVendor: vendorId,
        idProduct: productId,
        iManufacturer: 1,
        iProduct: 2,
        iSerialNumber: 3,
        ...extras,
      },
      open: jest.fn(),
      close: jest.fn(),
      getStringDescriptor: jest.fn((index, cb) => {
        const strings = ['', 'Test Vendor', 'Test Product', `SN-${Date.now()}`];
        setTimeout(() => cb(null, strings[index] || 'Unknown'), 10);
      }),
    };
  },
};

export {};