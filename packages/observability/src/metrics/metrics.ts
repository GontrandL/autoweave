// @ts-ignore
import { metrics } from '@opentelemetry/api';

export class AutoWeaveMetrics {
  private meter = metrics.getMeter('autoweave');

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

  // Helper methods for common metrics operations
  recordUSBEvent(action: 'attach' | 'detach', vendorId: string, productId: string): void {
    this.usbEventsCounter.add(1, {
      action,
      vendor_id: vendorId,
      product_id: productId
    });
  }

  recordPluginLoad(pluginName: string, duration: number, success: boolean): void {
    this.pluginLoadCounter.add(1, {
      plugin_name: pluginName,
      success: success.toString()
    });
    
    if (success) {
      this.pluginLoadDuration.record(duration, {
        plugin_name: pluginName
      });
      this.activePluginsGauge.add(1, { plugin_name: pluginName });
    }
  }

  recordPluginUnload(pluginName: string): void {
    this.activePluginsGauge.add(-1, { plugin_name: pluginName });
  }

  recordJobProcessed(queueName: string, jobType: string, duration: number, success: boolean): void {
    this.jobsProcessedCounter.add(1, {
      queue_name: queueName,
      job_type: jobType,
      success: success.toString()
    });

    this.jobProcessingDuration.record(duration, {
      queue_name: queueName,
      job_type: jobType
    });
  }

  updateQueueSize(queueName: string, size: number): void {
    this.queueSizeGauge.add(size, { queue_name: queueName });
  }

  recordHTTPRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.requestCounter.add(1, {
      method,
      route,
      status_code: statusCode.toString()
    });

    this.requestDuration.record(duration, {
      method,
      route,
      status_code: statusCode.toString()
    });
  }

  recordError(component: string, errorType: string, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    this.errorCounter.add(1, {
      component,
      error_type: errorType,
      severity
    });
  }
}

// Singleton instance
let globalMetrics: AutoWeaveMetrics | undefined;

export function getMetrics(): AutoWeaveMetrics {
  if (!globalMetrics) {
    globalMetrics = new AutoWeaveMetrics();
  }
  return globalMetrics;
}