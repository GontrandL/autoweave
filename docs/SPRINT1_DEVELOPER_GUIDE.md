# AutoWeave Sprint 1 - Developer Guide

**Version:** 1.0.0  
**Sprint:** 1 (USB Daemon & Plugin Loader)  
**Status:** ✅ Production Ready  
**Date:** 2025-07-14

## 📖 Overview

This comprehensive developer guide provides everything needed to contribute to AutoWeave Sprint 1, including development environment setup, coding standards, testing strategies, debugging techniques, and contribution workflows.

## 🛠️ Development Environment Setup

### Prerequisites

#### System Requirements
```bash
# Operating System
Linux (Ubuntu 20.04+ / CentOS 8+)
macOS (12.0+)
Windows (WSL2 with Ubuntu 20.04+)

# Development Tools
Node.js >= 18.0.0 (recommend using nvm)
Python >= 3.8 (for mem0 and integration tools)
Git >= 2.30.0
Docker >= 20.0.0
Redis >= 6.0

# USB Development (Linux)
libusb-1.0-dev
libudev-dev
build-essential

# USB Development (macOS)
Xcode Command Line Tools
libusb (via Homebrew)

# USB Development (Windows)
Windows Subsystem for Linux 2 (WSL2)
WinUSB drivers (for device access)
```

#### Hardware Requirements
```bash
# Minimum Development Setup
RAM: 8GB (16GB recommended)
CPU: 4 cores (8 cores recommended)
Storage: 20GB free space
USB: At least 2 USB ports for testing

# USB Development Devices
USB hub (powered)
USB storage devices (various types)
USB HID devices (keyboard, mouse)
USB serial adapters (optional)
```

### Initial Setup

#### 1. Repository Setup
```bash
# Clone the repository
git clone https://github.com/autoweave/autoweave.git
cd autoweave

# Install dependencies
npm install

# Setup development environment
cp .env.example .env.development
cp .env.example .env.test

# Edit environment files
nano .env.development
```

#### 2. Development Environment Configuration
```bash
# .env.development
NODE_ENV=development
DEBUG=autoweave:*

# Redis (local development)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# USB Daemon Development
USB_DAEMON_ENABLED=true
USB_DAEMON_PORT=8080
USB_DAEMON_LOG_LEVEL=debug
USB_DEBOUNCE_MS=25

# Plugin Security Development
SECURITY_LEVEL=medium
MAX_ACTIVE_PLUGINS=20
REQUIRE_SIGNED_PLUGINS=false
SANDBOX_DIRECTORY=./.dev-sandbox

# Performance Testing
ENABLE_OBJECT_POOLS=true
ENABLE_PERFORMANCE_MONITORING=true
CLINIC_ENABLED=true

# Testing Configuration
TEST_TIMEOUT=30000
TEST_USB_MOCK=true
TEST_PARALLEL=false
```

#### 3. Local Services Setup
```bash
# Start Redis for development
docker run -d \
  --name autoweave-dev-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify Redis connection
redis-cli ping

# Create development directories
mkdir -p .dev-sandbox
mkdir -p logs/dev
mkdir -p plugins/dev
mkdir -p test-results

# Set permissions
chmod 755 .dev-sandbox
chmod 755 plugins/dev
```

#### 4. USB Development Setup (Linux)
```bash
# Install USB development dependencies
sudo apt-get update
sudo apt-get install -y \
  libusb-1.0-0-dev \
  libudev-dev \
  build-essential \
  pkg-config

# Create development udev rules
sudo tee /etc/udev/rules.d/99-autoweave-dev.rules << 'EOF'
# AutoWeave Development USB Rules
SUBSYSTEM=="usb", ATTR{idVendor}=="*", ATTR{idProduct}=="*", GROUP="plugdev", MODE="0664"
KERNEL=="hidraw*", GROUP="plugdev", MODE="0664"
EOF

# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload udev rules
sudo udevadm control --reload-rules
sudo udevadm trigger

# Test USB access
node -e "console.log(require('usb').getDeviceList().length + ' USB devices found')"
```

#### 5. IDE Setup

