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
const mockMemories = [
  {
    id: '1',
    content: 'How to implement GraphQL federation with Apollo Server',
    namespace: 'development',
    metadata: {
      topic: 'GraphQL',
      difficulty: 'intermediate',
      tags: ['graphql', 'federation', 'apollo']
    },
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: 'agent-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    accessedAt: new Date('2024-01-01T00:00:00Z'),
    accessCount: 5,
    tags: ['graphql', 'federation', 'apollo'],
    isActive: true,
    vectorId: 'vec-1',
    source: {
      type: 'AGENT',
      agentId: 'agent-1',
      metadata: { source: 'documentation' }
    },
    type: 'KNOWLEDGE'
  },
  {
    id: '2',
    content: 'Best practices for React component architecture',
    namespace: 'frontend',
    metadata: {
      topic: 'React',
      difficulty: 'advanced',
      tags: ['react', 'architecture', 'components']
    },
    embedding: [0.2, 0.3, 0.4, 0.5, 0.6],
    tenantId: 'tenant-1',
    userId: 'user-1',
    agentId: 'agent-2',
    createdAt: new Date('2024-01-02T00:00:00Z'),
    updatedAt: new Date('2024-01-02T00:00:00Z'),
    accessedAt: new Date('2024-01-02T00:00:00Z'),
    accessCount: 3,
    tags: ['react', 'architecture', 'components'],
    isActive: true,
    vectorId: 'vec-2',
    source: {
      type: 'USER',
      metadata: { source: 'manual_entry' }
    },
    type: 'KNOWLEDGE'
  }
];

