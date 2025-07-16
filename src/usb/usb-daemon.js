/**
 * USB Daemon Implementation
 * Based on the USB_DAEMON_SPEC.md specification
 */

const EventEmitter = require('events');
const usb = require('usb');
const crypto = require('crypto');

/**
 * USB Device Information interface
 */
class USBDeviceInfo {
  constructor(device) {
    this.vendorId = device.deviceDescriptor.idVendor;
    this.productId = device.deviceDescriptor.idProduct;
    this.deviceDescriptor = device.deviceDescriptor;
    this.serialNumber = null;
    this.manufacturer = null;
    this.product = null;
    this.location = {
      busNumber: device.busNumber,
      deviceAddress: device.deviceAddress,
      portPath: device.portNumbers ? device.portNumbers.join('.') : '0'
    };
    this.timestamp = Date.now();
    this.signature = '';
  }
}

/**
 * USB Daemon - Monitors USB device attach/detach events
 */
class USBDaemon extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      monitoring: {
        enabled: config.monitoring?.enabled !== false,
        interval: config.monitoring?.interval || 5000,
        healthcheck_port: config.monitoring?.healthcheck_port || 8080
      },
      filters: {
        vendor_whitelist: config.filters?.vendor_whitelist || [],
        vendor_blacklist: config.filters?.vendor_blacklist || [],
        device_class_filter: config.filters?.device_class_filter || []
      },
      performance: {
        max_events_per_second: config.performance?.max_events_per_second || 100,
        debounce_ms: config.performance?.debounce_ms || 50,
        batch_size: config.performance?.batch_size || 10
      },
      fallback: {
        enable_udev: config.fallback?.enable_udev || process.platform === 'linux',
        udev_script_path: config.fallback?.udev_script_path || '/usr/local/bin/autoweave-udev-notify'
      },
      ...config
    };
    
    this.isRunning = false;
    this.connectedDevices = new Map();
    this.eventQueue = [];
    this.lastEventTime = 0;
    this.eventCount = 0;
    this.debounceTimers = new Map();
  }

  /**
   * Setup USB event handlers
   */
  setupUSBEventHandlers() {
    // Primary: node-usb events
    usb.on('attach', this.handleDeviceAttach.bind(this));
    usb.on('detach', this.handleDeviceDetach.bind(this));
    
    // Error handling
    usb.on('error', this.handleUSBError.bind(this));
  }

  /**
   * Handle device attachment
   */
  async handleDeviceAttach(device) {
    try {
      // Apply debouncing
      const deviceKey = `${device.busNumber}:${device.deviceAddress}`;
      if (this.debounceTimers.has(deviceKey)) {
        clearTimeout(this.debounceTimers.get(deviceKey));
      }
      
      this.debounceTimers.set(deviceKey, setTimeout(async () => {
        this.debounceTimers.delete(deviceKey);
        
        // Extract device info
        const deviceInfo = await this.extractDeviceInfo(device);
        
        // Apply filters
        if (!this.shouldProcessDevice(deviceInfo)) {
          return;
        }
        
        // Generate signature
        const signature = this.generateDeviceSignature(deviceInfo);
        
        // Prevent duplicate events
        if (this.connectedDevices.has(signature)) {
          return;
        }
        
        deviceInfo.signature = signature;
        this.connectedDevices.set(signature, deviceInfo);
        
        // Apply rate limiting
        if (!this.checkRateLimit()) {
          this.eventQueue.push({ type: 'attach', deviceInfo });
          return;
        }
        
        // Emit events
        this.emit('device:attach', deviceInfo);
        
        console.log(
          `USB Device attached: ${deviceInfo.manufacturer} ${deviceInfo.product} ` +
          `(${deviceInfo.vendorId.toString(16)}:${deviceInfo.productId.toString(16)})`
        );
      }, this.config.performance.debounce_ms));
      
    } catch (error) {
      this.handleUSBError(error, 'attach');
    }
  }

  /**
   * Handle device detachment
   */
  async handleDeviceDetach(device) {
    try {
      const tempInfo = await this.extractDeviceInfo(device);
      const signature = this.generateDeviceSignature(tempInfo);
      
      const deviceInfo = this.connectedDevices.get(signature);
      if (!deviceInfo) {
        return; // Device was not tracked
      }
      
      this.connectedDevices.delete(signature);
      
      // Apply rate limiting
      if (!this.checkRateLimit()) {
        this.eventQueue.push({ type: 'detach', deviceInfo });
        return;
      }
      
      // Emit events
      this.emit('device:detach', deviceInfo);
      
      console.log(
        `USB Device detached: ${deviceInfo.manufacturer} ${deviceInfo.product}`
      );
      
    } catch (error) {
      this.handleUSBError(error, 'detach');
    }
  }

  /**
   * Extract device information
   */
  async extractDeviceInfo(device) {
    return new Promise((resolve, reject) => {
      try {
        const deviceInfo = new USBDeviceInfo(device);
        
        // Safely try to open device
        let deviceOpened = false;
        try {
          device.open();
          deviceOpened = true;
        } catch (openError) {
          // Device might be in use or require permissions
          console.warn(`Could not open device: ${openError.message}`);
          resolve(deviceInfo);
          return;
        }
        
        // Async string descriptors
        let pending = 0;
        
        const tryGetDescriptor = (index, field, callback) => {
          if (index) {
            pending++;
            device.getStringDescriptor(index, (error, data) => {
              if (!error && data) {
                deviceInfo[field] = data.toString();
              }
              if (--pending === 0) callback();
            });
          }
        };
        
        const finalize = () => {
          try {
            if (deviceOpened) {
              device.close();
            }
            resolve(deviceInfo);
          } catch (closeError) {
            // Device might be detached already
            resolve(deviceInfo);
          }
        };
        
        // Get string descriptors
        tryGetDescriptor(
          device.deviceDescriptor.iManufacturer,
          'manufacturer',
          finalize
        );
        
        tryGetDescriptor(
          device.deviceDescriptor.iProduct,
          'product',
          finalize
        );
        
        tryGetDescriptor(
          device.deviceDescriptor.iSerialNumber,
          'serialNumber',
          finalize
        );
        
        if (pending === 0) {
          finalize();
        }
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate device signature
   */
  generateDeviceSignature(deviceInfo) {
    const data = `${deviceInfo.vendorId}:${deviceInfo.productId}:${deviceInfo.location.busNumber}:${deviceInfo.location.deviceAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Check if device should be processed based on filters
   */
  shouldProcessDevice(deviceInfo) {
    const { filters } = this.config;
    
    // Check vendor whitelist
    if (filters.vendor_whitelist.length > 0) {
      if (!filters.vendor_whitelist.includes(deviceInfo.vendorId)) {
        return false;
      }
    }
    
    // Check vendor blacklist
    if (filters.vendor_blacklist.includes(deviceInfo.vendorId)) {
      return false;
    }
    
    // Check device class filter
    if (filters.device_class_filter.length > 0) {
      const deviceClass = deviceInfo.deviceDescriptor.bDeviceClass;
      if (!filters.device_class_filter.includes(deviceClass)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now();
    const timeDiff = now - this.lastEventTime;
    
    if (timeDiff < 1000) {
      this.eventCount++;
      if (this.eventCount > this.config.performance.max_events_per_second) {
        return false;
      }
    } else {
      this.eventCount = 1;
      this.lastEventTime = now;
    }
    
    return true;
  }

  /**
   * Process queued events
   */
  processEventQueue() {
    if (this.eventQueue.length === 0) return;
    
    const batch = this.eventQueue.splice(0, this.config.performance.batch_size);
    
    for (const event of batch) {
      if (event.type === 'attach') {
        this.emit('device:attach', event.deviceInfo);
      } else if (event.type === 'detach') {
        this.emit('device:detach', event.deviceInfo);
      }
    }
  }

  /**
   * Handle USB errors
   */
  handleUSBError(error, context = '') {
    console.error(`USB Error [${context}]:`, error.message);
    
    this.emit('error', {
      context,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Scan existing devices
   */
  async scanExistingDevices() {
    const devices = usb.getDeviceList();
    
    for (const device of devices) {
      try {
        await this.handleDeviceAttach(device);
      } catch (error) {
        console.warn('Failed to process existing device:', error);
      }
    }
  }

  /**
   * Start the USB daemon
   */
  async start() {
    if (this.isRunning) return;
    
    try {
      // Setup event handlers
      this.setupUSBEventHandlers();
      
      // Scan existing devices
      await this.scanExistingDevices();
      
      // Start queue processor
      this.queueProcessor = setInterval(() => {
        this.processEventQueue();
      }, 100);
      
      this.isRunning = true;
      
      console.log('USB Daemon started successfully');
      
      this.emit('started', {
        timestamp: new Date().toISOString(),
        config: this.config
      });
      
    } catch (error) {
      console.error('Failed to start USB daemon:', error);
      throw error;
    }
  }

  /**
   * Stop the USB daemon
   */
  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    // Clear timers
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }
    
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Clear device tracking
    this.connectedDevices.clear();
    this.eventQueue = [];
    
    // Cleanup node-usb
    usb.removeAllListeners();
    
    console.log('USB Daemon stopped');
    
    this.emit('stopped', {
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connected devices
   */
  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
  }

  /**
   * Get daemon status
   */
  getStatus() {
    return {
      running: this.isRunning,
      connectedDevices: this.connectedDevices.size,
      queuedEvents: this.eventQueue.length,
      filters: this.config.filters,
      performance: {
        eventsPerSecond: this.eventCount,
        maxEventsPerSecond: this.config.performance.max_events_per_second
      }
    };
  }
}

module.exports = USBDaemon;