##### Visual Studio Code
```bash
# Install recommended extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension ms-vscode.vscode-eslint
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-jest
code --install-extension redhat.vscode-yaml

# Copy development settings
cp .vscode/settings.example.json .vscode/settings.json
cp .vscode/launch.example.json .vscode/launch.json
```

##### WebStorm/IntelliJ
```bash
# Import project settings
# File -> Import Settings -> .idea/autoweave-dev-settings.zip

# Configure Node.js interpreter
# File -> Settings -> Languages & Frameworks -> Node.js
# Node interpreter: ~/.nvm/versions/node/v18.x.x/bin/node

# Configure ESLint
# File -> Settings -> Languages & Frameworks -> JavaScript -> Code Quality Tools -> ESLint
# Automatic ESLint configuration
```

## 🏗️ Project Structure

### Sprint 1 Codebase Organization
```
autoweave/
├── src/                           # Source code
│   ├── usb/                      # USB Daemon components
│   │   ├── usb-daemon.js         # Main USB daemon
│   │   ├── usb-event-publisher.js # Event publishing
│   │   └── optimized-usb-daemon.ts # Performance optimized version
│   ├── security/                 # Security framework
│   │   ├── plugin-security-manager.js # Main security orchestrator
│   │   ├── security-monitor.js   # Threat monitoring
│   │   ├── resource-enforcer.js  # Resource management
│   │   ├── security-boundary.js  # Secure communication
│   │   └── secure-plugin-runner.js # Plugin isolation
│   ├── integration/              # Integration components
│   │   ├── plugin-usb-capability.js # USB plugin integration
│   │   └── usb-event-bridge.js   # Event bridging
│   └── utils/                    # Shared utilities
│       ├── logger.js             # Structured logging
│       ├── validation.js         # Input validation
│       └── retry.js              # Retry mechanisms
├── tests/                        # Test suites
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   ├── e2e/                     # End-to-end tests
│   ├── performance/              # Performance tests
│   └── fixtures/                 # Test data
├── docs/                         # Documentation
├── config/                       # Configuration files
├── scripts/                      # Development scripts
├── examples/                     # Example plugins
└── monitoring/                   # Monitoring configurations
```

### Key Files and Their Purpose
```bash
# Core Component Files
src/usb/usb-daemon.js                 # USB hot-plug detection engine
src/security/plugin-security-manager.js # Plugin security orchestrator
src/security/security-monitor.js       # Real-time threat monitoring
src/security/resource-enforcer.js      # Resource limit enforcement
src/security/security-boundary.js      # Secure plugin communication

# Configuration Files
config/usb-daemon.js                  # USB daemon configuration
config/plugin-security.js             # Security policies and settings
config/performance.js                 # Performance tuning parameters
.env.development                      # Development environment variables

# Test Files
tests/unit/usb-daemon.test.js         # USB daemon unit tests
tests/integration/security.test.js     # Security integration tests
tests/performance/sprint1.test.js      # Performance validation tests
tests/e2e/plugin-lifecycle.test.js     # Full plugin lifecycle tests

# Build and Development
package.json                          # Dependencies and scripts
jest.config.sprint1.js               # Sprint 1 test configuration
.eslintrc.js                         # Code quality rules
.prettierrc                          # Code formatting rules
```

## 📝 Coding Standards

### JavaScript/TypeScript Standards

#### Code Style
```javascript
// Use modern ES6+ features
const { USBDaemon } = require('./usb-daemon');

// Prefer const over let, avoid var
const config = {
  redis: { host: 'localhost', port: 6379 },
  monitoring: { enabled: true }
};

// Use descriptive variable names
const connectedDevices = new Map();
const securityViolations = [];

// Use template literals for string interpolation
console.log(`Device ${device.manufacturer} ${device.product} connected`);

// Use arrow functions for callbacks
devices.filter(device => device.vendorId === 0x05ac)
       .map(device => device.signature);

// Use async/await over Promises
async function loadPlugin(pluginPath) {
  try {
    const manifest = await fs.readFile(manifestPath, 'utf8');
    const validated = await validateManifest(manifest);
    return validated;
  } catch (error) {
    logger.error('Plugin load failed', { pluginPath, error: error.message });
    throw error;
  }
}
```

