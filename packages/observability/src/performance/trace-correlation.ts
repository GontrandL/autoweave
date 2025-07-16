// @ts-ignore
import { trace, context, SpanKind, SpanStatusCode } from '@opentelemetry/api';
// @ts-ignore
import { getLogger } from '../logging/logger';
// @ts-ignore
import { getMetrics } from '../metrics/metrics';

export interface TraceCorrelationContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  tenantId: string;
  requestId: string;
  operationName: string;
  startTime: number;
  metadata?: Record<string, any>;
}

export interface CrossComponentTrace {
  traceId: string;
  tenantId: string;
  operationName: string;
  totalDuration: number;
  components: ComponentTrace[];
  startTime: Date;
  endTime: Date;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
}

export interface ComponentTrace {
  component: string;
  operation: string;
  spanId: string;
  parentSpanId?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'success' | 'error' | 'timeout';
  attributes: Record<string, any>;
  events: TraceEvent[];
  errorMessage?: string;
}

export interface TraceEvent {
  timestamp: Date;
  name: string;
  attributes: Record<string, any>;
}

export interface PerformanceMetrics {
  component: string;
  operation: string;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
  timestamp: Date;
}

export interface PerformanceOptimizationHint {
  component: string;
  operation: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  impact: string;
  implementation: string;
}

