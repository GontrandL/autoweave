import { GraphQLError } from 'graphql';
import { User, Tenant, Role, Permission } from '../types';
import { tenantService } from '../services/tenant';

/**
 * Validation utilities for GraphQL operations
 */
export class ValidationUtils {
  /**
   * Validate user input
   */
  static validateUser(user: Partial<User>): string[] {
    const errors: string[] = [];

    if (!user.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(user.email)) {
      errors.push('Invalid email format');
    }

    if (!user.tenantId) {
      errors.push('Tenant ID is required');
    }

    return errors;
  }

  /**
   * Validate tenant input
   */
  static validateTenant(tenant: Partial<Tenant>): string[] {
    const errors: string[] = [];

    if (!tenant.name) {
      errors.push('Tenant name is required');
    } else if (tenant.name.length < 2) {
      errors.push('Tenant name must be at least 2 characters');
    }

    if (!tenant.domain) {
      errors.push('Domain is required');
    } else if (!this.isValidDomain(tenant.domain)) {
      errors.push('Invalid domain format');
    }

    if (tenant.settings) {
      const settingsErrors = this.validateTenantSettings(tenant.settings);
      errors.push(...settingsErrors);
    }

    return errors;
  }

  /**
   * Validate tenant settings
   */
  static validateTenantSettings(settings: any): string[] {
    const errors: string[] = [];

    if (settings.maxUsers && (!Number.isInteger(settings.maxUsers) || settings.maxUsers <= 0)) {
      errors.push('Max users must be a positive integer');
    }

    if (settings.maxAgents && (!Number.isInteger(settings.maxAgents) || settings.maxAgents <= 0)) {
      errors.push('Max agents must be a positive integer');
    }

    if (settings.rateLimitPerMinute && (!Number.isInteger(settings.rateLimitPerMinute) || settings.rateLimitPerMinute <= 0)) {
      errors.push('Rate limit per minute must be a positive integer');
    }

    if (settings.queryComplexityLimit && (!Number.isInteger(settings.queryComplexityLimit) || settings.queryComplexityLimit <= 0)) {
      errors.push('Query complexity limit must be a positive integer');
    }

    return errors;
  }

  /**
   * Validate role input
   */
  static validateRole(role: Partial<Role>): string[] {
    const errors: string[] = [];

    if (!role.name) {
      errors.push('Role name is required');
    } else if (role.name.length < 2) {
      errors.push('Role name must be at least 2 characters');
    }

    if (!role.description) {
      errors.push('Role description is required');
    }

    if (role.level !== undefined && (!Number.isInteger(role.level) || role.level < 0)) {
      errors.push('Role level must be a non-negative integer');
    }

    return errors;
  }

  /**
   * Validate permission input
   */
  static validatePermission(permission: Partial<Permission>): string[] {
    const errors: string[] = [];

    if (!permission.name) {
      errors.push('Permission name is required');
    }

    if (!permission.resource) {
      errors.push('Permission resource is required');
    }

    if (!permission.action) {
      errors.push('Permission action is required');
    }

    return errors;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate domain format
   */
  static isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
    return domainRegex.test(domain);
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
    const validatedLimit = Math.min(Math.max(limit || 10, 1), 100);
    const validatedOffset = Math.max(offset || 0, 0);

    return { limit: validatedLimit, offset: validatedOffset };
  }

  /**
   * Validate sort parameters
   */
  static validateSort(sortBy?: string, sortOrder?: string): { sortBy: string; sortOrder: 'asc' | 'desc' } {
    const allowedSortFields = ['id', 'name', 'createdAt', 'updatedAt', 'email'];
    const validatedSortBy = allowedSortFields.includes(sortBy || '') ? sortBy! : 'createdAt';
    const validatedSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';

    return { sortBy: validatedSortBy, sortOrder: validatedSortOrder };
  }

  /**
   * Validate query complexity
   */
  static async validateQueryComplexity(tenantId: string, complexity: number): Promise<void> {
    const isWithinLimit = await tenantService.isWithinComplexityLimit(tenantId, complexity);
    
    if (!isWithinLimit) {
      const tenant = await tenantService.getTenantById(tenantId);
      const limit = tenant?.settings.queryComplexityLimit || 1000;
      
      throw new GraphQLError(
        `Query complexity ${complexity} exceeds tenant limit of ${limit}`,
        {
          extensions: {
            code: 'QUERY_COMPLEXITY_EXCEEDED',
            tenantId,
            complexity,
            limit
          }
        }
      );
    }
  }

