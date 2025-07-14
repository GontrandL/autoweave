// @ts-ignore
import { getLogger } from '../logging/logger';
// @ts-ignore
import { getMetrics } from '../metrics/metrics';

export interface TenantConfig {
  id: string;
  name: string;
  environment: string;
  
  // Resource limits
  limits: {
    maxMetricsPerSecond: number;
    maxTracesPerSecond: number;
    maxLogsPerSecond: number;
    maxRetentionDays: number;
    maxStorageMB: number;
  };
  
  // Data retention policies
  retention: {
    traces: string; // e.g., "7d", "30d"
    logs: string;
    metrics: string;
  };
  
  // Security settings
  security: {
    encryptionEnabled: boolean;
    auditLoggingEnabled: boolean;
    ipWhitelist?: string[];
    allowedOrigins?: string[];
  };
  
  // Compliance requirements
  compliance: {
    gdprCompliant: boolean;
    hipaaCompliant: boolean;
    soc2Compliant: boolean;
    dataRegion: string;
  };
  
  // Alerting configuration
  alerting: {
    enabled: boolean;
    channels: string[];
    escalationPolicy?: string;
  };
}

export interface TenantContext {
  tenantId: string;
  tenantName: string;
  environment: string;
  requestId: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface DataRetentionPolicy {
  type: 'traces' | 'logs' | 'metrics';
  tenantId: string;
  retentionPeriod: string;
  compressionEnabled: boolean;
  archivalEnabled: boolean;
  purgeAfter: string;
  encryptionRequired: boolean;
}

export interface SecurityAuditEvent {
  tenantId: string;
  eventType: string;
  userId?: string;
  action: string;
  resource: string;
  timestamp: Date;
  sourceIp: string;
  userAgent: string;
  outcome: 'success' | 'failure';
  details?: Record<string, any>;
}

export class TenantIsolationManager {
  private tenants: Map<string, TenantConfig> = new Map();
  private retentionPolicies: Map<string, DataRetentionPolicy[]> = new Map();
  private rateLimiters: Map<string, Map<string, number>> = new Map();
  private securityAuditLog: SecurityAuditEvent[] = [];
  private logger = getLogger();
  private metrics = getMetrics();

  constructor(private config: {
    auditRetentionDays?: number;
    compressionEnabled?: boolean;
    encryptionEnabled?: boolean;
    maxTenantsPerInstance?: number;
  } = {}) {
    this.config = {
      auditRetentionDays: 90,
      compressionEnabled: true,
      encryptionEnabled: true,
      maxTenantsPerInstance: 1000,
      ...config,
    };
  }

  // Register a tenant
  registerTenant(config: TenantConfig): void {
    if (this.tenants.size >= this.config.maxTenantsPerInstance!) {
      throw new Error('Maximum tenants per instance exceeded');
    }

    this.tenants.set(config.id, config);
    this.rateLimiters.set(config.id, new Map());
    
    // Create default retention policies
    this.createDefaultRetentionPolicies(config);
    
    this.logger.info(`Tenant registered: ${config.id}`, {
      tenantId: config.id,
      tenantName: config.name,
      environment: config.environment,
      compliance: config.compliance,
    });

    this.metrics.recordBusinessOperation(
      'tenant_registered',
      'system',
      { tenant_id: config.id, environment: config.environment }
    );
  }

  // Get tenant configuration
  getTenantConfig(tenantId: string): TenantConfig | undefined {
    return this.tenants.get(tenantId);
  }

  // Create tenant context
  createTenantContext(tenantId: string, requestId: string, metadata?: Record<string, any>): TenantContext {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    return {
      tenantId,
      tenantName: tenant.name,
      environment: tenant.environment,
      requestId,
      metadata,
    };
  }

