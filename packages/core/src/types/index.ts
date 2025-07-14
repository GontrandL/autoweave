/**
 * @autoweave/core - Type definitions
 */

// AutoWeave types
export interface AutoWeaveConfig {
  port?: number;
  kagentBridge?: KagentBridge;
  memoryManager?: MemoryManager;
  logger?: any;
  agentWeaver?: any;
  configIntelligence?: any;
  debuggingAgent?: AgentInterface;
  agentService?: ServiceInterface;
}

export interface KagentBridge {
  generatePipelineManifest(agentId: string, metadata: any): Promise<any>;
  deployPipeline(manifest: any): Promise<any>;
  getPipelineStatus(pipelineName: string): Promise<any>;
  enableDebugAgent(agentId: string, metadata: any): Promise<void>;
  disableDebugAgent(agentId: string): Promise<void>;
}

export interface HealthStatus {
  autoweave: boolean;
  kagent: boolean;
  memory: boolean;
  dependencies: Record<string, boolean>;
}

export interface DetailedHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    autoweave: ComponentHealth;
    kagent: ComponentHealth;
    memory: ComponentHealth;
  };
  dependencies: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latency?: number;
  details?: any;
}

export interface ReadinessStatus {
  ready: boolean;
  services: {
    kagent: boolean;
    memory: boolean;
    redis?: boolean;
    openai?: boolean;
  };
}

export interface Metrics {
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  requests: {
    total: number;
    active: number;
    errors: number;
  };
  agents: {
    total: number;
    active: number;
    deployed: number;
  };
}

export interface AGUIEvent {
  timestamp: string;
  type: 'chat' | 'command' | 'status' | 'error';
  data: any;
}

export interface AGUIInputEvent {
  type: 'input' | 'command' | 'query';
  content: string;
  metadata?: Record<string, any>;
}

// AgentWeaver types
export interface AgentWeaverConfig {
  openaiApiKey: string;
  model?: string;
  maxRetries?: number;
  logger?: any;
  memoryManager?: any;
}

export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  requirements: string[];
  environment: Record<string, string>;
  modules: WorkflowModule[];
}

export interface WorkflowModule {
  name: string;
  version: string;
  config: Record<string, any>;
}

export interface WorkflowStep {
  name: string;
  action: string;
  params: Record<string, any>;
  dependsOn?: string[];
}

export interface ModelConfig {
  name: string;
  context_window: number;
  capabilities: string[];
  parameters?: Record<string, any>;
}

export interface ProcessMessageResponse {
  success: boolean;
  response?: string;
  error?: string;
  metadata?: Record<string, any>;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface ProcessMessageOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  context?: any[];
  stream?: boolean;
}

export interface MemoryManager {
  search(query: string, filters?: any): Promise<any[]>;
  add(data: any): Promise<void>;
  health(): Promise<HealthCheck>;
}

export interface HealthCheck {
  healthy: boolean;
  details?: any;
}

export interface AgentInterface {
  initialize(): Promise<void>;
  process(input: any): Promise<any>;
}

export interface ServiceInterface {
  listAgents(): Promise<any[]>;
  createAgent(config: any): Promise<any>;
  updateAgent(id: string, config: any): Promise<any>;
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
}

export interface OpenAPICapabilities {
  paths: string[];
  methods: string[];
  security: string[];
  contentTypes: string[];
  features: string[];
}

export interface GenerateOpenAPIOptions {
  baseUrl?: string;
  version?: string;
  security?: boolean;
}

// ConfigurationIntelligence types
export interface ConfigIntelligenceConfig {
  logger?: any;
  openaiApiKey?: string;
  model?: string;
}

export interface IntentUnderstanding {
  type: 'agent' | 'integration' | 'deployment' | 'configuration';
  domain: string;
  technologies: string[];
  requirements: Requirements;
  confidence: number;
}

export interface Requirements {
  functional: string[];
  technical: string[];
  constraints: string[];
}

export interface ComponentsMap {
  npm: Record<string, any>;
  docker: Record<string, any>;
  helm: Record<string, any>;
  github: Record<string, any>;
}

export interface FreshVersions {
  npm: Record<string, string>;
  docker: Record<string, string>;
  helm: Record<string, string>;
  github: Record<string, string>;
}

export interface EnrichmentContext {
  components: ComponentsMap;
  versions: FreshVersions;
  patterns: any[];
  bestPractices: any[];
}

export interface EnvironmentConstraints {
  runtime?: string;
  memory?: string;
  cpu?: string;
  storage?: string;
  network?: string[];
}

export interface GenerateConfigParams {
  description: string;
  intent?: IntentUnderstanding;
  environment?: EnvironmentConstraints;
  versions?: FreshVersions;
  existingConfig?: any;
}

export interface GenerateConfigOptions {
  format?: 'yaml' | 'json' | 'dockerfile' | 'helm';
  validate?: boolean;
  optimize?: boolean;
}

export interface ConfigSuggestion {
  name: string;
  description: string;
  confidence: number;
  config: any;
  alternatives?: any[];
}

export interface QuickConfig {
  dockerfile?: string;
  docker_compose?: any;
  kubernetes?: any;
  helm?: any;
  environment?: Record<string, string>;
}