// @ts-ignore
import { NodeSDK } from '@opentelemetry/sdk-node';
// @ts-ignore
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// @ts-ignore
import { Resource } from '@opentelemetry/resources';
// @ts-ignore
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// @ts-ignore
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
// @ts-ignore
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
// @ts-ignore
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint?: string;
  environment?: string;
  attributes?: Record<string, string>;
  tenantId?: string;
  samplingRate?: number;
  enableCustomInstrumentation?: boolean;
}

export interface USBEventSpanOptions {
  action: 'attach' | 'detach' | 'scan';
  vendorId?: string;
  productId?: string;
  devicePath?: string;
  tenantId?: string;
}

export interface PluginSpanOptions {
  operation: 'load' | 'unload' | 'execute' | 'validate';
  pluginName: string;
  pluginVersion?: string;
  tenantId?: string;
  capabilities?: string[];
}

export interface JobQueueSpanOptions {
  operation: 'enqueue' | 'dequeue' | 'process' | 'complete' | 'fail';
  queueName: string;
  jobType: string;
  jobId: string;
  tenantId?: string;
  priority?: number;
}

export class AutoWeaveTracer {
  private sdk?: NodeSDK;
  private config: TracingConfig;

  constructor(config: TracingConfig) {
    this.config = config;
  }

  initialize(): void {
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: this.config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: this.config.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.config.environment || 'development',
      ...this.config.attributes
    });

    const traceExporter = this.config.otlpEndpoint 
      ? new OTLPTraceExporter({
          url: `${this.config.otlpEndpoint}/v1/traces`,
        })
      : undefined;

    const spanProcessor = traceExporter 
      ? new BatchSpanProcessor(traceExporter, {
          maxExportBatchSize: 512,
          maxQueueSize: 2048,
          exportTimeoutMillis: 30000,
          scheduledDelayMillis: 5000,
        })
      : undefined;

    this.sdk = new NodeSDK({
      resource,
      spanProcessor,
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
          requestHook: (span, requestInfo) => {
            span.setAttributes({
              'redis.tenant_id': this.config.tenantId || 'default',
              'redis.component': 'autoweave',
            });
          },
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          requestHook: (span, request) => {
            span.setAttributes({
              'http.tenant_id': this.config.tenantId || 'default',
              'http.component': 'autoweave',
            });
          },
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
          requestHook: (span, info) => {
            span.setAttributes({
              'express.tenant_id': this.config.tenantId || 'default',
              'express.component': 'autoweave',
            });
          },
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Can be noisy
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false, // Too noisy for production
        },
      })],
      sampler: this.createSampler(),
    });

    this.sdk.start();
    console.log(`OpenTelemetry tracing initialized for ${this.config.serviceName}`);
  }

  private createSampler() {
    const samplingRate = this.config.samplingRate || 1.0;
    // For production, use lower sampling rates to reduce overhead
    if (this.config.environment === 'production' && samplingRate > 0.1) {
      console.warn('High sampling rate in production may impact performance');
    }
    
    return {
      shouldSample: () => {
        return {
          decision: Math.random() < samplingRate ? 1 : 0, // SamplingDecision.RECORD_AND_SAMPLE : SamplingDecision.NOT_RECORD
        };
      },
    };
  }

  // Custom span creation methods for AutoWeave components
  createUSBEventSpan(options: USBEventSpanOptions): any {
    const tracer = trace.getTracer('autoweave-usb');
    return tracer.startSpan(`usb.${options.action}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'usb.action': options.action,
        'usb.vendor_id': options.vendorId || 'unknown',
        'usb.product_id': options.productId || 'unknown',
        'usb.device_path': options.devicePath || 'unknown',
        'autoweave.tenant_id': options.tenantId || 'default',
        'autoweave.component': 'usb-daemon',
        'autoweave.operation_type': 'device_event',
      },
    });
  }

  createPluginSpan(options: PluginSpanOptions): any {
    const tracer = trace.getTracer('autoweave-plugin');
    return tracer.startSpan(`plugin.${options.operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'plugin.operation': options.operation,
        'plugin.name': options.pluginName,
        'plugin.version': options.pluginVersion || 'unknown',
        'plugin.capabilities': options.capabilities?.join(',') || '',
        'autoweave.tenant_id': options.tenantId || 'default',
        'autoweave.component': 'plugin-loader',
        'autoweave.operation_type': 'plugin_lifecycle',
      },
    });
  }

  createJobQueueSpan(options: JobQueueSpanOptions): any {
    const tracer = trace.getTracer('autoweave-queue');
    return tracer.startSpan(`queue.${options.operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'queue.operation': options.operation,
        'queue.name': options.queueName,
        'job.type': options.jobType,
        'job.id': options.jobId,
        'job.priority': options.priority || 0,
        'autoweave.tenant_id': options.tenantId || 'default',
        'autoweave.component': 'queue-manager',
        'autoweave.operation_type': 'job_processing',
      },
    });
  }

  // GraphQL resolver instrumentation
  createGraphQLSpan(resolverName: string, fieldName: string, args?: any): any {
    const tracer = trace.getTracer('autoweave-graphql');
    return tracer.startSpan(`graphql.${resolverName}.${fieldName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'graphql.resolver': resolverName,
        'graphql.field': fieldName,
        'graphql.args': JSON.stringify(args || {}),
        'autoweave.component': 'graphql',
        'autoweave.operation_type': 'query_resolution',
      },
    });
  }

  // Utility methods for span management
  withSpan<T>(span: any, fn: () => Promise<T>): Promise<T> {
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    });
  }

  // Business metrics tracing
  createBusinessMetricSpan(metricName: string, value: number, metadata?: Record<string, any>): any {
    const tracer = trace.getTracer('autoweave-business');
    return tracer.startSpan(`business.${metricName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'business.metric_name': metricName,
        'business.metric_value': value,
        'business.metadata': JSON.stringify(metadata || {}),
        'autoweave.component': 'business-metrics',
        'autoweave.operation_type': 'metric_collection',
      },
    });
  }

  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('OpenTelemetry SDK shutdown complete');
    }
  }
}

// Singleton instance for easy access
let globalTracer: AutoWeaveTracer | undefined;

export function initializeTracing(config: TracingConfig): AutoWeaveTracer {
  if (globalTracer) {
    console.warn('Tracing already initialized');
    return globalTracer;
  }

  globalTracer = new AutoWeaveTracer(config);
  globalTracer.initialize();
  return globalTracer;
}

export function getGlobalTracer(): AutoWeaveTracer | undefined {
  return globalTracer;
}

export async function shutdownTracing(): Promise<void> {
  if (globalTracer) {
    await globalTracer.shutdown();
    globalTracer = undefined;
  }
}