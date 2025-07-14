import { User, Role, Permission, Tenant, SystemPermissions, RoleLevel } from '../types';

export class RBACService {
  
  /**
   * Default system roles configuration
   */
  private static readonly DEFAULT_ROLES: Omit<Role, 'id'>[] = [
    {
      name: 'Super Admin',
      description: 'Full system access across all tenants',
      permissions: Object.values(SystemPermissions).map(permission => ({
        id: `perm_${permission}`,
        name: permission,
        resource: permission.split(':')[0],
        action: permission.split(':')[1]
      })),
      isSystem: true,
      level: RoleLevel.SUPER_ADMIN
    },
    {
      name: 'Tenant Admin',
      description: 'Full access within tenant scope',
      permissions: [
        SystemPermissions.USERS_CREATE,
        SystemPermissions.USERS_READ,
        SystemPermissions.USERS_UPDATE,
        SystemPermissions.USERS_DELETE,
        SystemPermissions.AGENTS_CREATE,
        SystemPermissions.AGENTS_READ,
        SystemPermissions.AGENTS_UPDATE,
        SystemPermissions.AGENTS_DELETE,
        SystemPermissions.AGENTS_DEPLOY,
        SystemPermissions.MEMORY_READ,
        SystemPermissions.MEMORY_WRITE,
        SystemPermissions.MEMORY_DELETE,
        SystemPermissions.QUEUE_READ,
        SystemPermissions.QUEUE_WRITE,
        SystemPermissions.QUEUE_DELETE,
        SystemPermissions.PLUGINS_READ,
        SystemPermissions.PLUGINS_INSTALL,
        SystemPermissions.PLUGINS_UNINSTALL,
        SystemPermissions.OBSERVABILITY_READ,
        SystemPermissions.OBSERVABILITY_ADMIN,
        SystemPermissions.TENANT_ADMIN
      ].map(permission => ({
        id: `perm_${permission}`,
        name: permission,
        resource: permission.split(':')[0],
        action: permission.split(':')[1]
      })),
      isSystem: true,
      level: RoleLevel.TENANT_ADMIN
    },
    {
      name: 'Developer',
      description: 'Development and deployment access',
      permissions: [
        SystemPermissions.AGENTS_CREATE,
        SystemPermissions.AGENTS_READ,
        SystemPermissions.AGENTS_UPDATE,
        SystemPermissions.AGENTS_DEPLOY,
        SystemPermissions.MEMORY_READ,
        SystemPermissions.MEMORY_WRITE,
        SystemPermissions.QUEUE_READ,
        SystemPermissions.QUEUE_WRITE,
        SystemPermissions.PLUGINS_READ,
        SystemPermissions.PLUGINS_INSTALL,
        SystemPermissions.OBSERVABILITY_READ
      ].map(permission => ({
        id: `perm_${permission}`,
        name: permission,
        resource: permission.split(':')[0],
        action: permission.split(':')[1]
      })),
      isSystem: true,
      level: RoleLevel.DEVELOPER
    },
    {
      name: 'Viewer',
      description: 'Read-only access',
      permissions: [
        SystemPermissions.AGENTS_READ,
        SystemPermissions.MEMORY_READ,
        SystemPermissions.QUEUE_READ,
        SystemPermissions.PLUGINS_READ,
        SystemPermissions.OBSERVABILITY_READ
      ].map(permission => ({
        id: `perm_${permission}`,
        name: permission,
        resource: permission.split(':')[0],
        action: permission.split(':')[1]
      })),
      isSystem: true,
      level: RoleLevel.VIEWER
    }
  ];

