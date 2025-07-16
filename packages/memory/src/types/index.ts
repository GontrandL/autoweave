/**
 * @autoweave/memory - Type definitions
 */

// Memory Manager Configuration
export interface MemoryConfig {
  vectorStore?: VectorStoreConfig;
  graphStore?: GraphStoreConfig;
  cache?: CacheConfig;
  llm?: LLMConfig;
  logger?: any;
}

export interface VectorStoreConfig {
  type: 'qdrant' | 'pinecone' | 'weaviate';
  host?: string;
  port?: number;
  apiKey?: string;
  collection?: string;
}

export interface GraphStoreConfig {
  type: 'memgraph' | 'neo4j' | 'arangodb';
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export interface CacheConfig {
  type: 'redis' | 'memory';
  host?: string;
  port?: number;
  password?: string;
  ttl?: number;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'openrouter';
  apiKey: string;
  model?: string;
  embeddingModel?: string;
}

// Memory Operations
export interface MemoryEntry {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  timestamp?: Date;
  userId?: string;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  userId?: string;
  filters?: Record<string, any>;
  includeMetadata?: boolean;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

// Graph Types
export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  properties?: Record<string, any>;
}

export interface GraphQuery {
  nodes?: string[];
  edges?: string[];
  depth?: number;
  filters?: Record<string, any>;
}

export interface GraphTopology {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    avgDegree: number;
  };
}

// Memory Metrics
export interface MemoryMetrics {
  vectorStore: {
    count: number;
    size: number;
    dimensions: number;
  };
  graphStore: {
    nodes: number;
    edges: number;
    avgDegree: number;
  };
  cache: {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
  };
  performance: {
    avgSearchTime: number;
    avgWriteTime: number;
    totalOperations: number;
  };
}

// Health Status
export interface HealthStatus {
  healthy: boolean;
  services: {
    vectorStore: ComponentHealth;
    graphStore: ComponentHealth;
    cache: ComponentHealth;
  };
  timestamp: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latency?: number;
  details?: any;
}

// Hybrid Memory Manager Interface
export interface IHybridMemoryManager {
  add(entry: MemoryEntry): Promise<string>;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  update(id: string, entry: Partial<MemoryEntry>): Promise<void>;
  delete(id: string): Promise<void>;
  addRelation(from: string, to: string, type: string, properties?: Record<string, any>): Promise<void>;
  getRelated(nodeId: string, relationType?: string, depth?: number): Promise<GraphNode[]>;
  getTopology(query?: GraphQuery): Promise<GraphTopology>;
  getMetrics(): Promise<MemoryMetrics>;
  health(): Promise<HealthStatus>;
  clear(): Promise<void>;
}

// Client Interfaces
export interface IMem0Client {
  add(data: any, options?: any): Promise<string>;
  search(query: string, options?: any): Promise<any[]>;
  update(id: string, data: any): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(options?: any): Promise<any[]>;
}

export interface IGraphClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  createNode(node: GraphNode): Promise<string>;
  createEdge(edge: GraphEdge): Promise<string>;
  findNode(id: string): Promise<GraphNode | null>;
  findNodes(query: any): Promise<GraphNode[]>;
  findPath(from: string, to: string, maxDepth?: number): Promise<GraphNode[]>;
  executeQuery(query: string, params?: any): Promise<any>;
}

export interface IRedisMlCache {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<any>;
}