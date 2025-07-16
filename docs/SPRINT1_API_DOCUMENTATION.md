# AutoWeave Sprint 1 - API Documentation

**Version:** 1.0.0  
**Sprint:** 1 (USB Daemon & Plugin Loader)  
**Status:** ✅ Production Ready  
**Date:** 2025-07-14

## 📖 Overview

This document provides comprehensive API documentation for AutoWeave Sprint 1 components, including USB Daemon, Plugin Security Manager, and related services. All APIs are designed for production use with comprehensive error handling, authentication, and monitoring.

## 🔗 Base URLs

```
Local Development:  http://localhost:3000/api/v1
USB Daemon:        http://localhost:8080/api/v1
Production:        https://api.autoweave.dev/v1
```

## 🔐 Authentication

All API endpoints use Bearer token authentication:

```http
Authorization: Bearer <your-api-token>
Content-Type: application/json
```

## 📊 API Reference

### USB Daemon API

#### Get USB Daemon Status

**Endpoint:** `GET /usb/status`

**Description:** Retrieves the current status of the USB daemon including connected devices and performance metrics.

**Response:**
```json
{
  "status": "success",
  "data": {
    "running": true,
    "uptime": 86400000,
    "connectedDevices": 3,
    "queuedEvents": 0,
    "filters": {
      "vendor_whitelist": [],
      "vendor_blacklist": [0],
      "device_class_filter": []
    },
    "performance": {
      "eventsPerSecond": 12,
      "maxEventsPerSecond": 100,
      "averageLatency": 45,
      "memoryUsage": "64MB"
    },
    "health": "healthy"
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Get Connected USB Devices

**Endpoint:** `GET /usb/devices`

**Description:** Returns a list of all currently connected USB devices with detailed information.

**Query Parameters:**
- `vendor` (optional): Filter by vendor ID (hex format: 0x1234)
- `product` (optional): Filter by product ID (hex format: 0x5678)
- `class` (optional): Filter by device class

**Response:**
```json
{
  "status": "success",
  "data": {
    "devices": [
      {
        "signature": "a1b2c3d4e5f6g7h8",
        "vendorId": 1452,
        "productId": 591,
        "manufacturer": "Apple Inc.",
        "product": "iBridge",
        "serialNumber": "001234567890",
        "deviceDescriptor": {
          "bcdUSB": 512,
          "bDeviceClass": 9,
          "bDeviceSubClass": 0,
          "bDeviceProtocol": 3,
          "bMaxPacketSize0": 9,
          "idVendor": 1452,
          "idProduct": 591,
          "bcdDevice": 1,
          "iManufacturer": 1,
          "iProduct": 2,
          "iSerialNumber": 3,
          "bNumConfigurations": 1
        },
        "location": {
          "busNumber": 1,
          "deviceAddress": 2,
          "portPath": "1.2"
        },
        "timestamp": 1642158000000,
        "connectedDuration": 3600000
      }
    ],
    "total": 1,
    "filtered": 1
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Get USB Device by Signature

**Endpoint:** `GET /usb/devices/{signature}`

**Description:** Retrieves detailed information for a specific USB device by its signature.

**Parameters:**
- `signature` (required): Device signature (16-character hex string)

**Response:**
```json
{
  "status": "success",
  "data": {
    "signature": "a1b2c3d4e5f6g7h8",
    "vendorId": 1452,
    "productId": 591,
    "manufacturer": "Apple Inc.",
    "product": "iBridge",
    "serialNumber": "001234567890",
    "deviceDescriptor": { /* ... */ },
    "location": { /* ... */ },
    "timestamp": 1642158000000,
    "connectedDuration": 3600000,
    "events": [
      {
        "type": "attach",
        "timestamp": 1642158000000,
        "source": "node-usb"
      }
    ]
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### USB Event Stream

**Endpoint:** `GET /usb/events/stream`

**Description:** Server-Sent Events stream for real-time USB device events.

**Headers:**
```
Accept: text/event-stream
Cache-Control: no-cache
```

**Response Stream:**
```
event: device.attach
data: {"signature":"a1b2c3d4e5f6g7h8","vendorId":1452,"product":"iBridge","timestamp":1642158000000}

event: device.detach  
data: {"signature":"a1b2c3d4e5f6g7h8","timestamp":1642158060000}
```

#### Configure USB Daemon

**Endpoint:** `PUT /usb/config`

**Description:** Updates USB daemon configuration dynamically.

**Request Body:**
```json
{
  "filters": {
    "vendor_whitelist": [1452, 1118],
    "vendor_blacklist": [0],
    "device_class_filter": [3, 8, 9]
  },
  "performance": {
    "max_events_per_second": 150,
    "debounce_ms": 30,
    "batch_size": 15
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Configuration updated successfully",
    "applied": {
      "filters": { /* updated filters */ },
      "performance": { /* updated settings */ }
    },
    "restart_required": false
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

### Plugin Security Manager API

#### Get Security Status

**Endpoint:** `GET /security/status`

**Description:** Retrieves comprehensive security status including active plugins and threat levels.

**Response:**
```json
{
  "status": "success",
  "data": {
    "initialized": true,
    "locked": false,
    "lockReason": null,
    "securityLevel": "high",
    "uptime": 86400000,
    "plugins": {
      "total": 5,
      "active": 3,
      "blocked": 0,
      "pending": 1
    },
    "violations": 0,
    "monitor": {
      "eventsPerMinute": 45,
      "errorsPerMinute": 0,
      "anomaliesDetected": 0
    },
    "resources": {
      "totalMemoryMB": 128,
      "totalCpuPercent": 15,
      "activeLimits": 3
    },
    "channels": {
      "active": 3,
      "total": 5,
      "encrypted": 3
    }
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### List Plugins

**Endpoint:** `GET /security/plugins`

**Description:** Returns list of all plugins with their security status.

**Query Parameters:**
- `status` (optional): Filter by plugin status (loaded, running, stopped, blocked)
- `security_level` (optional): Filter by security level
- `include_manifest` (optional): Include full manifest data (default: false)

**Response:**
```json
{
  "status": "success",
  "data": {
    "plugins": [
      {
        "id": "usb-scanner",
        "name": "USB Scanner Plugin",
        "version": "1.0.0",
        "state": "running",
        "loadedAt": 1642158000000,
        "startedAt": 1642158030000,
        "runtime": 3570000,
        "securityContext": {
          "violations": 0,
          "anomalies": 0,
          "blocked": false,
          "trustLevel": "high"
        },
        "permissions": {
          "usb": ["read", "monitor"],
          "network": ["outbound"],
          "filesystem": [
            {
              "path": "/tmp/usb-scanner",
              "mode": "readwrite"
            }
          ]
        },
        "resources": {
          "memoryUsageMB": 12,
          "cpuPercent": 5,
          "networkConnections": 1
        }
      }
    ],
    "total": 1,
    "filtered": 1
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Get Plugin Details

**Endpoint:** `GET /security/plugins/{pluginId}`

**Description:** Retrieves detailed information for a specific plugin.

**Parameters:**
- `pluginId` (required): Plugin identifier

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "usb-scanner",
    "manifest": {
      "name": "usb-scanner",
      "version": "1.0.0",
      "description": "Scans and monitors USB devices",
      "entry": "./dist/index.js",
      "permissions": { /* ... */ },
      "dependencies": { /* ... */ },
      "isolation": { /* ... */ }
    },
    "state": "running",
    "loadedAt": 1642158000000,
    "startedAt": 1642158030000,
    "runtime": 3570000,
    "securityContext": {
      "violations": 0,
      "anomalies": 0,
      "blocked": false,
      "trustLevel": "high",
      "auditLog": [
        {
          "timestamp": 1642158030000,
          "event": "started",
          "details": "Plugin started successfully"
        }
      ]
    },
    "performance": {
      "memoryUsageMB": 12,
      "memoryPeakMB": 15,
      "cpuPercent": 5,
      "cpuPeakPercent": 25,
      "networkConnections": 1,
      "messagesProcessed": 1247,
      "errorsEncountered": 0
    },
    "health": "healthy"
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Load Plugin

**Endpoint:** `POST /security/plugins/load`

**Description:** Loads a new plugin from the specified path.

**Request Body:**
```json
{
  "pluginPath": "./plugins/usb-scanner",
  "autoStart": true,
  "securityOverrides": {
    "trustLevel": "medium",
    "additionalPermissions": []
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "pluginId": "usb-scanner",
    "message": "Plugin loaded successfully",
    "manifest": { /* plugin manifest */ },
    "securityLevel": "high",
    "state": "loaded"
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Start Plugin

**Endpoint:** `POST /security/plugins/{pluginId}/start`

**Description:** Starts a loaded plugin in a secure sandbox.

**Parameters:**
- `pluginId` (required): Plugin identifier

**Request Body:**
```json
{
  "context": {
    "environment": "production",
    "config": {
      "debugMode": false,
      "logLevel": "info"
    }
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "pluginId": "usb-scanner",
    "message": "Plugin started successfully",
    "state": "running",
    "startedAt": 1642158030000,
    "processId": 12345,
    "securityChannel": "encrypted",
    "permissions": ["usb:read", "network:outbound"]
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Stop Plugin

**Endpoint:** `POST /security/plugins/{pluginId}/stop`

**Description:** Gracefully stops a running plugin.

**Parameters:**
- `pluginId` (required): Plugin identifier

**Request Body:**
```json
{
  "force": false,
  "timeout": 5000,
  "reason": "Manual stop"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "pluginId": "usb-scanner",
    "message": "Plugin stopped successfully",
    "state": "stopped",
    "stoppedAt": 1642161630000,
    "runtime": 3600000,
    "reason": "Manual stop",
    "graceful": true
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Send Plugin Message

**Endpoint:** `POST /security/plugins/{pluginId}/message`

**Description:** Sends a secure message to a running plugin.

**Parameters:**
- `pluginId` (required): Plugin identifier

**Request Body:**
```json
{
  "type": "command",
  "command": "scan_device",
  "data": {
    "deviceSignature": "a1b2c3d4e5f6g7h8",
    "scanDepth": "full"
  },
  "timeout": 10000,
  "expectResponse": true
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "messageId": "msg_123456789",
    "sent": true,
    "timestamp": 1642158090000,
    "response": {
      "type": "result",
      "data": {
        "scanComplete": true,
        "findings": [
          {
            "type": "device_info",
            "data": { /* scan results */ }
          }
        ]
      },
      "timestamp": 1642158095000
    }
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

#### Get Security Report

**Endpoint:** `GET /security/report`

**Description:** Generates a comprehensive security report.

**Query Parameters:**
- `period` (optional): Report period (1h, 24h, 7d, 30d) - default: 24h
- `include_audit` (optional): Include audit log entries - default: false
- `format` (optional): Report format (json, pdf) - default: json

**Response:**
```json
{
  "status": "success",
  "data": {
    "reportId": "sec_report_20250714_103000",
    "period": "24h",
    "generatedAt": "2025-07-14T10:30:00Z",
    "summary": {
      "securityLevel": "high",
      "totalPlugins": 5,
      "activePlugins": 3,
      "blockedPlugins": 0,
      "violations": 0,
      "anomalies": 0,
      "riskScore": 15
    },
    "plugins": { /* detailed plugin info */ },
    "monitor": { /* monitoring report */ },
    "resources": { /* resource usage report */ },
    "boundary": { /* boundary security report */ },
    "recommendations": [
      {
        "type": "optimization",
        "priority": "medium",
        "message": "Consider enabling stricter permission validation",
        "action": "Update security configuration"
      }
    ]
  },
  "timestamp": "2025-07-14T10:30:00Z"
}
```

### System Health API

#### Get System Health

**Endpoint:** `GET /health`

**Description:** Returns overall system health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-14T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400000,
  "components": {
    "usb-daemon": {
      "status": "healthy",
      "details": "3 devices connected, 0 errors"
    },
    "plugin-security": {
      "status": "healthy", 
      "details": "3 plugins active, 0 violations"
    },
    "redis": {
      "status": "healthy",
      "details": "Connected, 0ms latency"
    }
  },
  "metrics": {
    "memoryUsage": "256MB",
    "cpuUsage": "15%",
    "diskUsage": "5GB"
  }
}
```

#### Get System Metrics

**Endpoint:** `GET /metrics`

**Description:** Returns Prometheus-formatted metrics.

**Response:**
```
# HELP autoweave_usb_events_total Total USB events processed
# TYPE autoweave_usb_events_total counter
autoweave_usb_events_total{type="attach"} 1247
autoweave_usb_events_total{type="detach"} 1198

# HELP autoweave_usb_devices_connected Currently connected USB devices
# TYPE autoweave_usb_devices_connected gauge
autoweave_usb_devices_connected 3

# HELP autoweave_plugins_active Currently active plugins
# TYPE autoweave_plugins_active gauge
autoweave_plugins_active 3

# HELP autoweave_security_violations_total Total security violations
# TYPE autoweave_security_violations_total counter
autoweave_security_violations_total 0
```

## 🔌 Integration Patterns

### Event-Driven Integration

#### USB Event Listener

```javascript
// Using Server-Sent Events
const eventSource = new EventSource('/api/v1/usb/events/stream');

eventSource.addEventListener('device.attach', (event) => {
  const device = JSON.parse(event.data);
  console.log('Device attached:', device);
  
  // Trigger plugin loading for specific device types
  if (device.vendorId === 0x05ac) { // Apple devices
    loadPlugin('apple-device-handler');
  }
});

eventSource.addEventListener('device.detach', (event) => {
  const device = JSON.parse(event.data);
  console.log('Device detached:', device);
  
  // Cleanup associated resources
  cleanupDeviceResources(device.signature);
});
```

#### Redis Streams Integration

```javascript
// Direct Redis Streams integration
const Redis = require('ioredis');
const redis = new Redis();

async function consumeUSBEvents() {
  await redis.xgroup('CREATE', 'aw:hotplug', 'my-consumer', '$', 'MKSTREAM');
  
  while (true) {
    const results = await redis.xreadgroup(
      'GROUP', 'my-consumer', 'worker-1',
      'COUNT', 1,
      'BLOCK', 1000,
      'STREAMS', 'aw:hotplug', '>'
    );
    
    if (results && results.length > 0) {
      const [streamName, messages] = results[0];
      
      for (const [messageId, fields] of messages) {
        const event = parseEventFields(fields);
        await processUSBEvent(event);
        
        // Acknowledge message
        await redis.xack('aw:hotplug', 'my-consumer', messageId);
      }
    }
  }
}
```

### Plugin Development Pattern

#### Basic Plugin Structure

```javascript
// plugins/my-plugin/index.js
class MyPlugin {
  constructor() {
    this.name = 'my-plugin';
    this.version = '1.0.0';
  }
  
  async initialize(context) {
    this.context = context;
    
    // Register for USB events
    this.context.on('usb:device:attach', this.onDeviceAttach.bind(this));
    this.context.on('usb:device:detach', this.onDeviceDetach.bind(this));
    
    console.log('Plugin initialized');
  }
  
  async onDeviceAttach(device) {
    // Process device attachment
    if (device.vendorId === 0x1234) {
      await this.handleSpecialDevice(device);
    }
  }
  
  async onDeviceDetach(device) {
    // Clean up device resources
    await this.cleanupDevice(device.signature);
  }
  
  async handleSpecialDevice(device) {
    // Device-specific handling
    const info = await this.context.getDeviceInfo(device.signature);
    
    // Send results back to system
    this.context.emit('plugin:result', {
      type: 'device_processed',
      device: device.signature,
      data: info
    });
  }
  
  async cleanup() {
    // Plugin cleanup
    console.log('Plugin cleaned up');
  }
}

module.exports = MyPlugin;
```

#### Plugin Manifest

```json
{
  "$schema": "https://autoweave.dev/schemas/plugin-v1.json",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Example plugin for device handling",
  "entry": "./index.js",
  "autoweave": {
    "minVersion": "1.0.0",
    "maxVersion": "2.0.0"
  },
  "permissions": {
    "usb": ["read", "monitor"],
    "network": ["outbound"],
    "filesystem": [
      {
        "path": "/tmp/my-plugin",
        "mode": "readwrite"
      }
    ]
  },
  "hooks": {
    "onLoad": "./hooks/onLoad.js",
    "onUnload": "./hooks/onUnload.js",
    "onError": "./hooks/onError.js"
  },
  "dependencies": {
    "external": ["lodash@^4.17.0"],
    "autoweave": ["@autoweave/usb@^1.0.0"]
  },
  "isolation": {
    "workerThread": true,
    "memoryLimit": "64MB",
    "cpuLimit": "25%"
  }
}
```

### Security Integration

#### Custom Security Monitor

```javascript
// Custom security monitoring integration
const PluginSecurityManager = require('@autoweave/security');

const securityManager = new PluginSecurityManager({
  securityLevel: 'high',
  
  // Custom violation handler
  monitor: {
    onViolation: async (violation) => {
      // Custom violation handling
      await sendSecurityAlert(violation);
      
      if (violation.severity === 'critical') {
        await emergencyShutdown(violation.pluginId);
      }
    },
    
    onAnomaly: async (anomaly) => {
      // Anomaly detection handling
      await logAnomalyEvent(anomaly);
      
      if (anomaly.score > 0.8) {
        await increaseMonitoring(anomaly.pluginId);
      }
    }
  }
});

// Initialize security
await securityManager.initialize();

// Load and start plugin with monitoring
const pluginId = await securityManager.loadPlugin('./plugins/my-plugin');
await securityManager.startPlugin(pluginId);
```

## 📝 Code Examples

### Complete USB Device Monitoring

```javascript
// Complete USB device monitoring example
const AutoWeave = require('@autoweave/core');
const USBDaemon = require('@autoweave/usb-daemon');
const PluginSecurityManager = require('@autoweave/security');

class USBDeviceMonitor {
  constructor() {
    this.usbDaemon = new USBDaemon({
      redis: { host: 'localhost', port: 6379 },
      performance: {
        debounce_ms: 25,
        max_events_per_second: 200
      }
    });
    
    this.securityManager = new PluginSecurityManager({
      securityLevel: 'high',
      maxActivePlugins: 5
    });
    
    this.devices = new Map();
    this.plugins = new Map();
  }
  
  async initialize() {
    // Initialize security manager
    await this.securityManager.initialize();
    
    // Setup USB event handlers
    this.usbDaemon.on('device:attach', this.onDeviceAttach.bind(this));
    this.usbDaemon.on('device:detach', this.onDeviceDetach.bind(this));
    
    // Setup security event handlers
    this.securityManager.on('plugin-blocked', this.onPluginBlocked.bind(this));
    this.securityManager.on('security-violation', this.onSecurityViolation.bind(this));
    
    // Start USB daemon
    await this.usbDaemon.start();
    
    console.log('USB Device Monitor initialized');
  }
  
  async onDeviceAttach(device) {
    console.log(`Device attached: ${device.manufacturer} ${device.product}`);
    
    // Store device info
    this.devices.set(device.signature, device);
    
    // Check if we have a handler plugin for this device
    const handlerPlugin = this.findHandlerPlugin(device);
    
    if (handlerPlugin) {
      await this.loadAndStartPlugin(handlerPlugin, device);
    } else {
      // Load generic device handler
      await this.loadGenericHandler(device);
    }
    
    // Notify other systems
    await this.notifyDeviceAttached(device);
  }
  
  async onDeviceDetach(device) {
    console.log(`Device detached: ${device.manufacturer} ${device.product}`);
    
    // Stop associated plugins
    const associatedPlugins = this.getAssociatedPlugins(device.signature);
    for (const pluginId of associatedPlugins) {
      await this.securityManager.stopPlugin(pluginId, 'device-detached');
    }
    
    // Remove device info
    this.devices.delete(device.signature);
    
    // Notify other systems
    await this.notifyDeviceDetached(device);
  }
  
  findHandlerPlugin(device) {
    // Plugin selection logic based on device characteristics
    const vendorHandlers = {
      0x05ac: 'apple-device-handler',
      0x046d: 'logitech-device-handler',
      0x045e: 'microsoft-device-handler'
    };
    
    return vendorHandlers[device.vendorId] || null;
  }
  
  async loadAndStartPlugin(pluginName, device) {
    try {
      const pluginPath = `./plugins/${pluginName}`;
      const pluginId = await this.securityManager.loadPlugin(pluginPath);
      
      await this.securityManager.startPlugin(pluginId);
      
      // Send device info to plugin
      await this.securityManager.sendPluginMessage(pluginId, {
        type: 'device_attached',
        device: device
      });
      
      // Track plugin association
      this.plugins.set(device.signature, pluginId);
      
      console.log(`Loaded plugin ${pluginName} for device ${device.signature}`);
      
    } catch (error) {
      console.error(`Failed to load plugin ${pluginName}:`, error.message);
    }
  }
  
  async onPluginBlocked(data) {
    console.warn(`Plugin blocked: ${data.pluginId} - ${data.reason}`);
    
    // Remove plugin associations
    for (const [deviceSig, pluginId] of this.plugins) {
      if (pluginId === data.pluginId) {
        this.plugins.delete(deviceSig);
      }
    }
    
    // Alert administrators
    await this.sendSecurityAlert('plugin-blocked', data);
  }
  
  async onSecurityViolation(data) {
    console.error(`Security violation: ${data.pluginId} - ${data.type}`);
    
    // Escalate critical violations
    if (data.severity === 'critical') {
      await this.escalateSecurityIncident(data);
    }
  }
  
  async getSystemStatus() {
    return {
      usb: this.usbDaemon.getStatus(),
      security: this.securityManager.getSecurityStatus(),
      devices: Array.from(this.devices.values()),
      plugins: Array.from(this.plugins.entries())
    };
  }
  
  async cleanup() {
    // Stop all plugins
    for (const pluginId of this.plugins.values()) {
      await this.securityManager.stopPlugin(pluginId, 'system-shutdown');
    }
    
    // Stop USB daemon
    await this.usbDaemon.stop();
    
    // Cleanup security manager
    await this.securityManager.cleanup();
    
    console.log('USB Device Monitor cleaned up');
  }
}

// Usage
const monitor = new USBDeviceMonitor();
await monitor.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await monitor.cleanup();
  process.exit(0);
});
```

### Advanced Plugin Communication

```javascript
// Advanced plugin communication example
class PluginCommunicationHub {
  constructor(securityManager) {
    this.securityManager = securityManager;
    this.channels = new Map();
    this.messageQueue = new Map();
  }
  
  async establishChannel(pluginId) {
    const channel = this.securityManager.getPluginChannel(pluginId);
    
    if (channel) {
      this.channels.set(pluginId, channel);
      
      // Setup message handlers
      channel.on('message', (message) => {
        this.handlePluginMessage(pluginId, message);
      });
      
      return true;
    }
    
    return false;
  }
  
  async sendMessage(pluginId, message) {
    try {
      const response = await this.securityManager.sendPluginMessage(pluginId, {
        ...message,
        messageId: this.generateMessageId(),
        timestamp: Date.now()
      });
      
      return response.data.response;
      
    } catch (error) {
      console.error(`Failed to send message to ${pluginId}:`, error.message);
      throw error;
    }
  }
  
  async broadcastMessage(message, targetPlugins = null) {
    const plugins = targetPlugins || this.securityManager.getActivePlugins();
    const results = new Map();
    
    const promises = plugins.map(async (pluginId) => {
      try {
        const response = await this.sendMessage(pluginId, message);
        results.set(pluginId, { success: true, response });
      } catch (error) {
        results.set(pluginId, { success: false, error: error.message });
      }
    });
    
    await Promise.all(promises);
    return results;
  }
  
  handlePluginMessage(pluginId, message) {
    switch (message.type) {
      case 'device_scan_result':
        this.handleDeviceScanResult(pluginId, message.data);
        break;
        
      case 'security_alert':
        this.handleSecurityAlert(pluginId, message.data);
        break;
        
      case 'plugin_communication':
        this.routePluginMessage(pluginId, message.data);
        break;
        
      default:
        console.warn(`Unknown message type from ${pluginId}: ${message.type}`);
    }
  }
  
  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

This comprehensive API documentation provides all the necessary information for developers, DevOps engineers, security engineers, and QA engineers to effectively integrate with and utilize AutoWeave Sprint 1 components.