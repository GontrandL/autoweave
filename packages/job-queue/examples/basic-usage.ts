import { createJobQueueService, JobType } from '../src';

async function basicUsageExample() {
  console.log('🚀 Starting AutoWeave Job Queue Example...');

  // Create job queue service
  const service = await createJobQueueService({
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0
    },
    usbBridge: {
      enabled: true,
      streamName: 'aw:hotplug',
      consumerGroup: 'example-consumer',
      batchSize: 5,
      maxRetries: 3
    },
    monitoring: {
      enabled: true,
      metricsInterval: 10000, // 10 seconds
      retentionDays: 1
    }
  });

  // Start the service
  await service.start();
  console.log('✅ Job queue service started');

  // Set up event listeners
  service.jobManager.on('job:completed', ({ queueName, jobId, result }) => {
    console.log(`✅ Job ${jobId} completed in queue ${queueName}`);
  });

  service.jobManager.on('job:failed', ({ queueName, jobId, error }) => {
    console.error(`❌ Job ${jobId} failed in queue ${queueName}:`, error);
  });

  service.jobManager.on('worker:scaled', ({ queueName, newSize }) => {
    console.log(`🔄 Workers scaled to ${newSize} in queue ${queueName}`);
  });

  // Add some example jobs
  console.log('\n📋 Adding example jobs...');

  // USB device simulation
  const usbJobId = await service.jobManager.addJob('usb-events', {
    type: 'usb.device.attached',
    payload: {
      action: 'attach',
      deviceInfo: {
        vendorId: 0x1234,
        productId: 0x5678,
        manufacturer: 'Example Corp',
        product: 'USB Scanner',
        serialNumber: 'ABC123',
        signature: 'example-device-signature'
      },
      timestamp: Date.now()
    },
    metadata: {
      source: 'manual',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 10
  });

  console.log(`📱 USB job added: ${usbJobId}`);

  // Plugin operations
  const pluginLoadJobId = await service.jobManager.addJob('plugin-jobs', {
    type: 'plugin.load',
    payload: {
      pluginId: 'usb-scanner-plugin',
      operation: 'load',
      pluginPath: '/path/to/plugin',
      config: {
        enabled: true,
        scanInterval: 5000
      }
    },
    metadata: {
      source: 'manual',
      pluginId: 'usb-scanner-plugin',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 5
  });

  console.log(`🔌 Plugin load job added: ${pluginLoadJobId}`);

  // System maintenance
  const maintenanceJobId = await service.jobManager.addJob('system-maintenance', {
    type: 'system.cleanup',
    payload: {
      type: 'temporary-files',
      maxAge: 3600000 // 1 hour
    },
    metadata: {
      source: 'manual',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 1
  });

  console.log(`🧹 Maintenance job added: ${maintenanceJobId}`);

  // Wait a bit for jobs to process
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get metrics
  console.log('\n📊 Current Metrics:');
  const metrics = await service.getMetrics();
  
  for (const [queueName, queueMetrics] of Object.entries(metrics)) {
    console.log(`\n🔍 Queue: ${queueName}`);
    console.log(`  - Waiting: ${queueMetrics.waiting}`);
    console.log(`  - Active: ${queueMetrics.active}`);
    console.log(`  - Completed: ${queueMetrics.completed}`);
    console.log(`  - Failed: ${queueMetrics.failed}`);
    console.log(`  - Completion Rate: ${queueMetrics.completedPerHour}/hour`);
  }

  // Check health status
  console.log('\n🏥 Health Status:');
  const health = await service.getHealthStatus();
  console.log(`  - Overall: ${health.status}`);
  console.log(`  - Redis: ${health.checks.redis ? '✅' : '❌'}`);
  console.log(`  - Memory: ${health.checks.memory ? '✅' : '❌'}`);
  console.log(`  - CPU: ${health.checks.cpu ? '✅' : '❌'}`);
  console.log(`  - Uptime: ${Math.round(health.details.uptime / 1000)}s`);

  // Add bulk jobs
  console.log('\n📦 Adding bulk jobs...');
  const bulkJobs = [];
  for (let i = 0; i < 5; i++) {
    bulkJobs.push({
      data: {
        type: 'plugin.execute' as JobType,
        payload: {
          pluginId: 'bulk-processor',
          operation: 'execute',
          parameters: {
            batchId: i,
            data: `batch-data-${i}`
          }
        },
        metadata: {
          source: 'manual' as const,
          correlationId: `bulk-${i}`,
          timestamp: Date.now(),
          version: '1.0.0'
        },
        priority: 3
      },
      options: {
        attempts: 2,
        backoff: {
          type: 'exponential' as const,
          delay: 1000
        }
      }
    });
  }

  const bulkJobIds = await service.jobManager.addBulkJobs('plugin-jobs', bulkJobs);
  console.log(`📦 Added ${bulkJobIds.length} bulk jobs`);

  // Wait for processing
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Final metrics
  console.log('\n📈 Final Metrics:');
  const finalMetrics = await service.getMetrics();
  
  for (const [queueName, queueMetrics] of Object.entries(finalMetrics)) {
    console.log(`\n🔍 Queue: ${queueName}`);
    console.log(`  - Total Processed: ${queueMetrics.completed + queueMetrics.failed}`);
    console.log(`  - Success Rate: ${queueMetrics.completed / (queueMetrics.completed + queueMetrics.failed) * 100}%`);
  }

  // Graceful shutdown
  console.log('\n🛑 Shutting down gracefully...');
  await service.stop();
  console.log('✅ Service stopped');
}

// Run example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}