import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

interface HistogramData {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  buckets: Map<number, number>;
}

interface CounterData {
  value: number;
  rate: number;
  lastReset: number;
}

interface GaugeData {
  value: number;
  min: number;
  max: number;
  lastUpdate: number;
}

/**
 * High-performance metrics collector with minimal overhead
 * Designed for production use with efficient data structures
 */
export class MetricsCollector extends EventEmitter {
  private histograms = new Map<string, number[]>();
  private counters = new Map<string, CounterData>();
  private gauges = new Map<string, GaugeData>();
  private labels = new Map<string, Map<string, any>>();
  
  private flushInterval?: NodeJS.Timer;
  private metricsBuffer: any[] = [];
  private maxHistogramSamples = 10000;
  private startTime = Date.now();

  constructor(
    private namespace: string,
    private options: {
      flushIntervalMs?: number;
      maxHistogramSamples?: number;
      enableAutoFlush?: boolean;
    } = {}
  ) {
    super();
    
    this.maxHistogramSamples = options.maxHistogramSamples || 10000;
    
    if (options.enableAutoFlush !== false) {
      this.startAutoFlush(options.flushIntervalMs || 60000);
    }
  }

  /**
   * Record a histogram metric (for latencies, sizes, etc.)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, any>): void {
    const key = this.getMetricKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    
    const samples = this.histograms.get(key)!;
    samples.push(value);
    
    // Prevent unbounded growth
    if (samples.length > this.maxHistogramSamples) {
      // Remove oldest 10% of samples
      const toRemove = Math.floor(samples.length * 0.1);
      samples.splice(0, toRemove);
    }
    
    if (labels) {
      this.labels.set(key, new Map(Object.entries(labels)));
    }
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, any>): void {
    const key = this.getMetricKey(name, labels);
    
    if (!this.counters.has(key)) {
      this.counters.set(key, {
        value: 0,
        rate: 0,
        lastReset: Date.now()
      });
    }
    
    const counter = this.counters.get(key)!;
    counter.value += value;
    
    // Calculate rate
    const now = Date.now();
    const elapsed = (now - counter.lastReset) / 1000; // seconds
    if (elapsed > 0) {
      counter.rate = counter.value / elapsed;
    }
    
    if (labels) {
      this.labels.set(key, new Map(Object.entries(labels)));
    }
  }

  /**
   * Set a gauge metric
   */
  recordGauge(name: string, value: number, labels?: Record<string, any>): void {
    const key = this.getMetricKey(name, labels);
    
    if (!this.gauges.has(key)) {
      this.gauges.set(key, {
        value: value,
        min: value,
        max: value,
        lastUpdate: Date.now()
      });
    } else {
      const gauge = this.gauges.get(key)!;
      gauge.value = value;
      gauge.min = Math.min(gauge.min, value);
      gauge.max = Math.max(gauge.max, value);
      gauge.lastUpdate = Date.now();
    }
    
    if (labels) {
      this.labels.set(key, new Map(Object.entries(labels)));
    }
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string, labels?: Record<string, any>): HistogramData | null {
    const key = this.getMetricKey(name, labels);
    const samples = this.histograms.get(key);
    
    if (!samples || samples.length === 0) {
      return null;
    }
    
    return this.calculateHistogramStats(samples);
  }

  /**
   * Get counter value and rate
   */
  getCounter(name: string, labels?: Record<string, any>): CounterData | null {
    const key = this.getMetricKey(name, labels);
    return this.counters.get(key) || null;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string, labels?: Record<string, any>): GaugeData | null {
    const key = this.getMetricKey(name, labels);
    return this.gauges.get(key) || null;
  }