#### Error Handling
```javascript
// Always use try-catch for async operations
async function processUSBEvent(event) {
  try {
    const device = await extractDeviceInfo(event);
    await publishToRedis(device);
  } catch (error) {
    // Log with context
    logger.error('USB event processing failed', {
      event: event.type,
      error: error.message,
      stack: error.stack
    });
    
    // Re-throw if critical
    if (error.code === 'CRITICAL') {
      throw error;
    }
  }
}

// Use custom error classes
class PluginSecurityError extends Error {
  constructor(message, pluginId, violationType) {
    super(message);
    this.name = 'PluginSecurityError';
    this.pluginId = pluginId;
    this.violationType = violationType;
  }
}
```

#### Documentation Standards
```javascript
/**
 * USB Daemon - Monitors USB device hot-plug events
 * 
 * @class USBDaemon
 * @extends EventEmitter
 * @example
 * const daemon = new USBDaemon({
 *   redis: { host: 'localhost', port: 6379 },
 *   performance: { debounce_ms: 50 }
 * });
 * 
 * await daemon.start();
 * daemon.on('device:attach', (device) => {
 *   console.log('Device attached:', device.signature);
 * });
 */
class USBDaemon extends EventEmitter {
  /**
   * Handle device attachment
   * 
   * @param {USBDevice} device - USB device object from node-usb
   * @returns {Promise<void>}
   * @throws {USBError} When device extraction fails
   * @private
   */
  async handleDeviceAttach(device) {
    // Implementation
  }
  
  /**
   * Generate unique device signature
   * 
   * @param {USBDeviceInfo} deviceInfo - Extracted device information
   * @returns {string} 16-character hex signature
   * @since 1.0.0
   */
  generateDeviceSignature(deviceInfo) {
    // Implementation
  }
}
```

### Performance Standards

#### Memory Management
```javascript
// Use object pooling for frequently created objects
class DeviceInfoPool {
  constructor(size = 100) {
    this.pool = [];
    this.maxSize = size;
  }
  
  acquire() {
    return this.pool.pop() || new USBDeviceInfo();
  }
  
  release(deviceInfo) {
    if (this.pool.length < this.maxSize) {
      deviceInfo.reset(); // Clear previous data
      this.pool.push(deviceInfo);
    }
  }
}

// Avoid memory leaks with proper cleanup
class PluginManager {
  constructor() {
    this.workers = new Map();
    this.timers = new Set();
    this.listeners = new Map();
  }
  
  async cleanup() {
    // Clear all timers
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    
    // Remove all listeners
    this.listeners.forEach((listeners, emitter) => {
      listeners.forEach(({ event, handler }) => {
        emitter.removeListener(event, handler);
      });
    });
    this.listeners.clear();
    
    // Terminate workers
    for (const [id, worker] of this.workers) {
      await worker.terminate();
    }
    this.workers.clear();
  }
}
```

#### Asynchronous Programming
```javascript
// Use Promise.all for concurrent operations
async function loadMultiplePlugins(pluginPaths) {
  const loadPromises = pluginPaths.map(async (path) => {
    try {
      return await loadPlugin(path);
    } catch (error) {
      logger.warn('Plugin load failed', { path, error: error.message });
      return null;
    }
  });
  
  const results = await Promise.all(loadPromises);
  return results.filter(result => result !== null);
}

// Use Promise.allSettled for independent operations
async function processDevices(devices) {
  const promises = devices.map(device => processDevice(device));
  const results = await Promise.allSettled(promises);
  
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error('Device processing failed', {
        device: devices[index].signature,
        error: result.reason.message
      });
    }
  });
}
```

## 🧪 Testing Strategy

### Test Structure

