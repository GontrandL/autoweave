// @ts-ignore
import { getLogger } from '../logging/logger';
// @ts-ignore
import { getMetrics } from '../metrics/metrics';

export interface PerformanceProfile {
  component: string;
  operation: string;
  samples: PerformanceSample[];
  statistics: PerformanceStatistics;
  recommendations: OptimizationRecommendation[];
  lastUpdated: Date;
}

export interface PerformanceSample {
  timestamp: Date;
  duration: number;
  cpuUsage: number;
  memoryUsage: number;
  status: 'success' | 'error' | 'timeout';
  tenantId: string;
  metadata?: Record<string, any>;
}

export interface PerformanceStatistics {
  sampleCount: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  throughput: number;
  cpuUtilization: number;
  memoryUtilization: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface OptimizationRecommendation {
  type: 'latency' | 'memory' | 'cpu' | 'throughput' | 'reliability';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  implementation: string;
  estimatedGain: string;
  dependencies?: string[];
}

export interface ResourceUsageThreshold {
  component: string;
  metric: 'cpu' | 'memory' | 'latency' | 'throughput';
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceAlert {
  component: string;
  operation: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  tenantId?: string;
}

export class PerformanceOptimizer {
  private profiles: Map<string, PerformanceProfile> = new Map();
  private thresholds: Map<string, ResourceUsageThreshold[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private samplingRate: number = 0.1; // 10% sampling for production
  private logger = getLogger();
  private metrics = getMetrics();

  constructor(private config: {
    maxProfileRetentionMs?: number;
    maxSamplesPerProfile?: number;
    analysisIntervalMs?: number;
    enableAutoOptimization?: boolean;
    samplingRate?: number;
  } = {}) {
    this.config = {
      maxProfileRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
      maxSamplesPerProfile: 1000,
      analysisIntervalMs: 5 * 60 * 1000, // 5 minutes
      enableAutoOptimization: false,
      samplingRate: 0.1,
      ...config,
    };

    this.samplingRate = this.config.samplingRate!;

    // Initialize default thresholds
    this.initializeDefaultThresholds();

    // Start periodic analysis
    setInterval(() => this.analyzePerformance(), this.config.analysisIntervalMs);
    setInterval(() => this.cleanupOldProfiles(), 60000); // Every minute
  }

  // Record performance sample
  recordSample(
    component: string,
    operation: string,
    sample: PerformanceSample
  ): void {
    // Apply sampling rate
    if (Math.random() > this.samplingRate) {
      return;
    }

    const key = `${component}.${operation}`;
    let profile = this.profiles.get(key);

    if (!profile) {
      profile = {
        component,
        operation,
        samples: [],
        statistics: this.createEmptyStatistics(),
        recommendations: [],
        lastUpdated: new Date(),
      };
      this.profiles.set(key, profile);
    }

    // Add sample
    profile.samples.push(sample);
    profile.lastUpdated = new Date();

    // Limit sample count
    if (profile.samples.length > this.config.maxSamplesPerProfile!) {
      profile.samples = profile.samples.slice(-this.config.maxSamplesPerProfile!);
    }

    // Update statistics
    this.updateStatistics(profile);

    // Check for immediate alerts
    this.checkThresholds(profile, sample);

    this.logger.debug('Performance sample recorded', {
      component,
      operation,
      duration: sample.duration,
      status: sample.status,
      tenantId: sample.tenantId,
    });
  }

  // Update performance statistics
  private updateStatistics(profile: PerformanceProfile): void {
    const samples = profile.samples;
    const durations = samples.map(s => s.duration).sort((a, b) => a - b);
    const successfulSamples = samples.filter(s => s.status === 'success');
    const errorSamples = samples.filter(s => s.status === 'error');

    const statistics: PerformanceStatistics = {
      sampleCount: samples.length,
      minDuration: durations[0] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length || 0,
      p50Duration: durations[Math.floor(durations.length * 0.5)] || 0,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
      errorRate: errorSamples.length / samples.length || 0,
      throughput: this.calculateThroughput(samples),
      cpuUtilization: samples.reduce((sum, s) => sum + s.cpuUsage, 0) / samples.length || 0,
      memoryUtilization: samples.reduce((sum, s) => sum + s.memoryUsage, 0) / samples.length || 0,
      trend: this.calculateTrend(samples),
    };

    profile.statistics = statistics;
  }

  // Calculate throughput
  private calculateThroughput(samples: PerformanceSample[]): number {
    if (samples.length < 2) return 0;

    const timeSpan = samples[samples.length - 1].timestamp.getTime() - samples[0].timestamp.getTime();
    return (samples.length / timeSpan) * 1000; // ops/sec
  }

  // Calculate performance trend
  private calculateTrend(samples: PerformanceSample[]): 'improving' | 'stable' | 'degrading' {
    if (samples.length < 10) return 'stable';

    const recentSamples = samples.slice(-10);
    const olderSamples = samples.slice(-20, -10);

    if (olderSamples.length === 0) return 'stable';

    const recentAvg = recentSamples.reduce((sum, s) => sum + s.duration, 0) / recentSamples.length;
    const olderAvg = olderSamples.reduce((sum, s) => sum + s.duration, 0) / olderSamples.length;

    const changePercent = (recentAvg - olderAvg) / olderAvg;

    if (changePercent > 0.1) return 'degrading';
    if (changePercent < -0.1) return 'improving';
    return 'stable';
  }

  // Initialize default thresholds
  private initializeDefaultThresholds(): void {
    const defaultThresholds: ResourceUsageThreshold[] = [
      // USB Daemon thresholds
      { component: 'usb-daemon', metric: 'latency', warning: 80, critical: 100, unit: 'ms' },
      { component: 'usb-daemon', metric: 'cpu', warning: 70, critical: 90, unit: '%' },
      { component: 'usb-daemon', metric: 'memory', warning: 512, critical: 1024, unit: 'MB' },
      { component: 'usb-daemon', metric: 'throughput', warning: 100, critical: 50, unit: 'ops/sec' },

      // Plugin Loader thresholds
      { component: 'plugin-loader', metric: 'latency', warning: 200, critical: 250, unit: 'ms' },
      { component: 'plugin-loader', metric: 'cpu', warning: 60, critical: 80, unit: '%' },
      { component: 'plugin-loader', metric: 'memory', warning: 256, critical: 512, unit: 'MB' },
      { component: 'plugin-loader', metric: 'throughput', warning: 10, critical: 5, unit: 'ops/sec' },

      // Queue Manager thresholds
      { component: 'queue-manager', metric: 'latency', warning: 100, critical: 150, unit: 'ms' },
      { component: 'queue-manager', metric: 'cpu', warning: 50, critical: 70, unit: '%' },
      { component: 'queue-manager', metric: 'memory', warning: 128, critical: 256, unit: 'MB' },
      { component: 'queue-manager', metric: 'throughput', warning: 50, critical: 25, unit: 'ops/sec' },

      // Memory System thresholds
      { component: 'memory-system', metric: 'latency', warning: 50, critical: 75, unit: 'ms' },
      { component: 'memory-system', metric: 'cpu', warning: 40, critical: 60, unit: '%' },
      { component: 'memory-system', metric: 'memory', warning: 512, critical: 1024, unit: 'MB' },
      { component: 'memory-system', metric: 'throughput', warning: 200, critical: 100, unit: 'ops/sec' },
    ];

    for (const threshold of defaultThresholds) {
      const key = threshold.component;
      if (!this.thresholds.has(key)) {
        this.thresholds.set(key, []);
      }
      this.thresholds.get(key)!.push(threshold);
    }
  }

  // Check thresholds and generate alerts
  private checkThresholds(profile: PerformanceProfile, sample: PerformanceSample): void {
    const componentThresholds = this.thresholds.get(profile.component) || [];

    for (const threshold of componentThresholds) {
      let value: number;
      let metricName: string;

      switch (threshold.metric) {
        case 'latency':
          value = sample.duration;
          metricName = 'latency';
          break;
        case 'cpu':
          value = sample.cpuUsage;
          metricName = 'CPU usage';
          break;
        case 'memory':
          value = sample.memoryUsage;
          metricName = 'memory usage';
          break;
        case 'throughput':
          value = profile.statistics.throughput;
          metricName = 'throughput';
          break;
        default:
          continue;
      }

      let severity: 'warning' | 'critical' | undefined;
      let thresholdValue: number;

      if (value >= threshold.critical) {
        severity = 'critical';
        thresholdValue = threshold.critical;
      } else if (value >= threshold.warning) {
        severity = 'warning';
        thresholdValue = threshold.warning;
      }

      if (severity) {
        const alert: PerformanceAlert = {
          component: profile.component,
          operation: profile.operation,
          metric: metricName,
          value,
          threshold: thresholdValue,
          severity,
          message: `${metricName} is ${value}${threshold.unit}, above ${severity} threshold of ${thresholdValue}${threshold.unit}`,
          timestamp: new Date(),
          tenantId: sample.tenantId,
        };

        this.alerts.push(alert);
        this.logger.warn('Performance threshold exceeded', alert);

        // Record alert metric
        this.metrics.recordError(
          profile.component,
          'performance_threshold_exceeded',
          severity === 'critical' ? 'high' : 'medium',
          sample.tenantId
        );
      }
    }
  }

  // Analyze performance and generate recommendations
  private analyzePerformance(): void {
    for (const [key, profile] of this.profiles) {
      this.generateRecommendations(profile);
    }

    this.logger.debug('Performance analysis completed', {
      profilesAnalyzed: this.profiles.size,
      totalRecommendations: Array.from(this.profiles.values())
        .reduce((sum, p) => sum + p.recommendations.length, 0),
    });
  }

  // Generate optimization recommendations
  private generateRecommendations(profile: PerformanceProfile): void {
    const recommendations: OptimizationRecommendation[] = [];
    const stats = profile.statistics;

    // High latency recommendations
    if (stats.p95Duration > 200) {
      recommendations.push({
        type: 'latency',
        priority: stats.p95Duration > 500 ? 'critical' : 'high',
        title: 'High latency detected',
        description: `P95 latency is ${stats.p95Duration}ms, which impacts user experience`,
        impact: 'Reduces user satisfaction and system throughput',
        effort: 'medium',
        implementation: 'Add caching layer, optimize database queries, implement connection pooling',
        estimatedGain: '30-50% latency reduction',
        dependencies: ['database-optimization', 'caching-layer'],
      });
    }

    // High memory usage recommendations
    if (stats.memoryUtilization > 512) {
      recommendations.push({
        type: 'memory',
        priority: stats.memoryUtilization > 1024 ? 'critical' : 'high',
        title: 'High memory usage detected',
        description: `Memory usage is ${stats.memoryUtilization}MB, which may cause performance issues`,
        impact: 'May cause garbage collection pauses and OOM errors',
        effort: 'medium',
        implementation: 'Implement object pooling, optimize data structures, add memory monitoring',
        estimatedGain: '20-40% memory reduction',
        dependencies: ['memory-profiling', 'gc-tuning'],
      });
    }

    // High CPU usage recommendations
    if (stats.cpuUtilization > 70) {
      recommendations.push({
        type: 'cpu',
        priority: stats.cpuUtilization > 90 ? 'critical' : 'high',
        title: 'High CPU usage detected',
        description: `CPU usage is ${stats.cpuUtilization}%, which may cause processing delays`,
        impact: 'Reduces system responsiveness and throughput',
        effort: 'high',
        implementation: 'Optimize algorithms, implement async processing, add CPU profiling',
        estimatedGain: '15-30% CPU reduction',
        dependencies: ['algorithm-optimization', 'async-processing'],
      });
    }

    // High error rate recommendations
    if (stats.errorRate > 0.05) {
      recommendations.push({
        type: 'reliability',
        priority: stats.errorRate > 0.1 ? 'critical' : 'high',
        title: 'High error rate detected',
        description: `Error rate is ${(stats.errorRate * 100).toFixed(2)}%, which impacts reliability`,
        impact: 'Reduces system reliability and user trust',
        effort: 'medium',
        implementation: 'Add error handling, implement retry logic, improve input validation',
        estimatedGain: '50-80% error reduction',
        dependencies: ['error-handling', 'monitoring-improvement'],
      });
    }

    // Low throughput recommendations
    if (stats.throughput < 10) {
      recommendations.push({
        type: 'throughput',
        priority: stats.throughput < 5 ? 'critical' : 'medium',
        title: 'Low throughput detected',
        description: `Throughput is ${stats.throughput.toFixed(2)} ops/sec, which may indicate bottlenecks`,
        impact: 'Reduces system capacity and scalability',
        effort: 'high',
        implementation: 'Implement batching, add horizontal scaling, optimize resource usage',
        estimatedGain: '2-5x throughput improvement',
        dependencies: ['batching', 'horizontal-scaling'],
      });
    }

    // Degrading trend recommendations
    if (stats.trend === 'degrading') {
      recommendations.push({
        type: 'latency',
        priority: 'medium',
        title: 'Performance degradation trend detected',
        description: 'Performance is degrading over time, indicating potential issues',
        impact: 'Progressive performance deterioration',
        effort: 'medium',
        implementation: 'Investigate root cause, add performance monitoring, implement alerts',
        estimatedGain: 'Prevent further degradation',
        dependencies: ['root-cause-analysis', 'trend-monitoring'],
      });
    }

    profile.recommendations = recommendations;
  }

  // Get performance profile
  getProfile(component: string, operation: string): PerformanceProfile | undefined {
    return this.profiles.get(`${component}.${operation}`);
  }

  // Get all profiles
  getAllProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  // Get profiles by component
  getProfilesByComponent(component: string): PerformanceProfile[] {
    return Array.from(this.profiles.values())
      .filter(profile => profile.component === component);
  }

  // Get recent alerts
  getRecentAlerts(hours: number = 24): PerformanceAlert[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoffTime);
  }

