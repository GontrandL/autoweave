# AutoWeave Implementation Guides

## Table of Contents

- [USB Daemon Implementation](#usb-daemon-implementation)
- [BullMQ + Redis Setup](#bullmq--redis-setup)
- [GraphQL Gateway Alternatives](#graphql-gateway-alternatives)
- [OpenTelemetry + Grafana Stack](#opentelemetry--grafana-stack)
- [Next.js 15 Applications](#nextjs-15-applications)
- [Plugin System Architecture](#plugin-system-architecture)
- [CI/CD Pipeline Setup](#cicd-pipeline-setup)

## USB Daemon Implementation

### Overview

Ce guide détaille l'implémentation du daemon USB pour la détection hot-plug avec
node-usb et libusb, incluant la configuration système et les fallbacks.

### Prerequisites

```bash
# Ubuntu/Debian
sudo apt-get install libudev-dev libusb-1.0-0-dev

# CentOS/RHEL
sudo yum install libudev-devel libusb-devel

# macOS
brew install libusb
```

### Core Implementation

#### 1. USB Daemon Service

```typescript
// packages/usb-daemon/src/usb-daemon.ts
import usb from 'usb';
import { EventEmitter } from 'events';
import { RedisClientType } from 'redis';
import { createLogger } from '@autoweave/logger';
import { trace } from '@opentelemetry/api';

const logger = createLogger('usb-daemon');
const tracer = trace.getTracer('usb-daemon');

export interface USBDevice {
  id: string;
  vendor: string;
  product: string;
  vendorId: number;
  productId: number;
  serial?: string;
  manufacturer?: string;
  deviceName?: string;
  path: string;
  timestamp: number;
}

export class USBDaemon extends EventEmitter {
  private redis: RedisClientType;
  private devices: Map<string, USBDevice> = new Map();
  private isRunning = false;
  private pollInterval?: NodeJS.Timeout;

  constructor(redisClient: RedisClientType) {
    super();
    this.redis = redisClient;
    this.setupHotplugCallbacks();
  }

  private setupHotplugCallbacks(): void {
    // Primary method: USB hotplug events
    usb.on('attach', this.handleDeviceAttach.bind(this));
    usb.on('detach', this.handleDeviceDetach.bind(this));

    // Fallback: periodic polling
    this.pollInterval = setInterval(() => {
      this.pollDevices();
    }, 5000);
  }

  private async handleDeviceAttach(device: usb.Device): Promise<void> {
    const span = tracer.startSpan('usb.device.attach');

    try {
      const deviceInfo = await this.extractDeviceInfo(device);
      logger.info('USB device attached', deviceInfo);

      this.devices.set(deviceInfo.id, deviceInfo);

      // Publish to Redis Streams
      await this.publishEvent('device.attached', deviceInfo);

      this.emit('device:attached', deviceInfo);
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Failed to handle device attach', error);
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
    } finally {
      span.end();
    }
  }

  private async handleDeviceDetach(device: usb.Device): Promise<void> {
    const span = tracer.startSpan('usb.device.detach');

    try {
      const deviceInfo = await this.extractDeviceInfo(device);
      logger.info('USB device detached', deviceInfo);

      this.devices.delete(deviceInfo.id);

      // Publish to Redis Streams
      await this.publishEvent('device.detached', deviceInfo);

      this.emit('device:detached', deviceInfo);
      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Failed to handle device detach', error);
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
    } finally {
      span.end();
    }
  }

  private async extractDeviceInfo(device: usb.Device): Promise<USBDevice> {
    const descriptor = device.deviceDescriptor;
    const id = `${descriptor.idVendor}:${descriptor.idProduct}:${device.busNumber}:${device.deviceAddress}`;

    let manufacturer = '';
    let product = '';
    let serial = '';

    try {
      // Try to open device and read string descriptors
      device.open();

      if (descriptor.iManufacturer) {
        manufacturer = await this.getStringDescriptor(
          device,
          descriptor.iManufacturer,
        );
      }

      if (descriptor.iProduct) {
        product = await this.getStringDescriptor(device, descriptor.iProduct);
      }

      if (descriptor.iSerialNumber) {
        serial = await this.getStringDescriptor(
          device,
          descriptor.iSerialNumber,
        );
      }

      device.close();
    } catch (error) {
      logger.warn('Failed to read device descriptors', { error, id });
    }

    return {
      id,
      vendor: manufacturer || `Vendor ${descriptor.idVendor.toString(16)}`,
      product: product || `Product ${descriptor.idProduct.toString(16)}`,
      vendorId: descriptor.idVendor,
      productId: descriptor.idProduct,
      serial,
      manufacturer,
      deviceName: product,
      path: `/dev/bus/usb/${device.busNumber.toString().padStart(3, '0')}/${device.deviceAddress.toString().padStart(3, '0')}`,
      timestamp: Date.now(),
    };
  }

  private getStringDescriptor(
    device: usb.Device,
    index: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      device.getStringDescriptor(index, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data || '');
        }
      });
    });
  }

  private async publishEvent(
    event: string,
    deviceInfo: USBDevice,
  ): Promise<void> {
    const streamKey = 'aw:hotplug';
    const eventData = {
      event,
      deviceId: deviceInfo.id,
      vendor: deviceInfo.vendor,
      product: deviceInfo.product,
      vendorId: deviceInfo.vendorId.toString(),
      productId: deviceInfo.productId.toString(),
      serial: deviceInfo.serial || '',
      path: deviceInfo.path,
      timestamp: deviceInfo.timestamp.toString(),
    };

    await this.redis.xAdd(streamKey, '*', eventData);
  }

  private async pollDevices(): Promise<void> {
    if (!this.isRunning) return;

    const span = tracer.startSpan('usb.device.poll');

    try {
      const currentDevices = new Map<string, USBDevice>();
      const devices = usb.getDeviceList();

      for (const device of devices) {
        const deviceInfo = await this.extractDeviceInfo(device);
        currentDevices.set(deviceInfo.id, deviceInfo);
      }

      // Check for new devices
      for (const [id, device] of currentDevices) {
        if (!this.devices.has(id)) {
          await this.handleDeviceAttach(device as any);
        }
      }

      // Check for removed devices
      for (const [id, device] of this.devices) {
        if (!currentDevices.has(id)) {
          await this.handleDeviceDetach(device as any);
        }
      }

      span.setStatus({ code: 1 }); // OK
    } catch (error) {
      logger.error('Failed to poll devices', error);
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
    } finally {
      span.end();
    }
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    logger.info('USB daemon started');

    // Initial device scan
    await this.pollDevices();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    logger.info('USB daemon stopped');
  }
}
```

#### 2. System Configuration

```bash
# udev rules for USB device access
# /etc/udev/rules.d/99-autoweave-usb.rules
SUBSYSTEM=="usb", GROUP="autoweave", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="*", ATTRS{idProduct}=="*", GROUP="autoweave", MODE="0666"

# Create autoweave group
sudo groupadd autoweave
sudo usermod -a -G autoweave $USER

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

#### 3. Docker Configuration

```dockerfile
# Dockerfile.usb-daemon
FROM node:20-alpine

# Install libusb
RUN apk add --no-cache libusb-dev eudev-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Run as non-root user
USER node

# Expose USB devices
VOLUME ["/dev/bus/usb"]

CMD ["npm", "start"]
```

#### 4. Kubernetes Deployment

```yaml
# k8s/usb-daemon-deployment.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: usb-daemon
  namespace: autoweave
spec:
  selector:
    matchLabels:
      app: usb-daemon
  template:
    metadata:
      labels:
        app: usb-daemon
    spec:
      hostNetwork: true
      containers:
        - name: usb-daemon
          image: autoweave/usb-daemon:latest
          securityContext:
            privileged: true
          volumeMounts:
            - name: dev-bus-usb
              mountPath: /dev/bus/usb
            - name: udev
              mountPath: /run/udev
          env:
            - name: REDIS_URL
              value: 'redis://redis:6379'
            - name: NODE_ENV
              value: 'production'
      volumes:
        - name: dev-bus-usb
          hostPath:
            path: /dev/bus/usb
        - name: udev
          hostPath:
            path: /run/udev
      tolerations:
        - key: node-role.kubernetes.io/master
          operator: Exists
          effect: NoSchedule
```

## BullMQ + Redis Setup

### Overview

Configuration complète de BullMQ avec Redis pour le traitement asynchrone des
jobs et la gestion des workers.

### Redis Configuration

#### 1. Redis Stack Setup

```yaml
# docker-compose.redis.yml
version: '3.8'
services:
  redis:
    image: redis/redis-stack:7.2.0-v0
    ports:
      - '6379:6379'
      - '8001:8001' # RedisInsight
    volumes:
      - redis_data:/data
      - ./redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    environment:
      - REDIS_ARGS=--appendonly yes

  redis-cluster:
    image: redis/redis-stack:7.2.0-v0
    deploy:
      replicas: 3
    command:
      redis-server --cluster-enabled yes --cluster-config-file nodes.conf
      --cluster-node-timeout 5000 --appendonly yes
    volumes:
      - redis_cluster_data:/data

volumes:
  redis_data:
  redis_cluster_data:
```

#### 2. Redis Configuration File

```conf
# redis.conf
# Network
bind 0.0.0.0
port 6379
protected-mode no

# General
daemonize no
supervised no
pidfile /var/run/redis_6379.pid
loglevel notice

# Persistence
save 900 1
save 300 10
save 60 10000
rdbcompression yes
dbfilename dump.rdb
dir /data

# Append only file
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Streams
stream-node-max-bytes 4096
stream-node-max-entries 100

# Modules
loadmodule /opt/redis-stack/lib/redisearch.so
loadmodule /opt/redis-stack/lib/redisgraph.so
loadmodule /opt/redis-stack/lib/redistimeseries.so
loadmodule /opt/redis-stack/lib/rejson.so
loadmodule /opt/redis-stack/lib/redisbloom.so
```

### BullMQ Implementation

#### 1. Job Queue Manager

```typescript
// packages/job-queue/src/job-manager.ts
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from '@autoweave/logger';
import { trace } from '@opentelemetry/api';

const logger = createLogger('job-manager');
const tracer = trace.getTracer('job-manager');

export type JobType =
  | 'agent.create'
  | 'agent.deploy'
  | 'agent.stop'
  | 'memory.vectorize'
  | 'memory.search'
  | 'llm.batch'
  | 'llm.stream'
  | 'plugin.load'
  | 'plugin.unload'
  | 'system.cleanup'
  | 'system.health_check';

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
    removeOnComplete?: number;
    removeOnFail?: number;
  };
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  timestamp: number;
}

export class JobManager {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor(redisConfig: any) {
    this.redis = new Redis(redisConfig);
  }

  async createQueue(name: string): Promise<Queue> {
    const queue = new Queue(name, {
      connection: this.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 10,
        removeOnFail: 50,
      },
    });

    this.queues.set(name, queue);

    // Setup queue events
    const queueEvents = new QueueEvents(name, {
      connection: this.redis,
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info('Job completed', { jobId, returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Job failed', { jobId, failedReason });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn('Job stalled', { jobId });
    });

    this.queueEvents.set(name, queueEvents);

    return queue;
  }

  async addJob(queueName: string, config: JobConfig): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const span = tracer.startSpan(`job.add.${config.type}`);

    try {
      const job = await queue.add(config.type, config.data, {
        ...config.options,
        // Add tracing context
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      });

      logger.info('Job added', {
        jobId: job.id,
        queue: queueName,
        type: config.type,
      });

      span.setStatus({ code: 1 }); // OK
      return job;
    } catch (error) {
      logger.error('Failed to add job', error);
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  }

  async createWorker(
    queueName: string,
    processor: (job: Job) => Promise<JobResult>,
  ): Promise<Worker> {
    const worker = new Worker(
      queueName,
      async (job) => {
        const span = tracer.startSpan(`job.process.${job.name}`, {
          attributes: {
            'job.id': job.id!,
            'job.name': job.name,
            'job.queue': queueName,
            'job.attempts': job.attemptsMade,
          },
        });

        const startTime = Date.now();

        try {
          logger.info('Processing job', {
            jobId: job.id,
            name: job.name,
            queue: queueName,
          });

          const result = await processor(job);
          const duration = Date.now() - startTime;

          span.setAttributes({
            'job.success': result.success,
            'job.duration': duration,
          });

          if (result.success) {
            span.setStatus({ code: 1 }); // OK
          } else {
            span.setStatus({ code: 2 }); // ERROR
          }

          logger.info('Job processed', {
            jobId: job.id,
            success: result.success,
            duration,
          });

          return {
            ...result,
            duration,
            timestamp: Date.now(),
          };
        } catch (error) {
          const duration = Date.now() - startTime;

          span.recordException(error);
          span.setStatus({ code: 2 }); // ERROR

          logger.error('Job processing failed', {
            jobId: job.id,
            error: error.message,
            duration,
          });

          throw error;
        } finally {
          span.end();
        }
      },
      {
        connection: this.redis,
        concurrency: 10,
        maxStalledCount: 1,
        stalledInterval: 30000,
      },
    );

    // Worker event handlers
    worker.on('completed', (job, result) => {
      logger.info('Worker completed job', {
        jobId: job.id,
        result: result.success,
      });
    });

    worker.on('failed', (job, err) => {
      logger.error('Worker failed job', {
        jobId: job?.id,
        error: err.message,
      });
    });

    worker.on('stalled', (jobId) => {
      logger.warn('Worker stalled job', { jobId });
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  async getJobStats(queueName: string): Promise<any> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info('Queue paused', { queueName });
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info('Queue resumed', { queueName });
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down job manager');

    // Close all workers
    await Promise.all(
      Array.from(this.workers.values()).map((worker) => worker.close()),
    );

    // Close all queue events
    await Promise.all(
      Array.from(this.queueEvents.values()).map((events) => events.close()),
    );

    // Close Redis connection
    await this.redis.quit();

    logger.info('Job manager shutdown complete');
  }
}
```

#### 2. Plugin Job Processor

```typescript
// packages/job-queue/src/processors/plugin-processor.ts
import { Job } from 'bullmq';
import { PluginManager } from '@autoweave/plugin-manager';
import { createLogger } from '@autoweave/logger';
import { JobResult } from '../job-manager';

const logger = createLogger('plugin-processor');

export class PluginJobProcessor {
  private pluginManager: PluginManager;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  async processJob(job: Job): Promise<JobResult> {
    const { name, data } = job;

    switch (name) {
      case 'plugin.load':
        return this.loadPlugin(data);
      case 'plugin.unload':
        return this.unloadPlugin(data);
      case 'plugin.reload':
        return this.reloadPlugin(data);
      default:
        throw new Error(`Unknown plugin job type: ${name}`);
    }
  }

  private async loadPlugin(data: any): Promise<JobResult> {
    try {
      const { manifestPath, options } = data;

      const plugin = await this.pluginManager.loadPlugin(manifestPath, options);

      return {
        success: true,
        data: {
          pluginId: plugin.id,
          name: plugin.manifest.name,
          version: plugin.manifest.version,
        },
        duration: 0, // Will be set by job manager
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to load plugin', error);
      return {
        success: false,
        error: error.message,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }

  private async unloadPlugin(data: any): Promise<JobResult> {
    try {
      const { pluginId } = data;

      await this.pluginManager.unloadPlugin(pluginId);

      return {
        success: true,
        data: { pluginId },
        duration: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to unload plugin', error);
      return {
        success: false,
        error: error.message,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }

  private async reloadPlugin(data: any): Promise<JobResult> {
    try {
      const { pluginId } = data;

      await this.pluginManager.reloadPlugin(pluginId);

      return {
        success: true,
        data: { pluginId },
        duration: 0,
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to reload plugin', error);
      return {
        success: false,
        error: error.message,
        duration: 0,
        timestamp: Date.now(),
      };
    }
  }
}
```

## GraphQL Gateway Alternatives

### Overview

Comparison et implémentation de différentes solutions GraphQL Gateway pour
AutoWeave.

### Option 1: Apollo Federation

#### Setup Apollo Gateway

```typescript
// packages/graphql-gateway/src/apollo-gateway.ts
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from 'apollo-server-express';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { createLogger } from '@autoweave/logger';
import { trace } from '@opentelemetry/api';

const logger = createLogger('apollo-gateway');
const tracer = trace.getTracer('apollo-gateway');

export class AutoWeaveApolloGateway {
  private gateway: ApolloGateway;
  private server: ApolloServer;

  constructor() {
    this.gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: [
          { name: 'agents', url: process.env.AGENTS_SUBGRAPH_URL! },
          { name: 'memory', url: process.env.MEMORY_SUBGRAPH_URL! },
          { name: 'queue', url: process.env.QUEUE_SUBGRAPH_URL! },
          { name: 'plugins', url: process.env.PLUGINS_SUBGRAPH_URL! },
          {
            name: 'observability',
            url: process.env.OBSERVABILITY_SUBGRAPH_URL!,
          },
        ],
      }),
      buildService: ({ name, url }) => {
        return new RemoteGraphQLDataSource({
          url,
          willSendRequest: ({ request, context }) => {
            // Forward authentication headers
            request.http.headers.set('authorization', context.authorization);
            request.http.headers.set('x-tenant-id', context.tenantId);
          },
        });
      },
    });
  }

  async createServer(): Promise<ApolloServer> {
    this.server = new ApolloServer({
      gateway: this.gateway,
      context: ({ req }) => {
        const span = tracer.startSpan('graphql.request');

        // Extract authentication from headers
        const authorization = req.headers.authorization;
        const tenantId = req.headers['x-tenant-id'];

        return {
          authorization,
          tenantId,
          span,
        };
      },
      plugins: [
        {
          requestDidStart() {
            return {
              willSendResponse(requestContext) {
                // End tracing span
                if (requestContext.context.span) {
                  requestContext.context.span.end();
                }
              },
            };
          },
        },
      ],
    });

    return this.server;
  }
}
```

#### Subgraph Implementation

```typescript
// packages/agents-subgraph/src/schema.ts
import { buildSubgraphSchema } from '@apollo/subgraph';
import { gql } from 'apollo-server-express';
import { AgentService } from './agent-service';

const typeDefs = gql`
  type Agent @key(fields: "id") {
    id: ID!
    name: String!
    description: String
    status: AgentStatus!
    tenantId: String!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Federation reference
    memory: Memory @requires(fields: "id")
    jobs: [Job!]! @requires(fields: "id")
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
    agent(id: ID!): Agent
  }

  type Mutation {
    createAgent(input: CreateAgentInput!): Agent!
    deployAgent(id: ID!): Agent!
    stopAgent(id: ID!): Agent!
    deleteAgent(id: ID!): Boolean!
  }

  type Subscription {
    agentStatusChanged(tenantId: String!): Agent!
  }

  input CreateAgentInput {
    name: String!
    description: String
    config: JSON
  }

  scalar DateTime
  scalar JSON
`;

const resolvers = {
  Query: {
    agents: async (_, { tenantId }, context) => {
      return AgentService.getAgentsByTenant(tenantId);
    },
    agent: async (_, { id }, context) => {
      return AgentService.getAgentById(id);
    },
  },

  Mutation: {
    createAgent: async (_, { input }, context) => {
      return AgentService.createAgent(input, context.tenantId);
    },
    deployAgent: async (_, { id }, context) => {
      return AgentService.deployAgent(id);
    },
    stopAgent: async (_, { id }, context) => {
      return AgentService.stopAgent(id);
    },
    deleteAgent: async (_, { id }, context) => {
      return AgentService.deleteAgent(id);
    },
  },

  Subscription: {
    agentStatusChanged: {
      subscribe: (_, { tenantId }) => {
        return AgentService.subscribeToStatusChanges(tenantId);
      },
    },
  },

  Agent: {
    __resolveReference: (agent) => {
      return AgentService.getAgentById(agent.id);
    },
  },
};

export const schema = buildSubgraphSchema({ typeDefs, resolvers });
```

### Option 2: GraphQL Mesh

#### Mesh Configuration

```yaml
# .meshrc.yaml
sources:
  - name: agents
    handler:
      graphql:
        endpoint: http://localhost:4001/graphql

  - name: memory
    handler:
      graphql:
        endpoint: http://localhost:4002/graphql

  - name: queue
    handler:
      openapi:
        source: http://localhost:4003/swagger.json

  - name: plugins
    handler:
      grpc:
        endpoint: localhost:50051
        protoFilePath: ./proto/plugins.proto

transforms:
  - filterSchema:
      mode: wrap
      filters:
        - Query.agents
        - Query.agent
        - Mutation.createAgent
        - Mutation.deployAgent
        - Subscription.agentStatusChanged

  - rename:
      mode: wrap
      renames:
        - from:
            type: Agent
            field: id
          to:
            type: Agent
            field: agentId

additionalTypeDefs: |
  extend type Query {
    healthCheck: String
  }

additionalResolvers:
  - './src/additional-resolvers.ts'
```

### Option 3: Hasura GraphQL Engine

#### Docker Setup

```yaml
# docker-compose.hasura.yml
version: '3.8'
services:
  hasura:
    image: hasura/graphql-engine:v2.36.0
    ports:
      - '8080:8080'
    environment:
      HASURA_GRAPHQL_DATABASE_URL: postgres://username:password@postgres:5432/autoweave
      HASURA_GRAPHQL_ENABLE_CONSOLE: 'true'
      HASURA_GRAPHQL_DEV_MODE: 'true'
      HASURA_GRAPHQL_ENABLED_LOG_TYPES:
        startup, http-log, webhook-log, websocket-log, query-log
      HASURA_GRAPHQL_ADMIN_SECRET: myadminsecretkey
      HASURA_GRAPHQL_JWT_SECRET:
        '{"type": "HS256", "key": "your-jwt-secret-key"}'
      HASURA_GRAPHQL_CORS_DOMAIN: '*'
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: autoweave
      POSTGRES_USER: username
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - '5432:5432'

volumes:
  postgres_data:
```

#### Remote Schema Configuration

```typescript
// hasura/remote-schemas/agents.ts
export const agentsRemoteSchema = {
  name: 'agents',
  definition: {
    url: 'http://agents-service:4001/graphql',
    headers: [
      {
        name: 'Authorization',
        value_from_env: 'AGENTS_SERVICE_TOKEN',
      },
    ],
    forward_client_headers: true,
    timeout_seconds: 60,
  },
  permissions: [
    {
      role: 'user',
      definition: {
        schema: `
          type Query {
            agents: [Agent!]!
            agent(id: ID!): Agent
          }
          
          type Mutation {
            createAgent(input: CreateAgentInput!): Agent!
            deployAgent(id: ID!): Agent!
          }
        `,
      },
    },
  ],
};
```

## OpenTelemetry + Grafana Stack

### Overview

Configuration complète de l'observabilité avec OpenTelemetry, Grafana Tempo,
Loki et Grafana.

### OpenTelemetry Setup

#### 1. Node.js SDK Configuration

```typescript
// packages/observability/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export function initializeTelemetry(serviceName: string, version: string) {
  // Trace exporter
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      'http://tempo:4318/v1/traces',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Metric exporter
  const metricExporter = new OTLPMetricExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
      'http://tempo:4318/v1/metrics',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Resource attributes
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
      process.env.NODE_ENV || 'development',
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]:
      process.env.HOSTNAME || 'unknown',
  });

  // Initialize SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 10000,
    }),
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxExportBatchSize: 100,
      scheduledDelayMillis: 500,
      exportTimeoutMillis: 5000,
      maxQueueSize: 2048,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': {
          enabled: true,
          requestHook: (span, info) => {
            span.setAttributes({
              'http.route': info.route,
              'http.method': info.req.method,
              'http.url': info.req.url,
              'user.id': info.req.headers['x-user-id'] || 'anonymous',
              'tenant.id': info.req.headers['x-tenant-id'] || 'default',
            });
          },
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
          dbStatementSerializer: (cmdName, cmdArgs) => {
            return `${cmdName} ${cmdArgs.slice(0, 2).join(' ')}`;
          },
        },
        '@opentelemetry/instrumentation-graphql': {
          enabled: true,
          mergeItems: true,
          requestHook: (span, info) => {
            span.setAttributes({
              'graphql.operation.name': info.operationName,
              'graphql.operation.type': info.operationType,
              'graphql.document': info.source,
            });
          },
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          requestHook: (span, request) => {
            span.setAttributes({
              'http.request.size': request.headers['content-length'],
              'http.user_agent': request.headers['user-agent'],
            });
          },
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable filesystem instrumentation for performance
        },
      }),
    ],
  });

  // Start SDK
  sdk.start();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Telemetry terminated'))
      .catch((error) => console.log('Error terminating telemetry', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}
```

#### 2. Custom Instrumentation

```typescript
// packages/observability/src/custom-instrumentation.ts
import { trace, metrics } from '@opentelemetry/api';
import { MeterProvider } from '@opentelemetry/sdk-metrics';

const tracer = trace.getTracer('autoweave-custom');
const meter = metrics.getMeter('autoweave-custom');

// Custom metrics
const pluginLoadCounter = meter.createCounter('plugin_loads_total', {
  description: 'Total number of plugin loads',
});

const pluginLoadDuration = meter.createHistogram('plugin_load_duration_ms', {
  description: 'Plugin load duration in milliseconds',
});

const activePluginsGauge = meter.createUpDownCounter('active_plugins', {
  description: 'Number of active plugins',
});

// Instrumentation for plugin operations
export function instrumentPluginOperation<T>(
  operationName: string,
  pluginId: string,
  tenantId: string,
  operation: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(operationName, async (span) => {
    const startTime = Date.now();

    span.setAttributes({
      'plugin.id': pluginId,
      'tenant.id': tenantId,
      'operation.name': operationName,
    });

    try {
      const result = await operation();

      span.setStatus({ code: 1 }); // OK
      span.setAttributes({
        'operation.success': true,
      });

      // Record metrics
      pluginLoadCounter.add(1, {
        plugin_id: pluginId,
        tenant_id: tenantId,
        status: 'success',
      });

      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2 }); // ERROR
      span.setAttributes({
        'operation.success': false,
        'error.message': error.message,
      });

      // Record metrics
      pluginLoadCounter.add(1, {
        plugin_id: pluginId,
        tenant_id: tenantId,
        status: 'error',
      });

      throw error;
    } finally {
      const duration = Date.now() - startTime;

      span.setAttributes({
        'operation.duration_ms': duration,
      });

      pluginLoadDuration.record(duration, {
        plugin_id: pluginId,
        tenant_id: tenantId,
      });

      span.end();
    }
  });
}

