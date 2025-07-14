# AutoWeave Sprint Specifications - Architecture 6 Sprints

## 🎯 Sprint 0: RFC & Validation OSS (≤ 1 semaine)

### Duration: 1 semaine maximum

### Objectif: Gel des exigences techniques et validation juridique OSS

#### 📋 Livrables Critiques

##### 1. RFC-001 "Plugin Manifest & Hot-Swap"

```json
{
  "$schema": "https://autoweave.dev/schemas/plugin-v1.json",
  "name": "sample-plugin",
  "version": "1.0.0",
  "description": "Plugin example pour AutoWeave hot-plug",
  "entry": "./dist/index.js",
  "autoweave": {
    "minVersion": "2.0.0",
    "maxVersion": "3.0.0"
  },
  "permissions": [
    "memory:read",
    "memory:write",
    "llm:access",
    "queue:publish",
    "fs:read:/plugins"
  ],
  "hooks": {
    "onLoad": "./dist/hooks/onLoad.js",
    "onUnload": "./dist/hooks/onUnload.js",
    "onError": "./dist/hooks/onError.js"
  },
  "dependencies": {
    "external": ["axios@^1.6.0", "lodash@^4.17.0"],
    "autoweave": ["@autoweave/memory@^2.0.0"]
  },
  "isolation": {
    "workerThread": true,
    "memoryLimit": "256MB",
    "cpuLimit": "50%"
  },
  "signature": {
    "algorithm": "SHA-256",
    "hash": "abc123...",
    "publicKey": "-----BEGIN PUBLIC KEY-----..."
  }
}
```

##### 2. Audit Juridique OSS

**Dépendances à auditer:**

```yaml
# Licences à valider
dependencies:
  - node-usb: MIT ✅
  - libusb: LGPL-2.1 ⚠️ (vérifier compatibilité commerciale)
  - bullmq: MIT ✅
  - @opentelemetry/*: Apache-2.0 ✅
  - grafana/tempo: AGPLv3 ⚠️ (deployment only)
  - grafana/loki: AGPLv3 ⚠️ (deployment only)
  - apollo-server: MIT ✅
  - next.js: MIT ✅
  - radix-ui: MIT ✅
  - react-flow: MIT ✅
```

##### 3. Décisions Architecturales Figées

**USB Daemon Implementation:**

```typescript
// Decision: Node.js + node-usb (vs Go + libusb)
interface USBDaemonConfig {
  hotplugChannel: 'aw:hotplug';
  pluginDirectory: './plugins';
  maxPlugins: 50;
  isolationMode: 'worker-thread';
}
```

#### 🎯 Critères d'Acceptation Sprint 0

- [ ] RFC-001 approuvé par équipe technique
- [ ] Aucune dépendance OSS bloquante identifiée
- [ ] Architecture USB daemon finalisée (Node vs Go)
- [ ] Schema plugin manifest validé avec AJV
- [ ] Process de signature SHA-256 défini

---

## 🔧 Sprint 1: Daemon USB & Plugin Loader (2 semaines)

### Duration: 2 semaines

### Objectif: Infrastructure hot-plug et gestionnaire de plugins

#### 📋 Livrables Techniques

##### 1. USB Daemon Implementation

**package: @autoweave/usb-daemon**

```typescript
// packages/usb-daemon/src/usb-hotplug.ts
import usb from 'usb';
import { EventEmitter } from 'events';
import { RedisClientType } from 'redis';

export class USBHotplugDaemon extends EventEmitter {
  private redis: RedisClientType;
  private devices: Map<string, usb.Device> = new Map();

  constructor(redisClient: RedisClientType) {
    super();
    this.redis = redisClient;
    this.setupHotplugCallbacks();
  }

  private setupHotplugCallbacks(): void {
    usb.on('attach', this.handleDeviceAttach.bind(this));
    usb.on('detach', this.handleDeviceDetach.bind(this));
  }

  private async handleDeviceAttach(device: usb.Device): Promise<void> {
    const deviceInfo = this.extractDeviceInfo(device);

    // Publish to Redis Streams
    await this.redis.xAdd('aw:hotplug', '*', {
      event: 'device.attached',
      deviceId: deviceInfo.id,
      vendor: deviceInfo.vendor,
      product: deviceInfo.product,
      timestamp: Date.now().toString(),
    });

    this.emit('device:attached', deviceInfo);
  }

  private async handleDeviceDetach(device: usb.Device): Promise<void> {
    // Similar implementation for detach
  }
}
```

