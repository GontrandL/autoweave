/**
 * Plugin Security Manager
 * Main integration point for all security components
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const SecurityMonitor = require('./security-monitor');
const ResourceEnforcer = require('./resource-enforcer');
const SecurityBoundary = require('./security-boundary');
const SecurePluginRunner = require('./secure-plugin-runner');

/**
 * Plugin Security Manager - Orchestrates all security components
 */
class PluginSecurityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Security levels
      securityLevel: options.securityLevel || 'high', // low, medium, high
      
      // Component options
      monitor: options.monitor || {},
      enforcer: options.enforcer || {},
      boundary: options.boundary || {},
      
      // Paths
      pluginDirectory: options.pluginDirectory || path.join(process.cwd(), 'plugins'),
      sandboxDirectory: options.sandboxDirectory || path.join(process.cwd(), '.sandbox'),
      
      // Policies
      allowedPluginSources: options.allowedPluginSources || ['local'],
      requireSignedPlugins: options.requireSignedPlugins || false,
      maxActivePlugins: options.maxActivePlugins || 10,
      
      ...options
    };
    
    // Initialize components
    this.monitor = new SecurityMonitor(this.getMonitorOptions());
    this.enforcer = new ResourceEnforcer(this.getEnforcerOptions());
    this.boundary = new SecurityBoundary(this.getBoundaryOptions());
    
    // Plugin registry
    this.plugins = new Map();
    this.activePlugins = new Map();
    
    // Security state
    this.securityState = {
      initialized: false,
      locked: false,
      violations: 0,
      startTime: Date.now()
    };
    
    // Setup component integration
    this.setupComponentIntegration();
  }

  /**
   * Get monitor options based on security level
   */
  getMonitorOptions() {
    const levels = {
      low: {
        maxEventsPerMinute: 2000,
        maxErrorsPerMinute: 100,
        blockOnViolation: false
      },
      medium: {
        maxEventsPerMinute: 1000,
        maxErrorsPerMinute: 50,
        blockOnViolation: true
      },
      high: {
        maxEventsPerMinute: 500,
        maxErrorsPerMinute: 20,
        blockOnViolation: true,
        alertOnAnomaly: true
      }
    };
    
    return {
      ...levels[this.options.securityLevel],
      ...this.options.monitor
    };
  }

  /**
   * Get enforcer options based on security level
   */
  getEnforcerOptions() {
    const levels = {
      low: {
        maxHeapUsageMB: 256,
        maxCpuPercent: 80,
        enforceHardLimits: false
      },
      medium: {
        maxHeapUsageMB: 128,
        maxCpuPercent: 50,
        enforceHardLimits: true,
        gracePeriodMs: 10000
      },
      high: {
        maxHeapUsageMB: 64,
        maxCpuPercent: 30,
        enforceHardLimits: true,
        gracePeriodMs: 5000
      }
    };
    
    return {
      ...levels[this.options.securityLevel],
      ...this.options.enforcer
    };
  }

  /**
   * Get boundary options based on security level
   */
  getBoundaryOptions() {
    const levels = {
      low: {
        encryptMessages: false,
        validateSchema: false,
        auditEnabled: false
      },
      medium: {
        encryptMessages: true,
        validateSchema: true,
        auditEnabled: true
      },
      high: {
        encryptMessages: true,
        validateSchema: true,
        strictMode: true,
        auditEnabled: true,
        maxMessageSize: 512 * 1024 // 512KB
      }
    };
    
    return {
      ...levels[this.options.securityLevel],
      ...this.options.boundary
    };
  }

  /**
   * Setup integration between components
   */
  setupComponentIntegration() {
    // Monitor events
    this.monitor.on('violation', (data) => {
      this.handleViolation(data);
    });
    
    this.monitor.on('anomaly', (data) => {
      this.handleAnomaly(data);
    });
    
    this.monitor.on('block-plugin', (data) => {
      this.blockPlugin(data.pluginId, data.reason);
    });
    
    // Enforcer events
    this.enforcer.on('limit-violation', (data) => {
      this.monitor.trackEvent('resource-limit', data);
    });
    
    this.enforcer.on('plugin-blocked', (data) => {
      this.blockPlugin(data.pluginId, data.reason);
    });
    
    // Boundary events
    this.boundary.on('message', (data) => {
      this.handlePluginMessage(data);
    });
    
    this.boundary.on('message-error', (data) => {
      this.monitor.trackEvent('message-error', data);
    });
    
    this.boundary.on('worker-error', (data) => {
      this.monitor.trackEvent('worker-error', data);
    });
    
    this.boundary.on('worker-exit', (data) => {
      this.handleWorkerExit(data);
    });
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      // Create sandbox directory
      await fs.mkdir(this.options.sandboxDirectory, { recursive: true });
      
      // Create runner script in sandbox
      const runnerPath = path.join(this.options.sandboxDirectory, 'secure-plugin-runner.js');
      const runnerCode = await fs.readFile(
        path.join(__dirname, 'secure-plugin-runner.js'),
        'utf8'
      );
      await fs.writeFile(runnerPath, runnerCode);
      
      this.securityState.initialized = true;
      
      this.emit('initialized', {
        securityLevel: this.options.securityLevel,
        components: ['monitor', 'enforcer', 'boundary']
      });
      
    } catch (error) {
      this.emit('initialization-error', error);
      throw error;
    }
  }

  /**
   * Load and validate plugin
   */
  async loadPlugin(pluginPath) {
    if (!this.securityState.initialized) {
      throw new Error('Security manager not initialized');
    }
    
    if (this.securityState.locked) {
      throw new Error('Security manager is locked');
    }
    
    if (this.activePlugins.size >= this.options.maxActivePlugins) {
      throw new Error('Maximum active plugins reached');
    }
    
    try {
      // Read plugin manifest
      const manifestPath = path.join(pluginPath, 'autoweave.plugin.json');
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);
      
      // Validate manifest
      this.validateManifest(manifest);
      
      // Verify plugin signature if required
      if (this.options.requireSignedPlugins) {
        await this.verifyPluginSignature(pluginPath, manifest);
      }
      
      // Create plugin record
      const plugin = {
        id: manifest.name,
        path: pluginPath,
        manifest,
        state: 'loaded',
        loadedAt: Date.now(),
        securityContext: {
          violations: 0,
          anomalies: 0,
          blocked: false
        }
      };
      
      this.plugins.set(plugin.id, plugin);
      
      this.emit('plugin-loaded', {
        pluginId: plugin.id,
        manifest: manifest
      });
      
      return plugin.id;
      
    } catch (error) {
      this.emit('plugin-load-error', {
        path: pluginPath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate plugin manifest
   */
  validateManifest(manifest) {
    // Required fields
    const required = ['name', 'version', 'entry', 'permissions'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate name
    if (!/^[a-z0-9-]+$/.test(manifest.name)) {
      throw new Error('Invalid plugin name format');
    }
    
    // Validate version
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Invalid version format');
    }
    
    // Validate permissions
    this.validatePermissions(manifest.permissions);
  }

  /**
   * Validate plugin permissions
   */
  validatePermissions(permissions) {
    const allowedPermissions = [
      'filesystem', 'network', 'usb', 'queue', 'memory'
    ];
    
    for (const permission in permissions) {
      if (!allowedPermissions.includes(permission)) {
        throw new Error(`Unknown permission: ${permission}`);
      }
    }
    
    // Validate specific permission formats
    if (permissions.filesystem) {
      if (!Array.isArray(permissions.filesystem)) {
        throw new Error('Filesystem permissions must be an array');
      }
      
      for (const fsPermission of permissions.filesystem) {
        if (!fsPermission.path || !fsPermission.mode) {
          throw new Error('Invalid filesystem permission format');
        }
        
        if (!['read', 'readwrite'].includes(fsPermission.mode)) {
          throw new Error(`Invalid filesystem mode: ${fsPermission.mode}`);
        }
      }
    }
  }

  /**
   * Verify plugin signature
   */
  async verifyPluginSignature(pluginPath, manifest) {
    // This would implement actual signature verification
    // For now, we'll simulate the check
    const signaturePath = path.join(pluginPath, 'plugin.sig');
    
    try {
      await fs.access(signaturePath);
      // In production, verify signature against trusted keys
      return true;
    } catch {
      throw new Error('Plugin signature not found or invalid');
    }
  }

  /**
   * Start plugin in secure sandbox
   */
  async startPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.state === 'running') {
      throw new Error('Plugin already running');
    }
    
    try {
      // Register with enforcer
      this.enforcer.registerPlugin(pluginId, plugin.manifest.permissions?.memory);
      
      // Create secure channel
      const runnerPath = path.join(this.options.sandboxDirectory, 'secure-plugin-runner.js');
      await this.boundary.createChannel(pluginId, runnerPath, plugin.manifest);
      
      // Initialize plugin in sandbox
      await this.boundary.sendMessage(pluginId, 'initialize', {
        manifest: plugin.manifest
      });
      
      // Load plugin code
      const entryPath = path.join(plugin.path, plugin.manifest.entry);
      const pluginCode = await fs.readFile(entryPath, 'utf8');
      
      // Execute plugin
      await this.boundary.sendMessage(pluginId, 'execute', {
        code: pluginCode,
        context: {}
      });
      
      // Update state
      plugin.state = 'running';
      plugin.startedAt = Date.now();
      
      this.activePlugins.set(pluginId, plugin);
      
      this.emit('plugin-started', {
        pluginId,
        permissions: plugin.manifest.permissions
      });
      
    } catch (error) {
      plugin.state = 'error';
      plugin.error = error.message;
      
      // Cleanup
      this.enforcer.unregisterPlugin(pluginId);
      this.boundary.closeChannel(pluginId);
      
      throw error;
    }
  }

  /**
   * Stop plugin
   */
  async stopPlugin(pluginId, reason = 'manual') {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    if (plugin.state !== 'running') return;
    
    try {
      // Send cleanup message
      await this.boundary.sendMessage(pluginId, 'cleanup', {});
      
      // Close channel
      this.boundary.closeChannel(pluginId);
      
      // Unregister from enforcer
      this.enforcer.unregisterPlugin(pluginId);
      
      // Update state
      plugin.state = 'stopped';
      plugin.stoppedAt = Date.now();
      plugin.stopReason = reason;
      
      this.activePlugins.delete(pluginId);
      
      this.emit('plugin-stopped', {
        pluginId,
        reason,
        runtime: plugin.stoppedAt - plugin.startedAt
      });
      
    } catch (error) {
      this.emit('plugin-stop-error', {
        pluginId,
        error: error.message
      });
    }
  }

  /**
   * Block plugin due to security violation
   */
  async blockPlugin(pluginId, reason) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    
    plugin.securityContext.blocked = true;
    plugin.securityContext.blockReason = reason;
    plugin.securityContext.blockedAt = Date.now();
    
    // Stop plugin
    await this.stopPlugin(pluginId, `blocked: ${reason}`);
    
    // Update security state
    this.securityState.violations++;
    
    this.emit('plugin-blocked', {
      pluginId,
      reason,
      violations: plugin.securityContext.violations,
      anomalies: plugin.securityContext.anomalies
    });
    
    // Check if we should lock the system
    if (this.securityState.violations > 10) {
      this.lockSystem('Too many security violations');
    }
  }

  /**
   * Handle security violation
   */
  handleViolation(data) {
    const plugin = this.plugins.get(data.pluginId);
    if (!plugin) return;
    
    plugin.securityContext.violations++;
    
    this.emit('security-violation', data);
    
    // Check if plugin should be blocked
    if (plugin.securityContext.violations > 5) {
      this.blockPlugin(data.pluginId, 'Too many violations');
    }
  }

  /**
   * Handle anomaly detection
   */
  handleAnomaly(data) {
    const plugin = this.plugins.get(data.pluginId);
    if (!plugin) return;
    
    plugin.securityContext.anomalies++;
    
    this.emit('security-anomaly', data);
    
    // Check if plugin should be blocked
    if (plugin.securityContext.anomalies > 10) {
      this.blockPlugin(data.pluginId, 'Too many anomalies');
    }
  }

  /**
   * Handle plugin message
   */
  handlePluginMessage(data) {
    const { pluginId, message } = data;
    
    // Track with monitor
    this.monitor.trackEvent(message.type, {
      ...message.data,
      pluginId
    });
    
    // Track resource usage
    if (message.type === 'resource-usage') {
      this.enforcer.trackResourceUsage(pluginId, message.data);
      this.monitor.trackResourceUsage(pluginId, message.data);
    }
  }

  /**
   * Handle worker exit
   */
  handleWorkerExit(data) {
    const { pluginId, code } = data;
    
    if (code !== 0) {
      this.monitor.trackEvent('abnormal-exit', {
        pluginId,
        code
      });
    }
    
    // Clean up plugin
    this.stopPlugin(pluginId, `exit: ${code}`);
  }

  /**
   * Lock security system
   */
  lockSystem(reason) {
    this.securityState.locked = true;
    this.securityState.lockReason = reason;
    this.securityState.lockedAt = Date.now();
    
    // Stop all plugins
    for (const [pluginId] of this.activePlugins) {
      this.stopPlugin(pluginId, 'system-locked');
    }
    
    this.emit('system-locked', {
      reason,
      violations: this.securityState.violations
    });
  }

  /**
   * Unlock security system
   */
  unlockSystem() {
    this.securityState.locked = false;
    this.securityState.lockReason = null;
    this.securityState.violations = 0;
    
    this.emit('system-unlocked');
  }

  /**
   * Send message to plugin
   */
  async sendPluginMessage(pluginId, message) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    
    if (plugin.state !== 'running') {
      throw new Error(`Plugin not running: ${pluginId}`);
    }
    
    if (plugin.securityContext.blocked) {
      throw new Error(`Plugin is blocked: ${pluginId}`);
    }
    
    try {
      await this.boundary.sendMessage(pluginId, 'plugin-message', message);
    } catch (error) {
      this.emit('message-send-error', {
        pluginId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get plugin channel
   */
  getPluginChannel(pluginId) {
    if (!this.boundary) {
      return null;
    }
    
    return this.boundary.getChannel(pluginId);
  }

  /**
   * Get active plugins list
   */
  getActivePlugins() {
    return Array.from(this.activePlugins.keys());
  }

  /**
   * Get security status
   */
  getSecurityStatus() {
    return {
      initialized: this.securityState.initialized,
      locked: this.securityState.locked,
      lockReason: this.securityState.lockReason,
      securityLevel: this.options.securityLevel,
      uptime: Date.now() - this.securityState.startTime,
      plugins: {
        total: this.plugins.size,
        active: this.activePlugins.size,
        blocked: Array.from(this.plugins.values())
          .filter(p => p.securityContext.blocked).length
      },
      violations: this.securityState.violations,
      monitor: this.monitor.getStats(),
      resources: this.enforcer.getSystemStatus(),
      channels: this.boundary.getAllChannelStatuses()
    };
  }

  /**
   * Generate comprehensive security report
   */
  generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      system: this.getSecurityStatus(),
      plugins: {},
      monitor: this.monitor.generateReport(),
      resources: this.enforcer.getAllSummaries(),
      boundary: this.boundary.generateSecurityReport(),
      audit: this.boundary.getAuditLog(null, 1000)
    };
    
    // Add plugin details
    for (const [pluginId, plugin] of this.plugins) {
      report.plugins[pluginId] = {
        manifest: plugin.manifest,
        state: plugin.state,
        security: plugin.securityContext,
        runtime: plugin.startedAt ? Date.now() - plugin.startedAt : 0
      };
    }
    
    return report;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    // Stop all plugins
    for (const [pluginId] of this.activePlugins) {
      await this.stopPlugin(pluginId, 'cleanup');
    }
    
    // Cleanup components
    this.boundary.cleanup();
    
    // Clear data
    this.plugins.clear();
    this.activePlugins.clear();
    
    this.emit('cleanup-complete');
  }
}

module.exports = PluginSecurityManager;