import { User, Permission, SystemPermissions, Role } from '../types';
import { rbacService } from '../rbac/rbac';

/**
 * Permission utilities for GraphQL operations
 */
export class PermissionUtils {
  /**
   * Check if user has specific permission
   */
  static hasPermission(user: User, permission: SystemPermissions | string): boolean {
    return rbacService.hasPermission(user, permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(user: User, permissions: (SystemPermissions | string)[]): boolean {
    return rbacService.hasAnyPermission(user, permissions);
  }

  /**
   * Check if user has all specified permissions
   */
  static hasAllPermissions(user: User, permissions: (SystemPermissions | string)[]): boolean {
    return rbacService.hasAllPermissions(user, permissions);
  }

  /**
   * Get all effective permissions for a user
   */
  static getEffectivePermissions(user: User): Permission[] {
    return rbacService.getEffectivePermissions(user);
  }

  /**
   * Check if user can perform action on resource
   */
  static canPerformAction(user: User, action: string, resource: string): boolean {
    const permission = `${resource}:${action}`;
    return rbacService.hasPermission(user, permission);
  }

  /**
   * Check if user can access resource within their tenant
   */
  static canAccessResource(user: User, resource: { tenantId?: string }): boolean {
    if (!resource.tenantId) {
      return true; // No tenant restriction
    }

    if (rbacService.isSuperAdmin(user)) {
      return true; // Super admin can access all resources
    }

    return resource.tenantId === user.tenantId;
  }

  /**
   * Filter resources by user permissions
   */
  static filterResourcesByPermission<T extends { id: string; tenantId?: string }>(
    user: User,
    resources: T[],
    requiredPermission: SystemPermissions
  ): T[] {
    return rbacService.filterAllowedResources(user, resources, requiredPermission);
  }

  /**
   * Check if user can manage other user
   */
  static canManageUser(manager: User, targetUser: User): boolean {
    // Super admin can manage everyone
    if (rbacService.isSuperAdmin(manager)) {
      return true;
    }

    // Tenant admin can manage users in their tenant
    if (rbacService.isTenantAdmin(manager) && manager.tenantId === targetUser.tenantId) {
      return true;
    }

    // Users can manage themselves
    return manager.id === targetUser.id;
  }

  /**
   * Check if user can assign role to another user
   */
  static canAssignRole(assigner: User, targetUser: User, role: Role): boolean {
    // Must be in same tenant (unless super admin)
    if (!rbacService.isSuperAdmin(assigner) && assigner.tenantId !== targetUser.tenantId) {
      return false;
    }

    // Check if user can assign this role
    return rbacService.canAssignRole(assigner, role);
  }

  /**
   * Check if user can grant permission
   */
  static canGrantPermission(granter: User, permission: Permission): boolean {
    return rbacService.canGrantPermission(granter, permission);
  }

  /**
   * Get permissions for GraphQL field
   */
  static getFieldPermissions(typeName: string, fieldName: string): SystemPermissions[] {
    const fieldPermissionMap: Record<string, SystemPermissions[]> = {
      // User type
      'User.roles': [SystemPermissions.USERS_READ],
      'User.permissions': [SystemPermissions.USERS_READ],
      'User.tenantId': [SystemPermissions.USERS_READ],
      
      // Agent type
      'Agent.config': [SystemPermissions.AGENTS_READ],
      'Agent.secrets': [SystemPermissions.AGENTS_UPDATE],
      'Agent.metrics': [SystemPermissions.OBSERVABILITY_READ],
      'Agent.logs': [SystemPermissions.OBSERVABILITY_READ],
      
      // Memory type
      'Memory.embedding': [SystemPermissions.MEMORY_READ],
      'Memory.content': [SystemPermissions.MEMORY_READ],
      
      // Queue type
      'Queue.stats': [SystemPermissions.QUEUE_READ],
      'Queue.workers': [SystemPermissions.QUEUE_READ],
      
      // Plugin type
      'Plugin.config': [SystemPermissions.PLUGINS_READ],
      'Plugin.permissions': [SystemPermissions.PLUGINS_READ],
      
      // Observability type
      'Metric.value': [SystemPermissions.OBSERVABILITY_READ],
      'LogEntry.message': [SystemPermissions.OBSERVABILITY_READ],
      'Alert.condition': [SystemPermissions.OBSERVABILITY_READ],
      'Dashboard.panels': [SystemPermissions.OBSERVABILITY_READ],
      'HealthCheck.endpoint': [SystemPermissions.OBSERVABILITY_READ],
      'AuditLog.details': [SystemPermissions.OBSERVABILITY_ADMIN]
    };

    const key = `${typeName}.${fieldName}`;
    return fieldPermissionMap[key] || [];
  }

  /**
   * Check if operation is allowed for user
   */
  static isOperationAllowed(user: User, operationName: string, operationType: 'query' | 'mutation' | 'subscription'): boolean {
    const operationPermissions: Record<string, SystemPermissions[]> = {
      // Agent operations
      'agents': [SystemPermissions.AGENTS_READ],
      'agent': [SystemPermissions.AGENTS_READ],
      'createAgent': [SystemPermissions.AGENTS_CREATE],
      'updateAgent': [SystemPermissions.AGENTS_UPDATE],
      'deleteAgent': [SystemPermissions.AGENTS_DELETE],
      'deployAgent': [SystemPermissions.AGENTS_DEPLOY],
      
      // Memory operations
      'memories': [SystemPermissions.MEMORY_READ],
      'memory': [SystemPermissions.MEMORY_READ],
      'createMemory': [SystemPermissions.MEMORY_WRITE],
      'updateMemory': [SystemPermissions.MEMORY_WRITE],
      'deleteMemory': [SystemPermissions.MEMORY_DELETE],
      
      // Queue operations
      'jobs': [SystemPermissions.QUEUE_READ],
      'queues': [SystemPermissions.QUEUE_READ],
      'createJob': [SystemPermissions.QUEUE_WRITE],
      'updateJob': [SystemPermissions.QUEUE_WRITE],
      'deleteJob': [SystemPermissions.QUEUE_DELETE],
      
      // Plugin operations
      'plugins': [SystemPermissions.PLUGINS_READ],
      'plugin': [SystemPermissions.PLUGINS_READ],
      'installPlugin': [SystemPermissions.PLUGINS_INSTALL],
      'uninstallPlugin': [SystemPermissions.PLUGINS_UNINSTALL],
      
      // Observability operations
      'metrics': [SystemPermissions.OBSERVABILITY_READ],
      'logs': [SystemPermissions.OBSERVABILITY_READ],
      'alerts': [SystemPermissions.OBSERVABILITY_READ],
      'createAlert': [SystemPermissions.OBSERVABILITY_ADMIN],
      'updateAlert': [SystemPermissions.OBSERVABILITY_ADMIN],
      'deleteAlert': [SystemPermissions.OBSERVABILITY_ADMIN]
    };

    const requiredPermissions = operationPermissions[operationName];
    if (!requiredPermissions) {
      return true; // No specific permissions required
    }

    return rbacService.hasAnyPermission(user, requiredPermissions);
  }

  /**
   * Create permission filter for database queries
   */
  static createPermissionFilter(user: User, resource: string): Record<string, any> {
    const filters: Record<string, any> = {};

    // Add tenant filter for non-super admins
    if (!rbacService.isSuperAdmin(user)) {
      filters.tenantId = user.tenantId;
    }

    // Add user filter for user-specific resources
    if (resource === 'user' && !rbacService.isTenantAdmin(user)) {
      filters.userId = user.id;
    }

    return filters;
  }

  /**
   * Check if user can perform bulk operations
   */
  static canPerformBulkOperation(user: User, operation: string, count: number): boolean {
    // Super admin can perform any bulk operation
    if (rbacService.isSuperAdmin(user)) {
      return true;
    }

    // Tenant admin can perform bulk operations within limits
    if (rbacService.isTenantAdmin(user)) {
      return count <= 100; // Example limit
    }

    // Regular users have stricter limits
    return count <= 10;
  }

  /**
   * Get user's permission summary
   */
  static getPermissionSummary(user: User): {
    roles: string[];
    permissions: string[];
    canCreateAgents: boolean;
    canManageUsers: boolean;
    canViewObservability: boolean;
    canManagePlugins: boolean;
    isSuperAdmin: boolean;
    isTenantAdmin: boolean;
  } {
    const effectivePermissions = rbacService.getEffectivePermissions(user);
    
    return {
      roles: user.roles.map(role => role.name),
      permissions: effectivePermissions.map(p => `${p.resource}:${p.action}`),
      canCreateAgents: rbacService.hasPermission(user, SystemPermissions.AGENTS_CREATE),
      canManageUsers: rbacService.hasPermission(user, SystemPermissions.USERS_CREATE),
      canViewObservability: rbacService.hasPermission(user, SystemPermissions.OBSERVABILITY_READ),
      canManagePlugins: rbacService.hasPermission(user, SystemPermissions.PLUGINS_INSTALL),
      isSuperAdmin: rbacService.isSuperAdmin(user),
      isTenantAdmin: rbacService.isTenantAdmin(user)
    };
  }
}

export const permissionUtils = new PermissionUtils();