  /**
   * Check if user has permission
   */
  hasPermission(user: User, permission: SystemPermissions | string, resourceId?: string): boolean {
    // Super admin has all permissions
    if (this.isSuperAdmin(user)) {
      return true;
    }

    // Check direct permissions
    const hasDirectPermission = user.permissions.some(p => 
      `${p.resource}:${p.action}` === permission
    );

    if (hasDirectPermission) {
      // Check resource-specific conditions if needed
      if (resourceId) {
        return this.checkResourceAccess(user, permission, resourceId);
      }
      return true;
    }

    // Check inherited permissions from roles
    for (const role of user.roles) {
      const hasRolePermission = role.permissions.some(p => 
        `${p.resource}:${p.action}` === permission
      );
      
      if (hasRolePermission) {
        if (resourceId) {
          return this.checkResourceAccess(user, permission, resourceId);
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(user: User, permissions: (SystemPermissions | string)[]): boolean {
    return permissions.some(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if user has all specified permissions
   */
  hasAllPermissions(user: User, permissions: (SystemPermissions | string)[]): boolean {
    return permissions.every(permission => this.hasPermission(user, permission));
  }

  /**
   * Check if user has role
   */
  hasRole(user: User, roleName: string): boolean {
    return user.roles.some(role => role.name === roleName);
  }

  /**
   * Check if user has any of the specified roles
   */
  hasAnyRole(user: User, roleNames: string[]): boolean {
    return roleNames.some(roleName => this.hasRole(user, roleName));
  }

  /**
   * Check if user is super admin
   */
  isSuperAdmin(user: User): boolean {
    return user.roles.some(role => 
      role.name === 'Super Admin' && role.level === RoleLevel.SUPER_ADMIN
    );
  }

  /**
   * Check if user is tenant admin
   */
  isTenantAdmin(user: User): boolean {
    return user.roles.some(role => 
      role.name === 'Tenant Admin' && role.level === RoleLevel.TENANT_ADMIN
    );
  }

  /**
   * Check resource-level access (tenant isolation)
   */
  checkResourceAccess(user: User, permission: string, resourceId: string): boolean {
    // Super admin can access all resources
    if (this.isSuperAdmin(user)) {
      return true;
    }

    // For tenant-scoped resources, check if user belongs to the same tenant
    // This is a simplified example - in practice, you might have more complex rules
    const tenantScopedPermissions = [
      SystemPermissions.USERS_CREATE,
      SystemPermissions.USERS_READ,
      SystemPermissions.USERS_UPDATE,
      SystemPermissions.USERS_DELETE,
      SystemPermissions.AGENTS_CREATE,
      SystemPermissions.AGENTS_READ,
      SystemPermissions.AGENTS_UPDATE,
      SystemPermissions.AGENTS_DELETE,
      SystemPermissions.TENANT_ADMIN
    ];

    if (tenantScopedPermissions.includes(permission as SystemPermissions)) {
      // In a real implementation, you would lookup the resource's tenant
      // For now, we assume the resourceId contains tenant information
      return resourceId.includes(user.tenantId);
    }

    return true;
  }

  /**
   * Get effective permissions for user (direct + inherited)
   */
  getEffectivePermissions(user: User): Permission[] {
    const permissions = new Map<string, Permission>();

    // Add direct permissions
    user.permissions.forEach(permission => {
      const key = `${permission.resource}:${permission.action}`;
      permissions.set(key, permission);
    });

    // Add permissions from roles
    user.roles.forEach(role => {
      role.permissions.forEach(permission => {
        const key = `${permission.resource}:${permission.action}`;
        if (!permissions.has(key)) {
          permissions.set(key, permission);
        }
      });
    });

    return Array.from(permissions.values());
  }

  /**
   * Filter resources based on user permissions
   */
  filterAllowedResources<T extends { id: string; tenantId?: string }>(
    user: User, 
    resources: T[], 
    requiredPermission: SystemPermissions
  ): T[] {
    return resources.filter(resource => {
      // Check basic permission
      if (!this.hasPermission(user, requiredPermission)) {
        return false;
      }

      // Check tenant isolation
      if (resource.tenantId && resource.tenantId !== user.tenantId && !this.isSuperAdmin(user)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Create role hierarchy validation
   */
  canAssignRole(assignerUser: User, targetRole: Role): boolean {
    // Super admin can assign any role
    if (this.isSuperAdmin(assignerUser)) {
      return true;
    }

    // Tenant admin can assign roles within their level or below
    if (this.isTenantAdmin(assignerUser)) {
      return targetRole.level >= RoleLevel.TENANT_ADMIN;
    }

    // Other users cannot assign roles
    return false;
  }

  /**
   * Validate permission grant
   */
  canGrantPermission(granterUser: User, permission: Permission): boolean {
    // User must have the permission they're trying to grant
    const permissionString = `${permission.resource}:${permission.action}`;
    return this.hasPermission(granterUser, permissionString);
  }

  /**
   * Get default roles
   */
  getDefaultRoles(): Omit<Role, 'id'>[] {
    return RBACService.DEFAULT_ROLES;
  }

  /**
   * Get user's highest role level
   */
  getUserMaxRoleLevel(user: User): RoleLevel {
    if (user.roles.length === 0) {
      return RoleLevel.VIEWER;
    }

    return Math.min(...user.roles.map(role => role.level));
  }
}

export const rbacService = new RBACService();