// BullMQ instrumentation
export function instrumentBullMQJob(
  jobName: string,
  jobId: string,
  tenantId: string,
) {
  return tracer.startActiveSpan(`job.${jobName}`, (span) => {
    span.setAttributes({
      'job.id': jobId,
      'job.name': jobName,
      'tenant.id': tenantId,
    });

    return {
      setSuccess: () => {
        span.setStatus({ code: 1 });
        span.setAttributes({ 'job.success': true });
      },
      setError: (error: Error) => {
        span.recordException(error);
        span.setStatus({ code: 2 });
        span.setAttributes({ 'job.success': false });
      },
      end: () => span.end(),
    };
  });
}
```

### Grafana Stack Deployment

#### 1. Helm Chart Values

```yaml
# helm/observability/values.yaml
global:
  domain: observability.autoweave.local

grafana:
  enabled: true
  adminPassword: 'autoweave-admin'

  persistence:
    enabled: true
    size: 10Gi

  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: Tempo
          type: tempo
          url: http://tempo:3200
          access: proxy
          uid: tempo

        - name: Loki
          type: loki
          url: http://loki:3100
          access: proxy
          uid: loki

        - name: Prometheus
          type: prometheus
          url: http://prometheus:9090
          access: proxy
          uid: prometheus

  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
        - name: 'default'
          orgId: 1
          folder: ''
          type: file
          disableDeletion: false
          editable: true
          options:
            path: /var/lib/grafana/dashboards/default

  dashboards:
    default:
      autoweave-overview:
        gnetId: 1
        revision: 1
        datasource: Prometheus

      autoweave-traces:
        gnetId: 2
        revision: 1
        datasource: Tempo