##### 2. Plugin Loader with Worker Thread Isolation

**package: @autoweave/plugin-loader**

```typescript
// packages/plugin-loader/src/plugin-hub.ts
import chokidar from 'chokidar';
import { Worker } from 'worker_threads';
import Ajv from 'ajv';
import crypto from 'crypto';

export interface PluginManifest {
  name: string;
  version: string;
  entry: string;
  permissions: string[];
  hooks: {
    onLoad?: string;
    onUnload?: string;
    onError?: string;
  };
  isolation: {
    workerThread: boolean;
    memoryLimit: string;
    cpuLimit: string;
  };
  signature: {
    algorithm: 'SHA-256';
    hash: string;
    publicKey: string;
  };
}

export class PluginHub {
  private plugins: Map<string, PluginInstance> = new Map();
  private watcher: chokidar.FSWatcher;
  private ajv = new Ajv();
  private manifestSchema: object;

  async loadPlugin(manifestPath: string): Promise<PluginInstance> {
    // 1. Validate manifest with AJV
    const manifest = await this.validateManifest(manifestPath);

    // 2. Verify SHA-256 signature
    await this.verifySignature(manifest);

    // 3. Create isolated Worker Thread
    const worker = new Worker('./plugin-worker.js', {
      workerData: { manifest, pluginPath: manifestPath },
    });

    // 4. Setup worker lifecycle
    const instance = new PluginInstance(manifest, worker);
    this.plugins.set(manifest.name, instance);

    // 5. Execute onLoad hook
    await instance.executeHook('onLoad');

    return instance;
  }

  private async validateManifest(path: string): Promise<PluginManifest> {
    const manifest = JSON.parse(await fs.readFile(path, 'utf8'));
    const valid = this.ajv.validate(this.manifestSchema, manifest);

    if (!valid) {
      throw new Error(`Invalid manifest: ${this.ajv.errorsText()}`);
    }

    return manifest;
  }

  private async verifySignature(manifest: PluginManifest): Promise<void> {
    const { signature } = manifest;
    const manifestContent = JSON.stringify(omit(manifest, 'signature'));

    const verify = crypto.createVerify('sha256');
    verify.update(manifestContent);

    const isValid = verify.verify(signature.publicKey, signature.hash, 'hex');
    if (!isValid) {
      throw new Error('Plugin signature verification failed');
    }
  }
}
```

##### 3. Plugin Worker Thread

**worker: plugin-worker.js**

```typescript
// packages/plugin-loader/src/plugin-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { PluginManifest } from './types';

class PluginWorker {
  private manifest: PluginManifest;
  private pluginModule: any;

  constructor(manifest: PluginManifest) {
    this.manifest = manifest;
    this.setupResourceLimits();
  }

  private setupResourceLimits(): void {
    // Memory limit enforcement
    const memLimit = this.parseMemoryLimit(this.manifest.isolation.memoryLimit);
    process.setMaxListeners(memLimit);

    // CPU limit monitoring
    const cpuLimit = parseFloat(
      this.manifest.isolation.cpuLimit.replace('%', ''),
    );
    this.monitorCPUUsage(cpuLimit);
  }

  async loadPlugin(): Promise<void> {
    try {
      // Dynamic import with ES2020
      this.pluginModule = await import(this.manifest.entry);

      // Execute onLoad hook if present
      if (this.manifest.hooks.onLoad && this.pluginModule.onLoad) {
        await this.pluginModule.onLoad();
      }

      parentPort?.postMessage({ type: 'loaded', success: true });
    } catch (error) {
      parentPort?.postMessage({ type: 'error', error: error.message });
    }
  }
}

// Initialize worker
const worker = new PluginWorker(workerData.manifest);
worker.loadPlugin();
```

##### 4. Performance Testing Suite

**test: load-test.spec.ts**

```typescript
// tests/performance/plugin-load-test.spec.ts
import { PluginHub } from '@autoweave/plugin-loader';
import { performance } from 'perf_hooks';

describe('Plugin Load Performance', () => {
  let pluginHub: PluginHub;

  beforeEach(() => {
    pluginHub = new PluginHub();
  });

  it('should load plugin in under 250ms', async () => {
    const start = performance.now();

    await pluginHub.loadPlugin(
      './test-plugins/simple-plugin/autoweave.plugin.json',
    );

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(250);
  });

  it('should handle 1000 plug/unplug cycles without memory leak', async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      const instance = await pluginHub.loadPlugin(
        './test-plugins/simple-plugin/autoweave.plugin.json',
      );
      await pluginHub.unloadPlugin(instance.id);
    }

    // Force garbage collection
    global.gc?.();

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Should not increase by more than 1MB
    expect(memoryIncrease).toBeLessThan(1024 * 1024);
  });
});
```

