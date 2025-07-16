# Sub-Agent Orchestration Architecture

## 🎯 Vision

AutoWeave's sub-agent system enables intelligent task delegation where the main
agent orchestrates specialized sub-agents for complex workflows, providing
scalable, fault-tolerant, and observable agent execution.

## 🏗️ Architecture Overview

### Core Components

```typescript
// Main Orchestrator
class AgentOrchestrator {
  private subAgents: Map<string, SubAgent> = new Map();
  private taskQueue: TaskQueue;
  private eventBus: EventBus;
  private pluginHub: PluginHub;

  async delegateTask(task: Task, targetAgent?: string): Promise<TaskResult> {
    // Intelligent sub-agent selection and task delegation
  }
}

// Sub-Agent Interface
interface SubAgent {
  id: string;
  type: AgentType;
  capabilities: Capability[];
  status: AgentStatus;

  execute(task: Task): Promise<TaskResult>;
  healthCheck(): Promise<HealthStatus>;
}
```

### 1. Plugin-Based Sub-Agent System

Sub-agents are implemented as hot-loadable plugins with strict isolation:

```json
// autoweave.plugin.json
{
  "name": "debugging-sub-agent",
  "version": "1.0.0",
  "type": "sub-agent",
  "capabilities": ["error-analysis", "performance-profiling", "trace-analysis"],
  "permissions": ["memory:read", "telemetry:collect", "logs:access"],
  "resources": {
    "maxMemory": "512MB",
    "maxCpu": "0.5",
    "timeout": "30s"
  }
}
```

### 2. Task Distribution System

**BullMQ-based Job Queue:**

```typescript
// Task types for sub-agent delegation
export enum TaskType {
  ERROR_ANALYSIS = 'agent.debug.error_analysis',
  MEMORY_SEARCH = 'agent.memory.search',
  CODE_GENERATION = 'agent.code.generate',
  API_INTEGRATION = 'agent.integration.api_call',
  PERFORMANCE_ANALYSIS = 'agent.performance.analyze',
}

// Task delegation with priority and routing
class TaskDistributor {
  async distributeTask(task: Task): Promise<void> {
    const targetAgent = await this.selectOptimalAgent(task);

    await this.taskQueue.add(task.type, {
      agentId: targetAgent.id,
      payload: task.payload,
      metadata: {
        parentTaskId: task.parentId,
        priority: task.priority,
        timeout: task.timeout,
      },
    });
  }
}
```

### 3. Communication Protocol

**Event-Driven Architecture:**

```typescript
// Inter-agent communication events
export interface AgentEvent {
  type:
    | 'task.assigned'
    | 'task.completed'
    | 'task.failed'
    | 'agent.status_changed';
  source: string;
  target?: string;
  payload: unknown;
  timestamp: Date;
  traceId: string;
}

// Real-time communication bus
class AgentCommunicationBus {
  async publish(event: AgentEvent): Promise<void> {
    // Redis Streams for real-time delivery
    await this.redis.xAdd('agent:events', '*', event);
  }

  async subscribe(agentId: string, handler: EventHandler): Promise<void> {
    // Subscribe to agent-specific event streams
  }
}
```

## 🔄 Sub-Agent Lifecycle

### 1. Discovery & Registration

```typescript
class SubAgentRegistry {
  async registerSubAgent(manifest: PluginManifest): Promise<void> {
    // Validate capabilities and permissions
    await this.validateCapabilities(manifest);

    // Create Worker Thread isolation
    const worker = await this.createWorker(manifest);

    // Register in capability matrix
    await this.capabilityMatrix.register(manifest.capabilities, worker.id);
  }
}
```

### 2. Task Assignment

```typescript
class TaskRouter {
  async selectAgent(task: Task): Promise<SubAgent> {
    // Capability matching
    const candidateAgents = await this.findByCapabilities(
      task.requiredCapabilities,
    );

    // Load balancing considerations
    const optimalAgent = await this.selectOptimal(candidateAgents, {
      currentLoad: true,
      responseTime: true,
      successRate: true,
    });

    return optimalAgent;
  }
}
```

### 3. Execution Monitoring

```typescript
class ExecutionMonitor {
  async monitorExecution(taskId: string, agentId: string): Promise<void> {
    // OpenTelemetry tracing
    const span = this.tracer.startSpan(`sub-agent.execution`, {
      attributes: {
        'agent.id': agentId,
        'task.id': taskId,
      },
    });

    // Health monitoring
    await this.healthChecker.monitor(agentId);

    // Performance metrics
    await this.metricsCollector.recordExecution(taskId, agentId);
  }
}
```

## 🌐 Integration Points

### 1. Main AutoWeave Integration

