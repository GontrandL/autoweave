# AutoWeave Observability Deployment Guide

## Overview

This deployment guide covers the complete AutoWeave observability stack including OpenTelemetry, Grafana, Tempo, Loki, and Prometheus for production monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AutoWeave Observability Stack               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Grafana   │  │    Tempo    │  │     Loki    │  │ Prometheus  │ │
│  │(Dashboards) │  │ (Tracing)   │  │ (Logging)   │  │ (Metrics)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │ Alertmanager│  │   Ingress   │ │
│  │(Persistence)│  │  (Cache)    │  │ (Alerting)  │  │ (External)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AutoWeave Application                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ USB Daemon  │  │Plugin Loader│  │Queue Manager│  │   Memory    │ │
│  │             │  │             │  │             │  │   System    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### 🔍 **Distributed Tracing (Tempo)**
- OpenTelemetry auto-instrumentation
- Custom spans for USB events, plugin operations, GraphQL resolvers
- Cross-component trace correlation
- Tenant isolation for traces
- 7-day retention with S3 storage

### 📊 **Metrics Collection (Prometheus)**
- Business metrics by tenant
- Performance metrics with <1% overhead
- SLI/SLO monitoring
- Custom dashboards for Dev, Ops, and Business teams
- Alerting with escalation policies

### 📝 **Log Aggregation (Loki)**
- Structured logging with tenant context
- Log correlation with traces
- Efficient storage with retention policies
- Search and filtering capabilities

### 📈 **Visualization (Grafana)**
- 3 pre-built dashboards
- Real-time alerting
- Multi-tenancy support
- Integration with all data sources

### 🔒 **Security & Compliance**
- Network policies for component isolation
- RBAC and pod security policies
- Encrypted communication
- Audit logging

## Prerequisites

- Kubernetes cluster (v1.20+)
- Helm 3.x
- StorageClass for persistent volumes
- Ingress controller (nginx recommended)
- cert-manager for TLS certificates
- AWS S3 or compatible storage for long-term retention

## Quick Start

### 1. Install Dependencies

```bash
# Add required Helm repositories
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 2. Create Namespace

```bash
kubectl create namespace autoweave-observability
kubectl label namespace autoweave-observability name=autoweave-observability
```

### 3. Deploy the Stack

```bash
# Install the complete observability stack
helm install autoweave-observability ./packages/observability/deploy/helm/grafana-stack \
  --namespace autoweave-observability \
  --set global.tenantId=your-tenant-id \
  --set global.environment=production \
  --set grafana.adminPassword="your-secure-password" \
  --set postgresql.auth.password="your-db-password" \
  --set redis.auth.password="your-redis-password"
```

### 4. Configure External Access

```bash
# Update your DNS to point to the ingress controller
# grafana.autoweave.com -> your-ingress-controller-ip
# tempo.autoweave.com -> your-ingress-controller-ip
# loki.autoweave.com -> your-ingress-controller-ip
```

## Configuration

### Environment-Specific Values

#### Development
```yaml
# values-dev.yaml
global:
  environment: development
  tenantId: dev-tenant
  
grafana:
  adminPassword: dev-password
  
tempo:
  retention: 72h
  
loki:
  retention: 72h
  
prometheus:
  retention: 3d
```

#### Production
```yaml
# values-prod.yaml
global:
  environment: production
  tenantId: prod-tenant
  resources:
    limits:
      cpu: "4"
      memory: "8Gi"
    requests:
      cpu: "1"
      memory: "2Gi"
      
grafana:
  adminPassword: "your-secure-password"
  
tempo:
  retention: 168h  # 7 days
  storage:
    backend: s3
    s3:
      bucket: autoweave-traces-prod
      
loki:
  retention: 168h  # 7 days
  storage:
    type: s3
    s3: s3://autoweave-logs-prod
    
prometheus:
  retention: 7d
```

### Tenant Isolation

Configure tenant-specific settings:

```yaml
global:
  tenantId: "tenant-123"
  
# Each tenant gets isolated metrics and traces
grafana:
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Prometheus-Tenant
          type: prometheus
          url: http://prometheus:9090
          jsonData:
            httpHeaderName1: "X-Tenant-ID"
          secureJsonData:
            httpHeaderValue1: "tenant-123"
```

## Integration with AutoWeave

### 1. Initialize Observability in Your Application

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
  
  // Feature flags
  enableTracing: true,
  enableMetrics: true,
  enableLogging: true,
  enableHealthMonitoring: true,
  
  // Performance settings
  samplingRate: 0.1, // 10% in production
  maxTraceExportBatchSize: 512,
  metricsExportInterval: 60000,
  
  // Production optimizations
  enableProductionOptimizations: true,
  maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
});

await observability.initialize();
```

### 2. Instrument Components

