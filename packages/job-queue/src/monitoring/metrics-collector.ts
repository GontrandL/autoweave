import { EventEmitter } from 'events';
import { Logger } from 'pino';
import pino from 'pino';

import { AutoWeaveJobManager } from '../managers/autoweave-job-manager';
import {
  QueueMetrics,
  WorkerMetrics,
  MonitoringConfig,
  QueueManagerError
} from '../types';

interface MetricsSnapshot {
  timestamp: number;
  queues: Record<string, QueueMetrics>;
  workers: Record<string, WorkerMetrics[]>;
  system: SystemMetrics;
}

interface SystemMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  loadAverage: number[];
  freeMemory: number;
  totalMemory: number;
}

interface AggregatedMetrics {
  totalJobs: number;
  totalCompleted: number;
  totalFailed: number;
  totalWaiting: number;
  totalActive: number;
  avgCompletionTime: number;
  avgWaitTime: number;
  failureRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
  activeWorkers: number;
  totalWorkers: number;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: AggregatedMetrics) => boolean;
  threshold: number;
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
}

export class MetricsCollector extends EventEmitter {
  private config: MonitoringConfig;
  private jobManager: AutoWeaveJobManager;
  private logger: Logger;
  private isRunning = false;
  private collectionInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private metricsHistory: MetricsSnapshot[] = [];
  private alertRules = new Map<string, AlertRule>();
  private performanceBaseline?: AggregatedMetrics;

  constructor(jobManager: AutoWeaveJobManager, config: MonitoringConfig) {
    super();
    this.jobManager = jobManager;
    this.config = config;

    this.logger = pino({
      name: 'metrics-collector',
      level: process.env.LOG_LEVEL || 'info'
    });

    this.setupDefaultAlertRules();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Metrics collector is already running');
      return;
    }

    this.logger.info('Starting metrics collector...');
    this.isRunning = true;

    // Collect initial metrics
    await this.collectMetrics();

    // Setup periodic collection
    this.collectionInterval = setInterval(async () => {
      await this.collectMetrics();
    }, this.config.metricsInterval);

    // Setup cleanup interval (run daily)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 24 * 60 * 60 * 1000);

    this.logger.info({
      interval: this.config.metricsInterval,
      retentionDays: this.config.retentionDays
    }, 'Metrics collector started');

