/**
 * Plugin Worker Pool Unit Tests
 * Tests worker pool management and scaling
 */

import { PluginWorkerPool } from '../../src/workers/plugin-worker-pool';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

// Mock worker_threads
jest.mock('worker_threads', () => {
  const mockWorker = jest.fn().mockImplementation(() => {
    const worker = new EventEmitter() as any;
    worker.postMessage = jest.fn();
    worker.terminate = jest.fn().mockResolvedValue(undefined);
    worker.threadId = Math.random();
    
    // Simulate worker ready
    setImmediate(() => worker.emit('online'));
    
    return worker;
  });

  return {
    Worker: mockWorker,
    isMainThread: true,
  };
});

describe('PluginWorkerPool', () => {
  let pool: PluginWorkerPool;

  beforeEach(() => {
    pool = new PluginWorkerPool({
      minWorkers: 2,
      maxWorkers: 4,
      workerTimeout: 5000,
      idleTimeout: 30000,
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('initialization', () => {
    it('should create minimum number of workers on init', async () => {
      await pool.initialize();
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(2);
      expect(stats.availableWorkers).toBe(2);
      expect(stats.busyWorkers).toBe(0);
    });

    it('should handle worker creation failures', async () => {
      // Mock worker creation to fail
      (Worker as jest.MockedClass<typeof Worker>).mockImplementationOnce(() => {
        throw new Error('Worker creation failed');
      });

      // Should still initialize with remaining workers
      await pool.initialize();
      
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBeGreaterThan(0);
    });
  });

  describe('task execution', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should execute tasks on available workers', async () => {
      const task = {
        type: 'loadPlugin',
        payload: { pluginPath: '/path/to/plugin' },
      };

      const result = pool.execute(task);
      
      // Simulate worker response
      const workers = (pool as any).workers;
      const worker = workers[0];
      worker.emit('message', {
        type: 'result',
        taskId: (pool as any).pendingTasks.keys().next().value,
        result: { success: true },
      });

      await expect(result).resolves.toEqual({ success: true });
    });

    it('should queue tasks when all workers are busy', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        type: 'loadPlugin',
        payload: { pluginPath: `/plugin-${i}` },
      }));

      // Submit more tasks than workers
      const promises = tasks.map(task => pool.execute(task));
      
      const stats = pool.getStats();
      expect(stats.queuedTasks).toBe(1); // 5 tasks - 4 max workers
    });

    it('should handle task timeouts', async () => {
      const task = {
        type: 'slowTask',
        payload: {},
      };

      // Override timeout for this test
      const promise = pool.execute(task, { timeout: 100 });
      
      // Don't respond to simulate timeout
      await expect(promise).rejects.toThrow('Task timeout');
    });

    it('should retry failed tasks', async () => {
      const task = {
        type: 'flakyTask',
        payload: {},
      };

      let attempts = 0;
      const result = pool.execute(task, { maxRetries: 2 });

      // Simulate failures then success
      const interval = setInterval(() => {
        const workers = (pool as any).workers;
        const worker = workers[0];
        const taskId = (pool as any).pendingTasks.keys().next().value;
        
        if (taskId) {
          attempts++;
          if (attempts < 2) {
            worker.emit('message', {
              type: 'error',
              taskId,
              error: 'Task failed',
            });
          } else {
            worker.emit('message', {
              type: 'result',
              taskId,
              result: { success: true },
            });
            clearInterval(interval);
          }
        }
      }, 10);

      await expect(result).resolves.toEqual({ success: true });
      expect(attempts).toBe(2);
    });
  });

  describe('worker scaling', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should scale up when queue grows', async () => {
      const initialStats = pool.getStats();
      expect(initialStats.totalWorkers).toBe(2);

      // Submit many tasks to trigger scaling
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        type: 'task',
        payload: { id: i },
      }));

      tasks.forEach(task => pool.execute(task));

      // Wait for scaling
      await new Promise(resolve => setTimeout(resolve, 100));

      const scaledStats = pool.getStats();
      expect(scaledStats.totalWorkers).toBeGreaterThan(2);
      expect(scaledStats.totalWorkers).toBeLessThanOrEqual(4);
    });

    it('should scale down when workers are idle', async () => {
      // First scale up
      const tasks = Array.from({ length: 8 }, () => ({
        type: 'task',
        payload: {},
      }));

      const promises = tasks.map(task => pool.execute(task));

      // Resolve all tasks
      const workers = (pool as any).workers;
      setImmediate(() => {
        (pool as any).pendingTasks.forEach((resolver: any, taskId: string) => {
          workers[0].emit('message', {
            type: 'result',
            taskId,
            result: { done: true },
          });
        });
      });

      await Promise.all(promises);

      // Trigger idle timeout
      jest.useFakeTimers();
      jest.advanceTimersByTime(31000); // Past idle timeout
      jest.useRealTimers();

      // Force scale down check
      (pool as any).checkIdleWorkers();

      const finalStats = pool.getStats();
      expect(finalStats.totalWorkers).toBe(2); // Back to minimum
    });

    it('should respect max workers limit', async () => {
      // Try to exceed max workers
      const tasks = Array.from({ length: 20 }, () => ({
        type: 'heavyTask',
        payload: {},
      }));

      tasks.forEach(task => pool.execute(task));

      // Wait for potential scaling
      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = pool.getStats();
      expect(stats.totalWorkers).toBeLessThanOrEqual(4);
    });
  });

  describe('worker health monitoring', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should restart crashed workers', async () => {
      const initialStats = pool.getStats();
      
      // Simulate worker crash
      const workers = (pool as any).workers;
      const worker = workers[0];
      const workerId = worker.threadId;
      
      worker.emit('error', new Error('Worker crashed'));
      worker.emit('exit', 1);

      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 100));

      const newStats = pool.getStats();
      expect(newStats.totalWorkers).toBe(initialStats.totalWorkers);
      
      // Verify new worker was created
      const newWorkers = (pool as any).workers;
      const hasNewWorker = newWorkers.some((w: any) => w.threadId !== workerId);
      expect(hasNewWorker).toBe(true);
    });

    it('should handle worker memory issues', async () => {
      const worker = (pool as any).workers[0];
      
      // Simulate OOM error
      worker.emit('error', new Error('JavaScript heap out of memory'));
      
      // Should log and restart
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const stats = pool.getStats();
      expect(stats.restartedWorkers).toBeGreaterThan(0);
    });

    it('should track worker performance metrics', async () => {
      const task = {
        type: 'task',
        payload: {},
      };

      const startTime = Date.now();
      const promise = pool.execute(task);

      // Simulate task completion
      setTimeout(() => {
        const workers = (pool as any).workers;
        const taskId = (pool as any).pendingTasks.keys().next().value;
        workers[0].emit('message', {
          type: 'result',
          taskId,
          result: { done: true },
          metrics: {
            executionTime: 50,
            memoryUsed: 10 * 1024 * 1024, // 10MB
          },
        });
      }, 50);

      await promise;

      const metrics = pool.getMetrics();
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.averageMemoryUsage).toBeGreaterThan(0);
    });
  });

  describe('graceful shutdown', () => {
    beforeEach(async () => {
      await pool.initialize();
    });

    it('should complete pending tasks before shutdown', async () => {
      const tasks = Array.from({ length: 3 }, (_, i) => ({
        type: 'task',
        payload: { id: i },
      }));

      const promises = tasks.map(task => pool.execute(task));

      // Start shutdown
      const shutdownPromise = pool.shutdown();

      // Complete tasks during shutdown
      const workers = (pool as any).workers;
      (pool as any).pendingTasks.forEach((resolver: any, taskId: string) => {
        workers[0].emit('message', {
          type: 'result',
          taskId,
          result: { completed: true },
        });
      });

      // All tasks should complete
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toEqual({ completed: true });
      });

      await shutdownPromise;
    });

    it('should terminate workers after timeout', async () => {
      // Submit a task that won't complete
      const promise = pool.execute({
        type: 'neverEnding',
        payload: {},
      });

      // Shutdown with short grace period
      const shutdownPromise = pool.shutdown(100);

      await shutdownPromise;

      // Task should be rejected
      await expect(promise).rejects.toThrow();

      // All workers should be terminated
      const stats = pool.getStats();
      expect(stats.totalWorkers).toBe(0);
    });

    it('should prevent new tasks during shutdown', async () => {
      const shutdownPromise = pool.shutdown();

      // Try to execute new task
      const promise = pool.execute({
        type: 'task',
        payload: {},
      });

      await expect(promise).rejects.toThrow('Pool is shutting down');
      await shutdownPromise;
    });
  });

  describe('resource limits', () => {
    it('should enforce memory limits per worker', async () => {
      const memoryLimitedPool = new PluginWorkerPool({
        minWorkers: 1,
        maxWorkers: 2,
        workerTimeout: 5000,
        memoryLimit: 128 * 1024 * 1024, // 128MB
      });

      await memoryLimitedPool.initialize();

      // Verify worker options include resource limits
      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          resourceLimits: expect.objectContaining({
            maxOldGenerationSizeMb: 128,
          }),
        })
      );

      await memoryLimitedPool.shutdown();
    });

    it('should track cumulative resource usage', async () => {
      await pool.initialize();

      // Simulate multiple task executions with metrics
      for (let i = 0; i < 5; i++) {
        const promise = pool.execute({
          type: 'task',
          payload: { id: i },
        });

        setImmediate(() => {
          const taskId = (pool as any).pendingTasks.keys().next().value;
          if (taskId) {
            const workers = (pool as any).workers;
            workers[0].emit('message', {
              type: 'result',
              taskId,
              result: { done: true },
              metrics: {
                executionTime: 10 + i * 5,
                memoryUsed: (5 + i) * 1024 * 1024,
                cpuTime: 8 + i * 2,
              },
            });
          }
        });

        await promise;
      }

      const usage = pool.getResourceUsage();
      expect(usage.totalCpuTime).toBeGreaterThan(0);
      expect(usage.peakMemoryUsage).toBeGreaterThan(0);
      expect(usage.totalTasksProcessed).toBe(5);
    });
  });
});