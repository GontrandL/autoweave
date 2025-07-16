// @ts-ignore
import { getLogger } from '../logging/logger';
// @ts-ignore
import { getMetrics } from '../metrics/metrics';

export interface SLI {
  name: string;
  component: string;
  description: string;
  query: string;
  unit: string;
  target: number;
  thresholds: {
    warning: number;
    critical: number;
  };
  window: string;
  evaluationInterval: string;
}

export interface SLO {
  name: string;
  component: string;
  description: string;
  sli: string;
  target: number;
  window: string;
  errorBudget: number;
  burnRate: {
    window: string;
    threshold: number;
  };
  alerting: {
    enabled: boolean;
    channels: string[];
  };
}

export interface SLIValue {
  name: string;
  value: number;
  target: number;
  status: 'ok' | 'warning' | 'critical';
  timestamp: Date;
  window: string;
  details?: Record<string, any>;
}

export interface SLOStatus {
  name: string;
  currentValue: number;
  target: number;
  errorBudget: number;
  errorBudgetRemaining: number;
  burnRate: number;
  status: 'ok' | 'warning' | 'critical';
  timestamp: Date;
  window: string;
  projectedExhaustion?: Date;
}

export interface SLOAlert {
  slo: string;
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  target: number;
  errorBudgetRemaining: number;
  burnRate: number;
  timestamp: Date;
  runbook?: string;
  dashboard?: string;
}

export class SLISLOManager {
  private slis: Map<string, SLI> = new Map();
  private slos: Map<string, SLO> = new Map();
  private sliValues: Map<string, SLIValue[]> = new Map();
  private sloStatuses: Map<string, SLOStatus[]> = new Map();
  private evaluationInterval?: NodeJS.Timeout;
  private logger = getLogger();
  private metrics = getMetrics();

  constructor(
    private config: {
      evaluationIntervalMs?: number;
      retentionPeriodMs?: number;
      alertCallback?: (alert: SLOAlert) => void;
    } = {}
  ) {
    this.config = {
      evaluationIntervalMs: 60000, // 1 minute
      retentionPeriodMs: 24 * 60 * 60 * 1000, // 24 hours
      ...config,
    };
  }

  // Register SLI
  registerSLI(sli: SLI): void {
    this.slis.set(sli.name, sli);
    this.sliValues.set(sli.name, []);
    
    this.logger.info(`SLI registered: ${sli.name}`, {
      component: sli.component,
      target: sli.target,
      window: sli.window,
    });
  }

  // Register SLO
  registerSLO(slo: SLO): void {
    if (!this.slis.has(slo.sli)) {
      throw new Error(`SLI '${slo.sli}' not found for SLO '${slo.name}'`);
    }

    this.slos.set(slo.name, slo);
    this.sloStatuses.set(slo.name, []);
    
    this.logger.info(`SLO registered: ${slo.name}`, {
      component: slo.component,
      sli: slo.sli,
      target: slo.target,
      window: slo.window,
    });
  }

  // Start evaluation
  start(): void {
    if (this.evaluationInterval) {
      this.logger.warn('SLI/SLO evaluation already running');
      return;
    }

    this.logger.info('Starting SLI/SLO evaluation', {
      evaluationIntervalMs: this.config.evaluationIntervalMs,
      slisCount: this.slis.size,
      slosCount: this.slos.size,
    });

    // Run initial evaluation
    this.evaluateAll();

    // Set up periodic evaluation
    this.evaluationInterval = setInterval(() => {
      this.evaluateAll();
    }, this.config.evaluationIntervalMs);
  }

