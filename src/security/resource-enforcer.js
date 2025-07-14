/**
 * Resource Enforcer
 * Monitors and enforces resource limits for plugin execution
 */

const EventEmitter = require('events');
const v8 = require('v8');
const os = require('os');

/**
 * Resource Enforcer - Enforces CPU, memory, and I/O limits
 */
class ResourceEnforcer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Memory limits
      maxHeapUsageMB: options.maxHeapUsageMB || 128,
      maxArrayBufferMB: options.maxArrayBufferMB || 64,
      gcThresholdPercent: options.gcThresholdPercent || 80,
      
      // CPU limits
      maxCpuPercent: options.maxCpuPercent || 50,
      cpuCheckInterval: options.cpuCheckInterval || 1000,
      maxExecutionTime: options.maxExecutionTime || 30000,
      
      // I/O limits
      maxFileHandles: options.maxFileHandles || 10,
      maxReadBytesPerSecond: options.maxReadBytesPerSecond || 10 * 1024 * 1024, // 10MB/s
      maxWriteBytesPerSecond: options.maxWriteBytesPerSecond || 5 * 1024 * 1024, // 5MB/s
      
      // Network limits
      maxConcurrentRequests: options.maxConcurrentRequests || 5,
      maxRequestsPerMinute: options.maxRequestsPerMinute || 60,
      maxBandwidthBytesPerSecond: options.maxBandwidthBytesPerSecond || 1024 * 1024, // 1MB/s
      
      // Enforcement
      enforceHardLimits: options.enforceHardLimits !== false,
      gracePeriodMs: options.gracePeriodMs || 5000,
      
      ...options
    };
    
    // Resource tracking
    this.plugins = new Map();
    this.systemBaseline = null;
    
    // Initialize system baseline
    this.initializeBaseline();
  }

  /**
   * Initialize system resource baseline
   */
  initializeBaseline() {
    this.systemBaseline = {
      totalMemory: os.totalmem(),
      cpuCount: os.cpus().length,
      platform: os.platform(),
      initialized: Date.now()
    };
  }

  /**
   * Register plugin for resource tracking
   */
  registerPlugin(pluginId, limits = {}) {
    const pluginLimits = {
      memory: {
        heap: limits.maxHeapMB || this.options.maxHeapUsageMB,
        arrayBuffer: limits.maxArrayBufferMB || this.options.maxArrayBufferMB
      },
      cpu: {
        maxPercent: limits.maxCpuPercent || this.options.maxCpuPercent,
        maxExecutionTime: limits.maxExecutionTime || this.options.maxExecutionTime
      },
      io: {
        maxFileHandles: limits.maxFileHandles || this.options.maxFileHandles,
        maxReadBytesPerSecond: limits.maxReadBytesPerSecond || this.options.maxReadBytesPerSecond,
        maxWriteBytesPerSecond: limits.maxWriteBytesPerSecond || this.options.maxWriteBytesPerSecond
      },
      network: {
        maxConcurrentRequests: limits.maxConcurrentRequests || this.options.maxConcurrentRequests,
        maxRequestsPerMinute: limits.maxRequestsPerMinute || this.options.maxRequestsPerMinute,
        maxBandwidthBytesPerSecond: limits.maxBandwidthBytesPerSecond || this.options.maxBandwidthBytesPerSecond
      }
    };
    
    this.plugins.set(pluginId, {
      id: pluginId,
      limits: pluginLimits,
      usage: {
        memory: { current: 0, peak: 0 },
        cpu: { current: 0, total: 0, samples: [] },
        io: { 
          fileHandles: new Set(),
          readBytes: 0,
          writeBytes: 0,
          lastReset: Date.now()
        },
        network: {
          activeRequests: new Set(),
          requestCount: 0,
          bandwidthUsed: 0,
          lastReset: Date.now()
        }
      },
      startTime: Date.now(),
      violations: [],
      enforcement: {
        warnings: 0,
        gracePeriodStart: null,
        blocked: false
      }
    });
    
    this.emit('plugin-registered', { pluginId, limits: pluginLimits });
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(pluginId, memoryUsage) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    const usage = plugin.usage.memory;
    usage.current = memoryUsage.heapUsed;
    usage.peak = Math.max(usage.peak, memoryUsage.heapUsed);
    
    // Convert to MB for comparison
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const arrayBuffersMB = (memoryUsage.arrayBuffers || 0) / 1024 / 1024;
    
    // Check heap limit
    if (heapUsedMB > plugin.limits.memory.heap) {
      this.handleLimitViolation(pluginId, 'memory-heap', {
        limit: plugin.limits.memory.heap,
        current: heapUsedMB,
        unit: 'MB'
      });
    }
    
    // Check array buffer limit
    if (arrayBuffersMB > plugin.limits.memory.arrayBuffer) {
      this.handleLimitViolation(pluginId, 'memory-arraybuffer', {
        limit: plugin.limits.memory.arrayBuffer,
        current: arrayBuffersMB,
        unit: 'MB'
      });
    }
    
    // Check if GC should be triggered
    const heapPercent = (heapUsedMB / plugin.limits.memory.heap) * 100;
    if (heapPercent > this.options.gcThresholdPercent) {
      this.emit('gc-recommended', {
        pluginId,
        heapPercent,
        heapUsedMB
      });
    }
  }

  /**
   * Track CPU usage
   */
  trackCpuUsage(pluginId, cpuUsage) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    const usage = plugin.usage.cpu;
    const elapsed = Date.now() - plugin.startTime;
    
    // Calculate CPU percentage
    const cpuMicros = cpuUsage.user + cpuUsage.system;
    const cpuPercent = (cpuMicros / elapsed / 10) / this.systemBaseline.cpuCount;
    
    usage.current = cpuPercent;
    usage.total = cpuMicros;
    usage.samples.push({
      timestamp: Date.now(),
      percent: cpuPercent
    });
    
    // Keep only recent samples (last minute)
    const cutoff = Date.now() - 60000;
    usage.samples = usage.samples.filter(s => s.timestamp > cutoff);
    
    // Calculate average CPU over samples
    const avgCpu = usage.samples.reduce((sum, s) => sum + s.percent, 0) / usage.samples.length;
    
    // Check CPU limit
    if (avgCpu > plugin.limits.cpu.maxPercent) {
      this.handleLimitViolation(pluginId, 'cpu-usage', {
        limit: plugin.limits.cpu.maxPercent,
        current: Math.round(avgCpu * 100) / 100,
        unit: '%'
      });
    }
    
    // Check execution time
    if (elapsed > plugin.limits.cpu.maxExecutionTime) {
      this.handleLimitViolation(pluginId, 'execution-time', {
        limit: plugin.limits.cpu.maxExecutionTime,
        current: elapsed,
        unit: 'ms'
      });
    }
  }

  /**
   * Track I/O operations
   */
  trackFileOperation(pluginId, operation, path, bytes = 0) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    const io = plugin.usage.io;
    const now = Date.now();
    
    // Reset counters if needed (per second)
    if (now - io.lastReset > 1000) {
      io.readBytes = 0;
      io.writeBytes = 0;
      io.lastReset = now;
    }
    
    // Track file handles
    if (operation === 'open') {
      io.fileHandles.add(path);
      
      if (io.fileHandles.size > plugin.limits.io.maxFileHandles) {
        this.handleLimitViolation(pluginId, 'file-handles', {
          limit: plugin.limits.io.maxFileHandles,
          current: io.fileHandles.size,
          unit: 'handles'
        });
      }
    } else if (operation === 'close') {
      io.fileHandles.delete(path);
    }
    
    // Track I/O bytes
    if (operation === 'read') {
      io.readBytes += bytes;
      
      if (io.readBytes > plugin.limits.io.maxReadBytesPerSecond) {
        this.handleLimitViolation(pluginId, 'io-read-rate', {
          limit: plugin.limits.io.maxReadBytesPerSecond,
          current: io.readBytes,
          unit: 'bytes/s'
        });
      }
    } else if (operation === 'write') {
      io.writeBytes += bytes;
      
      if (io.writeBytes > plugin.limits.io.maxWriteBytesPerSecond) {
        this.handleLimitViolation(pluginId, 'io-write-rate', {
          limit: plugin.limits.io.maxWriteBytesPerSecond,
          current: io.writeBytes,
          unit: 'bytes/s'
        });
      }
    }
  }

  /**
   * Track network operations
   */
  trackNetworkRequest(pluginId, requestId, operation, bytes = 0) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    const network = plugin.usage.network;
    const now = Date.now();
    
    // Reset counters if needed (per minute for requests, per second for bandwidth)
    if (now - network.lastReset > 60000) {
      network.requestCount = 0;
    }
    if (now - network.lastReset > 1000) {
      network.bandwidthUsed = 0;
      network.lastReset = now;
    }
    
    // Track request lifecycle
    if (operation === 'start') {
      network.activeRequests.add(requestId);
      network.requestCount++;
      
      // Check concurrent requests
      if (network.activeRequests.size > plugin.limits.network.maxConcurrentRequests) {
        this.handleLimitViolation(pluginId, 'concurrent-requests', {
          limit: plugin.limits.network.maxConcurrentRequests,
          current: network.activeRequests.size,
          unit: 'requests'
        });
      }
      
      // Check requests per minute
      if (network.requestCount > plugin.limits.network.maxRequestsPerMinute) {
        this.handleLimitViolation(pluginId, 'request-rate', {
          limit: plugin.limits.network.maxRequestsPerMinute,
          current: network.requestCount,
          unit: 'requests/min'
        });
      }
    } else if (operation === 'end') {
      network.activeRequests.delete(requestId);
    }
    
    // Track bandwidth
    if (operation === 'data') {
      network.bandwidthUsed += bytes;
      
      if (network.bandwidthUsed > plugin.limits.network.maxBandwidthBytesPerSecond) {
        this.handleLimitViolation(pluginId, 'bandwidth', {
          limit: plugin.limits.network.maxBandwidthBytesPerSecond,
          current: network.bandwidthUsed,
          unit: 'bytes/s'
        });
      }
    }
  }

  /**
   * Handle limit violation
   */
  handleLimitViolation(pluginId, violationType, details) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    const violation = {
      type: violationType,
      details,
      timestamp: Date.now()
    };
    
    plugin.violations.push(violation);
    plugin.enforcement.warnings++;
    
    this.emit('limit-violation', {
      pluginId,
      violation,
      totalViolations: plugin.violations.length
    });
    
    // Enforcement logic
    if (this.options.enforceHardLimits) {
      // Start grace period on first violation
      if (!plugin.enforcement.gracePeriodStart) {
        plugin.enforcement.gracePeriodStart = Date.now();
        
        this.emit('grace-period-started', {
          pluginId,
          duration: this.options.gracePeriodMs
        });
      }
      
      // Check if grace period expired
      const gracePeriodExpired = Date.now() - plugin.enforcement.gracePeriodStart > this.options.gracePeriodMs;
      
      // Block plugin if violations continue after grace period
      if (gracePeriodExpired && !plugin.enforcement.blocked) {
        plugin.enforcement.blocked = true;
        
        this.emit('plugin-blocked', {
          pluginId,
          reason: 'resource-limits-exceeded',
          violations: plugin.violations
        });
      }
    }
  }

  /**
   * Get resource usage summary for plugin
   */
  getUsageSummary(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return null;
    
    const elapsed = Date.now() - plugin.startTime;
    
    return {
      pluginId,
      uptime: elapsed,
      memory: {
        current: Math.round(plugin.usage.memory.current / 1024 / 1024 * 100) / 100,
        peak: Math.round(plugin.usage.memory.peak / 1024 / 1024 * 100) / 100,
        limit: plugin.limits.memory.heap,
        unit: 'MB'
      },
      cpu: {
        current: Math.round(plugin.usage.cpu.current * 100) / 100,
        average: plugin.usage.cpu.samples.length > 0 
          ? Math.round(plugin.usage.cpu.samples.reduce((sum, s) => sum + s.percent, 0) / plugin.usage.cpu.samples.length * 100) / 100 
          : 0,
        limit: plugin.limits.cpu.maxPercent,
        unit: '%'
      },
      io: {
        openFiles: plugin.usage.io.fileHandles.size,
        readRate: plugin.usage.io.readBytes,
        writeRate: plugin.usage.io.writeBytes,
        unit: 'bytes/s'
      },
      network: {
        activeRequests: plugin.usage.network.activeRequests.size,
        requestCount: plugin.usage.network.requestCount,
        bandwidth: plugin.usage.network.bandwidthUsed,
        unit: 'bytes/s'
      },
      violations: plugin.violations.length,
      blocked: plugin.enforcement.blocked
    };
  }

  /**
   * Get all plugin summaries
   */
  getAllSummaries() {
    const summaries = {};
    
    for (const [pluginId] of this.plugins) {
      summaries[pluginId] = this.getUsageSummary(pluginId);
    }
    
    return summaries;
  }

  /**
   * Reset plugin enforcement
   */
  resetEnforcement(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    plugin.enforcement = {
      warnings: 0,
      gracePeriodStart: null,
      blocked: false
    };
    
    plugin.violations = [];
    
    this.emit('enforcement-reset', { pluginId });
  }

  /**
   * Unregister plugin
   */
  unregisterPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    // Close any open file handles
    plugin.usage.io.fileHandles.clear();
    
    // Clear active requests
    plugin.usage.network.activeRequests.clear();
    
    this.plugins.delete(pluginId);
    
    this.emit('plugin-unregistered', { pluginId });
  }

  /**
   * Get system resource status
   */
  getSystemStatus() {
    const memInfo = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        system: {
          total: Math.round(this.systemBaseline.totalMemory / 1024 / 1024),
          free: Math.round(os.freemem() / 1024 / 1024),
          unit: 'MB'
        },
        process: {
          heapUsed: Math.round(memInfo.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memInfo.heapTotal / 1024 / 1024),
          external: Math.round(memInfo.external / 1024 / 1024),
          unit: 'MB'
        }
      },
      cpu: {
        cores: this.systemBaseline.cpuCount,
        usage: cpuUsage
      },
      plugins: {
        total: this.plugins.size,
        blocked: Array.from(this.plugins.values()).filter(p => p.enforcement.blocked).length,
        totalViolations: Array.from(this.plugins.values()).reduce((sum, p) => sum + p.violations.length, 0)
      }
    };
  }
}

module.exports = ResourceEnforcer;