#### Unit Tests
```javascript
// tests/unit/usb-daemon.test.js
const USBDaemon = require('../../src/usb/usb-daemon');
const EventEmitter = require('events');

describe('USBDaemon', () => {
  let daemon;
  let mockUSB;
  
  beforeEach(() => {
    mockUSB = new EventEmitter();
    daemon = new USBDaemon({
      redis: { host: 'localhost', port: 6379 }
    });
    
    // Mock node-usb
    jest.mock('usb', () => mockUSB);
  });
  
  afterEach(async () => {
    if (daemon.isRunning) {
      await daemon.stop();
    }
    jest.clearAllMocks();
  });
  
  describe('Device Detection', () => {
    it('should detect device attachment', async () => {
      const mockDevice = {
        deviceDescriptor: {
          idVendor: 0x05ac,
          idProduct: 0x024f
        },
        busNumber: 1,
        deviceAddress: 2
      };
      
      const attachPromise = new Promise((resolve) => {
        daemon.once('device:attach', resolve);
      });
      
      await daemon.start();
      mockUSB.emit('attach', mockDevice);
      
      const attachedDevice = await attachPromise;
      expect(attachedDevice.vendorId).toBe(0x05ac);
      expect(attachedDevice.productId).toBe(0x024f);
    });
    
    it('should prevent duplicate device events', async () => {
      const mockDevice = createMockDevice();
      let eventCount = 0;
      
      daemon.on('device:attach', () => eventCount++);
      
      await daemon.start();
      
      // Emit same device multiple times
      mockUSB.emit('attach', mockDevice);
      mockUSB.emit('attach', mockDevice);
      mockUSB.emit('attach', mockDevice);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(eventCount).toBe(1);
    });
  });
  
  describe('Performance', () => {
    it('should handle 1000 attach/detach cycles without memory leak', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const mockDevice = createMockDevice();
      
      await daemon.start();
      
      for (let i = 0; i < 1000; i++) {
        mockUSB.emit('attach', mockDevice);
        mockUSB.emit('detach', mockDevice);
      }
      
      // Force garbage collection
      if (global.gc) global.gc();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;
      
      expect(memoryGrowth).toBeLessThan(1024 * 1024); // <1MB
    }, 30000);
  });
});
```

#### Integration Tests
```javascript
// tests/integration/plugin-security.test.js
const PluginSecurityManager = require('../../src/security/plugin-security-manager');
const path = require('path');
const fs = require('fs').promises;

describe('Plugin Security Integration', () => {
  let securityManager;
  let testPluginPath;
  
  beforeAll(async () => {
    // Create test plugin
    testPluginPath = path.join(__dirname, '../fixtures/test-plugin');
    await createTestPlugin(testPluginPath);
    
    securityManager = new PluginSecurityManager({
      securityLevel: 'high',
      pluginDirectory: path.dirname(testPluginPath),
      sandboxDirectory: path.join(__dirname, '../.test-sandbox')
    });
    
    await securityManager.initialize();
  });
  
  afterAll(async () => {
    await securityManager.cleanup();
    await fs.rmdir(testPluginPath, { recursive: true });
  });
  
  describe('Plugin Lifecycle', () => {
    it('should load, start, and stop plugin securely', async () => {
      // Load plugin
      const pluginId = await securityManager.loadPlugin(testPluginPath);
      expect(pluginId).toBeDefined();
      
      // Start plugin
      await securityManager.startPlugin(pluginId);
      
      const status = securityManager.getSecurityStatus();
      expect(status.plugins.active).toBe(1);
      
      // Send message to plugin
      const response = await securityManager.sendPluginMessage(pluginId, {
        type: 'ping'
      });
      expect(response.type).toBe('pong');
      
      // Stop plugin
      await securityManager.stopPlugin(pluginId);
      
      const finalStatus = securityManager.getSecurityStatus();
      expect(finalStatus.plugins.active).toBe(0);
    });
    
    it('should block malicious plugin behavior', async () => {
      const maliciousPluginPath = await createMaliciousPlugin();
      
      const pluginId = await securityManager.loadPlugin(maliciousPluginPath);
      await securityManager.startPlugin(pluginId);
      
      // Trigger malicious behavior
      await securityManager.sendPluginMessage(pluginId, {
        type: 'consume_memory',
        size: 1024 * 1024 * 1024 // 1GB
      });
      
      // Wait for security response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const status = securityManager.getSecurityStatus();
      expect(status.plugins.blocked).toBe(1);
    });
  });
});
```

