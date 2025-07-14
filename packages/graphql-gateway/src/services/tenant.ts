import { Tenant, TenantSettings, User } from '../types';
import { sessionManager } from '../auth/session';
import { userService } from './user';

export class TenantService {
  private tenants: Map<string, Tenant> = new Map();

  constructor() {
    this.initializeDefaultTenants();
  }

  private initializeDefaultTenants(): void {
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

    // Initialize enterprise tenant
    const enterpriseTenant: Tenant = {
      id: 'tenant-enterprise',
      name: 'Enterprise Tenant',
      domain: 'enterprise.autoweave.com',
      isActive: true,
      settings: {
        maxUsers: 1000,
        maxAgents: 500,
        rateLimitPerMinute: 1000,
        queryComplexityLimit: 5000,
        allowedFeatures: ['agents', 'memory', 'queue', 'plugins', 'observability', 'advanced-analytics']
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tenants.set(enterpriseTenant.id, enterpriseTenant);
  }

  /**
   * Get all tenants
   */
  async getTenants(): Promise<Tenant[]> {
    return Array.from(this.tenants.values());
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);
    if (tenant) {
      // Store in Redis cache for session management
      await sessionManager.storeTenant(tenant);
    }
    return tenant || null;
  }

  /**
   * Get tenant by domain
   */
  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.domain === domain) {
        // Store in Redis cache for session management
        await sessionManager.storeTenant(tenant);
        return tenant;
      }
    }
    return null;
  }

  /**
   * Create tenant
   */
  async createTenant(tenantData: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const tenant: Tenant = {
      id: `tenant_${Date.now()}`,
      ...tenantData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.tenants.set(tenant.id, tenant);
    
    // Store in Redis cache
    await sessionManager.storeTenant(tenant);
    
    return tenant;
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      return null;
    }

    const updatedTenant: Tenant = {
      ...tenant,
      ...updates,
      id: tenant.id, // Prevent ID change
      updatedAt: new Date()
    };

    this.tenants.set(id, updatedTenant);
    
    // Update Redis cache
    await sessionManager.storeTenant(updatedTenant);
    
    return updatedTenant;
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id: string): Promise<boolean> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      return false;
    }

    // Get all users for this tenant
    const tenantUsers = await userService.findUsersByTenant(id);
    
    // Delete all users in this tenant
    for (const user of tenantUsers) {
      await userService.deleteUser(user.id);
    }

    // Invalidate all sessions for this tenant
    await sessionManager.invalidateTenantSessions(id);

    this.tenants.delete(id);
    return true;
  }

  /**
   * Update tenant settings
   */
  async updateTenantSettings(id: string, settings: Partial<TenantSettings>): Promise<Tenant | null> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      return null;
    }

    const updatedTenant: Tenant = {
      ...tenant,
      settings: {
        ...tenant.settings,
        ...settings
      },
      updatedAt: new Date()
    };

    this.tenants.set(id, updatedTenant);
    
    // Update Redis cache
    await sessionManager.storeTenant(updatedTenant);
    
    return updatedTenant;
  }

  /**
   * Check if tenant has feature enabled
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    return tenant.settings.allowedFeatures.includes(feature);
  }

  /**
   * Check if tenant can create more users
   */
  async canCreateUser(tenantId: string): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    const currentUsers = await userService.findUsersByTenant(tenantId);
    return currentUsers.length < tenant.settings.maxUsers;
  }

  /**
   * Check if tenant can create more agents
   */
  async canCreateAgent(tenantId: string): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    // In a real implementation, you would check the actual number of agents
    // For now, we'll assume they can create agents if under the limit
    return true; // Placeholder
  }

  /**
   * Get tenant usage statistics
   */
  async getTenantUsage(tenantId: string): Promise<{
    userCount: number;
    agentCount: number;
    activeSessionCount: number;
    storageUsed: number;
    requestsToday: number;
  } | null> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return null;
    }

    const users = await userService.findUsersByTenant(tenantId);
    const activeSessionCount = await sessionManager.getActiveSessionsCount(tenantId);

    return {
      userCount: users.length,
      agentCount: 0, // Placeholder - would query agent service
      activeSessionCount,
      storageUsed: 0, // Placeholder - would query storage service
      requestsToday: 0 // Placeholder - would query metrics service
    };
  }

  /**
   * Get tenant limits
   */
  async getTenantLimits(tenantId: string): Promise<TenantSettings | null> {
    const tenant = this.tenants.get(tenantId);
    return tenant?.settings || null;
  }

  /**
   * Check if tenant is within rate limits
   */
  async isWithinRateLimit(tenantId: string, requestCount: number): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    return requestCount <= tenant.settings.rateLimitPerMinute;
  }

  /**
   * Check if query complexity is within limits
   */
  async isWithinComplexityLimit(tenantId: string, complexity: number): Promise<boolean> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    return complexity <= tenant.settings.queryComplexityLimit;
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(id: string): Promise<boolean> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      return false;
    }

    const updatedTenant: Tenant = {
      ...tenant,
      isActive: false,
      updatedAt: new Date()
    };

    this.tenants.set(id, updatedTenant);
    
    // Update Redis cache
    await sessionManager.storeTenant(updatedTenant);
    
    // Invalidate all sessions for this tenant
    await sessionManager.invalidateTenantSessions(id);
    
    return true;
  }

  /**
   * Reactivate tenant
   */
  async reactivateTenant(id: string): Promise<boolean> {
    const tenant = this.tenants.get(id);
    if (!tenant) {
      return false;
    }

    const updatedTenant: Tenant = {
      ...tenant,
      isActive: true,
      updatedAt: new Date()
    };

    this.tenants.set(id, updatedTenant);
    
    // Update Redis cache
    await sessionManager.storeTenant(updatedTenant);
    
    return true;
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalActiveSessions: number;
  }> {
    const tenants = Array.from(this.tenants.values());
    const activeTenants = tenants.filter(t => t.isActive);
    
    let totalUsers = 0;
    let totalActiveSessions = 0;
    
    for (const tenant of tenants) {
      const users = await userService.findUsersByTenant(tenant.id);
      const sessions = await sessionManager.getActiveSessionsCount(tenant.id);
      
      totalUsers += users.length;
      totalActiveSessions += sessions;
    }

    return {
      totalTenants: tenants.length,
      activeTenants: activeTenants.length,
      totalUsers,
      totalActiveSessions
    };
  }
}

export const tenantService = new TenantService();