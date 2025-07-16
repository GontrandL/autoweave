# AutoWeave Sprint 1 - Operations Guide

**Version:** 1.0.0  
**Sprint:** 1 (USB Daemon & Plugin Loader)  
**Status:** ✅ Production Ready  
**Date:** 2025-07-14

## 📖 Overview

This comprehensive operations guide provides DevOps engineers and system administrators with everything needed to deploy, monitor, secure, and maintain AutoWeave Sprint 1 components in production environments.

## 🎯 Operations Scope

### Sprint 1 Production Components
- **USB Daemon**: Real-time USB device hot-plug detection
- **Plugin Security Manager**: Multi-layer plugin security orchestration
- **Redis Integration**: Event streaming and state management
- **Monitoring Stack**: OpenTelemetry, Prometheus, Grafana
- **Security Framework**: Real-time threat detection and response

### Service Level Objectives (SLOs)
| Metric | Target | Measurement | Alert Threshold |
|--------|--------|-------------|-----------------|
| **Availability** | 99.9% | Monthly uptime | <99.5% |
| **USB Event Latency** | <100ms p95 | Real-time monitoring | >150ms p95 |
| **Plugin Load Time** | <250ms avg | Per-load measurement | >400ms avg |
| **Memory Growth** | <1MB/1000 cycles | Continuous tracking | >2MB/1000 cycles |
| **Error Rate** | <0.1% | Error/total requests | >0.5% |
| **Security Response** | <5s | Incident detection to block | >10s |

## 🚀 Production Deployment

### Infrastructure Requirements

#### Minimum Production Setup
```yaml
# Hardware Requirements
CPU: 4 cores (8 cores recommended)
Memory: 8GB RAM (16GB recommended)
Storage: 50GB SSD (100GB recommended)
Network: 1Gbps (10Gbps for high-volume)

# Software Requirements
OS: Ubuntu 20.04 LTS / CentOS 8 / RHEL 8
Kernel: 5.4+ (for latest USB support)
Docker: 20.10+
Kubernetes: 1.24+ (if using K8s)
Redis: 6.2+

# USB Requirements
libusb: 1.0.24+
udev: 246+ (systemd)
USB subsystem: USB 2.0/3.0 support
```

#### High Availability Setup
```yaml
# Load Balancer
Type: Application Load Balancer
Health checks: /health endpoint
Session persistence: None (stateless)
SSL termination: Required

# AutoWeave Instances
Minimum: 2 instances
Recommended: 3 instances (across AZs)
Scaling: Horizontal auto-scaling
Resource limits: CPU 2 cores, Memory 4GB per instance

# Redis Cluster
Configuration: Redis Cluster mode
Nodes: Minimum 3 masters, 3 replicas
Persistence: AOF + RDB snapshots
Backup: Daily automated backups

# Monitoring
Prometheus: HA pair with shared storage
Grafana: Load balanced instances
Alertmanager: HA cluster
Log aggregation: ELK stack or similar
```

### Container Deployment

#### Production Dockerfile
```dockerfile
# Dockerfile.production
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libusb-dev \
    eudev-dev \
    pkgconfig

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN npm ci --only=production --no-audit

# Copy source code
COPY src/ ./src/
COPY config/ ./config/
COPY scripts/ ./scripts/

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    libusb \
    eudev \
    tini \
    curl \
    redis

# Create app user
RUN addgroup -g 1001 -S autoweave && \
    adduser -S autoweave -u 1001 -G autoweave

# Create directories
RUN mkdir -p /app/logs /app/.sandbox /app/plugins && \
    chown -R autoweave:autoweave /app

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=autoweave:autoweave /app .

# Copy udev rules and scripts
COPY scripts/udev/99-autoweave-usb.rules /etc/udev/rules.d/
COPY scripts/udev/autoweave-udev-notify /usr/local/bin/
RUN chmod +x /usr/local/bin/autoweave-udev-notify

# Setup tini as init
ENTRYPOINT ["/sbin/tini", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Switch to non-root user
USER autoweave

# Expose ports
EXPOSE 3000 8080

# Start command
CMD ["npm", "run", "start:production"]
```