  // Check rate limits
  checkRateLimit(tenantId: string, operation: string, limit: number): boolean {
    const tenantLimits = this.rateLimiters.get(tenantId);
    if (!tenantLimits) {
      return false;
    }

    const currentCount = tenantLimits.get(operation) || 0;
    const newCount = currentCount + 1;
    
    if (newCount > limit) {
      this.logger.warn(`Rate limit exceeded for tenant: ${tenantId}`, {
        tenantId,
        operation,
        limit,
        currentCount: newCount,
      });

      this.metrics.recordError(
        'tenant-isolation',
        'rate_limit_exceeded',
        'warning',
        tenantId
      );

      return false;
    }

    tenantLimits.set(operation, newCount);
    return true;
  }

  // Reset rate limits (called periodically)
  resetRateLimits(): void {
    for (const [tenantId, limits] of this.rateLimiters) {
      limits.clear();
    }
  }

  // Validate tenant access
  validateTenantAccess(tenantId: string, sourceIp: string, origin?: string): boolean {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return false;
    }

    // Check IP whitelist
    if (tenant.security.ipWhitelist && tenant.security.ipWhitelist.length > 0) {
      if (!tenant.security.ipWhitelist.includes(sourceIp)) {
        this.auditSecurityEvent({
          tenantId,
          eventType: 'access_denied',
          action: 'ip_whitelist_violation',
          resource: 'tenant_access',
          timestamp: new Date(),
          sourceIp,
          userAgent: '',
          outcome: 'failure',
          details: { reason: 'IP not in whitelist' },
        });
        return false;
      }
    }

    // Check allowed origins
    if (origin && tenant.security.allowedOrigins && tenant.security.allowedOrigins.length > 0) {
      if (!tenant.security.allowedOrigins.includes(origin)) {
        this.auditSecurityEvent({
          tenantId,
          eventType: 'access_denied',
          action: 'origin_validation_failed',
          resource: 'tenant_access',
          timestamp: new Date(),
          sourceIp,
          userAgent: '',
          outcome: 'failure',
          details: { reason: 'Origin not allowed', origin },
        });
        return false;
      }
    }

    return true;
  }

  // Create default retention policies
  private createDefaultRetentionPolicies(tenant: TenantConfig): void {
    const policies: DataRetentionPolicy[] = [
      {
        type: 'traces',
        tenantId: tenant.id,
        retentionPeriod: tenant.retention.traces,
        compressionEnabled: this.config.compressionEnabled!,
        archivalEnabled: tenant.compliance.soc2Compliant,
        purgeAfter: this.calculatePurgeDate(tenant.retention.traces),
        encryptionRequired: tenant.security.encryptionEnabled,
      },
      {
        type: 'logs',
        tenantId: tenant.id,
        retentionPeriod: tenant.retention.logs,
        compressionEnabled: this.config.compressionEnabled!,
        archivalEnabled: tenant.compliance.soc2Compliant,
        purgeAfter: this.calculatePurgeDate(tenant.retention.logs),
        encryptionRequired: tenant.security.encryptionEnabled,
      },
      {
        type: 'metrics',
        tenantId: tenant.id,
        retentionPeriod: tenant.retention.metrics,
        compressionEnabled: this.config.compressionEnabled!,
        archivalEnabled: tenant.compliance.soc2Compliant,
        purgeAfter: this.calculatePurgeDate(tenant.retention.metrics),
        encryptionRequired: tenant.security.encryptionEnabled,
      },
    ];

    this.retentionPolicies.set(tenant.id, policies);
  }

