import { EventEmitter } from 'events';
import { Logger } from 'pino';
import pino from 'pino';
import * as cron from 'node-cron';

import { AutoWeaveJobManager } from '../managers/autoweave-job-manager';
import {
  AutoWeaveJobData,
  JobOptions,
  RepeatOptions,
  JobType
} from '../types';

interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  queueName: string;
  jobData: AutoWeaveJobData;
  jobOptions?: JobOptions;
  task?: cron.ScheduledTask;
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
  runCount: number;
  failureCount: number;
  created: Date;
  updated: Date;
}

interface SchedulerConfig {
  timezone?: string;
  maxConcurrentJobs?: number;
  retryFailedJobs?: boolean;
  retryDelay?: number;
  enableLogging?: boolean;
}

export class JobScheduler extends EventEmitter {
  private config: SchedulerConfig;
  private jobManager: AutoWeaveJobManager;
  private logger: Logger;
  private scheduledJobs = new Map<string, ScheduledJob>();
  private isRunning = false;
  private runningJobs = new Set<string>();

  constructor(jobManager: AutoWeaveJobManager, config: SchedulerConfig = {}) {
    super();
    this.jobManager = jobManager;
    this.config = {
      timezone: config.timezone || 'UTC',
      maxConcurrentJobs: config.maxConcurrentJobs || 10,
      retryFailedJobs: config.retryFailedJobs || true,
      retryDelay: config.retryDelay || 60000, // 1 minute
      enableLogging: config.enableLogging !== false
    };

    this.logger = pino({
      name: 'job-scheduler',
      level: process.env.LOG_LEVEL || 'info'
    });
  }

