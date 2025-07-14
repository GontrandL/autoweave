import { EventEmitter } from 'events';
import { Queue, Worker, QueueEvents, FlowProducer } from 'bullmq';
import Redis from 'ioredis';
import { Logger } from 'pino';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

import {
  AutoWeaveJobManagerConfig,
  QueueConfiguration,
  WorkerConfig,
  AutoWeaveJobData,
  JobOptions,
  QueueMetrics,
  HealthStatus,
  ProcessFunction,
  JobContext,
  JobResult,
  QueueManagerError,
  WorkerPoolConfig
} from '../types';

import { WorkerPoolManager } from './worker-pool-manager';
import { HealthMonitor } from '../health/health-monitor';
import { MetricsCollector } from '../monitoring/metrics-collector';

export class AutoWeaveJobManager extends EventEmitter {
  private redis: Redis;
  private queues = new Map<string, Queue>();
  private queueEvents = new Map<string, QueueEvents>();
  private workerPools = new Map<string, WorkerPoolManager>();
  private flowProducer: FlowProducer;
  private healthMonitor: HealthMonitor;
  private metricsCollector: MetricsCollector;
  private logger: Logger;
  private isShuttingDown = false;
  private shutdownPromise?: Promise<void>;

  constructor(private config: AutoWeaveJobManagerConfig) {
    super();
    
    // Setup logger
    this.logger = pino({
      name: 'autoweave-job-manager',
      level: process.env.LOG_LEVEL || 'info'
    });

    // Setup Redis connection
    this.redis = new Redis({
      ...config.redis,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    // Setup flow producer
    this.flowProducer = new FlowProducer({
      connection: this.redis
    });

    // Setup monitoring
    this.healthMonitor = new HealthMonitor(this, config.health);
    this.metricsCollector = new MetricsCollector(this, config.monitoring);

    this.setupErrorHandlers();
  }

  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing AutoWeave Job Manager...');

      // Connect to Redis
      await this.redis.connect();
      this.logger.info('Connected to Redis');

      // Initialize queues
      await this.initializeQueues();

      // Start monitoring
      if (this.config.monitoring.enabled) {
        await this.metricsCollector.start();
      }

      await this.healthMonitor.start();

      this.logger.info('AutoWeave Job Manager initialized successfully');
      this.emit('manager:initialized');

    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize AutoWeave Job Manager');
      throw new QueueManagerError('Initialization failed', 'initialize', error as Error);
    }
  }

  private async initializeQueues(): Promise<void> {
    for (const queueConfig of this.config.queues) {
      await this.createQueue(queueConfig);
    }
  }

