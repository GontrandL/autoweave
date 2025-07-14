import { createProductionJobQueueService, JobScheduler } from '../src';

/**
 * Example showing how to integrate the job queue system with existing AutoWeave Sprint 1 components
 */
async function autoweaveIntegrationExample() {
  console.log('🚀 Starting AutoWeave Job Queue Integration Example...');

  // Create production-ready job queue service
  const service = await createProductionJobQueueService({
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    usbBridge: {
      enabled: true,
      streamName: 'aw:hotplug', // This connects to the existing USB daemon
      consumerGroup: 'autoweave-job-queue',
      consumerName: `worker-${process.env.HOSTNAME || 'main'}`,
      batchSize: 10,
      maxRetries: 3,
      processingTimeout: 30000,
      pluginFiltering: {
        enabled: true,
        allowedPlugins: [
          '1234:5678', // Example USB device IDs
          '9abc:def0'
        ],
        requirePermission: true
      }
    },
    monitoring: {
      enabled: true,
      metricsInterval: 30000,
      retentionDays: 7,
      alerting: {
        enabled: true,
        thresholds: {
          queueBacklog: 100,
          failureRate: 0.05,
          processingTime: 30000,
          memoryUsage: 500
        }
      }
    },
    security: {
      defaultSandbox: {
        sandboxEnabled: true,
        timeoutMs: 60000,
        memoryLimitMB: 256,
        allowedModules: ['fs', 'path', 'util', 'crypto'],
        blockedModules: ['child_process', 'cluster', 'worker_threads']
      },
      trustedPlugins: [], // Add trusted plugin IDs here
      resourceLimits: {
        maxMemoryMB: 512,
        maxCpuPercent: 80,
        maxExecutionTimeMs: 120000
      }
    }
  });

  // Start the service
  await service.start();
  console.log('✅ AutoWeave Job Queue service started');

  // Setup job scheduler for system maintenance
  const scheduler = new JobScheduler(service.jobManager);
  
  // Schedule system maintenance jobs
  scheduler.scheduleSystemMaintenance();
  
  // Schedule custom jobs
  await scheduler.scheduleJob(
    'plugin-health-check',
    'Plugin Health Check',
    '*/15 * * * *', // Every 15 minutes
    'plugin-jobs',
    {
      type: 'plugin.validate',
      payload: {
        pluginId: 'all',
        operation: 'validate',
        comprehensive: false
      },
      metadata: {
        source: 'scheduled',
        timestamp: Date.now(),
        version: '1.0.0'
      }
    }
  );

  scheduler.start();
  console.log('📅 Job scheduler started');

  // Setup comprehensive event handling
  setupEventHandlers(service.jobManager);

  // Setup USB bridge event handling
  if (service.usbBridge) {
    service.usbBridge.on('event:processed', ({ messageId, jobId, action, deviceSignature }) => {
      console.log(`📱 USB event processed: ${action} device ${deviceSignature} -> Job ${jobId}`);
    });

    service.usbBridge.on('event:error', ({ messageId, error }) => {
      console.error(`❌ USB event processing error: ${messageId}`, error);
    });
  }

  // Simulate AutoWeave Sprint 1 integration scenarios
  console.log('\n🔄 Simulating AutoWeave integration scenarios...');

  // 1. USB device attachment triggers plugin loading
  await simulateUSBPluginFlow(service);

  // 2. Plugin execution with memory operations
  await simulatePluginMemoryFlow(service);

  // 3. System maintenance and cleanup
  await simulateSystemMaintenanceFlow(service);

  // 4. LLM batch processing
  await simulateLLMBatchFlow(service);

  // Monitor for a while
  console.log('\n📊 Monitoring system for 30 seconds...');
  await monitorSystem(service, 30000);

  // Performance report
  await generatePerformanceReport(service);

  // Graceful shutdown
  console.log('\n🛑 Shutting down gracefully...');
  scheduler.stop();
  await service.stop();
  console.log('✅ AutoWeave Job Queue service stopped');
}