#### 🎯 Critères d'Acceptation Sprint 1

- [ ] USB daemon détecte attach/detach events via node-usb
- [ ] Events publiés sur Redis Streams channel `aw:hotplug`
- [ ] Plugin loader surveille `plugins/` directory via Chokidar
- [ ] Validation AJV + SHA-256 signature fonctionne
- [ ] Worker Thread isolation effective (mémoire + CPU)
- [ ] Plugin load time <250ms mesuré
- [ ] 1000 cycles plug/unplug sans fuite mémoire >1MB
- [ ] Fallback udev rules documenté pour permissions kernel

---

## ⚡ Sprint 2: Queue & Workers BullMQ (2 semaines)

### Duration: 2 semaines

### Objectif: Système de queue asynchrone et workers distribuée

#### 📋 Livrables BullMQ

##### 1. Job Queue Abstraction

**package: @autoweave/job-queue**

```typescript
// packages/job-queue/src/job-manager.ts
import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';

export type JobType =
  | 'agent.create'
  | 'memory.vectorize'
  | 'llm.batch'
  | 'plugin.load'
  | 'system.cleanup';

export interface JobConfig {
  type: JobType;
  data: unknown;
  options?: {
    priority?: number;
    delay?: number;
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed';
      delay: number;
    };
  };
}

export class AutoWeaveJobManager {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private redis: Redis;

  constructor(redisConfig: object) {
    this.redis = new Redis(redisConfig);
  }

  async createQueue(name: string): Promise<Queue> {
    const queue = new Queue(name, { connection: this.redis });
    this.queues.set(name, queue);
    return queue;
  }

  async addJob(queueName: string, config: JobConfig): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    return queue.add(config.type, config.data, config.options);
  }

  async createWorker(
    queueName: string,
    processor: JobProcessor,
  ): Promise<Worker> {
    const worker = new Worker(
      queueName,
      async (job) => {
        // Emit OTEL trace
        const span = tracer.startSpan(`job.${job.name}`);

        try {
          const result = await processor(job);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
      { connection: this.redis },
    );

    this.workers.set(queueName, worker);
    return worker;
  }
}
```

##### 2. Plugin Worker Générique

**worker: plugin-worker.ts**

```typescript
// packages/job-queue/src/workers/plugin-worker.ts
import { Job } from 'bullmq';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('autoweave-plugin-worker');

export async function processPluginJob(job: Job): Promise<any> {
  const span = tracer.startSpan(`plugin.${job.name}`, {
    attributes: {
      'plugin.type': job.name,
      'plugin.id': job.data.pluginId,
      'job.id': job.id,
    },
  });

  try {
    switch (job.name) {
      case 'plugin.load':
        return await loadPlugin(job.data);

      case 'plugin.unload':
        return await unloadPlugin(job.data);

      case 'agent.create':
        return await createAgent(job.data);

      case 'memory.vectorize':
        return await vectorizeMemory(job.data);

      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  } catch (error) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    throw error;
  } finally {
    span.end();
  }
}

async function loadPlugin(data: any): Promise<any> {
  // Plugin loading logic with OpenTelemetry tracing
}
```

##### 3. Dashboard BullMQ Intégré

**UI: Admin Dashboard**

```typescript
// apps/admin/src/app/queue/page.tsx
import { BullMQDashboard } from '@/components/BullMQDashboard';

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Queue Management</h1>
      </div>

      {/* Embedded BullMQ Dashboard via iframe */}
      <div className="rounded-lg border">
        <iframe
          src="/api/bullmq-board"
          className="w-full h-96 rounded-lg"
          title="BullMQ Dashboard"
        />
      </div>

      {/* Custom metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <QueueMetricCard title="Jobs/min" value="127" />
        <QueueMetricCard title="Success Rate" value="99.2%" />
        <QueueMetricCard title="Avg Processing" value="1.8s" />
      </div>
    </div>
  );
}
```

##### 4. Flow & Repeatable Jobs

