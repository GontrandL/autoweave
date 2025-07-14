/**
 * Sprint 1 End-to-End Integration Tests
 * Tests the complete flow from USB events to plugin execution
 */

import { EnhancedUSBDaemon } from '../../packages/usb-daemon/src/enhanced-usb-daemon';
import { EnhancedPluginManager } from '../../packages/plugin-loader/src/enhanced-plugin-manager';
import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as usb from 'usb';

// Mock USB module
jest.mock('usb');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_PLUGIN_DIR = path.join(__dirname, 'fixtures/e2e-plugins');

describe('Sprint 1 End-to-End Integration', () => {
  let usbDaemon: EnhancedUSBDaemon;
  let pluginManager: EnhancedPluginManager;
  let redisClient: RedisClientType;
  let usbEmitter: EventEmitter;

  beforeAll(async () => {
    // Setup Redis
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
    
    // Clear any existing test data
    await redisClient.flushdb();
    
    // Setup test plugin directory
    await fs.mkdir(TEST_PLUGIN_DIR, { recursive: true });
    await createTestPlugins();
  });

  afterAll(async () => {
    await redisClient?.disconnect();
    await fs.rm(TEST_PLUGIN_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Setup USB mock
    usbEmitter = new EventEmitter();
    (usb as any).on = jest.fn((event: string, handler: Function) => {
      usbEmitter.on(event, handler);
    });
    (usb as any).getDeviceList = jest.fn(() => []);

    // Initialize USB daemon
    usbDaemon = new EnhancedUSBDaemon({
      redis: { url: REDIS_URL },
      monitoring: { enabled: true },
      batch: { size: 5, flushInterval: 100 },
    });

    // Initialize plugin manager
    pluginManager = new EnhancedPluginManager({
      pluginDirectory: TEST_PLUGIN_DIR,
      redis: redisClient,
      watchForChanges: true,
      validationStrict: true,
    });

    // Start both systems
    await usbDaemon.start();
    await pluginManager.initialize();
  });

  afterEach(async () => {
    await usbDaemon?.stop();
    await pluginManager?.shutdown();
  });

  describe('USB event to plugin execution flow', () => {
    it('should trigger plugin execution on USB device attachment', async () => {
      // Load USB event handler plugin
      const usbHandlerPath = path.join(TEST_PLUGIN_DIR, 'usb-event-handler');
      await pluginManager.loadPlugin(usbHandlerPath);

      // Mock device
      const mockDevice = createMockDevice('0x1234', '0x5678', 'Test Vendor', 'Test Product');

      // Capture executed actions
      const executedActions: any[] = [];
      const originalExecute = pluginManager.executePluginAction.bind(pluginManager);
      pluginManager.executePluginAction = async function(pluginId: string, action: string, payload: any) {
        executedActions.push({ pluginId, action, payload });
        return originalExecute(pluginId, action, payload);
      };

      // Trigger USB attachment
      usbEmitter.emit('attach', mockDevice);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify plugin was triggered
      expect(executedActions).toContainEqual(
        expect.objectContaining({
          pluginId: 'usb-event-handler',
          action: 'onDeviceAttached',
          payload: expect.objectContaining({
            vendor: '0x1234',
            product: '0x5678',
          }),
        })
      );
    });

    it('should handle plugin hot-reload during USB events', async () => {
      // Load initial plugin
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'hot-reload-usb-handler');
      await pluginManager.loadPlugin(pluginPath);

      // Generate USB events
      const mockDevice = createMockDevice('0xAAAA', '0xBBBB', 'Hot', 'Reload');
      usbEmitter.emit('attach', mockDevice);

      // Wait for initial processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Update plugin code
      await updatePluginCode(
        pluginPath,
        'hot-reload-usb-handler',
        '1.0.1',
        `
        module.exports = {
          name: 'hot-reload-usb-handler',
          version: '1.0.1',
          onDeviceAttached: async (device) => {
            return { handled: true, version: '1.0.1', device: device.deviceName };
          },
        };
        `
      );

      // Wait for hot-reload
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate new USB event
      usbEmitter.emit('attach', mockDevice);

      // Wait for processing with new version
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify plugin was hot-reloaded
      const plugin = pluginManager.getPlugin('hot-reload-usb-handler');
      expect(plugin?.manifest.version).toBe('1.0.1');
    });

    it('should maintain security boundaries during USB event processing', async () => {
      // Load restricted plugin
      const restrictedPath = path.join(TEST_PLUGIN_DIR, 'restricted-usb-handler');
      await pluginManager.loadPlugin(restrictedPath);

      const mockDevice = createMockDevice('0x9999', '0x8888', 'Security', 'Test');
      
      // Capture any permission violations
      const violations: any[] = [];
      pluginManager.on('permission-violation', (violation) => {
        violations.push(violation);
      });

      usbEmitter.emit('attach', mockDevice);

      await new Promise(resolve => setTimeout(resolve, 300));

      // Plugin should have attempted restricted operations
      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toMatchObject({
        pluginId: 'restricted-usb-handler',
        permission: expect.stringContaining('fs:write:/etc'),
      });
    });
  });

  describe('concurrent load and processing', () => {
    it('should handle multiple plugins and USB events concurrently', async () => {
      // Load multiple plugins
      const pluginNames = ['concurrent-handler-1', 'concurrent-handler-2', 'concurrent-handler-3'];
      const loadPromises = pluginNames.map(name => 
        pluginManager.loadPlugin(path.join(TEST_PLUGIN_DIR, name))
      );
      
      await Promise.all(loadPromises);

      // Generate multiple USB events
      const devices = Array.from({ length: 10 }, (_, i) => 
        createMockDevice(`0x${1000 + i}`, `0x${2000 + i}`, `Vendor${i}`, `Product${i}`)
      );

      const eventPromises = devices.map(device => {
        usbEmitter.emit('attach', device);
        return new Promise(resolve => setTimeout(resolve, 10));
      });

      await Promise.all(eventPromises);

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify all events were processed
      const stats = {
        usb: usbDaemon.getMetrics(),
        plugins: pluginManager.getStats(),
      };

      expect(stats.usb.totalEvents).toBeGreaterThanOrEqual(10);
      expect(stats.plugins.totalExecutions).toBeGreaterThan(0);
    });

    it('should gracefully handle plugin failures during USB processing', async () => {
      // Load a plugin that will fail
      const faultyPath = path.join(TEST_PLUGIN_DIR, 'faulty-usb-handler');
      await pluginManager.loadPlugin(faultyPath);

      // Load a healthy plugin
      const healthyPath = path.join(TEST_PLUGIN_DIR, 'healthy-usb-handler');
      await pluginManager.loadPlugin(healthyPath);

      const mockDevice = createMockDevice('0x1111', '0x2222', 'Test', 'Device');
      
      // Trigger event that will cause faulty plugin to fail
      usbEmitter.emit('attach', mockDevice);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Healthy plugin should still work
      const healthyPlugin = pluginManager.getPlugin('healthy-usb-handler');
      expect(healthyPlugin?.status).toBe('loaded');

      // Faulty plugin should be marked as failed
      const faultyPlugin = pluginManager.getPlugin('faulty-usb-handler');
      expect(faultyPlugin?.status).toBe('failed');
    });
  });

  describe('performance under load', () => {
    it('should maintain latency targets under sustained load', async () => {
      // Load performance test plugin
      const perfPath = path.join(TEST_PLUGIN_DIR, 'performance-usb-handler');
      await pluginManager.loadPlugin(perfPath);

      const eventCount = 100;
      const startTime = Date.now();
      const latencies: number[] = [];

      // Generate sustained load
      for (let i = 0; i < eventCount; i++) {
        const device = createMockDevice(`0x${i}`, `0x${i + 1000}`, `Load${i}`, `Test${i}`);
        const eventStart = Date.now();
        
        usbEmitter.emit('attach', device);
        
        // Measure latency for subset of events
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
          latencies.push(Date.now() - eventStart);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const totalTime = Date.now() - startTime;
      const eventsPerSecond = (eventCount / totalTime) * 1000;
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log('Performance metrics:', {
        eventsPerSecond: eventsPerSecond.toFixed(2),
        avgLatency: avgLatency.toFixed(2),
        totalEvents: eventCount,
      });

      // Performance targets
      expect(eventsPerSecond).toBeGreaterThan(50); // At least 50 events/sec
      expect(avgLatency).toBeLessThan(100); // Under 100ms latency
    });

    it('should not leak memory during extended operation', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Load memory test plugin
      const memTestPath = path.join(TEST_PLUGIN_DIR, 'memory-test-handler');
      await pluginManager.loadPlugin(memTestPath);

      // Run 1000 USB events
      for (let i = 0; i < 1000; i++) {
        const device = createMockDevice(`0x${i % 100}`, `0x${(i + 100) % 100}`, 'Mem', 'Test');
        usbEmitter.emit(i % 2 === 0 ? 'attach' : 'detach', device);
        
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 50));
          if (global.gc) global.gc();
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log('Memory usage:', {
        initial: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        final: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        increase: `${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`,
      });

      // Should not increase by more than 10MB for 1000 events
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('error recovery and resilience', () => {
    it('should recover from Redis connection loss', async () => {
      // Load a plugin
      const resilientPath = path.join(TEST_PLUGIN_DIR, 'resilient-handler');
      await pluginManager.loadPlugin(resilientPath);

      // Simulate Redis disconnect
      await redisClient.disconnect();

      // Try to process USB event (should queue/buffer)
      const device = createMockDevice('0xDEAD', '0xBEEF', 'Lost', 'Connection');
      usbEmitter.emit('attach', device);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Reconnect Redis
      await redisClient.connect();

      // Process another event (should work)
      const device2 = createMockDevice('0xCAFE', '0xBABE', 'Recovered', 'Connection');
      usbEmitter.emit('attach', device2);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Both events should eventually be processed
      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 10 });

      expect(messages).toBeDefined();
      expect(messages![0].messages.length).toBeGreaterThan(0);
    });

    it('should handle graceful shutdown with pending work', async () => {
      // Load plugins
      const shutdownPath = path.join(TEST_PLUGIN_DIR, 'shutdown-test-handler');
      await pluginManager.loadPlugin(shutdownPath);

      // Generate events
      for (let i = 0; i < 10; i++) {
        const device = createMockDevice(`0x${i}`, `0x${i + 100}`, 'Shutdown', 'Test');
        usbEmitter.emit('attach', device);
      }

      // Immediate shutdown
      const shutdownStart = Date.now();
      await Promise.all([
        usbDaemon.stop(),
        pluginManager.shutdown(),
      ]);
      const shutdownTime = Date.now() - shutdownStart;

      // Shutdown should complete within 5 seconds
      expect(shutdownTime).toBeLessThan(5000);

      // No pending tasks should remain
      const usbStats = usbDaemon.getMetrics();
      const pluginStats = pluginManager.getStats();
      
      expect(usbStats.pendingEvents).toBe(0);
      expect(pluginStats.activeWorkers).toBe(0);
    });
  });
});

// Helper functions
function createMockDevice(vendorId: string, productId: string, manufacturer: string, product: string) {
  return {
    deviceDescriptor: {
      idVendor: parseInt(vendorId, 16),
      idProduct: parseInt(productId, 16),
      iManufacturer: 1,
      iProduct: 2,
      iSerialNumber: 3,
    },
    open: jest.fn(),
    close: jest.fn(),
    getStringDescriptor: jest.fn((index, cb) => {
      const strings = ['', manufacturer, product, `SN-${Date.now()}`];
      cb(null, strings[index]);
    }),
  };
}

async function createTestPlugins() {
  // USB Event Handler Plugin
  await createPlugin('usb-event-handler', {
    name: 'usb-event-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:write', 'queue:subscribe'],
  }, `
    module.exports = {
      name: 'usb-event-handler',
      version: '1.0.0',
      onDeviceAttached: async (device) => {
        return { handled: true, device: device.deviceName };
      },
      onDeviceDetached: async (device) => {
        return { handled: true, device: device.deviceName };
      },
    };
  `);

  // Hot Reload Handler
  await createPlugin('hot-reload-usb-handler', {
    name: 'hot-reload-usb-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'],
  }, `
    module.exports = {
      name: 'hot-reload-usb-handler',
      version: '1.0.0',
      onDeviceAttached: async (device) => {
        return { handled: true, version: '1.0.0', device: device.deviceName };
      },
    };
  `);

  // Restricted Handler (for security tests)
  await createPlugin('restricted-usb-handler', {
    name: 'restricted-usb-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'], // Intentionally limited permissions
  }, `
    const fs = require('fs');
    module.exports = {
      name: 'restricted-usb-handler',
      onDeviceAttached: async (device) => {
        try {
          // This should fail due to permissions
          fs.writeFileSync('/etc/malicious.txt', 'hacked');
        } catch (error) {
          // Expected to fail
        }
        return { handled: true };
      },
    };
  `);

  // Concurrent handlers
  for (let i = 1; i <= 3; i++) {
    await createPlugin(`concurrent-handler-${i}`, {
      name: `concurrent-handler-${i}`,
      version: '1.0.0',
      entry: './index.js',
      permissions: ['memory:read'],
    }, `
      module.exports = {
        name: 'concurrent-handler-${i}',
        onDeviceAttached: async (device) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { handled: true, id: ${i} };
        },
      };
    `);
  }

  // Faulty handler
  await createPlugin('faulty-usb-handler', {
    name: 'faulty-usb-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'],
  }, `
    module.exports = {
      name: 'faulty-usb-handler',
      onDeviceAttached: async (device) => {
        throw new Error('Intentional failure');
      },
    };
  `);

  // Healthy handler
  await createPlugin('healthy-usb-handler', {
    name: 'healthy-usb-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'],
  }, `
    module.exports = {
      name: 'healthy-usb-handler',
      onDeviceAttached: async (device) => {
        return { handled: true, healthy: true };
      },
    };
  `);

  // Performance handler
  await createPlugin('performance-usb-handler', {
    name: 'performance-usb-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'],
  }, `
    module.exports = {
      name: 'performance-usb-handler',
      onDeviceAttached: async (device) => {
        // Minimal processing for performance test
        return { handled: true, timestamp: Date.now() };
      },
    };
  `);

  // Memory test handler
  await createPlugin('memory-test-handler', {
    name: 'memory-test-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'],
  }, `
    module.exports = {
      name: 'memory-test-handler',
      onDeviceAttached: async (device) => {
        // Don't hold references to prevent memory leaks
        const result = { handled: true, time: Date.now() };
        return result;
      },
    };
  `);

  // Resilient handler
  await createPlugin('resilient-handler', {
    name: 'resilient-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read', 'queue:subscribe'],
  }, `
    module.exports = {
      name: 'resilient-handler',
      onDeviceAttached: async (device) => {
        return { handled: true, resilient: true };
      },
    };
  `);

  // Shutdown test handler
  await createPlugin('shutdown-test-handler', {
    name: 'shutdown-test-handler',
    version: '1.0.0',
    entry: './index.js',
    permissions: ['memory:read'],
  }, `
    module.exports = {
      name: 'shutdown-test-handler',
      onDeviceAttached: async (device) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { handled: true, shutdown: true };
      },
    };
  `);
}

async function createPlugin(name: string, manifest: any, code: string) {
  const pluginPath = path.join(TEST_PLUGIN_DIR, name);
  await fs.mkdir(pluginPath, { recursive: true });
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    code
  );
}

async function updatePluginCode(pluginPath: string, name: string, version: string, code: string) {
  const manifest = {
    name,
    version,
    entry: './index.js',
    permissions: ['memory:read'],
  };
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    code
  );
}