// Classes and functions
export { AutoWeaveTracer, initializeTracing, getGlobalTracer, shutdownTracing } from './tracing/tracer';
export { AutoWeaveMetrics, initializeMetrics, getMetrics, shutdownMetrics } from './metrics/metrics';
export { AutoWeaveLogger, initializeLogging, getLogger, shutdownLogging } from './logging/logger';
export { HealthMonitor } from './health/health-monitor';
export { SLISLOManager } from './sli-slo/sli-slo-manager';
export { TenantIsolationManager } from './security/tenant-isolation';
export { TraceCorrelationManager as TraceCorrelator } from './performance/trace-correlation';
export { PerformanceOptimizer } from './performance/performance-optimizer';
export { ObservabilityManager, initializeObservability, getObservabilityManager as getObservability, shutdownObservability } from './observability-manager';

// Types and interfaces
export type { TracingConfig, USBEventSpanOptions, PluginSpanOptions, JobQueueSpanOptions } from './tracing/tracer';
export type { MetricsConfig } from './metrics/metrics';
export type { LoggingConfig } from './logging/logger';
export type { HealthCheck, HealthStatus, SLO as HealthSLO, SLI as HealthSLI } from './health/health-monitor';
export type { SLI, SLO, SLIValue, SLOStatus, SLOAlert } from './sli-slo/sli-slo-manager';
export type { TenantConfig, TenantContext, DataRetentionPolicy, SecurityAuditEvent } from './security/tenant-isolation';
export type { TraceCorrelationContext, CrossComponentTrace, ComponentTrace, TraceEvent, PerformanceMetrics, PerformanceOptimizationHint } from './performance/trace-correlation';
export type { PerformanceProfile, PerformanceSample, PerformanceStatistics, OptimizationRecommendation, ResourceUsageThreshold, PerformanceAlert } from './performance/performance-optimizer';
export type { ObservabilityConfig } from './observability-manager';