```typescript
// packages/job-queue/src/flow-manager.ts
import { FlowProducer } from 'bullmq';

export class AutoWeaveFlowManager {
  private flowProducer: FlowProducer;

  async createAgentWorkflow(agentConfig: any): Promise<string> {
    const flow = {
      name: 'create-agent-flow',
      queueName: 'agents',
      children: [
        {
          name: 'validate-config',
          data: agentConfig,
          queueName: 'validation',
        },
        {
          name: 'create-memory',
          data: { agentId: agentConfig.id },
          queueName: 'memory',
        },
        {
          name: 'deploy-agent',
          data: { agentId: agentConfig.id },
          queueName: 'deployment',
        },
      ],
    };

    const job = await this.flowProducer.add(flow);
    return job.id;
  }
}
```

#### 🎯 Critères d'Acceptation Sprint 2

- [ ] BullMQ queues configurées pour 5 job types
- [ ] Worker générique avec OpenTelemetry traces
- [ ] Dashboard BullMQ intégré dans Admin UI
- [ ] Flow multi-étapes fonctionnel pour agents
- [ ] Retry/error handling avec backoff exponential
- [ ] Performance >100 jobs/minute sustained
- [ ] Graceful shutdown workers <5 secondes

---

## 🌐 Sprint 3: GraphQL Gateway & Auth RBAC (2 semaines)

### Duration: 2 semaines

### Objectif: Super-graph unifié avec authentification enterprise

#### 📋 Livrables Apollo Federation

##### 1. Apollo Gateway Setup

**package: @autoweave/graphql-gateway**

```typescript
// packages/graphql-gateway/src/gateway.ts
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from 'apollo-server-express';
import { expressMiddleware } from '@apollo/server/express4';

export class AutoWeaveGateway {
  private gateway: ApolloGateway;
  private server: ApolloServer;

  constructor() {
    this.gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          { name: 'agents', url: 'http://localhost:4001/graphql' },
          { name: 'memory', url: 'http://localhost:4002/graphql' },
          { name: 'queue', url: 'http://localhost:4003/graphql' },
          { name: 'plugins', url: 'http://localhost:4004/graphql' },
          { name: 'observability', url: 'http://localhost:4005/graphql' },
        ],
      }),
    });
  }

  async startServer(): Promise<void> {
    this.server = new ApolloServer({
      gateway: this.gateway,
      context: async ({ req }) => {
        // Extract JWT and create context
        const token = req.headers.authorization?.replace('Bearer ', '');
        const user = await this.verifyJWT(token);

        return {
          user,
          tenantId: user.tenantId,
          roles: user.roles,
          permissions: user.permissions,
        };
      },
    });

    await this.server.start();
  }
}
```

##### 2. JWT Middleware + RBAC

```typescript
// packages/graphql-gateway/src/auth.ts
import jwt from 'jsonwebtoken';
import { AuthenticationError, ForbiddenError } from 'apollo-server-express';

export interface UserContext {
  id: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

export class AuthMiddleware {
  async verifyJWT(token: string): Promise<UserContext> {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;

      return {
        id: payload.sub,
        tenantId: payload.tenantId,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }

  requirePermission(permission: string) {
    return (resolver: Function) => {
      return async (parent: any, args: any, context: any, info: any) => {
        if (!context.permissions.includes(permission)) {
          throw new ForbiddenError(`Missing permission: ${permission}`);
        }

        return resolver(parent, args, context, info);
      };
    };
  }

  requireRole(role: string) {
    return (resolver: Function) => {
      return async (parent: any, args: any, context: any, info: any) => {
        if (!context.roles.includes(role)) {
          throw new ForbiddenError(`Missing role: ${role}`);
        }

        return resolver(parent, args, context, info);
      };
    };
  }
}
```

##### 3. Rate Limiting per Tenant

```typescript
// packages/graphql-gateway/src/rate-limiter.ts
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { UserInputError } from 'apollo-server-express';

export class TenantRateLimiter {
  private limiter: RateLimiterRedis;

  constructor(redisClient: any) {
    this.limiter = new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: 'autoweave_rl',
      points: 100, // Number of requests
      duration: 60, // Per 60 seconds by tenant
    });
  }

  async checkLimit(tenantId: string): Promise<void> {
    try {
      await this.limiter.consume(tenantId);
    } catch (rateLimiterRes) {
      const remainingPoints = rateLimiterRes.remainingPoints;
      const msBeforeNext = rateLimiterRes.msBeforeNext;

      throw new UserInputError('Rate limit exceeded', {
        remainingPoints,
        msBeforeNext,
      });
    }
  }
}
```

