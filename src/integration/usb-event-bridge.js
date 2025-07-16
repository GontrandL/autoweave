/**
 * USB Event Bridge
 * Connects USB daemon events to plugin system via Redis Streams
 * Implements permission checking and event routing
 */

const EventEmitter = require('events');
const Redis = require('ioredis');
const crypto = require('crypto');

/**
 * USB Event Bridge - Routes USB events to authorized plugins
 */
class USBEventBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      redis: {
        host: options.redis?.host || 'localhost',
        port: options.redis?.port || 6379,
        password: options.redis?.password,
        db: options.redis?.db || 0
      },
      streamName: options.streamName || 'aw:hotplug',
      consumerGroup: options.consumerGroup || 'plugin-loader',
      consumerName: options.consumerName || `bridge-${process.pid}`,
      batchSize: options.batchSize || 10,
      blockTimeout: options.blockTimeout || 1000,
      ...options
    };
    
    // Redis clients
    this.redis = null;
    this.subscriber = null;
    
    // Plugin registry for USB events
    this.usbPlugins = new Map();
    
    // Event processing state
    this.isProcessing = false;
    this.processingStats = {
      eventsReceived: 0,
      eventsRouted: 0,
      eventsFiltered: 0,
      errors: 0,
      startTime: Date.now()
    };
    
    // Permission cache
    this.permissionCache = new Map();
  }

  /**
   * Initialize the event bridge
   */
  async initialize() {
    try {
      // Create Redis connections
      this.redis = new Redis(this.options.redis);
      this.subscriber = new Redis(this.options.redis);
      
      // Create consumer group
      await this.createConsumerGroup();
      
      // Setup error handlers
      this.redis.on('error', (err) => this.handleRedisError(err, 'main'));
      this.subscriber.on('error', (err) => this.handleRedisError(err, 'subscriber'));
      
      this.emit('initialized', {
        streamName: this.options.streamName,
        consumerGroup: this.options.consumerGroup,
        consumerName: this.options.consumerName
      });
      
    } catch (error) {
      this.emit('initialization-error', error);
      throw error;
    }
  }

  /**
   * Create Redis consumer group
   */
  async createConsumerGroup() {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.options.streamName,
        this.options.consumerGroup,
        '$',
        'MKSTREAM'
      );
    } catch (error) {
      // Group might already exist
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  /**
   * Register a plugin for USB events
   */
  registerPlugin(pluginId, manifest) {
    if (!manifest.permissions?.usb) {
      return false;
    }
    
    const usbPermissions = manifest.permissions.usb;
    const registration = {
      pluginId,
      manifest,
      permissions: usbPermissions,
      handlers: manifest.hooks || {},
      registeredAt: Date.now(),
      stats: {
        eventsReceived: 0,
        lastEventAt: null
      }
    };
    
    this.usbPlugins.set(pluginId, registration);
    
    // Clear permission cache for this plugin
    this.permissionCache.delete(pluginId);
    
    this.emit('plugin-registered', {
      pluginId,
      usbPermissions
    });
    
    return true;
  }

  /**
   * Unregister a plugin from USB events
   */
  unregisterPlugin(pluginId) {
    const wasRegistered = this.usbPlugins.delete(pluginId);
    
    if (wasRegistered) {
      this.permissionCache.delete(pluginId);
      
      this.emit('plugin-unregistered', {
        pluginId
      });
    }
    
    return wasRegistered;
  }

  /**
   * Start processing USB events
   */
  async startProcessing() {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    // Start the event processing loop
    this.processEventLoop();
    
    this.emit('processing-started');
  }

  /**
   * Stop processing USB events
   */
  async stopProcessing() {
    this.isProcessing = false;
    
    this.emit('processing-stopped', {
      stats: this.getStats()
    });
  }

  /**
   * Main event processing loop
   */
  async processEventLoop() {
    while (this.isProcessing) {
      try {
        // Read events from Redis stream
        const results = await this.redis.xreadgroup(
          'GROUP',
          this.options.consumerGroup,
          this.options.consumerName,
          'COUNT',
          this.options.batchSize,
          'BLOCK',
          this.options.blockTimeout,
          'STREAMS',
          this.options.streamName,
          '>'
        );
        
        if (results && results.length > 0) {
          const [streamName, messages] = results[0];
          
          for (const [messageId, fields] of messages) {
            try {
              await this.processUSBEvent(messageId, fields);
              
              // Acknowledge message
              await this.redis.xack(
                this.options.streamName,
                this.options.consumerGroup,
                messageId
              );
            } catch (error) {
              this.handleEventError(error, messageId, fields);
            }
          }
        }
      } catch (error) {
        if (this.isProcessing) {
          this.emit('processing-error', error);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  /**
   * Process a single USB event
   */
  async processUSBEvent(messageId, fields) {
    // Parse event data
    const event = this.parseUSBEvent(messageId, fields);
    
    this.processingStats.eventsReceived++;
    
    // Find matching plugins
    const matchingPlugins = this.findMatchingPlugins(event);
    
    if (matchingPlugins.length === 0) {
      this.processingStats.eventsFiltered++;
      return;
    }
    
    // Route event to each matching plugin
    for (const plugin of matchingPlugins) {
      try {
        await this.routeEventToPlugin(event, plugin);
        this.processingStats.eventsRouted++;
      } catch (error) {
        this.emit('routing-error', {
          event,
          pluginId: plugin.pluginId,
          error: error.message
        });
      }
    }
    
    this.emit('event-processed', {
      messageId,
      event,
      routedTo: matchingPlugins.map(p => p.pluginId)
    });
  }

  /**
   * Parse USB event from Redis fields
   */
  parseUSBEvent(messageId, fields) {
    const fieldObj = {};
    for (let i = 0; i < fields.length; i += 2) {
      fieldObj[fields[i]] = fields[i + 1];
    }
    
    return {
      messageId,
      source: fieldObj.source || 'unknown',
      action: fieldObj.action || 'unknown',
      vendorId: parseInt(fieldObj.vendor_id, 16),
      productId: parseInt(fieldObj.product_id, 16),
      deviceSignature: fieldObj.device_signature,
      manufacturer: fieldObj.manufacturer,
      product: fieldObj.product,
      serialNumber: fieldObj.serial_number,
      busNumber: parseInt(fieldObj.bus_number),
      deviceAddress: parseInt(fieldObj.device_address),
      portPath: fieldObj.port_path,
      timestamp: parseInt(fieldObj.timestamp),
      deviceDescriptor: fieldObj.device_descriptor ? 
        JSON.parse(fieldObj.device_descriptor) : null
    };
  }

  /**
   * Find plugins that match the USB event
   */
  findMatchingPlugins(event) {
    const matching = [];
    
    for (const [pluginId, registration] of this.usbPlugins) {
      if (this.checkPluginPermission(registration, event)) {
        matching.push(registration);
      }
    }
    
    return matching;
  }

  /**
   * Check if plugin has permission for this USB event
   */
  checkPluginPermission(registration, event) {
    const permissions = registration.permissions;
    
    // Check vendor ID filter
    if (permissions.vendor_ids && permissions.vendor_ids.length > 0) {
      const vendorHex = `0x${event.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
      if (!permissions.vendor_ids.includes(vendorHex)) {
        return false;
      }
    }
    
    // Check product ID filter
    if (permissions.product_ids && permissions.product_ids.length > 0) {
      const productHex = `0x${event.productId.toString(16).toUpperCase().padStart(4, '0')}`;
      if (!permissions.product_ids.includes(productHex)) {
        return false;
      }
    }
    
    // Check device class filter
    if (permissions.device_classes && event.deviceDescriptor) {
      const deviceClass = event.deviceDescriptor.bDeviceClass;
      if (!permissions.device_classes.includes(deviceClass)) {
        return false;
      }
    }
    
    // Check custom filter function
    if (permissions.filter && typeof permissions.filter === 'object') {
      // Apply additional filters
      for (const [key, value] of Object.entries(permissions.filter)) {
        if (event[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Route USB event to plugin
   */
  async routeEventToPlugin(event, registration) {
    const { pluginId, handlers } = registration;
    
    // Update plugin stats
    registration.stats.eventsReceived++;
    registration.stats.lastEventAt = Date.now();
    
    // Determine handler based on event action
    let handlerName;
    if (event.action === 'attach' && handlers.onUSBAttach) {
      handlerName = handlers.onUSBAttach;
    } else if (event.action === 'detach' && handlers.onUSBDetach) {
      handlerName = handlers.onUSBDetach;
    } else {
      // No handler for this event type
      return;
    }
    
    // Create event payload for plugin
    const payload = {
      type: 'usb-event',
      handler: handlerName,
      event: {
        action: event.action,
        device: {
          vendorId: event.vendorId,
          productId: event.productId,
          manufacturer: event.manufacturer,
          product: event.product,
          serialNumber: event.serialNumber,
          signature: event.deviceSignature,
          location: {
            busNumber: event.busNumber,
            deviceAddress: event.deviceAddress,
            portPath: event.portPath
          }
        },
        timestamp: event.timestamp
      }
    };
    
    // Emit event for plugin system to handle
    this.emit('route-to-plugin', {
      pluginId,
      payload
    });
    
    // Also publish to plugin-specific Redis channel if needed
    if (this.options.publishToChannels) {
      await this.redis.publish(
        `plugin:${pluginId}:usb`,
        JSON.stringify(payload)
      );
    }
  }

  /**
   * Handle Redis errors
   */
  handleRedisError(error, client) {
    this.emit('redis-error', {
      client,
      error: error.message
    });
    
    this.processingStats.errors++;
  }

  /**
   * Handle event processing errors
   */
  handleEventError(error, messageId, fields) {
    this.processingStats.errors++;
    
    this.emit('event-error', {
      messageId,
      error: error.message,
      fields
    });
    
    // Could implement DLQ here
  }

  /**
   * Get bridge statistics
   */
  getStats() {
    const uptime = Date.now() - this.processingStats.startTime;
    const eventsPerSecond = this.processingStats.eventsReceived / (uptime / 1000);
    
    return {
      ...this.processingStats,
      uptime,
      eventsPerSecond: eventsPerSecond.toFixed(2),
      registeredPlugins: this.usbPlugins.size,
      pluginStats: Array.from(this.usbPlugins.entries()).map(([id, reg]) => ({
        pluginId: id,
        eventsReceived: reg.stats.eventsReceived,
        lastEventAt: reg.stats.lastEventAt
      }))
    };
  }

  /**
   * Generate bridge report
   */
  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      status: this.isProcessing ? 'processing' : 'stopped',
      configuration: {
        streamName: this.options.streamName,
        consumerGroup: this.options.consumerGroup,
        batchSize: this.options.batchSize
      },
      statistics: this.getStats(),
      plugins: Array.from(this.usbPlugins.entries()).map(([id, reg]) => ({
        pluginId: id,
        permissions: reg.permissions,
        handlers: Object.keys(reg.handlers),
        stats: reg.stats
      }))
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Stop processing
    await this.stopProcessing();
    
    // Close Redis connections
    if (this.redis) {
      await this.redis.quit();
    }
    
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    
    // Clear registrations
    this.usbPlugins.clear();
    this.permissionCache.clear();
    
    this.emit('cleanup-complete');
  }
}

module.exports = USBEventBridge;