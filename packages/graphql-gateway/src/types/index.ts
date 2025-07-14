export interface User {
  id: string;
  email: string;
  tenantId: string;
  roles: Role[];
  permissions: Permission[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  maxUsers: number;
  maxAgents: number;
  rateLimitPerMinute: number;
  queryComplexityLimit: number;
  allowedFeatures: string[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  tenantId?: string; // null for global roles
  permissions: Permission[];
  isSystem: boolean;
  level: number; // hierarchy level
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface JWTPayload {
  sub: string; // user id
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface GraphQLContext {
  user?: User;
  tenant?: Tenant;
  permissions: Set<string>;
  rateLimiter: any;
  req: any;
  res: any;
}

export interface AuthenticationConfig {
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTokenExpiry: string; // '15m'
  refreshTokenExpiry: string; // '7d'
  bcryptRounds: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  keyGenerator: (req: any) => string;
}

export interface SecurityConfig {
  maxQueryDepth: number;
  maxQueryComplexity: number;
  introspectionEnabled: boolean;
  playgroundEnabled: boolean;
  corsOrigins: string[];
}

export interface GatewayConfig {
  port: number;
  host: string;
  graphqlPath: string;
  authentication: AuthenticationConfig;
  security: SecurityConfig;
  rateLimit: RateLimitConfig;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  subgraphs: SubgraphConfig[];
}

export interface SubgraphConfig {
  name: string;
  url: string;
  schema?: string;
  healthCheck?: string;
}

export enum RoleLevel {
  SUPER_ADMIN = 0,
  TENANT_ADMIN = 1,
  DEVELOPER = 2,
  VIEWER = 3
}

export enum SystemPermissions {
  // User management
  USERS_CREATE = 'users:create',
  USERS_READ = 'users:read',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  
  // Agent management
  AGENTS_CREATE = 'agents:create',
  AGENTS_READ = 'agents:read',
  AGENTS_UPDATE = 'agents:update',
  AGENTS_DELETE = 'agents:delete',
  AGENTS_DEPLOY = 'agents:deploy',
  
  // Memory management
  MEMORY_READ = 'memory:read',
  MEMORY_WRITE = 'memory:write',
  MEMORY_DELETE = 'memory:delete',
  
  // Queue management
  QUEUE_READ = 'queue:read',
  QUEUE_WRITE = 'queue:write',
  QUEUE_DELETE = 'queue:delete',
  
  // Plugin management
  PLUGINS_READ = 'plugins:read',
  PLUGINS_INSTALL = 'plugins:install',
  PLUGINS_UNINSTALL = 'plugins:uninstall',
  
  // Observability
  OBSERVABILITY_READ = 'observability:read',
  OBSERVABILITY_ADMIN = 'observability:admin',
  
  // System administration
  SYSTEM_ADMIN = 'system:admin',
  TENANT_ADMIN = 'tenant:admin'
}

export interface AuthDirectiveArgs {
  requires?: SystemPermissions[];
  roles?: string[];
  tenantIsolated?: boolean;
  allowSelf?: boolean;
}