  /**
   * Get all metrics in a format suitable for export
   */
  getAll(): {
    namespace: string;
    uptime: number;
    metrics: {
      histograms: Map<string, HistogramData>;
      counters: Map<string, CounterData>;
      gauges: Map<string, GaugeData>;
    };
  } {
    const histograms = new Map<string, HistogramData>();
    
    for (const [key, samples] of this.histograms) {
      if (samples.length > 0) {
        histograms.set(key, this.calculateHistogramStats(samples));
      }
    }
    
    return {
      namespace: this.namespace,
      uptime: Date.now() - this.startTime,
      metrics: {
        histograms,
        counters: new Map(this.counters),
        gauges: new Map(this.gauges)
      }
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
    this.labels.clear();
    this.metricsBuffer.length = 0;
  }

  /**
   * Reset specific metric type
   */
  resetCounters(): void {
    for (const counter of this.counters.values()) {
      counter.value = 0;
      counter.lastReset = Date.now();
      counter.rate = 0;
    }
  }

  /**
   * Flush metrics to external system
   */
  async flush(): Promise<void> {
    const metrics = this.getAll();
    
    // Buffer metrics for batch sending
    this.metricsBuffer.push({
      timestamp: Date.now(),
      ...metrics
    });
    
    // Emit for external handlers
    this.emit('flush', this.metricsBuffer);
    
    // Clear buffer after successful flush
    this.metricsBuffer.length = 0;
  }

  /**
   * Calculate histogram statistics efficiently
   */
  private calculateHistogramStats(samples: number[]): HistogramData {
    if (samples.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        buckets: new Map()
      };
    }
    
    // Sort samples for percentile calculation
    const sorted = [...samples].sort((a, b) => a - b);
    
    // Calculate basic stats
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const min = sorted[0];
    const max = sorted[count - 1];
    
    // Calculate percentiles
    const p50Index = Math.floor(count * 0.5);
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);
    
    // Create histogram buckets
    const buckets = new Map<number, number>();
    const bucketBoundaries = this.calculateBucketBoundaries(min, max);
    
    for (const boundary of bucketBoundaries) {
      buckets.set(boundary, 0);
    }
    
    for (const sample of samples) {
      for (const boundary of bucketBoundaries) {
        if (sample <= boundary) {
          buckets.set(boundary, buckets.get(boundary)! + 1);
          break;
        }
      }
    }
    
    return {
      count,
      sum,
      min,
      max,
      mean,
      p50: sorted[p50Index],
      p95: sorted[p95Index],
      p99: sorted[p99Index],
      buckets
    };
  }

  /**
   * Calculate exponential histogram bucket boundaries
   */
  private calculateBucketBoundaries(min: number, max: number): number[] {
    const boundaries: number[] = [];
    
    // Start with common latency boundaries (in ms)
    const commonBoundaries = [0.1, 0.5, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
    
    for (const boundary of commonBoundaries) {
      if (boundary >= min && boundary <= max * 1.1) {
        boundaries.push(boundary);
      }
    }
    
    // Add min and max if not already included
    if (!boundaries.includes(min)) {
      boundaries.unshift(min);
    }
    if (!boundaries.includes(max)) {
      boundaries.push(max);
    }
    
    return boundaries;
  }

  /**
   * Generate metric key with labels
   */
  private getMetricKey(name: string, labels?: Record<string, any>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    // Sort labels for consistent keys
    const sortedLabels = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${name}{${sortedLabels}}`;
  }

  /**
   * Start automatic metric flushing
   */
  private startAutoFlush(intervalMs: number): void {
    this.flushInterval = setInterval(() => {
      this.flush().catch(error => {
        console.error('Failed to flush metrics:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop automatic metric flushing
   */
  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = undefined;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAutoFlush();
    this.reset();
    this.removeAllListeners();
  }
}

/**
 * Global metrics registry for application-wide metrics
 */
export class MetricsRegistry {
  private static collectors = new Map<string, MetricsCollector>();
  
  /**
   * Get or create a metrics collector
   */
  static getCollector(namespace: string, options?: any): MetricsCollector {
    if (!this.collectors.has(namespace)) {
      this.collectors.set(namespace, new MetricsCollector(namespace, options));
    }
    
    return this.collectors.get(namespace)!;
  }
  
  /**
   * Get all collectors
   */
  static getAllCollectors(): Map<string, MetricsCollector> {
    return new Map(this.collectors);
  }
  
  /**
   * Flush all collectors
   */
  static async flushAll(): Promise<void> {
    const flushPromises = Array.from(this.collectors.values()).map(
      collector => collector.flush()
    );
    
    await Promise.all(flushPromises);
  }
  
  /**
   * Reset all collectors
   */
  static resetAll(): void {
    for (const collector of this.collectors.values()) {
      collector.reset();
    }
  }
  
  /**
   * Destroy all collectors
   */
  static destroyAll(): void {
    for (const collector of this.collectors.values()) {
      collector.destroy();
    }
    
    this.collectors.clear();
  }
}