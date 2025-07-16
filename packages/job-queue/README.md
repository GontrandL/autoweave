# @autoweave/job-queue

Enhanced job queue system for AutoWeave built on BullMQ with production-ready features.

## Features

- **Multi-Queue Support**: Separate queues for different job types (USB events, plugin operations, LLM processing, system maintenance)
- **Auto-Scaling Worker Pools**: Dynamically scale workers based on queue load (2-20 workers)
- **USB Event Bridge**: Seamless integration with existing USB daemon via Redis streams
- **Secure Plugin Execution**: VM2 sandbox integration with resource monitoring
- **Production Features**: Graceful shutdown, health checks, metrics collection, alerting
- **Job Scheduling**: Cron-based job scheduling with retry policies
- **Performance Monitoring**: Real-time metrics and performance tracking

## Installation

```bash
npm install @autoweave/job-queue
```

## Quick Start

```typescript
import { createJobQueueService } from '@autoweave/job-queue';

// Create job queue service
const service = await createJobQueueService({
  redis: {
    host: 'localhost',
    port: 6379
  },
  usbBridge: {
    enabled: true
  }
});

// Start the service
await service.start();

// Add a job
const jobId = await service.jobManager.addJob('plugin-jobs', {
  type: 'plugin.load',
  payload: {
    pluginId: 'usb-scanner',
    operation: 'load',
    pluginPath: '/path/to/plugin'
  },
  metadata: {
    source: 'manual',
    timestamp: Date.now(),
    version: '1.0.0'
  }
});

// Check health
const health = await service.getHealthStatus();
console.log('Health Status:', health);

// Get metrics
const metrics = await service.getMetrics();
console.log('Queue Metrics:', metrics);

// Graceful shutdown
await service.stop();
```

## Configuration

### Basic Configuration

```typescript
const service = await createJobQueueService({
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0
  },
  queues: [
    {
      name: 'custom-queue',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      },
      workers: {
        minWorkers: 2,
        maxWorkers: 10,
        concurrency: 5,
        autoScale: true
      }
    }
  ],
  monitoring: {
    enabled: true,
    metricsInterval: 30000, // 30 seconds
    retentionDays: 7
  }
});
```

### Production Configuration

```typescript
const service = await createProductionJobQueueService({
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD
  },
  usbBridge: {
    enabled: true,
    pluginFiltering: {
      enabled: true,
      allowedPlugins: ['1234:5678', '9abc:def0'],
      requirePermission: true
    }
  }
});
```

## Job Types

### USB Events

```typescript
// USB device attached
await jobManager.addJob('usb-events', {
  type: 'usb.device.attached',
  payload: {
    action: 'attach',
    deviceInfo: {
      vendorId: 0x1234,
      productId: 0x5678,
      manufacturer: 'Example Corp',
      product: 'USB Device',
      serialNumber: 'ABC123',
      signature: 'device-signature'
    },
    timestamp: Date.now()
  },
  metadata: {
    source: 'usb-daemon',
    timestamp: Date.now(),
    version: '1.0.0'
  }
});
```

### Plugin Operations

```typescript
// Load plugin
await jobManager.addJob('plugin-jobs', {
  type: 'plugin.load',
  payload: {
    pluginId: 'my-plugin',
    operation: 'load',
    pluginPath: '/path/to/plugin',
    config: { /* plugin config */ }
  },
  metadata: {
    source: 'manual',
    pluginId: 'my-plugin',
    timestamp: Date.now(),
    version: '1.0.0'
  }
});

// Execute plugin
await jobManager.addJob('plugin-jobs', {
  type: 'plugin.execute',
  payload: {
    pluginId: 'my-plugin',
    operation: 'execute',
    parameters: { /* execution parameters */ }
  },
  metadata: {
    source: 'manual',
    pluginId: 'my-plugin',
    timestamp: Date.now(),
    version: '1.0.0'
  }
});
```

### System Operations

```typescript
// System maintenance
await jobManager.addJob('system-maintenance', {
  type: 'system.cleanup',
  payload: { type: 'daily' },
  metadata: {
    source: 'scheduled',
    timestamp: Date.now(),
    version: '1.0.0'
  }
});
```

## Worker Pools

Worker pools automatically scale based on queue load:

```typescript
// Get worker pool status
const workerPool = jobManager.getWorkerPool('plugin-jobs');
const status = await workerPool.getPoolStatus();

console.log('Worker Pool Status:', {
  size: status.size,
  healthy: status.healthy,
  unhealthy: status.unhealthy,
  scaling: status.scaling
});

// Manual scaling
await jobManager.scaleWorkers('plugin-jobs', 8);
```

## Health Monitoring

```typescript
// Get health status
const health = await jobManager.getHealthStatus();

console.log('Overall Status:', health.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Redis:', health.checks.redis);
console.log('Queues:', health.checks.queues);
console.log('Workers:', health.checks.workers);
console.log('Memory:', health.checks.memory);
console.log('CPU:', health.checks.cpu);
```

