/**
 * Sub-Agent Communication Protocol
 * 
 * This module implements the communication layer between the main AutoWeave
 * orchestrator and specialized sub-agents, enabling distributed task execution
 * with full observability and fault tolerance.
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface SubAgentManifest {
  name: string;
  version: string;
  type: 'sub-agent';
  capabilities: Capability[];
  permissions: Permission[];
  resources: ResourceConstraints;
  entry: string;
  hooks: {
    onLoad?: boolean;
    onUnload?: boolean;
    onError?: boolean;
  };
}

export interface Capability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
}

export interface Permission {
  resource: 'memory' | 'telemetry' | 'logs' | 'queue' | 'llm';
  operations: ('read' | 'write' | 'execute')[];
}

export interface ResourceConstraints {
  maxMemory: string; // e.g., "512MB"
  maxCpu: string;    // e.g., "0.5"
  timeout: string;   // e.g., "30s"
}

export interface Task {
  id: string;
  type: TaskType;
  payload: unknown;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  parentTaskId?: string;
  workflowId?: string;
  requiredCapabilities: string[];
  metadata: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'error' | 'timeout';
  result?: unknown;
  error?: Error;
  executionTime: number;
  agentId: string;
  metadata: Record<string, unknown>;
}

export enum TaskType {
  ERROR_ANALYSIS = 'agent.debug.error_analysis',
  MEMORY_SEARCH = 'agent.memory.search',
  CODE_GENERATION = 'agent.code.generate',
  API_INTEGRATION = 'agent.integration.api_call',
  PERFORMANCE_ANALYSIS = 'agent.performance.analyze',
  TRACE_ANALYSIS = 'agent.debug.trace_analysis'
}

export interface AgentEvent {
  type: 'task.assigned' | 'task.completed' | 'task.failed' | 'agent.status_changed' | 'agent.registered' | 'agent.unregistered';
  source: string;
  target?: string;
  payload: unknown;
  timestamp: Date;
  traceId: string;
}

export interface SubAgent {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: Capability[];
  currentTasks: string[];
  performance: PerformanceMetrics;
  
  execute(task: Task): Promise<TaskResult>;
  healthCheck(): Promise<HealthStatus>;
  shutdown(): Promise<void>;
}

export interface PerformanceMetrics {
  tasksCompleted: number;
  averageExecutionTime: number;
  successRate: number;
  lastActivity: Date;
  memoryUsage: number;
  cpuUsage: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errors: string[];
  lastCheck: Date;
}

// ============================================================================
// AGENT ORCHESTRATOR
// ============================================================================

export class AgentOrchestrator extends EventEmitter {
  private subAgents: Map<string, SubAgent> = new Map();
  private taskQueue: TaskQueue;
  private eventBus: AgentCommunicationBus;
  private capabilityMatrix: Map<string, string[]> = new Map();
  private performanceTracker: PerformanceTracker;

  constructor() {
    super();
    this.taskQueue = new TaskQueue();
    this.eventBus = new AgentCommunicationBus();
    this.performanceTracker = new PerformanceTracker();
    
    this.setupEventHandlers();
  }

  /**
   * Register a new sub-agent in the orchestration system
   */
  async registerSubAgent(manifest: SubAgentManifest, agent: SubAgent): Promise<void> {
    // Validate manifest
    await this.validateManifest(manifest);
    
    // Register capabilities
    for (const capability of manifest.capabilities) {
      const agents = this.capabilityMatrix.get(capability.name) || [];
      agents.push(agent.id);
      this.capabilityMatrix.set(capability.name, agents);
    }
    
    // Store agent reference
    this.subAgents.set(agent.id, agent);
    
    // Emit registration event
    await this.eventBus.publish({
      type: 'agent.registered',
      source: 'orchestrator',
      payload: { agentId: agent.id, capabilities: manifest.capabilities },
      timestamp: new Date(),
      traceId: this.generateTraceId()
    });
    
    console.log(`✅ Sub-agent registered: ${agent.id} with capabilities: ${manifest.capabilities.map(c => c.name).join(', ')}`);
  }

  /**
   * Intelligently delegate a task to the optimal sub-agent
   */
  async delegateTask(task: Task): Promise<TaskResult> {
    const traceId = this.generateTraceId();
    
    try {
      // Find capable agents
      const candidateAgents = await this.findCapableAgents(task.requiredCapabilities);
      
      if (candidateAgents.length === 0) {
        throw new Error(`No agents found with required capabilities: ${task.requiredCapabilities.join(', ')}`);
      }
      
      // Select optimal agent using load balancing and performance metrics
      const selectedAgent = await this.selectOptimalAgent(candidateAgents, task);
      
      // Publish task assignment event
      await this.eventBus.publish({
        type: 'task.assigned',
        source: 'orchestrator',
        target: selectedAgent.id,
        payload: { task, agentId: selectedAgent.id },
        timestamp: new Date(),
        traceId
      });
      
      // Execute task with monitoring
      const result = await this.executeTaskWithMonitoring(task, selectedAgent, traceId);
      
      // Update performance metrics
      await this.performanceTracker.recordExecution(selectedAgent.id, result);
      
      return result;
      
    } catch (error) {
      // Emit failure event
      await this.eventBus.publish({
        type: 'task.failed',
        source: 'orchestrator',
        payload: { taskId: task.id, error: error.message },
        timestamp: new Date(),
        traceId
      });
      
      throw error;
    }
  }

  /**
   * Create and manage complex multi-agent workflows
   */
  async createWorkflow(tasks: Task[]): Promise<TaskResult[]> {
    const workflowId = this.generateWorkflowId();
    const results: TaskResult[] = [];
    
    // Assign workflow ID to all tasks
    tasks.forEach(task => {
      task.workflowId = workflowId;
    });
    
    // Execute tasks based on dependencies (simplified parallel execution for now)
    const taskPromises = tasks.map(task => this.delegateTask(task));
    
    try {
      const workflowResults = await Promise.all(taskPromises);
      results.push(...workflowResults);
      
      console.log(`✅ Workflow ${workflowId} completed successfully with ${results.length} tasks`);
      return results;
      
    } catch (error) {
      console.error(`❌ Workflow ${workflowId} failed:`, error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async findCapableAgents(requiredCapabilities: string[]): Promise<SubAgent[]> {
    const capableAgents: Set<string> = new Set();
    
    for (const capability of requiredCapabilities) {
      const agents = this.capabilityMatrix.get(capability) || [];
      agents.forEach(agentId => capableAgents.add(agentId));
    }
    
    return Array.from(capableAgents)
      .map(agentId => this.subAgents.get(agentId))
      .filter(agent => agent && agent.status !== 'offline') as SubAgent[];
  }

  private async selectOptimalAgent(candidates: SubAgent[], task: Task): Promise<SubAgent> {
    // Score agents based on multiple factors
    const scoredAgents = candidates.map(agent => ({
      agent,
      score: this.calculateAgentScore(agent, task)
    }));
    
    // Sort by score (highest first)
    scoredAgents.sort((a, b) => b.score - a.score);
    
    return scoredAgents[0].agent;
  }

  private calculateAgentScore(agent: SubAgent, task: Task): number {
    let score = 0;
    
    // Factor 1: Current load (less is better)
    const loadFactor = Math.max(0, 1 - (agent.currentTasks.length / 10));
    score += loadFactor * 0.4;
    
    // Factor 2: Success rate
    score += agent.performance.successRate * 0.3;
    
    // Factor 3: Average execution time (faster is better)
    const speedFactor = Math.max(0, 1 - (agent.performance.averageExecutionTime / 30000)); // 30s baseline
    score += speedFactor * 0.2;
    
    // Factor 4: Priority matching
    if (task.priority === 'critical' && agent.status === 'idle') {
      score += 0.1;
    }
    
    return score;
  }

  private async executeTaskWithMonitoring(task: Task, agent: SubAgent, traceId: string): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // Add task to agent's current tasks
      agent.currentTasks.push(task.id);
      
      // Execute task
      const result = await agent.execute(task);
      
      // Remove task from current tasks
      const taskIndex = agent.currentTasks.indexOf(task.id);
      if (taskIndex > -1) {
        agent.currentTasks.splice(taskIndex, 1);
      }
      
      // Publish completion event
      await this.eventBus.publish({
        type: 'task.completed',
        source: agent.id,
        payload: { task, result },
        timestamp: new Date(),
        traceId
      });
      
      return result;
      
    } catch (error) {
      // Remove task from current tasks on error
      const taskIndex = agent.currentTasks.indexOf(task.id);
      if (taskIndex > -1) {
        agent.currentTasks.splice(taskIndex, 1);
      }
      
      // Create error result
      const errorResult: TaskResult = {
        taskId: task.id,
        status: 'error',
        error: error as Error,
        executionTime: Date.now() - startTime,
        agentId: agent.id,
        metadata: { traceId }
      };
      
      await this.eventBus.publish({
        type: 'task.failed',
        source: agent.id,
        payload: { task, error: error.message },
        timestamp: new Date(),
        traceId
      });
      
      return errorResult;
    }
  }

  private async validateManifest(manifest: SubAgentManifest): Promise<void> {
    if (!manifest.name || !manifest.version || !manifest.capabilities) {
      throw new Error('Invalid manifest: missing required fields');
    }
    
    if (manifest.capabilities.length === 0) {
      throw new Error('Sub-agent must declare at least one capability');
    }
  }

  private setupEventHandlers(): void {
    this.eventBus.on('agent.status_changed', (event: AgentEvent) => {
      console.log(`🔄 Agent status changed: ${event.source} -> ${event.payload}`);
    });
    
    this.eventBus.on('task.completed', (event: AgentEvent) => {
      console.log(`✅ Task completed by ${event.source}`);
    });
    
    this.eventBus.on('task.failed', (event: AgentEvent) => {
      console.log(`❌ Task failed in ${event.source}:`, event.payload);
    });
  }

  private generateTraceId(): string {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// COMMUNICATION BUS
// ============================================================================

export class AgentCommunicationBus extends EventEmitter {
  private eventHistory: AgentEvent[] = [];
  
  async publish(event: AgentEvent): Promise<void> {
    // Store event in history
    this.eventHistory.push(event);
    
    // Emit for local listeners
    this.emit(event.type, event);
    
    // In production, this would publish to Redis Streams
    console.log(`📡 Event published: ${event.type} from ${event.source}`);
  }
  
  async subscribe(eventType: string, handler: (event: AgentEvent) => void): Promise<void> {
    this.on(eventType, handler);
  }
  
  getEventHistory(agentId?: string): AgentEvent[] {
    if (agentId) {
      return this.eventHistory.filter(event => 
        event.source === agentId || event.target === agentId
      );
    }
    return this.eventHistory;
  }
}

// ============================================================================
// TASK QUEUE (Simplified implementation - would use BullMQ in production)
// ============================================================================

export class TaskQueue {
  private queue: Task[] = [];
  private processing: boolean = false;
  
  async add(task: Task): Promise<void> {
    this.queue.push(task);
    this.queue.sort((a, b) => this.getPriorityValue(b.priority) - this.getPriorityValue(a.priority));
  }
  
  async getNext(): Promise<Task | null> {
    return this.queue.shift() || null;
  }
  
  private getPriorityValue(priority: string): number {
    const values = { critical: 4, high: 3, medium: 2, low: 1 };
    return values[priority] || 1;
  }
}

// ============================================================================
// PERFORMANCE TRACKER
// ============================================================================

export class PerformanceTracker {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  
  async recordExecution(agentId: string, result: TaskResult): Promise<void> {
    const existing = this.metrics.get(agentId) || {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      successRate: 0,
      lastActivity: new Date(),
      memoryUsage: 0,
      cpuUsage: 0
    };
    
    existing.tasksCompleted++;
    existing.lastActivity = new Date();
    
    // Update average execution time
    existing.averageExecutionTime = 
      (existing.averageExecutionTime * (existing.tasksCompleted - 1) + result.executionTime) / 
      existing.tasksCompleted;
    
    // Update success rate
    const successes = result.status === 'success' ? 1 : 0;
    existing.successRate = 
      (existing.successRate * (existing.tasksCompleted - 1) + successes) / 
      existing.tasksCompleted;
    
    this.metrics.set(agentId, existing);
  }
  
  getMetrics(agentId: string): PerformanceMetrics | null {
    return this.metrics.get(agentId) || null;
  }
  
  getAllMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/**
 * Example usage of the sub-agent orchestration system
 */
export async function exampleUsage(): Promise<void> {
  const orchestrator = new AgentOrchestrator();
  
  // Register debugging sub-agent
  const debugAgent: SubAgent = {
    id: 'debug-agent-1',
    type: 'debugging',
    status: 'idle',
    capabilities: [
      {
        name: 'error-analysis',
        description: 'Analyze error logs and stack traces',
        inputTypes: ['error', 'logs'],
        outputTypes: ['analysis', 'suggestions']
      }
    ],
    currentTasks: [],
    performance: {
      tasksCompleted: 0,
      averageExecutionTime: 0,
      successRate: 1.0,
      lastActivity: new Date(),
      memoryUsage: 0,
      cpuUsage: 0
    },
    
    async execute(task: Task): Promise<TaskResult> {
      // Simulate task execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      return {
        taskId: task.id,
        status: 'success',
        result: { analysis: 'Error caused by null reference' },
        executionTime: 500,
        agentId: this.id,
        metadata: {}
      };
    },
    
    async healthCheck(): Promise<HealthStatus> {
      return {
        status: 'healthy',
        latency: 10,
        errors: [],
        lastCheck: new Date()
      };
    },
    
    async shutdown(): Promise<void> {
      console.log('Debug agent shutting down...');
    }
  };
  
  // Register the agent
  await orchestrator.registerSubAgent({
    name: 'debugging-agent',
    version: '1.0.0',
    type: 'sub-agent',
    capabilities: debugAgent.capabilities,
    permissions: [
      { resource: 'logs', operations: ['read'] },
      { resource: 'memory', operations: ['read'] }
    ],
    resources: {
      maxMemory: '256MB',
      maxCpu: '0.3',
      timeout: '30s'
    },
    entry: './debug-agent.js',
    hooks: {
      onLoad: true,
      onUnload: true
    }
  }, debugAgent);
  
  // Create and delegate a task
  const task: Task = {
    id: 'task-1',
    type: TaskType.ERROR_ANALYSIS,
    payload: { 
      error: 'TypeError: Cannot read property of undefined',
      stackTrace: '...'
    },
    priority: 'high',
    timeout: 30000,
    requiredCapabilities: ['error-analysis'],
    metadata: {}
  };
  
  const result = await orchestrator.delegateTask(task);
  console.log('Task result:', result);
}