```typescript
// USB Daemon instrumentation
import { getObservabilityManager } from '@autoweave/observability';

const observability = getObservabilityManager();
observability.instrumentUSBDaemon(usbDaemon);

// Plugin Loader instrumentation
observability.instrumentPluginLoader(pluginLoader);

// Queue Manager instrumentation
observability.instrumentQueueManager(queueManager);
```

### 3. HTTP Middleware

```typescript
import express from 'express';
import { getObservabilityManager } from '@autoweave/observability';

const app = express();
const observability = getObservabilityManager();

// Add observability middleware
app.use(observability.createHTTPMiddleware());
```

### 4. Custom Spans and Metrics

```typescript
import { getGlobalTracer, getMetrics } from '@autoweave/observability';

const tracer = getGlobalTracer();
const metrics = getMetrics();

// Create custom USB event span
const span = tracer.createUSBEventSpan({
  action: 'attach',
  vendorId: '0x1234',
  productId: '0x5678',
  devicePath: '/dev/bus/usb/001/002',
  tenantId: 'tenant-123'
});

// Record business metrics
metrics.recordBusinessOperation(
  'device-automation',
  'tenant-123',
  { plugin: 'usb-scanner', success: true }
);
```

## Monitoring and Alerting

### Dashboards

1. **Developer Dashboard**: Focus on performance, errors, and debugging
2. **Operations Dashboard**: Infrastructure health, resource usage, SLOs
3. **Business Dashboard**: Tenant activity, plugin usage, automation metrics

### SLI/SLO Definitions

| Component | SLI | SLO Target | Alert Threshold |
|-----------|-----|------------|-----------------|
| USB Daemon | P95 event latency | < 80ms | > 80ms (warn), > 100ms (critical) |
| Plugin Loader | P95 load time | < 200ms | > 200ms (warn), > 250ms (critical) |
| System | Availability | > 99.9% | < 99.9% (critical) |
| General | Error rate | < 1% | > 1% (warn), > 5% (critical) |

### Alert Routing

```yaml
# Alertmanager configuration
route:
  group_by: ['alertname', 'tenant_id']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        tenant_id: 'premium-tenant'
      receiver: 'premium-support'
```

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

3. **Dashboard Loading Issues**
   - Check Grafana datasources
   - Verify Prometheus scraping
   - Validate queries

### Debug Commands

```bash
# Check observability stack status
kubectl get pods -n autoweave-observability

# View Grafana logs
kubectl logs -n autoweave-observability deployment/grafana

# Check Prometheus targets
kubectl port-forward -n autoweave-observability svc/prometheus 9090:9090
# Visit http://localhost:9090/targets

# View Tempo traces
kubectl port-forward -n autoweave-observability svc/tempo 3100:3100
# Visit http://localhost:3100/ready

# Check Loki logs
kubectl port-forward -n autoweave-observability svc/loki 3100:3100
# Visit http://localhost:3100/ready
```

## Performance Optimization

### Production Tuning

1. **Resource Allocation**
   ```yaml
   resources:
     limits:
       cpu: "4"
       memory: "8Gi"
     requests:
       cpu: "1"
       memory: "2Gi"
   ```

2. **Storage Optimization**
   ```yaml
   storage:
     storageClass: "fast-ssd"
     size: "100Gi"
   ```

3. **Network Optimization**
   ```yaml
   networkPolicy:
     enabled: true
   ```

### Monitoring Overhead

- **Target**: < 1% CPU overhead
- **Memory**: < 100MB per component
- **Network**: < 5% bandwidth increase

## Security Considerations

### Network Security
- Network policies restrict inter-pod communication
- TLS encryption for all external endpoints
- mTLS for internal communication (optional)

### Data Security
- Tenant isolation for all telemetry data
- Encrypted storage for sensitive logs
- Access controls via RBAC

### Compliance
- GDPR compliance for log data
- SOC 2 Type II controls
- Audit logging for all administrative actions

## Backup and Recovery

### Data Backup
```bash
# Backup Grafana dashboards
kubectl exec -n autoweave-observability deployment/grafana -- grafana-cli admin export-dashboard

# Backup Prometheus data
kubectl exec -n autoweave-observability deployment/prometheus -- promtool tsdb snapshot /prometheus

# Backup PostgreSQL
kubectl exec -n autoweave-observability deployment/postgresql -- pg_dump grafana
```

### Disaster Recovery
- RTO: 15 minutes
- RPO: 5 minutes
- Cross-region replication available

## Scaling

### Horizontal Scaling
```yaml
grafana:
  replicas: 3
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80
```

### Vertical Scaling
- Monitor resource usage
- Adjust limits based on workload
- Use HPA for automatic scaling

## Support

- **Documentation**: https://docs.autoweave.com/observability
- **Issues**: https://github.com/autoweave/autoweave/issues
- **Support**: support@autoweave.com

## License

MIT License - see LICENSE file for details.