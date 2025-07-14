/**
 * Redis Batch Publisher Unit Tests
 * Tests batch publishing to Redis streams with optimal performance
 */

import { BatchPublisher } from '../../src/events/batch-publisher';
import { createClient } from 'redis';
import { USBEvent } from '../../src/types';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    xAdd: jest.fn(),
    multi: jest.fn(() => ({
      xAdd: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    })),
    isReady: true,
  })),
}));

describe('BatchPublisher', () => {
  let publisher: BatchPublisher;
  let mockRedis: any;
  const mockEvent: USBEvent = {
    type: 'attach',
    device: {
      vendorId: 0x1234,
      productId: 0x5678,
      deviceName: 'Test Device',
      manufacturer: 'Test Corp',
      serialNumber: 'SN123456',
      devicePath: '/dev/usb/001',
    },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    mockRedis = createClient();
    publisher = new BatchPublisher(mockRedis, {
      batchSize: 10,
      flushInterval: 100,
      maxRetries: 3,
      retryDelay: 50,
    });
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await publisher.close();
    jest.useRealTimers();
  });

  describe('batch publishing', () => {
    it('should batch events until batch size is reached', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockResolvedValue([]);

      // Add events up to batch size
      for (let i = 0; i < 10; i++) {
        await publisher.publish({ ...mockEvent, timestamp: Date.now() + i });
      }

      // Should trigger batch publish
      expect(multi.xAdd).toHaveBeenCalledTimes(10);
      expect(multi.exec).toHaveBeenCalledTimes(1);
    });

    it('should flush batch on interval even if not full', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockResolvedValue([]);

      // Add fewer events than batch size
      await publisher.publish(mockEvent);
      await publisher.publish(mockEvent);

      expect(multi.exec).not.toHaveBeenCalled();

      // Advance time to trigger flush
      jest.advanceTimersByTime(101);

      expect(multi.exec).toHaveBeenCalledTimes(1);
      expect(multi.xAdd).toHaveBeenCalledTimes(2);
    });

    it('should handle publish errors with retry', async () => {
      const multi = mockRedis.multi();
      let attempts = 0;
      
      multi.exec.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Connection lost'));
        }
        return Promise.resolve([]);
      });

      await publisher.publish(mockEvent);
      jest.advanceTimersByTime(101); // Trigger flush

      // Wait for retries
      await jest.advanceTimersByTimeAsync(200);

      expect(attempts).toBe(3);
      expect(multi.exec).toHaveBeenCalledTimes(3);
    });

    it('should drop events after max retries', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockRejectedValue(new Error('Permanent failure'));

      const errorHandler = jest.fn();
      publisher.on('error', errorHandler);

      await publisher.publish(mockEvent);
      jest.advanceTimersByTime(101); // Trigger flush

      // Wait for all retries
      await jest.advanceTimersByTimeAsync(500);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to publish batch after 3 attempts'),
        })
      );
    });
  });

  describe('performance optimization', () => {
    it('should respect maxBatchSize to prevent memory issues', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockResolvedValue([]);

      // Try to add more than max batch size
      for (let i = 0; i < 1500; i++) {
        await publisher.publish(mockEvent);
      }

      // Should have triggered multiple batches
      expect(multi.exec.mock.calls.length).toBeGreaterThan(1);
      
      // No single batch should exceed 1000 events
      multi.xAdd.mock.calls.forEach((call, index) => {
        if (index % 1000 === 0) {
          expect(multi.xAdd).toHaveBeenCalledTimes(Math.min(1000, 1500 - index));
        }
      });
    });

    it('should maintain event order within batches', async () => {
      const multi = mockRedis.multi();
      const addedEvents: any[] = [];
      
      multi.xAdd.mockImplementation((stream, id, event) => {
        addedEvents.push(event);
        return multi;
      });
      multi.exec.mockResolvedValue([]);

      // Add events with sequential timestamps
      for (let i = 0; i < 5; i++) {
        await publisher.publish({
          ...mockEvent,
          timestamp: 1000 + i,
        });
      }

      jest.advanceTimersByTime(101); // Trigger flush

      // Verify order is preserved
      for (let i = 0; i < 4; i++) {
        expect(parseInt(addedEvents[i].timestamp)).toBeLessThan(
          parseInt(addedEvents[i + 1].timestamp)
        );
      }
    });

    it('should provide accurate statistics', () => {
      publisher.publish(mockEvent);
      publisher.publish(mockEvent);
      
      const stats = publisher.getStats();
      expect(stats.pendingEvents).toBe(2);
      expect(stats.totalPublished).toBe(0);
      expect(stats.failedBatches).toBe(0);
    });
  });

  describe('graceful shutdown', () => {
    it('should flush pending events on close', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockResolvedValue([]);

      // Add some events
      await publisher.publish(mockEvent);
      await publisher.publish(mockEvent);

      // Close should flush
      await publisher.close();

      expect(multi.exec).toHaveBeenCalledTimes(1);
      expect(multi.xAdd).toHaveBeenCalledTimes(2);
    });

    it('should cancel flush timer on close', async () => {
      await publisher.publish(mockEvent);
      
      await publisher.close();
      
      // Advance time - should not trigger flush
      jest.advanceTimersByTime(200);
      
      const multi = mockRedis.multi();
      expect(multi.exec).toHaveBeenCalledTimes(1); // Only from close()
    });

    it('should handle close during retry gracefully', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockRejectedValue(new Error('Connection error'));

      await publisher.publish(mockEvent);
      jest.advanceTimersByTime(101); // Trigger flush

      // Close during retry
      const closePromise = publisher.close();
      jest.advanceTimersByTime(100);

      await expect(closePromise).resolves.not.toThrow();
    });
  });

  describe('stream channel configuration', () => {
    it('should publish to correct Redis stream', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockResolvedValue([]);

      await publisher.publish(mockEvent);
      jest.advanceTimersByTime(101);

      expect(multi.xAdd).toHaveBeenCalledWith(
        'aw:hotplug',
        '*',
        expect.objectContaining({
          event: 'device.attached',
          deviceId: expect.any(String),
          vendor: '0x1234',
          product: '0x5678',
        })
      );
    });

    it('should include all required fields in stream message', async () => {
      const multi = mockRedis.multi();
      multi.exec.mockResolvedValue([]);

      await publisher.publish(mockEvent);
      jest.advanceTimersByTime(101);

      expect(multi.xAdd).toHaveBeenCalledWith(
        'aw:hotplug',
        '*',
        expect.objectContaining({
          event: 'device.attached',
          deviceId: expect.any(String),
          vendor: '0x1234',
          product: '0x5678',
          manufacturer: 'Test Corp',
          deviceName: 'Test Device',
          serialNumber: 'SN123456',
          timestamp: expect.any(String),
        })
      );
    });
  });
});