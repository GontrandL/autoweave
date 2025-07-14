/**
 * Memory Leak Prevention Tests
 * Ensures USB daemon doesn't leak memory over extended operation
 */

import { EnhancedUSBDaemon } from '../../src/enhanced-usb-daemon';
import { EventEmitter } from 'events';
import * as usb from 'usb';
import v8 from 'v8';
import { performance } from 'perf_hooks';

// Mock USB module
jest.mock('usb');

// Mock Redis to avoid external dependencies in performance tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    xAdd: jest.fn().mockResolvedValue('1234567890-0'),
    multi: jest.fn(() => ({
      xAdd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    })),
    isReady: true,
  })),
}));

describe('Memory Leak Prevention', () => {
  let daemon: EnhancedUSBDaemon;
  let usbEmitter: EventEmitter;

  beforeEach(() => {
    // Setup USB mock
    usbEmitter = new EventEmitter();
    (usb as any).on = jest.fn((event: string, handler: Function) => {
      usbEmitter.on(event, handler);
    });
    (usb as any).getDeviceList = jest.fn(() => []);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(async () => {
    await daemon?.stop();
  });

  describe('1000 cycles memory test', () => {
    it('should not leak memory over 1000 plug/unplug cycles', async () => {
      daemon = new EnhancedUSBDaemon({
        redis: { url: 'redis://localhost:6379' },
        batch: { size: 10, flushInterval: 50 },
      });

      await daemon.start();

      // Get initial memory baseline
      if (global.gc) global.gc();
      const initialHeap = v8.getHeapStatistics();
      const initialMemory = process.memoryUsage().heapUsed;

      // Create device generator
      const createDevice = (id: number) => ({
        deviceDescriptor: {
          idVendor: 0x1234,
          idProduct: 0x5678 + (id % 100),
          iSerialNumber: 3,
        },
        open: jest.fn(),
        close: jest.fn(),
        getStringDescriptor: jest.fn((index, cb) => cb(null, `Device-${id}`)),
      });

      // Run 1000 cycles
      const cycleStart = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        const device = createDevice(i);
        
        // Attach
        usbEmitter.emit('attach', device);
        
        // Small delay
        await new Promise(resolve => setImmediate(resolve));
        
        // Detach
        usbEmitter.emit('detach', device);
        
        // Periodic GC hint
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Wait for all processing to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force final garbage collection
      if (global.gc) global.gc();
      
      const finalHeap = v8.getHeapStatistics();
      const finalMemory = process.memoryUsage().heapUsed;
      const cycleTime = performance.now() - cycleStart;

      // Calculate memory increase
      const memoryIncrease = finalMemory - initialMemory;
      const heapIncrease = finalHeap.used_heap_size - initialHeap.used_heap_size;

      console.log('Memory test results:', {
        cycles: 1000,
        timeMs: Math.round(cycleTime),
        memoryIncreaseMB: (memoryIncrease / 1024 / 1024).toFixed(2),
        heapIncreaseMB: (heapIncrease / 1024 / 1024).toFixed(2),
      });

      // Assert memory increase is less than 1MB
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
      expect(heapIncrease).toBeLessThan(1024 * 1024);
    }, 30000); // 30 second timeout

    it('should clean up event listeners properly', async () => {
      daemon = new EnhancedUSBDaemon({
        redis: { url: 'redis://localhost:6379' },
      });

      // Track listener counts
      const getListenerCount = () => {
        return {
          usb: usbEmitter.listenerCount('attach') + usbEmitter.listenerCount('detach'),
          process: process.listenerCount('SIGTERM') + process.listenerCount('SIGINT'),
        };
      };

      const beforeStart = getListenerCount();
      
      await daemon.start();
      const afterStart = getListenerCount();
      
      await daemon.stop();
      const afterStop = getListenerCount();

      // Listeners should be added on start
      expect(afterStart.usb).toBeGreaterThan(beforeStart.usb);
      
      // Listeners should be removed on stop
      expect(afterStop.usb).toBe(beforeStart.usb);
      expect(afterStop.process).toBe(beforeStart.process);
    });

    it('should not accumulate debouncer entries', async () => {
      daemon = new EnhancedUSBDaemon({
        redis: { url: 'redis://localhost:6379' },
        debounce: { windowMs: 50 },
      });

      await daemon.start();

      // Generate events for many different devices
      for (let i = 0; i < 500; i++) {
        const device = {
          deviceDescriptor: {
            idVendor: Math.floor(Math.random() * 0xFFFF),
            idProduct: Math.floor(Math.random() * 0xFFFF),
          },
          open: jest.fn(),
          close: jest.fn(),
          getStringDescriptor: jest.fn((index, cb) => cb(null, `Random-${i}`)),
        };

        usbEmitter.emit('attach', device);
        
        // Occasional cleanup trigger
        if (i % 100 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Get debouncer stats
      const stats = daemon.getMetrics();
      
      // Debouncer should have cleaned up old entries
      expect(stats.activeDebouncerEntries).toBeLessThan(100);
    });
  });

  describe('resource cleanup', () => {
    it('should clean up worker threads properly', async () => {
      const { threadId: mainThread } = require('worker_threads');
      
      daemon = new EnhancedUSBDaemon({
        redis: { url: 'redis://localhost:6379' },
        workers: { enabled: true, count: 4 },
      });

      await daemon.start();

      // Process some events to ensure workers are used
      for (let i = 0; i < 10; i++) {
        const device = {
          deviceDescriptor: { idVendor: i, idProduct: i },
          open: jest.fn(),
          close: jest.fn(),
          getStringDescriptor: jest.fn((index, cb) => cb(null, 'Test')),
        };
        usbEmitter.emit('attach', device);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Stop daemon
      await daemon.stop();

      // Verify workers are terminated
      const metrics = daemon.getMetrics();
      expect(metrics.activeWorkers).toBe(0);
    });

    it('should release Redis connections', async () => {
      const connections: any[] = [];
      
      // Track Redis connections
      jest.mock('redis', () => ({
        createClient: jest.fn(() => {
          const client = {
            connect: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
            xAdd: jest.fn().mockResolvedValue('1234567890-0'),
            multi: jest.fn(() => ({
              xAdd: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            })),
            isReady: true,
          };
          connections.push(client);
          return client;
        }),
      }));

      daemon = new EnhancedUSBDaemon({
        redis: { url: 'redis://localhost:6379' },
      });

      await daemon.start();
      await daemon.stop();

      // All Redis connections should be disconnected
      connections.forEach(conn => {
        expect(conn.disconnect).toHaveBeenCalled();
      });
    });
  });

  describe('long-running stability', () => {
    it('should remain stable over extended operation', async () => {
      daemon = new EnhancedUSBDaemon({
        redis: { url: 'redis://localhost:6379' },
        batch: { size: 20, flushInterval: 100 },
      });

      await daemon.start();

      const samples: number[] = [];
      const sampleInterval = 100; // Sample every 100 events
      
      // Run for 5000 events
      for (let i = 0; i < 5000; i++) {
        const device = {
          deviceDescriptor: {
            idVendor: 0x1234,
            idProduct: 0x5678 + (i % 1000),
          },
          open: jest.fn(),
          close: jest.fn(),
          getStringDescriptor: jest.fn((index, cb) => cb(null, `Long-${i}`)),
        };

        usbEmitter.emit(i % 2 === 0 ? 'attach' : 'detach', device);

        // Sample memory periodically
        if (i % sampleInterval === 0) {
          if (global.gc) global.gc();
          samples.push(process.memoryUsage().heapUsed);
        }

        // Small delay to simulate real usage
        if (i % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      // Analyze memory trend
      const firstQuarter = samples.slice(0, samples.length / 4);
      const lastQuarter = samples.slice(-samples.length / 4);
      
      const avgFirst = firstQuarter.reduce((a, b) => a + b) / firstQuarter.length;
      const avgLast = lastQuarter.reduce((a, b) => a + b) / lastQuarter.length;
      
      // Memory should not grow significantly
      const growthRate = (avgLast - avgFirst) / avgFirst;
      expect(growthRate).toBeLessThan(0.1); // Less than 10% growth
    }, 60000); // 60 second timeout
  });
});