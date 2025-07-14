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
const mockMetrics = [
  {
    id: '1',
    name: 'cpu_usage',
    value: 65.5,
    unit: 'percent',
    labels: { host: 'web-server-1', region: 'us-east-1' },
    timestamp: new Date(),
    tenantId: 'tenant-1',
    component: 'system',
    tags: ['system', 'cpu'],
    aggregationType: 'GAUGE',
    description: 'CPU usage percentage',
    threshold: {
      warning: 70,
      critical: 90,
      operator: 'GT'
    },
    history: [
      { timestamp: new Date(Date.now() - 60000), value: 62.3, labels: {} },
      { timestamp: new Date(Date.now() - 30000), value: 67.8, labels: {} }
    ]
  },
  {
    id: '2',
    name: 'memory_usage',
    value: 78.2,
    unit: 'percent',
    labels: { host: 'web-server-1', region: 'us-east-1' },
    timestamp: new Date(),
    tenantId: 'tenant-1',
    component: 'system',
    tags: ['system', 'memory'],
    aggregationType: 'GAUGE',
    description: 'Memory usage percentage',
    threshold: {
      warning: 80,
      critical: 95,
      operator: 'GT'
    },
    history: [
      { timestamp: new Date(Date.now() - 60000), value: 75.5, labels: {} },
      { timestamp: new Date(Date.now() - 30000), value: 76.8, labels: {} }
    ]
  }
];

const mockLogs = [
  {
    id: '1',
    timestamp: new Date(),
    level: 'INFO',
    message: 'Agent started successfully',
    component: 'agent-manager',
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: 'agent-1',
    requestId: 'req-123',
    sessionId: 'sess-456',
    tags: ['startup', 'agent'],
    metadata: { version: '1.0.0', environment: 'production' },
    source: {
      file: 'agent-manager.js',
      line: 145,
      function: 'startAgent',
      host: 'web-server-1',
      service: 'autoweave',
      version: '1.0.0'
    },
    stack: null,
    error: null
  },
  {
    id: '2',
    timestamp: new Date(),
    level: 'ERROR',
    message: 'Failed to connect to database',
    component: 'database',
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: null,
    requestId: 'req-124',
    sessionId: 'sess-456',
    tags: ['database', 'connection'],
    metadata: { host: 'db-server-1', port: 5432 },
    source: {
      file: 'database.js',
      line: 67,
      function: 'connect',
      host: 'web-server-1',
      service: 'autoweave',
      version: '1.0.0'
    },
    stack: 'Error: Connection timeout\n    at connect (database.js:67:15)',
    error: {
      name: 'ConnectionError',
      message: 'Connection timeout',
      stack: 'Error: Connection timeout\n    at connect (database.js:67:15)',
      code: 'ECONNREFUSED',
      details: { host: 'db-server-1', port: 5432 }
    }
  }
];

const mockTraces = [
  {
    id: '1',
    traceId: 'trace-123',
    spanId: 'span-456',
    parentSpanId: null,
    operationName: 'process_agent_request',
    startTime: new Date(Date.now() - 5000),
    endTime: new Date(),
    duration: 5000,
    status: 'OK',
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: 'agent-1',
    tags: { component: 'agent-manager', version: '1.0.0' },
    logs: [
      {
        timestamp: new Date(Date.now() - 4000),
        level: 'INFO',
        message: 'Processing request',
        fields: { requestId: 'req-123' }
      }
    ],
    spans: [
      {
        id: 'span-789',
        traceId: 'trace-123',
        spanId: 'span-789',
        parentSpanId: 'span-456',
        operationName: 'database_query',
        startTime: new Date(Date.now() - 3000),
        endTime: new Date(Date.now() - 1000),
        duration: 2000,
        status: 'OK',
        tags: { query: 'SELECT * FROM agents' },
        logs: [
          {
            timestamp: new Date(Date.now() - 2000),
            level: 'DEBUG',
            message: 'Executing query',
            fields: { sql: 'SELECT * FROM agents' }
          }
        ]
      }
    ],
    errors: []
  }
];

