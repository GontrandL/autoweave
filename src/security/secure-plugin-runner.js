/**
 * Secure Plugin Runner with VM2 Integration
 * Implements a secure sandbox for plugin execution with Worker Thread isolation
 */

const { Worker, parentPort, workerData } = require('worker_threads');
const { VM, VMScript } = require('vm2');
const EventEmitter = require('events');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * Secure Plugin Runner - Executes plugins in isolated VM2 sandbox
 */
class SecurePluginRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      timeout: options.timeout || 30000, // 30 seconds default
      memory: options.memory || 128 * 1024 * 1024, // 128MB default
      fixAsync: false, // Disable async fix for security
      wasm: false, // Disable WebAssembly
      eval: false, // Disable eval
      wrapper: 'none', // No wrapper for strict isolation
      ...options
    };
    
    this.pluginId = null;
    this.sessionId = crypto.randomUUID();
    this.startTime = Date.now();
    this.resourceMonitor = null;
    this.blockedGlobals = new Set([
      'process', 'require', 'module', 'exports', '__dirname', '__filename',
      'Buffer', 'global', 'root', 'child_process', 'cluster', 'dgram',
      'dns', 'fs', 'http', 'https', 'net', 'os', 'path', 'querystring',
      'readline', 'repl', 'stream', 'string_decoder', 'tls', 'tty',
      'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib'
    ]);
  }

  /**
   * Initialize the secure sandbox environment
   */
  async initialize(pluginManifest) {
    this.pluginId = pluginManifest.name;
    
    // Create secure console implementation
    const secureConsole = this.createSecureConsole();
    
    // Create secure timer implementations
    const secureTimers = this.createSecureTimers();
    
    // Create module mocks with permission checks
    const secureMocks = this.createSecureMocks(pluginManifest.permissions);
    
    // Build sandbox context
    this.sandbox = {
      console: secureConsole,
      setTimeout: secureTimers.setTimeout,
      setInterval: secureTimers.setInterval,
      clearTimeout: secureTimers.clearTimeout,
      clearInterval: secureTimers.clearInterval,
      Promise: Promise,
      Date: Date,
      Math: Math,
      JSON: JSON,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      RangeError: RangeError,
      ReferenceError: ReferenceError,
      SyntaxError: SyntaxError,
      // Plugin API
      autoweave: secureMocks.autoweave,
      // Restricted globals
      ...this.createRestrictedGlobals()
    };
    
    // Initialize VM
    this.vm = new VM({
      timeout: this.options.timeout,
      sandbox: this.sandbox,
      fixAsync: this.options.fixAsync,
      wasm: this.options.wasm,
      eval: this.options.eval,
      wrapper: this.options.wrapper
    });
    
    // Start resource monitoring
    this.startResourceMonitoring();
    
    this.emit('initialized', {
      pluginId: this.pluginId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create secure console implementation
   */
  createSecureConsole() {
    const levels = ['log', 'info', 'warn', 'error', 'debug'];
    const secureConsole = {};
    
    levels.forEach(level => {
      secureConsole[level] = (...args) => {
        const sanitized = args.map(arg => this.sanitizeOutput(arg));
        this.emit('console', {
          level,
          message: sanitized,
          pluginId: this.pluginId,
          timestamp: new Date().toISOString()
        });
      };
    });
    
    return secureConsole;
  }

  /**
   * Create secure timer implementations
   */
  createSecureTimers() {
    const timers = new Map();
    let timerId = 0;
    
    return {
      setTimeout: (callback, delay, ...args) => {
        if (typeof callback !== 'function') {
          throw new TypeError('Callback must be a function');
        }
        
        const id = ++timerId;
        const maxDelay = Math.min(delay, this.options.timeout);
        
        const timer = setTimeout(() => {
          timers.delete(id);
          try {
            callback(...args);
          } catch (error) {
            this.handleError(error, 'Timer callback error');
          }
        }, maxDelay);
        
        timers.set(id, timer);
        return id;
      },
      
      setInterval: (callback, interval, ...args) => {
        if (typeof callback !== 'function') {
          throw new TypeError('Callback must be a function');
        }
        
        const id = ++timerId;
        const maxInterval = Math.max(100, Math.min(interval, 60000)); // 100ms - 60s
        
        const timer = setInterval(() => {
          try {
            callback(...args);
          } catch (error) {
            this.handleError(error, 'Interval callback error');
            clearInterval(timer);
            timers.delete(id);
          }
        }, maxInterval);
        
        timers.set(id, timer);
        return id;
      },
      
      clearTimeout: (id) => {
        const timer = timers.get(id);
        if (timer) {
          clearTimeout(timer);
          timers.delete(id);
        }
      },
      
      clearInterval: (id) => {
        const timer = timers.get(id);
        if (timer) {
          clearInterval(timer);
          timers.delete(id);
        }
      }
    };
  }

  /**
   * Create secure mocks with permission checks
   */
  createSecureMocks(permissions = {}) {
    return {
      autoweave: {
        // File system access with permission checks
        fs: this.createSecureFS(permissions.filesystem || []),
        
        // Network access with throttling
        http: this.createSecureHTTP(permissions.network || {}),
        
        // Memory storage with limits
        storage: this.createSecureStorage(permissions.memory || {}),
        
        // Queue access with permission checks
        queue: this.createSecureQueue(permissions.queue || []),
        
        // Plugin metadata
        plugin: {
          id: this.pluginId,
          version: workerData?.manifest?.version || '1.0.0',
          permissions: permissions
        },
        
        // Event emission (limited)
        emit: (event, data) => {
          this.emit('plugin-event', {
            event,
            data,
            pluginId: this.pluginId,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  /**
   * Create secure file system API
   */
  createSecureFS(allowedPaths) {
    const isPathAllowed = (requestedPath) => {
      const normalized = path.normalize(requestedPath);
      return allowedPaths.some(allowed => {
        const allowedNorm = path.normalize(allowed.path);
        return normalized.startsWith(allowedNorm);
      });
    };
    
    return {
      readFile: async (filePath) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }
        
        this.emit('fs-access', {
          operation: 'read',
          path: filePath,
          pluginId: this.pluginId
        });
        
        return await fs.readFile(filePath, 'utf8');
      },
      
      writeFile: async (filePath, data) => {
        if (!isPathAllowed(filePath)) {
          throw new Error(`Access denied: ${filePath}`);
        }
        
        const permission = allowedPaths.find(p => 
          path.normalize(filePath).startsWith(path.normalize(p.path))
        );
        
        if (!permission || permission.mode !== 'readwrite') {
          throw new Error(`Write access denied: ${filePath}`);
        }
        
        this.emit('fs-access', {
          operation: 'write',
          path: filePath,
          size: data.length,
          pluginId: this.pluginId
        });
        
        await fs.writeFile(filePath, data, 'utf8');
      }
    };
  }

  /**
   * Create secure HTTP client with rate limiting
   */
  createSecureHTTP(networkPermissions) {
    const requestCount = new Map();
    const resetInterval = 60000; // 1 minute
    
    // Reset counters periodically
    setInterval(() => {
      requestCount.clear();
    }, resetInterval);
    
    return {
      request: async (url, options = {}) => {
        const hostname = new URL(url).hostname;
        
        // Check if host is allowed
        if (networkPermissions.allowedHosts && 
            !networkPermissions.allowedHosts.includes(hostname)) {
          throw new Error(`Network access denied: ${hostname}`);
        }
        
        // Rate limiting
        const count = requestCount.get(hostname) || 0;
        const limit = networkPermissions.rateLimit || 60;
        
        if (count >= limit) {
          throw new Error(`Rate limit exceeded for ${hostname}`);
        }
        
        requestCount.set(hostname, count + 1);
        
        this.emit('network-access', {
          url,
          method: options.method || 'GET',
          pluginId: this.pluginId
        });
        
        // Simulated HTTP request (would use actual implementation)
        return {
          status: 200,
          data: 'Mock response',
          headers: {}
        };
      }
    };
  }

  /**
   * Create secure storage with memory limits
   */
  createSecureStorage(memoryPermissions) {
    const storage = new Map();
    const maxSize = memoryPermissions.max_storage_mb || 10;
    let currentSize = 0;
    
    const calculateSize = (value) => {
      return Buffer.byteLength(JSON.stringify(value));
    };
    
    return {
      get: (key) => {
        return storage.get(key);
      },
      
      set: (key, value) => {
        const size = calculateSize(value);
        const oldSize = storage.has(key) ? calculateSize(storage.get(key)) : 0;
        const newTotalSize = currentSize - oldSize + size;
        
        if (newTotalSize > maxSize * 1024 * 1024) {
          throw new Error('Storage limit exceeded');
        }
        
        storage.set(key, value);
        currentSize = newTotalSize;
        
        this.emit('storage-access', {
          operation: 'set',
          key,
          size,
          totalSize: currentSize,
          pluginId: this.pluginId
        });
      },
      
      delete: (key) => {
        if (storage.has(key)) {
          const size = calculateSize(storage.get(key));
          storage.delete(key);
          currentSize -= size;
          
          this.emit('storage-access', {
            operation: 'delete',
            key,
            totalSize: currentSize,
            pluginId: this.pluginId
          });
        }
      },
      
      clear: () => {
        storage.clear();
        currentSize = 0;
        
        this.emit('storage-access', {
          operation: 'clear',
          totalSize: 0,
          pluginId: this.pluginId
        });
      }
    };
  }

  /**
   * Create secure queue access
   */
  createSecureQueue(allowedQueues) {
    return {
      publish: (queueName, message) => {
        if (!allowedQueues.includes(queueName)) {
          throw new Error(`Queue access denied: ${queueName}`);
        }
        
        this.emit('queue-access', {
          operation: 'publish',
          queue: queueName,
          messageSize: Buffer.byteLength(JSON.stringify(message)),
          pluginId: this.pluginId
        });
        
        // Forward to main thread
        parentPort.postMessage({
          type: 'queue-publish',
          queue: queueName,
          message,
          pluginId: this.pluginId
        });
      },
      
      subscribe: (queueName, callback) => {
        if (!allowedQueues.includes(queueName)) {
          throw new Error(`Queue access denied: ${queueName}`);
        }
        
        this.emit('queue-access', {
          operation: 'subscribe',
          queue: queueName,
          pluginId: this.pluginId
        });
        
        // Register callback for queue messages
        this.on(`queue-message-${queueName}`, callback);
      }
    };
  }

  /**
   * Create restricted global objects
   */
  createRestrictedGlobals() {
    const restricted = {};
    
    // Add safe global functions
    restricted.parseInt = parseInt;
    restricted.parseFloat = parseFloat;
    restricted.isNaN = isNaN;
    restricted.isFinite = isFinite;
    restricted.decodeURI = decodeURI;
    restricted.encodeURI = encodeURI;
    restricted.decodeURIComponent = decodeURIComponent;
    restricted.encodeURIComponent = encodeURIComponent;
    
    return restricted;
  }

  /**
   * Execute plugin code in sandbox
   */
  async execute(code, context = {}) {
    try {
      // Inject context into sandbox
      Object.assign(this.sandbox, context);
      
      // Create script
      const script = new VMScript(code, {
        filename: `${this.pluginId}.js`,
        lineOffset: 0,
        columnOffset: 0
      });
      
      // Execute in VM
      const result = await this.vm.run(script);
      
      this.emit('execution', {
        pluginId: this.pluginId,
        success: true,
        duration: Date.now() - this.startTime
      });
      
      return result;
    } catch (error) {
      this.handleError(error, 'Execution error');
      throw error;
    }
  }

  /**
   * Handle plugin errors
   */
  handleError(error, context = '') {
    const sanitizedError = {
      message: error.message,
      type: error.constructor.name,
      context,
      pluginId: this.pluginId,
      timestamp: new Date().toISOString()
    };
    
    this.emit('error', sanitizedError);
    
    // Log to secure console
    this.sandbox.console.error(`[${context}] ${error.message}`);
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    this.resourceMonitor = setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.emit('resource-usage', {
        memory: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          arrayBuffers: usage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        pluginId: this.pluginId,
        timestamp: new Date().toISOString()
      });
      
      // Check memory limit
      if (usage.heapUsed > this.options.memory) {
        this.emit('resource-limit', {
          type: 'memory',
          limit: this.options.memory,
          current: usage.heapUsed,
          pluginId: this.pluginId
        });
        
        // Trigger cleanup
        this.cleanup();
      }
    }, 1000); // Check every second
  }

  /**
   * Sanitize output to prevent injection
   */
  sanitizeOutput(value) {
    if (typeof value === 'string') {
      return value.substring(0, 1000); // Limit string length
    } else if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2).substring(0, 1000);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
    
    this.emit('cleanup', {
      pluginId: this.pluginId,
      sessionId: this.sessionId,
      duration: Date.now() - this.startTime
    });
    
    // Clear sandbox
    this.sandbox = null;
    this.vm = null;
  }
}

// Worker thread entry point
if (parentPort) {
  const runner = new SecurePluginRunner(workerData?.options || {});
  
  // Forward events to parent
  runner.on('console', data => parentPort.postMessage({ type: 'console', data }));
  runner.on('error', data => parentPort.postMessage({ type: 'error', data }));
  runner.on('resource-usage', data => parentPort.postMessage({ type: 'resource-usage', data }));
  runner.on('plugin-event', data => parentPort.postMessage({ type: 'plugin-event', data }));
  
  // Handle messages from parent
  parentPort.on('message', async (message) => {
    try {
      switch (message.type) {
        case 'initialize':
          await runner.initialize(message.manifest);
          parentPort.postMessage({ type: 'initialized', success: true });
          break;
          
        case 'execute':
          const result = await runner.execute(message.code, message.context);
          parentPort.postMessage({ type: 'result', data: result });
          break;
          
        case 'cleanup':
          runner.cleanup();
          parentPort.postMessage({ type: 'cleaned', success: true });
          break;
          
        case 'queue-message':
          runner.emit(`queue-message-${message.queue}`, message.data);
          break;
          
        default:
          parentPort.postMessage({ 
            type: 'error', 
            error: `Unknown message type: ${message.type}` 
          });
      }
    } catch (error) {
      parentPort.postMessage({ 
        type: 'error', 
        error: error.message 
      });
    }
  });
}

module.exports = SecurePluginRunner;