  start(): void {
    if (this.isRunning) {
      this.logger.warn('Job scheduler is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting job scheduler...');

    // Start all scheduled jobs
    for (const [jobId, scheduledJob] of this.scheduledJobs) {
      if (scheduledJob.enabled) {
        this.startScheduledJob(scheduledJob);
      }
    }

    this.logger.info({
      totalJobs: this.scheduledJobs.size,
      enabledJobs: Array.from(this.scheduledJobs.values()).filter(j => j.enabled).length
    }, 'Job scheduler started');

    this.emit('scheduler:started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping job scheduler...');
    this.isRunning = false;

    // Stop all scheduled jobs
    for (const [jobId, scheduledJob] of this.scheduledJobs) {
      if (scheduledJob.task) {
        scheduledJob.task.stop();
      }
    }

    this.logger.info('Job scheduler stopped');
    this.emit('scheduler:stopped');
  }

  async scheduleJob(
    id: string,
    name: string,
    cronExpression: string,
    queueName: string,
    jobData: AutoWeaveJobData,
    jobOptions?: JobOptions
  ): Promise<void> {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Check if job already exists
    if (this.scheduledJobs.has(id)) {
      throw new Error(`Scheduled job with ID ${id} already exists`);
    }

    const scheduledJob: ScheduledJob = {
      id,
      name,
      cronExpression,
      queueName,
      jobData,
      jobOptions,
      enabled: true,
      runCount: 0,
      failureCount: 0,
      created: new Date(),
      updated: new Date()
    };

    this.scheduledJobs.set(id, scheduledJob);

    // Start the job if scheduler is running
    if (this.isRunning) {
      this.startScheduledJob(scheduledJob);
    }

    this.logger.info({
      jobId: id,
      jobName: name,
      cronExpression,
      queueName
    }, 'Job scheduled');

    this.emit('job:scheduled', { jobId: id, scheduledJob });
  }

  async unscheduleJob(id: string): Promise<void> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job with ID ${id} not found`);
    }

    // Stop the task if it's running
    if (scheduledJob.task) {
      scheduledJob.task.stop();
    }

    this.scheduledJobs.delete(id);

    this.logger.info({
      jobId: id,
      jobName: scheduledJob.name
    }, 'Job unscheduled');

    this.emit('job:unscheduled', { jobId: id, scheduledJob });
  }

  async updateJob(
    id: string,
    updates: Partial<Pick<ScheduledJob, 'name' | 'cronExpression' | 'queueName' | 'jobData' | 'jobOptions' | 'enabled'>>
  ): Promise<void> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job with ID ${id} not found`);
    }

    // Validate cron expression if it's being updated
    if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
      throw new Error(`Invalid cron expression: ${updates.cronExpression}`);
    }

    // Stop current task
    if (scheduledJob.task) {
      scheduledJob.task.stop();
    }

    // Update job
    Object.assign(scheduledJob, updates, { updated: new Date() });

    // Restart task if scheduler is running and job is enabled
    if (this.isRunning && scheduledJob.enabled) {
      this.startScheduledJob(scheduledJob);
    }

    this.logger.info({
      jobId: id,
      jobName: scheduledJob.name,
      updates
    }, 'Job updated');

    this.emit('job:updated', { jobId: id, scheduledJob, updates });
  }

  enableJob(id: string): void {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job with ID ${id} not found`);
    }

    scheduledJob.enabled = true;
    scheduledJob.updated = new Date();

    // Start the job if scheduler is running
    if (this.isRunning) {
      this.startScheduledJob(scheduledJob);
    }

    this.logger.info({
      jobId: id,
      jobName: scheduledJob.name
    }, 'Job enabled');

    this.emit('job:enabled', { jobId: id, scheduledJob });
  }

  disableJob(id: string): void {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job with ID ${id} not found`);
    }

    scheduledJob.enabled = false;
    scheduledJob.updated = new Date();

    // Stop the task
    if (scheduledJob.task) {
      scheduledJob.task.stop();
    }

    this.logger.info({
      jobId: id,
      jobName: scheduledJob.name
    }, 'Job disabled');

    this.emit('job:disabled', { jobId: id, scheduledJob });
  }

  async runJobNow(id: string): Promise<string> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job with ID ${id} not found`);
    }

    return this.executeJob(scheduledJob, true);
  }

  getScheduledJob(id: string): ScheduledJob | undefined {
    return this.scheduledJobs.get(id);
  }

  getAllScheduledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  getJobsByQueue(queueName: string): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values()).filter(job => job.queueName === queueName);
  }

  getEnabledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values()).filter(job => job.enabled);
  }

  getRunningJobs(): string[] {
    return Array.from(this.runningJobs);
  }

  getJobStats(): {
    total: number;
    enabled: number;
    disabled: number;
    running: number;
    totalRuns: number;
    totalFailures: number;
  } {
    const jobs = Array.from(this.scheduledJobs.values());
    
    return {
      total: jobs.length,
      enabled: jobs.filter(j => j.enabled).length,
      disabled: jobs.filter(j => !j.enabled).length,
      running: this.runningJobs.size,
      totalRuns: jobs.reduce((sum, job) => sum + job.runCount, 0),
      totalFailures: jobs.reduce((sum, job) => sum + job.failureCount, 0)
    };
  }

  private startScheduledJob(scheduledJob: ScheduledJob): void {
    if (scheduledJob.task) {
      scheduledJob.task.stop();
    }

    scheduledJob.task = cron.schedule(
      scheduledJob.cronExpression,
      async () => {
        if (this.runningJobs.size >= this.config.maxConcurrentJobs!) {
          this.logger.warn({
            jobId: scheduledJob.id,
            maxConcurrent: this.config.maxConcurrentJobs
          }, 'Skipping job execution: max concurrent jobs reached');
          return;
        }

        try {
          await this.executeJob(scheduledJob);
        } catch (error) {
          this.logger.error({
            jobId: scheduledJob.id,
            error
          }, 'Error executing scheduled job');
        }
      },
      {
        scheduled: false,
        timezone: this.config.timezone
      }
    );

    scheduledJob.task.start();
    scheduledJob.nextRun = scheduledJob.task.nextDate()?.toDate();

    this.logger.debug({
      jobId: scheduledJob.id,
      nextRun: scheduledJob.nextRun
    }, 'Scheduled job started');
  }

  private async executeJob(scheduledJob: ScheduledJob, manual: boolean = false): Promise<string> {
    const executionId = `${scheduledJob.id}-${Date.now()}`;
    this.runningJobs.add(executionId);

    try {
      this.logger.info({
        jobId: scheduledJob.id,
        jobName: scheduledJob.name,
        manual
      }, 'Executing scheduled job');

      const jobId = await this.jobManager.addJob(
        scheduledJob.queueName,
        {
          ...scheduledJob.jobData,
          metadata: {
            ...scheduledJob.jobData.metadata,
            source: 'scheduled',
            correlationId: executionId,
            timestamp: Date.now()
          }
        },
        scheduledJob.jobOptions
      );

      // Update job stats
      scheduledJob.runCount++;
      scheduledJob.lastRun = new Date();
      scheduledJob.nextRun = scheduledJob.task?.nextDate()?.toDate();

      this.logger.info({
        jobId: scheduledJob.id,
        queueJobId: jobId,
        runCount: scheduledJob.runCount
      }, 'Scheduled job executed successfully');

      this.emit('job:executed', {
        scheduledJobId: scheduledJob.id,
        queueJobId: jobId,
        manual,
        runCount: scheduledJob.runCount
      });

      return jobId;

    } catch (error) {
      scheduledJob.failureCount++;
      
      this.logger.error({
        jobId: scheduledJob.id,
        error,
        failureCount: scheduledJob.failureCount
      }, 'Scheduled job execution failed');

      this.emit('job:failed', {
        scheduledJobId: scheduledJob.id,
        error,
        failureCount: scheduledJob.failureCount
      });

      // Retry if configured
      if (this.config.retryFailedJobs && scheduledJob.failureCount <= 3) {
        setTimeout(() => {
          this.executeJob(scheduledJob);
        }, this.config.retryDelay);
      }

      throw error;

    } finally {
      this.runningJobs.delete(executionId);
    }
  }

  // Helper method to create system maintenance jobs
  scheduleSystemMaintenance(): void {
    const maintenanceJobs = [
      {
        id: 'system-cleanup',
        name: 'System Cleanup',
        cronExpression: '0 2 * * *', // Daily at 2 AM
        queueName: 'system-maintenance',
        jobData: {
          type: 'system.cleanup' as JobType,
          payload: { type: 'daily' },
          metadata: {
            source: 'scheduled' as const,
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      },
      {
        id: 'health-check',
        name: 'Health Check',
        cronExpression: '*/5 * * * *', // Every 5 minutes
        queueName: 'system-maintenance',
        jobData: {
          type: 'system.health.check' as JobType,
          payload: { comprehensive: false },
          metadata: {
            source: 'scheduled' as const,
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      },
      {
        id: 'memory-cleanup',
        name: 'Memory Cleanup',
        cronExpression: '0 */6 * * *', // Every 6 hours
        queueName: 'system-maintenance',
        jobData: {
          type: 'memory.cleanup' as JobType,
          payload: { type: 'expired' },
          metadata: {
            source: 'scheduled' as const,
            timestamp: Date.now(),
            version: '1.0.0'
          }
        }
      }
    ];

    for (const job of maintenanceJobs) {
      this.scheduleJob(
        job.id,
        job.name,
        job.cronExpression,
        job.queueName,
        job.jobData
      ).catch(error => {
        this.logger.error({
          jobId: job.id,
          error
        }, 'Failed to schedule maintenance job');
      });
    }
  }
}