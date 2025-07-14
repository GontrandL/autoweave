import { User, Tenant, Role, Permission, SystemPermissions, RoleLevel } from '../types';
import { jwtService } from '../auth/jwt';
import { sessionManager } from '../auth/session';
import { rbacService } from '../rbac/rbac';

export class UserService {
  private users: Map<string, User> = new Map();
  private tenants: Map<string, Tenant> = new Map();
  private roles: Map<string, Role> = new Map();
  private permissions: Map<string, Permission> = new Map();

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Initialize default permissions
    Object.values(SystemPermissions).forEach(permission => {
      const [resource, action] = permission.split(':');
      this.permissions.set(permission, {
        id: `perm_${permission}`,
        name: permission,
        resource,
        action
      });
    });

    // Initialize default roles
    const defaultRoles = rbacService.getDefaultRoles();
    defaultRoles.forEach(roleData => {
      const role: Role = {
        id: `role_${roleData.name.toLowerCase().replace(/\s+/g, '_')}`,
        ...roleData
      };
      this.roles.set(role.id, role);
    });

    // Initialize default tenant
    const defaultTenant: Tenant = {
      id: 'tenant-1',
      name: 'Default Tenant',
      domain: 'default.autoweave.com',
      isActive: true,
      settings: {
        maxUsers: 100,
        maxAgents: 50,
        rateLimitPerMinute: 100,
        queryComplexityLimit: 1000,
        allowedFeatures: ['agents', 'memory', 'queue', 'plugins', 'observability']
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tenants.set(defaultTenant.id, defaultTenant);

    // Initialize default admin user
    const adminRole = Array.from(this.roles.values()).find(r => r.name === 'Super Admin');
    const adminUser: User = {
      id: 'user-admin',
      email: 'admin@autoweave.com',
      tenantId: defaultTenant.id,
      roles: adminRole ? [adminRole] : [],
      permissions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(adminUser.id, adminUser);

    // Initialize default developer user
    const developerRole = Array.from(this.roles.values()).find(r => r.name === 'Developer');
    const developerUser: User = {
      id: 'user-1',
      email: 'developer@autoweave.com',
      tenantId: defaultTenant.id,
      roles: developerRole ? [developerRole] : [],
      permissions: [],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(developerUser.id, developerUser);
  }

  /**
   * Find user by ID
   */
  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  /**
   * Find users by tenant
   */
  async findUsersByTenant(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.tenantId === tenantId);
  }

  /**
   * Create a new user
   */
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}`,
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.set(user.id, user);
    return user;
  }

  /**
   * Update user
   */
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      id: user.id, // Prevent ID change
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) {
      return false;
    }

    // Invalidate all sessions for this user
    await sessionManager.invalidateUserSession(id);

    this.users.delete(id);
    return true;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: string, roleId: string): Promise<User | null> {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);

    if (!user || !role) {
      return null;
    }

    // Check if user already has this role
    if (user.roles.find(r => r.id === roleId)) {
      return user;
    }

    const updatedUser: User = {
      ...user,
      roles: [...user.roles, role],
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      roles: user.roles.filter(r => r.id !== roleId),
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  /**
   * Grant permission to user
   */
  async grantPermission(userId: string, permissionId: string): Promise<User | null> {
    const user = this.users.get(userId);
    const permission = this.permissions.get(permissionId);

    if (!user || !permission) {
      return null;
    }

    // Check if user already has this permission
    if (user.permissions.find(p => p.id === permissionId)) {
      return user;
    }

    const updatedUser: User = {
      ...user,
      permissions: [...user.permissions, permission],
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  /**
   * Revoke permission from user
   */
  async revokePermission(userId: string, permissionId: string): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      permissions: user.permissions.filter(p => p.id !== permissionId),
      updatedAt: new Date()
    };

    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  /**
   * Authenticate user
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.findUserByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    // In production, verify password hash
    // For demo purposes, we'll accept any password
    return user;
  }

  /**
   * Get all roles
   */
  async getRoles(): Promise<Role[]> {
    return Array.from(this.roles.values());
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<Role | null> {
    return this.roles.get(id) || null;
  }

  /**
   * Create role
   */
  async createRole(roleData: Omit<Role, 'id'>): Promise<Role> {
    const role: Role = {
      id: `role_${Date.now()}`,
      ...roleData
    };

    this.roles.set(role.id, role);
    return role;
  }

  /**
   * Update role
   */
  async updateRole(id: string, updates: Partial<Role>): Promise<Role | null> {
    const role = this.roles.get(id);
    if (!role) {
      return null;
    }

    const updatedRole: Role = {
      ...role,
      ...updates,
      id: role.id // Prevent ID change
    };

    this.roles.set(id, updatedRole);
    return updatedRole;
  }

  /**
   * Delete role
   */
  async deleteRole(id: string): Promise<boolean> {
    const role = this.roles.get(id);
    if (!role || role.isSystem) {
      return false; // Cannot delete system roles
    }

    // Remove role from all users
    for (const user of this.users.values()) {
      if (user.roles.find(r => r.id === id)) {
        await this.removeRole(user.id, id);
      }
    }

    this.roles.delete(id);
    return true;
  }

  /**
   * Get all permissions
   */
  async getPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  /**
   * Get permission by ID
   */
  async getPermissionById(id: string): Promise<Permission | null> {
    return this.permissions.get(id) || null;
  }
}

export const userService = new UserService();