#### Docker Compose Production
```yaml
# docker-compose.production.yml
version: '3.8'

services:
  autoweave:
    build:
      context: .
      dockerfile: Dockerfile.production
    image: autoweave:latest
    
    # Deployment configuration
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    
    # USB device access
    privileged: true
    devices:
      - '/dev/bus/usb:/dev/bus/usb'
    volumes:
      - '/run/udev:/run/udev:ro'
      - 'autoweave_logs:/app/logs'
      - 'autoweave_plugins:/app/plugins:ro'
      - 'autoweave_sandbox:/app/.sandbox'
    
    # Environment configuration
    environment:
      NODE_ENV: production
      LOG_LEVEL: info
      REDIS_HOST: redis-cluster
      REDIS_PORT: 6379
      SECURITY_LEVEL: high
      MAX_ACTIVE_PLUGINS: 10
      MONITORING_ENABLED: true
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector:4318
    
    # Networking
    networks:
      - autoweave_network
    
    # Dependencies
    depends_on:
      - redis-cluster
      - otel-collector
    
    # Health checks
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  redis-cluster:
    image: redis:7-alpine
    command: redis-server --appendonly yes --cluster-enabled yes
    
    deploy:
      replicas: 6
      restart_policy:
        condition: on-failure
    
    volumes:
      - 'redis_data:/data'
    
    networks:
      - autoweave_network
    
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 5s
      retries: 3

  prometheus:
    image: prom/prometheus:latest
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    
    volumes:
      - './monitoring/prometheus.yml:/etc/prometheus/prometheus.yml'
      - './monitoring/alert-rules.yml:/etc/prometheus/alert-rules.yml'
      - 'prometheus_data:/prometheus'
    
    ports:
      - "9090:9090"
    
    networks:
      - autoweave_network

  grafana:
    image: grafana/grafana:latest
    
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: false
      GF_USERS_ALLOW_ORG_CREATE: false
    
    volumes:
      - './monitoring/grafana/dashboards:/var/lib/grafana/dashboards'
      - './monitoring/grafana/provisioning:/etc/grafana/provisioning'
      - 'grafana_data:/var/lib/grafana'
    
    ports:
      - "3001:3000"
    
    networks:
      - autoweave_network
    
    depends_on:
      - prometheus

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yml"]
    
    volumes:
      - './monitoring/otel-collector-config.yml:/etc/otel-collector-config.yml'
    
    ports:
      - "4317:4317"   # OTLP gRPC receiver
      - "4318:4318"   # OTLP HTTP receiver
      - "8888:8888"   # Prometheus metrics
    
    networks:
      - autoweave_network

volumes:
  autoweave_logs:
  autoweave_plugins:
  autoweave_sandbox:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  autoweave_network:
    driver: bridge
```

### Kubernetes Deployment

#### Production Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: autoweave-prod
  labels:
    name: autoweave-prod
    environment: production

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: autoweave-config
  namespace: autoweave-prod
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  SECURITY_LEVEL: "high"
  MAX_ACTIVE_PLUGINS: "10"
  MONITORING_ENABLED: "true"
  REDIS_HOST: "redis-cluster-service"
  REDIS_PORT: "6379"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: autoweave-secrets
  namespace: autoweave-prod
type: Opaque
data:
  redis-password: <base64-encoded-password>
  api-key: <base64-encoded-api-key>

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autoweave-sprint1
  namespace: autoweave-prod
  labels:
    app: autoweave
    component: sprint1
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  
  selector:
    matchLabels:
      app: autoweave
      component: sprint1
  
  template:
    metadata:
      labels:
        app: autoweave
        component: sprint1
        version: v1.0.0
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
        prometheus.io/path: "/metrics"
    
    spec:
      securityContext:
        runAsNonRoot: false  # Required for USB access
        runAsUser: 0
        fsGroup: 1001
      
      containers:
      - name: autoweave
        image: autoweave:v1.0.0
        imagePullPolicy: IfNotPresent
        
        ports:
        - containerPort: 3000
          name: api
          protocol: TCP
        - containerPort: 8080
          name: health
          protocol: TCP
        
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: autoweave-config
              key: NODE_ENV
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: autoweave-secrets
              key: redis-password
        
        envFrom:
        - configMapRef:
            name: autoweave-config
        
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 3
        
        volumeMounts:
        - name: usb-devices
          mountPath: /dev/bus/usb
        - name: udev-runtime
          mountPath: /run/udev
          readOnly: true
        - name: logs
          mountPath: /app/logs
        - name: plugins
          mountPath: /app/plugins
          readOnly: true
        - name: sandbox
          mountPath: /app/.sandbox
      
      volumes:
      - name: usb-devices
        hostPath:
          path: /dev/bus/usb
          type: Directory
      - name: udev-runtime
        hostPath:
          path: /run/udev
          type: Directory
      - name: logs
        emptyDir:
          sizeLimit: 1Gi
      - name: plugins
        configMap:
          name: autoweave-plugins
      - name: sandbox
        emptyDir:
          sizeLimit: 512Mi
      
      nodeSelector:
        kubernetes.io/os: linux
        node-role.kubernetes.io/worker: "true"
      
      tolerations:
      - key: "hardware/usb"
        operator: "Exists"
        effect: "NoSchedule"
      
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - autoweave
              topologyKey: kubernetes.io/hostname

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: autoweave-service
  namespace: autoweave-prod
  labels:
    app: autoweave
    component: sprint1