  // Stop evaluation
  stop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = undefined;
    }

    this.logger.info('SLI/SLO evaluation stopped');
  }

  // Evaluate all SLIs and SLOs
  private async evaluateAll(): Promise<void> {
    try {
      // Evaluate all SLIs
      for (const [name, sli] of this.slis) {
        await this.evaluateSLI(name, sli);
      }

      // Evaluate all SLOs
      for (const [name, slo] of this.slos) {
        await this.evaluateSLO(name, slo);
      }

      // Clean up old values
      this.cleanupOldValues();

    } catch (error) {
      this.logger.error('Error during SLI/SLO evaluation', error);
    }
  }

  // Evaluate a single SLI
  private async evaluateSLI(name: string, sli: SLI): Promise<void> {
    try {
      // In a real implementation, this would query your metrics system
      // For now, we'll simulate values based on the SLI definition
      const value = await this.executeQuery(sli.query);
      
      const status = this.determineSLIStatus(value, sli);
      
      const sliValue: SLIValue = {
        name,
        value,
        target: sli.target,
        status,
        timestamp: new Date(),
        window: sli.window,
      };

      // Store the value
      const values = this.sliValues.get(name) || [];
      values.push(sliValue);
      this.sliValues.set(name, values);

      // Record metrics
      this.metrics.recordBusinessOperation(
        'sli_evaluation',
        'system',
        { sli_name: name, value, status }
      );

      this.logger.debug(`SLI evaluated: ${name}`, {
        value,
        target: sli.target,
        status,
        window: sli.window,
      });

    } catch (error) {
      this.logger.error(`Error evaluating SLI: ${name}`, error);
    }
  }

  // Evaluate a single SLO
  private async evaluateSLO(name: string, slo: SLO): Promise<void> {
    try {
      const sliValues = this.sliValues.get(slo.sli) || [];
      if (sliValues.length === 0) {
        this.logger.warn(`No SLI values found for SLO: ${name}`);
        return;
      }

      // Get values within the SLO window
      const windowMs = this.parseTimeWindow(slo.window);
      const cutoffTime = new Date(Date.now() - windowMs);
      const relevantValues = sliValues.filter(v => v.timestamp >= cutoffTime);

      if (relevantValues.length === 0) {
        this.logger.warn(`No recent SLI values found for SLO: ${name}`);
        return;
      }

      // Calculate SLO metrics
      const currentValue = this.calculateSLOValue(relevantValues, slo);
      const errorBudget = slo.errorBudget;
      const errorBudgetRemaining = this.calculateErrorBudgetRemaining(
        currentValue,
        slo.target,
        errorBudget
      );
      const burnRate = this.calculateBurnRate(relevantValues, slo);
      const status = this.determineSLOStatus(currentValue, slo, errorBudgetRemaining);

      const sloStatus: SLOStatus = {
        name,
        currentValue,
        target: slo.target,
        errorBudget,
        errorBudgetRemaining,
        burnRate,
        status,
        timestamp: new Date(),
        window: slo.window,
      };

      // Calculate projected exhaustion if burning error budget
      if (burnRate > 0 && errorBudgetRemaining > 0) {
        const timeToExhaustion = errorBudgetRemaining / burnRate;
        sloStatus.projectedExhaustion = new Date(Date.now() + timeToExhaustion);
      }

      // Store the status
      const statuses = this.sloStatuses.get(name) || [];
      statuses.push(sloStatus);
      this.sloStatuses.set(name, statuses);

      // Record metrics
      this.metrics.recordBusinessOperation(
        'slo_evaluation',
        'system',
        { 
          slo_name: name, 
          current_value: currentValue,
          target: slo.target,
          error_budget_remaining: errorBudgetRemaining,
          burn_rate: burnRate,
          status 
        }
      );

      // Check for alerts
      if (slo.alerting.enabled) {
        this.checkSLOAlerts(name, slo, sloStatus);
      }

      this.logger.debug(`SLO evaluated: ${name}`, {
        currentValue,
        target: slo.target,
        errorBudgetRemaining,
        burnRate,
        status,
      });

    } catch (error) {
      this.logger.error(`Error evaluating SLO: ${name}`, error);
    }
  }

  // Execute a query (mock implementation)
  private async executeQuery(query: string): Promise<number> {
    // In a real implementation, this would query your metrics system
    // For now, simulate values based on query patterns
    
    if (query.includes('usb_event_processing_duration')) {
      return 50 + Math.random() * 100; // 50-150ms latency
    }
    
    if (query.includes('plugin_load_duration')) {
      return 100 + Math.random() * 200; // 100-300ms load time
    }
    
    if (query.includes('up{')) {
      return Math.random() > 0.01 ? 1 : 0; // 99% uptime
    }
    
    if (query.includes('errors_total')) {
      return Math.random() * 0.05; // 0-5% error rate
    }
    
    return Math.random();
  }

  // Determine SLI status
  private determineSLIStatus(value: number, sli: SLI): 'ok' | 'warning' | 'critical' {
    if (value >= sli.thresholds.critical) {
      return 'critical';
    } else if (value >= sli.thresholds.warning) {
      return 'warning';
    } else {
      return 'ok';
    }
  }

  // Calculate SLO value from SLI values
  private calculateSLOValue(values: SLIValue[], slo: SLO): number {
    if (values.length === 0) return 0;

    // For availability-type SLOs, calculate percentage of successful measurements
    const successfulMeasurements = values.filter(v => v.status === 'ok').length;
    return successfulMeasurements / values.length;
  }

  // Calculate error budget remaining
  private calculateErrorBudgetRemaining(
    currentValue: number,
    target: number,
    errorBudget: number
  ): number {
    const errorRateUsed = Math.max(0, target - currentValue);
    const errorBudgetUsed = errorRateUsed / (1 - target);
    return Math.max(0, errorBudget - errorBudgetUsed);
  }

  // Calculate burn rate
  private calculateBurnRate(values: SLIValue[], slo: SLO): number {
    if (values.length < 2) return 0;

    const recentValues = values.slice(-10); // Last 10 measurements
    const failedMeasurements = recentValues.filter(v => v.status !== 'ok').length;
    
    return failedMeasurements / recentValues.length;
  }

  // Determine SLO status
  private determineSLOStatus(
    currentValue: number,
    slo: SLO,
    errorBudgetRemaining: number
  ): 'ok' | 'warning' | 'critical' {
    if (currentValue < slo.target) {
      return 'critical';
    } else if (errorBudgetRemaining < 0.1) { // Less than 10% error budget remaining
      return 'warning';
    } else {
      return 'ok';
    }
  }

  // Check for SLO alerts
  private checkSLOAlerts(name: string, slo: SLO, status: SLOStatus): void {
    const alerts: SLOAlert[] = [];

    // Critical alert: SLO target missed
    if (status.status === 'critical') {
      alerts.push({
        slo: name,
        severity: 'critical',
        message: `SLO ${name} is below target`,
        currentValue: status.currentValue,
        target: status.target,
        errorBudgetRemaining: status.errorBudgetRemaining,
        burnRate: status.burnRate,
        timestamp: new Date(),
        runbook: `https://docs.autoweave.com/runbooks/slo-violation`,
        dashboard: `https://grafana.autoweave.com/d/slo/autoweave-slo?var-slo=${name}`,
      });
    }

    // Warning alert: Error budget exhaustion
    if (status.errorBudgetRemaining < 0.1 && status.burnRate > 0) {
      alerts.push({
        slo: name,
        severity: 'warning',
        message: `SLO ${name} error budget is being exhausted`,
        currentValue: status.currentValue,
        target: status.target,
        errorBudgetRemaining: status.errorBudgetRemaining,
        burnRate: status.burnRate,
        timestamp: new Date(),
        runbook: `https://docs.autoweave.com/runbooks/error-budget-exhaustion`,
        dashboard: `https://grafana.autoweave.com/d/slo/autoweave-slo?var-slo=${name}`,
      });
    }

    // Send alerts
    for (const alert of alerts) {
      this.sendAlert(alert);
    }
  }

  // Send alert
  private sendAlert(alert: SLOAlert): void {
    this.logger.warn(`SLO Alert: ${alert.message}`, {
      slo: alert.slo,
      severity: alert.severity,
      currentValue: alert.currentValue,
      target: alert.target,
      errorBudgetRemaining: alert.errorBudgetRemaining,
      burnRate: alert.burnRate,
      runbook: alert.runbook,
      dashboard: alert.dashboard,
    });

    // Record alert metric
    this.metrics.recordSLOViolation(
      'system',
      alert.slo,
      alert.severity
    );

    // Call external alert callback if provided
    if (this.config.alertCallback) {
      this.config.alertCallback(alert);
    }
  }

  // Parse time window string to milliseconds
  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid time window format: ${window}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  // Clean up old values
  private cleanupOldValues(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriodMs!);

    // Clean up SLI values
    for (const [name, values] of this.sliValues) {
      const filteredValues = values.filter(v => v.timestamp >= cutoffTime);
      this.sliValues.set(name, filteredValues);
    }

    // Clean up SLO statuses
    for (const [name, statuses] of this.sloStatuses) {
      const filteredStatuses = statuses.filter(s => s.timestamp >= cutoffTime);
      this.sloStatuses.set(name, filteredStatuses);
    }
  }

  // Get current SLI values
  getCurrentSLIValues(): SLIValue[] {
    const results: SLIValue[] = [];
    
    for (const [name, values] of this.sliValues) {
      if (values.length > 0) {
        results.push(values[values.length - 1]);
      }
    }
    
    return results;
  }

  // Get current SLO statuses
  getCurrentSLOStatuses(): SLOStatus[] {
    const results: SLOStatus[] = [];
    
    for (const [name, statuses] of this.sloStatuses) {
      if (statuses.length > 0) {
        results.push(statuses[statuses.length - 1]);
      }
    }
    
    return results;
  }

  // Get SLI history
  getSLIHistory(name: string, window?: string): SLIValue[] {
    const values = this.sliValues.get(name) || [];
    
    if (!window) {
      return values;
    }

    const windowMs = this.parseTimeWindow(window);
    const cutoffTime = new Date(Date.now() - windowMs);
    
    return values.filter(v => v.timestamp >= cutoffTime);
  }

  // Get SLO history
  getSLOHistory(name: string, window?: string): SLOStatus[] {
    const statuses = this.sloStatuses.get(name) || [];
    
    if (!window) {
      return statuses;
    }

    const windowMs = this.parseTimeWindow(window);
    const cutoffTime = new Date(Date.now() - windowMs);
    
    return statuses.filter(s => s.timestamp >= cutoffTime);
  }

  // Get SLO dashboard data
  getSLODashboardData(): any {
    const currentSLOs = this.getCurrentSLOStatuses();
    const currentSLIs = this.getCurrentSLIValues();

    return {
      summary: {
        totalSLOs: this.slos.size,
        totalSLIs: this.slis.size,
        healthySLOs: currentSLOs.filter(s => s.status === 'ok').length,
        warningSLOs: currentSLOs.filter(s => s.status === 'warning').length,
        criticalSLOs: currentSLOs.filter(s => s.status === 'critical').length,
        timestamp: new Date(),
      },
      slos: currentSLOs,
      slis: currentSLIs,
    };
  }

  // Default SLIs for AutoWeave
  static createDefaultSLIs(): SLI[] {
    return [
      {
        name: 'usb_event_latency',
        component: 'usb-daemon',
        description: 'USB event processing latency (P95)',
        query: 'histogram_quantile(0.95, rate(usb_event_processing_duration_ms_bucket[5m]))',
        unit: 'milliseconds',
        target: 80,
        thresholds: {
          warning: 80,
          critical: 100,
        },
        window: '5m',
        evaluationInterval: '30s',
      },
      {
        name: 'plugin_load_latency',
        component: 'plugin-loader',
        description: 'Plugin load time (P95)',
        query: 'histogram_quantile(0.95, rate(plugin_load_duration_ms_bucket[5m]))',
        unit: 'milliseconds',
        target: 200,
        thresholds: {
          warning: 200,
          critical: 250,
        },
        window: '5m',
        evaluationInterval: '30s',
      },
      {
        name: 'system_availability',
        component: 'system',
        description: 'System availability',
        query: 'avg_over_time(up{job=~"autoweave.*"}[5m])',
        unit: 'percentage',
        target: 0.999,
        thresholds: {
          warning: 0.99,
          critical: 0.95,
        },
        window: '5m',
        evaluationInterval: '30s',
      },
      {
        name: 'error_rate',
        component: 'system',
        description: 'System error rate',
        query: 'rate(errors_total[5m]) / rate(http_requests_total[5m])',
        unit: 'percentage',
        target: 0.01,
        thresholds: {
          warning: 0.05,
          critical: 0.1,
        },
        window: '5m',
        evaluationInterval: '30s',
      },
    ];
  }

  // Default SLOs for AutoWeave
  static createDefaultSLOs(): SLO[] {
    return [
      {
        name: 'usb_event_latency_slo',
        component: 'usb-daemon',
        description: '95% of USB events processed within 80ms',
        sli: 'usb_event_latency',
        target: 0.95,
        window: '30d',
        errorBudget: 0.05,
        burnRate: {
          window: '1h',
          threshold: 0.1,
        },
        alerting: {
          enabled: true,
          channels: ['email', 'slack'],
        },
      },
      {
        name: 'plugin_load_latency_slo',
        component: 'plugin-loader',
        description: '95% of plugins load within 200ms',
        sli: 'plugin_load_latency',
        target: 0.95,
        window: '30d',
        errorBudget: 0.05,
        burnRate: {
          window: '1h',
          threshold: 0.1,
        },
        alerting: {
          enabled: true,
          channels: ['email', 'slack'],
        },
      },
      {
        name: 'system_availability_slo',
        component: 'system',
        description: '99.9% system availability',
        sli: 'system_availability',
        target: 0.999,
        window: '30d',
        errorBudget: 0.001,
        burnRate: {
          window: '1h',
          threshold: 0.01,
        },
        alerting: {
          enabled: true,
          channels: ['email', 'slack', 'pagerduty'],
        },
      },
      {
        name: 'error_rate_slo',
        component: 'system',
        description: '99% success rate (1% error rate)',
        sli: 'error_rate',
        target: 0.99,
        window: '30d',
        errorBudget: 0.01,
        burnRate: {
          window: '1h',
          threshold: 0.05,
        },
        alerting: {
          enabled: true,
          channels: ['email', 'slack'],
        },
      },
    ];
  }
}

// Singleton instance
let globalSLISLOManager: SLISLOManager | undefined;

export function initializeSLISLOManager(config?: {
  evaluationIntervalMs?: number;
  retentionPeriodMs?: number;
  alertCallback?: (alert: SLOAlert) => void;
}): SLISLOManager {
  if (globalSLISLOManager) {
    console.warn('SLI/SLO manager already initialized');
    return globalSLISLOManager;
  }

  globalSLISLOManager = new SLISLOManager(config);
  
  // Register default SLIs and SLOs
  const defaultSLIs = SLISLOManager.createDefaultSLIs();
  const defaultSLOs = SLISLOManager.createDefaultSLOs();
  
  defaultSLIs.forEach(sli => globalSLISLOManager!.registerSLI(sli));
  defaultSLOs.forEach(slo => globalSLISLOManager!.registerSLO(slo));
  
  return globalSLISLOManager;
}

export function getSLISLOManager(): SLISLOManager | undefined {
  return globalSLISLOManager;
}

export function shutdownSLISLOManager(): void {
  if (globalSLISLOManager) {
    globalSLISLOManager.stop();
    globalSLISLOManager = undefined;
  }
}