import { EventEmitter } from 'events';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';

import {
  WorkerPoolConfig,
  WorkerConfig,
  WorkerMetrics,
  ProcessFunction,
  JobContext,
  JobResult,
  WorkerError,
  SecurityConfig
} from '../types';

import { SecureWorkerRunner } from '../workers/secure-worker-runner';

interface WorkerInstance {
  id: string;
  worker: Worker;
  runner: SecureWorkerRunner;
  metrics: WorkerMetrics;
  startTime: number;
  isHealthy: boolean;
}

interface ScalingMetrics {
  queueSize: number;
  activeJobs: number;
  avgProcessingTime: number;
  failureRate: number;
  lastScaleAction: number;
}

export class WorkerPoolManager extends EventEmitter {
  private workers = new Map<string, WorkerInstance>();
  private config: WorkerPoolConfig;
  private redis: Redis;
  private logger: Logger;
  private queueName: string;
  private processingFunction?: ProcessFunction;
  private isShuttingDown = false;
  private scalingMetrics: ScalingMetrics = {
    queueSize: 0,
    activeJobs: 0,
    avgProcessingTime: 0,
    failureRate: 0,
    lastScaleAction: 0
  };
  private monitoringInterval?: NodeJS.Timeout;
  private scalingTask?: cron.ScheduledTask;

  constructor(
    queueName: string,
    config: WorkerPoolConfig,
    redis: Redis,
    logger: Logger
  ) {
    super();
    this.queueName = queueName;
    this.config = config;
    this.redis = redis;
    this.logger = logger.child({ component: 'worker-pool', queue: queueName });

    this.setupMonitoring();
    this.setupAutoScaling();
  }

  async initialize(processingFunction: ProcessFunction): Promise<void> {
    this.processingFunction = processingFunction;
    
    // Start with minimum number of workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.createWorker();
    }

    this.logger.info({
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      activeWorkers: this.workers.size
    }, 'Worker pool initialized');

