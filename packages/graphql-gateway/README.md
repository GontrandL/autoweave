# AutoWeave GraphQL Gateway

A comprehensive GraphQL federation gateway with authentication, authorization, and security features built on WunderGraph Cosmo.

## Features

### 🔐 Authentication & Authorization
- **JWT Authentication** with 15-minute access tokens and 7-day refresh tokens
- **RBAC (Role-Based Access Control)** with hierarchical roles
- **Multi-tenant support** with tenant isolation
- **Field-level permissions** with GraphQL directives
- **Session management** with Redis

### 🛡️ Security
- **Query complexity analysis** (max 1000 points)
- **Rate limiting** (100 requests/minute per tenant)  
- **Query depth limiting** (max 10 levels)
- **Request size limiting** and validation
- **CORS protection** and security headers
- **Input sanitization** and validation

### 🌐 Federation
- **5 GraphQL subgraphs**: agents, memory, queue, plugins, observability
- **Hot schema reloading** for development
- **WunderGraph Cosmo** as MIT-licensed federation solution
- **Performance optimization** with <200ms P95 latency target

### 📊 Observability
- **Comprehensive logging** with structured data
- **Metrics collection** and monitoring
- **Health checks** and status endpoints
- **Audit logging** for security events
- **Performance monitoring** and analytics

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GraphQL Gateway                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Auth Layer    │  │  Security Layer │  │  RBAC Layer     │ │
│  │  - JWT Tokens   │  │  - Rate Limit   │  │  - Permissions  │ │
│  │  - Sessions     │  │  - Complexity   │  │  - Roles        │ │
│  │  - Multi-tenant │  │  - Validation   │  │  - Directives   │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Federation Layer                            │ │
│  │          WunderGraph Cosmo Gateway                         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Agents  │  │ Memory  │  │  Queue  │  │Plugins  │  │Observ.  │
   │Subgraph │  │Subgraph │  │Subgraph │  │Subgraph │  │Subgraph │
   │:4001    │  │:4002    │  │:4003    │  │:4004    │  │:4005    │
   └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- Redis (for session management)
- Docker (optional, for containerized deployment)

### Installation

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Start development mode
npm run dev

# Start production mode
npm start
```

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional-password
REDIS_DB=0

# Gateway Configuration
GATEWAY_PORT=4000
GATEWAY_HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# Subgraph URLs
AGENTS_SUBGRAPH_URL=http://localhost:4001/graphql
MEMORY_SUBGRAPH_URL=http://localhost:4002/graphql
QUEUE_SUBGRAPH_URL=http://localhost:4003/graphql
PLUGINS_SUBGRAPH_URL=http://localhost:4004/graphql
OBSERVABILITY_SUBGRAPH_URL=http://localhost:4005/graphql
```

## Usage

### Starting the Gateway

```bash
# Start all subgraphs
npm run dev:subgraphs

# Start the gateway
npm run dev
```

### Authentication

#### Login
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "developer@autoweave.com",
    "password": "password"
  }'
```

#### Using JWT Token
```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "query { agents { id name status } }"
  }'
