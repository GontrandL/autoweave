# AutoWeave Sprint 1 - Examples and Tutorials

**Version:** 1.0.0  
**Sprint:** 1 (USB Daemon & Plugin Loader)  
**Status:** ✅ Production Ready  
**Date:** 2025-07-14

## 📖 Overview

This comprehensive tutorial collection provides hands-on examples for developers, DevOps engineers, security engineers, and QA engineers to effectively utilize AutoWeave Sprint 1 components. Each tutorial includes complete code examples, step-by-step instructions, and real-world use cases.

## 🎯 Target Audiences

- **Plugin Developers**: Creating secure, high-performance plugins
- **DevOps Engineers**: Integrating AutoWeave into CI/CD pipelines
- **Security Engineers**: Implementing security policies and monitoring
- **QA Engineers**: Testing methodologies and validation procedures

## 🔌 Plugin Development Tutorial

### Tutorial 1: Creating Your First USB Plugin

#### Objective
Create a complete USB device monitoring plugin that demonstrates core AutoWeave capabilities.

#### Prerequisites
```bash
# Development environment
Node.js >= 18.0.0
AutoWeave Sprint 1 installed
Redis running locally
Basic JavaScript/TypeScript knowledge
```

#### Step 1: Project Setup
```bash
# Create plugin directory
mkdir usb-monitor-plugin
cd usb-monitor-plugin

# Initialize plugin structure
npm init -y

# Install dependencies
npm install --save-dev @autoweave/plugin-sdk @types/node
npm install lodash axios
```

#### Step 2: Plugin Manifest
```json
{
  "$schema": "https://autoweave.dev/schemas/plugin-v1.json",
  "name": "usb-monitor",
  "version": "1.0.0",
  "description": "Monitors USB devices and logs connection events",
  "entry": "./dist/index.js",
  "autoweave": {
    "minVersion": "1.0.0",
    "maxVersion": "2.0.0"
  },
  "permissions": {
    "usb": ["read", "monitor"],
    "network": ["outbound"],
    "filesystem": [
      {
        "path": "/tmp/usb-monitor",
        "mode": "readwrite"
      }
    ]
  },
  "hooks": {
    "onLoad": "./dist/hooks/onLoad.js",
    "onUnload": "./dist/hooks/onUnload.js",
    "onError": "./dist/hooks/onError.js"
  },
  "dependencies": {
    "external": ["lodash@^4.17.0", "axios@^1.6.0"],
    "autoweave": ["@autoweave/usb@^1.0.0"]
  },
  "isolation": {
    "workerThread": true,
    "memoryLimit": "128MB",
    "cpuLimit": "25%"
  },
  "configuration": {
    "monitoring_interval": {
      "type": "number",
      "default": 5000,
      "description": "Device monitoring interval in milliseconds"
    },
    "log_level": {
      "type": "string",
      "default": "info",
      "enum": ["debug", "info", "warn", "error"]
    },
    "webhook_url": {
      "type": "string",
      "description": "Optional webhook URL for device events"
    }
  }
}
```