spec:
  selector:
    app: autoweave
    component: sprint1
  ports:
  - name: api
    port: 3000
    targetPort: 3000
    protocol: TCP
  - name: health
    port: 8080
    targetPort: 8080
    protocol: TCP
  type: ClusterIP

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: autoweave-hpa
  namespace: autoweave-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: autoweave-sprint1
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

## 📊 Monitoring Setup

### Prometheus Configuration

#### Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'autoweave-prod'
    environment: 'production'

rule_files:
  - "alert-rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # AutoWeave Sprint 1 metrics
  - job_name: 'autoweave-sprint1'
    static_configs:
      - targets: ['autoweave:8080']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s
    honor_labels: true
    
  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    metrics_path: '/metrics'
    
  # Node exporter for system metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    
  # Container metrics
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
    metrics_path: '/metrics'

  # Kubernetes API server metrics
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
    - role: endpoints
      namespaces:
        names:
        - default
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      insecure_skip_verify: true
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
    - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
      action: keep
      regex: default;kubernetes;https

  # Kubernetes pods
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
    - role: pod
      namespaces:
        names:
        - autoweave-prod
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
      action: keep
      regex: true
    - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
      action: replace
      target_label: __metrics_path__
      regex: (.+)
    - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
      action: replace
      regex: ([^:]+)(?::\d+)?;(\d+)
      replacement: $1:$2
      target_label: __address__
```

#### Alert Rules
```yaml
# monitoring/alert-rules.yml
groups:
- name: autoweave-sprint1
  rules:
  
  # High-level availability alerts
  - alert: AutoWeaveDown
    expr: up{job="autoweave-sprint1"} == 0
    for: 30s
    labels:
      severity: critical
      component: autoweave
    annotations:
      summary: "AutoWeave Sprint 1 instance is down"
      description: "AutoWeave instance {{ $labels.instance }} has been down for more than 30 seconds"
      runbook_url: "https://docs.autoweave.dev/runbooks/service-down"

  # Performance alerts
  - alert: HighUSBEventLatency
    expr: histogram_quantile(0.95, autoweave_usb_event_latency_ms_bucket) > 150
    for: 2m
    labels:
      severity: warning
      component: usb-daemon
    annotations:
      summary: "High USB event processing latency"
      description: "95th percentile USB event latency is {{ $value }}ms (threshold: 150ms)"
      runbook_url: "https://docs.autoweave.dev/runbooks/high-latency"

  - alert: SlowPluginLoading
    expr: autoweave_plugin_load_duration_ms_avg > 400
    for: 1m
    labels:
      severity: warning
      component: plugin-loader
    annotations:
      summary: "Slow plugin loading detected"
      description: "Average plugin load time is {{ $value }}ms (threshold: 400ms)"

  # Memory alerts
  - alert: MemoryLeak
    expr: increase(autoweave_memory_usage_bytes[1h]) > 2097152  # 2MB
    for: 30m
    labels:
      severity: warning
      component: memory
    annotations:
      summary: "Potential memory leak detected"
      description: "Memory usage increased by {{ $value | humanize }}B in the last hour"

  - alert: HighMemoryUsage
    expr: (autoweave_memory_usage_bytes / autoweave_memory_limit_bytes) > 0.9
    for: 5m
    labels:
      severity: critical
      component: memory
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value | humanizePercentage }} of limit"

  # Security alerts
  - alert: SecurityViolation
    expr: increase(autoweave_security_violations_total[5m]) > 0
    for: 0s
    labels:
      severity: critical
      component: security
    annotations:
      summary: "Security violation detected"
      description: "{{ $value }} security violations in the last 5 minutes"
      runbook_url: "https://docs.autoweave.dev/runbooks/security-incident"

  - alert: PluginBlocked
    expr: increase(autoweave_plugins_blocked_total[1m]) > 0
    for: 0s
    labels:
      severity: warning
      component: security
    annotations:
      summary: "Plugin blocked due to security violation"
      description: "{{ $value }} plugins blocked in the last minute"

  # Error rate alerts
  - alert: HighErrorRate
    expr: rate(autoweave_errors_total[5m]) / rate(autoweave_requests_total[5m]) > 0.01
    for: 2m
    labels:
      severity: warning
      component: api
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"

  # Redis connectivity
  - alert: RedisConnectionLoss
    expr: autoweave_redis_connected == 0
    for: 30s
    labels:
      severity: critical
      component: redis
    annotations:
      summary: "Redis connection lost"
      description: "AutoWeave lost connection to Redis"
      runbook_url: "https://docs.autoweave.dev/runbooks/redis-connection"

  # USB system alerts
  - alert: USBSubsystemFailure
    expr: autoweave_usb_daemon_running == 0
    for: 1m
    labels:
      severity: critical
      component: usb
    annotations:
      summary: "USB daemon not running"
      description: "USB hot-plug detection is not functional"
      runbook_url: "https://docs.autoweave.dev/runbooks/usb-failure"

