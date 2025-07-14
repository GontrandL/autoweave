// Core exports
export * from './types';

// Managers
export { AutoWeaveJobManager } from './managers/autoweave-job-manager';
export { WorkerPoolManager } from './managers/worker-pool-manager';

// Workers
export { SecureWorkerRunner } from './workers/secure-worker-runner';

// Bridges
export { USBEventBridge } from './bridges/usb-event-bridge';

// Health & Monitoring
export { HealthMonitor } from './health/health-monitor';
export { MetricsCollector } from './monitoring/metrics-collector';

// Processors
export * from './processors';

// Utilities
export { createJobQueueService } from './utils/factory';
export { validateJobData } from './utils/validation';
export { JobScheduler } from './schedulers/job-scheduler';

// Constants
export const DEFAULT_QUEUE_CONFIGS = {
  'usb-events': {
    name: 'usb-events',
    defaultJobOptions: {
      priority: 10,
      attempts: 3,
      removeOnComplete: 100,
      removeOnFail: 50,
      backoff: {
        type: 'exponential' as const,
        delay: 1000
      }
    },
    workers: {
      minWorkers: 2,
      maxWorkers: 10,
      concurrency: 5,
      autoScale: true,
      scaleUpThreshold: 10,
      scaleDownThreshold: 2,
      scaleUpCooldown: 30000,
      scaleDownCooldown: 60000
    }
  },
  'plugin-jobs': {
    name: 'plugin-jobs',
    defaultJobOptions: {
      priority: 5,
      attempts: 2,
      removeOnComplete: 50,
      removeOnFail: 25,
      backoff: {
        type: 'exponential' as const,
        delay: 2000
      }
    },
    workers: {
      minWorkers: 1,
      maxWorkers: 8,
      concurrency: 3,
      autoScale: true,
      scaleUpThreshold: 5,
      scaleDownThreshold: 1,
      scaleUpCooldown: 45000,
      scaleDownCooldown: 90000
    }
  },
  'llm-batch': {
    name: 'llm-batch',
    defaultJobOptions: {
      priority: 3,
      attempts: 1,
      removeOnComplete: 20,
      removeOnFail: 10,
      backoff: {
        type: 'fixed' as const,
        delay: 5000
      }
    },
    workers: {
      minWorkers: 1,
      maxWorkers: 4,
      concurrency: 1,
      autoScale: true,
      scaleUpThreshold: 2,
      scaleDownThreshold: 0,
      scaleUpCooldown: 60000,
      scaleDownCooldown: 120000
    }
  },
  'system-maintenance': {
    name: 'system-maintenance',
    defaultJobOptions: {
      priority: 1,
      attempts: 1,
      removeOnComplete: 10,
      removeOnFail: 5,
      backoff: {
        type: 'fixed' as const,
        delay: 10000
      }
    },
    workers: {
      minWorkers: 1,
      maxWorkers: 2,
      concurrency: 1,
      autoScale: false,
      scaleUpThreshold: 1,
      scaleDownThreshold: 0,
      scaleUpCooldown: 300000,
      scaleDownCooldown: 600000
    }
  }
} as const;

export const DEFAULT_REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
} as const;

export const DEFAULT_MONITORING_CONFIG = {
  enabled: true,
  metricsInterval: 15000, // 15 seconds
  retentionDays: 7,
  alerting: {
    enabled: true,
    thresholds: {
      queueBacklog: 100,
      failureRate: 0.1,
      processingTime: 30000, // 30 seconds
      memoryUsage: 500 // 500MB
    }
  }
} as const;

export const DEFAULT_HEALTH_CONFIG = {
  checkInterval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  retries: 3
} as const;

export const DEFAULT_SECURITY_CONFIG = {
  sandboxEnabled: true,
  timeoutMs: 30000,
  memoryLimitMB: 128,
  allowedModules: ['fs', 'path', 'util', 'crypto', 'events', 'stream'],
  blockedModules: ['child_process', 'cluster', 'worker_threads', 'vm']
} as const;