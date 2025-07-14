import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper';
import { GraphQLScalarType, Kind } from 'graphql';

// GraphQL scalar types
const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date-time string',
  serialize: (value: Date) => value.toISOString(),
  parseValue: (value: string) => new Date(value),
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON scalar type',
  serialize: (value: any) => value,
  parseValue: (value: any) => value,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) {
      return JSON.parse(ast.value);
    }
    return null;
  },
});

// Mock data
const mockJobs = [
  {
    id: '1',
    name: 'Process Web Scraping',
    queueName: 'web-scraping',
    data: { url: 'https://example.com', selector: '.content' },
    options: {
      attempts: 3,
      backoff: { type: 'EXPONENTIAL', delay: 1000, factor: 2.0, maxDelay: 10000 },
      delay: 0,
      priority: 0,
      removeOnComplete: 100,
      removeOnFail: 50,
      timeout: 30000,
      ttl: 0,
      jobId: null
    },
    status: 'ACTIVE',
    progress: {
      current: 50,
      total: 100,
      percentage: 50.0,
      message: 'Processing items...',
      data: { processed: 50, errors: 0 },
      timestamp: new Date()
    },
    result: null,
    error: null,
    attempts: 1,
    maxAttempts: 3,
    delay: 0,
    priority: 0,
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: 'agent-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    processedAt: new Date('2024-01-01T00:00:00Z'),
    finishedAt: null,
    failedAt: null,
    logs: [],
    dependencies: [],
    dependents: [],
    tags: ['web-scraping', 'data-collection'],
    isActive: true,
    nextRunAt: null,
    repeatOptions: null
  },
  {
    id: '2',
    name: 'Generate Report',
    queueName: 'reports',
    data: { reportType: 'weekly', filters: { dateRange: '2024-01-01' } },
    options: {
      attempts: 3,
      delay: 0,
      priority: 1,
      removeOnComplete: 100,
      removeOnFail: 50,
      timeout: 60000,
      ttl: 0,
      jobId: null
    },
    status: 'COMPLETED',
    progress: {
      current: 100,
      total: 100,
      percentage: 100.0,
      message: 'Report generated successfully',
      data: { reportId: 'report-123' },
      timestamp: new Date()
    },
    result: { reportId: 'report-123', url: '/reports/report-123.pdf' },
    error: null,
    attempts: 1,
    maxAttempts: 3,
    delay: 0,
    priority: 1,
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: 'agent-2',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    processedAt: new Date('2024-01-01T00:00:00Z'),
    finishedAt: new Date('2024-01-01T00:00:00Z'),
    failedAt: null,
    logs: [],
    dependencies: [],
    dependents: [],
    tags: ['reports', 'analytics'],
    isActive: true,
    nextRunAt: null,
    repeatOptions: null
  }
];

