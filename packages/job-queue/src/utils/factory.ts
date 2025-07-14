import { AutoWeaveJobManager } from '../managers/autoweave-job-manager';
import { USBEventBridge } from '../bridges/usb-event-bridge';
import { processorRegistry } from '../processors/processor-registry';
import {
  AutoWeaveJobManagerConfig,
  QueueConfiguration,
  WorkerPoolConfig,
  MonitoringConfig,
  HealthConfig,
  GlobalSecurityConfig,
  RedisConfig
} from '../types';

import {
  DEFAULT_QUEUE_CONFIGS,
  DEFAULT_REDIS_CONFIG,
  DEFAULT_MONITORING_CONFIG,
  DEFAULT_HEALTH_CONFIG,
  DEFAULT_SECURITY_CONFIG
} from '../index';

export interface JobQueueServiceConfig {
  redis?: Partial<RedisConfig>;
  queues?: Partial<QueueConfiguration>[];
  monitoring?: Partial<MonitoringConfig>;
  health?: Partial<HealthConfig>;
  security?: Partial<GlobalSecurityConfig>;
  usbBridge?: {
    enabled: boolean;
    streamName?: string;
    consumerGroup?: string;
    consumerName?: string;
    batchSize?: number;
    pollInterval?: number;
    maxRetries?: number;
    processingTimeout?: number;
    pluginFiltering?: {
      enabled: boolean;
      allowedPlugins: string[];
      requirePermission: boolean;
    };
  };
}

export interface JobQueueService {
  jobManager: AutoWeaveJobManager;
  usbBridge?: USBEventBridge;
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealthStatus(): Promise<any>;
  getMetrics(): Promise<any>;
}

export async function createJobQueueService(config: JobQueueServiceConfig = {}): Promise<JobQueueService> {
  // Build Redis configuration
  const redisConfig: RedisConfig = {
    ...DEFAULT_REDIS_CONFIG,
    ...config.redis
  };

  // Build queue configurations
  const queueConfigs: QueueConfiguration[] = [];
  const defaultQueues = Object.values(DEFAULT_QUEUE_CONFIGS);
  
  for (const defaultQueue of defaultQueues) {
    const userConfig = config.queues?.find(q => q.name === defaultQueue.name);
    const queueConfig: QueueConfiguration = {
      ...defaultQueue,
      ...userConfig,
      redis: redisConfig
    };
    queueConfigs.push(queueConfig);
  }

  // Add any additional user-defined queues
  if (config.queues) {
    for (const userQueue of config.queues) {
      if (!queueConfigs.find(q => q.name === userQueue.name)) {
        const queueConfig: QueueConfiguration = {
          name: userQueue.name!,
          redis: redisConfig,
          defaultJobOptions: userQueue.defaultJobOptions || {},
          settings: userQueue.settings || {},
          workers: userQueue.workers || {
            minWorkers: 1,
            maxWorkers: 5,
            concurrency: 2,
            autoScale: true,
            scaleUpThreshold: 5,
            scaleDownThreshold: 1,
            scaleUpCooldown: 30000,
            scaleDownCooldown: 60000
          }
        };
        queueConfigs.push(queueConfig);
      }
    }
  }

  // Build monitoring configuration
  const monitoringConfig: MonitoringConfig = {
    ...DEFAULT_MONITORING_CONFIG,
    ...config.monitoring
  };

  // Build health configuration
  const healthConfig: HealthConfig = {
    ...DEFAULT_HEALTH_CONFIG,
    ...config.health
  };

  // Build security configuration
  const securityConfig: GlobalSecurityConfig = {
    ...DEFAULT_SECURITY_CONFIG,
    ...config.security
  };

  // Build job manager configuration
  const jobManagerConfig: AutoWeaveJobManagerConfig = {
    redis: redisConfig,
    queues: queueConfigs,
    defaultWorkerPool: {
      minWorkers: 1,
      maxWorkers: 10,
      concurrency: 5,
      autoScale: true,
      scaleUpThreshold: 10,
      scaleDownThreshold: 2,
      scaleUpCooldown: 30000,
      scaleDownCooldown: 60000
    },
    monitoring: monitoringConfig,
    health: healthConfig,
    security: securityConfig
  };

  // Create job manager
  const jobManager = new AutoWeaveJobManager(jobManagerConfig);

  // Create USB bridge if enabled
  let usbBridge: USBEventBridge | undefined;
  if (config.usbBridge?.enabled) {
    const usbBridgeConfig = {
      queueName: 'usb-events',
      streamName: config.usbBridge.streamName || 'aw:hotplug',
      consumerGroup: config.usbBridge.consumerGroup || 'job-queue',
      consumerName: config.usbBridge.consumerName || 'main',
      redis: redisConfig,
      batchSize: config.usbBridge.batchSize || 10,
      pollInterval: config.usbBridge.pollInterval || 100,
      maxRetries: config.usbBridge.maxRetries || 3,
      processingTimeout: config.usbBridge.processingTimeout || 30000,
      pluginFiltering: config.usbBridge.pluginFiltering || {
        enabled: false,
        allowedPlugins: [],
        requirePermission: false
      }
    };

    usbBridge = new USBEventBridge(usbBridgeConfig, jobManager);
  }

  // Setup processors for each queue
  await setupQueueProcessors(jobManager, queueConfigs);

  return {
    jobManager,
    usbBridge,
    
    async start() {
      // Initialize job manager
      await jobManager.initialize();
      
      // Start USB bridge if enabled
      if (usbBridge) {
        await usbBridge.start();
      }
    },
    
    async stop() {
      // Stop USB bridge
      if (usbBridge) {
        await usbBridge.stop();
      }
      
      // Shutdown job manager
      await jobManager.gracefulShutdown();
    },
    
    async getHealthStatus() {
      return jobManager.getHealthStatus();
    },
    
    async getMetrics() {
      return jobManager.getQueueMetrics();
    }
  };
}