    this.emit('pool:initialized', {
      queueName: this.queueName,
      workerCount: this.workers.size
    });
  }

  async addWorker(config: WorkerConfig): Promise<string> {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new WorkerError(
        `Cannot add worker: maximum pool size (${this.config.maxWorkers}) reached`,
        'pool',
        this.queueName
      );
    }

    const workerId = await this.createWorker(config);
    this.logger.info({ workerId }, 'Worker added to pool');
    return workerId;
  }

  async removeWorker(workerId: string): Promise<void> {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) {
      throw new WorkerError(`Worker ${workerId} not found`, workerId, this.queueName);
    }

    if (this.workers.size <= this.config.minWorkers) {
      throw new WorkerError(
        `Cannot remove worker: minimum pool size (${this.config.minWorkers}) required`,
        workerId,
        this.queueName
      );
    }

    await this.destroyWorker(workerId);
    this.logger.info({ workerId }, 'Worker removed from pool');
  }

  async scaleTo(targetWorkers: number): Promise<void> {
    if (targetWorkers < this.config.minWorkers || targetWorkers > this.config.maxWorkers) {
      throw new WorkerError(
        `Target workers (${targetWorkers}) must be between ${this.config.minWorkers} and ${this.config.maxWorkers}`,
        'pool',
        this.queueName
      );
    }

    const currentWorkers = this.workers.size;
    const difference = targetWorkers - currentWorkers;

    if (difference === 0) {
      return;
    }

    this.logger.info({
      currentWorkers,
      targetWorkers,
      difference
    }, 'Scaling worker pool');

    if (difference > 0) {
      // Scale up
      for (let i = 0; i < difference; i++) {
        await this.createWorker();
      }
    } else {
      // Scale down
      const workersToRemove = Array.from(this.workers.keys()).slice(0, Math.abs(difference));
      for (const workerId of workersToRemove) {
        await this.destroyWorker(workerId);
      }
    }

    this.scalingMetrics.lastScaleAction = Date.now();
    this.emit('pool:scaled', {
      queueName: this.queueName,
      previousSize: currentWorkers,
      newSize: this.workers.size,
      targetSize: targetWorkers
    });
  }

  async getWorkerMetrics(): Promise<WorkerMetrics[]> {
    const metrics: WorkerMetrics[] = [];
    
    for (const [workerId, instance] of this.workers) {
      const worker = instance.worker;
      const running = await worker.isRunning();
      
      metrics.push({
        id: workerId,
        isRunning: running,
        totalProcessed: instance.metrics.totalProcessed,
        totalFailed: instance.metrics.totalFailed,
        activeJobs: instance.metrics.activeJobs,
        memoryUsage: instance.metrics.memoryUsage,
        cpuUsage: instance.metrics.cpuUsage,
        lastActivity: instance.metrics.lastActivity
      });
    }

    return metrics;
  }

  async getPoolStatus(): Promise<{
    size: number;
    minWorkers: number;
    maxWorkers: number;
    healthy: number;
    unhealthy: number;
    scaling: ScalingMetrics;
  }> {
    const metrics = await this.getWorkerMetrics();
    const healthy = metrics.filter(m => m.isRunning).length;
    const unhealthy = metrics.length - healthy;

    return {
      size: this.workers.size,
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers,
      healthy,
      unhealthy,
      scaling: this.scalingMetrics
    };
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down worker pool...');

    // Stop monitoring and scaling
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.scalingTask) {
      this.scalingTask.stop();
    }

    // Close all workers
    const shutdownPromises = Array.from(this.workers.keys()).map(workerId => 
      this.destroyWorker(workerId)
    );

    await Promise.all(shutdownPromises);

    this.logger.info('Worker pool shutdown completed');
    this.emit('pool:shutdown', { queueName: this.queueName });
  }

  private async createWorker(config?: WorkerConfig): Promise<string> {
    const workerId = uuidv4();
    const processingFunction = config?.processFunction || this.processingFunction;

    if (!processingFunction) {
      throw new WorkerError('No processing function provided', workerId, this.queueName);
    }

    try {
      // Create secure worker runner
      const securityConfig: SecurityConfig = config?.security || {
        sandboxEnabled: true,
        timeoutMs: 30000,
        memoryLimitMB: 128,
        allowedModules: ['fs', 'path', 'util'],
        blockedModules: ['child_process', 'cluster']
      };

      const runner = new SecureWorkerRunner(securityConfig, this.logger);

      // Create BullMQ worker
      const worker = new Worker(
        this.queueName,
        async (job) => {
          const startTime = Date.now();
          const workerInstance = this.workers.get(workerId);

          if (!workerInstance) {
            throw new WorkerError(`Worker instance ${workerId} not found`, workerId, this.queueName);
          }

          try {
            // Update metrics
            workerInstance.metrics.activeJobs++;
            workerInstance.metrics.lastActivity = Date.now();

            // Create job context
            const jobContext: JobContext = {
              id: job.id!,
              data: job.data,
              progress: (value: number) => job.updateProgress(value),
              updateProgress: (data: any) => job.updateProgress(data),
              log: (message: string, level: 'info' | 'warn' | 'error' = 'info') => {
                this.logger[level]({ jobId: job.id, workerId }, message);
              },
              timestamp: job.timestamp,
              attemptsMade: job.attemptsMade,
              attemptsTotal: job.opts.attempts || 1
            };

            // Execute job through secure runner
            const result = await runner.execute(processingFunction, jobContext);

            // Update metrics on success
            workerInstance.metrics.totalProcessed++;
            workerInstance.metrics.activeJobs--;
            
            const processingTime = Date.now() - startTime;
            this.updateScalingMetrics(processingTime, false);

            return result;

          } catch (error) {
            // Update metrics on failure
            workerInstance.metrics.totalFailed++;
            workerInstance.metrics.activeJobs--;
            
            const processingTime = Date.now() - startTime;
            this.updateScalingMetrics(processingTime, true);

            throw error;
          }
        },
        {
          connection: this.redis,
          concurrency: config?.concurrency || this.config.concurrency,
          removeOnComplete: config?.removeOnComplete || 10,
          removeOnFail: config?.removeOnFail || 5,
          settings: config?.settings
        }
      );

      // Setup worker event handlers
      this.setupWorkerEventHandlers(workerId, worker);

      // Create worker instance
      const workerInstance: WorkerInstance = {
        id: workerId,
        worker,
        runner,
        metrics: {
          id: workerId,
          isRunning: true,
          totalProcessed: 0,
          totalFailed: 0,
          activeJobs: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          lastActivity: Date.now()
        },
        startTime: Date.now(),
        isHealthy: true
      };

      this.workers.set(workerId, workerInstance);

      this.logger.info({ workerId, concurrency: worker.concurrency }, 'Worker created');
      this.emit('worker:created', { workerId, queueName: this.queueName });

      return workerId;

    } catch (error) {
      this.logger.error({ error, workerId }, 'Failed to create worker');
      throw new WorkerError(`Failed to create worker ${workerId}`, workerId, this.queueName, error as Error);
    }
  }

  private async destroyWorker(workerId: string): Promise<void> {
    const workerInstance = this.workers.get(workerId);
    if (!workerInstance) {
      return;
    }

    try {
      // Close worker gracefully
      await workerInstance.worker.close();
      
      // Clean up runner
      await workerInstance.runner.cleanup();

      this.workers.delete(workerId);

      this.logger.info({ workerId }, 'Worker destroyed');
      this.emit('worker:destroyed', { workerId, queueName: this.queueName });

    } catch (error) {
      this.logger.error({ error, workerId }, 'Failed to destroy worker');
      throw new WorkerError(`Failed to destroy worker ${workerId}`, workerId, this.queueName, error as Error);
    }
  }

  private setupWorkerEventHandlers(workerId: string, worker: Worker): void {
    worker.on('completed', (job, result) => {
      this.logger.info({ workerId, jobId: job.id }, 'Job completed');
      this.emit('worker:job:completed', { workerId, jobId: job.id, result });
    });

    worker.on('failed', (job, error) => {
      this.logger.error({ workerId, jobId: job?.id, error }, 'Job failed');
      this.emit('worker:job:failed', { workerId, jobId: job?.id, error });
    });

    worker.on('error', (error) => {
      this.logger.error({ workerId, error }, 'Worker error');
      this.markWorkerUnhealthy(workerId);
      this.emit('worker:error', { workerId, error });
    });

    worker.on('stalled', (jobId) => {
      this.logger.warn({ workerId, jobId }, 'Job stalled');
      this.emit('worker:job:stalled', { workerId, jobId });
    });
  }

  private markWorkerUnhealthy(workerId: string): void {
    const workerInstance = this.workers.get(workerId);
    if (workerInstance) {
      workerInstance.isHealthy = false;
    }
  }

  private setupMonitoring(): void {
    // Update worker metrics every 10 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.updateWorkerMetrics();
    }, 10000);
  }

  private async updateWorkerMetrics(): Promise<void> {
    for (const [workerId, instance] of this.workers) {
      try {
        // Update memory and CPU usage (simplified - in production, use process monitoring)
        const memoryUsage = process.memoryUsage();
        instance.metrics.memoryUsage = memoryUsage.heapUsed / 1024 / 1024; // MB
        instance.metrics.cpuUsage = process.cpuUsage().user / 1000; // ms

        // Check if worker is still running
        instance.metrics.isRunning = await instance.worker.isRunning();

      } catch (error) {
        this.logger.error({ workerId, error }, 'Failed to update worker metrics');
      }
    }
  }

  private setupAutoScaling(): void {
    if (!this.config.autoScale) {
      return;
    }

    // Run scaling evaluation every 30 seconds
    this.scalingTask = cron.schedule('*/30 * * * * *', async () => {
      await this.evaluateScaling();
    }, {
      scheduled: false
    });

    this.scalingTask.start();
  }

  private async evaluateScaling(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      const now = Date.now();
      
      // Check cooldown periods
      if (now - this.scalingMetrics.lastScaleAction < this.config.scaleUpCooldown) {
        return;
      }

      // Get current metrics
      await this.updateScalingMetrics();

      const currentWorkers = this.workers.size;
      const shouldScaleUp = this.shouldScaleUp();
      const shouldScaleDown = this.shouldScaleDown();

      if (shouldScaleUp && currentWorkers < this.config.maxWorkers) {
        const targetWorkers = Math.min(currentWorkers + 1, this.config.maxWorkers);
        await this.scaleTo(targetWorkers);
        this.logger.info({
          currentWorkers,
          targetWorkers,
          metrics: this.scalingMetrics
        }, 'Scaled up workers');

      } else if (shouldScaleDown && currentWorkers > this.config.minWorkers) {
        const targetWorkers = Math.max(currentWorkers - 1, this.config.minWorkers);
        await this.scaleTo(targetWorkers);
        this.logger.info({
          currentWorkers,
          targetWorkers,
          metrics: this.scalingMetrics
        }, 'Scaled down workers');
      }

    } catch (error) {
      this.logger.error({ error }, 'Failed to evaluate scaling');
    }
  }

  private shouldScaleUp(): boolean {
    const { queueSize, activeJobs, avgProcessingTime } = this.scalingMetrics;
    
    // Scale up if:
    // 1. Queue backlog is above threshold
    // 2. All workers are busy and processing time is high
    // 3. Recent failure rate is acceptable
    
    return (
      queueSize > this.config.scaleUpThreshold ||
      (activeJobs >= this.workers.size && avgProcessingTime > 5000) ||
      (queueSize > 0 && activeJobs >= this.workers.size * 0.8)
    );
  }

  private shouldScaleDown(): boolean {
    const { queueSize, activeJobs, avgProcessingTime } = this.scalingMetrics;
    
    // Scale down if:
    // 1. Queue is empty or small
    // 2. Workers are mostly idle
    // 3. Processing time is low
    
    return (
      queueSize < this.config.scaleDownThreshold &&
      activeJobs < this.workers.size * 0.3 &&
      avgProcessingTime < 1000
    );
  }

  private async updateScalingMetrics(): Promise<void> {
    try {
      // Get queue size from Redis
      const queueSize = await this.redis.llen(`bull:${this.queueName}:waiting`);
      
      // Calculate active jobs
      const activeJobs = Array.from(this.workers.values())
        .reduce((sum, worker) => sum + worker.metrics.activeJobs, 0);

      this.scalingMetrics.queueSize = queueSize;
      this.scalingMetrics.activeJobs = activeJobs;

    } catch (error) {
      this.logger.error({ error }, 'Failed to update scaling metrics');
    }
  }

  private updateScalingMetrics(processingTime: number, failed: boolean): void {
    // Update average processing time (simple moving average)
    const alpha = 0.1;
    this.scalingMetrics.avgProcessingTime = 
      alpha * processingTime + (1 - alpha) * this.scalingMetrics.avgProcessingTime;

    // Update failure rate (simple moving average)
    const failureValue = failed ? 1 : 0;
    this.scalingMetrics.failureRate = 
      alpha * failureValue + (1 - alpha) * this.scalingMetrics.failureRate;
  }
}