// @ts-ignore
import { initializeTracing, shutdownTracing, TracingConfig } from './tracing/tracer';
// @ts-ignore
import { initializeMetrics, shutdownMetrics, MetricsConfig } from './metrics/metrics';
// @ts-ignore
import { initializeLogging, getLogger, LoggingConfig } from './logging/logger';
// @ts-ignore
import { initializeHealthMonitor, shutdownHealthMonitor, HealthMonitor } from './health/health-monitor';
// @ts-ignore
import { initializeSLISLOManager, shutdownSLISLOManager, SLISLOManager } from './sli-slo/sli-slo-manager';
// @ts-ignore
import { initializeTenantIsolation, shutdownTenantIsolation, TenantIsolationManager } from './security/tenant-isolation';
// @ts-ignore
import { initializeTraceCorrelation, shutdownTraceCorrelation, TraceCorrelationManager } from './performance/trace-correlation';
// @ts-ignore
import { initializePerformanceOptimizer, shutdownPerformanceOptimizer, PerformanceOptimizer } from './performance/performance-optimizer';

export interface ObservabilityConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  tenantId?: string;
  
  // OpenTelemetry configuration
  otlpEndpoint?: string;
  samplingRate?: number;
  
  // Grafana stack endpoints
  tempoEndpoint?: string;
  lokiEndpoint?: string;
  prometheusEndpoint?: string;
  
  // Feature flags
  enableTracing?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableHealthMonitoring?: boolean;
  
  // Performance settings
  maxTraceExportBatchSize?: number;
  metricsExportInterval?: number;
  healthCheckInterval?: number;
  
  // Logging settings
  logLevel?: string;
  enableConsoleLogging?: boolean;
  enableFileLogging?: boolean;
  logFilePath?: string;
  
  // Production settings
  enableProductionOptimizations?: boolean;
  maxMemoryUsage?: number;
  alertingWebhook?: string;
}

export class ObservabilityManager {
  private config: ObservabilityConfig;
  private isInitialized = false;
  private healthMonitor?: HealthMonitor;
  private sliSloManager?: SLISLOManager;
  private tenantIsolationManager?: TenantIsolationManager;
  private traceCorrelationManager?: TraceCorrelationManager;
  private performanceOptimizer?: PerformanceOptimizer;
  private logger = getLogger();
  private shutdownHandlers: Array<() => Promise<void>> = [];

  constructor(config: ObservabilityConfig) {
    this.config = {
      enableTracing: true,
      enableMetrics: true,
      enableLogging: true,
      enableHealthMonitoring: true,
      samplingRate: config.environment === 'production' ? 0.1 : 1.0,
      maxTraceExportBatchSize: 512,
      metricsExportInterval: 60000,
      healthCheckInterval: 30000,
      logLevel: config.environment === 'production' ? 'info' : 'debug',
      enableConsoleLogging: true,
      enableFileLogging: config.environment === 'production',
      enableProductionOptimizations: config.environment === 'production',
      maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('Observability already initialized');
      return;
    }

    this.logger.info('Initializing AutoWeave observability system', {
      serviceName: this.config.serviceName,
      serviceVersion: this.config.serviceVersion,
      environment: this.config.environment,
      tenantId: this.config.tenantId,
    });

    try {
      // Initialize logging first
      if (this.config.enableLogging) {
        await this.initializeLogging();
      }

      // Initialize tracing
      if (this.config.enableTracing) {
        await this.initializeTracing();
      }

      // Initialize metrics
      if (this.config.enableMetrics) {
        await this.initializeMetrics();
      }

      // Initialize health monitoring
      if (this.config.enableHealthMonitoring) {
        await this.initializeHealthMonitoring();
      }

      // Initialize SLI/SLO monitoring
      await this.initializeSLISLOMonitoring();

      // Initialize tenant isolation
      await this.initializeTenantIsolation();

      // Initialize trace correlation
      await this.initializeTraceCorrelation();

      // Initialize performance optimization
      await this.initializePerformanceOptimization();

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      // Apply production optimizations
      if (this.config.enableProductionOptimizations) {
        this.applyProductionOptimizations();
      }

      this.isInitialized = true;
      this.logger.info('AutoWeave observability system initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize observability system', error);
      throw error;
    }
  }

  private async initializeLogging(): Promise<void> {
    const loggingConfig: LoggingConfig = {
      level: this.config.logLevel!,
      service: this.config.serviceName,
      environment: this.config.environment,
      lokiEndpoint: this.config.lokiEndpoint,
      enableConsole: this.config.enableConsoleLogging,
      enableFile: this.config.enableFileLogging,
      logFilePath: this.config.logFilePath,
    };

    initializeLogging(loggingConfig);
    this.logger = getLogger();
    this.logger.info('Logging initialized');
  }