    this.emit('collector:started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping metrics collector...');
    this.isRunning = false;

    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.logger.info('Metrics collector stopped');
    this.emit('collector:stopped');
  }

  private async collectMetrics(): Promise<void> {
    try {
      const timestamp = Date.now();
      
      // Collect queue metrics
      const queueMetrics = await this.collectQueueMetrics();
      
      // Collect worker metrics
      const workerMetrics = await this.collectWorkerMetrics();
      
      // Collect system metrics
      const systemMetrics = this.collectSystemMetrics();

      // Create snapshot
      const snapshot: MetricsSnapshot = {
        timestamp,
        queues: queueMetrics,
        workers: workerMetrics,
        system: systemMetrics
      };

      // Store in history
      this.metricsHistory.push(snapshot);

      // Calculate aggregated metrics
      const aggregatedMetrics = this.calculateAggregatedMetrics(snapshot);

      // Check alert rules
      await this.checkAlertRules(aggregatedMetrics);

      // Update performance baseline
      this.updatePerformanceBaseline(aggregatedMetrics);

      this.logger.debug({
        timestamp,
        queueCount: Object.keys(queueMetrics).length,
        workerCount: Object.keys(workerMetrics).length,
        totalJobs: aggregatedMetrics.totalJobs
      }, 'Metrics collected');

      this.emit('metrics:collected', {
        snapshot,
        aggregated: aggregatedMetrics
      });

    } catch (error) {
      this.logger.error({ error }, 'Failed to collect metrics');
      this.emit('metrics:error', error);
    }
  }

  private async collectQueueMetrics(): Promise<Record<string, QueueMetrics>> {
    try {
      const metrics = await this.jobManager.getQueueMetrics() as Record<string, QueueMetrics>;
      
      // Enhance with additional calculated metrics
      for (const [queueName, queueMetrics] of Object.entries(metrics)) {
        // Calculate completion and failure rates
        const total = queueMetrics.completed + queueMetrics.failed;
        queueMetrics.completedPerHour = this.calculateHourlyRate(queueName, 'completed');
        queueMetrics.failedPerHour = this.calculateHourlyRate(queueName, 'failed');
        queueMetrics.avgProcessingTime = this.calculateAverageProcessingTime(queueName);
        queueMetrics.avgWaitTime = this.calculateAverageWaitTime(queueName);
      }

      return metrics;
    } catch (error) {
      this.logger.error({ error }, 'Failed to collect queue metrics');
      return {};
    }
  }

  private async collectWorkerMetrics(): Promise<Record<string, WorkerMetrics[]>> {
    const workerMetrics: Record<string, WorkerMetrics[]> = {};

    try {
      const queueNames = this.jobManager.getQueueNames();
      
      for (const queueName of queueNames) {
        const workerPool = this.jobManager.getWorkerPool(queueName);
        if (workerPool) {
          const metrics = await workerPool.getWorkerMetrics();
          workerMetrics[queueName] = metrics;
        }
      }

      return workerMetrics;
    } catch (error) {
      this.logger.error({ error }, 'Failed to collect worker metrics');
      return {};
    }
  }

  private collectSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = require('os').loadavg();
    const freeMemory = require('os').freemem();
    const totalMemory = require('os').totalmem();

    return {
      memoryUsage,
      cpuUsage,
      uptime: process.uptime(),
      loadAverage,
      freeMemory,
      totalMemory
    };
  }

  private calculateAggregatedMetrics(snapshot: MetricsSnapshot): AggregatedMetrics {
    const queueMetrics = Object.values(snapshot.queues);
    const workerMetrics = Object.values(snapshot.workers).flat();

    const totalJobs = queueMetrics.reduce((sum, q) => sum + q.completed + q.failed + q.active + q.waiting, 0);
    const totalCompleted = queueMetrics.reduce((sum, q) => sum + q.completed, 0);
    const totalFailed = queueMetrics.reduce((sum, q) => sum + q.failed, 0);
    const totalWaiting = queueMetrics.reduce((sum, q) => sum + q.waiting, 0);
    const totalActive = queueMetrics.reduce((sum, q) => sum + q.active, 0);

    const avgCompletionTime = queueMetrics.reduce((sum, q) => sum + q.avgProcessingTime, 0) / queueMetrics.length || 0;
    const avgWaitTime = queueMetrics.reduce((sum, q) => sum + q.avgWaitTime, 0) / queueMetrics.length || 0;
    const failureRate = totalJobs > 0 ? totalFailed / totalJobs : 0;

    // Calculate throughput (jobs per second)
    const throughput = this.calculateThroughput();

    const memoryUsage = snapshot.system.memoryUsage.heapUsed / 1024 / 1024; // MB
    const cpuUsage = snapshot.system.cpuUsage.user / 1000; // ms

    const activeWorkers = workerMetrics.filter(w => w.isRunning).length;
    const totalWorkers = workerMetrics.length;

    return {
      totalJobs,
      totalCompleted,
      totalFailed,
      totalWaiting,
      totalActive,
      avgCompletionTime,
      avgWaitTime,
      failureRate,
      throughput,
      memoryUsage,
      cpuUsage,
      activeWorkers,
      totalWorkers
    };
  }

  private calculateHourlyRate(queueName: string, metric: 'completed' | 'failed'): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const relevantSnapshots = this.metricsHistory.filter(s => s.timestamp >= oneHourAgo);
    
    if (relevantSnapshots.length < 2) {
      return 0;
    }

    const firstSnapshot = relevantSnapshots[0];
    const lastSnapshot = relevantSnapshots[relevantSnapshots.length - 1];

    const firstValue = firstSnapshot.queues[queueName]?.[metric] || 0;
    const lastValue = lastSnapshot.queues[queueName]?.[metric] || 0;

    return Math.max(0, lastValue - firstValue);
  }

  private calculateAverageProcessingTime(queueName: string): number {
    const recentSnapshots = this.metricsHistory.slice(-10);
    if (recentSnapshots.length === 0) return 0;

    const times = recentSnapshots
      .map(s => s.queues[queueName]?.avgProcessingTime || 0)
      .filter(t => t > 0);

    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  }

  private calculateAverageWaitTime(queueName: string): number {
    const recentSnapshots = this.metricsHistory.slice(-10);
    if (recentSnapshots.length === 0) return 0;

    const times = recentSnapshots
      .map(s => s.queues[queueName]?.avgWaitTime || 0)
      .filter(t => t > 0);

    return times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0;
  }

  private calculateThroughput(): number {
    if (this.metricsHistory.length < 2) return 0;

    const recent = this.metricsHistory.slice(-2);
    const [prev, current] = recent;

    const timeDiff = (current.timestamp - prev.timestamp) / 1000; // seconds
    if (timeDiff === 0) return 0;

    const prevCompleted = Object.values(prev.queues).reduce((sum, q) => sum + q.completed, 0);
    const currentCompleted = Object.values(current.queues).reduce((sum, q) => sum + q.completed, 0);

    return (currentCompleted - prevCompleted) / timeDiff;
  }

  private setupDefaultAlertRules(): void {
    const rules: AlertRule[] = [
      {
        id: 'high-failure-rate',
        name: 'High Failure Rate',
        condition: (metrics) => metrics.failureRate > 0.1,
        threshold: 0.1,
        enabled: true,
        cooldownMs: 5 * 60 * 1000 // 5 minutes
      },
      {
        id: 'queue-backlog',
        name: 'Queue Backlog',
        condition: (metrics) => metrics.totalWaiting > 1000,
        threshold: 1000,
        enabled: true,
        cooldownMs: 2 * 60 * 1000 // 2 minutes
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: (metrics) => metrics.memoryUsage > 500, // 500MB
        threshold: 500,
        enabled: true,
        cooldownMs: 10 * 60 * 1000 // 10 minutes
      },
      {
        id: 'low-throughput',
        name: 'Low Throughput',
        condition: (metrics) => metrics.throughput < 0.1 && metrics.totalWaiting > 10,
        threshold: 0.1,
        enabled: true,
        cooldownMs: 5 * 60 * 1000 // 5 minutes
      },
      {
        id: 'worker-failures',
        name: 'Worker Failures',
        condition: (metrics) => metrics.totalWorkers > 0 && metrics.activeWorkers / metrics.totalWorkers < 0.8,
        threshold: 0.8,
        enabled: true,
        cooldownMs: 3 * 60 * 1000 // 3 minutes
      }
    ];

    rules.forEach(rule => this.alertRules.set(rule.id, rule));
  }

  private async checkAlertRules(metrics: AggregatedMetrics): Promise<void> {
    const now = Date.now();

    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && now - rule.lastTriggered < rule.cooldownMs) {
        continue;
      }

      // Check condition
      if (rule.condition(metrics)) {
        rule.lastTriggered = now;

        this.logger.warn({
          ruleId,
          ruleName: rule.name,
          threshold: rule.threshold,
          metrics
        }, 'Alert rule triggered');

        this.emit('alert:triggered', {
          ruleId,
          ruleName: rule.name,
          threshold: rule.threshold,
          currentValue: this.extractRuleValue(rule, metrics),
          timestamp: now,
          metrics
        });
      }
    }
  }

  private extractRuleValue(rule: AlertRule, metrics: AggregatedMetrics): number {
    switch (rule.id) {
      case 'high-failure-rate':
        return metrics.failureRate;
      case 'queue-backlog':
        return metrics.totalWaiting;
      case 'high-memory-usage':
        return metrics.memoryUsage;
      case 'low-throughput':
        return metrics.throughput;
      case 'worker-failures':
        return metrics.totalWorkers > 0 ? metrics.activeWorkers / metrics.totalWorkers : 0;
      default:
        return 0;
    }
  }

  private updatePerformanceBaseline(metrics: AggregatedMetrics): void {
    if (!this.performanceBaseline) {
      this.performanceBaseline = { ...metrics };
      return;
    }

    // Update baseline with exponential moving average
    const alpha = 0.05; // Slow adaptation
    this.performanceBaseline = {
      ...this.performanceBaseline,
      avgCompletionTime: alpha * metrics.avgCompletionTime + (1 - alpha) * this.performanceBaseline.avgCompletionTime,
      avgWaitTime: alpha * metrics.avgWaitTime + (1 - alpha) * this.performanceBaseline.avgWaitTime,
      throughput: alpha * metrics.throughput + (1 - alpha) * this.performanceBaseline.throughput,
      memoryUsage: alpha * metrics.memoryUsage + (1 - alpha) * this.performanceBaseline.memoryUsage,
      cpuUsage: alpha * metrics.cpuUsage + (1 - alpha) * this.performanceBaseline.cpuUsage
    };
  }

  private cleanupOldMetrics(): void {
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - retentionMs;

    const initialCount = this.metricsHistory.length;
    this.metricsHistory = this.metricsHistory.filter(snapshot => snapshot.timestamp >= cutoffTime);

    const removedCount = initialCount - this.metricsHistory.length;
    
    if (removedCount > 0) {
      this.logger.info({
        removedCount,
        retentionDays: this.config.retentionDays,
        currentCount: this.metricsHistory.length
      }, 'Cleaned up old metrics');
    }
  }

  // Public API methods
  async getQueueMetrics(queueName?: string): Promise<QueueMetrics | Record<string, QueueMetrics>> {
    const allMetrics = await this.collectQueueMetrics();
    
    if (queueName) {
      return allMetrics[queueName];
    }
    
    return allMetrics;
  }

  async getAllQueueMetrics(): Promise<Record<string, QueueMetrics>> {
    return this.collectQueueMetrics();
  }

  getCurrentMetrics(): AggregatedMetrics | null {
    if (this.metricsHistory.length === 0) return null;
    
    const latestSnapshot = this.metricsHistory[this.metricsHistory.length - 1];
    return this.calculateAggregatedMetrics(latestSnapshot);
  }

  getMetricsHistory(hours?: number): MetricsSnapshot[] {
    if (!hours) return [...this.metricsHistory];

    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    return this.metricsHistory.filter(snapshot => snapshot.timestamp >= cutoffTime);
  }

  getPerformanceBaseline(): AggregatedMetrics | null {
    return this.performanceBaseline ? { ...this.performanceBaseline } : null;
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.info({ ruleId: rule.id, ruleName: rule.name }, 'Alert rule added');
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.logger.info({ ruleId }, 'Alert rule removed');
  }

  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      this.logger.info({ ruleId, updates }, 'Alert rule updated');
    }
  }

  getAlertRules(): Map<string, AlertRule> {
    return new Map(this.alertRules);
  }

  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const metrics = this.getCurrentMetrics();
    const history = this.getMetricsHistory(24); // Last 24 hours

    if (format === 'csv') {
      return this.convertToCSV(history);
    }

    return JSON.stringify({
      current: metrics,
      history: history,
      baseline: this.performanceBaseline
    }, null, 2);
  }

  private convertToCSV(snapshots: MetricsSnapshot[]): string {
    const headers = [
      'timestamp',
      'totalJobs',
      'totalCompleted',
      'totalFailed',
      'totalWaiting',
      'totalActive',
      'failureRate',
      'throughput',
      'memoryUsage',
      'cpuUsage',
      'activeWorkers',
      'totalWorkers'
    ];

    const rows = snapshots.map(snapshot => {
      const aggregated = this.calculateAggregatedMetrics(snapshot);
      return [
        snapshot.timestamp,
        aggregated.totalJobs,
        aggregated.totalCompleted,
        aggregated.totalFailed,
        aggregated.totalWaiting,
        aggregated.totalActive,
        aggregated.failureRate,
        aggregated.throughput,
        aggregated.memoryUsage,
        aggregated.cpuUsage,
        aggregated.activeWorkers,
        aggregated.totalWorkers
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}