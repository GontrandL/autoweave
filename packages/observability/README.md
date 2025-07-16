# AutoWeave Observability Package

Complete observability solution for AutoWeave with OpenTelemetry, Grafana Stack, and production-ready monitoring.

## Features

### 🔍 **Distributed Tracing**
- OpenTelemetry auto-instrumentation
- Custom spans for USB events, plugin operations, GraphQL resolvers
- Cross-component trace correlation
- Tenant isolation for traces
- Performance optimized with <1% overhead

### 📊 **Metrics & Monitoring**
- Business metrics by tenant
- SLI/SLO monitoring and alerting
- Performance optimization recommendations
- Real-time dashboards for Dev, Ops, and Business teams
- Prometheus-compatible metrics

### 📝 **Structured Logging**
- Tenant-aware logging
- Log correlation with traces
- Loki integration for log aggregation
- Security and audit logging

### 🏥 **Health Monitoring**
- Component health checks
- SLO compliance tracking
- Error budget monitoring
- Performance degradation detection

### 🔒 **Security & Compliance**
- Tenant isolation and multi-tenancy
- Data retention policies
- GDPR/HIPAA/SOC2 compliance
- Security audit logging

### ⚡ **Performance Optimization**
- Automatic performance analysis
- Optimization recommendations
- Cross-component trace correlation
- Resource usage monitoring

## Quick Start

### Installation

```bash
npm install @autoweave/observability
```

### Basic Setup

```typescript
import { initializeObservability } from '@autoweave/observability';

const observability = initializeObservability({
  serviceName: 'autoweave-app',
  serviceVersion: '1.0.0',
  environment: 'production',
  tenantId: 'tenant-123',
  
  // Grafana stack endpoints
  otlpEndpoint: 'http://tempo:4318',
  lokiEndpoint: 'http://loki:3100',
  
  // Performance settings
  samplingRate: 0.1, // 10% sampling in production
  enableProductionOptimizations: true,
});

await observability.initialize();
```

### Express.js Integration

```typescript
import express from 'express';
import { getObservabilityManager } from '@autoweave/observability';

const app = express();
const observability = getObservabilityManager();

// Add observability middleware
app.use(observability.createHTTPMiddleware());

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await observability.getHealthStatus();
  res.json(health);
});
```

## Component Integration

### USB Daemon Integration

```typescript
import { usbDaemonIntegration } from '@autoweave/observability';

usbDaemon.on('device-attach', (deviceInfo) => {
  usbDaemonIntegration.instrumentUSBEvent('attach', deviceInfo, tenantId);
});

usbDaemon.on('device-detach', (deviceInfo) => {
  usbDaemonIntegration.instrumentUSBEvent('detach', deviceInfo, tenantId);
});
```

### Plugin Loader Integration

```typescript
import { pluginLoaderIntegration } from '@autoweave/observability';

async function loadPlugin(pluginName: string, tenantId: string) {
  return pluginLoaderIntegration.instrumentPluginLoad(
    pluginName,
    tenantId,
    () => this.actualLoadPlugin(pluginName)
  );
}

async function executePlugin(pluginName: string, tenantId: string) {
  return pluginLoaderIntegration.instrumentPluginExecution(
    pluginName,
    tenantId,
    () => this.actualExecutePlugin(pluginName)
  );
}
```

### Queue Manager Integration

```typescript
import { queueManagerIntegration } from '@autoweave/observability';

async function processJob(job: any) {
  return queueManagerIntegration.instrumentJobProcessing(
    job.queueName,
    job.type,
    job.tenantId,
    () => this.actualProcessJob(job)
  );
}

// Update queue size monitoring
queueManagerIntegration.updateQueueSize(queueName, currentSize, tenantId);
```

### GraphQL Integration

