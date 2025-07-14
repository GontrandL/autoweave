import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GraphQLResolverMap } from '@apollo/subgraph/dist/schema-helper';
import { GraphQLScalarType, Kind } from 'graphql';
import { createAuthPlugin } from '../../src/middleware/auth';
import { createSecurityPlugins } from '../../src/middleware/security';

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
const mockAgents = [
  {
    id: '1',
    name: 'Web Scraper Agent',
    description: 'Scrapes web data and stores in memory',
    type: 'WORKFLOW',
    status: 'RUNNING',
    version: '1.0.0',
    tenantId: 'tenant-1',
    userId: 'user-1',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    lastDeployedAt: new Date('2024-01-01T00:00:00Z'),
    tags: ['scraping', 'web', 'automation'],
    isActive: true,
    healthStatus: 'HEALTHY',
    config: {
      runtime: 'nodejs',
      memory: '512Mi',
      cpu: '250m',
      environment: [
        { key: 'NODE_ENV', value: 'production', isSecret: false },
        { key: 'API_KEY', value: 'secret-key', isSecret: true }
      ],
      ports: [
        { name: 'http', port: 8080, protocol: 'TCP', targetPort: 8080 }
      ],
      volumes: [
        { name: 'data', mountPath: '/app/data', size: '10Gi', type: 'PERSISTENT' }
      ],
      dependencies: [
        { name: 'axios', version: '1.6.0', type: 'PACKAGE' },
        { name: 'cheerio', version: '1.0.0', type: 'PACKAGE' }
      ],
      scaling: {
        minReplicas: 1,
        maxReplicas: 5,
        targetCPU: 70,
        targetMemory: 80
      }
    }
  }
];

const mockDeployments = [
  {
    id: '1',
    agentId: '1',
    version: '1.0.0',
    status: 'RUNNING',
    replicas: 3,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z')
  }
];

const mockMetrics = [
  {
    agentId: '1',
    cpuUsage: 45.5,
    memoryUsage: 67.2,
    networkIn: 1024.5,
    networkOut: 2048.3,
    requestCount: 1500,
    errorCount: 12,
    uptime: 86400,
    timestamp: new Date()
  }
];

const mockLogs = [
  {
    id: '1',
    agentId: '1',
    level: 'INFO',
    message: 'Agent started successfully',
    timestamp: new Date(),
    metadata: { component: 'agent-startup' }
  }
];

// GraphQL resolvers
const resolvers: GraphQLResolverMap = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,
  
  Query: {
    agents: (parent, args, context) => {
      let agents = mockAgents;
      
      if (args.tenantId) {
        agents = agents.filter(agent => agent.tenantId === args.tenantId);
      }
      
      if (args.status) {
        agents = agents.filter(agent => agent.status === args.status);
      }
      
      return agents;
    },
    
    agent: (parent, args) => {
      return mockAgents.find(agent => agent.id === args.id);
    },
    
    agentMetrics: (parent, args) => {
      return mockMetrics.find(metric => metric.agentId === args.agentId);
    },
    
    agentLogs: (parent, args) => {
      return mockLogs.filter(log => log.agentId === args.agentId)
        .slice(0, args.limit || 100);
    }
  },
  
  Mutation: {
    createAgent: async (parent, { input }, context) => {
      const newAgent = {
        id: `agent-${Date.now()}`,
        name: input.name,
        description: input.description || '',
        type: input.type,
        status: 'CREATED',
        version: '1.0.0',
        tenantId: context.user.tenantId,
        userId: context.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastDeployedAt: null,
        tags: input.tags || [],
        isActive: true,
        healthStatus: 'UNKNOWN',
        config: input.config
      };
      
      mockAgents.push(newAgent);
      return newAgent;
    },
    
    updateAgent: async (parent, { id, input }, context) => {
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      // Update agent
      if (input.name) agent.name = input.name;
      if (input.description !== undefined) agent.description = input.description;
      if (input.config) agent.config = { ...agent.config, ...input.config };
      if (input.tags) agent.tags = input.tags;
      
      agent.updatedAt = new Date();
      
      return agent;
    },
    
    deleteAgent: async (parent, { id }, context) => {
      const index = mockAgents.findIndex(a => a.id === id);
      if (index === -1) {
        throw new Error('Agent not found');
      }
      
      mockAgents.splice(index, 1);
      return true;
    },
    
    deployAgent: async (parent, { id }, context) => {
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      const deployment = {
        id: `deployment-${Date.now()}`,
        agentId: id,
        version: agent.version,
        status: 'RUNNING',
        replicas: agent.config.scaling.minReplicas,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      mockDeployments.push(deployment);
      agent.status = 'DEPLOYING';
      agent.lastDeployedAt = new Date();
      
      return deployment;
    },
    
    startAgent: async (parent, { id }, context) => {
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      agent.status = 'RUNNING';
      agent.isActive = true;
      agent.updatedAt = new Date();
      
      return agent;
    },
    
    stopAgent: async (parent, { id }, context) => {
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      agent.status = 'STOPPED';
      agent.isActive = false;
      agent.updatedAt = new Date();
      
      return agent;
    },
    
    restartAgent: async (parent, { id }, context) => {
      const agent = mockAgents.find(a => a.id === id);
      if (!agent) {
        throw new Error('Agent not found');
      }
      
      agent.status = 'RUNNING';
      agent.isActive = true;
      agent.updatedAt = new Date();
      
      return agent;
    }
  },
  
  Agent: {
    __resolveReference: (agent: any) => {
      return mockAgents.find(a => a.id === agent.id);
    },
    
    deployments: (agent) => {
      return mockDeployments.filter(d => d.agentId === agent.id);
    },
    
    metrics: (agent) => {
      return mockMetrics.find(m => m.agentId === agent.id);
    },
    
    logs: (agent) => {
      return mockLogs.filter(l => l.agentId === agent.id);
    },
    
    secrets: (agent) => {
      // Return secrets only if user has permission
      return agent.config.environment
        .filter((env: any) => env.isSecret)
        .map((env: any) => ({
          key: env.key,
          value: env.value,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
    }
  },
  
  AgentDeployment: {
    __resolveReference: (deployment: any) => {
      return mockDeployments.find(d => d.id === deployment.id);
    },
    
    agent: (deployment) => {
      return mockAgents.find(a => a.id === deployment.agentId);
    },
    
    logs: (deployment) => {
      return []; // Mock deployment logs
    }
  },
  
  AgentMetrics: {
    __resolveReference: (metrics: any) => {
      return mockMetrics.find(m => m.agentId === metrics.agentId);
    },
    
    agent: (metrics) => {
      return mockAgents.find(a => a.id === metrics.agentId);
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
    }),
    plugins: [
      createAuthPlugin(),
      ...createSecurityPlugins()
    ]
  });

  const { url } = await startStandaloneServer(server, {
    listen: { port: 4001 },
    context: async ({ req, res }) => {
      // Mock context for development
      return {
        user: {
          id: 'user-1',
          tenantId: 'tenant-1',
          roles: [{ name: 'Developer' }]
        },
        req,
        res
      };
    }
  });

  console.log(`🚀 Agents subgraph ready at: ${url}`);
}

if (require.main === module) {
  startServer().catch(console.error);
}

export { resolvers };