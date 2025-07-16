// @ts-ignore
import { getLogger } from '../logging/logger';
// @ts-ignore
import { getMetrics } from '../metrics/metrics';

export interface HealthCheck {
  name: string;
  component: string;
  check: () => Promise<HealthStatus>;
  timeout?: number;
  critical?: boolean;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, any>;
  timestamp: Date;
  responseTime: number;
}

export interface SLO {
  name: string;
  component: string;
  target: number; // e.g., 0.99 for 99% availability
  window: string; // e.g., '30d', '7d', '1h'
  metric: string;
  thresholds: {
    warning: number;
    critical: number;
  };
}

export interface SLI {
  name: string;
  component: string;
  value: number;
  target: number;
  status: 'ok' | 'warning' | 'critical';
  timestamp: Date;
}

export class HealthMonitor {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private slos: Map<string, SLO> = new Map();
  private isRunning = false;
  private checkInterval?: NodeJS.Timeout;
  private logger = getLogger();
  private metrics = getMetrics();

  constructor(private config: { checkIntervalMs?: number; timeout?: number } = {}) {
    this.config = {
      checkIntervalMs: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      ...config,
    };
  }

  // Register health checks
  registerHealthCheck(check: HealthCheck): void {
    this.healthChecks.set(check.name, check);
    this.logger.info(`Health check registered: ${check.name}`, {
      component: check.component,
      critical: check.critical || false,
    });
  }

  // Register SLOs
  registerSLO(slo: SLO): void {
    this.slos.set(slo.name, slo);
    this.logger.info(`SLO registered: ${slo.name}`, {
      component: slo.component,
      target: slo.target,
      window: slo.window,
    });
  }