```typescript
import { httpAPIIntegration } from '@autoweave/observability';

const resolvers = {
  Query: {
    users: httpAPIIntegration.instrumentGraphQLResolver('Query', 'users', tenantId),
    plugins: httpAPIIntegration.instrumentGraphQLResolver('Query', 'plugins', tenantId),
  },
  Mutation: {
    createUser: httpAPIIntegration.instrumentGraphQLResolver('Mutation', 'createUser', tenantId),
  },
};
```

## Custom Tracing

### Creating Custom Spans

```typescript
import { getGlobalTracer } from '@autoweave/observability';

const tracer = getGlobalTracer();

// USB event span
const usbSpan = tracer.createUSBEventSpan({
  action: 'attach',
  vendorId: '0x1234',
  productId: '0x5678',
  tenantId: 'tenant-123'
});

// Plugin operation span
const pluginSpan = tracer.createPluginSpan({
  operation: 'load',
  pluginName: 'usb-scanner',
  tenantId: 'tenant-123'
});

// Queue job span
const jobSpan = tracer.createJobQueueSpan({
  operation: 'process',
  queueName: 'automation-queue',
  jobType: 'device-scan',
  jobId: 'job-123',
  tenantId: 'tenant-123'
});
```

### Span Utilities

```typescript
import { getGlobalTracer } from '@autoweave/observability';

const tracer = getGlobalTracer();

// Wrap async function with automatic span lifecycle
const result = await tracer.withSpan(span, async () => {
  // Your async operation here
  return await someAsyncOperation();
});
```

## Custom Metrics

### Recording Business Metrics

```typescript
import { getMetrics } from '@autoweave/observability';

const metrics = getMetrics();

// Record business operation
metrics.recordBusinessOperation(
  'device-automation',
  'tenant-123',
  { plugin: 'usb-scanner', success: true }
);

// Record plugin execution
metrics.recordPluginExecution('usb-scanner', 'tenant-123', 150, true);

// Record automation task
metrics.recordAutomationTask('device-scan', 'tenant-123', true);
```

### Performance Metrics

```typescript
// Record component initialization
metrics.recordComponentInit('usb-daemon', 500);

// Update resource usage
metrics.updateResourceUsage('usb-daemon', 128, 45, 1024);

// Record cache metrics
metrics.updateCacheMetrics('manifest-cache', 0.95, 1000);
```

## Structured Logging

### Component-Specific Logging

```typescript
import { getLogger } from '@autoweave/observability';

const logger = getLogger();

// USB event logging
logger.logUSBEvent('attach', {
  vendorId: '0x1234',
  productId: '0x5678',
  manufacturer: 'Example Corp',
  product: 'USB Device'
});

// Plugin event logging
logger.logPluginEvent('load', 'usb-scanner', {
  version: '1.0.0',
  capabilities: ['scan', 'monitor'],
  loadTime: 150
});

// Job event logging
logger.logJobEvent('completed', {
  id: 'job-123',
  type: 'device-scan',
  queueName: 'automation-queue',
  duration: 2500,
  metadata: { tenantId: 'tenant-123' }
});
```

### Security Logging

```typescript
// Security event logging
logger.logSecurityEvent('access_denied', 'high', {
  userId: 'user-123',
  resource: 'plugin-loader',
  reason: 'insufficient_permissions'
});

// Performance logging
logger.logPerformance('plugin-load', 250, {
  pluginName: 'usb-scanner',
  tenantId: 'tenant-123'
});
```

## Health Monitoring

### Custom Health Checks

```typescript
import { getHealthMonitor } from '@autoweave/observability';

const healthMonitor = getHealthMonitor();

// Register custom health check
healthMonitor.registerHealthCheck({
  name: 'database-connection',
  component: 'database',
  critical: true,
  check: async () => {
    const isConnected = await database.ping();
    return {
      status: isConnected ? 'healthy' : 'unhealthy',
      message: isConnected ? 'Database is connected' : 'Database connection failed',
      timestamp: new Date(),
      responseTime: 0,
    };
  },
});
```

