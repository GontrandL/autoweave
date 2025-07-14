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

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  otlpEndpoint?: string;
  environment?: string;
  attributes?: Record<string, string>;
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

    this.sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Can be noisy
        },
      })],
    });

    this.sdk.start();
    console.log(`OpenTelemetry tracing initialized for ${this.config.serviceName}`);
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