export class TraceCorrelationManager {
  private activeTraces: Map<string, CrossComponentTrace> = new Map();
  private componentTraces: Map<string, ComponentTrace[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics[]> = new Map();
  private optimizationHints: PerformanceOptimizationHint[] = [];
  private logger = getLogger();
  private metrics = getMetrics();

  constructor(private config: {
    maxActiveTraces?: number;
    traceRetentionMs?: number;
    performanceThresholds?: {
      slowOperationMs: number;
      errorRateThreshold: number;
      throughputThreshold: number;
    };
  } = {}) {
    this.config = {
      maxActiveTraces: 10000,
      traceRetentionMs: 60 * 60 * 1000, // 1 hour
      performanceThresholds: {
        slowOperationMs: 1000,
        errorRateThreshold: 0.05, // 5%
        throughputThreshold: 10, // ops/sec
      },
      ...config,
    };

    // Start periodic cleanup
    setInterval(() => this.cleanupOldTraces(), 60000); // Every minute
    setInterval(() => this.analyzePerformance(), 300000); // Every 5 minutes
  }

  // Start a new cross-component trace
  startCrossComponentTrace(
    operationName: string,
    tenantId: string,
    requestId: string,
    metadata?: Record<string, any>
  ): string {
    const tracer = trace.getTracer('autoweave-correlation');
    const span = tracer.startSpan(operationName, {
      kind: SpanKind.SERVER,
      attributes: {
        'autoweave.tenant_id': tenantId,
        'autoweave.request_id': requestId,
        'autoweave.operation_name': operationName,
        'autoweave.component': 'trace-correlation',
        ...metadata,
      },
    });

    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;

    const crossComponentTrace: CrossComponentTrace = {
      traceId,
      tenantId,
      operationName,
      totalDuration: 0,
      components: [],
      startTime: new Date(),
      endTime: new Date(),
      status: 'success',
    };

    this.activeTraces.set(traceId, crossComponentTrace);

    this.logger.debug('Started cross-component trace', {
      traceId,
      operationName,
      tenantId,
      requestId,
    });

    return traceId;
  }

  // Add a component trace to the cross-component trace
  addComponentTrace(
    traceId: string,
    component: string,
    operation: string,
    startTime: Date,
    endTime: Date,
    status: 'success' | 'error' | 'timeout',
    attributes?: Record<string, any>,
    errorMessage?: string
  ): void {
    const crossComponentTrace = this.activeTraces.get(traceId);
    if (!crossComponentTrace) {
      this.logger.warn('Cross-component trace not found', { traceId });
      return;
    }

    const componentTrace: ComponentTrace = {
      component,
      operation,
      spanId: Math.random().toString(36).substring(2, 15),
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      status,
      attributes: attributes || {},
      events: [],
      errorMessage,
    };

    crossComponentTrace.components.push(componentTrace);

    // Update cross-component trace status
    if (status === 'error') {
      crossComponentTrace.status = 'error';
      crossComponentTrace.errorMessage = errorMessage;
    }

    // Store component trace for performance analysis
    const componentKey = `${component}.${operation}`;
    if (!this.componentTraces.has(componentKey)) {
      this.componentTraces.set(componentKey, []);
    }
    this.componentTraces.get(componentKey)!.push(componentTrace);

    this.logger.debug('Added component trace', {
      traceId,
      component,
      operation,
      duration: componentTrace.duration,
      status,
    });
  }

  // Add event to component trace
  addTraceEvent(
    traceId: string,
    component: string,
    eventName: string,
    attributes?: Record<string, any>
  ): void {
    const crossComponentTrace = this.activeTraces.get(traceId);
    if (!crossComponentTrace) {
      return;
    }

    const componentTrace = crossComponentTrace.components
      .filter(c => c.component === component)
      .pop(); // Get the most recent component trace

    if (componentTrace) {
      componentTrace.events.push({
        timestamp: new Date(),
        name: eventName,
        attributes: attributes || {},
      });
    }
  }

  // Finish a cross-component trace
  finishCrossComponentTrace(traceId: string): CrossComponentTrace | undefined {
    const crossComponentTrace = this.activeTraces.get(traceId);
    if (!crossComponentTrace) {
      return undefined;
    }

    crossComponentTrace.endTime = new Date();
    crossComponentTrace.totalDuration = crossComponentTrace.endTime.getTime() - crossComponentTrace.startTime.getTime();

    // Calculate performance metrics
    this.recordPerformanceMetrics(crossComponentTrace);

    // Remove from active traces
    this.activeTraces.delete(traceId);

    this.logger.debug('Finished cross-component trace', {
      traceId,
      totalDuration: crossComponentTrace.totalDuration,
      components: crossComponentTrace.components.length,
      status: crossComponentTrace.status,
    });

    return crossComponentTrace;
  }

  // Record performance metrics
  private recordPerformanceMetrics(trace: CrossComponentTrace): void {
    for (const component of trace.components) {
      const key = `${component.component}.${component.operation}`;
      
      // Record individual component metrics
      this.metrics.recordBusinessOperation(
        'component_trace_completed',
        trace.tenantId,
        {
          component: component.component,
          operation: component.operation,
          duration: component.duration,
          status: component.status,
        }
      );

      // Update performance metrics
      this.updatePerformanceMetrics(key, component);
    }

    // Record overall trace metrics
    this.metrics.recordBusinessOperation(
      'cross_component_trace_completed',
      trace.tenantId,
      {
        operation_name: trace.operationName,
        total_duration: trace.totalDuration,
        components_count: trace.components.length,
        status: trace.status,
      }
    );
  }

  // Update performance metrics
  private updatePerformanceMetrics(key: string, component: ComponentTrace): void {
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, []);
    }

    const metrics = this.performanceMetrics.get(key)!;
    const existingMetric = metrics.find(m => 
      m.component === component.component && 
      m.operation === component.operation &&
      Math.abs(m.timestamp.getTime() - Date.now()) < 60000 // Within 1 minute
    );