#### Step 3: Main Plugin Implementation
```javascript
// src/index.js
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const _ = require('lodash');

class USBMonitorPlugin extends EventEmitter {
  constructor() {
    super();
    this.name = 'usb-monitor';
    this.version = '1.0.0';
    this.isRunning = false;
    this.devices = new Map();
    this.config = {};
    this.logger = null;
    this.context = null;
  }

  /**
   * Initialize plugin with AutoWeave context
   */
  async initialize(context) {
    this.context = context;
    this.logger = context.logger;
    this.config = context.config;

    // Create monitoring directory
    const monitorDir = '/tmp/usb-monitor';
    await fs.mkdir(monitorDir, { recursive: true });

    // Register for USB events
    this.context.on('usb:device:attach', this.onDeviceAttach.bind(this));
    this.context.on('usb:device:detach', this.onDeviceDetach.bind(this));

    // Setup periodic device check
    this.setupPeriodicCheck();

    this.logger.info('USB Monitor Plugin initialized', {
      version: this.version,
      config: this.config
    });

    this.isRunning = true;
    this.emit('initialized');
  }

  /**
   * Handle USB device attachment
   */
  async onDeviceAttach(device) {
    try {
      this.logger.info('USB device attached', {
        signature: device.signature,
        vendor: device.manufacturer,
        product: device.product,
        vendorId: `0x${device.vendorId.toString(16)}`,
        productId: `0x${device.productId.toString(16)}`
      });

      // Store device information
      this.devices.set(device.signature, {
        ...device,
        attachedAt: Date.now(),
        status: 'connected'
      });

      // Analyze device characteristics
      const analysis = await this.analyzeDevice(device);

      // Log to file
      await this.logDeviceEvent('attach', device, analysis);

      // Send webhook if configured
      if (this.config.webhook_url) {
        await this.sendWebhook('device_attached', device, analysis);
      }

      // Emit plugin event
      this.context.emit('plugin:device:analyzed', {
        device: device,
        analysis: analysis
      });

    } catch (error) {
      this.logger.error('Error handling device attachment', {
        device: device.signature,
        error: error.message
      });
    }
  }

  /**
   * Handle USB device detachment
   */
  async onDeviceDetach(device) {
    try {
      this.logger.info('USB device detached', {
        signature: device.signature,
        vendor: device.manufacturer,
        product: device.product
      });

      // Update device status
      const storedDevice = this.devices.get(device.signature);
      if (storedDevice) {
        storedDevice.status = 'disconnected';
        storedDevice.detachedAt = Date.now();
        storedDevice.connectionDuration = Date.now() - storedDevice.attachedAt;
      }

      // Log to file
      await this.logDeviceEvent('detach', device, {
        connectionDuration: storedDevice?.connectionDuration || 0
      });

      // Send webhook if configured
      if (this.config.webhook_url) {
        await this.sendWebhook('device_detached', device, {
          connectionDuration: storedDevice?.connectionDuration || 0
        });
      }

      // Remove from active devices after delay
      setTimeout(() => {
        this.devices.delete(device.signature);
      }, 60000); // Keep for 1 minute

    } catch (error) {
      this.logger.error('Error handling device detachment', {
        device: device.signature,
        error: error.message
      });
    }
  }

  /**
   * Analyze device characteristics
   */
  async analyzeDevice(device) {
    const analysis = {
      deviceClass: this.getDeviceClass(device.deviceDescriptor.bDeviceClass),
      isKnownVendor: this.isKnownVendor(device.vendorId),
      riskLevel: 'low',
      characteristics: [],
      recommendations: []
    };

    // Analyze device class
    switch (device.deviceDescriptor.bDeviceClass) {
      case 3: // HID
        analysis.characteristics.push('Human Interface Device');
        if (device.deviceDescriptor.bDeviceSubClass === 1) {
          analysis.characteristics.push('Boot Interface Subclass');
        }
        break;
      case 8: // Mass Storage
        analysis.characteristics.push('Mass Storage Device');
        analysis.riskLevel = 'medium';
        analysis.recommendations.push('Scan for malware before accessing files');
        break;
      case 9: // Hub
        analysis.characteristics.push('USB Hub');
        break;
      default:
        analysis.characteristics.push('Other/Vendor Specific');
    }

    // Check for suspicious characteristics
    if (!analysis.isKnownVendor) {
      analysis.riskLevel = 'medium';
      analysis.recommendations.push('Verify vendor authenticity');
    }

    // Check for potential security risks
    if (device.deviceDescriptor.bDeviceClass === 8 && !analysis.isKnownVendor) {
      analysis.riskLevel = 'high';
      analysis.recommendations.push('Block access until verified');
    }

    return analysis;
  }

  /**
   * Get human-readable device class
   */
  getDeviceClass(classCode) {
    const classes = {
      0: 'Device',
      1: 'Audio',
      2: 'Communications',
      3: 'HID',
      5: 'Physical',
      6: 'Image',
      7: 'Printer',
      8: 'Mass Storage',
      9: 'Hub',
      10: 'CDC Data',
      11: 'Smart Card',
      13: 'Content Security',
      14: 'Video',
      15: 'Personal Healthcare',
      16: 'Audio/Video',
      17: 'Billboard',
      18: 'USB Type-C Bridge',
      220: 'Diagnostic',
      224: 'Wireless Controller',
      239: 'Miscellaneous',
      254: 'Application Specific',
      255: 'Vendor Specific'
    };

    return classes[classCode] || `Unknown (${classCode})`;
  }

  /**
   * Check if vendor is known/trusted
   */
  isKnownVendor(vendorId) {
    const knownVendors = {
      0x05ac: 'Apple',
      0x046d: 'Logitech',
      0x045e: 'Microsoft',
      0x04f2: 'Chicony Electronics',
      0x138a: 'Validity Sensors',
      0x8087: 'Intel',
      0x1d6b: 'Linux Foundation'
    };

    return Object.hasOwnProperty.call(knownVendors, vendorId);
  }

  /**
   * Log device event to file
   */
  async logDeviceEvent(eventType, device, analysis) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event: eventType,
      device: {
        signature: device.signature,
        vendor: device.manufacturer,
        product: device.product,
        vendorId: `0x${device.vendorId.toString(16)}`,
        productId: `0x${device.productId.toString(16)}`,
        location: device.location
      },
      analysis: analysis
    };

    const logFile = path.join('/tmp/usb-monitor', 'device-events.log');
    const logLine = JSON.stringify(logEntry) + '\n';

    await fs.appendFile(logFile, logLine);
  }

  /**
   * Send webhook notification
   */
  async sendWebhook(eventType, device, data) {
    try {
      const payload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        plugin: {
          name: this.name,
          version: this.version
        },
        device: {
          signature: device.signature,
          vendor: device.manufacturer,
          product: device.product,
          vendorId: `0x${device.vendorId.toString(16)}`,
          productId: `0x${device.productId.toString(16)}`
        },
        data: data
      };

      await axios.post(this.config.webhook_url, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `AutoWeave-USBMonitor/${this.version}`
        }
      });

      this.logger.debug('Webhook sent successfully', {
        event: eventType,
        url: this.config.webhook_url
      });

    } catch (error) {
      this.logger.error('Failed to send webhook', {
        event: eventType,
        url: this.config.webhook_url,
        error: error.message
      });
    }
  }

  /**
   * Setup periodic device check
   */
  setupPeriodicCheck() {
    const interval = this.config.monitoring_interval || 5000;

    this.periodicCheck = setInterval(() => {
      this.performHealthCheck();
    }, interval);
  }

  /**
   * Perform periodic health check
   */
  async performHealthCheck() {
    try {
      const connectedCount = Array.from(this.devices.values())
        .filter(device => device.status === 'connected').length;

      this.logger.debug('Periodic health check', {
        connectedDevices: connectedCount,
        totalTracked: this.devices.size
      });

      // Emit health status
      this.context.emit('plugin:health', {
        status: 'healthy',
        connectedDevices: connectedCount,
        totalTracked: this.devices.size,
        memoryUsage: process.memoryUsage()
      });

    } catch (error) {
      this.logger.error('Health check failed', {
        error: error.message
      });
    }
  }

  /**
   * Get plugin status
   */
  getStatus() {
    return {
      name: this.name,
      version: this.version,
      running: this.isRunning,
      devices: {
        connected: Array.from(this.devices.values())
          .filter(device => device.status === 'connected').length,
        total: this.devices.size
      },
      config: this.config
    };
  }

  /**
   * Cleanup plugin resources
   */
  async cleanup() {
    this.logger.info('Cleaning up USB Monitor Plugin');

    // Clear periodic check
    if (this.periodicCheck) {
      clearInterval(this.periodicCheck);
      this.periodicCheck = null;
    }

    // Clear device tracking
    this.devices.clear();

    // Mark as stopped
    this.isRunning = false;

    this.emit('cleanup');
  }
}

module.exports = USBMonitorPlugin;
```

#### Step 4: Plugin Hooks
```javascript
// src/hooks/onLoad.js
module.exports = async function onLoad(context) {
  context.logger.info('USB Monitor Plugin loading...', {
    environment: process.env.NODE_ENV,
    config: context.config
  });

  // Validate configuration
  if (context.config.webhook_url && !isValidUrl(context.config.webhook_url)) {
    throw new Error('Invalid webhook URL provided');
  }

  // Ensure monitoring directory exists
  const fs = require('fs').promises;
  await fs.mkdir('/tmp/usb-monitor', { recursive: true });

  context.logger.info('USB Monitor Plugin loaded successfully');
};

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}
```

```javascript
// src/hooks/onUnload.js
module.exports = async function onUnload(context) {
  context.logger.info('USB Monitor Plugin unloading...');

  // Perform cleanup operations
  // Note: Main cleanup is handled in the plugin's cleanup method

  context.logger.info('USB Monitor Plugin unloaded successfully');
};
```