tempo:
  enabled: true

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

    storage:
      trace:
        backend: s3
        s3:
          bucket: tempo-traces
          endpoint: minio:9000
          access_key: minio
          secret_key: minio123
          insecure: true

  persistence:
    enabled: true
    size: 20Gi

loki:
  enabled: true

  config:
    auth_enabled: true

    server:
      http_listen_port: 3100

    common:
      storage:
        s3:
          endpoint: minio:9000
          access_key_id: minio
          secret_access_key: minio123
          buckets: loki-chunks
          s3forcepathstyle: true
          insecure: true

    schema_config:
      configs:
        - from: 2020-10-24
          store: boltdb-shipper
          object_store: s3
          schema: v11
          index:
            prefix: index_
            period: 24h

  persistence:
    enabled: true
    size: 20Gi

prometheus:
  enabled: true

  server:
    persistence:
      enabled: true
      size: 20Gi

    config:
      global:
        scrape_interval: 15s
        evaluation_interval: 15s

      scrape_configs:
        - job_name: 'autoweave-services'
          static_configs:
            - targets: ['localhost:3000', 'localhost:3001', 'localhost:3002']
          metrics_path: '/metrics'
          scrape_interval: 10s

minio:
  enabled: true

  auth:
    rootUser: minio
    rootPassword: minio123

  defaultBuckets: 'tempo-traces,loki-chunks'

  persistence:
    enabled: true
    size: 50Gi