  private async initializeTracing(): Promise<void> {
    const tracingConfig: TracingConfig = {
      serviceName: this.config.serviceName,
      serviceVersion: this.config.serviceVersion,
      otlpEndpoint: this.config.otlpEndpoint || this.config.tempoEndpoint,
      environment: this.config.environment,
      tenantId: this.config.tenantId,
      samplingRate: this.config.samplingRate,
      enableCustomInstrumentation: true,
      attributes: {
        'autoweave.tenant_id': this.config.tenantId || 'default',
        'autoweave.version': this.config.serviceVersion,
      },
    };

    const tracer = initializeTracing(tracingConfig);
    this.shutdownHandlers.push(shutdownTracing);
    this.logger.info('Tracing initialized');
  }

  private async initializeMetrics(): Promise<void> {
    const metricsConfig: MetricsConfig = {
      serviceName: this.config.serviceName,
      serviceVersion: this.config.serviceVersion,
      otlpEndpoint: this.config.otlpEndpoint || this.config.prometheusEndpoint,
      environment: this.config.environment,
      exportInterval: this.config.metricsExportInterval,
      tenantId: this.config.tenantId,
    };

    const metrics = initializeMetrics(metricsConfig);
    this.shutdownHandlers.push(shutdownMetrics);
    this.logger.info('Metrics initialized');
  }

  private async initializeHealthMonitoring(): Promise<void> {
    this.healthMonitor = initializeHealthMonitor({
      checkIntervalMs: this.config.healthCheckInterval,
      timeout: 5000,
    });

    this.healthMonitor.start();
    this.shutdownHandlers.push(async () => {
      shutdownHealthMonitor();
    });
    
    this.logger.info('Health monitoring initialized');
  }

  private async initializeSLISLOMonitoring(): Promise<void> {
    this.sliSloManager = initializeSLISLOManager({
      evaluationIntervalMs: 60000, // 1 minute
      retentionPeriodMs: 24 * 60 * 60 * 1000, // 24 hours
      alertCallback: (alert) => {
        this.logger.warn('SLO Alert', alert);
      },
    });

    this.sliSloManager.start();
    this.shutdownHandlers.push(async () => {
      shutdownSLISLOManager();
    });
    
    this.logger.info('SLI/SLO monitoring initialized');
  }

  private async initializeTenantIsolation(): Promise<void> {
    this.tenantIsolationManager = initializeTenantIsolation({
      auditRetentionDays: 90,
      compressionEnabled: true,
      encryptionEnabled: this.config.environment === 'production',
      maxTenantsPerInstance: 1000,
    });

    this.shutdownHandlers.push(async () => {
      shutdownTenantIsolation();
    });
    
    this.logger.info('Tenant isolation initialized');
  }

  private async initializeTraceCorrelation(): Promise<void> {
    this.traceCorrelationManager = initializeTraceCorrelation({
      maxActiveTraces: 10000,
      traceRetentionMs: 60 * 60 * 1000, // 1 hour
      performanceThresholds: {
        slowOperationMs: 1000,
        errorRateThreshold: 0.05,
        throughputThreshold: 10,
      },
    });

    this.shutdownHandlers.push(async () => {
      shutdownTraceCorrelation();
    });
    
    this.logger.info('Trace correlation initialized');
  }

