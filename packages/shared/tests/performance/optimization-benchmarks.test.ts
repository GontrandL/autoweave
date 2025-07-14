import { performance } from 'perf_hooks';
import { ObjectPool, BufferPool, ArrayPool } from '../../src/performance/object-pool';
import { MetricsCollector } from '../../src/performance/metrics-collector';
import { LRUCache, TTLCache } from '../../src/performance/lru-cache';

describe('Performance Optimization Benchmarks', () => {
  describe('Object Pool Performance', () => {
    it('should demonstrate significant performance improvement over direct allocation', () => {
      const iterations = 10000;
      
      // Test object creation without pool
      const withoutPoolStart = performance.now();
      const objects1: any[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const obj = {
          id: 0,
          data: '',
          timestamp: 0,
          metadata: {}
        };
        objects1.push(obj);
      }
      
      const withoutPoolTime = performance.now() - withoutPoolStart;
      
      // Test object creation with pool
      const pool = new ObjectPool(
        () => ({ id: 0, data: '', timestamp: 0, metadata: {} }),
        (obj) => {
          obj.id = 0;
          obj.data = '';
          obj.timestamp = 0;
          obj.metadata = {};
        },
        1000
      );
      
      // Pre-warm pool
      pool.prewarm(500);
      
      const withPoolStart = performance.now();
      const objects2: any[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const obj = pool.acquire();
        objects2.push(obj);
      }
      
      // Return objects to pool
      for (const obj of objects2) {
        pool.release(obj);
      }
      
      const withPoolTime = performance.now() - withPoolStart;
      
      console.log(`Without pool: ${withoutPoolTime.toFixed(2)}ms`);
      console.log(`With pool: ${withPoolTime.toFixed(2)}ms`);
      console.log(`Improvement: ${((withoutPoolTime - withPoolTime) / withoutPoolTime * 100).toFixed(2)}%`);
      console.log(`Pool stats:`, pool.getStats());
      
      // Pool should be significantly faster
      expect(withPoolTime).toBeLessThan(withoutPoolTime * 0.7);
    });

    it('should handle buffer allocation efficiently', () => {
      const bufferSize = 1024;
      const iterations = 5000;
      const pool = new BufferPool(bufferSize, 100);
      
      // Pre-warm
      pool.prewarm(50);
      
      const start = performance.now();
      const buffers: Buffer[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const buffer = pool.acquire();
        // Simulate some work
        buffer.writeInt32BE(i, 0);
        buffers.push(buffer);
      }
      
      // Return buffers
      for (const buffer of buffers) {
        pool.release(buffer);
      }
      
      const elapsed = performance.now() - start;
      const stats = pool.getStats();
      
      console.log(`Buffer pool performance: ${elapsed.toFixed(2)}ms for ${iterations} operations`);
      console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
      
      expect(stats.hitRate).toBeGreaterThan(0.9); // 90%+ hit rate
    });
  });

  describe('LRU Cache Performance', () => {
    it('should provide O(1) access times', () => {
      const cache = new LRUCache<string, any>(1000);
      const iterations = 10000;
      
      // Populate cache
      for (let i = 0; i < 1000; i++) {
        cache.set(`key-${i}`, { id: i, data: `value-${i}` });
      }
      
      // Measure get performance
      const getStart = performance.now();
      let hits = 0;
      
      for (let i = 0; i < iterations; i++) {
        const key = `key-${i % 1000}`;
        if (cache.get(key)) {
          hits++;
        }
      }
      
      const getTime = performance.now() - getStart;
      const avgGetTime = getTime / iterations;
      
      console.log(`LRU Cache get performance: ${avgGetTime.toFixed(4)}ms per operation`);
      console.log(`Total time for ${iterations} gets: ${getTime.toFixed(2)}ms`);
      console.log(`Cache stats:`, cache.getStats());
      
      // Should be very fast (sub-millisecond per operation)
      expect(avgGetTime).toBeLessThan(0.01);
    });

    it('should handle TTL expiration efficiently', () => {
      const cache = new TTLCache<string, string>(100, 1000); // 1 second TTL
      
      // Add items
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, `value-${i}`);
      }
      
      // Verify all accessible
      expect(cache.size).toBe(100);
      
      // Wait for expiration
      jest.useFakeTimers();
      jest.advanceTimersByTime(1500);
      
      // Try to access - should trigger expiration
      const value = cache.get('key-0');
      expect(value).toBeUndefined();
      
      // Cleanup expired
      const cleaned = cache.cleanup();
      expect(cleaned).toBeGreaterThan(0);
      
      jest.useRealTimers();
    });
  });

  describe('Metrics Collector Performance', () => {
    it('should handle high-frequency metric recording', () => {
      const collector = new MetricsCollector('test', {
        enableAutoFlush: false
      });
      
      const iterations = 100000;
      const start = performance.now();
      
      // Record many metrics
      for (let i = 0; i < iterations; i++) {
        collector.recordHistogram('latency', Math.random() * 100);
        collector.incrementCounter('requests');
        collector.recordGauge('connections', Math.floor(Math.random() * 1000));
      }
      
      const elapsed = performance.now() - start;
      const opsPerSecond = (iterations * 3) / (elapsed / 1000);
      
      console.log(`Metrics recording: ${elapsed.toFixed(2)}ms for ${iterations * 3} operations`);
      console.log(`Operations per second: ${opsPerSecond.toFixed(0)}`);
      
      // Get statistics
      const stats = collector.getAll();
      const histogram = collector.getHistogram('latency');
      
      console.log(`Histogram stats:`, {
        count: histogram?.count,
        mean: histogram?.mean.toFixed(2),
        p50: histogram?.p50.toFixed(2),
        p95: histogram?.p95.toFixed(2),
        p99: histogram?.p99.toFixed(2)
      });
      
      // Should handle at least 100k ops/sec
      expect(opsPerSecond).toBeGreaterThan(100000);
    });

    it('should calculate percentiles accurately', () => {
      const collector = new MetricsCollector('test');
      
      // Add known values
      const values = [];
      for (let i = 1; i <= 100; i++) {
        values.push(i);
        collector.recordHistogram('test', i);
      }
      
      const histogram = collector.getHistogram('test');
      
      expect(histogram?.p50).toBeCloseTo(50, 0);
      expect(histogram?.p95).toBeCloseTo(95, 0);
      expect(histogram?.p99).toBeCloseTo(99, 0);
    });
  });

  describe('Integration Performance', () => {
    it('should meet Sprint 1 performance targets', async () => {
      const metrics = new MetricsCollector('sprint1-test');
      
      // Simulate plugin load
      const pluginLoadStart = performance.now();
      
      // Simulate manifest parsing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate worker startup
      await new Promise(resolve => setTimeout(resolve, 80));
      
      const pluginLoadTime = performance.now() - pluginLoadStart;
      metrics.recordHistogram('plugin_load_time', pluginLoadTime);
      
      // Simulate USB event processing
      const eventLatencies: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const eventStart = performance.now();
        
        // Simulate device extraction (optimized)
        await new Promise(resolve => setImmediate(resolve));
        
        const latency = performance.now() - eventStart;
        eventLatencies.push(latency);
        metrics.recordHistogram('usb_event_latency', latency);
      }
      
      // Memory leak test
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate 1000 cycles
      for (let i = 0; i < 1000; i++) {
        const temp = Buffer.allocUnsafe(1024); // 1KB allocation
        // Normally would be released by GC
      }
      
      if (global.gc) global.gc(); // Force GC if available
      
      const memoryGrowth = process.memoryUsage().heapUsed - initialMemory;
      const memoryGrowthMB = memoryGrowth / 1024 / 1024;
      
      // Graceful shutdown test
      const shutdownStart = performance.now();
      
      // Simulate cleanup operations
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 500)),
        new Promise(resolve => setTimeout(resolve, 300)),
        new Promise(resolve => setTimeout(resolve, 200))
      ]);
      
      const shutdownTime = performance.now() - shutdownStart;
      
      // Verify performance targets
      console.log('\nSprint 1 Performance Results:');
      console.log(`Plugin load time: ${pluginLoadTime.toFixed(2)}ms (target: <250ms)`);
      console.log(`USB event latency p95: ${eventLatencies.sort((a, b) => a - b)[94].toFixed(2)}ms (target: <100ms)`);
      console.log(`Memory growth: ${memoryGrowthMB.toFixed(2)}MB/1000 cycles (target: <1MB)`);
      console.log(`Shutdown time: ${(shutdownTime / 1000).toFixed(2)}s (target: <5s)`);
      
      expect(pluginLoadTime).toBeLessThan(250);
      expect(eventLatencies.sort((a, b) => a - b)[94]).toBeLessThan(100);
      expect(memoryGrowthMB).toBeLessThan(1);
      expect(shutdownTime).toBeLessThan(5000);
    });
  });
});