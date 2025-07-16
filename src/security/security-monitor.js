/**
 * Security Monitor
 * Tracks security events, detects anomalies, and enforces security policies
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Security Monitor - Real-time security event tracking and anomaly detection
 */
class SecurityMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Thresholds
      maxEventsPerMinute: options.maxEventsPerMinute || 1000,
      maxErrorsPerMinute: options.maxErrorsPerMinute || 50,
      maxMemoryUsageMB: options.maxMemoryUsageMB || 256,
      maxCpuUsagePercent: options.maxCpuUsagePercent || 80,
      maxNetworkRequestsPerMinute: options.maxNetworkRequestsPerMinute || 100,
      maxFileOperationsPerMinute: options.maxFileOperationsPerMinute || 100,
      
      // Detection windows
      anomalyDetectionWindow: options.anomalyDetectionWindow || 60000, // 1 minute
      patternAnalysisWindow: options.patternAnalysisWindow || 300000, // 5 minutes
      
      // Security policies
      blockOnViolation: options.blockOnViolation !== false,
      alertOnAnomaly: options.alertOnAnomaly !== false,
      
      ...options
    };
    
    // Event tracking
    this.events = new Map();
    this.violations = new Map();
    this.anomalies = new Map();
    
    // Resource usage tracking
    this.resourceMetrics = new Map();
    
    // Pattern detection
    this.patterns = new Map();
    this.blacklistedPatterns = new Set([
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(\s*['"`]child_process['"`]\s*\)/,
      /process\s*\.\s*binding/,
      /__proto__/,
      /constructor\s*\.\s*constructor/
    ]);
    
    // Session tracking
    this.sessions = new Map();
    
    // Start cleanup intervals
    this.startCleanupIntervals();
  }

  /**
   * Track security event
   */
  trackEvent(eventType, data) {
    const timestamp = Date.now();
    const eventId = crypto.randomUUID();
    
    const event = {
      id: eventId,
      type: eventType,
      data,
      timestamp,
      pluginId: data.pluginId,
      sessionId: data.sessionId
    };
    
    // Store event
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType).push(event);
    
    // Check for violations
    this.checkViolations(eventType, event);
    
    // Detect anomalies
    this.detectAnomalies(eventType, event);
    
    // Pattern analysis
    this.analyzePatterns(event);
    
    return eventId;
  }

  /**
   * Check for security violations
   */
  checkViolations(eventType, event) {
    const violations = [];
    
    switch (eventType) {
      case 'permission-denied':
        violations.push({
          type: 'unauthorized-access',
          severity: 'high',
          details: event.data
        });
        break;
        
      case 'resource-limit':
        violations.push({
          type: 'resource-exhaustion',
          severity: 'medium',
          details: event.data
        });
        break;
        
      case 'pattern-match':
        if (event.data.malicious) {
          violations.push({
            type: 'malicious-code',
            severity: 'critical',
            details: event.data
          });
        }
        break;
        
      case 'rate-limit':
        violations.push({
          type: 'rate-limit-exceeded',
          severity: 'medium',
          details: event.data
        });
        break;
    }
    
    violations.forEach(violation => {
      this.recordViolation(event.pluginId, violation);
    });
  }

  /**
   * Record security violation
   */
  recordViolation(pluginId, violation) {
    if (!this.violations.has(pluginId)) {
      this.violations.set(pluginId, []);
    }
    
    const record = {
      ...violation,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    };
    
    this.violations.get(pluginId).push(record);
    
    this.emit('violation', {
      pluginId,
      violation: record
    });
    
    // Block if configured
    if (this.options.blockOnViolation && violation.severity === 'critical') {
      this.emit('block-plugin', {
        pluginId,
        reason: violation.type,
        violation: record
      });
    }
  }

  /**
   * Detect anomalies in plugin behavior
   */
  detectAnomalies(eventType, event) {
    const window = this.options.anomalyDetectionWindow;
    const now = Date.now();
    
    // Get recent events of this type
    const recentEvents = this.getRecentEvents(eventType, window);
    
    // Calculate event rate
    const eventRate = (recentEvents.length / window) * 60000; // per minute
    
    // Check for anomalies
    const anomalies = [];
    
    // High event rate
    if (eventRate > this.options.maxEventsPerMinute) {
      anomalies.push({
        type: 'high-event-rate',
        metric: 'events-per-minute',
        expected: this.options.maxEventsPerMinute,
        actual: Math.round(eventRate),
        eventType
      });
    }
    
    // Check specific event types
    switch (eventType) {
      case 'error':
        const errorRate = (recentEvents.length / window) * 60000;
        if (errorRate > this.options.maxErrorsPerMinute) {
          anomalies.push({
            type: 'high-error-rate',
            metric: 'errors-per-minute',
            expected: this.options.maxErrorsPerMinute,
            actual: Math.round(errorRate)
          });
        }
        break;
        
      case 'network-access':
        const networkRate = (recentEvents.length / window) * 60000;
        if (networkRate > this.options.maxNetworkRequestsPerMinute) {
          anomalies.push({
            type: 'high-network-rate',
            metric: 'requests-per-minute',
            expected: this.options.maxNetworkRequestsPerMinute,
            actual: Math.round(networkRate)
          });
        }
        break;
        
      case 'fs-access':
        const fsRate = (recentEvents.length / window) * 60000;
        if (fsRate > this.options.maxFileOperationsPerMinute) {
          anomalies.push({
            type: 'high-file-operation-rate',
            metric: 'operations-per-minute',
            expected: this.options.maxFileOperationsPerMinute,
            actual: Math.round(fsRate)
          });
        }
        break;
    }
    
    // Record anomalies
    anomalies.forEach(anomaly => {
      this.recordAnomaly(event.pluginId, anomaly);
    });
  }

  /**
   * Record anomaly
   */
  recordAnomaly(pluginId, anomaly) {
    if (!this.anomalies.has(pluginId)) {
      this.anomalies.set(pluginId, []);
    }
    
    const record = {
      ...anomaly,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    };
    
    this.anomalies.get(pluginId).push(record);
    
    if (this.options.alertOnAnomaly) {
      this.emit('anomaly', {
        pluginId,
        anomaly: record
      });
    }
  }

  /**
   * Analyze patterns in plugin behavior
   */
  analyzePatterns(event) {
    // Check for malicious patterns in code execution
    if (event.type === 'execution' && event.data.code) {
      for (const pattern of this.blacklistedPatterns) {
        if (pattern.test(event.data.code)) {
          this.trackEvent('pattern-match', {
            ...event.data,
            pattern: pattern.toString(),
            malicious: true
          });
          break;
        }
      }
    }
    
    // Analyze access patterns
    const pluginId = event.pluginId;
    if (!this.patterns.has(pluginId)) {
      this.patterns.set(pluginId, {
        resources: new Set(),
        operations: new Map(),
        sequences: []
      });
    }
    
    const pattern = this.patterns.get(pluginId);
    
    // Track resource access
    if (event.data.path || event.data.url || event.data.queue) {
      const resource = event.data.path || event.data.url || event.data.queue;
      pattern.resources.add(resource);
    }
    
    // Track operation sequences
    pattern.sequences.push({
      type: event.type,
      timestamp: event.timestamp
    });
    
    // Keep only recent sequences
    const sequenceWindow = this.options.patternAnalysisWindow;
    pattern.sequences = pattern.sequences.filter(
      seq => seq.timestamp > Date.now() - sequenceWindow
    );
    
    // Detect suspicious patterns
    this.detectSuspiciousPatterns(pluginId, pattern);
  }

  /**
   * Detect suspicious access patterns
   */
  detectSuspiciousPatterns(pluginId, pattern) {
    const suspicious = [];
    
    // Rapid resource enumeration
    if (pattern.resources.size > 100) {
      suspicious.push({
        type: 'resource-enumeration',
        count: pattern.resources.size,
        severity: 'medium'
      });
    }
    
    // Repetitive error patterns
    const errorSequences = pattern.sequences.filter(seq => seq.type === 'error');
    if (errorSequences.length > 10) {
      const timeSpan = errorSequences[errorSequences.length - 1].timestamp - errorSequences[0].timestamp;
      if (timeSpan < 60000) { // Within 1 minute
        suspicious.push({
          type: 'error-flood',
          count: errorSequences.length,
          timeSpan,
          severity: 'high'
        });
      }
    }
    
    // Resource access after errors
    const lastError = pattern.sequences.findLastIndex(seq => seq.type === 'error');
    if (lastError !== -1) {
      const afterError = pattern.sequences.slice(lastError + 1);
      const sensitiveAccess = afterError.find(seq => 
        ['fs-access', 'network-access'].includes(seq.type)
      );
      
      if (sensitiveAccess) {
        suspicious.push({
          type: 'access-after-error',
          sequence: ['error', sensitiveAccess.type],
          severity: 'high'
        });
      }
    }
    
    suspicious.forEach(suspiciousPattern => {
      this.recordAnomaly(pluginId, {
        type: 'suspicious-pattern',
        pattern: suspiciousPattern
      });
    });
  }

  /**
   * Monitor resource usage
   */
  trackResourceUsage(pluginId, metrics) {
    if (!this.resourceMetrics.has(pluginId)) {
      this.resourceMetrics.set(pluginId, []);
    }
    
    const record = {
      ...metrics,
      timestamp: Date.now()
    };
    
    this.resourceMetrics.get(pluginId).push(record);
    
    // Check limits
    if (metrics.memory && metrics.memory.heapUsed > this.options.maxMemoryUsageMB * 1024 * 1024) {
      this.trackEvent('resource-limit', {
        pluginId,
        type: 'memory',
        limit: this.options.maxMemoryUsageMB,
        actual: Math.round(metrics.memory.heapUsed / 1024 / 1024)
      });
    }
    
    if (metrics.cpu) {
      const cpuPercent = (metrics.cpu.user + metrics.cpu.system) / 1000000 * 100;
      if (cpuPercent > this.options.maxCpuUsagePercent) {
        this.trackEvent('resource-limit', {
          pluginId,
          type: 'cpu',
          limit: this.options.maxCpuUsagePercent,
          actual: Math.round(cpuPercent)
        });
      }
    }
  }

  /**
   * Get recent events within time window
   */
  getRecentEvents(eventType, window) {
    const events = this.events.get(eventType) || [];
    const cutoff = Date.now() - window;
    return events.filter(event => event.timestamp > cutoff);
  }

  /**
   * Generate security report
   */
  generateReport(pluginId = null) {
    const report = {
      timestamp: new Date().toISOString(),
      plugins: {}
    };
    
    const pluginIds = pluginId ? [pluginId] : Array.from(new Set([
      ...this.violations.keys(),
      ...this.anomalies.keys(),
      ...this.resourceMetrics.keys()
    ]));
    
    pluginIds.forEach(id => {
      report.plugins[id] = {
        violations: this.violations.get(id) || [],
        anomalies: this.anomalies.get(id) || [],
        resourceUsage: this.getResourceSummary(id),
        patterns: this.getPatternSummary(id),
        riskScore: this.calculateRiskScore(id)
      };
    });
    
    return report;
  }

  /**
   * Get resource usage summary
   */
  getResourceSummary(pluginId) {
    const metrics = this.resourceMetrics.get(pluginId) || [];
    if (metrics.length === 0) return null;
    
    const recent = metrics.slice(-100); // Last 100 measurements
    
    return {
      memory: {
        average: Math.round(recent.reduce((sum, m) => sum + (m.memory?.heapUsed || 0), 0) / recent.length / 1024 / 1024),
        peak: Math.round(Math.max(...recent.map(m => m.memory?.heapUsed || 0)) / 1024 / 1024)
      },
      cpu: {
        average: Math.round(recent.reduce((sum, m) => sum + ((m.cpu?.user || 0) + (m.cpu?.system || 0)), 0) / recent.length / 10000) / 100
      }
    };
  }

  /**
   * Get pattern summary
   */
  getPatternSummary(pluginId) {
    const pattern = this.patterns.get(pluginId);
    if (!pattern) return null;
    
    return {
      resourcesAccessed: pattern.resources.size,
      operationTypes: Array.from(new Set(pattern.sequences.map(s => s.type))),
      sequenceCount: pattern.sequences.length
    };
  }

  /**
   * Calculate risk score for plugin
   */
  calculateRiskScore(pluginId) {
    let score = 0;
    
    // Violations
    const violations = this.violations.get(pluginId) || [];
    violations.forEach(violation => {
      switch (violation.severity) {
        case 'critical': score += 10; break;
        case 'high': score += 5; break;
        case 'medium': score += 2; break;
        case 'low': score += 1; break;
      }
    });
    
    // Anomalies
    const anomalies = this.anomalies.get(pluginId) || [];
    score += anomalies.length * 2;
    
    // Resource usage
    const summary = this.getResourceSummary(pluginId);
    if (summary) {
      if (summary.memory.peak > this.options.maxMemoryUsageMB * 0.8) score += 3;
      if (summary.cpu.average > this.options.maxCpuUsagePercent * 0.8) score += 3;
    }
    
    return Math.min(100, score);
  }

  /**
   * Start cleanup intervals
   */
  startCleanupIntervals() {
    // Clean old events every 5 minutes
    setInterval(() => {
      const cutoff = Date.now() - this.options.patternAnalysisWindow;
      
      // Clean events
      for (const [eventType, events] of this.events) {
        const filtered = events.filter(e => e.timestamp > cutoff);
        if (filtered.length === 0) {
          this.events.delete(eventType);
        } else {
          this.events.set(eventType, filtered);
        }
      }
      
      // Clean resource metrics
      for (const [pluginId, metrics] of this.resourceMetrics) {
        const filtered = metrics.filter(m => m.timestamp > cutoff);
        if (filtered.length === 0) {
          this.resourceMetrics.delete(pluginId);
        } else {
          this.resourceMetrics.set(pluginId, filtered);
        }
      }
    }, 300000); // 5 minutes
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      totalEvents: Array.from(this.events.values()).reduce((sum, events) => sum + events.length, 0),
      activePlugins: new Set([
        ...this.violations.keys(),
        ...this.anomalies.keys(),
        ...this.resourceMetrics.keys()
      ]).size,
      totalViolations: Array.from(this.violations.values()).reduce((sum, v) => sum + v.length, 0),
      totalAnomalies: Array.from(this.anomalies.values()).reduce((sum, a) => sum + a.length, 0),
      highRiskPlugins: Array.from(new Set([
        ...this.violations.keys(),
        ...this.anomalies.keys()
      ])).filter(id => this.calculateRiskScore(id) > 50).length
    };
  }
}

module.exports = SecurityMonitor;