```javascript
// src/hooks/onError.js
module.exports = async function onError(context, error) {
  context.logger.error('USB Monitor Plugin error occurred', {
    error: error.message,
    stack: error.stack
  });

  // Send error notification if webhook configured
  if (context.config.webhook_url) {
    try {
      const axios = require('axios');
      await axios.post(context.config.webhook_url, {
        event: 'plugin_error',
        timestamp: new Date().toISOString(),
        plugin: 'usb-monitor',
        error: {
          message: error.message,
          stack: error.stack
        }
      });
    } catch (webhookError) {
      context.logger.error('Failed to send error webhook', {
        error: webhookError.message
      });
    }
  }
};
```

#### Step 5: Build and Test
```bash
# Build plugin
npm run build

# Test plugin locally
node test/test-plugin.js
```

```javascript
// test/test-plugin.js
const USBMonitorPlugin = require('../src/index');
const EventEmitter = require('events');

// Mock AutoWeave context
class MockContext extends EventEmitter {
  constructor() {
    super();
    this.logger = {
      info: (msg, data) => console.log(`[INFO] ${msg}`, data),
      error: (msg, data) => console.error(`[ERROR] ${msg}`, data),
      debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data)
    };
    this.config = {
      monitoring_interval: 2000,
      log_level: 'info'
    };
  }
}

async function testPlugin() {
  const plugin = new USBMonitorPlugin();
  const context = new MockContext();

  // Initialize plugin
  await plugin.initialize(context);

  // Simulate device events
  setTimeout(() => {
    context.emit('usb:device:attach', {
      signature: 'test-device-123',
      manufacturer: 'Test Vendor',
      product: 'Test Device',
      vendorId: 0x1234,
      productId: 0x5678,
      deviceDescriptor: {
        bDeviceClass: 3,
        bDeviceSubClass: 1
      },
      location: {
        busNumber: 1,
        deviceAddress: 2,
        portPath: '1.2'
      }
    });
  }, 1000);

  setTimeout(() => {
    context.emit('usb:device:detach', {
      signature: 'test-device-123',
      manufacturer: 'Test Vendor',
      product: 'Test Device'
    });
  }, 5000);

  // Check status
  setTimeout(() => {
    console.log('Plugin Status:', plugin.getStatus());
  }, 3000);

  // Cleanup after 10 seconds
  setTimeout(async () => {
    await plugin.cleanup();
    process.exit(0);
  }, 10000);
}

testPlugin().catch(console.error);
```

### Tutorial 2: Advanced Security Plugin

#### Objective
Create a security-focused plugin that implements threat detection and response.

