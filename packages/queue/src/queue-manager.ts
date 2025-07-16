import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { EventEmitter } from 'events';
import { 
  AutoWeaveJobData, 
  JobConfig, 
  RepeatableJobConfig, 
  QueueConfig, 
  WorkerConfig, 
  QueueMetrics 
} from './types';

export class AutoWeaveQueue extends EventEmitter {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private config: QueueConfig;

  constructor(config: QueueConfig) {
    super();
    this.config = config;
    
    this.queue = new Queue(config.name, {
      connection: config.redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        ...config.defaultJobOptions
      }
    });

    this.queueEvents = new QueueEvents(config.name, {
      connection: config.redis
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.queueEvents.on('completed', (jobId: any, result: any) => {
      this.emit('job:completed', { jobId, result });
    });

    this.queueEvents.on('failed', (jobId: any, error: any) => {
      this.emit('job:failed', { jobId, error });
    });

    this.queueEvents.on('progress', (jobId: any, progress: any) => {
      this.emit('job:progress', { jobId, progress });
    });
  }

  async addJob(config: JobConfig): Promise<Job<AutoWeaveJobData>> {
    const job = await this.queue.add(config.name, config.data, config.options);
    
    console.log(`Added job ${config.name} with ID ${job.id} to queue ${this.config.name}`);
    this.emit('job:added', { jobId: job.id, jobName: config.name, data: config.data });
    
    return job;
  }

  async addBulkJobs(configs: JobConfig[]): Promise<Job<AutoWeaveJobData>[]> {
    const jobs = await this.queue.addBulk(
      configs.map(config => ({
        name: config.name,
        data: config.data,
        opts: config.options
      }))
    );

    console.log(`Added ${jobs.length} jobs to queue ${this.config.name}`);
    this.emit('jobs:bulk_added', { count: jobs.length, queueName: this.config.name });
    
    return jobs;
  }

  async addRepeatableJob(config: RepeatableJobConfig): Promise<void> {
    await this.queue.add(config.name, config.data, {
      repeat: config.repeat,
      ...config.options
    });

    console.log(`Added repeatable job ${config.name} to queue ${this.config.name}`);
    this.emit('job:repeatable_added', { jobName: config.name, repeat: config.repeat });
  }

  async getJob(jobId: string): Promise<Job<AutoWeaveJobData> | undefined> {
    return this.queue.getJob(jobId);
  }

  async getJobs(types: ('waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused')[] = ['waiting', 'active', 'completed', 'failed'], start = 0, end = -1): Promise<Job<AutoWeaveJobData>[]> {
    return this.queue.getJobs(types as any, start, end);
  }

  async getJobCounts(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
      paused: counts.paused || 0
    };
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    console.log(`Queue ${this.config.name} paused`);
    this.emit('queue:paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    console.log(`Queue ${this.config.name} resumed`);
    this.emit('queue:resumed');
  }

  async cleanQueue(grace: number = 5000): Promise<void> {
    await this.queue.clean(grace, 100, 'completed');
    await this.queue.clean(grace, 100, 'failed');
    console.log(`Queue ${this.config.name} cleaned`);
    this.emit('queue:cleaned');
  }

  async close(): Promise<void> {
    await this.queueEvents.close();
    await this.queue.close();
    console.log(`Queue ${this.config.name} closed`);
  }

  getQueue(): Queue {
    return this.queue;
  }
}

export class AutoWeaveWorker extends EventEmitter {
  private worker: Worker;
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    super();
    this.config = config;

    this.worker = new Worker(config.queueName, config.processor, {
      connection: config.redis,
      concurrency: config.concurrency || 1
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('completed', (job: any, result: any) => {
      console.log(`Job ${job.id} completed in queue ${this.config.queueName}`);
      this.emit('job:completed', { job, result });
    });

    this.worker.on('failed', (job: any, error: any) => {
      console.error(`Job ${job?.id} failed in queue ${this.config.queueName}:`, error);
      this.emit('job:failed', { job, error });
    });

    this.worker.on('progress', (job: any, progress: any) => {
      console.log(`Job ${job.id} progress: ${JSON.stringify(progress)}`);
      this.emit('job:progress', { job, progress });
    });

    this.worker.on('error', (error: any) => {
      console.error(`Worker error in queue ${this.config.queueName}:`, error);
      this.emit('worker:error', error);
    });
  }

  async close(): Promise<void> {
    await this.worker.close();
    console.log(`Worker for queue ${this.config.queueName} closed`);
  }

  getWorker(): Worker {
    return this.worker;
  }
}

export class QueueManager extends EventEmitter {
  private queues = new Map<string, AutoWeaveQueue>();
  private workers = new Map<string, AutoWeaveWorker>();
  private defaultRedisConfig: any;

  constructor(defaultRedisConfig: any) {
    super();
    this.defaultRedisConfig = defaultRedisConfig;
  }

  createQueue(config: QueueConfig): AutoWeaveQueue {
    if (this.queues.has(config.name)) {
      throw new Error(`Queue ${config.name} already exists`);
    }

    const queueConfig = {
      ...config,
      redis: { ...this.defaultRedisConfig, ...config.redis }
    };

    const queue = new AutoWeaveQueue(queueConfig);
    this.queues.set(config.name, queue);

    // Forward events
    queue.on('job:completed', (data) => this.emit('job:completed', { ...data, queueName: config.name }));
    queue.on('job:failed', (data) => this.emit('job:failed', { ...data, queueName: config.name }));
    queue.on('job:added', (data) => this.emit('job:added', { ...data, queueName: config.name }));

    console.log(`Created queue: ${config.name}`);
    return queue;
  }

  createWorker(config: WorkerConfig): AutoWeaveWorker {
    const workerKey = `${config.queueName}-worker`;
    
    if (this.workers.has(workerKey)) {
      throw new Error(`Worker for queue ${config.queueName} already exists`);
    }

    const workerConfig = {
      ...config,
      redis: { ...this.defaultRedisConfig, ...config.redis }
    };

    const worker = new AutoWeaveWorker(workerConfig);
    this.workers.set(workerKey, worker);

    // Forward events
    worker.on('job:completed', (data) => this.emit('job:completed', { ...data, queueName: config.queueName }));
    worker.on('job:failed', (data) => this.emit('job:failed', { ...data, queueName: config.queueName }));
    worker.on('worker:error', (error) => this.emit('worker:error', { error, queueName: config.queueName }));

    console.log(`Created worker for queue: ${config.queueName}`);
    return worker;
  }

  getQueue(name: string): AutoWeaveQueue | undefined {
    return this.queues.get(name);
  }

  getWorker(queueName: string): AutoWeaveWorker | undefined {
    return this.workers.get(`${queueName}-worker`);
  }

  async addJobToQueue(queueName: string, jobConfig: JobConfig): Promise<Job<AutoWeaveJobData> | null> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      console.error(`Queue ${queueName} not found`);
      return null;
    }

    return queue.addJob(jobConfig);
  }

  async getAllQueueMetrics(): Promise<Record<string, QueueMetrics>> {
    const metrics: Record<string, QueueMetrics> = {};
    
    for (const [name, queue] of this.queues) {
      metrics[name] = await queue.getJobCounts();
    }
    
    return metrics;
  }

  async closeAll(): Promise<void> {
    // Close all workers first
    await Promise.all(
      Array.from(this.workers.values()).map(worker => worker.close())
    );

    // Then close all queues
    await Promise.all(
      Array.from(this.queues.values()).map(queue => queue.close())
    );

    this.queues.clear();
    this.workers.clear();
    console.log('All queues and workers closed');
  }
}