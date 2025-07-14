import { GatewayConfig, RateLimitConfig, SecurityConfig, AuthenticationConfig } from '../types';

const authConfig: AuthenticationConfig = {
  jwtSecret: process.env.JWT_SECRET || 'autoweave-jwt-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'autoweave-refresh-secret-change-in-production',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  bcryptRounds: 12,
};

const securityConfig: SecurityConfig = {
  maxQueryDepth: 10,
  maxQueryComplexity: 1000,
  introspectionEnabled: process.env.NODE_ENV !== 'production',
  playgroundEnabled: process.env.NODE_ENV !== 'production',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
};

const rateLimitConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per tenant
  skipSuccessfulRequests: false,
  keyGenerator: (req: any) => {
    const tenantId = req.user?.tenantId || req.ip;
    return `rate_limit:${tenantId}`;
  },
};

export const gatewayConfig: GatewayConfig = {
  port: parseInt(process.env.GATEWAY_PORT || '4000'),
  host: process.env.GATEWAY_HOST || '0.0.0.0',
  graphqlPath: '/graphql',
  authentication: authConfig,
  security: securityConfig,
  rateLimit: rateLimitConfig,
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  subgraphs: [
    {
      name: 'agents',
      url: process.env.AGENTS_SUBGRAPH_URL || 'http://localhost:4001/graphql',
      healthCheck: process.env.AGENTS_HEALTH_URL || 'http://localhost:4001/health',
    },
    {
      name: 'memory',
      url: process.env.MEMORY_SUBGRAPH_URL || 'http://localhost:4002/graphql',
      healthCheck: process.env.MEMORY_HEALTH_URL || 'http://localhost:4002/health',
    },
    {
      name: 'queue',
      url: process.env.QUEUE_SUBGRAPH_URL || 'http://localhost:4003/graphql',
      healthCheck: process.env.QUEUE_HEALTH_URL || 'http://localhost:4003/health',
    },
    {
      name: 'plugins',
      url: process.env.PLUGINS_SUBGRAPH_URL || 'http://localhost:4004/graphql',
      healthCheck: process.env.PLUGINS_HEALTH_URL || 'http://localhost:4004/health',
    },
    {
      name: 'observability',
      url: process.env.OBSERVABILITY_SUBGRAPH_URL || 'http://localhost:4005/graphql',
      healthCheck: process.env.OBSERVABILITY_HEALTH_URL || 'http://localhost:4005/health',
    },
  ],
};

export default gatewayConfig;