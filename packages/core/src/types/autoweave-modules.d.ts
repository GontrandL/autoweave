/**
 * Ambient type declarations for @autoweave modules
 */

declare module '@autoweave/memory' {
  export class HybridMemoryManager {
    constructor(config?: any);
    add(data: any): Promise<void>;
    search(query: string, filters?: any): Promise<any[]>;
    update(id: string, data: any): Promise<void>;
    delete(id: string): Promise<void>;
    getTopology(): Promise<any>;
    getMetrics(): Promise<any>;
    health(): Promise<{ healthy: boolean; details: any }>;
  }
}

declare module '@autoweave/integrations' {
  export namespace MCPServer {
    export function create(config: any): any;
  }
  
  export namespace ANPServer {
    export function create(config: any): any;
  }
}

declare module '@autoweave/agents' {
  export class DebuggingAgent {
    constructor(config: any);
    analyze(context: any): Promise<any>;
    suggest(error: any): Promise<any>;
  }
  
  export class SelfAwarenessAgent {
    constructor(config: any);
    monitor(): Promise<any>;
    optimize(): Promise<any>;
  }
  
  export class IntegrationAgent {
    constructor(config: any);
    connect(service: string, config: any): Promise<any>;
    disconnect(service: string): Promise<void>;
  }
}

declare module '@autoweave/backend' {
  export namespace services {
    export class AgentService {
      createAgent(data: any): Promise<any>;
      getAgent(id: string): Promise<any>;
      updateAgent(id: string, data: any): Promise<any>;
      deleteAgent(id: string): Promise<void>;
      listAgents(filters?: any): Promise<any[]>;
      deployAgent(id: string): Promise<any>;
      getAgentStatus(id: string): Promise<any>;
    }
    
    export class MemoryService {
      add(data: any): Promise<void>;
      search(query: string): Promise<any[]>;
      update(id: string, data: any): Promise<void>;
      delete(id: string): Promise<void>;
    }
    
    export class ConfigService {
      generate(params: any): Promise<any>;
      validate(config: any): Promise<boolean>;
      optimize(config: any): Promise<any>;
    }
    
    export class ChatService {
      complete(messages: any[], options?: any): Promise<any>;
      stream(messages: any[], options?: any): AsyncGenerator<any>;
    }
  }
}