// @ts-ignore
import { metrics } from '@opentelemetry/api';
// @ts-ignore
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
// @ts-ignore
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-http';
// @ts-ignore
import { Resource } from '@opentelemetry/resources';
// @ts-ignore
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export interface MetricsConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint?: string;
  environment?: string;
  exportInterval?: number;
  tenantId?: string;
}

export class AutoWeaveMetrics {
  private meter = metrics.getMeter('autoweave');
  private config?: MetricsConfig;
  private meterProvider?: MeterProvider;

  constructor(config?: MetricsConfig) {
    this.config = config;
    if (config) {
      this.initializeMetrics();
    }
  }

  private initializeMetrics(): void {
    if (!this.config) return;

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment || 'development',
    });

    const metricReader = this.config.otlpEndpoint
      ? new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({
            url: `${this.config.otlpEndpoint}/v1/metrics`,
          }),
          exportIntervalMillis: this.config.exportInterval || 60000,
        })
      : undefined;

    this.meterProvider = new MeterProvider({
      resource,
      readers: metricReader ? [metricReader] : [],
    });

    metrics.setGlobalMeterProvider(this.meterProvider);
    this.meter = this.meterProvider.getMeter('autoweave');
  }

  // USB-related metrics
  public readonly usbEventsCounter = this.meter.createCounter('usb_events_total', {
    description: 'Total number of USB events processed',
  });

  public readonly connectedDevicesGauge = this.meter.createUpDownCounter('usb_devices_connected', {
    description: 'Number of currently connected USB devices',
  });

  public readonly eventProcessingDuration = this.meter.createHistogram('usb_event_processing_duration_ms', {
    description: 'Time taken to process USB events',
  });

  // Plugin-related metrics
  public readonly pluginLoadCounter = this.meter.createCounter('plugins_loaded_total', {
    description: 'Total number of plugins loaded',
  });

  public readonly pluginLoadDuration = this.meter.createHistogram('plugin_load_duration_ms', {
    description: 'Time taken to load plugins',
  });

  public readonly activePluginsGauge = this.meter.createUpDownCounter('plugins_active', {
    description: 'Number of currently active plugins',
  });

  // Queue-related metrics
  public readonly jobsProcessedCounter = this.meter.createCounter('jobs_processed_total', {
    description: 'Total number of jobs processed',
  });

  public readonly jobProcessingDuration = this.meter.createHistogram('job_processing_duration_ms', {
    description: 'Time taken to process jobs',
  });

  public readonly queueSizeGauge = this.meter.createUpDownCounter('queue_size', {
    description: 'Current size of job queues',
  });

  // General system metrics
  public readonly requestCounter = this.meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  });

  public readonly requestDuration = this.meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration',
  });

  public readonly errorCounter = this.meter.createCounter('errors_total', {
    description: 'Total number of errors',
  });

  // Business metrics
  public readonly businessOperationsCounter = this.meter.createCounter('business_operations_total', {
    description: 'Total number of business operations performed',
  });

  public readonly tenantOperationsCounter = this.meter.createCounter('tenant_operations_total', {
    description: 'Operations performed by tenant',
  });

  public readonly pluginExecutionsCounter = this.meter.createCounter('plugin_executions_total', {
    description: 'Total plugin executions by tenant and plugin',
  });

  public readonly automationTasksCounter = this.meter.createCounter('automation_tasks_total', {
    description: 'Automation tasks executed',
  });

  // Performance metrics with tenant isolation
  public readonly componentInitDuration = this.meter.createHistogram('component_init_duration_ms', {
    description: 'Time taken to initialize components',
  });

  public readonly memoryUsageGauge = this.meter.createUpDownCounter('memory_usage_bytes', {
    description: 'Current memory usage by component',
  });

  public readonly cpuUsageGauge = this.meter.createUpDownCounter('cpu_usage_percent', {
    description: 'Current CPU usage by component',
  });

  public readonly diskUsageGauge = this.meter.createUpDownCounter('disk_usage_bytes', {
    description: 'Current disk usage by component',
  });

  // SLI/SLO metrics
  public readonly availabilityGauge = this.meter.createUpDownCounter('component_availability', {
    description: 'Component availability (1 = up, 0 = down)',
  });

  public readonly sloViolationsCounter = this.meter.createCounter('slo_violations_total', {
    description: 'Total SLO violations by component and SLO type',
  });

  // Cache and performance optimization metrics
  public readonly cacheHitRateGauge = this.meter.createUpDownCounter('cache_hit_rate', {
    description: 'Cache hit rate by cache type',
  });

  public readonly cacheSizeGauge = this.meter.createUpDownCounter('cache_size_entries', {
    description: 'Current cache size in entries',
  });

  public readonly gcDuration = this.meter.createHistogram('gc_duration_ms', {
    description: 'Garbage collection duration',
  });

  public readonly eventLoopLag = this.meter.createHistogram('event_loop_lag_ms', {
    description: 'Event loop lag in milliseconds',
  });

  // Helper methods for common metrics operations
  recordUSBEvent(action: 'attach' | 'detach', vendorId: string, productId: string, tenantId?: string): void {
    this.usbEventsCounter.add(1, {
      action,
      vendor_id: vendorId,
      product_id: productId,
      tenant_id: tenantId || 'default',
    });
  }

  recordPluginLoad(pluginName: string, duration: number, success: boolean, tenantId?: string): void {
    this.pluginLoadCounter.add(1, {
      plugin_name: pluginName,
      success: success.toString(),
      tenant_id: tenantId || 'default',
    });
    
    if (success) {
      this.pluginLoadDuration.record(duration, {
        plugin_name: pluginName,
        tenant_id: tenantId || 'default',
      });
      this.activePluginsGauge.add(1, { 
        plugin_name: pluginName,
        tenant_id: tenantId || 'default',
      });
    }
  }

  recordPluginUnload(pluginName: string, tenantId?: string): void {
    this.activePluginsGauge.add(-1, { 
      plugin_name: pluginName,
      tenant_id: tenantId || 'default',
    });
  }

  recordJobProcessed(queueName: string, jobType: string, duration: number, success: boolean, tenantId?: string): void {
    this.jobsProcessedCounter.add(1, {
      queue_name: queueName,
      job_type: jobType,
      success: success.toString(),
      tenant_id: tenantId || 'default',
    });

    this.jobProcessingDuration.record(duration, {
      queue_name: queueName,
      job_type: jobType,
      tenant_id: tenantId || 'default',
    });
  }

  updateQueueSize(queueName: string, size: number, tenantId?: string): void {
    this.queueSizeGauge.add(size, { 
      queue_name: queueName,
      tenant_id: tenantId || 'default',
    });
  }

  recordHTTPRequest(method: string, route: string, statusCode: number, duration: number, tenantId?: string): void {
    this.requestCounter.add(1, {
      method,
      route,
      status_code: statusCode.toString(),
      tenant_id: tenantId || 'default',
    });

    this.requestDuration.record(duration, {
      method,
      route,
      status_code: statusCode.toString(),
      tenant_id: tenantId || 'default',
    });
  }

  recordError(component: string, errorType: string, severity: 'low' | 'medium' | 'high' = 'medium', tenantId?: string): void {
    this.errorCounter.add(1, {
      component,
      error_type: errorType,
      severity,
      tenant_id: tenantId || 'default',
    });
  }

  // Business metrics recording
  recordBusinessOperation(operation: string, tenantId: string, metadata?: Record<string, any>): void {
    this.businessOperationsCounter.add(1, {
      operation,
      tenant_id: tenantId,
      ...metadata,
    });

    this.tenantOperationsCounter.add(1, {
      tenant_id: tenantId,
      operation_type: operation,
    });
  }

  recordPluginExecution(pluginName: string, tenantId: string, duration: number, success: boolean): void {
    this.pluginExecutionsCounter.add(1, {
      plugin_name: pluginName,
      tenant_id: tenantId,
      success: success.toString(),
    });
  }

  recordAutomationTask(taskType: string, tenantId: string, success: boolean): void {
    this.automationTasksCounter.add(1, {
      task_type: taskType,
      tenant_id: tenantId,
      success: success.toString(),
    });
  }

  // Performance monitoring
  recordComponentInit(component: string, duration: number): void {
    this.componentInitDuration.record(duration, {
      component,
    });
  }

  updateResourceUsage(component: string, memory: number, cpu: number, disk: number): void {
    this.memoryUsageGauge.add(memory, { component });
    this.cpuUsageGauge.add(cpu, { component });
    this.diskUsageGauge.add(disk, { component });
  }

  // SLI/SLO monitoring
  recordAvailability(component: string, isAvailable: boolean): void {
    this.availabilityGauge.add(isAvailable ? 1 : 0, { component });
  }

  recordSLOViolation(component: string, sloType: string, severity: string): void {
    this.sloViolationsCounter.add(1, {
      component,
      slo_type: sloType,
      severity,
    });
  }

  // Cache monitoring
  updateCacheMetrics(cacheType: string, hitRate: number, size: number): void {
    this.cacheHitRateGauge.add(hitRate, { cache_type: cacheType });
    this.cacheSizeGauge.add(size, { cache_type: cacheType });
  }

  // Performance profiling
  recordGCDuration(duration: number, gcType: string): void {
    this.gcDuration.record(duration, { gc_type: gcType });
  }

  recordEventLoopLag(lag: number): void {
    this.eventLoopLag.record(lag);
  }

  async shutdown(): Promise<void> {
    if (this.meterProvider) {
      await this.meterProvider.shutdown();
    }
  }
}

// Singleton instance
let globalMetrics: AutoWeaveMetrics | undefined;

export function initializeMetrics(config?: MetricsConfig): AutoWeaveMetrics {
  if (globalMetrics) {
    console.warn('Metrics already initialized');
    return globalMetrics;
  }

  globalMetrics = new AutoWeaveMetrics(config);
  return globalMetrics;
}

export function getMetrics(): AutoWeaveMetrics {
  if (!globalMetrics) {
    globalMetrics = new AutoWeaveMetrics();
  }
  return globalMetrics;
}

export async function shutdownMetrics(): Promise<void> {
  if (globalMetrics) {
    await globalMetrics.shutdown();
    globalMetrics = undefined;
  }
}