- name: system-health
  rules:
  
  # System resource alerts
  - alert: HighCPUUsage
    expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
    for: 5m
    labels:
      severity: warning
      component: system
    annotations:
      summary: "High CPU usage"
      description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

  - alert: HighDiskUsage
    expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.85
    for: 5m
    labels:
      severity: warning
      component: system
    annotations:
      summary: "High disk usage"
      description: "Disk usage is {{ $value | humanizePercentage }} on {{ $labels.instance }}"

  - alert: DiskFull
    expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.95
    for: 1m
    labels:
      severity: critical
      component: system
    annotations:
      summary: "Disk nearly full"
      description: "Disk usage is {{ $value | humanizePercentage }} on {{ $labels.instance }}"
```

### Grafana Dashboards

#### Main Dashboard Configuration
```json
{
  "dashboard": {
    "id": null,
    "title": "AutoWeave Sprint 1 - Production Dashboard",
    "tags": ["autoweave", "sprint1", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "panels": [
      {
        "id": 1,
        "title": "System Overview",
        "type": "stat",
        "gridPos": {"h": 6, "w": 24, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "up{job=\"autoweave-sprint1\"}",
            "legendFormat": "Service Status"
          },
          {
            "expr": "autoweave_usb_devices_connected",
            "legendFormat": "Connected USB Devices"
          },
          {
            "expr": "autoweave_plugins_active",
            "legendFormat": "Active Plugins"
          },
          {
            "expr": "autoweave_security_violations_total",
            "legendFormat": "Security Violations"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {"mode": "palette-classic"},
            "custom": {"displayMode": "basic"},
            "mappings": [],
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 0.8},
                {"color": "red", "value": 0.9}
              ]
            },
            "unit": "short"
          }
        }
      },
      {
        "id": 2,
        "title": "USB Event Processing",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 6},
        "targets": [
          {
            "expr": "rate(autoweave_usb_events_total[5m])",
            "legendFormat": "Events/sec - {{type}}"
          },
          {
            "expr": "histogram_quantile(0.95, autoweave_usb_event_latency_ms_bucket)",
            "legendFormat": "95th Percentile Latency"
          }
        ],
        "yAxes": [
          {
            "label": "Events/sec",
            "min": 0
          },
          {
            "label": "Latency (ms)",
            "min": 0,
            "max": 200
          }
        ],
        "alert": {
          "conditions": [
            {
              "evaluator": {"params": [150], "type": "gt"},
              "operator": {"type": "and"},
              "query": {"params": ["B", "5m", "now"]},
              "reducer": {"params": [], "type": "avg"},
              "type": "query"
            }
          ],
          "executionErrorState": "alerting",
          "for": "2m",
          "frequency": "10s",
          "handler": 1,
          "name": "High USB Latency",
          "noDataState": "no_data"
        }
      },
      {
        "id": 3,
        "title": "Plugin Performance",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 6},
        "targets": [
          {
            "expr": "autoweave_plugin_load_duration_ms_avg",
            "legendFormat": "Avg Load Time"
          },
          {
            "expr": "histogram_quantile(0.95, autoweave_plugin_load_duration_ms_bucket)",
            "legendFormat": "95th Percentile"
          }
        ]
      },
      {
        "id": 4,
        "title": "Memory Usage",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 14},
        "targets": [
          {
            "expr": "autoweave_memory_usage_bytes",
            "legendFormat": "Memory Usage"
          },
          {
            "expr": "autoweave_memory_limit_bytes",
            "legendFormat": "Memory Limit"
          }
        ],
        "yAxes": [
          {
            "label": "Bytes",
            "min": 0
          }
        ]
      },
      {
        "id": 5,
        "title": "Security Metrics",
        "type": "graph",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 14},
        "targets": [
          {
            "expr": "rate(autoweave_security_violations_total[5m])",
            "legendFormat": "Violations/sec"
          },
          {
            "expr": "autoweave_plugins_blocked_total",
            "legendFormat": "Blocked Plugins"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation

#### Structured Logging Configuration
```yaml
# monitoring/fluentd.conf
<source>
  @type tail
  path /app/logs/*.log
  pos_file /var/log/td-agent/autoweave.log.pos
  tag autoweave.*
  format json
  time_key timestamp
  time_format %Y-%m-%dT%H:%M:%S.%LZ
</source>

<filter autoweave.**>
  @type record_transformer
  <record>
    hostname "#{Socket.gethostname}"
    service_name autoweave-sprint1
    environment production
  </record>
</filter>

<match autoweave.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name autoweave-logs
  type_name _doc
  
  <buffer>
    @type file
    path /var/log/td-agent/buffer/autoweave
    flush_mode interval
    flush_interval 10s
    chunk_limit_size 1m
    queue_limit_length 32
    retry_max_interval 30
    retry_forever true
  </buffer>
</match>
```

## 🔧 Performance Tuning

### System-Level Optimization

#### Kernel Parameters
```bash
# /etc/sysctl.d/99-autoweave.conf
# Network optimization
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 65536 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.netdev_max_backlog = 5000

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# File system
fs.file-max = 1000000
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 256

# USB subsystem
usbcore.usbfs_memory_mb = 256
```

#### USB System Optimization
```bash
# /etc/udev/rules.d/99-autoweave-performance.rules
# Increase USB buffer sizes
ACTION=="add", SUBSYSTEM=="usb", ATTR{bMaxPower}=="*", ATTR{../../../power/control}="on"

# Optimize USB device detection
ACTION=="add", SUBSYSTEM=="usb", RUN+="/bin/echo 0 > /sys$devpath/power/autosuspend_delay_ms"
ACTION=="add", SUBSYSTEM=="usb", RUN+="/bin/echo on > /sys$devpath/power/control"

# Set USB performance governor
ACTION=="add", SUBSYSTEM=="usb", RUN+="/bin/echo performance > /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor"
```

### Application-Level Optimization

#### Node.js Runtime Tuning
```bash
# Production environment variables
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=128"
UV_THREADPOOL_SIZE=16

# V8 optimization flags
NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size --gc-interval=100"

# Event loop monitoring
NODE_OPTIONS="$NODE_OPTIONS --trace-event-categories=node.async_hooks"
```

#### AutoWeave Configuration Tuning
```javascript
// config/production-performance.js
module.exports = {
  usb: {
    // Aggressive event processing
    debounce_ms: 10,           // Reduced from 50ms
    batch_size: 50,            // Increased from 10
    event_buffer_size: 5000,   // Increased from 2000
    max_events_per_second: 500, // Increased from 100
    
    // Connection pooling
    redis_pool_size: 20,
    redis_max_retries: 5,
    redis_retry_delay: 100,
    
    // Performance monitoring
    enable_perf_hooks: true,
    perf_sample_rate: 0.1,
    enable_gc_monitoring: true
  },
  
  plugins: {
    // Worker pool optimization
    min_workers: 8,            // Increased from 4
    max_workers: 32,           // Increased from 16
    worker_recycle_ops: 200,   // Increased from 100
    worker_idle_timeout: 30000, // 30 seconds
    
    // Caching optimization
    manifest_cache_size: 500,  // Increased from 200
    permission_cache_size: 1000,
    cache_ttl: 3600,          // 1 hour
    
    // Loading optimization
    parallel_loads: 8,         // Concurrent plugin loads
    preload_common: true,      // Preload frequently used plugins
    lazy_validation: true      // Defer non-critical validation
  },
  
  security: {
    // Monitoring optimization
    event_buffer_size: 10000,
    anomaly_window_ms: 60000,  // 1 minute
    threat_score_cache: 5000,
    
    // Resource monitoring
    resource_check_interval: 1000, // 1 second
    memory_check_threshold: 0.8,   // 80%
    cpu_check_threshold: 0.7       // 70%
  },
  
  memory: {
    // Object pooling
    enable_object_pools: true,
    pool_sizes: {
      device_info: 200,        // Increased from 100
      events: 1000,            // Increased from 500
      buffers: 100,            // Increased from 50
      messages: 500            // New pool
    },
    
    // Garbage collection
    gc_threshold: 0.85,        // 85% heap usage
    force_gc_interval: 30000,  // 30 seconds
    heap_snapshot_threshold: 0.95
  }
};
```

### Redis Optimization

#### Redis Configuration
```bash
# /etc/redis/redis.conf
# Memory optimization
maxmemory 4gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Persistence optimization for performance
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes

# Network optimization
tcp-keepalive 300
tcp-backlog 511
timeout 0

# Performance settings
hz 10
dynamic-hz yes

# Streams optimization
stream-node-max-bytes 4096
stream-node-max-entries 100

# Client optimization
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60
```

## 🔒 Security Hardening

### System Security

#### Firewall Configuration
```bash
# UFW (Ubuntu Firewall) rules
# Allow SSH (restrict to management IPs)
ufw allow from 10.0.0.0/8 to any port 22

# Allow HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow AutoWeave API
ufw allow 3000/tcp

# Allow health checks
ufw allow 8080/tcp

# Allow monitoring
ufw allow from 10.0.0.0/8 to any port 9090  # Prometheus
ufw allow from 10.0.0.0/8 to any port 3001  # Grafana

# Redis (internal only)
ufw allow from 10.0.0.0/8 to any port 6379

# Enable firewall
ufw enable
```

#### SELinux/AppArmor Configuration
```bash
# AppArmor profile for AutoWeave
# /etc/apparmor.d/autoweave
#include <tunables/global>

/usr/local/bin/autoweave {
  #include <abstractions/base>
  #include <abstractions/nameservice>
  #include <abstractions/user-tmp>

  # Network access
  network inet stream,
  network inet dgram,
  network unix stream,

  # File system access
  /app/** r,
  /app/logs/** rw,
  /app/.sandbox/** rw,
  /app/plugins/** r,
  
  # USB device access
  /dev/bus/usb/** rw,
  /sys/bus/usb/** r,
  /run/udev/** r,
  
  # System libraries
  /lib/x86_64-linux-gnu/** mr,
  /usr/lib/x86_64-linux-gnu/** mr,
  
  # Node.js runtime
  /usr/bin/node ix,
  /usr/lib/node_modules/** r,
  
  # Redis access
  tcp connect inet to port 6379,
  
  # Deny dangerous capabilities
  deny capability dac_override,
  deny capability dac_read_search,
  deny capability fowner,
  deny capability fsetid,
  deny capability kill,
  deny capability setgid,
  deny capability setuid,
  deny capability sys_admin,
  deny capability sys_chroot,
  deny capability sys_ptrace,
}
```

### Application Security

#### TLS Configuration
```nginx
# /etc/nginx/sites-available/autoweave
server {
    listen 443 ssl http2;
    server_name autoweave.yourdomain.com;
    
    # TLS configuration
    ssl_certificate /etc/ssl/certs/autoweave.crt;
    ssl_certificate_key /etc/ssl/private/autoweave.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # Modern configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:8080/health;
        access_log off;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name autoweave.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Container Security

#### Security Scanning
```bash
# Dockerfile security scanning
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v $PWD:/root/.cache/ anchore/grype:latest autoweave:latest

# Container runtime security
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v $PWD:/tmp anchore/syft:latest autoweave:latest -o json

# Kubernetes security scanning
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: security-scan
spec:
  template:
    spec:
      containers:
      - name: trivy
        image: aquasec/trivy:latest
        command: ['trivy']
        args: ['image', '--exit-code', '1', '--severity', 'HIGH,CRITICAL', 'autoweave:latest']
      restartPolicy: Never
EOF
```

## 🔄 Backup and Recovery

### Data Backup Strategy

#### Redis Backup
```bash
#!/bin/bash
# scripts/backup-redis.sh

BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup Redis data
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE

# Wait for backup to complete
while [ $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE) -eq $(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LASTSAVE) ]; do
  sleep 1
done

# Copy dump file
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/dump_$DATE.rdb"

# Backup Redis streams
redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$BACKUP_DIR/streams_$DATE.rdb"

# Compress backup
gzip "$BACKUP_DIR/dump_$DATE.rdb"
gzip "$BACKUP_DIR/streams_$DATE.rdb"

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete

echo "Redis backup completed: $DATE"
```

#### Configuration Backup
```bash
#!/bin/bash
# scripts/backup-config.sh

BACKUP_DIR="/backups/config"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup application configuration
tar czf "$BACKUP_DIR/config_$DATE.tar.gz" \
  config/ \
  .env.production \
  monitoring/ \
  k8s/ \
  scripts/

# Backup plugin manifests
tar czf "$BACKUP_DIR/plugins_$DATE.tar.gz" plugins/

# Backup logs (last 7 days)
find logs/ -name "*.log" -mtime -7 | tar czf "$BACKUP_DIR/logs_$DATE.tar.gz" -T -

# Cleanup old backups
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +90 -delete

echo "Configuration backup completed: $DATE"
```

### Recovery Procedures

#### Service Recovery
```bash
#!/bin/bash
# scripts/recover-service.sh

SERVICE_NAME="autoweave"
BACKUP_DATE="$1"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Example: $0 20250714_103000"
    exit 1
fi

echo "Starting recovery procedure for $SERVICE_NAME..."

# 1. Stop service
systemctl stop "$SERVICE_NAME"

# 2. Restore Redis data
systemctl stop redis
cp "/backups/redis/dump_$BACKUP_DATE.rdb.gz" /tmp/
gunzip "/tmp/dump_$BACKUP_DATE.rdb.gz"
cp "/tmp/dump_$BACKUP_DATE.rdb" /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl start redis

# 3. Restore configuration
tar xzf "/backups/config/config_$BACKUP_DATE.tar.gz" -C /

# 4. Restore plugins
tar xzf "/backups/config/plugins_$BACKUP_DATE.tar.gz" -C /

# 5. Restart service
systemctl start "$SERVICE_NAME"

# 6. Verify recovery
sleep 10
curl -f http://localhost:8080/health

if [ $? -eq 0 ]; then
    echo "Recovery completed successfully"
else
    echo "Recovery failed - check logs"
    exit 1
fi
```

#### Disaster Recovery
```bash
#!/bin/bash
# scripts/disaster-recovery.sh

# Full system recovery procedure
echo "Starting disaster recovery..."

# 1. Restore from latest backup
LATEST_BACKUP=$(ls -t /backups/config/config_*.tar.gz | head -1)
BACKUP_DATE=$(basename "$LATEST_BACKUP" .tar.gz | cut -d'_' -f2-)

echo "Using backup: $BACKUP_DATE"

# 2. Restore infrastructure
kubectl apply -f k8s/

# 3. Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=autoweave --timeout=300s

# 4. Restore data
./scripts/recover-service.sh "$BACKUP_DATE"

# 5. Validate system
./scripts/health-check.sh

echo "Disaster recovery completed"
```

This comprehensive operations guide provides all the necessary tools and procedures for successfully deploying, monitoring, securing, and maintaining AutoWeave Sprint 1 in production environments.