function setupEventHandlers(jobManager: any) {
  // Job lifecycle events
  jobManager.on('job:completed', ({ queueName, jobId, result }) => {
    console.log(`✅ [${queueName}] Job ${jobId} completed`);
  });

  jobManager.on('job:failed', ({ queueName, jobId, error }) => {
    console.error(`❌ [${queueName}] Job ${jobId} failed:`, error);
  });

  jobManager.on('job:stalled', ({ queueName, jobId }) => {
    console.warn(`⏱️ [${queueName}] Job ${jobId} stalled`);
  });

  // Worker events
  jobManager.on('workers:scaled', ({ queueName, newSize, previousSize }) => {
    console.log(`🔄 [${queueName}] Workers scaled: ${previousSize} -> ${newSize}`);
  });

  jobManager.on('worker:error', ({ queueName, workerId, error }) => {
    console.error(`⚠️ [${queueName}] Worker ${workerId} error:`, error);
  });

  // System events
  jobManager.on('health:alert', ({ level, message, details }) => {
    console.warn(`🚨 Health Alert [${level}]: ${message}`, details);
  });

  jobManager.on('redis:error', (error) => {
    console.error('🔴 Redis Error:', error);
  });
}

async function simulateUSBPluginFlow(service: any) {
  console.log('\n📱 Simulating USB device -> Plugin flow...');

  // Simulate USB device attachment (this would normally come from the USB daemon)
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
        signature: 'scanner-device-signature'
      },
      timestamp: Date.now()
    },
    metadata: {
      source: 'usb-daemon',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 10
  });

  // This would trigger plugin loading
  const pluginLoadJobId = await service.jobManager.addJob('plugin-jobs', {
    type: 'plugin.load',
    payload: {
      pluginId: 'usb-scanner-plugin',
      operation: 'load',
      pluginPath: '/plugins/usb-scanner',
      config: {
        deviceSignature: 'scanner-device-signature',
        scanInterval: 5000
      }
    },
    metadata: {
      source: 'usb-daemon',
      pluginId: 'usb-scanner-plugin',
      correlationId: usbJobId,
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 8
  });

  console.log(`📱 USB attachment job: ${usbJobId}`);
  console.log(`🔌 Plugin load job: ${pluginLoadJobId}`);
}