##### 4. Subgraph Schemas

**Agent Subgraph:**

```graphql
# packages/agents/src/schema.graphql
type Agent @key(fields: "id") {
  id: ID!
  name: String!
  description: String
  status: AgentStatus!
  tenantId: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  workflow: Workflow
  memory: Memory @requires(fields: "id")
}

enum AgentStatus {
  DRAFT
  DEPLOYED
  RUNNING
  STOPPED
  ERROR
}

type Query {
  agents(tenantId: String!): [Agent!]!
    @requirePermission(permission: "agents:read")
  agent(id: ID!): Agent @requirePermission(permission: "agents:read")
}

type Mutation {
  createAgent(input: CreateAgentInput!): Agent!
    @requirePermission(permission: "agents:create")
  deployAgent(id: ID!): Agent! @requirePermission(permission: "agents:deploy")
  stopAgent(id: ID!): Agent! @requirePermission(permission: "agents:control")
}

type Subscription {
  agentStatusChanged(tenantId: String!): Agent!
    @requirePermission(permission: "agents:read")
}
```

#### 🎯 Critères d'Acceptation Sprint 3

- [ ] Apollo Gateway fédère 5 subgraphs
- [ ] JWT authentication + RBAC fonctionnel
- [ ] Rate limiting 100 req/min/tenant effectif
- [ ] Context propagation sécurisé vers resolvers
- [ ] Subscriptions temps réel fonctionnelles
- [ ] Performance <200ms P95 latency
- [ ] Schema introspection et playground actifs

---

## 📊 Sprint 4: Observabilité Tempo/Loki (2 semaines)

### Duration: 2 semaines

### Objectif: Instrumentation complète et stack de monitoring

#### 📋 Livrables OpenTelemetry

##### 1. Instrumentation Express + BullMQ + Redis

**package: @autoweave/observability**

```typescript
// packages/observability/src/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

export function initTelemetry(serviceName: string, version: string): NodeSDK {
  const traceExporter = new OTLPTraceExporter({
    url: 'http://tempo:4318/v1/traces',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const sdk = new NodeSDK({
    serviceName,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: version,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        process.env.NODE_ENV || 'development',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
  return sdk;
}

// Custom instrumentation for BullMQ
export function instrumentBullMQ(): void {
  const { trace } = require('@opentelemetry/api');
  const tracer = trace.getTracer('bullmq');

  // Patch Job processing
  const originalProcess = require('bullmq').Worker.prototype.process;
  require('bullmq').Worker.prototype.process = function (job: any) {
    const span = tracer.startSpan(`bullmq.job.${job.name}`, {
      attributes: {
        'job.id': job.id,
        'job.name': job.name,
        'queue.name': this.name,
        'tenant.id': job.data.tenantId,
      },
    });

    return originalProcess.call(this, job).finally(() => span.end());
  };
}
```

##### 2. Helm Chart Stack Grafana

**chart: helm/observability-stack**

```yaml
# helm/observability-stack/values.yaml
tempo:
  enabled: true
  image:
    tag: '2.3.0'
  config:
    multitenancy_enabled: true
    server:
      http_listen_port: 3200
    distributor:
      receivers:
        otlp:
          protocols:
            http:
              endpoint: '0.0.0.0:4318'
            grpc:
              endpoint: '0.0.0.0:4317'

loki:
  enabled: true
  image:
    tag: '2.9.0'
  config:
    auth_enabled: true
    server:
      http_listen_port: 3100
    ingester:
      lifecycler:
        ring:
          kvstore:
            store: memberlist

grafana:
  enabled: true
  adminPassword: 'admin'
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Tempo
          type: tempo
          url: http://tempo:3200
          access: proxy
        - name: Loki
          type: loki
          url: http://loki:3100
          access: proxy
```

##### 3. Labels Structurés tenant/plugin/jobId