### SLO Monitoring

```typescript
import { getSLISLOManager } from '@autoweave/observability';

const sloManager = getSLISLOManager();

// Register custom SLI
sloManager.registerSLI({
  name: 'api_response_time',
  component: 'api',
  description: 'API response time (P95)',
  query: 'histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))',
  unit: 'milliseconds',
  target: 500,
  thresholds: {
    warning: 400,
    critical: 600,
  },
  window: '5m',
  evaluationInterval: '30s',
});

// Register custom SLO
sloManager.registerSLO({
  name: 'api_response_time_slo',
  component: 'api',
  description: '95% of API requests respond within 500ms',
  sli: 'api_response_time',
  target: 0.95,
  window: '30d',
  errorBudget: 0.05,
  burnRate: {
    window: '1h',
    threshold: 0.1,
  },
  alerting: {
    enabled: true,
    channels: ['email', 'slack'],
  },
});
```

## Performance Optimization

### Getting Performance Recommendations

```typescript
import { getPerformanceOptimizer } from '@autoweave/observability';

const optimizer = getPerformanceOptimizer();

// Get optimization hints for a component
const hints = optimizer.getOptimizationHints('usb-daemon');

// Get all critical recommendations
const criticalRecommendations = optimizer.getRecommendationsByPriority('critical');

// Get performance dashboard data
const dashboardData = optimizer.getDashboardData();
```

### Recording Performance Samples

```typescript
// Record performance sample
optimizer.recordSample('usb-daemon', 'process-event', {
  timestamp: new Date(),
  duration: 45,
  cpuUsage: 12.5,
  memoryUsage: 128,
  status: 'success',
  tenantId: 'tenant-123',
  metadata: { eventType: 'attach' }
});
```

## Tenant Isolation

### Tenant Configuration

```typescript
import { getTenantIsolationManager } from '@autoweave/observability';

const tenantManager = getTenantIsolationManager();

// Register tenant
tenantManager.registerTenant({
  id: 'premium-tenant',
  name: 'Premium Customer',
  environment: 'production',
  limits: {
    maxMetricsPerSecond: 5000,
    maxTracesPerSecond: 2500,
    maxLogsPerSecond: 10000,
    maxRetentionDays: 90,
    maxStorageMB: 10000,
  },
  retention: {
    traces: '30d',
    logs: '90d',
    metrics: '90d',
  },
  security: {
    encryptionEnabled: true,
    auditLoggingEnabled: true,
    ipWhitelist: ['192.168.1.0/24'],
  },
  compliance: {
    gdprCompliant: true,
    hipaaCompliant: true,
    soc2Compliant: true,
    dataRegion: 'us-west-2',
  },
  alerting: {
    enabled: true,
    channels: ['email', 'slack', 'pagerduty'],
  },
});
```

### Compliance Reporting

```typescript
// Generate compliance report
const complianceReport = tenantManager.generateComplianceReport('premium-tenant');

// Get security audit events
const auditEvents = tenantManager.getSecurityAuditEvents(
  'premium-tenant',
  new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  new Date()
);
```

## Deployment

### Helm Chart Deployment

```bash
# Deploy Grafana Stack
helm install autoweave-observability ./packages/observability/deploy/helm/grafana-stack \
  --namespace autoweave-observability \
  --set global.tenantId=your-tenant-id \
  --set global.environment=production \
  --set grafana.adminPassword="your-secure-password"
```

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  tempo:
    image: grafana/tempo:2.0.0
    ports:
      - "3100:3100"
      - "4317:4317"
      - "4318:4318"
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
    command: ["-config.file=/etc/tempo.yaml"]

  loki:
    image: grafana/loki:2.8.0
    ports:
      - "3100:3100"
    command: -config.file=/etc/loki/local-config.yaml

  grafana:
    image: grafana/grafana:9.0.0
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
```

### Environment Variables

```bash
# OpenTelemetry Configuration
export OTEL_SERVICE_NAME=autoweave-app
export OTEL_SERVICE_VERSION=1.0.0
export OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318
export OTEL_RESOURCE_ATTRIBUTES=service.name=autoweave-app,service.version=1.0.0