#### Performance Tests
```javascript
// tests/performance/sprint1-benchmarks.test.js
const { performance } = require('perf_hooks');
const USBDaemon = require('../../src/usb/usb-daemon');
const PluginSecurityManager = require('../../src/security/plugin-security-manager');

describe('Sprint 1 Performance Benchmarks', () => {
  describe('USB Daemon Performance', () => {
    it('should process USB events with <100ms latency', async () => {
      const daemon = new USBDaemon(testConfig);
      const latencies = [];
      
      daemon.on('device:attach', (device) => {
        const latency = performance.now() - device.timestamp;
        latencies.push(latency);
      });
      
      await daemon.start();
      
      // Simulate 100 USB events
      for (let i = 0; i < 100; i++) {
        const device = createMockDevice();
        device.timestamp = performance.now();
        
        await daemon.handleDeviceAttach(device);
      }
      
      const p95Latency = calculatePercentile(latencies, 95);
      expect(p95Latency).toBeLessThan(100); // <100ms p95
      
      await daemon.stop();
    });
  });
  
  describe('Plugin Loading Performance', () => {
    it('should load plugins in <250ms', async () => {
      const securityManager = new PluginSecurityManager(testConfig);
      await securityManager.initialize();
      
      const loadTimes = [];
      
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        
        const pluginId = await securityManager.loadPlugin(testPluginPath);
        await securityManager.startPlugin(pluginId);
        
        const loadTime = performance.now() - start;
        loadTimes.push(loadTime);
        
        await securityManager.stopPlugin(pluginId);
      }
      
      const averageLoadTime = loadTimes.reduce((a, b) => a + b) / loadTimes.length;
      expect(averageLoadTime).toBeLessThan(250); // <250ms average
      
      await securityManager.cleanup();
    });
  });
});
```

### Running Tests

#### Development Testing
```bash
# Run all Sprint 1 tests
npm run test:sprint1

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test tests/unit/usb-daemon.test.js

# Run tests with debugging
npm run test:debug
```

#### Continuous Integration Testing
```bash
# Run CI test suite
npm run test:ci

# Performance validation
npm run test:performance:ci

# Security validation
npm run test:security

# Cross-platform testing
npm run test:cross-platform
```

#### Test Configuration
```javascript
// jest.config.sprint1.js
module.exports = {
  displayName: 'AutoWeave Sprint 1',
  testEnvironment: 'node',
  
  // Test patterns
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/performance/**/*.test.js'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/usb/**/*.js',
    'src/security/**/*.js',
    'src/integration/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/usb/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/security/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup-sprint1.js'],
  globalTeardown: '<rootDir>/tests/teardown-sprint1.js',
  
  // Timeouts
  testTimeout: 30000,
  
  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  
  // Performance testing
  reporters: [
    'default',
    ['jest-junit', { outputDirectory: 'test-results', outputName: 'junit.xml' }],
    ['jest-performance-reporter', { outputFile: 'test-results/performance.json' }]
  ]
};
```

## 🐛 Debugging Guide

### Development Debugging

#### Debug Configuration
```javascript
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug AutoWeave Sprint 1",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.js",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "autoweave:*",
        "USB_DAEMON_LOG_LEVEL": "debug"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "name": "Debug USB Daemon",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/usb/usb-daemon.js",
      "env": {
        "DEBUG": "autoweave:usb:*"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Plugin Security",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/security/plugin-security-manager.js",
      "env": {
        "DEBUG": "autoweave:security:*"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--no-cache",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

#### Logging Strategy
```javascript
// src/utils/dev-logger.js
const winston = require('winston');
const path = require('path');

// Development logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
  ),
  
  transports: [
    // Console output with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File output for debugging
    new winston.transports.File({
      filename: path.join('logs/dev', 'debug.log'),
      level: 'debug'
    }),
    
    // Error file
    new winston.transports.File({
      filename: path.join('logs/dev', 'error.log'),
      level: 'error'
    })
  ]
});