```typescript
// packages/observability/src/labels.ts
export interface AutoWeaveLabels {
  tenant: string;
  plugin?: string;
  jobId?: string;
  service: string;
  environment: string;
}

export function createSpanWithLabels(
  tracer: any,
  operationName: string,
  labels: AutoWeaveLabels,
) {
  return tracer.startSpan(operationName, {
    attributes: {
      'autoweave.tenant.id': labels.tenant,
      'autoweave.plugin.name': labels.plugin,
      'autoweave.job.id': labels.jobId,
      'autoweave.service': labels.service,
      'autoweave.environment': labels.environment,
    },
  });
}

// Winston logger with Loki transport
export function createStructuredLogger(labels: AutoWeaveLabels) {
  return winston.createLogger({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    defaultMeta: {
      tenant: labels.tenant,
      plugin: labels.plugin,
      service: labels.service,
    },
    transports: [
      new LokiTransport({
        host: 'http://loki:3100',
        labels: labels,
        json: true,
      }),
    ],
  });
}
```

##### 4. Admin UI Dashboard Tempo Réel

```typescript
// apps/admin/src/app/observability/page.tsx
import { GrafanaIframe } from '@/components/GrafanaIframe';
import { MetricsCard } from '@/components/MetricsCard';

export default function ObservabilityPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricsCard
          title="Request Latency P95"
          value="127ms"
          trend="+2.3%"
        />
        <MetricsCard
          title="Error Rate"
          value="0.12%"
          trend="-0.8%"
        />
        <MetricsCard
          title="Active Plugins"
          value="23"
          trend="+3"
        />
        <MetricsCard
          title="Job Throughput"
          value="450/min"
          trend="+12%"
        />
      </div>

      {/* Embedded Grafana Dashboard */}
      <div className="rounded-lg border">
        <GrafanaIframe
          dashboardId="autoweave-overview"
          panelId="1"
          timeRange="now-1h"
          className="w-full h-96"
        />
      </div>

      {/* Drill-down to specific traces */}
      <div className="grid gap-4 md:grid-cols-2">
        <TraceExplorer />
        <LogExplorer />
      </div>
    </div>
  );
}
```

#### 🎯 Critères d'Acceptation Sprint 4

- [ ] OpenTelemetry SDK instrumenté sur tous services
- [ ] Traces OTLP/HTTP exportées vers Tempo
- [ ] Logs structurés envoyés vers Loki
- [ ] Labels tenant/plugin/jobId appliqués partout
- [ ] Helm chart deploie stack Tempo+Loki+Grafana
- [ ] Admin UI dashboard temps réel fonctionnel
- [ ] Drill-down iframe Grafana intégré
- [ ] Performance bottlenecks visibles dans traces

---

## 🎨 Sprint 5: 3 Front-ends Next.js 15 (2 semaines)

### Duration: 2 semaines

### Objectif: Applications utilisateur avec design system unifié

#### 📋 Livrables Applications Next.js 15

##### 1. Admin UI - Next.js 15 App Router

**app: apps/admin**

```typescript
// apps/admin/src/app/layout.tsx
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

// apps/admin/src/app/health/page.tsx
export default function HealthPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">System Health</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthCard service="API Gateway" status="healthy" />
        <HealthCard service="USB Daemon" status="healthy" />
        <HealthCard service="BullMQ" status="warning" />
        <HealthCard service="Redis" status="healthy" />
      </div>

      <SystemMetrics />
    </div>
  );
}

// apps/admin/src/app/plugins/page.tsx
export default function PluginsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Plugin Management</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Install Plugin
        </Button>
      </div>

      <PluginTable />
    </div>
  );
}
```

##### 2. Dev Studio - React Flow Builder

**app: apps/studio**

```typescript
// apps/studio/src/app/builder/page.tsx
import { AgentFlowBuilder } from '@/components/agent-flow-builder';
import { ToolboxPanel } from '@/components/toolbox-panel';
import { PropertiesPanel } from '@/components/properties-panel';

export default function BuilderPage() {
  return (
    <div className="h-screen flex">
      <ToolboxPanel className="w-64 border-r" />

      <div className="flex-1 relative">
        <AgentFlowBuilder />
      </div>

      <PropertiesPanel className="w-80 border-l" />
    </div>
  );
}

// apps/studio/src/components/agent-flow-builder.tsx
'use client';

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';

const nodeTypes = {
  llmNode: LLMNode,
  memoryNode: MemoryNode,
  toolNode: ToolNode,
  conditionNode: ConditionNode
};

export function AgentFlowBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

##### 3. User UI - Chat Interface

**app: apps/user**

```typescript
// apps/user/src/app/page.tsx
import { AgentsList } from '@/components/agents-list';
import { ChatInterface } from '@/components/chat-interface';

