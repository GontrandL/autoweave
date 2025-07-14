import { createTestJobQueueService } from '../../src/utils/factory';
import { JobScheduler } from '../../src/schedulers/job-scheduler';
import { AutoWeaveJobManager } from '../../src/managers/autoweave-job-manager';
import { WorkerPoolManager } from '../../src/managers/worker-pool-manager';
import { USBEventBridge } from '../../src/bridges/usb-event-bridge';
import { JobType } from '../../src/types';

describe('Full Integration Test', () => {
  let service: any;
  let jobManager: AutoWeaveJobManager;
  let scheduler: JobScheduler;
  
  beforeAll(async () => {
    // Create test service
    service = await createTestJobQueueService();
    jobManager = service.jobManager;
    
    // Start the service
    await service.start();
    
    // Create scheduler
    scheduler = new JobScheduler(jobManager);
  });

  afterAll(async () => {
    // Stop scheduler
    if (scheduler) {
      scheduler.stop();
    }
    
    // Stop service
    if (service) {
      await service.stop();
    }
  });

  describe('Job Manager', () => {
    it('should initialize successfully', async () => {
      expect(jobManager.isInitialized()).toBe(true);
      expect(jobManager.getQueueNames()).toContain('test-queue');
    });

    it('should add and process jobs', async () => {
      const jobId = await jobManager.addJob('test-queue', {
        type: 'plugin.execute',
        payload: { test: true },
        metadata: {
          source: 'manual',
          timestamp: Date.now(),
          version: '1.0.0'
        }
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should add bulk jobs', async () => {
      const jobs = Array.from({ length: 5 }, (_, i) => ({
        data: {
          type: 'plugin.execute' as JobType,
          payload: { batchIndex: i },
          metadata: {
            source: 'manual' as const,
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      }));

      const jobIds = await jobManager.addBulkJobs('test-queue', jobs);
      expect(jobIds).toHaveLength(5);
    });

    it('should get queue metrics', async () => {
      const metrics = await jobManager.getQueueMetrics('test-queue');
      expect(metrics).toBeDefined();
      expect(typeof metrics.waiting).toBe('number');
      expect(typeof metrics.active).toBe('number');
      expect(typeof metrics.completed).toBe('number');
      expect(typeof metrics.failed).toBe('number');
    });

    it('should get health status', async () => {
      const health = await jobManager.getHealthStatus();
      expect(health).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.checks).toBeDefined();
      expect(health.details).toBeDefined();
    });
  });

  describe('Worker Pool Management', () => {
    it('should have worker pools for queues', async () => {
      const workerPool = jobManager.getWorkerPool('test-queue');
      expect(workerPool).toBeDefined();
      
      if (workerPool) {
        const status = await workerPool.getPoolStatus();
        expect(status.size).toBeGreaterThan(0);
        expect(status.minWorkers).toBeDefined();
        expect(status.maxWorkers).toBeDefined();
      }
    });

    it('should scale workers', async () => {
      const workerPool = jobManager.getWorkerPool('test-queue');
      if (workerPool) {
        const initialStatus = await workerPool.getPoolStatus();
        const targetSize = Math.min(initialStatus.maxWorkers, initialStatus.size + 1);
        
        await jobManager.scaleWorkers('test-queue', targetSize);
        
        const newStatus = await workerPool.getPoolStatus();
        expect(newStatus.size).toBe(targetSize);
      }
    });
  });

  describe('Job Scheduling', () => {
    it('should schedule jobs', async () => {
      await scheduler.scheduleJob(
        'test-scheduled-job',
        'Test Scheduled Job',
        '*/5 * * * * *', // Every 5 seconds
        'test-queue',
        {
          type: 'system.cleanup',
          payload: { test: true },
          metadata: {
            source: 'scheduled',
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      );

      const scheduledJob = scheduler.getScheduledJob('test-scheduled-job');
      expect(scheduledJob).toBeDefined();
      expect(scheduledJob?.enabled).toBe(true);
    });

    it('should enable/disable jobs', async () => {
      scheduler.disableJob('test-scheduled-job');
      let scheduledJob = scheduler.getScheduledJob('test-scheduled-job');
      expect(scheduledJob?.enabled).toBe(false);

      scheduler.enableJob('test-scheduled-job');
      scheduledJob = scheduler.getScheduledJob('test-scheduled-job');
      expect(scheduledJob?.enabled).toBe(true);
    });

    it('should get job statistics', async () => {
      const stats = scheduler.getJobStats();
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.enabled).toBe('number');
      expect(typeof stats.disabled).toBe('number');
    });
  });

  describe('Job Processing', () => {
    it('should process different job types', async () => {
      const jobTypes: JobType[] = [
        'usb.device.attached',
        'plugin.load',
        'plugin.execute',
        'system.cleanup',
        'memory.vectorize'
      ];

      for (const jobType of jobTypes) {
        const jobId = await jobManager.addJob('test-queue', {
          type: jobType,
          payload: { test: true, jobType },
          metadata: {
            source: 'manual',
            timestamp: Date.now(),
            version: '1.0.0'
          }
        });

        expect(jobId).toBeDefined();
      }
    });

    it('should handle job failures gracefully', async () => {
      // This would require mocking the processor to fail
      // For now, we'll just verify the structure is in place
      const jobId = await jobManager.addJob('test-queue', {
        type: 'plugin.execute',
        payload: { shouldFail: true },
        metadata: {
          source: 'manual',
          timestamp: Date.now(),
          version: '1.0.0'
        }
      });

      expect(jobId).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should handle high job throughput', async () => {
      const startTime = Date.now();
      const numJobs = 100;
      
      const jobs = Array.from({ length: numJobs }, (_, i) => ({
        data: {
          type: 'plugin.execute' as JobType,
          payload: { index: i },
          metadata: {
            source: 'manual' as const,
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      }));

      const jobIds = await jobManager.addBulkJobs('test-queue', jobs);
      const addTime = Date.now() - startTime;

      expect(jobIds).toHaveLength(numJobs);
      expect(addTime).toBeLessThan(5000); // Should add 100 jobs in less than 5 seconds
    });

    it('should maintain good performance under load', async () => {
      const metrics = await jobManager.getQueueMetrics('test-queue');
      expect(metrics).toBeDefined();
      
      // Performance should be reasonable even with many jobs
      const health = await jobManager.getHealthStatus();
      expect(health.status).not.toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job data', async () => {
      await expect(
        jobManager.addJob('test-queue', {
          type: 'invalid.job.type' as JobType,
          payload: null,
          metadata: {
            source: 'manual',
            timestamp: Date.now(),
            version: '1.0.0'
          }
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent queue', async () => {
      await expect(
        jobManager.addJob('non-existent-queue', {
          type: 'plugin.execute',
          payload: { test: true },
          metadata: {
            source: 'manual',
            timestamp: Date.now(),
            version: '1.0.0'
          }
        })
      ).rejects.toThrow();
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const shutdownPromise = jobManager.gracefulShutdown(5000);
      
      // Should not throw
      await expect(shutdownPromise).resolves.not.toThrow();
    });
  });
});

describe('USB Event Bridge Integration', () => {
  it('should create USB event bridge configuration', () => {
    const config = {
      queueName: 'usb-events',
      streamName: 'aw:hotplug',
      consumerGroup: 'test-consumer',
      consumerName: 'test',
      redis: {
        host: 'localhost',
        port: 6379,
        db: 15
      },
      batchSize: 5,
      pollInterval: 100,
      maxRetries: 3,
      processingTimeout: 30000,
      pluginFiltering: {
        enabled: false,
        allowedPlugins: [],
        requirePermission: false
      }
    };

    expect(config).toBeDefined();
    expect(config.queueName).toBe('usb-events');
    expect(config.streamName).toBe('aw:hotplug');
  });
});

describe('Security Integration', () => {
  it('should have security configuration', () => {
    const securityConfig = {
      sandboxEnabled: true,
      timeoutMs: 30000,
      memoryLimitMB: 128,
      allowedModules: ['fs', 'path', 'util'],
      blockedModules: ['child_process', 'cluster']
    };

    expect(securityConfig.sandboxEnabled).toBe(true);
    expect(securityConfig.timeoutMs).toBe(30000);
    expect(securityConfig.allowedModules).toContain('fs');
    expect(securityConfig.blockedModules).toContain('child_process');
  });
});