## Metrics Collection

```typescript
// Get current metrics
const metrics = await jobManager.getQueueMetrics();

// Get specific queue metrics
const usbMetrics = await jobManager.getQueueMetrics('usb-events');

// Export metrics
const metricsCollector = jobManager.getMetricsCollector();
const csvData = await metricsCollector.exportMetrics('csv');
```

## Job Scheduling

```typescript
import { JobScheduler } from '@autoweave/job-queue';

const scheduler = new JobScheduler(jobManager);

// Schedule a job
await scheduler.scheduleJob(
  'daily-cleanup',
  'Daily System Cleanup',
  '0 2 * * *', // Daily at 2 AM
  'system-maintenance',
  {
    type: 'system.cleanup',
    payload: { type: 'daily' },
    metadata: {
      source: 'scheduled',
      timestamp: Date.now(),
      version: '1.0.0'
    }
  }
);

// Start scheduler
scheduler.start();

// Get scheduled jobs
const jobs = scheduler.getAllScheduledJobs();
```

## USB Event Bridge

The USB Event Bridge connects the existing USB daemon to the job queue system:

```typescript
// USB bridge is automatically configured when enabled
const service = await createJobQueueService({
  usbBridge: {
    enabled: true,
    streamName: 'aw:hotplug',
    consumerGroup: 'job-queue',
    batchSize: 10,
    maxRetries: 3,
    processingTimeout: 30000
  }
});
```

## Security

All plugin jobs are executed in a secure VM2 sandbox:

```typescript
const service = await createJobQueueService({
  security: {
    defaultSandbox: {
      sandboxEnabled: true,
      timeoutMs: 30000,
      memoryLimitMB: 128,
      allowedModules: ['fs', 'path', 'util'],
      blockedModules: ['child_process', 'cluster']
    }
  }
});
```

## Error Handling

```typescript
// Job failed event
jobManager.on('job:failed', ({ queueName, jobId, error }) => {
  console.error(`Job ${jobId} failed in queue ${queueName}:`, error);
});

// Worker error event
jobManager.on('worker:error', ({ queueName, workerId, error }) => {
  console.error(`Worker ${workerId} error in queue ${queueName}:`, error);
});

// Health alert event
jobManager.on('health:alert', ({ level, message, details }) => {
  console.warn(`Health alert (${level}): ${message}`, details);
});
```

## Performance Tuning

### Queue Configuration

```typescript
const service = await createJobQueueService({
  queues: [
    {
      name: 'high-priority',
      defaultJobOptions: {
        priority: 10,
        attempts: 3,
        removeOnComplete: 50,
        removeOnFail: 25
      },
      workers: {
        minWorkers: 5,
        maxWorkers: 20,
        concurrency: 10,
        autoScale: true,
        scaleUpThreshold: 20,
        scaleDownThreshold: 5
      }
    }
  ]
});
```

### Monitoring Configuration

```typescript
const service = await createJobQueueService({
  monitoring: {
    enabled: true,
    metricsInterval: 15000, // 15 seconds
    retentionDays: 30,
    alerting: {
      enabled: true,
      thresholds: {
        queueBacklog: 100,
        failureRate: 0.05,
        processingTime: 30000,
        memoryUsage: 500
      }
    }
  }
});
```

## Testing

```typescript
import { createTestJobQueueService } from '@autoweave/job-queue';

// Create test service
const service = await createTestJobQueueService();

// Add test job
const jobId = await service.jobManager.addJob('test-queue', {
  type: 'plugin.execute',
  payload: { test: true },
  metadata: {
    source: 'manual',
    timestamp: Date.now(),
    version: '1.0.0'
  }
});

// Wait for job completion
await new Promise(resolve => {
  service.jobManager.on('job:completed', ({ jobId: completedJobId }) => {
    if (completedJobId === jobId) {
      resolve();
    }
  });
});

// Cleanup
await service.stop();
```

## Architecture

The job queue system consists of several key components:

1. **AutoWeaveJobManager**: Main orchestrator managing queues and workers
2. **WorkerPoolManager**: Manages auto-scaling worker pools for each queue
3. **SecureWorkerRunner**: Executes jobs in secure VM2 sandboxes
4. **USBEventBridge**: Connects USB daemon to job queues
5. **HealthMonitor**: Monitors system health and alerts
6. **MetricsCollector**: Collects and exports performance metrics
7. **JobScheduler**: Handles cron-based job scheduling

## Integration with AutoWeave

This package integrates seamlessly with other AutoWeave packages:

- **@autoweave/usb-daemon**: USB events are automatically bridged to job queues
- **@autoweave/plugin-loader**: Plugin operations are executed securely
- **@autoweave/memory**: Memory operations are queued and processed
- **@autoweave/observability**: Metrics and health data are exported

## License

MIT