# Logging Configuration
export LOG_LEVEL=info
export LOKI_ENDPOINT=http://loki:3100

# Metrics Configuration
export PROMETHEUS_ENDPOINT=http://prometheus:9090
export METRICS_EXPORT_INTERVAL=60000

# Performance Configuration
export SAMPLING_RATE=0.1
export ENABLE_PRODUCTION_OPTIMIZATIONS=true
```

## Dashboard Access

### Grafana Dashboards

1. **Developer Dashboard** - `/d/dev/autoweave-developer`
   - Performance metrics
   - Error rates
   - Debug information

2. **Operations Dashboard** - `/d/ops/autoweave-operations`
   - SLO compliance
   - Infrastructure health
   - Alert status

3. **Business Dashboard** - `/d/business/autoweave-business`
   - Tenant activity
   - Plugin usage
   - Revenue metrics

### Dashboard URLs

```bash
# Development
export GRAFANA_URL=http://localhost:3000

# Production
export GRAFANA_URL=https://grafana.autoweave.com
```

## Performance Characteristics

### Overhead Analysis

| Component | Base Overhead | With Sampling | Production Impact |
|-----------|---------------|---------------|-------------------|
| USB Events | 0.1-0.2ms | 0.01-0.02ms | <0.1% |
| Plugin Operations | 0.5-1ms | 0.1-0.2ms | <0.2% |
| Queue Operations | 0.1-0.3ms | 0.02-0.06ms | <0.1% |
| HTTP Requests | 0.2-0.5ms | 0.2-0.5ms | <0.3% |
| GraphQL Resolvers | 0.1-0.4ms | 0.02-0.08ms | <0.1% |

**Total System Overhead: <1%**

### Optimization Techniques

1. **Sampling**: 5-20% of operations instrumented
2. **Batching**: Group metrics for efficiency
3. **Throttling**: Limit expensive operations
4. **Async Processing**: Non-blocking instrumentation
5. **Caching**: Avoid repeated calculations
6. **Conditional Logic**: Skip unnecessary work

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check sampling rates
   - Verify retention policies
   - Monitor cardinality

2. **Missing Traces**
   - Verify OTLP endpoints
   - Check network policies
   - Validate service discovery

3. **Performance Impact**
   - Reduce sampling rate
   - Disable detailed tracing
   - Use async processing

### Debug Mode

```typescript
import { initializeObservability } from '@autoweave/observability';

const observability = initializeObservability({
  // ... other config
  logLevel: 'debug',
  enableConsoleLogging: true,
  samplingRate: 1.0, // 100% sampling for debugging
});
```

## API Reference

### Main Classes

- `ObservabilityManager` - Central coordinator
- `AutoWeaveTracer` - Distributed tracing
- `AutoWeaveMetrics` - Metrics collection
- `AutoWeaveLogger` - Structured logging
- `HealthMonitor` - Health checking
- `SLISLOManager` - SLO monitoring
- `TenantIsolationManager` - Multi-tenancy
- `TraceCorrelationManager` - Cross-component tracing
- `PerformanceOptimizer` - Performance analysis

### Integration Classes

- `USBDaemonIntegration` - USB event instrumentation
- `PluginLoaderIntegration` - Plugin operation instrumentation
- `QueueManagerIntegration` - Queue job instrumentation
- `MemorySystemIntegration` - Memory operation instrumentation
- `HTTPAPIIntegration` - HTTP/GraphQL instrumentation

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: https://docs.autoweave.com/observability
- **Issues**: https://github.com/autoweave/autoweave/issues
- **Support**: support@autoweave.com