  // Calculate purge date based on retention period
  private calculatePurgeDate(retentionPeriod: string): string {
    const match = retentionPeriod.match(/^(\d+)([dhm])$/);
    if (!match) {
      throw new Error(`Invalid retention period format: ${retentionPeriod}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let multiplier = 1;
    switch (unit) {
      case 'm':
        multiplier = 60 * 1000;
        break;
      case 'h':
        multiplier = 60 * 60 * 1000;
        break;
      case 'd':
        multiplier = 24 * 60 * 60 * 1000;
        break;
    }

    const purgeDate = new Date(Date.now() + (value * multiplier));
    return purgeDate.toISOString();
  }

  // Get retention policy for tenant and data type
  getRetentionPolicy(tenantId: string, dataType: 'traces' | 'logs' | 'metrics'): DataRetentionPolicy | undefined {
    const policies = this.retentionPolicies.get(tenantId);
    return policies?.find(p => p.type === dataType);
  }

  // Apply data retention policies
  async applyRetentionPolicies(): Promise<void> {
    const now = new Date();
    
    for (const [tenantId, policies] of this.retentionPolicies) {
      for (const policy of policies) {
        try {
          const purgeDate = new Date(policy.purgeAfter);
          
          if (now >= purgeDate) {
            await this.purgeData(tenantId, policy);
            
            // Update purge date for next cycle
            policy.purgeAfter = this.calculatePurgeDate(policy.retentionPeriod);
          }
        } catch (error) {
          this.logger.error(`Error applying retention policy for tenant ${tenantId}`, error);
        }
      }
    }
  }

  // Purge data according to retention policy
  private async purgeData(tenantId: string, policy: DataRetentionPolicy): Promise<void> {
    this.logger.info(`Purging ${policy.type} data for tenant: ${tenantId}`, {
      tenantId,
      dataType: policy.type,
      retentionPeriod: policy.retentionPeriod,
    });

    // In a real implementation, this would:
    // 1. Archive data if archival is enabled
    // 2. Compress data if compression is enabled
    // 3. Delete data older than retention period
    // 4. Update metrics

    this.metrics.recordBusinessOperation(
      'data_purged',
      'system',
      { 
        tenant_id: tenantId,
        data_type: policy.type,
        retention_period: policy.retentionPeriod,
      }
    );

    this.auditSecurityEvent({
      tenantId,
      eventType: 'data_purged',
      action: 'retention_policy_applied',
      resource: `${policy.type}_data`,
      timestamp: new Date(),
      sourceIp: 'system',
      userAgent: 'retention-service',
      outcome: 'success',
      details: { retentionPeriod: policy.retentionPeriod },
    });
  }

  // Audit security event
  private auditSecurityEvent(event: SecurityAuditEvent): void {
    this.securityAuditLog.push(event);
    
    // Log to structured logger
    this.logger.logSecurityEvent(
      event.eventType,
      event.outcome === 'failure' ? 'high' : 'low',
      {
        tenantId: event.tenantId,
        action: event.action,
        resource: event.resource,
        sourceIp: event.sourceIp,
        userAgent: event.userAgent,
        details: event.details,
      }
    );

    // Clean up old audit logs
    this.cleanupAuditLogs();
  }

  // Clean up old audit logs
  private cleanupAuditLogs(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.auditRetentionDays!);

    this.securityAuditLog = this.securityAuditLog.filter(
      event => event.timestamp >= cutoffDate
    );
  }

  // Get security audit events
  getSecurityAuditEvents(tenantId?: string, startDate?: Date, endDate?: Date): SecurityAuditEvent[] {
    let events = this.securityAuditLog;

    if (tenantId) {
      events = events.filter(event => event.tenantId === tenantId);
    }

    if (startDate) {
      events = events.filter(event => event.timestamp >= startDate);
    }

    if (endDate) {
      events = events.filter(event => event.timestamp <= endDate);
    }

    return events;
  }

  // Generate compliance report
  generateComplianceReport(tenantId: string): any {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const policies = this.retentionPolicies.get(tenantId) || [];
    const auditEvents = this.getSecurityAuditEvents(tenantId);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        environment: tenant.environment,
        compliance: tenant.compliance,
      },
      dataRetention: {
        policies: policies.map(p => ({
          type: p.type,
          retentionPeriod: p.retentionPeriod,
          encryptionRequired: p.encryptionRequired,
          archivalEnabled: p.archivalEnabled,
        })),
      },
      security: {
        encryptionEnabled: tenant.security.encryptionEnabled,
        auditLoggingEnabled: tenant.security.auditLoggingEnabled,
        ipWhitelistEnabled: tenant.security.ipWhitelist && tenant.security.ipWhitelist.length > 0,
        originValidationEnabled: tenant.security.allowedOrigins && tenant.security.allowedOrigins.length > 0,
      },
      auditSummary: {
        totalEvents: auditEvents.length,
        failedEvents: auditEvents.filter(e => e.outcome === 'failure').length,
        lastAuditDate: auditEvents.length > 0 ? auditEvents[auditEvents.length - 1].timestamp : null,
      },
      generatedAt: new Date(),
    };
  }

  // Middleware for tenant isolation
  createTenantIsolationMiddleware() {
    return (req: any, res: any, next: any) => {
      const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
      const sourceIp = req.ip || req.connection.remoteAddress;
      const origin = req.headers.origin;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      // Validate tenant access
      if (!this.validateTenantAccess(tenantId, sourceIp, origin)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Check rate limits
      const tenant = this.tenants.get(tenantId);
      if (tenant) {
        if (!this.checkRateLimit(tenantId, 'api_requests', tenant.limits.maxMetricsPerSecond)) {
          return res.status(429).json({ error: 'Rate limit exceeded' });
        }
      }

      // Create tenant context
      const context = this.createTenantContext(tenantId, req.id || Math.random().toString(36));
      req.tenantContext = context;

      // Audit the request
      this.auditSecurityEvent({
        tenantId,
        eventType: 'api_request',
        action: `${req.method} ${req.path}`,
        resource: 'api',
        timestamp: new Date(),
        sourceIp,
        userAgent: req.headers['user-agent'] || '',
        outcome: 'success',
        details: { method: req.method, path: req.path },
      });

      next();
    };
  }

  // Default tenant configurations
  static createDefaultTenantConfigs(): TenantConfig[] {
    return [
      {
        id: 'default',
        name: 'Default Tenant',
        environment: 'production',
        limits: {
          maxMetricsPerSecond: 1000,
          maxTracesPerSecond: 500,
          maxLogsPerSecond: 2000,
          maxRetentionDays: 30,
          maxStorageMB: 1000,
        },
        retention: {
          traces: '7d',
          logs: '30d',
          metrics: '30d',
        },
        security: {
          encryptionEnabled: true,
          auditLoggingEnabled: true,
        },
        compliance: {
          gdprCompliant: true,
          hipaaCompliant: false,
          soc2Compliant: true,
          dataRegion: 'us-east-1',
        },
        alerting: {
          enabled: true,
          channels: ['email'],
        },
      },
      {
        id: 'premium',
        name: 'Premium Tenant',
        environment: 'production',
        limits: {
          maxMetricsPerSecond: 5000,
          maxTracesPerSecond: 2500,
          maxLogsPerSecond: 10000,
          maxRetentionDays: 90,
          maxStorageMB: 10000,
        },
        retention: {
          traces: '30d',
          logs: '90d',
          metrics: '90d',
        },
        security: {
          encryptionEnabled: true,
          auditLoggingEnabled: true,
          ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
        },
        compliance: {
          gdprCompliant: true,
          hipaaCompliant: true,
          soc2Compliant: true,
          dataRegion: 'us-west-2',
        },
        alerting: {
          enabled: true,
          channels: ['email', 'slack', 'pagerduty'],
          escalationPolicy: 'premium-support',
        },
      },
    ];
  }
}

// Singleton instance
let globalTenantIsolationManager: TenantIsolationManager | undefined;

export function initializeTenantIsolation(config?: {
  auditRetentionDays?: number;
  compressionEnabled?: boolean;
  encryptionEnabled?: boolean;
  maxTenantsPerInstance?: number;
}): TenantIsolationManager {
  if (globalTenantIsolationManager) {
    console.warn('Tenant isolation already initialized');
    return globalTenantIsolationManager;
  }

  globalTenantIsolationManager = new TenantIsolationManager(config);
  
  // Register default tenant configurations
  const defaultTenants = TenantIsolationManager.createDefaultTenantConfigs();
  defaultTenants.forEach(tenant => globalTenantIsolationManager!.registerTenant(tenant));
  
  return globalTenantIsolationManager;
}

export function getTenantIsolationManager(): TenantIsolationManager | undefined {
  return globalTenantIsolationManager;
}

export function shutdownTenantIsolation(): void {
  globalTenantIsolationManager = undefined;
}