const mockAlerts = [
  {
    id: '1',
    name: 'High CPU Usage',
    description: 'CPU usage is above 80%',
    severity: 'HIGH',
    status: 'ACTIVE',
    condition: {
      metric: 'cpu_usage',
      operator: 'GT',
      threshold: 80,
      duration: 300,
      query: 'cpu_usage{host="web-server-1"}',
      evaluationInterval: 60
    },
    tenantId: 'tenant-1',
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
    triggeredAt: new Date(),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    silencedUntil: null,
    tags: ['system', 'cpu'],
    metadata: { host: 'web-server-1' },
    history: [
      {
        timestamp: new Date(),
        status: 'ACTIVE',
        message: 'Alert triggered',
        triggeredBy: 'system',
        metadata: { value: 85.3 }
      }
    ],
    notifications: [
      {
        id: '1',
        type: 'EMAIL',
        destination: 'admin@example.com',
        message: 'CPU usage is 85.3%',
        sentAt: new Date(),
        status: 'SENT',
        retryCount: 0,
        error: null
      }
    ]
  }
];

const mockDashboards = [
  {
    id: '1',
    name: 'System Overview',
    description: 'System performance metrics',
    tenantId: 'tenant-1',
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
    isPublic: false,
    tags: ['system', 'overview'],
    panels: [
      {
        id: 'panel-1',
        title: 'CPU Usage',
        type: 'GRAPH',
        position: { x: 0, y: 0 },
        size: { width: 12, height: 8 },
        query: 'cpu_usage{host="web-server-1"}',
        visualization: {
          type: 'LINE',
          options: { strokeWidth: 2 },
          legend: { show: true, position: 'BOTTOM', values: ['current', 'max'] },
          axes: {
            x: { label: 'Time', unit: 'time', scale: 'TIME' },
            y: { label: 'Usage', unit: 'percent', min: 0, max: 100, scale: 'LINEAR' }
          },
          colors: ['#ff6b6b', '#4ecdc4']
        },
        options: { decimals: 1 },
        thresholds: [
          { value: 70, color: '#ff9f43', operator: 'GT' },
          { value: 90, color: '#ff6b6b', operator: 'GT' }
        ],
        datasource: 'prometheus'
      }
    ],
    variables: [
      {
        name: 'host',
        type: 'QUERY',
        query: 'label_values(cpu_usage, host)',
        options: ['web-server-1', 'web-server-2'],
        defaultValue: 'web-server-1',
        multiSelect: false
      }
    ],
    timeRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    },
    refreshInterval: 300,
    metadata: { category: 'system' }
  }
];

const mockHealthChecks = [
  {
    id: '1',
    name: 'Database Connection',
    description: 'Check database connectivity',
    endpoint: 'http://db-server:5432/health',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: null,
    timeout: 5000,
    interval: 60,
    retries: 3,
    status: 'HEALTHY',
    tenantId: 'tenant-1',
    createdBy: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
    lastChecked: new Date(),
    lastSuccess: new Date(),
    lastFailure: null,
    uptime: 99.5,
    responseTime: 125.5,
    tags: ['database', 'health'],
    history: [
      {
        timestamp: new Date(),
        status: 'HEALTHY',
        responseTime: 125.5,
        statusCode: 200,
        error: null,
        response: '{"status": "ok"}'
      }
    ]
  }
];

const mockAuditLogs = [
  {
    id: '1',
    timestamp: new Date(),
    tenantId: 'tenant-1',
    userId: 'user-1',
    action: 'CREATE_AGENT',
    resource: 'Agent',
    resourceId: 'agent-1',
    details: { name: 'Web Scraper', type: 'WORKFLOW' },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    sessionId: 'sess-456',
    outcome: 'SUCCESS',
    risk: 'LOW',
    tags: ['agent', 'creation'],
    metadata: { version: '1.0.0' }
  }
];