```

#### 2. Dashboard Configuration

```json
{
  "dashboard": {
    "id": null,
    "title": "AutoWeave Overview",
    "tags": ["autoweave"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "reqps",
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 100 },
                { "color": "red", "value": 500 }
              ]
            }
          }
        }
      },
      {
        "id": 2,
        "title": "Response Time P95",
        "type": "stat",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 Latency"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 0.1 },
                { "color": "red", "value": 0.5 }
              ]
            }
          }
        }
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "color": {
              "mode": "thresholds"
            },
            "thresholds": {
              "steps": [
                { "color": "green", "value": null },
                { "color": "yellow", "value": 1 },
                { "color": "red", "value": 5 }
              ]
            }
          }
        }
      }
    ]
  }
}
```

## Next.js 15 Applications

### Overview

Guide d'implémentation des trois applications Next.js 15 avec App Router et
design system unifié.

### Shared Configuration

#### 1. Workspace Setup

```json
{
  "name": "@autoweave/nextjs-apps",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "start": "turbo run start",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

#### 2. Shared UI Package

```typescript
// packages/ui/src/index.ts
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/input';
export * from './components/ui/dialog';
export * from './components/ui/table';
export * from './components/ui/badge';
export * from './components/ui/toast';
export * from './components/ui/dropdown-menu';
export * from './components/ui/sidebar';
export * from './components/ui/header';

// Business components
export * from './components/business/agent-card';
export * from './components/business/plugin-table';
export * from './components/business/metrics-card';
export * from './components/business/log-viewer';
export * from './components/business/graph-builder';

// Providers
export * from './providers/theme-provider';
export * from './providers/toast-provider';
export * from './providers/auth-provider';

// Hooks
export * from './hooks/use-theme';
export * from './hooks/use-toast';
export * from './hooks/use-auth';

// Utils
export * from './lib/utils';
export * from './lib/types';
```

### Admin Application

#### 1. Next.js Configuration

```typescript
// apps/admin/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    serverComponents: true,
  },
  transpilePackages: ['@autoweave/ui'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  },
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/bullmq-board/:path*',
        destination: 'http://localhost:3010/api/bullmq-board/:path*',
      },
      {
        source: '/api/grafana/:path*',
        destination: 'http://localhost:3000/api/grafana/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
```

#### 2. Layout Implementation

```typescript
// apps/admin/src/app/layout.tsx
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@autoweave/ui/providers/theme-provider';
import { ToastProvider } from '@autoweave/ui/providers/toast-provider';
import { AuthProvider } from '@autoweave/ui/providers/auth-provider';
import { Sidebar } from '@autoweave/ui/components/ui/sidebar';
import { Header } from '@autoweave/ui/components/ui/header';
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <ToastProvider>
              <div className="flex h-screen bg-background">
                <Sidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                  <Header />
                  <main className="flex-1 overflow-auto">
                    {children}
                  </main>
                </div>
              </div>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

#### 3. Health Dashboard

```typescript
// apps/admin/src/app/health/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@autoweave/ui';
import { Badge } from '@autoweave/ui';
import { Activity, Database, Cpu, HardDrive } from 'lucide-react';

async function getHealthData() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`, {
    cache: 'no-store',
  });
  return response.json();
}

export default async function HealthPage() {
  const healthData = await getHealthData();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Health</h1>
        <Badge variant={healthData.status === 'healthy' ? 'default' : 'destructive'}>
          {healthData.status}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          title="API Gateway"
          status={healthData.services.gateway}
          icon={<Activity className="h-4 w-4" />}
        />
        <HealthCard
          title="Database"
          status={healthData.services.database}
          icon={<Database className="h-4 w-4" />}
        />
        <HealthCard
          title="Redis"
          status={healthData.services.redis}
          icon={<Cpu className="h-4 w-4" />}
        />
        <HealthCard
          title="Storage"
          status={healthData.services.storage}
          icon={<HardDrive className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SystemMetrics />
        <RecentAlerts />
      </div>
    </div>
  );
}

function HealthCard({ title, status, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          <Badge variant={status === 'healthy' ? 'default' : 'destructive'}>
            {status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Dev Studio Application

#### 1. React Flow Integration

```typescript
// apps/studio/src/app/builder/page.tsx
'use client';

import { useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
} from 'reactflow';
import { ToolboxPanel } from '@/components/toolbox-panel';
import { PropertiesPanel } from '@/components/properties-panel';
import { TopBar } from '@/components/top-bar';
import { nodeTypes } from '@/components/nodes';
import { initialNodes, initialEdges } from '@/lib/initial-data';

import 'reactflow/dist/style.css';

export default function BuilderPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <TopBar />

      <div className="flex-1 flex">
        <ToolboxPanel className="w-64 border-r" />

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        <PropertiesPanel
          className="w-80 border-l"
          selectedNode={selectedNode}
          onNodeUpdate={(nodeId, updates) => {
            setNodes((nodes) =>
              nodes.map((node) =>
                node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
              )
            );
          }}
        />
      </div>
    </div>
  );
}
```

#### 2. Custom Node Components

```typescript
// apps/studio/src/components/nodes/llm-node.tsx
import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card, CardContent, CardHeader, CardTitle } from '@autoweave/ui';
import { Badge } from '@autoweave/ui';
import { Brain, Settings } from 'lucide-react';