const mockQueues = [
  {
    name: 'web-scraping',
    displayName: 'Web Scraping Queue',
    description: 'Queue for web scraping jobs',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
    settings: {
      maxConcurrency: 5,
      rateLimiter: { max: 100, duration: 60000, bounceBack: false },
      retrySettings: {
        maxAttempts: 3,
        backoffType: 'EXPONENTIAL',
        backoffDelay: 1000,
        backoffFactor: 2.0,
        maxBackoffDelay: 30000
      },
      deadLetterSettings: {
        enabled: true,
        maxRetries: 3,
        queueName: 'dead-letter'
      },
      cleanupSettings: {
        removeOnComplete: 100,
        removeOnFail: 50,
        maxAge: 86400,
        maxCount: 1000
      }
    },
    stats: {
      totalJobs: 1,
      activeJobs: 1,
      waitingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      delayedJobs: 0,
      pausedJobs: 0,
      throughput: 15.5,
      avgProcessingTime: 2500,
      avgWaitTime: 100,
      errorRate: 0.05,
      timestamp: new Date()
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true,
    isPaused: false,
    concurrency: 5,
    rateLimiter: {
      max: 100,
      duration: 60000,
      bounceBack: false,
      current: 25,
      resetTime: new Date(Date.now() + 60000)
    }
  },
  {
    name: 'reports',
    displayName: 'Reports Queue',
    description: 'Queue for report generation jobs',
    tenantId: 'tenant-1',
    status: 'ACTIVE',
    settings: {
      maxConcurrency: 3,
      retrySettings: {
        maxAttempts: 3,
        backoffType: 'EXPONENTIAL',
        backoffDelay: 1000,
        backoffFactor: 2.0,
        maxBackoffDelay: 30000
      },
      deadLetterSettings: {
        enabled: true,
        maxRetries: 3,
        queueName: 'dead-letter'
      },
      cleanupSettings: {
        removeOnComplete: 100,
        removeOnFail: 50,
        maxAge: 86400,
        maxCount: 1000
      }
    },
    stats: {
      totalJobs: 1,
      activeJobs: 0,
      waitingJobs: 0,
      completedJobs: 1,
      failedJobs: 0,
      delayedJobs: 0,
      pausedJobs: 0,
      throughput: 8.3,
      avgProcessingTime: 5000,
      avgWaitTime: 200,
      errorRate: 0.02,
      timestamp: new Date()
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true,
    isPaused: false,
    concurrency: 3,
    rateLimiter: null
  }
];

const mockWorkers = [
  {
    id: '1',
    name: 'web-scraping-worker-1',
    queueName: 'web-scraping',
    status: 'ACTIVE',
    currentJob: mockJobs[0],
    processedJobs: 150,
    failedJobs: 3,
    lastActive: new Date(),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    host: 'worker-node-1',
    pid: 1234,
    memory: {
      used: 512.5,
      total: 1024.0,
      percentage: 50.0
    },
    cpu: {
      usage: 45.2,
      loadAverage: [1.2, 1.5, 1.8]
    }
  }
];

// GraphQL resolvers
const resolvers: GraphQLResolverMap = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  
  Query: {
    jobs: (parent, args, context) => {
      let jobs = mockJobs;
      
      if (args.tenantId) {
        jobs = jobs.filter(job => job.tenantId === args.tenantId);
      }
      
      if (args.queueName) {
        jobs = jobs.filter(job => job.queueName === args.queueName);
      }
      
      if (args.status) {
        jobs = jobs.filter(job => job.status === args.status);
      }
      
      return jobs;
    },
    
    job: (parent, args) => {
      return mockJobs.find(job => job.id === args.id);
    },
    
    queues: (parent, args, context) => {
      let queues = mockQueues;
      
      if (args.tenantId) {
        queues = queues.filter(queue => queue.tenantId === args.tenantId);
      }
      
      return queues;
    },
    
    queue: (parent, args) => {
      return mockQueues.find(queue => queue.name === args.name);
    },
    
    queueStats: (parent, args) => {
      const { tenantId } = args;
      const tenantQueues = mockQueues.filter(q => !tenantId || q.tenantId === tenantId);
      
      return {
        totalJobs: tenantQueues.reduce((sum, q) => sum + q.stats.totalJobs, 0),
        activeJobs: tenantQueues.reduce((sum, q) => sum + q.stats.activeJobs, 0),
        waitingJobs: tenantQueues.reduce((sum, q) => sum + q.stats.waitingJobs, 0),
        completedJobs: tenantQueues.reduce((sum, q) => sum + q.stats.completedJobs, 0),
        failedJobs: tenantQueues.reduce((sum, q) => sum + q.stats.failedJobs, 0),
        delayedJobs: tenantQueues.reduce((sum, q) => sum + q.stats.delayedJobs, 0),
        pausedJobs: tenantQueues.reduce((sum, q) => sum + q.stats.pausedJobs, 0),
        throughput: tenantQueues.reduce((sum, q) => sum + q.stats.throughput, 0) / tenantQueues.length,
        avgProcessingTime: tenantQueues.reduce((sum, q) => sum + q.stats.avgProcessingTime, 0) / tenantQueues.length,
        avgWaitTime: tenantQueues.reduce((sum, q) => sum + q.stats.avgWaitTime, 0) / tenantQueues.length,
        errorRate: tenantQueues.reduce((sum, q) => sum + q.stats.errorRate, 0) / tenantQueues.length,
        timestamp: new Date()
      };
    },
    
    jobMetrics: (parent, args) => {
      const { queueName, timeRange } = args;
      const queue = mockQueues.find(q => q.name === queueName);
      
      if (!queue) {
        throw new Error('Queue not found');
      }
      
      return {
        queueName,
        timeRange,
        totalJobs: queue.stats.totalJobs,
        completedJobs: queue.stats.completedJobs,
        failedJobs: queue.stats.failedJobs,
        avgProcessingTime: queue.stats.avgProcessingTime,
        avgWaitTime: queue.stats.avgWaitTime,
        throughput: queue.stats.throughput,
        errorRate: queue.stats.errorRate,
        distribution: [
          { status: 'COMPLETED', count: queue.stats.completedJobs, percentage: 80 },
          { status: 'FAILED', count: queue.stats.failedJobs, percentage: 10 },
          { status: 'ACTIVE', count: queue.stats.activeJobs, percentage: 10 }
        ],
        timeline: [
          {
            timestamp: new Date(Date.now() - 60000),
            completed: 10,
            failed: 1,
            active: 2,
            waiting: 5
          }
        ]
      };
    },
    
    deadLetterJobs: (parent, args) => {
      // Mock dead letter jobs
      return mockJobs.filter(job => job.status === 'FAILED' && job.attempts >= job.maxAttempts);
    }
  },
  
  Mutation: {
    createJob: async (parent, { input }, context) => {
      const newJob = {
        id: `job-${Date.now()}`,
        name: input.name,
        queueName: input.queueName,
        data: input.data,
        options: input.options || {
          attempts: 3,
          delay: 0,
          priority: 0,
          removeOnComplete: 100,
          removeOnFail: 50,
          timeout: 30000,
          ttl: 0,
          jobId: null
        },
        status: 'WAITING',
        progress: {
          current: 0,
          total: 100,
          percentage: 0,
          message: 'Job queued',
          data: null,
          timestamp: new Date()
        },
        result: null,
        error: null,
        attempts: 0,
        maxAttempts: input.options?.attempts || 3,
        delay: input.options?.delay || 0,
        priority: input.options?.priority || 0,
        tenantId: context.user.tenantId,
        userId: context.user.id,
        agentId: input.agentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        processedAt: null,
        finishedAt: null,
        failedAt: null,
        logs: [],
        dependencies: [],
        dependents: [],
        tags: input.tags || [],
        isActive: true,
        nextRunAt: null,
        repeatOptions: input.options?.repeat || null
      };
      
      mockJobs.push(newJob);
      return newJob;
    },
    
    updateJob: async (parent, { id, input }, context) => {
      const job = mockJobs.find(j => j.id === id);
      if (!job) {
        throw new Error('Job not found');
      }
      
      if (input.data) job.data = { ...job.data, ...input.data };
      if (input.options) job.options = { ...job.options, ...input.options };
      if (input.tags) job.tags = input.tags;
      
      job.updatedAt = new Date();
      
      return job;
    },
    
    deleteJob: async (parent, { id }, context) => {
      const index = mockJobs.findIndex(j => j.id === id);
      if (index === -1) {
        throw new Error('Job not found');
      }
      
      mockJobs.splice(index, 1);
      return true;
    },
    
    retryJob: async (parent, { id }, context) => {
      const job = mockJobs.find(j => j.id === id);
      if (!job) {
        throw new Error('Job not found');
      }
      
      job.status = 'WAITING';
      job.attempts = 0;
      job.error = null;
      job.failedAt = null;
      job.updatedAt = new Date();
      
      return job;
    },
    
    cancelJob: async (parent, { id }, context) => {
      const job = mockJobs.find(j => j.id === id);
      if (!job) {
        throw new Error('Job not found');
      }
      
      job.status = 'CANCELLED';
      job.updatedAt = new Date();
      
      return job;
    },
    
    pauseQueue: async (parent, { name }, context) => {
      const queue = mockQueues.find(q => q.name === name);
      if (!queue) {
        throw new Error('Queue not found');
      }
      
      queue.status = 'PAUSED';
      queue.isPaused = true;
      queue.updatedAt = new Date();
      
      return queue;
    },
    
    resumeQueue: async (parent, { name }, context) => {
      const queue = mockQueues.find(q => q.name === name);
      if (!queue) {
        throw new Error('Queue not found');
      }
      
      queue.status = 'ACTIVE';
      queue.isPaused = false;
      queue.updatedAt = new Date();
      
      return queue;
    },
    
    purgeQueue: async (parent, { name }, context) => {
      const jobsToRemove = mockJobs.filter(j => j.queueName === name);
      const removedCount = jobsToRemove.length;
      
      jobsToRemove.forEach(job => {
        const index = mockJobs.indexOf(job);
        if (index > -1) {
          mockJobs.splice(index, 1);
        }
      });
      
      return removedCount;
    },
    
    createQueue: async (parent, { input }, context) => {
      const newQueue = {
        name: input.name,
        displayName: input.displayName,
        description: input.description || '',
        tenantId: context.user.tenantId,
        status: 'ACTIVE',
        settings: input.settings,
        stats: {
          totalJobs: 0,
          activeJobs: 0,
          waitingJobs: 0,
          completedJobs: 0,
          failedJobs: 0,
          delayedJobs: 0,
          pausedJobs: 0,
          throughput: 0,
          avgProcessingTime: 0,
          avgWaitTime: 0,
          errorRate: 0,
          timestamp: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
        isPaused: false,
        concurrency: input.settings.maxConcurrency,
        rateLimiter: input.settings.rateLimiter ? {
          max: input.settings.rateLimiter.max,
          duration: input.settings.rateLimiter.duration,
          bounceBack: input.settings.rateLimiter.bounceBack,
          current: 0,
          resetTime: new Date(Date.now() + input.settings.rateLimiter.duration)
        } : null
      };
      
      mockQueues.push(newQueue);
      return newQueue;
    },
    
    updateQueue: async (parent, { name, input }, context) => {
      const queue = mockQueues.find(q => q.name === name);
      if (!queue) {
        throw new Error('Queue not found');
      }
      
      if (input.displayName) queue.displayName = input.displayName;
      if (input.description !== undefined) queue.description = input.description;
      if (input.settings) queue.settings = { ...queue.settings, ...input.settings };
      
      queue.updatedAt = new Date();
      
      return queue;
    },
    
    deleteQueue: async (parent, { name }, context) => {
      const index = mockQueues.findIndex(q => q.name === name);
      if (index === -1) {
        throw new Error('Queue not found');
      }
      
      mockQueues.splice(index, 1);
      return true;
    },
    
    bulkRetryJobs: async (parent, { queueName, jobIds }, context) => {
      let retriedCount = 0;
      
      jobIds.forEach((jobId: string) => {
        const job = mockJobs.find(j => j.id === jobId && j.queueName === queueName);
        if (job) {
          job.status = 'WAITING';
          job.attempts = 0;
          job.error = null;
          job.failedAt = null;
          job.updatedAt = new Date();
          retriedCount++;
        }
      });
      
      return retriedCount;
    },
    
    rescheduleJob: async (parent, { id, delay }, context) => {
      const job = mockJobs.find(j => j.id === id);
      if (!job) {
        throw new Error('Job not found');
      }
      
      job.status = 'DELAYED';
      job.delay = delay;
      job.nextRunAt = new Date(Date.now() + delay);
      job.updatedAt = new Date();
      
      return job;
    }
  },
  
  Job: {
    __resolveReference: (job: any) => {
      return mockJobs.find(j => j.id === job.id);
    }
  },
  
  Queue: {
    __resolveReference: (queue: any) => {
      return mockQueues.find(q => q.name === queue.name);
    },
    
    jobs: (queue) => {
      return mockJobs.filter(j => j.queueName === queue.name);
    },
    
    workers: (queue) => {
      return mockWorkers.filter(w => w.queueName === queue.name);
    }
  },
  
  Worker: {
    __resolveReference: (worker: any) => {
      return mockWorkers.find(w => w.id === worker.id);
    }
  }
};

// Create Apollo Server
async function startServer() {
  const typeDefs = readFileSync(join(__dirname, 'schema.graphql'), 'utf8');
  
  const server = new ApolloServer({
    schema: buildSubgraphSchema({
      typeDefs,
      resolvers
    })
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4003 },
    context: async ({ req }) => {
      return {
        user: {
          id: 'user-1',
          tenantId: 'tenant-1',
          roles: [{ name: 'Developer' }]
        }
      };
    }
  });

  console.log(`📋 Queue subgraph ready at: ${url}`);
}

if (require.main === module) {
  startServer().catch(console.error);
}

export { resolvers };