```

### GraphQL Operations

#### Query Agents
```graphql
query GetAgents {
  agents {
    id
    name
    status
    type
    config {
      runtime
      memory
      cpu
    }
    metrics {
      cpuUsage
      memoryUsage
      uptime
    }
  }
}
```

#### Create Agent
```graphql
mutation CreateAgent($input: CreateAgentInput!) {
  createAgent(input: $input) {
    id
    name
    status
    createdAt
  }
}
```

#### Search Memories
```graphql
query SearchMemories($query: String!, $limit: Int) {
  searchMemories(query: $query, limit: $limit) {
    id
    content
    namespace
    similarity
    tags
  }
}
```

### Authorization Directives

#### Field-Level Authorization
```graphql
type Agent {
  id: ID!
  name: String!
  config: AgentConfig! @auth(requires: ["agents:read"])
  secrets: [AgentSecret!]! @auth(requires: ["agents:update"])
}
```

#### Role-Based Authorization
```graphql
type Mutation {
  createAgent(input: CreateAgentInput!): Agent! 
    @auth(roles: ["Developer", "Admin"])
  
  deleteAgent(id: ID!): Boolean! 
    @auth(requires: ["agents:delete"], tenantIsolated: true)
}
```

#### Rate Limiting
```graphql
type Query {
  expensiveOperation: String! @rateLimit(max: 10, window: 60)
}
```

## Role Hierarchy

| Role | Level | Permissions |
|------|-------|-------------|
| **Super Admin** | 0 | All permissions across all tenants |
| **Tenant Admin** | 1 | All permissions within tenant |
| **Developer** | 2 | Development and deployment access |
| **Viewer** | 3 | Read-only access |

## Security Features

### Query Complexity Analysis
- Prevents expensive queries from overloading the system
- Configurable complexity limits per tenant
- Automatic query analysis and rejection

### Rate Limiting
- Per-tenant rate limiting
- Configurable limits via tenant settings
- Redis-based distributed rate limiting

### Input Validation
- Automatic input sanitization
- Schema-based validation
- File upload validation

### Audit Logging
- All operations are logged
- Security events tracking
- User activity monitoring

## Development

### Adding New Subgraphs

1. Create subgraph directory:
```bash
mkdir -p subgraphs/new-service
```

2. Create schema file:
```bash
touch subgraphs/new-service/schema.graphql
```

3. Create server file:
```bash
touch subgraphs/new-service/server.ts
```

4. Update gateway configuration:
```typescript
// src/config/gateway.ts
subgraphs: [
  // ... existing subgraphs
  {
    name: 'new-service',
    url: 'http://localhost:4006/graphql',
    healthCheck: 'http://localhost:4006/health',
  }
]
```

### Custom Permissions

```typescript
// Add to SystemPermissions enum
export enum SystemPermissions {
  // ... existing permissions
  NEW_RESOURCE_READ = 'new_resource:read',
  NEW_RESOURCE_WRITE = 'new_resource:write',
}
```

### Custom Directives

```typescript
// Create custom directive
export const customDirectiveTypeDefs = `
  directive @customAuth(
    level: String!
  ) on FIELD_DEFINITION
`;

// Implement directive transformer
export function customDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  // Implementation
}
```

## Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

### Security Testing
```bash
npm run test:security
```

## Deployment

### Docker Deployment
```bash
# Build Docker image
docker build -t autoweave-gateway .

# Run container
docker run -p 4000:4000 \
  -e REDIS_HOST=redis \
  -e JWT_SECRET=your-secret \
  autoweave-gateway
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autoweave-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: autoweave-gateway
  template:
    metadata:
      labels:
        app: autoweave-gateway
    spec:
      containers:
      - name: gateway
        image: autoweave-gateway:latest
        ports:
        - containerPort: 4000
        env:
        - name: REDIS_HOST
          value: "redis-service"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
```

## Monitoring

### Health Checks
```bash
curl http://localhost:4000/health
```

### Metrics
```bash
curl http://localhost:4000/metrics
```

### Logs
```bash
# View gateway logs
docker logs autoweave-gateway

# View subgraph logs
docker logs autoweave-agents-subgraph
```

## Performance

### Optimization Features
- Query result caching
- Connection pooling
- Batch operations
- Lazy loading
- Compression

### Performance Targets
- **P95 Latency**: <200ms
- **Throughput**: 1000+ RPS
- **Memory Usage**: <512MB
- **CPU Usage**: <50%

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: [docs.autoweave.com](https://docs.autoweave.com)
- **Issues**: [GitHub Issues](https://github.com/autoweave/autoweave/issues)
- **Community**: [Discord](https://discord.gg/autoweave)
- **Email**: support@autoweave.com