export default function HomePage() {
  return (
    <div className="h-screen flex">
      {/* Left Panel - Active Agents */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Active Agents</h2>
        </div>
        <AgentsList />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatInterface />
      </div>
    </div>
  );
}

// apps/user/src/components/chat-interface.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="font-semibold">Chat with AI Agent</h1>
      </div>

      <ScrollArea className="flex-1 p-4">
        <MessageList messages={messages} />
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </div>
    </div>
  );
}
```

##### 4. Design System Partagé

**package: @autoweave/ui**

```typescript
// packages/ui/src/components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));

// packages/ui/src/components/theme-provider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

// Shared Tailwind config
// packages/ui/tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        }
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
};
```

##### 5. Lighthouse CI Performance

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [push, pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Build apps
        run: pnpm build

      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

# lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002'
      ],
      startServerCommand: 'pnpm start',
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }]
      }
    }
  }
};
```

#### 🎯 Critères d'Acceptation Sprint 5

- [ ] 3 applications Next.js 15 déployées (Admin, Studio, User)
- [ ] Design system @autoweave/ui partagé fonctionnel
- [ ] React Flow agent builder opérationnel
- [ ] Navigation OIDC partagée entre apps
- [ ] Themes dark/light fonctionnels
- [ ] Composants A11Y Radix conformes WCAG 2.1
- [ ] Lighthouse score >90 performance mobile
- [ ] WebSocket logs stream Loki intégré

---

## 🚀 Sprint 6: Qualité + Release + Docs (3 semaines)

### Duration: 3 semaines

### Objectif: Production readiness et gouvernance

#### 📋 Livrables Production

##### 1. SonarCloud Quality Gate

**configuration: sonar-project.properties**

```properties
# sonar-project.properties
sonar.projectKey=autoweave
sonar.organization=autoweave-org
sonar.sources=packages/*/src,apps/*/src
sonar.tests=tests/,packages/*/src/**/*.test.ts,apps/*/src/**/*.test.ts
sonar.test.inclusions=**/*.test.ts,**/*.spec.ts
sonar.coverage.exclusions=**/*.test.ts,**/*.spec.ts,**/dist/**,**/build/**
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.qualitygate.wait=true

# Quality Gate Thresholds
sonar.coverage.line.minimum=80
sonar.coverage.branch.minimum=75
sonar.duplicated_lines_density.maximum=3
sonar.maintainability_rating.maximum=A
sonar.reliability_rating.maximum=A
sonar.security_rating.maximum=A
sonar.security_hotspots.maximum=0
```

##### 2. Semantic Release Automation

**configuration: .releaserc.json**

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    [
      "@semantic-release/exec",
      {
        "prepareCmd": "docker build -t autoweave:${nextRelease.version} .",
        "publishCmd": "docker push autoweave:${nextRelease.version}"
      }
    ],
    [
      "@semantic-release/github",
      {
        "assets": [
          {"path": "dist/*.tgz", "label": "Source distribution"},
          {"path": "sbom.json", "label": "Software Bill of Materials"}
        ]
      }
    ]
  ]
}

# Docker multi-arch build
# Dockerfile.multi-arch
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime
ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building for $TARGETPLATFORM on $BUILDPLATFORM"

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

##### 3. SBOM Generation avec Syft

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Run tests
        run: pnpm test:ci

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      - name: Build Docker images
        run: |
          docker buildx create --use
          docker buildx build --platform linux/amd64,linux/arm64 \
            -t autoweave:latest --push .

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: autoweave:latest
          format: spdx-json
          output-file: sbom.json

      - name: Sign artifacts
        run: |
          cosign sign --key cosign.key autoweave:latest
          cosign sign-blob --key cosign.key sbom.json

      - name: Semantic Release
        run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

##### 4. Documentation Docusaurus

**site: docs.autoweave.dev**

