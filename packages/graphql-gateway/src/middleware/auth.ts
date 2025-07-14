import { Request, Response, NextFunction } from 'express';
import { GraphQLError } from 'graphql';
import { jwtService } from '../auth/jwt';
import { sessionManager } from '../auth/session';
import { rbacService } from '../rbac/rbac';
import { User, GraphQLContext } from '../types';

export interface AuthRequest extends Request {
  user?: User;
  token?: string;
}

/**
 * Express middleware for JWT authentication
 */
export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);

    if (!token) {
      req.user = undefined;
      return next();
    }

    // Verify access token
    const decoded = jwtService.verifyAccessToken(token);
    
    // Get user session
    const session = await sessionManager.getUserSession(decoded.sub);
    
    if (!session) {
      req.user = undefined;
      return next();
    }

    // Update last access
    await sessionManager.updateLastAccess(decoded.sub);

    req.user = session.user;
    req.token = token;
    
    next();
  } catch (error) {
    // Don't throw errors in middleware - let GraphQL handle authentication requirements
    req.user = undefined;
    next();
  }
}

/**
 * GraphQL context creator with authentication
 */
export function createGraphQLContext(req: AuthRequest, res: Response): GraphQLContext {
  const user = req.user;
  
  return {
    user,
    tenant: user ? undefined : undefined, // Will be populated by tenant middleware
    permissions: new Set(user ? rbacService.getEffectivePermissions(user).map(p => `${p.resource}:${p.action}`) : []),
    rateLimiter: res.locals.rateLimiter,
    req,
    res
  };
}

/**
 * Authentication plugin for Apollo Server
 */
export function createAuthPlugin() {
  return {
    requestDidStart() {
      return {
        willSendResponse(requestContext: any) {
          // Add authentication headers
          const { response, context } = requestContext;
          
          if (context.user) {
            response.http.headers.set('X-User-ID', context.user.id);
            response.http.headers.set('X-Tenant-ID', context.user.tenantId);
          }
        }
      };
    }
  };
}

/**
 * Require authentication for GraphQL operations
 */
export function requireAuth(context: GraphQLContext): User {
  if (!context.user) {
    throw new GraphQLError('Authentication required', {
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 }
      }
    });
  }
  
  return context.user;
}

/**
 * Require specific permission
 */
export function requirePermission(context: GraphQLContext, permission: string): User {
  const user = requireAuth(context);
  
  if (!rbacService.hasPermission(user, permission)) {
    throw new GraphQLError('Insufficient permissions', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
        requiredPermission: permission
      }
    });
  }
  
  return user;
}

/**
 * Require specific role
 */
export function requireRole(context: GraphQLContext, roleName: string): User {
  const user = requireAuth(context);
  
  if (!rbacService.hasRole(user, roleName)) {
    throw new GraphQLError('Insufficient role privileges', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 },
        requiredRole: roleName
      }
    });
  }
  
  return user;
}

/**
 * Require tenant admin or higher
 */
export function requireTenantAdmin(context: GraphQLContext): User {
  const user = requireAuth(context);
  
  if (!rbacService.isTenantAdmin(user) && !rbacService.isSuperAdmin(user)) {
    throw new GraphQLError('Tenant admin privileges required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 }
      }
    });
  }
  
  return user;
}

/**
 * Require super admin
 */
export function requireSuperAdmin(context: GraphQLContext): User {
  const user = requireAuth(context);
  
  if (!rbacService.isSuperAdmin(user)) {
    throw new GraphQLError('Super admin privileges required', {
      extensions: {
        code: 'FORBIDDEN',
        http: { status: 403 }
      }
    });
  }
  
  return user;
}

/**
 * Check tenant isolation
 */
export function enforceTenantIsolation<T extends { tenantId?: string }>(
  context: GraphQLContext,
  resource: T
): T {
  const user = requireAuth(context);
  
  if (resource.tenantId && resource.tenantId !== user.tenantId) {
    if (!rbacService.isSuperAdmin(user)) {
      throw new GraphQLError('Access denied: resource not in your tenant', {
        extensions: {
          code: 'FORBIDDEN',
          http: { status: 403 }
        }
      });
    }
  }
  
  return resource;
}

/**
 * Filter resources by tenant
 */
export function filterByTenant<T extends { tenantId?: string }>(
  context: GraphQLContext,
  resources: T[]
): T[] {
  const user = requireAuth(context);
  
  if (rbacService.isSuperAdmin(user)) {
    return resources;
  }
  
  return resources.filter(resource => 
    !resource.tenantId || resource.tenantId === user.tenantId
  );
}