async function simulatePluginMemoryFlow(service: any) {
  console.log('\n🧠 Simulating Plugin -> Memory flow...');

  // Plugin execution that generates data for memory storage
  const pluginExecJobId = await service.jobManager.addJob('plugin-jobs', {
    type: 'plugin.execute',
    payload: {
      pluginId: 'data-processor-plugin',
      operation: 'execute',
      parameters: {
        inputData: 'sensor-readings-batch-1',
        processingMode: 'real-time'
      }
    },
    metadata: {
      source: 'manual',
      pluginId: 'data-processor-plugin',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 7
  });

  // Memory vectorization job
  const memoryJobId = await service.jobManager.addJob('system-maintenance', {
    type: 'memory.vectorize',
    payload: {
      data: 'processed-sensor-data',
      vectorType: 'embeddings',
      dimensions: 384
    },
    metadata: {
      source: 'plugin-loader',
      correlationId: pluginExecJobId,
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 5
  });

  console.log(`🔌 Plugin execution job: ${pluginExecJobId}`);
  console.log(`🧠 Memory vectorization job: ${memoryJobId}`);
}

async function simulateSystemMaintenanceFlow(service: any) {
  console.log('\n🧹 Simulating System Maintenance flow...');

  // System cleanup job
  const cleanupJobId = await service.jobManager.addJob('system-maintenance', {
    type: 'system.cleanup',
    payload: {
      type: 'comprehensive',
      targets: ['temp-files', 'old-logs', 'unused-embeddings'],
      maxAge: 7200000 // 2 hours
    },
    metadata: {
      source: 'scheduled',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 2
  });

  // Health check job
  const healthCheckJobId = await service.jobManager.addJob('system-maintenance', {
    type: 'system.health.check',
    payload: {
      comprehensive: true,
      includePlugins: true,
      includeMemory: true
    },
    metadata: {
      source: 'scheduled',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 3
  });

  console.log(`🧹 System cleanup job: ${cleanupJobId}`);
  console.log(`🏥 Health check job: ${healthCheckJobId}`);
}

async function simulateLLMBatchFlow(service: any) {
  console.log('\n🤖 Simulating LLM Batch Processing flow...');

  // LLM batch processing job
  const llmBatchJobId = await service.jobManager.addJob('llm-batch', {
    type: 'llm.batch.process',
    payload: {
      requests: [
        { prompt: 'Analyze sensor data patterns', type: 'analysis' },
        { prompt: 'Generate device recommendations', type: 'generation' },
        { prompt: 'Classify device types', type: 'classification' }
      ],
      model: 'gpt-4',
      batchSize: 3
    },
    metadata: {
      source: 'manual',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 4
  });

  // Embeddings generation job
  const embeddingsJobId = await service.jobManager.addJob('llm-batch', {
    type: 'llm.embeddings.generate',
    payload: {
      texts: ['USB device data', 'Plugin configuration', 'System logs'],
      model: 'text-embedding-ada-002'
    },
    metadata: {
      source: 'manual',
      timestamp: Date.now(),
      version: '1.0.0'
    },
    priority: 6
  });

  console.log(`🤖 LLM batch job: ${llmBatchJobId}`);
  console.log(`📊 Embeddings job: ${embeddingsJobId}`);
}

async function monitorSystem(service: any, duration: number) {
  const startTime = Date.now();
  const interval = setInterval(async () => {
    const metrics = await service.getMetrics();
    const health = await service.getHealthStatus();
    
    console.log(`📊 System Status: ${health.status} | Total Jobs: ${health.details.totalJobs}`);
    
    for (const [queueName, queueMetrics] of Object.entries(metrics)) {
      if (queueMetrics.active > 0 || queueMetrics.waiting > 0) {
        console.log(`  - ${queueName}: ${queueMetrics.active} active, ${queueMetrics.waiting} waiting`);
      }
    }
  }, 5000);

  await new Promise(resolve => setTimeout(resolve, duration));
  clearInterval(interval);
}

async function generatePerformanceReport(service: any) {
  console.log('\n📈 Performance Report:');
  
  const metrics = await service.getMetrics();
  const health = await service.getHealthStatus();
  
  console.log(`\n🏥 Overall Health: ${health.status}`);
  console.log(`⏱️ Uptime: ${Math.round(health.details.uptime / 1000)}s`);
  console.log(`📊 Total Jobs Processed: ${health.details.totalJobs}`);
  
  console.log('\n📋 Queue Statistics:');
  let totalCompleted = 0;
  let totalFailed = 0;
  
  for (const [queueName, queueMetrics] of Object.entries(metrics)) {
    const total = queueMetrics.completed + queueMetrics.failed;
    const successRate = total > 0 ? (queueMetrics.completed / total * 100).toFixed(1) : '0.0';
    
    console.log(`  - ${queueName}:`);
    console.log(`    Completed: ${queueMetrics.completed}`);
    console.log(`    Failed: ${queueMetrics.failed}`);
    console.log(`    Success Rate: ${successRate}%`);
    console.log(`    Avg Processing Time: ${queueMetrics.avgProcessingTime}ms`);
    
    totalCompleted += queueMetrics.completed;
    totalFailed += queueMetrics.failed;
  }
  
  const overallSuccessRate = (totalCompleted + totalFailed) > 0 
    ? (totalCompleted / (totalCompleted + totalFailed) * 100).toFixed(1)
    : '0.0';
  
  console.log(`\n🎯 Overall Success Rate: ${overallSuccessRate}%`);
  console.log(`✅ Total Completed: ${totalCompleted}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
}

// Run the integration example
if (require.main === module) {
  autoweaveIntegrationExample().catch(console.error);
}

export { autoweaveIntegrationExample };