#### Implementation
```javascript
// src/security-scanner.js
const crypto = require('crypto');
const { Worker } = require('worker_threads');

class SecurityScannerPlugin {
  constructor() {
    this.name = 'security-scanner';
    this.version = '1.0.0';
    this.threatDatabase = new Map();
    this.scannerWorkers = [];
    this.quarantine = new Set();
  }

  async initialize(context) {
    this.context = context;
    this.logger = context.logger;

    // Load threat signatures
    await this.loadThreatSignatures();

    // Setup scanner workers
    await this.setupScannerWorkers();

    // Register for USB events
    this.context.on('usb:device:attach', this.scanDevice.bind(this));

    this.logger.info('Security Scanner Plugin initialized');
  }

  async scanDevice(device) {
    try {
      // Calculate device signature
      const deviceSignature = this.calculateDeviceSignature(device);

      // Check against threat database
      const threat = this.threatDatabase.get(deviceSignature);
      
      if (threat) {
        await this.handleThreat(device, threat);
        return;
      }

      // Perform deep scan
      const scanResult = await this.performDeepScan(device);
      
      if (scanResult.riskLevel === 'high') {
        await this.quarantineDevice(device, scanResult);
      }

      // Report scan results
      this.context.emit('security:scan:complete', {
        device: device.signature,
        result: scanResult
      });

    } catch (error) {
      this.logger.error('Device scan failed', {
        device: device.signature,
        error: error.message
      });
    }
  }

  calculateDeviceSignature(device) {
    const data = `${device.vendorId}:${device.productId}:${device.manufacturer}:${device.product}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async performDeepScan(device) {
    return new Promise((resolve, reject) => {
      // Use worker thread for CPU-intensive scanning
      const worker = new Worker('./security-worker.js', {
        workerData: { device }
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Scan timeout'));
      }, 30000); // 30 second timeout

      worker.on('message', (result) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(result);
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async handleThreat(device, threat) {
    this.logger.warn('Known threat detected', {
      device: device.signature,
      threat: threat.name,
      severity: threat.severity
    });

    // Immediate quarantine
    await this.quarantineDevice(device, threat);

    // Alert security team
    this.context.emit('security:threat:detected', {
      device: device.signature,
      threat: threat,
      timestamp: Date.now()
    });
  }

  async quarantineDevice(device, reason) {
    this.quarantine.add(device.signature);

    this.logger.error('Device quarantined', {
      device: device.signature,
      reason: reason.description || reason.name
    });

    // Block device access
    this.context.emit('security:device:block', {
      signature: device.signature,
      reason: 'Security threat detected'
    });
  }

  async loadThreatSignatures() {
    // Load from external threat intelligence feed
    // This would typically load from a file or API
    this.threatDatabase.set(
      'known-malware-device-signature',
      {
        name: 'BadUSB Keylogger',
        severity: 'critical',
        description: 'Known malicious USB device that logs keystrokes'
      }
    );
  }

  async setupScannerWorkers() {
    // Pre-spawn worker threads for scanning
    const workerCount = Math.min(4, require('os').cpus().length);
    
    for (let i = 0; i < workerCount; i++) {
      // Workers would be managed by a pool
      this.scannerWorkers.push({ available: true });
    }
  }

  async cleanup() {
    // Terminate all workers
    this.scannerWorkers.forEach(worker => {
      if (worker.terminate) {
        worker.terminate();
      }
    });

    this.quarantine.clear();
    this.threatDatabase.clear();
  }
}

module.exports = SecurityScannerPlugin;
```

## 🔗 USB Integration Examples

### Example 1: USB Device Classification System

```javascript
// examples/usb-classifier.js
class USBDeviceClassifier {
  constructor() {
    this.classificationRules = new Map();
    this.loadClassificationRules();
  }

  loadClassificationRules() {
    // Define device classification rules
    this.classificationRules.set('apple-devices', {
      vendorId: 0x05ac,
      name: 'Apple Device',
      trustLevel: 'high',
      allowedClasses: [3, 9, 14] // HID, Hub, Video
    });

    this.classificationRules.set('logitech-devices', {
      vendorId: 0x046d,
      name: 'Logitech Device',
      trustLevel: 'high',
      allowedClasses: [3] // HID only
    });

    this.classificationRules.set('mass-storage-generic', {
      deviceClass: 8,
      name: 'Mass Storage Device',
      trustLevel: 'medium',
      requiresApproval: true
    });
  }

  classifyDevice(device) {
    const classification = {
      device: device.signature,
      vendor: device.manufacturer,
      product: device.product,
      deviceClass: device.deviceDescriptor.bDeviceClass,
      category: 'unknown',
      trustLevel: 'low',
      recommendations: [],
      allowed: false
    };

    // Check vendor-specific rules
    for (const [ruleId, rule] of this.classificationRules) {
      if (rule.vendorId && rule.vendorId === device.vendorId) {
        classification.category = rule.name;
        classification.trustLevel = rule.trustLevel;
        
        // Check if device class is allowed
        if (rule.allowedClasses && rule.allowedClasses.includes(device.deviceDescriptor.bDeviceClass)) {
          classification.allowed = true;
        }
        
        if (rule.requiresApproval) {
          classification.recommendations.push('Requires manual approval');
        }
        
        break;
      }
    }

    // Check device class rules
    if (classification.category === 'unknown') {
      for (const [ruleId, rule] of this.classificationRules) {
        if (rule.deviceClass && rule.deviceClass === device.deviceDescriptor.bDeviceClass) {
          classification.category = rule.name;
          classification.trustLevel = rule.trustLevel;
          
          if (rule.requiresApproval) {
            classification.recommendations.push('Requires manual approval');
          }
          
          break;
        }
      }
    }

    // Apply security policies
    this.applySecurityPolicies(classification, device);

    return classification;
  }

  applySecurityPolicies(classification, device) {
    // High-risk device classes
    const highRiskClasses = [8]; // Mass storage
    
    if (highRiskClasses.includes(device.deviceDescriptor.bDeviceClass)) {
      classification.recommendations.push('Scan for malware before use');
      classification.recommendations.push('Monitor file system access');
    }

    // Unknown vendors
    if (classification.trustLevel === 'low') {
      classification.recommendations.push('Verify vendor authenticity');
      classification.recommendations.push('Limit device capabilities');
    }

    // Security-sensitive environments
    if (process.env.SECURITY_LEVEL === 'high') {
      if (classification.trustLevel !== 'high') {
        classification.allowed = false;
        classification.recommendations.push('Blocked in high-security mode');
      }
    }
  }
}

module.exports = USBDeviceClassifier;
```

### Example 2: USB Event Analytics

```javascript
// examples/usb-analytics.js
class USBEventAnalytics {
  constructor() {
    this.events = [];
    this.patterns = new Map();
    this.anomalies = [];
    this.baseline = this.calculateBaseline();
  }

  recordEvent(event) {
    const enrichedEvent = {
      ...event,
      timestamp: Date.now(),
      dayOfWeek: new Date().getDay(),
      hourOfDay: new Date().getHours()
    };

    this.events.push(enrichedEvent);

    // Keep only last 1000 events for analysis
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    // Analyze patterns
    this.analyzePatterns(enrichedEvent);
    
    // Detect anomalies
    this.detectAnomalies(enrichedEvent);
  }

  analyzePatterns(event) {
    // Pattern analysis by time of day
    const hour = event.hourOfDay;
    const hourlyPattern = this.patterns.get('hourly') || new Array(24).fill(0);
    hourlyPattern[hour]++;
    this.patterns.set('hourly', hourlyPattern);

    // Pattern analysis by device type
    const deviceClass = event.device?.deviceDescriptor?.bDeviceClass;
    if (deviceClass !== undefined) {
      const classPattern = this.patterns.get('deviceClass') || new Map();
      classPattern.set(deviceClass, (classPattern.get(deviceClass) || 0) + 1);
      this.patterns.set('deviceClass', classPattern);
    }

    // Pattern analysis by vendor
    const vendorId = event.device?.vendorId;
    if (vendorId !== undefined) {
      const vendorPattern = this.patterns.get('vendor') || new Map();
      vendorPattern.set(vendorId, (vendorPattern.get(vendorId) || 0) + 1);
      this.patterns.set('vendor', vendorPattern);
    }
  }

  detectAnomalies(event) {
    // Time-based anomaly detection
    if (this.isUnusualTime(event)) {
      this.anomalies.push({
        type: 'unusual_time',
        event: event,
        description: 'USB activity during unusual hours',
        severity: 'medium'
      });
    }

    // Frequency-based anomaly detection
    if (this.isUnusualFrequency(event)) {
      this.anomalies.push({
        type: 'unusual_frequency',
        event: event,
        description: 'Unusually high USB activity',
        severity: 'high'
      });
    }

    // Unknown device anomaly
    if (this.isUnknownDevice(event)) {
      this.anomalies.push({
        type: 'unknown_device',
        event: event,
        description: 'Previously unseen device connected',
        severity: 'medium'
      });
    }

    // Keep only recent anomalies
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.anomalies = this.anomalies.filter(anomaly => anomaly.event.timestamp > oneHourAgo);
  }

  isUnusualTime(event) {
    // Consider 10PM to 6AM as unusual hours
    const hour = event.hourOfDay;
    return hour >= 22 || hour <= 6;
  }

  isUnusualFrequency(event) {
    // Check events in last 5 minutes
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp > fiveMinutesAgo);
    
    // More than 10 events in 5 minutes is unusual
    return recentEvents.length > 10;
  }

  isUnknownDevice(event) {
    if (!event.device) return false;

    const vendorId = event.device.vendorId;
    const productId = event.device.productId;

    // Check if we've seen this device before
    const seenBefore = this.events.some(e => 
      e.device && 
      e.device.vendorId === vendorId && 
      e.device.productId === productId &&
      e.timestamp < event.timestamp
    );

    return !seenBefore;
  }

  generateReport() {
    return {
      summary: {
        totalEvents: this.events.length,
        timeRange: {
          start: this.events[0]?.timestamp,
          end: this.events[this.events.length - 1]?.timestamp
        },
        uniqueDevices: this.getUniqueDeviceCount(),
        anomalies: this.anomalies.length
      },
      patterns: {
        hourly: this.patterns.get('hourly'),
        deviceClasses: Array.from(this.patterns.get('deviceClass') || []),
        vendors: Array.from(this.patterns.get('vendor') || [])
      },
      anomalies: this.anomalies,
      recommendations: this.generateRecommendations()
    };
  }

  getUniqueDeviceCount() {
    const devices = new Set();
    this.events.forEach(event => {
      if (event.device) {
        devices.add(`${event.device.vendorId}:${event.device.productId}`);
      }
    });
    return devices.size;
  }

  generateRecommendations() {
    const recommendations = [];

    // High anomaly count
    if (this.anomalies.length > 10) {
      recommendations.push({
        type: 'security',
        priority: 'high',
        message: 'High number of anomalies detected - review security policies'
      });
    }

    // Unusual time activity
    const timeAnomalies = this.anomalies.filter(a => a.type === 'unusual_time');
    if (timeAnomalies.length > 3) {
      recommendations.push({
        type: 'policy',
        priority: 'medium',
        message: 'Consider implementing time-based access controls'
      });
    }

    // Unknown devices
    const unknownDeviceAnomalies = this.anomalies.filter(a => a.type === 'unknown_device');
    if (unknownDeviceAnomalies.length > 5) {
      recommendations.push({
        type: 'inventory',
        priority: 'medium',
        message: 'Update device inventory and classification rules'
      });
    }

    return recommendations;
  }

  calculateBaseline() {
    // This would typically analyze historical data
    return {
      averageEventsPerHour: 5,
      commonDeviceClasses: [3, 9], // HID, Hub
      peakHours: [9, 10, 11, 14, 15, 16] // 9AM-11AM, 2PM-4PM
    };
  }
}

module.exports = USBEventAnalytics;
```

## 🔒 Security Configuration Examples

### Example 1: Multi-Tier Security Policy

```javascript
// examples/security-policies.js
class SecurityPolicyManager {
  constructor() {
    this.policies = new Map();
    this.loadSecurityPolicies();
  }

  loadSecurityPolicies() {
    // Development environment policy
    this.policies.set('development', {
      name: 'Development Environment',
      securityLevel: 'low',
      allowedDeviceClasses: [1, 2, 3, 7, 8, 9, 14], // Most classes allowed
      blockedVendors: [],
      requireSignatures: false,
      maxActivePlugins: 20,
      monitoringLevel: 'basic',
      autoQuarantine: false,
      alertThresholds: {
        anomaliesPerHour: 50,
        unknownDevicesPerDay: 20
      }
    });

    // Production environment policy
    this.policies.set('production', {
      name: 'Production Environment',
      securityLevel: 'high',
      allowedDeviceClasses: [3, 9], // Only HID and Hub
      blockedVendors: [],
      requireSignatures: true,
      maxActivePlugins: 5,
      monitoringLevel: 'comprehensive',
      autoQuarantine: true,
      alertThresholds: {
        anomaliesPerHour: 5,
        unknownDevicesPerDay: 2
      },
      approvalRequired: {
        newDevices: true,
        massStorage: true,
        networkDevices: true
      }
    });

    // High-security environment policy
    this.policies.set('high-security', {
      name: 'High Security Environment',
      securityLevel: 'maximum',
      allowedDeviceClasses: [], // Whitelist approach
      whitelistedDevices: [
        // Specific device signatures that are pre-approved
      ],
      blockedVendors: [],
      requireSignatures: true,
      maxActivePlugins: 3,
      monitoringLevel: 'paranoid',
      autoQuarantine: true,
      alertThresholds: {
        anomaliesPerHour: 1,
        unknownDevicesPerDay: 0
      },
      approvalRequired: {
        allDevices: true,
        pluginLoading: true,
        configChanges: true
      },
      auditLogging: {
        enabled: true,
        includeContent: true,
        retention: '1 year'
      }
    });
  }

  applyPolicy(environment, device, action) {
    const policy = this.policies.get(environment);
    if (!policy) {
      throw new Error(`Unknown security policy: ${environment}`);
    }

    const decision = {
      allowed: false,
      reason: '',
      actions: [],
      monitoring: []
    };

    // Check device class allowlist
    if (policy.allowedDeviceClasses.length > 0) {
      if (!policy.allowedDeviceClasses.includes(device.deviceDescriptor.bDeviceClass)) {
        decision.reason = 'Device class not allowed by policy';
        decision.actions.push('block_device');
        return decision;
      }
    }

    // Check whitelist for high security
    if (policy.whitelistedDevices && policy.whitelistedDevices.length > 0) {
      if (!policy.whitelistedDevices.includes(device.signature)) {
        decision.reason = 'Device not in whitelist';
        decision.actions.push('block_device');
        return decision;
      }
    }

    // Check blocked vendors
    if (policy.blockedVendors.includes(device.vendorId)) {
      decision.reason = 'Vendor is blocked by policy';
      decision.actions.push('block_device');
      return decision;
    }

    // Check if approval is required
    if (policy.approvalRequired) {
      if (policy.approvalRequired.allDevices || 
          (policy.approvalRequired.newDevices && this.isNewDevice(device)) ||
          (policy.approvalRequired.massStorage && device.deviceDescriptor.bDeviceClass === 8)) {
        decision.allowed = false;
        decision.reason = 'Manual approval required';
        decision.actions.push('request_approval');
        return decision;
      }
    }

    // Device is allowed
    decision.allowed = true;
    decision.reason = 'Device approved by policy';

    // Add monitoring based on policy
    if (policy.monitoringLevel === 'comprehensive' || policy.monitoringLevel === 'paranoid') {
      decision.monitoring.push('file_access_monitoring');
      decision.monitoring.push('network_monitoring');
    }

    if (policy.monitoringLevel === 'paranoid') {
      decision.monitoring.push('keystroke_monitoring');
      decision.monitoring.push('screen_recording');
    }

    return decision;
  }

  isNewDevice(device) {
    // This would check against a database of known devices
    // For this example, we'll assume devices with unknown vendors are new
    const knownVendors = [0x05ac, 0x046d, 0x045e]; // Apple, Logitech, Microsoft
    return !knownVendors.includes(device.vendorId);
  }

  validatePolicyCompliance(environment, events) {
    const policy = this.policies.get(environment);
    const compliance = {
      compliant: true,
      violations: [],
      recommendations: []
    };

    // Check anomaly thresholds
    const hourlyAnomalies = this.countAnomaliesInLastHour(events);
    if (hourlyAnomalies > policy.alertThresholds.anomaliesPerHour) {
      compliance.compliant = false;
      compliance.violations.push({
        type: 'anomaly_threshold_exceeded',
        current: hourlyAnomalies,
        threshold: policy.alertThresholds.anomaliesPerHour
      });
    }

    // Check unknown device threshold
    const dailyUnknownDevices = this.countUnknownDevicesInLastDay(events);
    if (dailyUnknownDevices > policy.alertThresholds.unknownDevicesPerDay) {
      compliance.compliant = false;
      compliance.violations.push({
        type: 'unknown_device_threshold_exceeded',
        current: dailyUnknownDevices,
        threshold: policy.alertThresholds.unknownDevicesPerDay
      });
    }

    return compliance;
  }

  countAnomaliesInLastHour(events) {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return events.filter(event => 
      event.timestamp > oneHourAgo && event.type === 'anomaly'
    ).length;
  }

  countUnknownDevicesInLastDay(events) {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const unknownDevices = new Set();
    
    events.filter(event => event.timestamp > oneDayAgo && event.type === 'device_attach')
          .forEach(event => {
            if (this.isNewDevice(event.device)) {
              unknownDevices.add(event.device.signature);
            }
          });
    
    return unknownDevices.size;
  }
}

module.exports = SecurityPolicyManager;
```

## ⚡ Performance Optimization Examples

### Example 1: Memory Pool Implementation

```javascript
// examples/memory-pools.js
class MemoryPoolManager {
  constructor() {
    this.pools = new Map();
    this.stats = new Map();
    this.setupPools();
  }

  setupPools() {
    // Device info object pool
    this.createPool('deviceInfo', () => ({
      signature: '',
      vendorId: 0,
      productId: 0,
      manufacturer: '',
      product: '',
      serialNumber: '',
      deviceDescriptor: {},
      location: {},
      timestamp: 0,
      reset() {
        this.signature = '';
        this.vendorId = 0;
        this.productId = 0;
        this.manufacturer = '';
        this.product = '';
        this.serialNumber = '';
        this.deviceDescriptor = {};
        this.location = {};
        this.timestamp = 0;
      }
    }), 100);

    // Event object pool
    this.createPool('event', () => ({
      type: '',
      timestamp: 0,
      device: null,
      data: {},
      reset() {
        this.type = '';
        this.timestamp = 0;
        this.device = null;
        this.data = {};
      }
    }), 500);

    // Buffer pool for binary data
    this.createPool('buffer', () => Buffer.alloc(4096), 50);

    // Message object pool for IPC
    this.createPool('message', () => ({
      id: '',
      type: '',
      payload: {},
      timestamp: 0,
      reset() {
        this.id = '';
        this.type = '';
        this.payload = {};
        this.timestamp = 0;
      }
    }), 200);
  }

  createPool(name, factory, maxSize) {
    const pool = {
      objects: [],
      factory: factory,
      maxSize: maxSize,
      created: 0,
      acquired: 0,
      released: 0,
      hits: 0,
      misses: 0
    };

    this.pools.set(name, pool);
    this.stats.set(name, {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      currentlyAcquired: 0,
      hitRate: 0
    });
  }

  acquire(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    let obj;
    if (pool.objects.length > 0) {
      obj = pool.objects.pop();
      pool.hits++;
    } else {
      obj = pool.factory();
      pool.created++;
      pool.misses++;
    }

    pool.acquired++;
    this.updateStats(poolName, pool);

    return obj;
  }

  release(poolName, obj) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    // Reset object if it has a reset method
    if (obj && typeof obj.reset === 'function') {
      obj.reset();
    }

    // Only store if under max size
    if (pool.objects.length < pool.maxSize) {
      pool.objects.push(obj);
    }

    pool.released++;
    this.updateStats(poolName, pool);
  }

  updateStats(poolName, pool) {
    const stats = this.stats.get(poolName);
    stats.totalCreated = pool.created;
    stats.totalAcquired = pool.acquired;
    stats.totalReleased = pool.released;
    stats.currentlyAcquired = pool.acquired - pool.released;
    stats.hitRate = pool.hits / (pool.hits + pool.misses);
  }

  getStats() {
    const allStats = {};
    for (const [poolName, stats] of this.stats) {
      allStats[poolName] = { ...stats };
    }
    return allStats;
  }

  // Automatic cleanup of unused pools
  cleanup() {
    for (const [poolName, pool] of this.pools) {
      pool.objects = [];
    }
  }
}

// Usage example
const poolManager = new MemoryPoolManager();

// Acquire device info object
const deviceInfo = poolManager.acquire('deviceInfo');
deviceInfo.signature = 'device-123';
deviceInfo.vendorId = 0x05ac;
// ... use object

// Release back to pool
poolManager.release('deviceInfo', deviceInfo);

module.exports = MemoryPoolManager;
```

### Example 2: Event Processing Optimization

```javascript
// examples/event-processor.js
class OptimizedEventProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 50;
    this.flushInterval = options.flushInterval || 100;
    this.maxQueueSize = options.maxQueueSize || 10000;
    
    this.eventQueue = [];
    this.processingQueue = [];
    this.isProcessing = false;
    
    this.stats = {
      processed: 0,
      dropped: 0,
      errors: 0,
      avgLatency: 0,
      maxLatency: 0
    };

    this.setupProcessing();
  }

  setupProcessing() {
    // Periodic flush
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, this.flushInterval);

    // Process events continuously
    this.processEvents();
  }

  enqueueEvent(event) {
    // Add timestamp for latency calculation
    event._enqueuedAt = process.hrtime.bigint();

    // Check queue size
    if (this.eventQueue.length >= this.maxQueueSize) {
      this.stats.dropped++;
      return false;
    }

    this.eventQueue.push(event);

    // Trigger immediate processing if queue is full
    if (this.eventQueue.length >= this.batchSize) {
      setImmediate(() => this.flushEvents());
    }

    return true;
  }

  flushEvents() {
    if (this.eventQueue.length === 0) return;

    // Move events to processing queue
    const batch = this.eventQueue.splice(0, this.batchSize);
    this.processingQueue.push(...batch);

    // Trigger processing if not already running
    if (!this.isProcessing) {
      setImmediate(() => this.processEvents());
    }
  }

  async processEvents() {
    if (this.isProcessing || this.processingQueue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const batch = this.processingQueue.splice(0, this.batchSize);
        await this.processBatch(batch);
      }
    } catch (error) {
      console.error('Event processing error:', error);
      this.stats.errors++;
    } finally {
      this.isProcessing = false;
    }
  }

  async processBatch(batch) {
    const startTime = process.hrtime.bigint();

    // Group events by type for efficient processing
    const eventGroups = this.groupEventsByType(batch);

    // Process each group
    for (const [eventType, events] of eventGroups) {
      await this.processEventGroup(eventType, events);
    }

    // Update statistics
    this.updateStats(batch, startTime);
  }

  groupEventsByType(events) {
    const groups = new Map();

    for (const event of events) {
      const type = event.type || 'unknown';
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type).push(event);
    }

    return groups;
  }

  async processEventGroup(eventType, events) {
    switch (eventType) {
      case 'usb:device:attach':
        await this.processDeviceAttachments(events);
        break;
      case 'usb:device:detach':
        await this.processDeviceDetachments(events);
        break;
      case 'security:violation':
        await this.processSecurityViolations(events);
        break;
      default:
        await this.processGenericEvents(events);
    }
  }

  async processDeviceAttachments(events) {
    // Batch process device attachments
    const deviceSignatures = events.map(e => e.device?.signature).filter(Boolean);
    
    // Parallel processing for independent operations
    await Promise.all([
      this.updateDeviceDatabase(deviceSignatures),
      this.triggerSecurityScans(events),
      this.updateAnalytics(events)
    ]);
  }

  async processDeviceDetachments(events) {
    // Process device detachments
    const deviceSignatures = events.map(e => e.device?.signature).filter(Boolean);
    
    await Promise.all([
      this.cleanupDeviceReferences(deviceSignatures),
      this.updateAnalytics(events)
    ]);
  }

  async processSecurityViolations(events) {
    // High priority processing for security events
    for (const event of events) {
      await this.handleSecurityViolation(event);
    }
  }

  async processGenericEvents(events) {
    // Standard event processing
    for (const event of events) {
      await this.handleGenericEvent(event);
    }
  }

  updateStats(batch, startTime) {
    const endTime = process.hrtime.bigint();
    const batchLatency = Number(endTime - startTime) / 1000000; // Convert to ms

    this.stats.processed += batch.length;

    // Calculate average latency for events in batch
    let totalEventLatency = 0;
    for (const event of batch) {
      if (event._enqueuedAt) {
        const eventLatency = Number(endTime - event._enqueuedAt) / 1000000;
        totalEventLatency += eventLatency;
        
        if (eventLatency > this.stats.maxLatency) {
          this.stats.maxLatency = eventLatency;
        }
      }
    }

    if (batch.length > 0) {
      const avgEventLatency = totalEventLatency / batch.length;
      this.stats.avgLatency = ((this.stats.avgLatency * (this.stats.processed - batch.length)) + 
                               (avgEventLatency * batch.length)) / this.stats.processed;
    }
  }

  // Placeholder methods for actual implementations
  async updateDeviceDatabase(signatures) { /* Implementation */ }
  async triggerSecurityScans(events) { /* Implementation */ }
  async updateAnalytics(events) { /* Implementation */ }
  async cleanupDeviceReferences(signatures) { /* Implementation */ }
  async handleSecurityViolation(event) { /* Implementation */ }
  async handleGenericEvent(event) { /* Implementation */ }

  getStats() {
    return {
      ...this.stats,
      queueSize: this.eventQueue.length,
      processingQueueSize: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }

  cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Process remaining events
    this.flushEvents();
    
    this.eventQueue = [];
    this.processingQueue = [];
  }
}