// GraphQL resolvers
const resolvers: GraphQLResolverMap = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  
  Query: {
    metrics: (parent, args, context) => {
      let metrics = mockMetrics;
      
      if (args.tenantId) {
        metrics = metrics.filter(metric => metric.tenantId === args.tenantId);
      }
      
      return metrics;
    },
    
    systemMetrics: (parent, args) => {
      return {
        cpu: {
          usage: 65.5,
          cores: 8,
          frequency: 2.4,
          temperature: 55.2,
          processes: [
            {
              pid: 1234,
              name: 'node',
              cpu: 15.3,
              memory: 256.5,
              status: 'running',
              command: 'node index.js',
              user: 'autoweave',
              startTime: new Date(Date.now() - 3600000)
            }
          ]
        },
        memory: {
          total: 16384,
          used: 12800,
          free: 3584,
          available: 5120,
          usage: 78.1,
          swap: {
            total: 2048,
            used: 256,
            free: 1792,
            usage: 12.5
          }
        },
        disk: {
          total: 1000000,
          used: 650000,
          free: 350000,
          usage: 65.0,
          iops: 150.5,
          throughput: 1024.0,
          partitions: [
            {
              device: '/dev/sda1',
              mountpoint: '/',
              filesystem: 'ext4',
              total: 500000,
              used: 325000,
              free: 175000,
              usage: 65.0
            }
          ]
        },
        network: {
          bytesIn: 1024000,
          bytesOut: 512000,
          packetsIn: 50000,
          packetsOut: 25000,
          errorsIn: 5,
          errorsOut: 2,
          interfaces: [
            {
              name: 'eth0',
              bytesIn: 1024000,
              bytesOut: 512000,
              packetsIn: 50000,
              packetsOut: 25000,
              errorsIn: 5,
              errorsOut: 2,
              isUp: true
            }
          ]
        },
        processes: {
          total: 156,
          running: 3,
          sleeping: 150,
          stopped: 2,
          zombie: 1,
          threads: 512,
          processes: [
            {
              pid: 1234,
              name: 'node',
              cpu: 15.3,
              memory: 256.5,
              status: 'running',
              command: 'node index.js',
              user: 'autoweave',
              startTime: new Date(Date.now() - 3600000)
            }
          ]
        },
        uptime: 86400,
        loadAverage: [1.2, 1.5, 1.8],
        timestamp: new Date()
      };
    },
    
    logs: (parent, args, context) => {
      let logs = mockLogs;
      
      if (args.tenantId) {
        logs = logs.filter(log => log.tenantId === args.tenantId);
      }
      
      if (args.level) {
        logs = logs.filter(log => log.level === args.level);
      }
      
      if (args.component) {
        logs = logs.filter(log => log.component === args.component);
      }
      
      return logs.slice(0, args.limit || 100);
    },
    
    traces: (parent, args, context) => {
      let traces = mockTraces;
      
      if (args.tenantId) {
        traces = traces.filter(trace => trace.tenantId === args.tenantId);
      }
      
      if (args.operationName) {
        traces = traces.filter(trace => trace.operationName === args.operationName);
      }
      
      return traces;
    },
    
    alerts: (parent, args, context) => {
      let alerts = mockAlerts;
      
      if (args.tenantId) {
        alerts = alerts.filter(alert => alert.tenantId === args.tenantId);
      }
      
      if (args.status) {
        alerts = alerts.filter(alert => alert.status === args.status);
      }
      
      return alerts;
    },
    
    dashboards: (parent, args, context) => {
      let dashboards = mockDashboards;
      
      if (args.tenantId) {
        dashboards = dashboards.filter(dashboard => dashboard.tenantId === args.tenantId);
      }
      
      return dashboards;
    },
    
    dashboard: (parent, args) => {
      return mockDashboards.find(dashboard => dashboard.id === args.id);
    },
    
    healthChecks: (parent, args, context) => {
      let healthChecks = mockHealthChecks;
      
      if (args.tenantId) {
        healthChecks = healthChecks.filter(check => check.tenantId === args.tenantId);
      }
      
      return healthChecks;
    },
    
    performanceReport: (parent, args) => {
      return {
        tenantId: args.tenantId || 'tenant-1',
        timeRange: args.timeRange,
        summary: {
          totalRequests: 10000,
          avgResponseTime: 250.5,
          errorRate: 0.02,
          throughput: 166.7,
          uptime: 99.5,
          bottlenecks: [
            {
              component: 'database',
              type: 'DATABASE',
              severity: 'MEDIUM',
              description: 'Slow query performance',
              impact: 15.3,
              recommendation: 'Add database indexes'
            }
          ]
        },
        agents: [
          {
            agentId: 'agent-1',
            name: 'Web Scraper',
            avgResponseTime: 2500,
            throughput: 25.5,
            errorRate: 0.018,
            cpuUsage: 15.3,
            memoryUsage: 256.5,
            uptime: 98.5
          }
        ],
        queues: [
          {
            queueName: 'web-scraping',
            avgWaitTime: 100,
            throughput: 15.5,
            errorRate: 0.05,
            backlogSize: 25,
            processingTime: 2500
          }
        ],
        plugins: [
          {
            pluginId: 'plugin-1',
            name: 'Web Scraper Plugin',
            avgExecutionTime: 2500,
            throughput: 25.5,
            errorRate: 0.018,
            cpuUsage: 15.3,
            memoryUsage: 128.5
          }
        ],
        system: {
          cpuUsage: 65.5,
          memoryUsage: 78.1,
          diskUsage: 65.0,
          networkUsage: 45.2,
          loadAverage: 1.5,
          uptime: 99.8
        }
      };
    },
    
    auditLogs: (parent, args, context) => {
      let auditLogs = mockAuditLogs;
      
      if (args.tenantId) {
        auditLogs = auditLogs.filter(log => log.tenantId === args.tenantId);
      }
      
      if (args.action) {
        auditLogs = auditLogs.filter(log => log.action === args.action);
      }
      
      return auditLogs;
    }
  },
  
  Mutation: {
    createAlert: async (parent, { input }, context) => {
      const newAlert = {
        id: `alert-${Date.now()}`,
        name: input.name,
        description: input.description || '',
        severity: input.severity,
        status: 'ACTIVE',
        condition: input.condition,
        tenantId: context.user.tenantId,
        createdBy: context.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggeredAt: null,
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolvedAt: null,
        resolvedBy: null,
        silencedUntil: null,
        tags: input.tags || [],
        metadata: {},
        history: [],
        notifications: (input.notifications || []).map((notif: any) => ({
          id: `notif-${Date.now()}`,
          type: notif.type,
          destination: notif.destination,
          message: notif.message || '',
          sentAt: new Date(),
          status: 'PENDING',
          retryCount: 0,
          error: null
        }))
      };
      
      mockAlerts.push(newAlert);
      return newAlert;
    },
    
    updateAlert: async (parent, { id, input }, context) => {
      const alert = mockAlerts.find(a => a.id === id);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      if (input.name) alert.name = input.name;
      if (input.description !== undefined) alert.description = input.description;
      if (input.severity) alert.severity = input.severity;
      if (input.condition) alert.condition = { ...alert.condition, ...input.condition };
      if (input.tags) alert.tags = input.tags;
      
      alert.updatedAt = new Date();
      
      return alert;
    },
    
    deleteAlert: async (parent, { id }, context) => {
      const index = mockAlerts.findIndex(a => a.id === id);
      if (index === -1) {
        throw new Error('Alert not found');
      }
      
      mockAlerts.splice(index, 1);
      return true;
    },
    
    acknowledgeAlert: async (parent, { id }, context) => {
      const alert = mockAlerts.find(a => a.id === id);
      if (!alert) {
        throw new Error('Alert not found');
      }
      
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = context.user.id;
      alert.updatedAt = new Date();
      
      return alert;
    },
    
    createDashboard: async (parent, { input }, context) => {
      const newDashboard = {
        id: `dashboard-${Date.now()}`,
        name: input.name,
        description: input.description || '',
        tenantId: context.user.tenantId,
        createdBy: context.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: input.isPublic || false,
        tags: input.tags || [],
        panels: input.panels.map((panel: any) => ({
          id: panel.id || `panel-${Date.now()}`,
          title: panel.title,
          type: panel.type,
          position: panel.position,
          size: panel.size,
          query: panel.query,
          visualization: panel.visualization,
          options: panel.options || {},
          thresholds: panel.thresholds || [],
          datasource: panel.datasource
        })),
        variables: input.variables || [],
        timeRange: input.timeRange,
        refreshInterval: input.refreshInterval || 300,
        metadata: {}
      };
      
      mockDashboards.push(newDashboard);
      return newDashboard;
    },
    
    updateDashboard: async (parent, { id, input }, context) => {
      const dashboard = mockDashboards.find(d => d.id === id);
      if (!dashboard) {
        throw new Error('Dashboard not found');
      }
      
      if (input.name) dashboard.name = input.name;
      if (input.description !== undefined) dashboard.description = input.description;
      if (input.isPublic !== undefined) dashboard.isPublic = input.isPublic;
      if (input.tags) dashboard.tags = input.tags;
      if (input.panels) dashboard.panels = input.panels;
      if (input.variables) dashboard.variables = input.variables;
      if (input.timeRange) dashboard.timeRange = input.timeRange;
      if (input.refreshInterval) dashboard.refreshInterval = input.refreshInterval;
      
      dashboard.updatedAt = new Date();
      
      return dashboard;
    },
    
    deleteDashboard: async (parent, { id }, context) => {
      const index = mockDashboards.findIndex(d => d.id === id);
      if (index === -1) {
        throw new Error('Dashboard not found');
      }
      
      mockDashboards.splice(index, 1);
      return true;
    },
    
    createHealthCheck: async (parent, { input }, context) => {
      const newHealthCheck = {
        id: `health-${Date.now()}`,
        name: input.name,
        description: input.description || '',
        endpoint: input.endpoint,
        method: input.method || 'GET',
        headers: input.headers || {},
        body: input.body || null,
        timeout: input.timeout || 5000,
        interval: input.interval || 60,
        retries: input.retries || 3,
        status: 'UNKNOWN',
        tenantId: context.user.tenantId,
        createdBy: context.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastChecked: null,
        lastSuccess: null,
        lastFailure: null,
        uptime: 0,
        responseTime: 0,
        tags: input.tags || [],
        history: []
      };
      
      mockHealthChecks.push(newHealthCheck);
      return newHealthCheck;
    },
    
    updateHealthCheck: async (parent, { id, input }, context) => {
      const healthCheck = mockHealthChecks.find(h => h.id === id);
      if (!healthCheck) {
        throw new Error('Health check not found');
      }
      
      if (input.name) healthCheck.name = input.name;
      if (input.description !== undefined) healthCheck.description = input.description;
      if (input.endpoint) healthCheck.endpoint = input.endpoint;
      if (input.method) healthCheck.method = input.method;
      if (input.headers) healthCheck.headers = input.headers;
      if (input.body !== undefined) healthCheck.body = input.body;
      if (input.timeout) healthCheck.timeout = input.timeout;
      if (input.interval) healthCheck.interval = input.interval;
      if (input.retries) healthCheck.retries = input.retries;
      if (input.tags) healthCheck.tags = input.tags;
      
      healthCheck.updatedAt = new Date();
      
      return healthCheck;
    },
    
    deleteHealthCheck: async (parent, { id }, context) => {
      const index = mockHealthChecks.findIndex(h => h.id === id);
      if (index === -1) {
        throw new Error('Health check not found');
      }
      
      mockHealthChecks.splice(index, 1);
      return true;
    },
    
    exportMetrics: async (parent, args, context) => {
      const { tenantId, timeRange, format } = args;
      
      // Mock export
      const data = mockMetrics.filter(m => !tenantId || m.tenantId === tenantId);
      
      switch (format) {
        case 'CSV':
          return 'timestamp,name,value,unit\n' + 
                 data.map(m => `${m.timestamp},${m.name},${m.value},${m.unit}`).join('\n');
        case 'JSON':
          return JSON.stringify(data, null, 2);
        default:
          return JSON.stringify(data, null, 2);
      }
    },
    
    createAuditLog: async (parent, { input }, context) => {
      const newAuditLog = {
        id: `audit-${Date.now()}`,
        timestamp: new Date(),
        tenantId: context.user.tenantId,
        userId: context.user.id,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        details: input.details,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        sessionId: input.sessionId,
        outcome: input.outcome,
        risk: input.risk,
        tags: input.tags || [],
        metadata: {}
      };
      
      mockAuditLogs.push(newAuditLog);
      return newAuditLog;
    }
  },
  
  Metric: {
    __resolveReference: (metric: any) => {
      return mockMetrics.find(m => m.id === metric.id);
    }
  },
  
  LogEntry: {
    __resolveReference: (log: any) => {
      return mockLogs.find(l => l.id === log.id);
    }
  },
  
  Trace: {
    __resolveReference: (trace: any) => {
      return mockTraces.find(t => t.id === trace.id);
    }
  },
  
  Alert: {
    __resolveReference: (alert: any) => {
      return mockAlerts.find(a => a.id === alert.id);
    }
  },
  
  Dashboard: {
    __resolveReference: (dashboard: any) => {
      return mockDashboards.find(d => d.id === dashboard.id);
    }
  },
  
  HealthCheck: {
    __resolveReference: (healthCheck: any) => {
      return mockHealthChecks.find(h => h.id === healthCheck.id);
    }
  },
  
  AuditLog: {
    __resolveReference: (auditLog: any) => {
      return mockAuditLogs.find(a => a.id === auditLog.id);
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
    listen: { port: 4005 },
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

  console.log(`📊 Observability subgraph ready at: ${url}`);
}

if (require.main === module) {
  startServer().catch(console.error);
}

export { resolvers };