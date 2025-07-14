import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { readFileSync } from 'fs';
import { join } from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { gatewayConfig } from './config/gateway';
import { authenticateToken, createGraphQLContext, createAuthPlugin } from './middleware/auth';
import { 
  expressRateLimit, 
  graphqlRateLimit, 
  securityHeaders, 
  validateQuery, 
  queryTimeout,
  requestSizeLimit,
  createSecurityPlugins,
  queryDepthLimit,
  queryComplexityLimit
} from './middleware/security';
import { authDirectiveTransformer, rateLimitDirectiveTransformer, authDirectiveTypeDefs } from './rbac/directives';
import { sessionManager } from './auth/session';
import { jwtService } from './auth/jwt';

class GraphQLGateway {
  private app: express.Application;
  private server: ApolloServer;
  private gateway: ApolloGateway;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupGateway();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "ws:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS
    this.app.use(cors({
      origin: gatewayConfig.security.corsOrigins,
      credentials: true,
      optionsSuccessStatus: 200,
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    this.app.use(expressRateLimit);

    // Request size limiting
    this.app.use(requestSizeLimit('10mb'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security headers
    this.app.use(securityHeaders);

    // Query validation
    this.app.use(gatewayConfig.graphqlPath, validateQuery);

    // Query timeout
    this.app.use(queryTimeout(30000));

    // Authentication middleware
    this.app.use(authenticateToken);

    // GraphQL rate limiting
    this.app.use(gatewayConfig.graphqlPath, graphqlRateLimit);

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        subgraphs: gatewayConfig.subgraphs.map(subgraph => ({
          name: subgraph.name,
          url: subgraph.url,
          status: 'healthy' // In production, implement actual health checks
        }))
      });
    });

    // Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      res.json({
        timestamp: new Date().toISOString(),
        activeConnections: 0, // Implement actual metrics
        totalRequests: 0,
        errorRate: 0,
        avgResponseTime: 0
      });
    });

    // Authentication endpoints
    this.setupAuthEndpoints();
  }

  private setupAuthEndpoints(): void {
    // Login endpoint
    this.app.post('/auth/login', async (req, res) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({
            error: 'Email and password are required'
          });
        }

        // Mock user validation - in production, validate against database
        const mockUser = {
          id: 'user-1',
          email: email,
          tenantId: 'tenant-1',
          roles: [
            {
              id: 'role-1',
              name: 'Developer',
              description: 'Developer role',
              permissions: [
                { id: 'perm-1', name: 'agents:read', resource: 'agents', action: 'read' },
                { id: 'perm-2', name: 'agents:write', resource: 'agents', action: 'write' },
                { id: 'perm-3', name: 'memory:read', resource: 'memory', action: 'read' },
                { id: 'perm-4', name: 'memory:write', resource: 'memory', action: 'write' },
                { id: 'perm-5', name: 'queue:read', resource: 'queue', action: 'read' },
                { id: 'perm-6', name: 'queue:write', resource: 'queue', action: 'write' },
                { id: 'perm-7', name: 'plugins:read', resource: 'plugins', action: 'read' },
                { id: 'perm-8', name: 'plugins:install', resource: 'plugins', action: 'install' },
                { id: 'perm-9', name: 'observability:read', resource: 'observability', action: 'read' }
              ],
              isSystem: true,
              level: 2
            }
          ],
          permissions: [],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Generate tokens
        const tokens = jwtService.generateTokenPair(mockUser);

        // Store session
        await sessionManager.storeUserSession(mockUser.id, mockUser, tokens.refreshToken);

        res.json({
          user: {
            id: mockUser.id,
            email: mockUser.email,
            tenantId: mockUser.tenantId,
            roles: mockUser.roles.map(role => role.name)
          },
          tokens
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    });

    // Refresh token endpoint
    this.app.post('/auth/refresh', async (req, res) => {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          return res.status(400).json({
            error: 'Refresh token is required'
          });
        }

        // Verify refresh token
        const decoded = jwtService.verifyRefreshToken(refreshToken);
        
        // Get user from session
        const user = await sessionManager.getUserByRefreshToken(refreshToken);
        
        if (!user) {
          return res.status(401).json({
            error: 'Invalid refresh token'
          });
        }

        // Generate new tokens
        const newTokens = jwtService.generateTokenPair(user);

        // Update session
        await sessionManager.storeUserSession(user.id, user, newTokens.refreshToken);

        res.json({
          tokens: newTokens
        });
      } catch (error) {
        console.error('Refresh error:', error);
        res.status(401).json({
          error: 'Invalid refresh token'
        });
      }
    });

    // Logout endpoint
    this.app.post('/auth/logout', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const token = jwtService.extractTokenFromHeader(authHeader);

        if (token) {
          try {
            const decoded = jwtService.verifyAccessToken(token);
            await sessionManager.invalidateUserSession(decoded.sub);
          } catch (error) {
            // Token might be expired, but we still want to logout
            console.warn('Token verification failed during logout:', error.message);
          }
        }

        res.json({ message: 'Logged out successfully' });
      } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
          error: 'Internal server error'
        });
      }
    });

    // User profile endpoint
    this.app.get('/auth/profile', async (req, res) => {
      try {
        const authHeader = req.headers.authorization;
        const token = jwtService.extractTokenFromHeader(authHeader);

        if (!token) {
          return res.status(401).json({
            error: 'Authentication required'
          });
        }

        const decoded = jwtService.verifyAccessToken(token);
        const session = await sessionManager.getUserSession(decoded.sub);

        if (!session) {
          return res.status(401).json({
            error: 'Session not found'
          });
        }

        res.json({
          user: {
            id: session.user.id,
            email: session.user.email,
            tenantId: session.user.tenantId,
            roles: session.user.roles.map(role => role.name)
          }
        });
      } catch (error) {
        console.error('Profile error:', error);
        res.status(401).json({
          error: 'Invalid token'
        });
      }
    });
  }

  private setupGateway(): void {
    this.gateway = new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: gatewayConfig.subgraphs.map(subgraph => ({
          name: subgraph.name,
          url: subgraph.url
        }))
      }),
      buildService: ({ name, url }) => {
        return {
          process: ({ request, context }) => {
            // Add authentication context to subgraph requests
            if (context.user) {
              request.http.headers.set('x-user-id', context.user.id);
              request.http.headers.set('x-tenant-id', context.user.tenantId);
              request.http.headers.set('x-user-roles', JSON.stringify(context.user.roles.map(r => r.name)));
            }
            
            return Promise.resolve({ response: request });
          }
        };
      }
    });
  }

  private async setupApolloServer(): Promise<void> {
    this.server = new ApolloServer({
      gateway: this.gateway,
      plugins: [
        createAuthPlugin(),
        ...createSecurityPlugins(),
        {
          requestDidStart() {
            return {
              didResolveOperation(requestContext) {
                const { operationName, operation } = requestContext.request;
                console.log(`GraphQL Operation: ${operationName || 'Anonymous'}`);
                
                // Log operation details for monitoring
                if (operation) {
                  console.log(`Operation type: ${operation.operation}`);
                  console.log(`Operation complexity: ${requestContext.request.query?.length || 0} characters`);
                }
              },
              
              didEncounterErrors(requestContext) {
                console.error('GraphQL Errors:', requestContext.errors);
              },
              
              willSendResponse(requestContext) {
                const { response, context } = requestContext;
                
                // Add performance headers
                response.http.headers.set('X-Response-Time', `${Date.now() - context.startTime}ms`);
                
                // Add security headers
                response.http.headers.set('X-Content-Type-Options', 'nosniff');
                response.http.headers.set('X-Frame-Options', 'DENY');
                response.http.headers.set('Cache-Control', 'no-store');
              }
            };
          }
        }
      ],
      validationRules: [
        queryDepthLimit,
        queryComplexityLimit
      ],
      introspection: gatewayConfig.security.introspectionEnabled,
      persistedQueries: false,
      includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production'
    });
  }

  public async start(): Promise<void> {
    try {
      await this.setupApolloServer();
      await this.server.start();

      // Apply GraphQL middleware
      this.app.use(
        gatewayConfig.graphqlPath,
        expressMiddleware(this.server, {
          context: createGraphQLContext
        })
      );

      // Start the server
      this.app.listen(gatewayConfig.port, gatewayConfig.host, () => {
        console.log(`🚀 GraphQL Gateway ready at http://${gatewayConfig.host}:${gatewayConfig.port}${gatewayConfig.graphqlPath}`);
        console.log(`🔍 Health check at http://${gatewayConfig.host}:${gatewayConfig.port}/health`);
        console.log(`📊 Metrics at http://${gatewayConfig.host}:${gatewayConfig.port}/metrics`);
        console.log(`🔐 Authentication endpoints:`);
        console.log(`  - POST /auth/login`);
        console.log(`  - POST /auth/refresh`);
        console.log(`  - POST /auth/logout`);
        console.log(`  - GET /auth/profile`);
        console.log(`\n🔧 Subgraphs:`);
        gatewayConfig.subgraphs.forEach(subgraph => {
          console.log(`  - ${subgraph.name}: ${subgraph.url}`);
        });
      });
    } catch (error) {
      console.error('Failed to start gateway:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    if (this.server) {
      await this.server.stop();
    }
    
    // Close session manager
    await sessionManager.close();
  }
}

// Start the gateway if this file is run directly
if (require.main === module) {
  const gateway = new GraphQLGateway();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down gateway...');
    await gateway.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nShutting down gateway...');
    await gateway.stop();
    process.exit(0);
  });
  
  gateway.start().catch(console.error);
}

export default GraphQLGateway;