```typescript
// Enhanced AutoWeave class with sub-agent support
export class AutoWeave {
  private orchestrator: AgentOrchestrator;

  async createComplexWorkflow(description: string): Promise<Workflow> {
    // Parse complex requirement
    const workflow = await this.workflowParser.parse(description);

    // Delegate tasks to specialized sub-agents
    for (const task of workflow.tasks) {
      await this.orchestrator.delegateTask(task);
    }

    return workflow;
  }
}
```

### 2. GraphQL API Integration

```graphql
type SubAgent {
  id: ID!
  type: AgentType!
  status: AgentStatus!
  capabilities: [Capability!]!
  currentTasks: [Task!]!
  performance: PerformanceMetrics!
}

type Mutation {
  delegateTask(input: TaskInput!): Task!
  createSubAgent(manifest: PluginManifestInput!): SubAgent!
}

type Subscription {
  taskProgress(taskId: ID!): TaskProgress!
  agentStatus(agentId: ID!): AgentStatus!
}
```

## 🔍 Observability & Monitoring

### 1. Distributed Tracing

```typescript
// OpenTelemetry instrumentation for sub-agent workflows
class SubAgentTracing {
  async instrumentTask(task: Task): Promise<void> {
    const span = this.tracer.startSpan('sub-agent.task', {
      attributes: {
        'task.type': task.type,
        'agent.id': task.assignedAgent,
        'workflow.id': task.workflowId,
      },
    });

    // Trace delegation chain
    span.addEvent('task.delegated');

    // Link parent-child task relationships
    span.setAttributes({
      'parent.task.id': task.parentTaskId,
    });
  }
}
```

### 2. Performance Metrics

```typescript
// Prometheus metrics for sub-agent system
const metrics = {
  taskExecutionDuration: new Histogram({
    name: 'sub_agent_task_duration_seconds',
    help: 'Task execution duration by agent type',
    labelNames: ['agent_type', 'task_type'],
  }),

  agentUtilization: new Gauge({
    name: 'sub_agent_utilization_percent',
    help: 'Current utilization of sub-agents',
    labelNames: ['agent_id', 'agent_type'],
  }),

  taskSuccessRate: new Counter({
    name: 'sub_agent_task_success_total',
    help: 'Number of successful task executions',
    labelNames: ['agent_type', 'status'],
  }),
};
```

## 🔧 Implementation Example

### Scenario: Complex Debugging Workflow

```typescript
// Main agent receives complex debugging request
const debuggingWorkflow = await autoweave.createAgent(`
  Analyze a critical production issue:
  1. Parse error logs for patterns
  2. Trace through distributed system calls
  3. Analyze performance bottlenecks
  4. Generate fix recommendations
  5. Create deployment plan
`);

// Sub-agent delegation
const subTasks = [
  {
    type: TaskType.ERROR_ANALYSIS,
    targetAgent: 'log-analysis-agent',
    input: { logs: errorLogs, timeRange: '24h' },
  },
  {
    type: TaskType.TRACE_ANALYSIS,
    targetAgent: 'tracing-agent',
    input: { traceId: 'abc123', service: 'payment-api' },
  },
  {
    type: TaskType.PERFORMANCE_ANALYSIS,
    targetAgent: 'performance-agent',
    input: { metrics: performanceData, baseline: 'last_week' },
  },
];

// Parallel execution with coordination
const results = await Promise.all(
  subTasks.map((task) => orchestrator.delegateTask(task)),
);

// Synthesis by main agent
const finalAnalysis = await orchestrator.synthesizeResults(results);
```

## 🚀 Benefits

### 1. **Scalability**

- Horizontal scaling through plugin architecture
- Load distribution across specialized agents
- Dynamic resource allocation

### 2. **Fault Tolerance**

- Worker Thread isolation prevents cascading failures
- Retry mechanisms with exponential backoff
- Circuit breaker patterns for failing agents

### 3. **Observability**

- End-to-end tracing across agent boundaries
- Real-time performance monitoring
- Detailed execution analytics

### 4. **Flexibility**

- Hot-pluggable sub-agent modules
- Dynamic capability discovery
- Version-controlled agent updates

## 📋 Implementation Roadmap

### Phase 1: Foundation (Sprint T-3)

- [ ] BullMQ task queue implementation
- [ ] Basic plugin loading system
- [ ] Worker Thread isolation

### Phase 2: Communication (Sprint T-4)

- [ ] Event bus implementation
- [ ] Inter-agent messaging protocol
- [ ] Task routing system

### Phase 3: Observability (Sprint T-5)

- [ ] OpenTelemetry integration
- [ ] Performance monitoring
- [ ] Health check system

### Phase 4: Intelligence (Sprint T-6)

- [ ] Optimal agent selection algorithms
- [ ] Load balancing strategies
- [ ] Predictive scaling

Avec cette architecture, **oui, AutoWeave peut absolument exécuter des
sous-agents** de manière intelligente, scalable et observable. La fondation est
maintenant prête avec Sprint T-2 complété !