  // Get recommendations by priority
  getRecommendationsByPriority(priority: 'low' | 'medium' | 'high' | 'critical'): OptimizationRecommendation[] {
    return Array.from(this.profiles.values())
      .flatMap(profile => profile.recommendations)
      .filter(rec => rec.priority === priority);
  }

  // Clean up old profiles
  private cleanupOldProfiles(): void {
    const cutoffTime = new Date(Date.now() - this.config.maxProfileRetentionMs!);
    const profilesToRemove: string[] = [];

    for (const [key, profile] of this.profiles) {
      if (profile.lastUpdated < cutoffTime) {
        profilesToRemove.push(key);
      }
    }

    for (const key of profilesToRemove) {
      this.profiles.delete(key);
    }

    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => alert.timestamp >= cutoffTime);
  }

  // Create empty statistics
  private createEmptyStatistics(): PerformanceStatistics {
    return {
      sampleCount: 0,
      minDuration: 0,
      maxDuration: 0,
      avgDuration: 0,
      p50Duration: 0,
      p95Duration: 0,
      p99Duration: 0,
      errorRate: 0,
      throughput: 0,
      cpuUtilization: 0,
      memoryUtilization: 0,
      trend: 'stable',
    };
  }

  // Get dashboard data
  getDashboardData(): any {
    const profiles = this.getAllProfiles();
    const recentAlerts = this.getRecentAlerts(1); // Last hour
    const criticalRecommendations = this.getRecommendationsByPriority('critical');
    const highRecommendations = this.getRecommendationsByPriority('high');

    const totalSamples = profiles.reduce((sum, p) => sum + p.statistics.sampleCount, 0);
    const avgLatency = profiles.length > 0 
      ? profiles.reduce((sum, p) => sum + p.statistics.avgDuration, 0) / profiles.length 
      : 0;
    const avgErrorRate = profiles.length > 0 
      ? profiles.reduce((sum, p) => sum + p.statistics.errorRate, 0) / profiles.length 
      : 0;
    const avgThroughput = profiles.length > 0 
      ? profiles.reduce((sum, p) => sum + p.statistics.throughput, 0) / profiles.length 
      : 0;

    return {
      summary: {
        totalProfiles: profiles.length,
        totalSamples,
        avgLatency,
        avgErrorRate,
        avgThroughput,
        recentAlerts: recentAlerts.length,
        criticalRecommendations: criticalRecommendations.length,
        highRecommendations: highRecommendations.length,
      },
      profiles: profiles.slice(0, 20), // Top 20 profiles
      recentAlerts,
      recommendations: [...criticalRecommendations, ...highRecommendations].slice(0, 10),
      timestamp: new Date(),
    };
  }
}

// Singleton instance
let globalPerformanceOptimizer: PerformanceOptimizer | undefined;

export function initializePerformanceOptimizer(config?: {
  maxProfileRetentionMs?: number;
  maxSamplesPerProfile?: number;
  analysisIntervalMs?: number;
  enableAutoOptimization?: boolean;
  samplingRate?: number;
}): PerformanceOptimizer {
  if (globalPerformanceOptimizer) {
    console.warn('Performance optimizer already initialized');
    return globalPerformanceOptimizer;
  }

  globalPerformanceOptimizer = new PerformanceOptimizer(config);
  return globalPerformanceOptimizer;
}

export function getPerformanceOptimizer(): PerformanceOptimizer | undefined {
  return globalPerformanceOptimizer;
}

export function shutdownPerformanceOptimizer(): void {
  globalPerformanceOptimizer = undefined;
}