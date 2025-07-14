/**
 * @autoweave/agents - Type definitions
 */

// Base Agent Types
export interface AgentConfig {
  name?: string;
  description?: string;
  logger?: any;
  memoryManager?: any;
  capabilities?: string[];
  metadata?: Record<string, any>;
}

export interface AgentContext {
  userId?: string;
  sessionId?: string;
  environment?: Record<string, any>;
  history?: any[];
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Debugging Agent Types
export interface DebuggingContext {
  error?: Error | string;
  code?: string;
  file?: string;
  line?: number;
  stack?: string;
  environment?: Record<string, any>;
  logs?: string[];
}

export interface DebuggingSuggestion {
  type: 'fix' | 'explanation' | 'prevention';
  description: string;
  code?: string;
  confidence: number;
  references?: string[];
}

export interface DebuggingAnalysis {
  errorType: string;
  errorMessage: string;
  possibleCauses: string[];
  suggestions: DebuggingSuggestion[];
  relatedErrors?: string[];
}

// Self-Awareness Agent Types
export interface SystemMetrics {
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network?: {
    rx: number;
    tx: number;
  };
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
}

export interface OptimizationSuggestion {
  category: 'performance' | 'resource' | 'configuration' | 'code';
  description: string;
  impact: 'high' | 'medium' | 'low';
  implementation?: string;
  estimatedImprovement?: string;
}

export interface SelfAwarenessReport {
  timestamp: Date;
  health: 'healthy' | 'degraded' | 'critical';
  metrics: {
    system: SystemMetrics;
    performance: PerformanceMetrics;
  };
  issues: string[];
  optimizations: OptimizationSuggestion[];
}

// Integration Agent Types
export interface ServiceConfig {
  type: string;
  name: string;
  endpoint?: string;
  apiKey?: string;
  credentials?: Record<string, any>;
  options?: Record<string, any>;
}

export interface ServiceConnection {
  id: string;
  service: string;
  status: 'connected' | 'disconnected' | 'error';
  lastActivity?: Date;
  metadata?: Record<string, any>;
}

export interface IntegrationRequest {
  service: string;
  action: string;
  params?: Record<string, any>;
  timeout?: number;
}

export interface IntegrationResponse {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
  retries?: number;
}

// Agent Interfaces
export interface IDebuggingAgent {
  analyze(context: DebuggingContext): Promise<DebuggingAnalysis>;
  suggest(error: Error | string): Promise<DebuggingSuggestion[]>;
  diagnose(code: string, error?: Error): Promise<DebuggingAnalysis>;
  getKnownIssues(): Promise<Record<string, DebuggingSuggestion[]>>;
}

export interface ISelfAwarenessAgent {
  monitor(): Promise<SelfAwarenessReport>;
  optimize(): Promise<OptimizationSuggestion[]>;
  getMetrics(): Promise<SystemMetrics & PerformanceMetrics>;
  predictIssues(): Promise<string[]>;
  selfHeal(issue: string): Promise<boolean>;
}

export interface IIntegrationAgent {
  connect(service: string, config: ServiceConfig): Promise<ServiceConnection>;
  disconnect(service: string): Promise<void>;
  execute(request: IntegrationRequest): Promise<IntegrationResponse>;
  getConnections(): Promise<ServiceConnection[]>;
  getServiceCapabilities(service: string): Promise<string[]>;
}

// Event Types
export interface AgentEvent {
  type: 'info' | 'warning' | 'error' | 'debug';
  agent: string;
  message: string;
  data?: any;
  timestamp: Date;
}

export interface AgentLifecycleEvent {
  type: 'initialized' | 'started' | 'stopped' | 'error';
  agent: string;
  timestamp: Date;
  details?: any;
}