async function setupQueueProcessors(jobManager: AutoWeaveJobManager, queueConfigs: QueueConfiguration[]): Promise<void> {
  for (const queueConfig of queueConfigs) {
    // Create a processor for this queue
    const processor = processorRegistry.createDefaultProcessor(queueConfig.name);
    
    // Create worker configuration
    const workerConfig = {
      queueName: queueConfig.name,
      processFunction: processor,
      concurrency: queueConfig.workers?.concurrency || 1,
      removeOnComplete: queueConfig.defaultJobOptions?.removeOnComplete || 10,
      removeOnFail: queueConfig.defaultJobOptions?.removeOnFail || 5,
      security: {
        sandboxEnabled: true,
        timeoutMs: 30000,
        memoryLimitMB: 128,
        allowedModules: ['fs', 'path', 'util'],
        blockedModules: ['child_process', 'cluster']
      }
    };

    // Initialize worker pool if configured
    if (queueConfig.workers) {
      const workerPool = jobManager.getWorkerPool(queueConfig.name);
      if (workerPool) {
        await workerPool.initialize(processor);
      }
    }
  }
}

// Helper function to create a minimal job queue service for testing
export async function createTestJobQueueService(): Promise<JobQueueService> {
  return createJobQueueService({
    redis: {
      host: 'localhost',
      port: 6379,
      db: 15 // Use a different DB for testing
    },
    queues: [
      {
        name: 'test-queue',
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 5,
          removeOnFail: 5
        },
        workers: {
          minWorkers: 1,
          maxWorkers: 2,
          concurrency: 1,
          autoScale: false,
          scaleUpThreshold: 1,
          scaleDownThreshold: 0,
          scaleUpCooldown: 10000,
          scaleDownCooldown: 10000
        }
      }
    ],
    monitoring: {
      enabled: false,
      metricsInterval: 5000,
      retentionDays: 1
    },
    health: {
      checkInterval: 10000,
      timeout: 2000,
      retries: 1
    },
    usbBridge: {
      enabled: false
    }
  });
}

// Helper function to create a production-ready job queue service
export async function createProductionJobQueueService(overrides: Partial<JobQueueServiceConfig> = {}): Promise<JobQueueService> {
  const productionConfig: JobQueueServiceConfig = {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    monitoring: {
      enabled: true,
      metricsInterval: 30000, // 30 seconds
      retentionDays: 30,
      alerting: {
        enabled: true,
        thresholds: {
          queueBacklog: 500,
          failureRate: 0.05,
          processingTime: 60000,
          memoryUsage: 1000 // 1GB
        }
      }
    },
    health: {
      checkInterval: 60000, // 1 minute
      timeout: 10000,
      retries: 3
    },
    security: {
      defaultSandbox: {
        sandboxEnabled: true,
        timeoutMs: 60000,
        memoryLimitMB: 256,
        allowedModules: ['fs', 'path', 'util', 'crypto', 'events', 'stream'],
        blockedModules: ['child_process', 'cluster', 'worker_threads', 'vm']
      },
      trustedPlugins: [],
      resourceLimits: {
        maxMemoryMB: 512,
        maxCpuPercent: 80,
        maxExecutionTimeMs: 120000
      }
    },
    usbBridge: {
      enabled: true,
      streamName: 'aw:hotplug',
      consumerGroup: 'job-queue-prod',
      consumerName: `worker-${process.env.HOSTNAME || 'default'}`,
      batchSize: 20,
      pollInterval: 50,
      maxRetries: 5,
      processingTimeout: 30000,
      pluginFiltering: {
        enabled: true,
        allowedPlugins: process.env.ALLOWED_USB_DEVICES?.split(',') || [],
        requirePermission: true
      }
    },
    ...overrides
  };

  return createJobQueueService(productionConfig);
}