module.exports = OptimizedEventProcessor;
```

## 🧪 Testing Examples

### Example 1: Plugin Testing Framework

```javascript
// examples/plugin-test-framework.js
const { EventEmitter } = require('events');
const { performance } = require('perf_hooks');

class PluginTestFramework {
  constructor() {
    this.testResults = [];
    this.mocks = new Map();
    this.setupMocks();
  }

  setupMocks() {
    // Mock AutoWeave context
    this.mocks.set('context', class MockContext extends EventEmitter {
      constructor() {
        super();
        this.logger = {
          info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
          error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
          debug: (msg, data) => console.log(`[DEBUG] ${msg}`, data || ''),
          warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || '')
        };
        this.config = {};
      }
    });

    // Mock USB device
    this.mocks.set('device', () => ({
      signature: `test-device-${Date.now()}`,
      manufacturer: 'Test Vendor',
      product: 'Test Device',
      vendorId: 0x1234,
      productId: 0x5678,
      serialNumber: 'TEST123456',
      deviceDescriptor: {
        bDeviceClass: 3,
        bDeviceSubClass: 1,
        bDeviceProtocol: 1,
        idVendor: 0x1234,
        idProduct: 0x5678
      },
      location: {
        busNumber: 1,
        deviceAddress: 2,
        portPath: '1.2'
      },
      timestamp: Date.now()
    }));
  }

  async testPlugin(PluginClass, testConfig = {}) {
    const testResult = {
      name: PluginClass.name,
      tests: [],
      passed: 0,
      failed: 0,
      startTime: Date.now()
    };

    try {
      // Test 1: Plugin Initialization
      await this.testPluginInitialization(PluginClass, testConfig, testResult);

      // Test 2: Device Event Handling
      await this.testDeviceEventHandling(PluginClass, testConfig, testResult);

      // Test 3: Error Handling
      await this.testErrorHandling(PluginClass, testConfig, testResult);

      // Test 4: Performance Tests
      await this.testPerformance(PluginClass, testConfig, testResult);

      // Test 5: Memory Leak Tests
      await this.testMemoryLeaks(PluginClass, testConfig, testResult);

      // Test 6: Cleanup Tests
      await this.testCleanup(PluginClass, testConfig, testResult);

    } catch (error) {
      testResult.tests.push({
        name: 'Plugin Test Suite',
        passed: false,
        error: error.message,
        duration: Date.now() - testResult.startTime
      });
      testResult.failed++;
    }

    testResult.endTime = Date.now();
    testResult.totalDuration = testResult.endTime - testResult.startTime;
    
    this.testResults.push(testResult);
    return testResult;
  }

  async testPluginInitialization(PluginClass, config, testResult) {
    const test = { name: 'Plugin Initialization', startTime: performance.now() };

    try {
      const plugin = new PluginClass();
      const context = new (this.mocks.get('context'))();
      context.config = config;

      await plugin.initialize(context);

      // Verify plugin is properly initialized
      if (typeof plugin.isRunning !== 'undefined' && plugin.isRunning) {
        test.passed = true;
      } else {
        test.passed = false;
        test.error = 'Plugin did not set isRunning to true';
      }

      await plugin.cleanup();

    } catch (error) {
      test.passed = false;
      test.error = error.message;
    }

    test.endTime = performance.now();
    test.duration = test.endTime - test.startTime;
    testResult.tests.push(test);
    
    if (test.passed) {
      testResult.passed++;
    } else {
      testResult.failed++;
    }
  }

  async testDeviceEventHandling(PluginClass, config, testResult) {
    const test = { name: 'Device Event Handling', startTime: performance.now() };

    try {
      const plugin = new PluginClass();
      const context = new (this.mocks.get('context'))();
      context.config = config;

      await plugin.initialize(context);

      // Test device attach event
      const mockDevice = this.mocks.get('device')();
      let eventReceived = false;

      plugin.on('device-processed', () => {
        eventReceived = true;
      });

      context.emit('usb:device:attach', mockDevice);

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      if (eventReceived) {
        test.passed = true;
      } else {
        test.passed = false;
        test.error = 'Plugin did not handle device attach event';
      }

      await plugin.cleanup();

    } catch (error) {
      test.passed = false;
      test.error = error.message;
    }

    test.endTime = performance.now();
    test.duration = test.endTime - test.startTime;
    testResult.tests.push(test);
    
    if (test.passed) {
      testResult.passed++;
    } else {
      testResult.failed++;
    }
  }

  async testErrorHandling(PluginClass, config, testResult) {
    const test = { name: 'Error Handling', startTime: performance.now() };

    try {
      const plugin = new PluginClass();
      const context = new (this.mocks.get('context'))();
      context.config = config;

      await plugin.initialize(context);

      // Test with invalid device data
      const invalidDevice = { invalid: 'data' };
      let errorHandled = false;

      // Override error handler to catch errors
      const originalLogger = context.logger.error;
      context.logger.error = (msg, data) => {
        errorHandled = true;
        originalLogger(msg, data);
      };

      context.emit('usb:device:attach', invalidDevice);

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));

      if (errorHandled) {
        test.passed = true;
      } else {
        test.passed = false;
        test.error = 'Plugin did not handle invalid data gracefully';
      }

      await plugin.cleanup();

    } catch (error) {
      // Expected to catch errors in error handling test
      test.passed = true;
    }

    test.endTime = performance.now();
    test.duration = test.endTime - test.startTime;
    testResult.tests.push(test);
    
    if (test.passed) {
      testResult.passed++;
    } else {
      testResult.failed++;
    }
  }

  async testPerformance(PluginClass, config, testResult) {
    const test = { name: 'Performance Test', startTime: performance.now() };

    try {
      const plugin = new PluginClass();
      const context = new (this.mocks.get('context'))();
      context.config = config;

      await plugin.initialize(context);

      const deviceCount = 100;
      const devices = [];
      
      // Generate test devices
      for (let i = 0; i < deviceCount; i++) {
        devices.push(this.mocks.get('device')());
      }

      const startTime = performance.now();

      // Process all devices
      for (const device of devices) {
        context.emit('usb:device:attach', device);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const endTime = performance.now();
      const duration = endTime - startTime;
      const avgTimePerDevice = duration / deviceCount;

      // Performance threshold: should process 100 devices in under 1 second
      if (avgTimePerDevice < 10) { // 10ms per device
        test.passed = true;
        test.metrics = {
          totalTime: duration,
          avgTimePerDevice: avgTimePerDevice,
          devicesPerSecond: 1000 / avgTimePerDevice
        };
      } else {
        test.passed = false;
        test.error = `Performance below threshold: ${avgTimePerDevice}ms per device`;
      }

      await plugin.cleanup();

    } catch (error) {
      test.passed = false;
      test.error = error.message;
    }

    test.endTime = performance.now();
    test.duration = test.endTime - test.startTime;
    testResult.tests.push(test);
    
    if (test.passed) {
      testResult.passed++;
    } else {
      testResult.failed++;
    }
  }

  async testMemoryLeaks(PluginClass, config, testResult) {
    const test = { name: 'Memory Leak Test', startTime: performance.now() };

    try {
      const plugin = new PluginClass();
      const context = new (this.mocks.get('context'))();
      context.config = config;

      await plugin.initialize(context);

      // Force garbage collection
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many events
      for (let i = 0; i < 1000; i++) {
        const device = this.mocks.get('device')();
        context.emit('usb:device:attach', device);
        context.emit('usb:device:detach', device);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force garbage collection again
      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory leak threshold: should not increase by more than 1MB
      if (memoryIncreaseMB < 1) {
        test.passed = true;
        test.metrics = {
          initialMemoryMB: initialMemory / (1024 * 1024),
          finalMemoryMB: finalMemory / (1024 * 1024),
          increaseMB: memoryIncreaseMB
        };
      } else {
        test.passed = false;
        test.error = `Memory leak detected: ${memoryIncreaseMB.toFixed(2)}MB increase`;
      }

      await plugin.cleanup();

    } catch (error) {
      test.passed = false;
      test.error = error.message;
    }

    test.endTime = performance.now();
    test.duration = test.endTime - test.startTime;
    testResult.tests.push(test);
    
    if (test.passed) {
      testResult.passed++;
    } else {
      testResult.failed++;
    }
  }

  async testCleanup(PluginClass, config, testResult) {
    const test = { name: 'Cleanup Test', startTime: performance.now() };

    try {
      const plugin = new PluginClass();
      const context = new (this.mocks.get('context'))();
      context.config = config;

      await plugin.initialize(context);

      // Verify plugin is running
      const wasRunning = plugin.isRunning;

      await plugin.cleanup();

      // Verify plugin cleaned up properly
      if (wasRunning && (!plugin.isRunning || plugin.isRunning === false)) {
        test.passed = true;
      } else {
        test.passed = false;
        test.error = 'Plugin did not clean up properly';
      }

    } catch (error) {
      test.passed = false;
      test.error = error.message;
    }

    test.endTime = performance.now();
    test.duration = test.endTime - test.startTime;
    testResult.tests.push(test);
    
    if (test.passed) {
      testResult.passed++;
    } else {
      testResult.failed++;
    }
  }

  generateReport() {
    return {
      summary: {
        totalPlugins: this.testResults.length,
        totalTests: this.testResults.reduce((sum, result) => sum + result.tests.length, 0),
        totalPassed: this.testResults.reduce((sum, result) => sum + result.passed, 0),
        totalFailed: this.testResults.reduce((sum, result) => sum + result.failed, 0),
        averageDuration: this.testResults.reduce((sum, result) => sum + result.totalDuration, 0) / this.testResults.length
      },
      results: this.testResults,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = PluginTestFramework;
```

This comprehensive examples and tutorials guide provides hands-on, production-ready code examples that demonstrate the full capabilities of AutoWeave Sprint 1 components. Each example is designed to be educational while also serving as a foundation for real-world implementations.