// Development helpers
logger.debugUSB = (message, device) => {
  logger.debug(message, {
    component: 'USB',
    deviceSignature: device?.signature,
    vendorId: device?.vendorId,
    productId: device?.productId
  });
};

logger.debugSecurity = (message, pluginId, data) => {
  logger.debug(message, {
    component: 'Security',
    pluginId,
    ...data
  });
};

module.exports = logger;
```

#### USB Debugging
```bash
# Enable USB debugging
export DEBUG=autoweave:usb:*
export USB_LOG_LEVEL=debug

# Monitor USB events at system level
# Linux
sudo journalctl -f | grep -i usb

# Monitor udev events
sudo udevadm monitor --environment --udev

# Test USB device detection
node -e "
const usb = require('usb');
console.log('USB Devices:');
usb.getDeviceList().forEach((device, index) => {
  console.log(\`\${index + 1}. Vendor: 0x\${device.deviceDescriptor.idVendor.toString(16).padStart(4, '0')}, Product: 0x\${device.deviceDescriptor.idProduct.toString(16).padStart(4, '0')}\`);
});
"

# Monitor Redis streams
redis-cli XREAD STREAMS aw:hotplug $

# Monitor plugin events
redis-cli XREAD STREAMS aw:plugins $
```

#### Plugin Debugging
```javascript
// Debugging plugin communication
class DebugPluginSecurityManager extends PluginSecurityManager {
  async sendPluginMessage(pluginId, message) {
    console.log(`[DEBUG] Sending message to ${pluginId}:`, message);
    
    const response = await super.sendPluginMessage(pluginId, message);
    
    console.log(`[DEBUG] Received response from ${pluginId}:`, response);
    
    return response;
  }
  
  handlePluginMessage(data) {
    console.log(`[DEBUG] Plugin message received:`, data);
    
    return super.handlePluginMessage(data);
  }
}

// Plugin worker debugging
// secure-plugin-runner.js (debug version)
const { parentPort, workerData } = require('worker_threads');

// Enable debug mode
const DEBUG_MODE = process.env.NODE_ENV === 'development';

if (DEBUG_MODE) {
  console.log('[PLUGIN DEBUG] Worker started with data:', workerData);
  
  parentPort.on('message', (message) => {
    console.log('[PLUGIN DEBUG] Received message:', message);
  });
}
```

### Performance Debugging

#### Memory Analysis
```bash
# Enable memory debugging
node --inspect --expose-gc src/index.js

# Use Chrome DevTools
# 1. Open chrome://inspect
# 2. Click "Open dedicated DevTools for Node"
# 3. Go to Memory tab
# 4. Take heap snapshots

# Use clinic.js for automated analysis
npm install -g clinic

# Memory profiling
clinic doctor -- node src/index.js

# Heap profiling
clinic heapprofiler -- node src/index.js

# CPU profiling
clinic flame -- node src/index.js
```

#### Performance Profiling
```javascript
// Performance monitoring in development
const { performance, PerformanceObserver } = require('perf_hooks');

// Monitor specific operations
const obs = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    console.log(`${entry.name}: ${entry.duration}ms`);
    
    // Alert on slow operations
    if (entry.duration > 100) {
      console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`);
    }
  });
});

obs.observe({ entryTypes: ['measure'] });

// Measure USB event processing
async function measureUSBProcessing(device) {
  performance.mark('usb-start');
  
  await processUSBDevice(device);
  
  performance.mark('usb-end');
  performance.measure('USB Processing', 'usb-start', 'usb-end');
}
```

## 🤝 Contribution Guidelines

### Git Workflow

#### Branch Strategy
```bash
# Main branches
main              # Production-ready code
develop           # Integration branch for features
sprint-1          # Sprint 1 specific development

# Feature branches
feature/usb-optimization        # USB performance improvements
feature/security-enhancement    # Security feature additions
fix/memory-leak-usb            # Bug fixes
hotfix/critical-security       # Critical security fixes

# Branch naming convention
feature/<component>-<description>
fix/<issue>-<brief-description>
hotfix/<severity>-<description>
```

#### Commit Standards
```bash
# Commit message format
<type>(<scope>): <subject>

<body>

<footer>