  /**
   * Validate rate limiting
   */
  static async validateRateLimit(tenantId: string, requestCount: number): Promise<void> {
    const isWithinLimit = await tenantService.isWithinRateLimit(tenantId, requestCount);
    
    if (!isWithinLimit) {
      const tenant = await tenantService.getTenantById(tenantId);
      const limit = tenant?.settings.rateLimitPerMinute || 100;
      
      throw new GraphQLError(
        `Rate limit exceeded: ${requestCount} requests per minute exceeds tenant limit of ${limit}`,
        {
          extensions: {
            code: 'RATE_LIMIT_EXCEEDED',
            tenantId,
            requestCount,
            limit
          }
        }
      );
    }
  }

  /**
   * Validate tenant feature access
   */
  static async validateFeatureAccess(tenantId: string, feature: string): Promise<void> {
    const hasAccess = await tenantService.hasFeature(tenantId, feature);
    
    if (!hasAccess) {
      throw new GraphQLError(
        `Feature '${feature}' is not available for this tenant`,
        {
          extensions: {
            code: 'FEATURE_NOT_AVAILABLE',
            tenantId,
            feature
          }
        }
      );
    }
  }

  /**
   * Validate tenant status
   */
  static validateTenantStatus(tenant: Tenant): void {
    if (!tenant.isActive) {
      throw new GraphQLError(
        'Tenant is suspended',
        {
          extensions: {
            code: 'TENANT_SUSPENDED',
            tenantId: tenant.id
          }
        }
      );
    }
  }

  /**
   * Validate user status
   */
  static validateUserStatus(user: User): void {
    if (!user.isActive) {
      throw new GraphQLError(
        'User account is disabled',
        {
          extensions: {
            code: 'USER_DISABLED',
            userId: user.id
          }
        }
      );
    }
  }

  /**
   * Validate resource ownership
   */
  static validateResourceOwnership(user: User, resource: { userId?: string; tenantId?: string }): void {
    if (resource.tenantId && resource.tenantId !== user.tenantId) {
      throw new GraphQLError(
        'Access denied: resource belongs to different tenant',
        {
          extensions: {
            code: 'TENANT_MISMATCH',
            userTenantId: user.tenantId,
            resourceTenantId: resource.tenantId
          }
        }
      );
    }

    if (resource.userId && resource.userId !== user.id) {
      throw new GraphQLError(
        'Access denied: resource belongs to different user',
        {
          extensions: {
            code: 'USER_MISMATCH',
            userId: user.id,
            resourceUserId: resource.userId
          }
        }
      );
    }
  }

  /**
   * Validate input sanitization
   */
  static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // Remove HTML tags and dangerous characters
      return input.replace(/<[^>]*>/g, '').trim();
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(file: any): string[] {
    const errors: string[] = [];
    
    if (!file) {
      errors.push('File is required');
      return errors;
    }

    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'text/plain', 'application/json'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push('Invalid file type');
    }

    if (file.size > maxSize) {
      errors.push('File size exceeds limit');
    }

    return errors;
  }

  /**
   * Validate query parameters
   */
  static validateQueryParams(params: Record<string, any>): Record<string, any> {
    const validated: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        validated[key] = this.sanitizeInput(value);
      }
    }

    return validated;
  }

  /**
   * Create validation error
   */
  static createValidationError(message: string, field?: string, code?: string): GraphQLError {
    return new GraphQLError(message, {
      extensions: {
        code: code || 'VALIDATION_ERROR',
        field
      }
    });
  }

  /**
   * Validate batch operation
   */
  static validateBatchOperation(items: any[], maxItems: number = 100): void {
    if (!Array.isArray(items)) {
      throw this.createValidationError('Items must be an array', 'items');
    }

    if (items.length === 0) {
      throw this.createValidationError('Items array cannot be empty', 'items');
    }

    if (items.length > maxItems) {
      throw this.createValidationError(
        `Batch operation cannot exceed ${maxItems} items`,
        'items',
        'BATCH_LIMIT_EXCEEDED'
      );
    }
  }
}

export const validationUtils = new ValidationUtils();