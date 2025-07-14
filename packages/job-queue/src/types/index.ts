// Core job types
export interface AutoWeaveJobData {
  type: JobType;
  payload: any;
  metadata: JobMetadata;
  priority?: number;
  timeout?: number;
  maxRetries?: number;
}

export interface JobMetadata {
  tenantId?: string;
  pluginId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  source: 'usb-daemon' | 'plugin-loader' | 'manual' | 'scheduled' | 'webhook';
  correlationId?: string;
  timestamp: number;
  version: string;
}

export type JobType = 
  // USB Events
  | 'usb.device.attached'
  | 'usb.device.detached'
  | 'usb.scan.complete'
  
  // Plugin Operations
  | 'plugin.load'
  | 'plugin.unload'
  | 'plugin.execute'
  | 'plugin.validate'
  | 'plugin.reload'
  
  // LLM Operations
  | 'llm.batch.process'
  | 'llm.embeddings.generate'
  | 'llm.completion.create'
  
  // System Operations
  | 'system.maintenance'
  | 'system.cleanup'
  | 'system.health.check'
  | 'system.backup'
  
  // Memory Operations
  | 'memory.vectorize'
  | 'memory.index'
  | 'memory.search'
  | 'memory.cleanup';

// Queue configuration
export interface QueueConfiguration {
  name: string;
  redis: RedisConfig;
  defaultJobOptions?: JobOptions;
  settings?: QueueSettings;
  workers?: WorkerPoolConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  lazyConnect?: boolean;
}

export interface JobOptions {
  delay?: number;
  priority?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
  repeat?: RepeatOptions;
  timeout?: number;
}

export interface BackoffOptions {
  type: 'fixed' | 'exponential';
  delay: number;
  settings?: {
    jitter?: boolean;
    maxDelay?: number;
  };
}

export interface RepeatOptions {
  pattern?: string;
  every?: number;
  immediately?: boolean;
  count?: number;
  startDate?: Date | string | number;
  endDate?: Date | string | number;
  tz?: string;
}

export interface QueueSettings {
  stalledInterval?: number;
  maxStalledCount?: number;
  retryProcessDelay?: number;
  maxConcurrency?: number;
}

// Worker configuration
export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  concurrency: number;
  autoScale: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
}

export interface WorkerConfig {
  queueName: string;
  processFunction: ProcessFunction;
  concurrency?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
  settings?: WorkerSettings;
  security?: SecurityConfig;
}

export interface WorkerSettings {
  stalledInterval?: number;
  maxStalledCount?: number;
  retryProcessDelay?: number;
}

export interface SecurityConfig {
  sandboxEnabled: boolean;
  timeoutMs: number;
  memoryLimitMB: number;
  allowedModules: string[];
  blockedModules: string[];
}

// Processing
export type ProcessFunction = (job: JobContext) => Promise<JobResult>;

export interface JobContext {
  id: string;
  data: AutoWeaveJobData;
  progress: (value: number) => void;
  updateProgress: (data: any) => void;
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  timestamp: number;
  attemptsMade: number;
  attemptsTotal: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    processingTime: number;
    memoryUsed: number;
    cpuTime: number;
    retryCount: number;
    timestamp: number;
  };
}

// Monitoring and metrics
export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  completedPerHour: number;
  failedPerHour: number;
  avgProcessingTime: number;
  avgWaitTime: number;
  memoryUsage: number;
  cpuUsage: number;
  workers: WorkerMetrics[];
}

export interface WorkerMetrics {
  id: string;
  isRunning: boolean;
  totalProcessed: number;
  totalFailed: number;
  activeJobs: number;
  memoryUsage: number;
  cpuUsage: number;
  lastActivity: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    redis: boolean;
    queues: Record<string, boolean>;
    workers: Record<string, boolean>;
    memory: boolean;
    cpu: boolean;
  };
  details: {
    uptime: number;
    totalJobs: number;
    queueMetrics: QueueMetrics[];
    errors: string[];
  };
}

// Flow and scheduling
export interface FlowDefinition {
  id: string;
  name: string;
  steps: FlowStep[];
  triggers: FlowTrigger[];
  settings: FlowSettings;
}

export interface FlowStep {
  id: string;
  name: string;
  queueName: string;
  jobType: JobType;
  condition?: FlowCondition;
  retryPolicy?: RetryPolicy;
  dependencies?: string[];
}

export interface FlowTrigger {
  type: 'schedule' | 'event' | 'webhook';
  config: any;
}

export interface FlowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
}

export interface FlowSettings {
  timeout: number;
  maxRetries: number;
  parallelism: number;
  onFailure: 'stop' | 'continue' | 'retry';
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: BackoffOptions;
  retryOn?: string[];
}

// Events
export interface QueueEvent {
  type: string;
  queueName: string;
  jobId?: string;
  data?: any;
  timestamp: number;
  metadata?: any;
}

export interface USBEventData {
  action: 'attach' | 'detach';
  deviceInfo: {
    vendorId: number;
    productId: number;
    manufacturer?: string;
    product?: string;
    serialNumber?: string;
    signature: string;
  };
  timestamp: number;
}

// Error types
export class AutoWeaveJobError extends Error {
  constructor(
    message: string,
    public jobId: string,
    public queueName: string,
    public originalError?: Error,
    public isRetryable: boolean = true
  ) {
    super(message);
    this.name = 'AutoWeaveJobError';
  }
}

export class WorkerError extends Error {
  constructor(
    message: string,
    public workerId: string,
    public queueName: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class QueueManagerError extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'QueueManagerError';
  }
}

// Configuration interfaces
export interface AutoWeaveJobManagerConfig {
  redis: RedisConfig;
  queues: QueueConfiguration[];
  defaultWorkerPool: WorkerPoolConfig;
  monitoring: MonitoringConfig;
  health: HealthConfig;
  security: GlobalSecurityConfig;
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  retentionDays: number;
  alerting?: AlertingConfig;
}

export interface AlertingConfig {
  enabled: boolean;
  thresholds: {
    queueBacklog: number;
    failureRate: number;
    processingTime: number;
    memoryUsage: number;
  };
  webhooks?: string[];
}

export interface HealthConfig {
  checkInterval: number;
  timeout: number;
  retries: number;
}

export interface GlobalSecurityConfig {
  defaultSandbox: SecurityConfig;
  trustedPlugins: string[];
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxExecutionTimeMs: number;
  };
}