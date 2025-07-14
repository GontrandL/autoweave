/**
 * AutoWeave Integration Service
 * Main integration point connecting USB daemon, plugin loader, and event bridge
 */

const EventEmitter = require('events');
const path = require('path');
const { Worker } = require('worker_threads');

// USB Daemon components
const USBDaemon = require('../usb/usb-daemon');
const USBEventPublisher = require('../usb/usb-event-publisher');

// Plugin system components
const PluginSecurityManager = require('../security/plugin-security-manager');
const PluginUSBCapability = require('./plugin-usb-capability');

// Integration components
const USBEventBridge = require('./usb-event-bridge');

/**
 * AutoWeave Integration Service - Orchestrates all components
 */
class AutoWeaveIntegrationService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Service identification
      serviceName: options.serviceName || 'autoweave-integration',
      serviceId: options.serviceId || `integration-${process.pid}`,
      
      // Component configurations
      usbDaemon: options.usbDaemon || {},
      pluginLoader: options.pluginLoader || {},
      eventBridge: options.eventBridge || {},
      
      // Redis configuration
      redis: {
        host: options.redis?.host || process.env.REDIS_HOST || 'localhost',
        port: options.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
        password: options.redis?.password || process.env.REDIS_PASSWORD,
        db: options.redis?.db || 0
      },
      
      // Service settings
      autoStart: options.autoStart !== false,
      healthCheckInterval: options.healthCheckInterval || 30000,
      
      ...options
    };
    
    // Component instances
    this.usbDaemon = null;
    this.usbPublisher = null;
    this.pluginManager = null;
    this.eventBridge = null;
    this.usbCapability = null;
    
    // Service state
    this.state = {
      initialized: false,
      running: false,
      startTime: null,
      components: {
        usbDaemon: 'stopped',
        pluginManager: 'stopped',
        eventBridge: 'stopped'
      }
    };
    
    // Health monitoring
    this.healthChecker = null;
    this.metrics = {
      usbEvents: 0,
      pluginsLoaded: 0,
      eventsRouted: 0,
      errors: 0
    };
  }

  /**
   * Initialize the integration service
   */
  async initialize() {
    try {
      console.log('Initializing AutoWeave Integration Service...');
      
      // Initialize USB capability validator
      this.usbCapability = new PluginUSBCapability();
      
      // Initialize USB daemon
      await this.initializeUSBDaemon();
      
      // Initialize plugin security manager
      await this.initializePluginManager();
      
      // Initialize event bridge
      await this.initializeEventBridge();
      
      // Setup component connections
      await this.setupIntegration();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      this.state.initialized = true;
      
      this.emit('initialized', {
        serviceId: this.options.serviceId,
        components: Object.keys(this.state.components)
      });
      
      console.log('AutoWeave Integration Service initialized successfully');
      
      // Auto-start if configured
      if (this.options.autoStart) {
        await this.start();
      }
      
    } catch (error) {
      console.error('Failed to initialize integration service:', error);
      this.emit('initialization-error', error);
      throw error;
    }
  }

  /**
   * Initialize USB daemon
   */
  async initializeUSBDaemon() {
    const daemonConfig = {
      ...this.options.usbDaemon,
      redis: this.options.redis
    };
    
    // Create USB daemon instance
    this.usbDaemon = new USBDaemon(daemonConfig);
    
    // Create USB event publisher
    this.usbPublisher = new USBEventPublisher(this.options.redis);
    
    // Wire up event publishing
    this.usbDaemon.on('device:attach', async (deviceInfo) => {
      await this.usbPublisher.publishUSBEvent('attach', deviceInfo);
      this.metrics.usbEvents++;
    });
    
    this.usbDaemon.on('device:detach', async (deviceInfo) => {
      await this.usbPublisher.publishUSBEvent('detach', deviceInfo);
      this.metrics.usbEvents++;
    });
    
    // Monitor daemon errors
    this.usbDaemon.on('error', (error) => {
      this.handleComponentError('usbDaemon', error);
    });
    
    this.state.components.usbDaemon = 'initialized';
  }

  /**
   * Initialize plugin security manager
   */
  async initializePluginManager() {
    const managerConfig = {
      ...this.options.pluginLoader,
      pluginDirectory: path.join(process.cwd(), 'plugins'),
      sandboxDirectory: path.join(process.cwd(), '.sandbox')
    };
    
    // Create plugin manager instance
    this.pluginManager = new PluginSecurityManager(managerConfig);
    
    // Initialize the manager
    await this.pluginManager.initialize();
    
    // Monitor plugin events
    this.pluginManager.on('plugin-loaded', (data) => {
      this.handlePluginLoaded(data);
    });
    
    this.pluginManager.on('plugin-started', (data) => {
      this.handlePluginStarted(data);
    });
    
    this.pluginManager.on('plugin-stopped', (data) => {
      this.handlePluginStopped(data);
    });
    
    this.pluginManager.on('security-violation', (data) => {
      this.handleSecurityViolation(data);
    });
    
    this.state.components.pluginManager = 'initialized';
  }

  /**
   * Initialize event bridge
   */
  async initializeEventBridge() {
    const bridgeConfig = {
      ...this.options.eventBridge,
      redis: this.options.redis
    };
    
    // Create event bridge instance
    this.eventBridge = new USBEventBridge(bridgeConfig);
    
    // Initialize the bridge
    await this.eventBridge.initialize();
    
    // Monitor bridge events
    this.eventBridge.on('route-to-plugin', (data) => {
      this.handleRouteToPlugin(data);
    });
    
    this.eventBridge.on('event-processed', (data) => {
      this.metrics.eventsRouted += data.routedTo.length;
    });
    
    this.eventBridge.on('processing-error', (error) => {
      this.handleComponentError('eventBridge', error);
    });
    
    this.state.components.eventBridge = 'initialized';
  }

  /**
   * Setup integration between components
   */
  async setupIntegration() {
    // Connect plugin manager to event bridge for plugin registration
    this.pluginManager.on('plugin-loaded', ({ pluginId, manifest }) => {
      // Validate USB capabilities if present
      if (manifest.permissions?.usb) {
        try {
          this.usbCapability.validateManifest(manifest);
          this.eventBridge.registerPlugin(pluginId, manifest);
        } catch (error) {
          console.error(`Failed to register USB plugin ${pluginId}:`, error.message);
        }
      }
    });
    
    // Handle plugin unregistration
    this.pluginManager.on('plugin-stopped', ({ pluginId }) => {
      this.eventBridge.unregisterPlugin(pluginId);
    });
    
    // Route USB events from bridge to plugin manager
    this.eventBridge.on('route-to-plugin', async ({ pluginId, payload }) => {
      try {
        // Send USB event to plugin through secure channel
        await this.pluginManager.sendPluginMessage(pluginId, payload);
      } catch (error) {
        console.error(`Failed to route USB event to plugin ${pluginId}:`, error.message);
      }
    });
  }

  /**
   * Start the integration service
   */
  async start() {
    if (!this.state.initialized) {
      throw new Error('Service not initialized');
    }
    
    if (this.state.running) {
      return;
    }
    
    try {
      console.log('Starting AutoWeave Integration Service...');
      
      // Start USB daemon
      await this.usbDaemon.start();
      this.state.components.usbDaemon = 'running';
      
      // Start event bridge processing
      await this.eventBridge.startProcessing();
      this.state.components.eventBridge = 'running';
      
      // Plugin manager is always ready
      this.state.components.pluginManager = 'running';
      
      this.state.running = true;
      this.state.startTime = Date.now();
      
      this.emit('started', {
        serviceId: this.options.serviceId,
        components: this.state.components
      });
      
      console.log('AutoWeave Integration Service started successfully');
      
    } catch (error) {
      console.error('Failed to start integration service:', error);
      this.emit('start-error', error);
      throw error;
    }
  }

  /**
   * Stop the integration service
   */
  async stop() {
    if (!this.state.running) {
      return;
    }
    
    try {
      console.log('Stopping AutoWeave Integration Service...');
      
      // Stop health monitoring
      this.stopHealthMonitoring();
      
      // Stop event bridge
      await this.eventBridge.stopProcessing();
      this.state.components.eventBridge = 'stopped';
      
      // Stop all plugins
      const activePlugins = this.pluginManager.getActivePlugins();
      for (const pluginId of activePlugins) {
        await this.pluginManager.stopPlugin(pluginId, 'service-shutdown');
      }
      this.state.components.pluginManager = 'stopped';
      
      // Stop USB daemon
      await this.usbDaemon.stop();
      this.state.components.usbDaemon = 'stopped';
      
      this.state.running = false;
      
      this.emit('stopped', {
        serviceId: this.options.serviceId,
        uptime: Date.now() - this.state.startTime
      });
      
      console.log('AutoWeave Integration Service stopped successfully');
      
    } catch (error) {
      console.error('Error stopping integration service:', error);
      this.emit('stop-error', error);
      throw error;
    }
  }

  /**
   * Load a plugin
   */
  async loadPlugin(pluginPath) {
    if (!this.state.initialized) {
      throw new Error('Service not initialized');
    }
    
    try {
      // Load plugin through security manager
      const pluginId = await this.pluginManager.loadPlugin(pluginPath);
      
      this.metrics.pluginsLoaded++;
      
      return pluginId;
      
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error.message);
      throw error;
    }
  }

  /**
   * Start a loaded plugin
   */
  async startPlugin(pluginId) {
    if (!this.state.running) {
      throw new Error('Service not running');
    }
    
    try {
      await this.pluginManager.startPlugin(pluginId);
    } catch (error) {
      console.error(`Failed to start plugin ${pluginId}:`, error.message);
      throw error;
    }
  }

  /**
   * Stop a running plugin
   */
  async stopPlugin(pluginId, reason = 'manual') {
    try {
      await this.pluginManager.stopPlugin(pluginId, reason);
    } catch (error) {
      console.error(`Failed to stop plugin ${pluginId}:`, error.message);
      throw error;
    }
  }

  /**
   * Handle plugin loaded event
   */
  handlePluginLoaded(data) {
    const { pluginId, manifest } = data;
    
    // Check if plugin has USB capabilities
    if (manifest.permissions?.usb) {
      console.log(`Plugin ${pluginId} registered for USB events:`, 
        this.usbCapability.generatePermissionSummary(manifest.permissions.usb));
    }
    
    this.emit('plugin-loaded', data);
  }

  /**
   * Handle plugin started event
   */
  handlePluginStarted(data) {
    this.emit('plugin-started', data);
  }

  /**
   * Handle plugin stopped event
   */
  handlePluginStopped(data) {
    this.emit('plugin-stopped', data);
  }

  /**
   * Handle route to plugin request
   */
  async handleRouteToPlugin(data) {
    const { pluginId, payload } = data;
    
    try {
      // Get plugin worker channel
      const channel = this.pluginManager.getPluginChannel(pluginId);
      if (!channel) {
        throw new Error(`No active channel for plugin ${pluginId}`);
      }
      
      // Send USB event to plugin
      await channel.sendMessage({
        type: 'usb-event',
        data: payload
      });
      
    } catch (error) {
      this.emit('routing-error', {
        pluginId,
        error: error.message
      });
    }
  }

  /**
   * Handle security violation
   */
  handleSecurityViolation(data) {
    this.metrics.errors++;
    
    this.emit('security-violation', data);
    
    // Log violation
    console.error('Security violation:', data);
  }

  /**
   * Handle component error
   */
  handleComponentError(component, error) {
    this.metrics.errors++;
    
    this.emit('component-error', {
      component,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    // Log error
    console.error(`Error in ${component}:`, error);
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthChecker = setInterval(() => {
      this.checkHealth();
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthChecker) {
      clearInterval(this.healthChecker);
      this.healthChecker = null;
    }
  }

  /**
   * Check service health
   */
  async checkHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: this.state.running ? Date.now() - this.state.startTime : 0,
      components: {},
      metrics: this.metrics
    };
    
    // Check USB daemon
    if (this.state.components.usbDaemon === 'running') {
      health.components.usbDaemon = {
        status: 'healthy',
        connectedDevices: this.usbDaemon.getConnectedDevices().length
      };
    } else {
      health.components.usbDaemon = { status: 'stopped' };
      health.status = 'degraded';
    }
    
    // Check plugin manager
    if (this.state.components.pluginManager === 'running') {
      const securityStatus = this.pluginManager.getSecurityStatus();
      health.components.pluginManager = {
        status: securityStatus.locked ? 'locked' : 'healthy',
        activePlugins: securityStatus.plugins.active,
        totalPlugins: securityStatus.plugins.total
      };
      
      if (securityStatus.locked) {
        health.status = 'unhealthy';
      }
    } else {
      health.components.pluginManager = { status: 'stopped' };
      health.status = 'degraded';
    }
    
    // Check event bridge
    if (this.state.components.eventBridge === 'running') {
      const bridgeStats = this.eventBridge.getStats();
      health.components.eventBridge = {
        status: 'healthy',
        eventsProcessed: bridgeStats.eventsReceived,
        registeredPlugins: bridgeStats.registeredPlugins
      };
    } else {
      health.components.eventBridge = { status: 'stopped' };
      health.status = 'degraded';
    }
    
    this.emit('health-check', health);
    
    return health;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.options.serviceId,
      state: this.state,
      metrics: this.metrics,
      components: {
        usbDaemon: this.state.components.usbDaemon,
        pluginManager: this.state.components.pluginManager,
        eventBridge: this.state.components.eventBridge
      }
    };
  }

  /**
   * Generate comprehensive report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      service: {
        id: this.options.serviceId,
        name: this.options.serviceName,
        version: '1.0.0',
        status: this.getStatus()
      },
      health: await this.checkHealth(),
      components: {}
    };
    
    // Add component reports
    if (this.pluginManager) {
      report.components.pluginManager = this.pluginManager.generateSecurityReport();
    }
    
    if (this.eventBridge) {
      report.components.eventBridge = this.eventBridge.generateReport();
    }
    
    return report;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Stop service
      await this.stop();
      
      // Cleanup components
      if (this.eventBridge) {
        await this.eventBridge.cleanup();
      }
      
      if (this.pluginManager) {
        await this.pluginManager.cleanup();
      }
      
      // Clear references
      this.usbDaemon = null;
      this.usbPublisher = null;
      this.pluginManager = null;
      this.eventBridge = null;
      this.usbCapability = null;
      
      this.emit('cleanup-complete');
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.emit('cleanup-error', error);
    }
  }
}

module.exports = AutoWeaveIntegrationService;