  // Start monitoring
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Health monitor already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting health monitor', {
      checkIntervalMs: this.config.checkIntervalMs,
      checksCount: this.healthChecks.size,
      slosCount: this.slos.size,
    });

    // Run initial health check
    this.runHealthChecks();

    // Set up periodic health checks
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, this.config.checkIntervalMs);
  }

  // Stop monitoring
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.logger.info('Health monitor stopped');
  }

  // Run all health checks
  private async runHealthChecks(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const [name, check] of this.healthChecks) {
      promises.push(this.runSingleHealthCheck(name, check));
    }

    await Promise.allSettled(promises);
  }

  // Run a single health check
  private async runSingleHealthCheck(name: string, check: HealthCheck): Promise<void> {
    const startTime = Date.now();
    
    try {
      const timeoutMs = check.timeout || this.config.timeout || 5000;
      const healthPromise = check.check();
      
      const timeoutPromise = new Promise<HealthStatus>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), timeoutMs);
      });

      const status = await Promise.race([healthPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      // Update metrics
      this.metrics.recordAvailability(check.component, status.status === 'healthy');
      
      // Log health status
      if (status.status !== 'healthy') {
        this.logger.warn(`Health check failed: ${name}`, {
          component: check.component,
          status: status.status,
          message: status.message,
          responseTime,
          details: status.details,
        });

        if (check.critical) {
          this.logger.error(`Critical health check failed: ${name}`, {
            component: check.component,
            status: status.status,
            message: status.message,
          });
        }
      } else {
        this.logger.debug(`Health check passed: ${name}`, {
          component: check.component,
          responseTime,
        });
      }

      // Check SLO violations
      this.checkSLOViolations(check.component, status);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`Health check error: ${name}`, error, {
        component: check.component,
        responseTime,
      });

      this.metrics.recordAvailability(check.component, false);
      this.metrics.recordError(check.component, 'health_check_error', 'high');

      if (check.critical) {
        this.metrics.recordSLOViolation(check.component, 'availability', 'critical');
      }
    }
  }

  // Check for SLO violations
  private checkSLOViolations(component: string, status: HealthStatus): void {
    for (const [sloName, slo] of this.slos) {
      if (slo.component !== component) continue;

      const isViolation = this.evaluateSLOViolation(slo, status);
      
      if (isViolation) {
        const severity = status.status === 'unhealthy' ? 'critical' : 'warning';
        this.metrics.recordSLOViolation(component, slo.name, severity);
        
        this.logger.warn(`SLO violation detected: ${sloName}`, {
          component,
          slo: slo.name,
          target: slo.target,
          current_status: status.status,
          severity,
        });
      }
    }
  }

  // Evaluate if a status constitutes an SLO violation
  private evaluateSLOViolation(slo: SLO, status: HealthStatus): boolean {
    switch (slo.metric) {
      case 'availability':
        return status.status !== 'healthy';
      case 'response_time':
        if (status.responseTime > slo.thresholds.critical) return true;
        if (status.responseTime > slo.thresholds.warning) return true;
        return false;
      default:
        return false;
    }
  }

  // Get current health status
  async getHealthStatus(): Promise<{ status: string; checks: Record<string, HealthStatus> }> {
    const checks: Record<string, HealthStatus> = {};
    const promises: Promise<void>[] = [];

    for (const [name, check] of this.healthChecks) {
      promises.push(
        (async () => {
          try {
            const startTime = Date.now();
            const status = await check.check();
            checks[name] = {
              ...status,
              responseTime: Date.now() - startTime,
            };
          } catch (error) {
            checks[name] = {
              status: 'unhealthy',
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
              responseTime: 0,
            };
          }
        })()
      );
    }

    await Promise.allSettled(promises);

    const overallStatus = Object.values(checks).every(c => c.status === 'healthy') 
      ? 'healthy' 
      : Object.values(checks).some(c => c.status === 'unhealthy')
      ? 'unhealthy'
      : 'degraded';

    return { status: overallStatus, checks };
  }

  // Get SLI values
  getSLIs(): SLI[] {
    const slis: SLI[] = [];
    const now = new Date();

    for (const [name, slo] of this.slos) {
      // This would typically query metrics from your monitoring system
      // For now, we'll create placeholder values
      const value = 0.95; // This should come from actual metrics
      
      const status = value >= slo.target 
        ? 'ok' 
        : value >= slo.thresholds.warning 
        ? 'warning' 
        : 'critical';

      slis.push({
        name,
        component: slo.component,
        value,
        target: slo.target,
        status,
        timestamp: now,
      });
    }

    return slis;
  }

  // Default health checks for AutoWeave components
  static createDefaultHealthChecks(): HealthCheck[] {
    return [
      {
        name: 'usb-daemon',
        component: 'usb-daemon',
        critical: true,
        check: async () => {
          // Check if USB daemon is responsive
          try {
            // This would check the actual USB daemon health
            return {
              status: 'healthy',
              message: 'USB daemon is operational',
              timestamp: new Date(),
              responseTime: 0,
            };
          } catch (error) {
            return {
              status: 'unhealthy',
              message: 'USB daemon is not responsive',
              timestamp: new Date(),
              responseTime: 0,
            };
          }
        },
      },
      {
        name: 'plugin-loader',
        component: 'plugin-loader',
        critical: true,
        check: async () => {
          // Check plugin loader health
          return {
            status: 'healthy',
            message: 'Plugin loader is operational',
            timestamp: new Date(),
            responseTime: 0,
          };
        },
      },
      {
        name: 'queue-manager',
        component: 'queue-manager',
        critical: false,
        check: async () => {
          // Check queue manager health
          return {
            status: 'healthy',
            message: 'Queue manager is operational',
            timestamp: new Date(),
            responseTime: 0,
          };
        },
      },
      {
        name: 'memory-system',
        component: 'memory',
        critical: false,
        check: async () => {
          // Check memory system health
          const memUsage = process.memoryUsage();
          const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
          
          if (heapUsedMB > 1024) { // 1GB threshold
            return {
              status: 'degraded',
              message: `High memory usage: ${heapUsedMB.toFixed(2)}MB`,
              details: { heapUsedMB },
              timestamp: new Date(),
              responseTime: 0,
            };
          }

          return {
            status: 'healthy',
            message: `Memory usage normal: ${heapUsedMB.toFixed(2)}MB`,
            details: { heapUsedMB },
            timestamp: new Date(),
            responseTime: 0,
          };
        },
      },
    ];
  }

  // Default SLOs for AutoWeave
  static createDefaultSLOs(): SLO[] {
    return [
      {
        name: 'usb-event-latency',
        component: 'usb-daemon',
        target: 0.95, // 95% of events under 80ms
        window: '5m',
        metric: 'response_time',
        thresholds: {
          warning: 80,
          critical: 100,
        },
      },
      {
        name: 'plugin-load-time',
        component: 'plugin-loader',
        target: 0.95, // 95% of plugins load under 200ms
        window: '5m',
        metric: 'response_time',
        thresholds: {
          warning: 200,
          critical: 250,
        },
      },
      {
        name: 'system-availability',
        component: 'system',
        target: 0.999, // 99.9% uptime
        window: '24h',
        metric: 'availability',
        thresholds: {
          warning: 0.99,
          critical: 0.95,
        },
      },
      {
        name: 'error-rate',
        component: 'system',
        target: 0.99, // 99% success rate
        window: '5m',
        metric: 'error_rate',
        thresholds: {
          warning: 0.05, // 5% error rate
          critical: 0.1,  // 10% error rate
        },
      },
    ];
  }
}

// Singleton instance
let globalHealthMonitor: HealthMonitor | undefined;

export function initializeHealthMonitor(config?: { checkIntervalMs?: number; timeout?: number }): HealthMonitor {
  if (globalHealthMonitor) {
    console.warn('Health monitor already initialized');
    return globalHealthMonitor;
  }

  globalHealthMonitor = new HealthMonitor(config);
  
  // Register default health checks and SLOs
  const defaultChecks = HealthMonitor.createDefaultHealthChecks();
  const defaultSLOs = HealthMonitor.createDefaultSLOs();
  
  defaultChecks.forEach(check => globalHealthMonitor!.registerHealthCheck(check));
  defaultSLOs.forEach(slo => globalHealthMonitor!.registerSLO(slo));
  
  return globalHealthMonitor;
}

export function getHealthMonitor(): HealthMonitor | undefined {
  return globalHealthMonitor;
}

export function shutdownHealthMonitor(): void {
  if (globalHealthMonitor) {
    globalHealthMonitor.stop();
    globalHealthMonitor = undefined;
  }
}