const mockNamespaces = [
  {
    id: '1',
    name: 'development',
    description: 'Development-related memories',
    tenantId: 'tenant-1',
    settings: {
      maxMemories: 10000,
      embeddingModel: 'text-embedding-ada-002',
      similarityThreshold: 0.8,
      autoCleanup: true,
      retentionDays: 30
    },
    stats: {
      totalMemories: 1,
      totalSize: 1024.5,
      avgSimilarity: 0.85,
      lastAccessed: new Date(),
      topTags: ['graphql', 'federation', 'apollo']
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true
  },
  {
    id: '2',
    name: 'frontend',
    description: 'Frontend development memories',
    tenantId: 'tenant-1',
    settings: {
      maxMemories: 5000,
      embeddingModel: 'text-embedding-ada-002',
      similarityThreshold: 0.75,
      autoCleanup: true,
      retentionDays: 60
    },
    stats: {
      totalMemories: 1,
      totalSize: 512.3,
      avgSimilarity: 0.78,
      lastAccessed: new Date(),
      topTags: ['react', 'architecture', 'components']
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    isActive: true
  }
];

// GraphQL resolvers
const resolvers: GraphQLResolverMap = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  
  Query: {
    memories: (parent, args, context) => {
      let memories = mockMemories;
      
      if (args.tenantId) {
        memories = memories.filter(memory => memory.tenantId === args.tenantId);
      }
      
      if (args.namespace) {
        memories = memories.filter(memory => memory.namespace === args.namespace);
      }
      
      return memories;
    },
    
    memory: (parent, args) => {
      return mockMemories.find(memory => memory.id === args.id);
    },
    
    searchMemories: (parent, args) => {
      const { query, namespace, limit = 10 } = args;
      
      let memories = mockMemories;
      
      if (namespace) {
        memories = memories.filter(memory => memory.namespace === namespace);
      }
      
      // Simple text search simulation
      memories = memories.filter(memory => 
        memory.content.toLowerCase().includes(query.toLowerCase()) ||
        memory.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      
      return memories.slice(0, limit);
    },
    
    memorySimilarity: (parent, args) => {
      const { memoryId, threshold = 0.8 } = args;
      const sourceMemory = mockMemories.find(m => m.id === memoryId);
      
      if (!sourceMemory) return [];
      
      // Simple similarity calculation (in reality, this would use vector similarity)
      return mockMemories
        .filter(memory => memory.id !== memoryId)
        .map(memory => ({
          ...memory,
          similarity: Math.random() * 0.5 + 0.5 // Mock similarity score
        }))
        .filter(memory => memory.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);
    },
    
    memoryStats: (parent, args) => {
      const { tenantId } = args;
      const tenantMemories = mockMemories.filter(m => !tenantId || m.tenantId === tenantId);
      
      return {
        totalMemories: tenantMemories.length,
        totalSize: tenantMemories.reduce((sum, m) => sum + m.content.length, 0),
        namespacesCount: new Set(tenantMemories.map(m => m.namespace)).size,
        avgAccessCount: tenantMemories.reduce((sum, m) => sum + m.accessCount, 0) / tenantMemories.length,
        memoryDistribution: [
          { namespace: 'development', count: 1, percentage: 50 },
          { namespace: 'frontend', count: 1, percentage: 50 }
        ],
        recentActivity: [
          {
            action: 'CREATED',
            memoryId: '1',
            timestamp: new Date(),
            userId: 'user-1',
            metadata: {}
          }
        ]
      };
    },
    
    memoryNamespaces: (parent, args) => {
      const { tenantId } = args;
      let namespaces = mockNamespaces;
      
      if (tenantId) {
        namespaces = namespaces.filter(ns => ns.tenantId === tenantId);
      }
      
      return namespaces;
    }
  },
  
  Mutation: {
    createMemory: async (parent, { input }, context) => {
      const newMemory = {
        id: `memory-${Date.now()}`,
        content: input.content,
        namespace: input.namespace,
        metadata: input.metadata || {},
        embedding: Array.from({ length: 1536 }, () => Math.random()), // Mock embedding
        tenantId: context.user.tenantId,
        userId: context.user.id,
        agentId: input.agentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        tags: input.tags || [],
        isActive: true,
        vectorId: `vec-${Date.now()}`,
        source: input.source,
        type: input.type
      };
      
      mockMemories.push(newMemory);
      return newMemory;
    },
    
    updateMemory: async (parent, { id, input }, context) => {
      const memory = mockMemories.find(m => m.id === id);
      if (!memory) {
        throw new Error('Memory not found');
      }
      
      if (input.content) memory.content = input.content;
      if (input.metadata) memory.metadata = { ...memory.metadata, ...input.metadata };
      if (input.tags) memory.tags = input.tags;
      if (input.isActive !== undefined) memory.isActive = input.isActive;
      
      memory.updatedAt = new Date();
      
      return memory;
    },
    
    deleteMemory: async (parent, { id }, context) => {
      const index = mockMemories.findIndex(m => m.id === id);
      if (index === -1) {
        throw new Error('Memory not found');
      }
      
      mockMemories.splice(index, 1);
      return true;
    },
    
    bulkCreateMemories: async (parent, { input }, context) => {
      const newMemories = input.map((memoryInput: any) => ({
        id: `memory-${Date.now()}-${Math.random()}`,
        content: memoryInput.content,
        namespace: memoryInput.namespace,
        metadata: memoryInput.metadata || {},
        embedding: Array.from({ length: 1536 }, () => Math.random()),
        tenantId: context.user.tenantId,
        userId: context.user.id,
        agentId: memoryInput.agentId,
        createdAt: new Date(),
        updatedAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        tags: memoryInput.tags || [],
        isActive: true,
        vectorId: `vec-${Date.now()}-${Math.random()}`,
        source: memoryInput.source,
        type: memoryInput.type
      }));
      
      mockMemories.push(...newMemories);
      return newMemories;
    },
    
    bulkDeleteMemories: async (parent, { ids }, context) => {
      let deletedCount = 0;
      
      ids.forEach((id: string) => {
        const index = mockMemories.findIndex(m => m.id === id);
        if (index !== -1) {
          mockMemories.splice(index, 1);
          deletedCount++;
        }
      });
      
      return deletedCount;
    },
    
    createMemoryNamespace: async (parent, { input }, context) => {
      const newNamespace = {
        id: `namespace-${Date.now()}`,
        name: input.name,
        description: input.description || '',
        tenantId: context.user.tenantId,
        settings: input.settings,
        stats: {
          totalMemories: 0,
          totalSize: 0,
          avgSimilarity: 0,
          lastAccessed: null,
          topTags: []
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      
      mockNamespaces.push(newNamespace);
      return newNamespace;
    },
    
    deleteMemoryNamespace: async (parent, { id }, context) => {
      const index = mockNamespaces.findIndex(ns => ns.id === id);
      if (index === -1) {
        throw new Error('Namespace not found');
      }
      
      mockNamespaces.splice(index, 1);
      return true;
    },
    
    optimizeMemoryIndex: async (parent, { namespace }, context) => {
      // Mock optimization
      return true;
    }
  },
  
  Memory: {
    __resolveReference: (memory: any) => {
      return mockMemories.find(m => m.id === memory.id);
    }
  },
  
  MemoryNamespace: {
    __resolveReference: (namespace: any) => {
      return mockNamespaces.find(ns => ns.id === namespace.id);
    },
    
    memories: (namespace) => {
      return mockMemories.filter(m => m.namespace === namespace.name);
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
    listen: { port: 4002 },
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

  console.log(`🧠 Memory subgraph ready at: ${url}`);
}

if (require.main === module) {
  startServer().catch(console.error);
}

export { resolvers };