````typescript
// docs/docusaurus.config.js
module.exports = {
  title: 'AutoWeave',
  tagline: 'Production-ready AI Agent Orchestration Platform',
  url: 'https://docs.autoweave.dev',
  baseUrl: '/',

  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/autoweave/autoweave/edit/main/docs/',
        },
        blog: {
          showReadingTime: true,
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'AutoWeave',
      items: [
        {
          type: 'doc',
          docId: 'getting-started',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/blog',
          label: 'Blog',
          position: 'left'
        },
        {
          href: 'https://github.com/autoweave/autoweave',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
  },
};

// docs/docs/getting-started.md
# Getting Started with AutoWeave

AutoWeave is a production-ready AI agent orchestration platform built for enterprise environments.

## Quick Start

### Installation
```bash
npm install -g @autoweave/cli
autoweave init my-project
cd my-project
autoweave dev
````

### Your First Agent

```typescript
import { Agent } from '@autoweave/core';

const agent = new Agent({
  name: 'my-first-agent',
  description: 'A simple example agent',
  plugins: ['@autoweave/memory', '@autoweave/llm'],
});

await agent.deploy();
```

## Architecture Overview

AutoWeave follows a modular, hot-pluggable architecture:

- **USB Hot-Plug Daemon**: Detects and loads plugins dynamically
- **BullMQ Queue System**: Handles async job processing
- **GraphQL Federation**: Unified API gateway
- **OpenTelemetry**: Full observability stack
- **Next.js 15 UIs**: Admin, Dev Studio, and User interfaces

````

##### 5. Gouvernance RFC Publiques
**repository: autoweave/rfcs**
```markdown
# RFC Process

## Summary
This document describes the RFC (Request for Comments) process for AutoWeave.

## Motivation
As AutoWeave grows, we need a process for community input on substantial changes.

## Detailed Design

### RFC Lifecycle
1. **Draft**: RFC is created and initial discussion begins
2. **Public Comment**: RFC is open for community feedback (14 days)
3. **Final Comment Period**: Last call for feedback (7 days)
4. **Accepted/Rejected**: RFC is either accepted or rejected
5. **Implementation**: Accepted RFCs are implemented

### RFC Template
```markdown
# RFC: [Title]

## Summary
Brief explanation of the proposal.

## Motivation
Why is this change needed?

## Detailed Design
How will this work?

## Drawbacks
What are the downsides?

## Alternatives
What other approaches were considered?
````

#### 🎯 Critères d'Acceptation Sprint 6

- [ ] SonarCloud Quality Gate à 80% coverage, 0 vulnérabilités
- [ ] Semantic-release automatique fonctionnel
- [ ] Docker images multi-arch signées avec cosign
- [ ] SBOM généré et attaché aux releases GitHub
- [ ] Documentation Docusaurus déployée sur docs.autoweave.dev
- [ ] Tutoriels Quick-Start, Dev Studio, Admin complets
- [ ] RFC process public opérationnel
- [ ] Blog post Vercel sur RSC architecture publié

---

## 📈 Métriques de Succès Consolidées

### Métriques Techniques par Sprint

| Sprint | Composant     | Métrique         | Target             | Validation       |
| ------ | ------------- | ---------------- | ------------------ | ---------------- |
| 0      | RFC Process   | RFC-001 Approval | ✅ Approved        | Sprint Review    |
| 1      | USB Daemon    | Plugin Load Time | <250ms             | Performance Test |
| 1      | Hot-Plug      | Memory Leak Test | <1MB/1000 cycles   | Load Test        |
| 2      | BullMQ        | Job Throughput   | >100/min           | Stress Test      |
| 2      | Workers       | Success Rate     | >99%               | Monitoring       |
| 3      | GraphQL       | API Latency P95  | <200ms             | APM              |
| 3      | Auth          | Rate Limiting    | 100 req/min/tenant | Load Test        |
| 4      | Observability | Trace Collection | 100% services      | OTEL             |
| 4      | Monitoring    | Dashboard Uptime | >99%               | SLA              |
| 5      | Next.js       | Lighthouse Score | >90 mobile         | CI               |
| 5      | UX            | A11Y Compliance  | WCAG 2.1           | Audit            |
| 6      | Quality       | Test Coverage    | ≥80% global        | SonarCloud       |
| 6      | Security      | Vulnerabilities  | 0 critical/high    | Scan             |

### Métriques Business AutoWeave 1.0

- **Hot-plug Protocol Support**: 4 types (USB, FS, redeploy, webhook)
- **Zero-downtime Deployments**: 100% success rate
- **Multi-UI Architecture**: 3 applications consolidées
- **Documentation Coverage**: RFC + guides + API docs complète
- **Community Governance**: RFC process public opérationnel

Cette spécification détaillée guide l'implémentation de chaque sprint tout en
maintenant la flexibilité nécessaire aux décisions techniques et optimisations
during execution.