    if (existingMetric) {
      // Update existing metric (simplified - in production, use proper percentile calculation)
      existingMetric.p50 = (existingMetric.p50 + component.duration) / 2;
      existingMetric.p95 = Math.max(existingMetric.p95, component.duration);
      existingMetric.p99 = Math.max(existingMetric.p99, component.duration);
      existingMetric.errorRate = component.status === 'error' ? 
        (existingMetric.errorRate + 1) / 2 : 
        existingMetric.errorRate * 0.95;
      existingMetric.throughput += 1;
    } else {
      // Create new metric
      metrics.push({
        component: component.component,
        operation: component.operation,
        p50: component.duration,
        p95: component.duration,
        p99: component.duration,
        errorRate: component.status === 'error' ? 1 : 0,
        throughput: 1,
        timestamp: new Date(),
      });
    }
  }

  // Analyze performance and generate optimization hints
  private analyzePerformance(): void {
    const newHints: PerformanceOptimizationHint[] = [];

    for (const [key, metrics] of this.performanceMetrics) {
      const latestMetric = metrics[metrics.length - 1];
      if (!latestMetric) continue;

      // Check for slow operations
      if (latestMetric.p95 > this.config.performanceThresholds!.slowOperationMs) {
        newHints.push({
          component: latestMetric.component,
          operation: latestMetric.operation,
          issue: 'High latency detected',
          severity: latestMetric.p95 > this.config.performanceThresholds!.slowOperationMs * 2 ? 'high' : 'medium',
          recommendation: 'Consider optimizing this operation or adding caching',
          impact: `P95 latency is ${latestMetric.p95}ms, above threshold of ${this.config.performanceThresholds!.slowOperationMs}ms`,
          implementation: 'Review database queries, add indexes, implement caching, or optimize algorithms',
        });
      }

      // Check for high error rates
      if (latestMetric.errorRate > this.config.performanceThresholds!.errorRateThreshold) {
        newHints.push({
          component: latestMetric.component,
          operation: latestMetric.operation,
          issue: 'High error rate detected',
          severity: latestMetric.errorRate > this.config.performanceThresholds!.errorRateThreshold * 2 ? 'high' : 'medium',
          recommendation: 'Investigate and fix the root cause of errors',
          impact: `Error rate is ${(latestMetric.errorRate * 100).toFixed(2)}%, above threshold of ${(this.config.performanceThresholds!.errorRateThreshold * 100).toFixed(2)}%`,
          implementation: 'Review error logs, add error handling, improve input validation',
        });
      }

      // Check for low throughput
      if (latestMetric.throughput < this.config.performanceThresholds!.throughputThreshold) {
        newHints.push({
          component: latestMetric.component,
          operation: latestMetric.operation,
          issue: 'Low throughput detected',
          severity: 'low',
          recommendation: 'Consider scaling up or optimizing for higher throughput',
          impact: `Throughput is ${latestMetric.throughput} ops/sec, below threshold of ${this.config.performanceThresholds!.throughputThreshold} ops/sec`,
          implementation: 'Add horizontal scaling, optimize resource usage, or implement batching',
        });
      }
    }

    this.optimizationHints = newHints;

    // Log critical issues
    for (const hint of newHints.filter(h => h.severity === 'high')) {
      this.logger.warn('Performance optimization needed', {
        component: hint.component,
        operation: hint.operation,
        issue: hint.issue,
        recommendation: hint.recommendation,
        impact: hint.impact,
      });
    }
  }

  // Get performance optimization hints
  getOptimizationHints(component?: string): PerformanceOptimizationHint[] {
    if (component) {
      return this.optimizationHints.filter(h => h.component === component);
    }
    return this.optimizationHints;
  }

  // Get trace by ID
  getTrace(traceId: string): CrossComponentTrace | undefined {
    return this.activeTraces.get(traceId);
  }

  // Get traces by tenant
  getTracesByTenant(tenantId: string): CrossComponentTrace[] {
    return Array.from(this.activeTraces.values())
      .filter(trace => trace.tenantId === tenantId);
  }

  // Get performance metrics
  getPerformanceMetrics(component?: string, operation?: string): PerformanceMetrics[] {
    const results: PerformanceMetrics[] = [];

    for (const [key, metrics] of this.performanceMetrics) {
      for (const metric of metrics) {
        if (component && metric.component !== component) continue;
        if (operation && metric.operation !== operation) continue;
        results.push(metric);
      }
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Clean up old traces
  private cleanupOldTraces(): void {
    const cutoffTime = Date.now() - this.config.traceRetentionMs!;
    const tracesToRemove: string[] = [];

    for (const [traceId, trace] of this.activeTraces) {
      if (trace.startTime.getTime() < cutoffTime) {
        tracesToRemove.push(traceId);
      }
    }

    for (const traceId of tracesToRemove) {
      this.activeTraces.delete(traceId);
    }

    // Clean up component traces
    for (const [key, traces] of this.componentTraces) {
      const filteredTraces = traces.filter(trace => 
        trace.startTime.getTime() >= cutoffTime
      );
      this.componentTraces.set(key, filteredTraces);
    }

    // Clean up performance metrics
    for (const [key, metrics] of this.performanceMetrics) {
      const filteredMetrics = metrics.filter(metric => 
        metric.timestamp.getTime() >= cutoffTime
      );
      this.performanceMetrics.set(key, filteredMetrics);
    }

    if (tracesToRemove.length > 0) {
      this.logger.debug('Cleaned up old traces', {
        removedTraces: tracesToRemove.length,
        activeTraces: this.activeTraces.size,
      });
    }
  }

  // Create correlation middleware
  createCorrelationMiddleware() {
    return (req: any, res: any, next: any) => {
      const traceId = req.headers['x-trace-id'] || 
                     req.headers['trace-id'] || 
                     Math.random().toString(36).substring(2, 15);
      
      const requestId = req.headers['x-request-id'] || 
                       req.id || 
                       Math.random().toString(36).substring(2, 15);

      const tenantId = req.headers['x-tenant-id'] || 
                      req.tenantContext?.tenantId || 
                      'default';

      // Start cross-component trace
      const operationName = `${req.method} ${req.path}`;
      const startTime = new Date();
      
      this.startCrossComponentTrace(operationName, tenantId, requestId, {
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });

      // Add trace context to request
      req.traceContext = {
        traceId,
        tenantId,
        requestId,
        operationName,
        startTime: startTime.getTime(),
      };

      // Hook into response to finish trace
      const originalEnd = res.end;
      res.end = (...args: any[]) => {
        const endTime = new Date();
        const status = res.statusCode >= 400 ? 'error' : 'success';
        
        this.addComponentTrace(
          traceId,
          'http',
          operationName,
          startTime,
          endTime,
          status,
          {
            statusCode: res.statusCode,
            method: req.method,
            path: req.path,
          },
          res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined
        );

        this.finishCrossComponentTrace(traceId);
        
        originalEnd.apply(res, args);
      };

      next();
    };
  }

  // Helper method to wrap async functions with tracing
  withTracing<T>(
    traceId: string,
    component: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = new Date();
    
    return fn()
      .then(result => {
        const endTime = new Date();
        this.addComponentTrace(
          traceId,
          component,
          operation,
          startTime,
          endTime,
          'success'
        );
        return result;
      })
      .catch(error => {
        const endTime = new Date();
        this.addComponentTrace(
          traceId,
          component,
          operation,
          startTime,
          endTime,
          'error',
          {},
          error.message
        );
        throw error;
      });
  }

  // Get dashboard data
  getDashboardData(): any {
    const activeTraces = this.activeTraces.size;
    const totalComponents = new Set(
      Array.from(this.activeTraces.values())
        .flatMap(trace => trace.components.map(c => c.component))
    ).size;

    const recentMetrics = this.getPerformanceMetrics()
      .filter(m => Date.now() - m.timestamp.getTime() < 300000); // Last 5 minutes

    const avgLatency = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.p50, 0) / recentMetrics.length 
      : 0;

    const avgErrorRate = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentMetrics.length 
      : 0;

    return {
      summary: {
        activeTraces,
        totalComponents,
        avgLatency,
        avgErrorRate,
        optimizationHints: this.optimizationHints.length,
      },
      recentMetrics,
      optimizationHints: this.optimizationHints,
      timestamp: new Date(),
    };
  }
}

// Singleton instance
let globalTraceCorrelationManager: TraceCorrelationManager | undefined;

export function initializeTraceCorrelation(config?: {
  maxActiveTraces?: number;
  traceRetentionMs?: number;
  performanceThresholds?: {
    slowOperationMs: number;
    errorRateThreshold: number;
    throughputThreshold: number;
  };
}): TraceCorrelationManager {
  if (globalTraceCorrelationManager) {
    console.warn('Trace correlation already initialized');
    return globalTraceCorrelationManager;
  }

  globalTraceCorrelationManager = new TraceCorrelationManager(config);
  return globalTraceCorrelationManager;
}

export function getTraceCorrelationManager(): TraceCorrelationManager | undefined {
  return globalTraceCorrelationManager;
}

export function shutdownTraceCorrelation(): void {
  globalTraceCorrelationManager = undefined;
}