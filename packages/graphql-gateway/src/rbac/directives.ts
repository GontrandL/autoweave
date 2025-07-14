import { GraphQLError } from 'graphql';
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { GraphQLSchema } from 'graphql';
import { AuthDirectiveArgs, GraphQLContext, SystemPermissions } from '../types';
import { rbacService } from './rbac';

export const authDirectiveTypeDefs = `
  directive @auth(
    requires: [String!]
    roles: [String!]
    tenantIsolated: Boolean = false
    allowSelf: Boolean = false
  ) on FIELD_DEFINITION | OBJECT

  directive @rateLimit(
    max: Int = 100
    window: Int = 60
  ) on FIELD_DEFINITION
`;

export function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const authDirective = getDirective(schema, fieldConfig, 'auth')?.[0] as AuthDirectiveArgs;
      
      if (authDirective) {
        const { resolve = (obj, args, context, info) => obj[info.fieldName] } = fieldConfig;
        
        fieldConfig.resolve = async function (source, args, context: GraphQLContext, info) {
          const { user } = context;
          
          // Check if user is authenticated
          if (!user) {
            throw new GraphQLError('Authentication required', {
              extensions: {
                code: 'UNAUTHENTICATED',
                http: { status: 401 }
              }
            });
          }

          // Check permissions
          if (authDirective.requires && authDirective.requires.length > 0) {
            const hasPermission = rbacService.hasAnyPermission(user, authDirective.requires);
            if (!hasPermission) {
              throw new GraphQLError('Insufficient permissions', {
                extensions: {
                  code: 'FORBIDDEN',
                  http: { status: 403 },
                  requiredPermissions: authDirective.requires
                }
              });
            }
          }

          // Check roles
          if (authDirective.roles && authDirective.roles.length > 0) {
            const hasRole = rbacService.hasAnyRole(user, authDirective.roles);
            if (!hasRole) {
              throw new GraphQLError('Insufficient role privileges', {
                extensions: {
                  code: 'FORBIDDEN',
                  http: { status: 403 },
                  requiredRoles: authDirective.roles
                }
              });
            }
          }

          // Check tenant isolation
          if (authDirective.tenantIsolated) {
            // For tenant-isolated resources, check if the resource belongs to user's tenant
            if (source && source.tenantId && source.tenantId !== user.tenantId) {
              if (!rbacService.isSuperAdmin(user)) {
                throw new GraphQLError('Access denied: resource not in your tenant', {
                  extensions: {
                    code: 'FORBIDDEN',
                    http: { status: 403 }
                  }
                });
              }
            }
          }

          // Check allowSelf (user can access their own resources)
          if (authDirective.allowSelf && source && source.userId) {
            if (source.userId === user.id) {
              return resolve(source, args, context, info);
            }
          }

          return resolve(source, args, context, info);
        };
      }
      
      return fieldConfig;
    }
  });
}

export function rateLimitDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
      const rateLimitDirective = getDirective(schema, fieldConfig, 'rateLimit')?.[0];
      
      if (rateLimitDirective) {
        const { resolve = (obj, args, context, info) => obj[info.fieldName] } = fieldConfig;
        
        fieldConfig.resolve = async function (source, args, context: GraphQLContext, info) {
          const { user, rateLimiter } = context;
          
          if (!user) {
            throw new GraphQLError('Authentication required for rate-limited operations', {
              extensions: {
                code: 'UNAUTHENTICATED',
                http: { status: 401 }
              }
            });
          }

          const key = `rate_limit:${user.tenantId}:${typeName}:${info.fieldName}`;
          const max = rateLimitDirective.max || 100;
          const window = rateLimitDirective.window || 60;

          try {
            await rateLimiter.consume(key, 1);
          } catch (rejRes) {
            throw new GraphQLError('Rate limit exceeded', {
              extensions: {
                code: 'RATE_LIMITED',
                http: { status: 429 },
                retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 1
              }
            });
          }

          return resolve(source, args, context, info);
        };
      }
      
      return fieldConfig;
    }
  });
}

/**
 * Field-level permission checker
 */
export function checkFieldPermission(
  user: any,
  fieldName: string,
  typeName: string,
  requiredPermissions: SystemPermissions[]
): boolean {
  // Map GraphQL field to system permissions
  const fieldPermissionMap: Record<string, SystemPermissions[]> = {
    // User fields
    'User.email': [SystemPermissions.USERS_READ],
    'User.roles': [SystemPermissions.USERS_READ],
    'User.permissions': [SystemPermissions.USERS_READ],
    
    // Agent fields
    'Agent.config': [SystemPermissions.AGENTS_READ],
    'Agent.secrets': [SystemPermissions.AGENTS_UPDATE],
    'Agent.logs': [SystemPermissions.OBSERVABILITY_READ],
    
    // Memory fields
    'Memory.data': [SystemPermissions.MEMORY_READ],
    'Memory.embeddings': [SystemPermissions.MEMORY_READ],
    
    // Queue fields
    'Queue.jobs': [SystemPermissions.QUEUE_READ],
    'Queue.metrics': [SystemPermissions.OBSERVABILITY_READ],
    
    // Plugin fields
    'Plugin.manifest': [SystemPermissions.PLUGINS_READ],
    'Plugin.permissions': [SystemPermissions.PLUGINS_READ],
    
    // Observability fields
    'Metrics.system': [SystemPermissions.OBSERVABILITY_ADMIN],
    'Logs.internal': [SystemPermissions.OBSERVABILITY_ADMIN]
  };

  const fieldKey = `${typeName}.${fieldName}`;
  const fieldPermissions = fieldPermissionMap[fieldKey] || requiredPermissions;

  return rbacService.hasAnyPermission(user, fieldPermissions);
}

/**
 * Create context permission checker
 */
export function createPermissionChecker(user: any) {
  return {
    hasPermission: (permission: SystemPermissions | string) => 
      rbacService.hasPermission(user, permission),
    hasRole: (roleName: string) => 
      rbacService.hasRole(user, roleName),
    isSuperAdmin: () => 
      rbacService.isSuperAdmin(user),
    isTenantAdmin: () => 
      rbacService.isTenantAdmin(user),
    canAccess: (resource: any) => {
      if (!resource) return true;
      if (resource.tenantId && resource.tenantId !== user.tenantId) {
        return rbacService.isSuperAdmin(user);
      }
      return true;
    }
  };
}