  async createQueue(config: QueueConfiguration): Promise<Queue> {
    if (this.queues.has(config.name)) {
      throw new QueueManagerError(`Queue ${config.name} already exists`, 'createQueue');
    }

    try {
      const queue = new Queue(config.name, {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          ...config.defaultJobOptions
        },
        settings: config.settings
      });

      const queueEvents = new QueueEvents(config.name, {
        connection: this.redis
      });

      this.queues.set(config.name, queue);
      this.queueEvents.set(config.name, queueEvents);

      // Setup event handlers
      this.setupQueueEventHandlers(config.name, queueEvents);

      // Create worker pool if specified
      if (config.workers) {
        const workerPool = new WorkerPoolManager(
          config.name,
          config.workers,
          this.redis,
          this.logger.child({ component: 'worker-pool', queue: config.name })
        );
        this.workerPools.set(config.name, workerPool);
      }

      this.logger.info({ queueName: config.name }, 'Queue created successfully');
      this.emit('queue:created', { queueName: config.name });

      return queue;

    } catch (error) {
      this.logger.error({ error, queueName: config.name }, 'Failed to create queue');
      throw new QueueManagerError(`Failed to create queue ${config.name}`, 'createQueue', error as Error);
    }
  }

  async createWorker(queueName: string, config: WorkerConfig): Promise<void> {
    const workerPool = this.workerPools.get(queueName);
    if (!workerPool) {
      throw new QueueManagerError(`No worker pool found for queue ${queueName}`, 'createWorker');
    }

    await workerPool.addWorker(config);
    this.logger.info({ queueName, workerId: config.queueName }, 'Worker created successfully');
  }

  async addJob(queueName: string, jobData: AutoWeaveJobData, options?: JobOptions): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueManagerError(`Queue ${queueName} not found`, 'addJob');
    }

    try {
      const jobId = uuidv4();
      const job = await queue.add(
        jobData.type,
        {
          ...jobData,
          jobId,
          metadata: {
            ...jobData.metadata,
            timestamp: Date.now(),
            version: '1.0.0'
          }
        },
        {
          jobId,
          priority: jobData.priority || 0,
          ...options
        }
      );

      this.logger.info({
        jobId: job.id,
        jobType: jobData.type,
        queueName,
        priority: jobData.priority
      }, 'Job added successfully');

      this.emit('job:added', {
        jobId: job.id,
        jobType: jobData.type,
        queueName,
        timestamp: Date.now()
      });

      return job.id!;

    } catch (error) {
      this.logger.error({ error, queueName, jobType: jobData.type }, 'Failed to add job');
      throw new QueueManagerError(`Failed to add job to queue ${queueName}`, 'addJob', error as Error);
    }
  }

  async addBulkJobs(queueName: string, jobs: Array<{ data: AutoWeaveJobData; options?: JobOptions }>): Promise<string[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueManagerError(`Queue ${queueName} not found`, 'addBulkJobs');
    }

    try {
      const jobConfigs = jobs.map(({ data, options }) => {
        const jobId = uuidv4();
        return {
          name: data.type,
          data: {
            ...data,
            jobId,
            metadata: {
              ...data.metadata,
              timestamp: Date.now(),
              version: '1.0.0'
            }
          },
          opts: {
            jobId,
            priority: data.priority || 0,
            ...options
          }
        };
      });

      const createdJobs = await queue.addBulk(jobConfigs);
      const jobIds = createdJobs.map(job => job.id!);

      this.logger.info({
        queueName,
        jobCount: jobIds.length
      }, 'Bulk jobs added successfully');

      this.emit('jobs:bulk_added', {
        queueName,
        jobIds,
        count: jobIds.length,
        timestamp: Date.now()
      });

      return jobIds;

    } catch (error) {
      this.logger.error({ error, queueName, jobCount: jobs.length }, 'Failed to add bulk jobs');
      throw new QueueManagerError(`Failed to add bulk jobs to queue ${queueName}`, 'addBulkJobs', error as Error);
    }
  }

  async getQueueMetrics(queueName?: string): Promise<QueueMetrics | Record<string, QueueMetrics>> {
    if (queueName) {
      return this.metricsCollector.getQueueMetrics(queueName);
    } else {
      return this.metricsCollector.getAllQueueMetrics();
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return this.healthMonitor.getHealthStatus();
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueManagerError(`Queue ${queueName} not found`, 'pauseQueue');
    }

    await queue.pause();
    this.logger.info({ queueName }, 'Queue paused');
    this.emit('queue:paused', { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueManagerError(`Queue ${queueName} not found`, 'resumeQueue');
    }

    await queue.resume();
    this.logger.info({ queueName }, 'Queue resumed');
    this.emit('queue:resumed', { queueName });
  }

  async drainQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueManagerError(`Queue ${queueName} not found`, 'drainQueue');
    }

    await queue.drain();
    this.logger.info({ queueName }, 'Queue drained');
    this.emit('queue:drained', { queueName });
  }

  async cleanQueue(queueName: string, grace: number = 5000): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new QueueManagerError(`Queue ${queueName} not found`, 'cleanQueue');
    }

    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace, 100, 'failed');
    
    this.logger.info({ queueName, grace }, 'Queue cleaned');
    this.emit('queue:cleaned', { queueName, grace });
  }

  async scaleWorkers(queueName: string, targetWorkers: number): Promise<void> {
    const workerPool = this.workerPools.get(queueName);
    if (!workerPool) {
      throw new QueueManagerError(`No worker pool found for queue ${queueName}`, 'scaleWorkers');
    }

    await workerPool.scaleTo(targetWorkers);
    this.logger.info({ queueName, targetWorkers }, 'Workers scaled');
    this.emit('workers:scaled', { queueName, targetWorkers });
  }

  async gracefulShutdown(timeout: number = 30000): Promise<void> {
    if (this.isShuttingDown) {
      return this.shutdownPromise;
    }

    this.isShuttingDown = true;
    this.logger.info({ timeout }, 'Starting graceful shutdown...');

    this.shutdownPromise = this.performShutdown(timeout);
    return this.shutdownPromise;
  }

  private async performShutdown(timeout: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Stop accepting new jobs
      this.emit('manager:shutdown_started');

      // Stop monitoring
      await this.healthMonitor.stop();
      if (this.config.monitoring.enabled) {
        await this.metricsCollector.stop();
      }

      // Close worker pools
      const workerShutdowns = Array.from(this.workerPools.values()).map(pool => pool.shutdown());
      await Promise.all(workerShutdowns);

      // Close queue events
      const queueEventCloses = Array.from(this.queueEvents.values()).map(qe => qe.close());
      await Promise.all(queueEventCloses);

      // Close queues
      const queueCloses = Array.from(this.queues.values()).map(queue => queue.close());
      await Promise.all(queueCloses);

      // Close flow producer
      await this.flowProducer.close();

      // Close Redis connection
      await this.redis.quit();

      const shutdownTime = Date.now() - startTime;
      this.logger.info({ shutdownTime }, 'Graceful shutdown completed');
      this.emit('manager:shutdown_completed', { shutdownTime });

    } catch (error) {
      this.logger.error({ error }, 'Error during graceful shutdown');
      throw new QueueManagerError('Graceful shutdown failed', 'gracefulShutdown', error as Error);
    }
  }

  private setupQueueEventHandlers(queueName: string, queueEvents: QueueEvents): void {
    queueEvents.on('completed', (jobId, result) => {
      this.emit('job:completed', { queueName, jobId, result, timestamp: Date.now() });
    });

    queueEvents.on('failed', (jobId, error) => {
      this.logger.error({ queueName, jobId, error }, 'Job failed');
      this.emit('job:failed', { queueName, jobId, error, timestamp: Date.now() });
    });

    queueEvents.on('progress', (jobId, progress) => {
      this.emit('job:progress', { queueName, jobId, progress, timestamp: Date.now() });
    });

    queueEvents.on('stalled', (jobId) => {
      this.logger.warn({ queueName, jobId }, 'Job stalled');
      this.emit('job:stalled', { queueName, jobId, timestamp: Date.now() });
    });
  }

  private setupErrorHandlers(): void {
    this.redis.on('error', (error) => {
      this.logger.error({ error }, 'Redis connection error');
      this.emit('redis:error', error);
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
      this.emit('redis:connected');
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis ready');
      this.emit('redis:ready');
    });

    this.redis.on('close', () => {
      this.logger.info('Redis connection closed');
      this.emit('redis:closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.info('Redis reconnecting');
      this.emit('redis:reconnecting');
    });
  }

  // Getters for internal components (useful for testing and debugging)
  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  getWorkerPool(queueName: string): WorkerPoolManager | undefined {
    return this.workerPools.get(queueName);
  }

  getRedis(): Redis {
    return this.redis;
  }

  getLogger(): Logger {
    return this.logger;
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  isInitialized(): boolean {
    return this.redis.status === 'ready' && this.queues.size > 0;
  }
}