  private async initializePerformanceOptimization(): Promise<void> {
    this.performanceOptimizer = initializePerformanceOptimizer({
      maxProfileRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
      maxSamplesPerProfile: 1000,
      analysisIntervalMs: 5 * 60 * 1000, // 5 minutes
      enableAutoOptimization: false,
      samplingRate: this.config.environment === 'production' ? 0.1 : 1.0,
    });

    this.shutdownHandlers.push(async () => {
      shutdownPerformanceOptimizer();
    });
    
    this.logger.info('Performance optimization initialized');
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));
  }

  private applyProductionOptimizations(): void {
    // Monitor memory usage
    const memoryMonitor = setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      
      if (heapUsedMB > (this.config.maxMemoryUsage! / 1024 / 1024)) {
        this.logger.warn('High memory usage detected', {
          heapUsedMB,
          maxMemoryUsage: this.config.maxMemoryUsage! / 1024 / 1024,
        });
        
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
    }, 30000); // Check every 30 seconds

    // Clean up on shutdown
    this.shutdownHandlers.push(async () => {
      clearInterval(memoryMonitor);
    });

    // Optimize OpenTelemetry for production
    if (this.config.samplingRate! > 0.1) {
      this.logger.warn('High sampling rate in production may impact performance', {
        samplingRate: this.config.samplingRate,
      });
    }
  }

  // Component integration methods
  instrumentUSBDaemon(usbDaemon: any): void {
    if (!this.isInitialized) {
      throw new Error('Observability not initialized');
    }

    // Add event listeners for USB events
    usbDaemon.on('device.attach', (device: any) => {
      this.logger.logUSBEvent('attach', device);
    });

    usbDaemon.on('device.detach', (device: any) => {
      this.logger.logUSBEvent('detach', device);
    });

    this.logger.info('USB daemon instrumented');
  }

  instrumentPluginLoader(pluginLoader: any): void {
    if (!this.isInitialized) {
      throw new Error('Observability not initialized');
    }

    // Add event listeners for plugin events
    pluginLoader.on('plugin.load', (plugin: any) => {
      this.logger.logPluginEvent('load', plugin.name, plugin);
    });

    pluginLoader.on('plugin.unload', (plugin: any) => {
      this.logger.logPluginEvent('unload', plugin.name, plugin);
    });

    pluginLoader.on('plugin.error', (plugin: any, error: any) => {
      this.logger.logPluginEvent('error', plugin.name, { error: error.message });
    });

    this.logger.info('Plugin loader instrumented');
  }

  instrumentQueueManager(queueManager: any): void {
    if (!this.isInitialized) {
      throw new Error('Observability not initialized');
    }

    // Add event listeners for job events
    queueManager.on('job.started', (job: any) => {
      this.logger.logJobEvent('started', job);
    });

    queueManager.on('job.completed', (job: any) => {
      this.logger.logJobEvent('completed', job);
    });

    queueManager.on('job.failed', (job: any) => {
      this.logger.logJobEvent('failed', job);
    });

    this.logger.info('Queue manager instrumented');
  }

  // Express.js middleware for HTTP instrumentation
  createHTTPMiddleware() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      
      // Create comprehensive middleware stack
      const tenantMiddleware = this.tenantIsolationManager?.createTenantIsolationMiddleware();
      const correlationMiddleware = this.traceCorrelationManager?.createCorrelationMiddleware();
      
      // Apply tenant isolation middleware
      if (tenantMiddleware) {
        tenantMiddleware(req, res, (err?: any) => {
          if (err) return next(err);
          
          // Apply correlation middleware
          if (correlationMiddleware) {
            correlationMiddleware(req, res, (err?: any) => {
              if (err) return next(err);
              proceedWithInstrumentation();
            });
          } else {
            proceedWithInstrumentation();
          }
        });
      } else {
        proceedWithInstrumentation();
      }
      
      function proceedWithInstrumentation() {
        const tenantId = req.tenantContext?.tenantId || 'default';
        
        res.on('finish', () => {
          const duration = Date.now() - startTime;
          
          // Log HTTP request
          this.logger.logHTTPRequest(req, res, duration, tenantId);
          
          // Record performance sample
          if (this.performanceOptimizer) {
            this.performanceOptimizer.recordSample('http', req.path, {
              timestamp: new Date(),
              duration,
              cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
              memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // Convert to MB
              status: res.statusCode >= 400 ? 'error' : 'success',
              tenantId,
              metadata: {
                method: req.method,
                statusCode: res.statusCode,
                userAgent: req.get('User-Agent'),
              },
            });
          }
        });

        next();
      }
    };
  }

  // Health check endpoint
  async getHealthStatus(): Promise<any> {
    if (!this.healthMonitor) {
      throw new Error('Health monitoring not initialized');
    }

    return await this.healthMonitor.getHealthStatus();
  }

  // Metrics endpoint
  getMetrics(): any {
    // This would return Prometheus-formatted metrics
    // For now, return basic status
    return {
      status: 'active',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      config: {
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        tenantId: this.config.tenantId,
      },
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    this.logger.info('Shutting down observability system...');

    // Execute all shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error('Error during shutdown handler execution', error);
      }
    }

    this.isInitialized = false;
    this.logger.info('Observability system shutdown complete');
  }

  // Tenant isolation utilities
  createTenantContext(tenantId: string): any {
    return {
      tenantId,
      logger: {
        info: (message: string, meta?: any) => this.logger.info(message, { ...meta, tenant_id: tenantId }),
        error: (message: string, error?: Error, meta?: any) => this.logger.error(message, error, { ...meta, tenant_id: tenantId }),
        warn: (message: string, meta?: any) => this.logger.warn(message, { ...meta, tenant_id: tenantId }),
        debug: (message: string, meta?: any) => this.logger.debug(message, { ...meta, tenant_id: tenantId }),
      },
    };
  }

  // Configuration validation
  validateConfig(): boolean {
    const requiredFields = ['serviceName', 'serviceVersion', 'environment'];
    
    for (const field of requiredFields) {
      if (!this.config[field as keyof ObservabilityConfig]) {
        this.logger.error(`Missing required observability config field: ${field}`);
        return false;
      }
    }

    return true;
  }
}

// Factory function for easy initialization
export function createObservabilityManager(config: ObservabilityConfig): ObservabilityManager {
  const manager = new ObservabilityManager(config);
  
  if (!manager.validateConfig()) {
    throw new Error('Invalid observability configuration');
  }

  return manager;
}

// Singleton instance
let globalObservabilityManager: ObservabilityManager | undefined;

export function initializeObservability(config: ObservabilityConfig): ObservabilityManager {
  if (globalObservabilityManager) {
    console.warn('Observability already initialized');
    return globalObservabilityManager;
  }

  globalObservabilityManager = createObservabilityManager(config);
  return globalObservabilityManager;
}

export function getObservabilityManager(): ObservabilityManager | undefined {
  return globalObservabilityManager;
}

export async function shutdownObservability(): Promise<void> {
  if (globalObservabilityManager) {
    await globalObservabilityManager.shutdown();
    globalObservabilityManager = undefined;
  }
}