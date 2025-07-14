// Generic types to avoid BullMQ dependency in types
export interface GenericJob<T = any> {
  id: string | undefined;
  data: T;
  opts: any;
}

export interface GenericJobsOptions {
  delay?: number;
  priority?: number;
  attempts?: number;
  backoff?: {
    type: string;
    delay: number;
  };
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
  repeat?: GenericRepeatOptions;
}

export interface GenericRepeatOptions {
  pattern?: string;
  every?: number;
  immediately?: boolean;
  count?: number;
  startDate?: Date | string | number;
  endDate?: Date | string | number;
  tz?: string;
}

export type JobType = 
  | 'agent.create'
  | 'memory.vectorize'
  | 'llm.batch'
  | 'plugin.load'
  | 'plugin.unload'
  | 'system.cleanup'
  | 'usb.process';

export interface AutoWeaveJobData {
  type: JobType;
  payload: any;
  metadata?: {
    tenantId?: string;
    pluginId?: string;
    userId?: string;
    traceId?: string;
    spanId?: string;
  };
}

export interface JobConfig {
  name: string;
  data: AutoWeaveJobData;
  options?: GenericJobsOptions;
}

export interface FlowConfig {
  name: string;
  children: Array<{
    name: string;
    queueName: string;
    data: AutoWeaveJobData;
    options?: GenericJobsOptions;
  }>;
}

export interface RepeatableJobConfig {
  name: string;
  data: AutoWeaveJobData;
  repeat: GenericRepeatOptions;
  options?: GenericJobsOptions;
}

export interface QueueConfig {
  name: string;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  defaultJobOptions?: GenericJobsOptions;
  settings?: {
    stalledInterval?: number;
    maxStalledCount?: number;
  };
}

export interface WorkerConfig {
  queueName: string;
  concurrency?: number;
  processor: string | ((job: GenericJob<AutoWeaveJobData>) => Promise<any>);
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    processingTime: number;
    retryCount: number;
    timestamp: number;
  };
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}