interface LLMNodeData {
  model: string;
  temperature: number;
  maxTokens: number;
  prompt: string;
  systemPrompt?: string;
}

export const LLMNode = memo(({ data, selected }: NodeProps<LLMNodeData>) => {
  return (
    <Card className={`w-64 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" />
          LLM Node
          <Settings className="h-3 w-3 ml-auto cursor-pointer" />
        </CardTitle>
        <Badge variant="secondary" className="w-fit">
          {data.model}
        </Badge>
      </CardHeader>

      <CardContent className="text-xs space-y-1">
        <div className="flex justify-between">
          <span>Temperature:</span>
          <span>{data.temperature}</span>
        </div>
        <div className="flex justify-between">
          <span>Max Tokens:</span>
          <span>{data.maxTokens}</span>
        </div>
        <div className="mt-2">
          <div className="text-xs text-muted-foreground">Prompt:</div>
          <div className="text-xs truncate" title={data.prompt}>
            {data.prompt}
          </div>
        </div>
      </CardContent>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500"
      />
    </Card>
  );
});

LLMNode.displayName = 'LLMNode';
```

### User Application

#### 1. Chat Interface

```typescript
// apps/user/src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { AgentsList } from '@/components/agents-list';
import { ChatInterface } from '@/components/chat-interface';
import { useAuth } from '@autoweave/ui/hooks/use-auth';
import { useWebSocket } from '@/hooks/use-websocket';

export default function HomePage() {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [messages, setMessages] = useState([]);
  const { user } = useAuth();

  const { sendMessage, isConnected } = useWebSocket({
    url: process.env.NEXT_PUBLIC_WS_URL,
    onMessage: (message) => {
      setMessages((prev) => [...prev, message]);
    },
  });

  return (
    <div className="h-screen flex">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Active Agents</h2>
          <div className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <AgentsList
          selectedAgent={selectedAgent}
          onSelectAgent={setSelectedAgent}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <ChatInterface
          agent={selectedAgent}
          messages={messages}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  );
}
```

#### 2. Real-time Chat Component

```typescript
// apps/user/src/components/chat-interface.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@autoweave/ui';
import { Input } from '@autoweave/ui';
import { ScrollArea } from '@autoweave/ui';
import { Badge } from '@autoweave/ui';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  agentId?: string;
}

interface ChatInterfaceProps {
  agent: any;
  messages: Message[];
  onSendMessage: (message: string) => void;
}

export function ChatInterface({ agent, messages, onSendMessage }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !agent) return;

    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!agent) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Select an Agent</h3>
          <p className="text-muted-foreground">
            Choose an agent from the left panel to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="font-semibold">{agent.name}</h2>
          <div className="flex items-center gap-2">
            <Badge variant={agent.status === 'running' ? 'default' : 'secondary'}>
              {agent.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {agent.description}
            </span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.type === 'agent'
                    ? 'bg-muted'
                    : 'bg-yellow-50 text-yellow-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {message.type === 'user' ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                  <span className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm">{message.content}</div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-3 w-3" />
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

## Plugin System Architecture

### Overview

Architecture complète du système de plugins avec hot-plug, isolation et
sécurité.

### Core Components

#### 1. Plugin Manager

```typescript
// packages/plugin-manager/src/plugin-manager.ts
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { PluginManifest, PluginInstance } from './types';
import { PluginValidator } from './plugin-validator';
import { PluginLoader } from './plugin-loader';
import { PluginSandbox } from './plugin-sandbox';
import { createLogger } from '@autoweave/logger';

const logger = createLogger('plugin-manager');

export class PluginManager extends EventEmitter {
  private plugins: Map<string, PluginInstance> = new Map();
  private validator: PluginValidator;
  private loader: PluginLoader;
  private sandbox: PluginSandbox;

  constructor() {
    super();
    this.validator = new PluginValidator();
    this.loader = new PluginLoader();
    this.sandbox = new PluginSandbox();
  }

  async loadPlugin(
    manifestPath: string,
    options: any = {},
  ): Promise<PluginInstance> {
    const manifest = await this.loader.loadManifest(manifestPath);

    // Validate manifest
    const validation = await this.validator.validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
    }

    // Verify signature
    const signatureValid = await this.validator.verifySignature(
      manifest,
      manifestPath,
    );
    if (!signatureValid) {
      throw new Error('Invalid plugin signature');
    }

    // Create plugin instance
    const instance = await this.createPluginInstance(
      manifest,
      manifestPath,
      options,
    );

    // Load plugin in sandbox
    await this.sandbox.loadPlugin(instance);

    this.plugins.set(instance.id, instance);
    this.emit('plugin:loaded', instance);

    logger.info('Plugin loaded successfully', {
      pluginId: instance.id,
      name: manifest.name,
      version: manifest.version,
    });

    return instance;
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    await this.sandbox.unloadPlugin(instance);
    this.plugins.delete(pluginId);
    this.emit('plugin:unloaded', instance);

    logger.info('Plugin unloaded successfully', {
      pluginId: instance.id,
      name: instance.manifest.name,
    });
  }

  async reloadPlugin(pluginId: string): Promise<PluginInstance> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    await this.unloadPlugin(pluginId);
    return this.loadPlugin(instance.manifestPath, instance.options);
  }

  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  async executePluginMethod(
    pluginId: string,
    method: string,
    args: any[],
  ): Promise<any> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    return this.sandbox.executeMethod(instance, method, args);
  }

  private async createPluginInstance(
    manifest: PluginManifest,
    manifestPath: string,
    options: any,
  ): Promise<PluginInstance> {
    return {
      id: `${manifest.name}@${manifest.version}`,
      manifest,
      manifestPath,
      options,
      status: 'loaded',
      worker: null,
      sandbox: null,
      loadedAt: new Date(),
      lastActivity: new Date(),
    };
  }
}
```

#### 2. Plugin Validator

```typescript
// packages/plugin-manager/src/plugin-validator.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createHash, createVerify } from 'crypto';
import { readFileSync } from 'fs';
import { PluginManifest } from './types';

export class PluginValidator {
  private ajv: Ajv;
  private schema: object;

  constructor() {
    this.ajv = new Ajv({
      strict: true,
      allErrors: true,
      removeAdditional: false,
    });
    addFormats(this.ajv);
    this.loadSchema();
  }

  private loadSchema(): void {
    this.schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['name', 'version', 'entry', 'permissions'],
      properties: {
        name: {
          type: 'string',
          pattern: '^[a-z0-9-]+$',
          minLength: 3,
          maxLength: 50,
        },
        version: {
          type: 'string',
          pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9-]+)?$',
        },
        entry: {
          type: 'string',
          pattern: '^[a-zA-Z0-9-_/]+\\.(js|ts|mjs)$',
        },
        permissions: {
          type: 'object',
          additionalProperties: false,
          properties: {
            filesystem: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  mode: { enum: ['read', 'write', 'readwrite'] },
                },
                required: ['path', 'mode'],
              },
            },
            network: {
              type: 'object',
              properties: {
                outbound: {
                  type: 'array',
                  items: { type: 'string', format: 'uri' },
                },
                inbound: {
                  type: 'object',
                  properties: {
                    port: { type: 'integer', minimum: 1024, maximum: 65535 },
                    interface: { enum: ['localhost', 'all'] },
                  },
                },
              },
            },
            usb: {
              type: 'object',
              properties: {
                vendor_ids: {
                  type: 'array',
                  items: { type: 'string', pattern: '^0x[0-9a-fA-F]{4}$' },
                },
                product_ids: {
                  type: 'array',
                  items: { type: 'string', pattern: '^0x[0-9a-fA-F]{4}$' },
                },
              },
            },
            memory: {
              type: 'object',
              properties: {
                max_heap_mb: { type: 'integer', minimum: 10, maximum: 1024 },
                max_workers: { type: 'integer', minimum: 1, maximum: 8 },
              },
            },
            queue: {
              type: 'array',
              items: { type: 'string', pattern: '^[a-z0-9-]+$' },
            },
          },
        },
        hooks: {
          type: 'object',
          additionalProperties: false,
          properties: {
            onLoad: { type: 'string' },
            onUnload: { type: 'string' },
            onUSBAttach: { type: 'string' },
            onUSBDetach: { type: 'string' },
            onJobReceived: { type: 'string' },
          },
        },
        signature: {
          type: 'object',
          properties: {
            algorithm: { enum: ['SHA-256'] },
            value: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' },
            signer: { type: 'string' },
          },
          required: ['algorithm', 'value'],
        },
      },
    };
  }

  async validateManifest(
    manifest: PluginManifest,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const validate = this.ajv.compile(this.schema);
    const valid = validate(manifest);

    if (!valid) {
      return {
        valid: false,
        errors:
          validate.errors?.map(
            (err) => `${err.instancePath}: ${err.message}`,
          ) || [],
      };
    }

    return { valid: true, errors: [] };
  }

  async verifySignature(
    manifest: PluginManifest,
    pluginPath: string,
  ): Promise<boolean> {
    if (!manifest.signature) {
      return false;
    }

    try {
      const { signature, ...manifestWithoutSig } = manifest;
      const manifestContent = JSON.stringify(manifestWithoutSig, null, 2);

      // Create hash of manifest + plugin files
      const hash = createHash('sha256');
      hash.update(manifestContent);

      // Add plugin files to hash
      const pluginFiles = await this.getPluginFiles(pluginPath);
      for (const file of pluginFiles) {
        hash.update(readFileSync(file));
      }

      const computedHash = hash.digest('hex');
      return computedHash === signature.value;
    } catch (error) {
      return false;
    }
  }

  private async getPluginFiles(pluginPath: string): Promise<string[]> {
    // Implementation to recursively get all plugin files
    // excluding node_modules, .git, etc.
    return [];
  }
}
```

## CI/CD Pipeline Setup

### Overview

Configuration complète du pipeline CI/CD avec GitHub Actions, semantic-release
et quality gates.

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8.6.0'

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping" --health-interval 10s --health-timeout
          5s --health-retries 5

      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: autoweave_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm run type-check

      - name: Lint
        run: pnpm run lint

      - name: Test
        run: pnpm run test:ci
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/autoweave_test
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: pnpm run build

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          file: ./coverage/lcov.info

  sonarcloud:
    needs: test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  security:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  build-and-push:
    needs: [test, sonarcloud, security]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to DockerHub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          token: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: autoweave/autoweave:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: autoweave/autoweave:latest
          format: spdx-json
          output-file: sbom.spdx.json

      - name: Sign image
        uses: sigstore/cosign-installer@v3
        with:
          cosign-release: 'v2.2.0'

      - name: Sign container image
        run: |
          cosign sign --key env://COSIGN_PRIVATE_KEY autoweave/autoweave:latest
        env:
          COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}
          COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}

  release:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm run build

      - name: Release
        run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Semantic Release Configuration

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": true,
        "tarballDir": "dist"
      }
    ],
    [
      "@semantic-release/exec",
      {
        "prepareCmd": "pnpm run build",
        "publishCmd": "docker push autoweave/autoweave:${nextRelease.version}"
      }
    ],
    [
      "@semantic-release/github",
      {
        "assets": [
          {
            "path": "dist/*.tgz",
            "label": "Source distribution"
          },
          {
            "path": "sbom.spdx.json",
            "label": "Software Bill of Materials"
          }
        ]
      }
    ]
  ]
}
```

Ce guide d'implémentation fournit tous les détails techniques nécessaires pour
implémenter chaque composant de l'architecture AutoWeave avec des exemples de
code concrets et des configurations complètes.
