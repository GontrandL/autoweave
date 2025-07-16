import { EventEmitter } from 'events';
import { Logger } from 'pino';
import pino from 'pino';

import { AutoWeaveJobManager } from '../managers/autoweave-job-manager';
import {
  HealthStatus,
  HealthConfig,
  QueueMetrics
} from '../types';

interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
  critical: boolean;
  timeout: number;
  lastResult?: boolean;
  lastError?: Error;
  lastChecked?: number;
}

// Removed unused SystemMetrics interface

export class HealthMonitor extends EventEmitter {
  private config: HealthConfig;
  private jobManager: AutoWeaveJobManager;
  private logger: Logger;
  private checks = new Map<string, HealthCheck>();
  private isRunning = false;
  private checkInterval?: NodeJS.Timeout;
  private startTime: number;
  private healthHistory: Array<{ timestamp: number; status: HealthStatus }> = [];
  private alertThresholds = {
    memoryUsage: 0.85,
    cpuUsage: 0.8,
    failureRate: 0.1,
    queueBacklog: 1000
  };

  constructor(jobManager: AutoWeaveJobManager, config: HealthConfig) {
    super();
    this.jobManager = jobManager;
    this.config = config;
    this.startTime = Date.now();

    this.logger = pino({
      name: 'health-monitor',
      level: process.env.LOG_LEVEL || 'info'
    });

    this.setupDefaultChecks();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Health monitor is already running');
      return;
    }

    this.logger.info('Starting health monitor...');
    this.isRunning = true;

    // Run initial health check
    await this.runHealthChecks();