# Types
feat:     New feature
fix:      Bug fix
docs:     Documentation only changes
style:    Changes that do not affect the meaning of the code
refactor: Code change that neither fixes a bug nor adds a feature
perf:     Performance improvement
test:     Adding missing tests
chore:    Changes to build process or auxiliary tools

# Examples
feat(usb): add device signature caching for duplicate detection

Implement SHA-256 based device signatures to prevent duplicate
events when the same device is detected multiple times rapidly.

- Add generateDeviceSignature method
- Add signature-based deduplication
- Update tests for signature validation

Closes #123
Performance: reduces duplicate events by 95%

fix(security): resolve memory leak in plugin worker cleanup

Worker threads were not being properly terminated when plugins
were stopped, causing memory accumulation over time.

- Add explicit worker.terminate() calls
- Clear worker references from memory
- Add cleanup verification in tests

Fixes #456
Memory: reduces growth from 2.5MB to 0.3MB per 1000 cycles
```

#### Pull Request Process
```bash
# 1. Create feature branch
git checkout -b feature/usb-performance-optimization

# 2. Make changes with proper commits
git add .
git commit -m "feat(usb): implement object pooling for device info"

# 3. Keep branch updated
git fetch origin
git rebase origin/develop

# 4. Run tests before PR
npm run test:sprint1
npm run lint
npm run test:performance

# 5. Create PR with proper description
# Title: feat(usb): implement object pooling for device info
# Description:
# - Implements object pool for USBDeviceInfo objects
# - Reduces garbage collection pressure by 70%
# - Maintains backward compatibility
# - Includes comprehensive test coverage
#
# Performance Impact:
# - Memory usage: -40% sustained
# - GC frequency: -70%
# - Event processing: +15% throughput
#
# Breaking Changes: None
```

### Code Review Guidelines

#### Reviewer Checklist
```markdown
## Code Review Checklist

### Functionality ✓
- [ ] Code solves the stated problem
- [ ] Edge cases are handled
- [ ] Error conditions are properly managed
- [ ] Performance requirements are met

### Code Quality ✓
- [ ] Code follows established patterns
- [ ] Functions are single-purpose and focused
- [ ] Variable names are descriptive
- [ ] Comments explain why, not what

### Security ✓
- [ ] Input validation is implemented
- [ ] No secrets in code
- [ ] Permissions are properly checked
- [ ] Security best practices followed

### Testing ✓
- [ ] Unit tests cover new functionality
- [ ] Integration tests verify component interaction
- [ ] Performance tests validate requirements
- [ ] All tests pass

### Documentation ✓
- [ ] README updated if needed
- [ ] API documentation updated
- [ ] Code comments are accurate
- [ ] Breaking changes documented
```

#### Review Response Guidelines
```bash
# Addressing review feedback
git checkout feature/my-feature

# Make requested changes
# ... edit files ...

# Commit changes
git add .
git commit -m "refactor(usb): address review feedback on error handling"

# Force push if rebasing (use with caution)
git push --force-with-lease origin feature/my-feature

# Respond to comments
# - Mark resolved comments as resolved
# - Reply to questions with detailed explanations
# - Thank reviewers for their time and suggestions
```

### Quality Assurance

#### Pre-commit Hooks
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "Running pre-commit checks..."

# Lint staged files
npx lint-staged

# Run affected tests
npm run test:changed

# Validate commit message
npx commitlint --edit $1

echo "Pre-commit checks passed!"
```

#### Continuous Integration
```yaml
# .github/workflows/sprint1-ci.yml
name: Sprint 1 CI

on:
  pull_request:
    branches: [develop, main]
    paths:
      - 'src/usb/**'
      - 'src/security/**'
      - 'src/integration/**'
      - 'tests/**'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run test:sprint1
      - run: npm run test:coverage
      
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:performance
      - name: Validate performance targets
        run: |
          node scripts/validate-performance-targets.js

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit --audit-level=high
      - run: npm run security:scan
```

This comprehensive developer guide provides all the tools, standards, and processes needed for effective contribution to AutoWeave Sprint 1, ensuring high code quality, performance, and security standards.