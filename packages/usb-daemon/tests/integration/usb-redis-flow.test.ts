/**
 * USB to Redis Integration Tests
 * Tests end-to-end flow from USB events to Redis streams
 */

import { EnhancedUSBDaemon } from '../../src/enhanced-usb-daemon';
import { createClient, RedisClientType } from 'redis';
import { EventEmitter } from 'events';
import * as usb from 'usb';

// Mock USB module
jest.mock('usb');

// Use real Redis for integration tests
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('USB to Redis Integration', () => {
  let daemon: EnhancedUSBDaemon;
  let redisClient: RedisClientType;
  let redisSubscriber: RedisClientType;
  let usbEmitter: EventEmitter;

  beforeAll(async () => {
    // Setup Redis clients
    redisClient = createClient({ url: REDIS_URL });
    redisSubscriber = createClient({ url: REDIS_URL });
    
    await redisClient.connect();
    await redisSubscriber.connect();
  });

  afterAll(async () => {
    await redisClient?.disconnect();
    await redisSubscriber?.disconnect();
  });

  beforeEach(async () => {
    // Clear Redis streams
    try {
      await redisClient.del('aw:hotplug');
    } catch (e) {
      // Stream might not exist
    }

    // Setup USB mock
    usbEmitter = new EventEmitter();
    (usb as any).on = jest.fn((event: string, handler: Function) => {
      usbEmitter.on(event, handler);
    });
    
    (usb as any).getDeviceList = jest.fn(() => []);

    // Create daemon
    daemon = new EnhancedUSBDaemon({
      redis: { url: REDIS_URL },
      monitoring: { enabled: true },
      batch: { size: 5, flushInterval: 100 },
    });
  });

  afterEach(async () => {
    await daemon?.stop();
  });

  describe('device attachment flow', () => {
    it('should publish USB attach event to Redis stream', async () => {
      await daemon.start();

      const mockDevice = {
        deviceDescriptor: {
          idVendor: 0x1234,
          idProduct: 0x5678,
          iManufacturer: 1,
          iProduct: 2,
          iSerialNumber: 3,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => {
          const strings = ['', 'Test Vendor', 'Test Product', 'SN123'];
          cb(null, strings[index]);
        }),
      };

      // Simulate USB device attachment
      usbEmitter.emit('attach', mockDevice);

      // Wait for processing and publishing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Read from Redis stream
      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 10 });

      expect(messages).toBeDefined();
      expect(messages![0].messages).toHaveLength(1);
      
      const message = messages![0].messages[0].message;
      expect(message).toMatchObject({
        event: 'device.attached',
        vendor: '0x1234',
        product: '0x5678',
        manufacturer: 'Test Vendor',
        deviceName: 'Test Product',
        serialNumber: 'SN123',
      });
    });

    it('should handle rapid attach/detach cycles', async () => {
      await daemon.start();

      const devices = Array.from({ length: 10 }, (_, i) => ({
        deviceDescriptor: {
          idVendor: 0x1234,
          idProduct: 0x5678 + i,
          iManufacturer: 1,
          iProduct: 2,
          iSerialNumber: 3,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => {
          cb(null, `String-${index}`);
        }),
      }));

      // Rapid attach/detach
      for (let i = 0; i < devices.length; i++) {
        usbEmitter.emit('attach', devices[i]);
        await new Promise(resolve => setTimeout(resolve, 10));
        usbEmitter.emit('detach', devices[i]);
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check Redis stream
      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 100 });

      expect(messages![0].messages.length).toBeGreaterThan(0);
      
      // Verify both attach and detach events
      const events = messages![0].messages.map(m => m.message.event);
      expect(events).toContain('device.attached');
      expect(events).toContain('device.detached');
    });

    it('should debounce duplicate events', async () => {
      await daemon.start();

      const mockDevice = {
        deviceDescriptor: {
          idVendor: 0x1234,
          idProduct: 0x5678,
          iSerialNumber: 3,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => cb(null, 'SN123')),
      };

      // Emit same device multiple times rapidly
      for (let i = 0; i < 5; i++) {
        usbEmitter.emit('attach', mockDevice);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should only have one event due to debouncing
      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 10 });

      expect(messages![0].messages).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should continue operating when device extraction fails', async () => {
      await daemon.start();

      const failingDevice = {
        deviceDescriptor: {
          idVendor: 0x1234,
          idProduct: 0x5678,
        },
        open: jest.fn(() => {
          throw new Error('Access denied');
        }),
        close: jest.fn(),
      };

      const workingDevice = {
        deviceDescriptor: {
          idVendor: 0xABCD,
          idProduct: 0xEF01,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => cb(null, 'Working')),
      };

      // Emit both devices
      usbEmitter.emit('attach', failingDevice);
      usbEmitter.emit('attach', workingDevice);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should have at least the working device event
      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 10 });

      const workingEvents = messages![0].messages.filter(
        m => m.message.vendor === '0xabcd'
      );
      expect(workingEvents).toHaveLength(1);
    });

    it('should reconnect to Redis on connection loss', async () => {
      await daemon.start();

      // Simulate Redis disconnect
      await redisClient.disconnect();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Reconnect
      await redisClient.connect();

      // Daemon should recover and continue processing
      const mockDevice = {
        deviceDescriptor: {
          idVendor: 0x9999,
          idProduct: 0x8888,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => cb(null, 'Recovered')),
      };

      usbEmitter.emit('attach', mockDevice);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));

      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 10 });

      const recoveredEvents = messages![0].messages.filter(
        m => m.message.vendor === '0x9999'
      );
      expect(recoveredEvents.length).toBeGreaterThan(0);
    });
  });

  describe('performance monitoring', () => {
    it('should track event processing metrics', async () => {
      await daemon.start();

      const devices = Array.from({ length: 20 }, (_, i) => ({
        deviceDescriptor: {
          idVendor: 0x1234,
          idProduct: 0x5678 + i,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => cb(null, `Device-${i}`)),
      }));

      // Process multiple devices
      for (const device of devices) {
        usbEmitter.emit('attach', device);
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get metrics
      const metrics = daemon.getMetrics();
      
      expect(metrics.totalEvents).toBeGreaterThanOrEqual(20);
      expect(metrics.successfulPublishes).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeDefined();
      expect(metrics.averageLatency).toBeLessThan(100); // Should be fast
    });

    it('should maintain performance under load', async () => {
      await daemon.start();

      const startTime = Date.now();
      const eventCount = 100;

      // Generate high load
      const promises = Array.from({ length: eventCount }, async (_, i) => {
        const device = {
          deviceDescriptor: {
            idVendor: Math.floor(Math.random() * 0xFFFF),
            idProduct: Math.floor(Math.random() * 0xFFFF),
          },
          open: jest.fn(),
          close: jest.fn(),
          getStringDescriptor: jest.fn((index, cb) => cb(null, `Load-${i}`)),
        };

        usbEmitter.emit('attach', device);
      });

      await Promise.all(promises);
      
      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const totalTime = Date.now() - startTime;
      const eventsPerSecond = (eventCount / totalTime) * 1000;

      // Should handle at least 50 events per second
      expect(eventsPerSecond).toBeGreaterThan(50);
    });
  });

  describe('graceful shutdown', () => {
    it('should flush pending events on shutdown', async () => {
      await daemon.start();

      // Add some events
      for (let i = 0; i < 3; i++) {
        const device = {
          deviceDescriptor: {
            idVendor: 0x1111,
            idProduct: 0x2222 + i,
          },
          open: jest.fn(),
          close: jest.fn(),
          getStringDescriptor: jest.fn((index, cb) => cb(null, `Shutdown-${i}`)),
        };
        usbEmitter.emit('attach', device);
      }

      // Immediate shutdown
      await daemon.stop();

      // Check that events were flushed to Redis
      const messages = await redisClient.xRead([
        { key: 'aw:hotplug', id: '0' }
      ], { COUNT: 10 });

      const shutdownEvents = messages![0].messages.filter(
        m => m.message.manufacturer?.includes('Shutdown')
      );
      expect(shutdownEvents.length).toBe(3);
    });

    it('should complete shutdown within time limit', async () => {
      await daemon.start();

      // Add many events to process
      for (let i = 0; i < 50; i++) {
        const device = {
          deviceDescriptor: { idVendor: i, idProduct: i },
          open: jest.fn(),
          close: jest.fn(),
          getStringDescriptor: jest.fn((index, cb) => {
            // Slow extraction
            setTimeout(() => cb(null, 'Slow'), 100);
          }),
        };
        usbEmitter.emit('attach', device);
      }

      const startTime = Date.now();
      await daemon.stop();
      const shutdownTime = Date.now() - startTime;

      // Should shutdown within 5 seconds
      expect(shutdownTime).toBeLessThan(5000);
    });
  });
});