    // Setup periodic health checks
    this.checkInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, this.config.checkInterval);

    this.logger.info({
      checkInterval: this.config.checkInterval,
      checksCount: this.checks.size
    }, 'Health monitor started');

    this.emit('monitor:started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping health monitor...');
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.logger.info('Health monitor stopped');
    this.emit('monitor:stopped');
  }

  private setupDefaultChecks(): void {
    // Redis connectivity check
    this.addCheck({
      name: 'redis',
      check: async () => {
        try {
          const redis = this.jobManager.getRedis();
          await redis.ping();
          return true;
        } catch (error) {
          return false;
        }
      },
      critical: true,
      timeout: 5000
    });

    // Queue health checks
    this.addCheck({
      name: 'queues',
      check: async () => {
        try {
          const queueNames = this.jobManager.getQueueNames();
          for (const queueName of queueNames) {
            const queue = this.jobManager.getQueue(queueName);
            if (!queue) {
              return false;
            }
            // Check if queue is responsive
            await queue.getJobCounts();
          }
          return true;
        } catch (error) {
          return false;
        }
      },
      critical: true,
      timeout: 10000
    });

    // Memory usage check
    this.addCheck({
      name: 'memory',
      check: async () => {
        const memoryUsage = process.memoryUsage();
        const usedMemory = memoryUsage.heapUsed;
        const totalMemory = memoryUsage.heapTotal;
        const memoryRatio = usedMemory / totalMemory;
        
        return memoryRatio < this.alertThresholds.memoryUsage;
      },
      critical: false,
      timeout: 1000
    });

    // CPU usage check
    this.addCheck({
      name: 'cpu',
      check: async () => {
        // Simple CPU check - in production, you'd want more sophisticated monitoring
        const loadAverage = require('os').loadavg();
        const cpuCount = require('os').cpus().length;
        const avgLoad = loadAverage[0] / cpuCount;
        
        return avgLoad < this.alertThresholds.cpuUsage;
      },
      critical: false,
      timeout: 1000
    });

    // Worker pools health check
    this.addCheck({
      name: 'worker-pools',
      check: async () => {
        try {
          const queueNames = this.jobManager.getQueueNames();
          for (const queueName of queueNames) {
            const workerPool = this.jobManager.getWorkerPool(queueName);
            if (workerPool) {
              const status = await workerPool.getPoolStatus();
              if (status.healthy === 0) {
                return false;
              }
            }
          }
          return true;
        } catch (error) {
          return false;
        }
      },
      critical: true,
      timeout: 5000
    });

    // Job failure rate check
    this.addCheck({
      name: 'job-failure-rate',
      check: async () => {
        try {
          const metrics = await this.jobManager.getQueueMetrics() as Record<string, QueueMetrics>;
          
          for (const [_queueName, queueMetrics] of Object.entries(metrics)) {
            const totalJobs = queueMetrics.completed + queueMetrics.failed;
            if (totalJobs > 0) {
              const failureRate = queueMetrics.failed / totalJobs;
              if (failureRate > this.alertThresholds.failureRate) {
                return false;
              }
            }
          }
          return true;
        } catch (error) {
          return false;
        }
      },
      critical: false,
      timeout: 3000
    });
  }

  addCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    this.logger.info({
      checkName: check.name,
      critical: check.critical,
      timeout: check.timeout
    }, 'Health check added');
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
    this.logger.info({ checkName: name }, 'Health check removed');
  }

  async runHealthChecks(): Promise<HealthStatus> {
    const startTime = Date.now();
    const checkResults = new Map<string, boolean>();
    const errors: string[] = [];

    // Run all checks concurrently
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      try {
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error(`Health check timeout: ${name}`)), check.timeout);
        });

        const result = await Promise.race([check.check(), timeoutPromise]);
        
        check.lastResult = result;
        check.lastChecked = Date.now();
        checkResults.set(name, result);

        if (!result) {
          const error = `Health check failed: ${name}`;
          errors.push(error);
          this.logger.warn({ checkName: name }, error);
        }

        return { name, result, error: null };

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        check.lastError = error as Error;
        check.lastResult = false;
        check.lastChecked = Date.now();
        checkResults.set(name, false);
        errors.push(`Health check error: ${name} - ${errorMessage}`);
        
        this.logger.error({
          checkName: name,
          error: errorMessage
        }, 'Health check failed with error');

        return { name, result: false, error: errorMessage };
      }
    });

    await Promise.all(checkPromises);

    // Determine overall health status
    const criticalChecks = Array.from(this.checks.values()).filter(c => c.critical);
    const failedCriticalChecks = criticalChecks.filter(c => c.lastResult === false);
    const failedChecks = Array.from(this.checks.values()).filter(c => c.lastResult === false);

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    
    if (failedCriticalChecks.length > 0) {
      overallStatus = 'unhealthy';
    } else if (failedChecks.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Get queue metrics
    const queueMetrics = await this.getQueueMetrics();

    // Build health status
    const healthStatus: HealthStatus = {
      status: overallStatus,
      checks: {
        redis: checkResults.get('redis') || false,
        queues: this.buildQueueHealthMap(queueMetrics),
        workers: this.buildWorkerHealthMap(),
        memory: checkResults.get('memory') || false,
        cpu: checkResults.get('cpu') || false
      },
      details: {
        uptime: Date.now() - this.startTime,
        totalJobs: this.calculateTotalJobs(queueMetrics),
        queueMetrics,
        errors
      }
    };

    // Store in history
    this.healthHistory.push({
      timestamp: Date.now(),
      status: healthStatus
    });

    // Keep only last 100 entries
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }

    // Emit health status event
    this.emit('health:status', healthStatus);

    // Emit alerts if needed
    if (overallStatus === 'unhealthy') {
      this.emit('health:alert', {
        level: 'critical',
        message: 'System is unhealthy',
        details: { failedChecks: failedCriticalChecks.map(c => c.name), errors }
      });
    } else if (overallStatus === 'degraded') {
      this.emit('health:alert', {
        level: 'warning',
        message: 'System is degraded',
        details: { failedChecks: failedChecks.map(c => c.name), errors }
      });
    }

    const checkTime = Date.now() - startTime;
    this.logger.info({
      status: overallStatus,
      checkTime,
      totalChecks: this.checks.size,
      failedChecks: failedChecks.length,
      errors: errors.length
    }, 'Health check completed');

    return healthStatus;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    return this.runHealthChecks();
  }

  getHealthHistory(): Array<{ timestamp: number; status: HealthStatus }> {
    return [...this.healthHistory];
  }

  private async getQueueMetrics(): Promise<QueueMetrics[]> {
    try {
      const metrics = await this.jobManager.getQueueMetrics() as Record<string, QueueMetrics>;
      return Object.values(metrics);
    } catch (error) {
      this.logger.error({ error }, 'Failed to get queue metrics');
      return [];
    }
  }

  private buildQueueHealthMap(queueMetrics: QueueMetrics[]): Record<string, boolean> {
    const queueHealth: Record<string, boolean> = {};
    
    for (const metrics of queueMetrics) {
      // Consider queue healthy if it's not severely backlogged
      const isHealthy = metrics.waiting < this.alertThresholds.queueBacklog;
      queueHealth[metrics.queueName] = isHealthy;
    }

    return queueHealth;
  }

  private buildWorkerHealthMap(): Record<string, boolean> {
    const workerHealth: Record<string, boolean> = {};
    
    try {
      const queueNames = this.jobManager.getQueueNames();
      for (const queueName of queueNames) {
        const workerPool = this.jobManager.getWorkerPool(queueName);
        if (workerPool) {
          // We'll assume healthy if pool exists - actual health is checked in worker-pools check
          workerHealth[queueName] = true;
        } else {
          workerHealth[queueName] = false;
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to build worker health map');
    }

    return workerHealth;
  }

  private calculateTotalJobs(queueMetrics: QueueMetrics[]): number {
    return queueMetrics.reduce((total, metrics) => {
      return total + metrics.completed + metrics.failed + metrics.active + metrics.waiting;
    }, 0);
  }

  // Removed unused _getSystemMetrics method

  updateThresholds(newThresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
    this.logger.info({
      thresholds: this.alertThresholds
    }, 'Alert thresholds updated');
  }

  getCheckResults(): Map<string, HealthCheck> {
    return new Map(this.checks);
  }

  async forceHealthCheck(): Promise<HealthStatus> {
    this.logger.info('Forcing health check...');
    return this.runHealthChecks();
  }
}