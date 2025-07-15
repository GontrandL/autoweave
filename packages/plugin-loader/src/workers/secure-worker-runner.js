const { createRequire } = require('module');
const path = require('path');
const { parentPort, workerData } = require('worker_threads');

const { VM } = require('vm2');

class SecurePluginSandbox {
  constructor() {
    this.manifest = workerData.manifest;
    this.pluginPath = workerData.pluginPath;
    this.permissions = workerData.permissions;
    this.plugin = null;
    this.vm = null;
    this.setupSandbox();
  }

  setupSandbox() {
    // Create custom require for the plugin
    const pluginRequire = createRequire(path.join(this.pluginPath, 'package.json'));
    
    // Create VM2 sandbox with strict security
    this.vm = new VM({
      timeout: 1000, // 1 second execution timeout for each call
      sandbox: this.createSandboxGlobals(),
      require: {
        external: this.createSecureRequire(pluginRequire),
        builtin: this.getAllowedBuiltins(),
        root: this.pluginPath,
        mock: this.createMockedModules()
      },
      wrapper: 'none',
      wasm: false // Disable WebAssembly
    });

    // Send ready signal
    parentPort.postMessage({ type: 'READY' });
  }

  createSandboxGlobals() {
    return {
      console: this.createSecureConsole(),
      process: this.createSecureProcess(),
      Buffer: Buffer,
      setTimeout: setTimeout,
      setInterval: setInterval,
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      Promise: Promise,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      Math: Math,
      JSON: JSON,
      Error: Error,
      // Plugin API
      autoweave: this.createPluginAPI()
    };
  }

  createSecureConsole() {
    const log = (level, ...args) => {
      parentPort.postMessage({
        type: 'LOG',
        data: {
          level,
          message: args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
          ).join(' '),
          timestamp: Date.now()
        }
      });
    };

    return {
      log: (...args) => log('info', ...args),
      info: (...args) => log('info', ...args),
      warn: (...args) => log('warn', ...args),
      error: (...args) => log('error', ...args),
      debug: (...args) => log('debug', ...args)
    };
  }

  createSecureProcess() {
    return {
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PLUGIN_NAME: this.manifest.name
      },
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: () => process.uptime(),
      memoryUsage: () => process.memoryUsage(),
      nextTick: process.nextTick
    };
  }

  createPluginAPI() {
    const self = this;
    return {
      getManifest: () => this.manifest,
      getPermissions: () => this.permissions,
      
      // File system API (permission-checked)
      readFile: async (filePath) => {
        const fs = require('fs').promises;
        const normalizedPath = path.normalize(filePath);
        
        // Check permissions
        if (!self.checkFilePermission(normalizedPath, 'read')) {
          throw new Error(`No read permission for path: ${filePath}`);
        }
        
        return fs.readFile(normalizedPath, 'utf8');
      },
      
      writeFile: async (filePath, data) => {
        const fs = require('fs').promises;
        const normalizedPath = path.normalize(filePath);
        
        // Check permissions
        if (!self.checkFilePermission(normalizedPath, 'write')) {
          throw new Error(`No write permission for path: ${filePath}`);
        }
        
        return fs.writeFile(normalizedPath, data);
      },
      
      // Network API (permission-checked)
      fetch: async (url, options = {}) => {
        if (!self.checkNetworkPermission(url)) {
          throw new Error(`No network permission for URL: ${url}`);
        }
        
        const fetch = require('node-fetch');
        return fetch(url, {
          ...options,
          timeout: options.timeout || 30000,
          headers: {
            ...options.headers,
            'User-Agent': `AutoWeave-Plugin/${self.manifest.name}/${self.manifest.version}`
          }
        });
      },
      
      // Event emission
      emit: (eventName, data) => {
        parentPort.postMessage({
          type: 'EVENT',
          data: { eventName, data, timestamp: Date.now() }
        });
      },
      
      // Metrics
      metric: (name, value, tags = {}) => {
        parentPort.postMessage({
          type: 'METRIC',
          data: { name, value, tags, timestamp: Date.now() }
        });
      }
    };
  }

  createSecureRequire(pluginRequire) {
    const self = this;
    return (moduleName) => {
      // Check if module is allowed
      if (!self.checkModulePermission(moduleName)) {
        throw new Error(`Module '${moduleName}' not permitted`);
      }
      
      // Use the plugin's require context
      return pluginRequire(moduleName);
    };
  }

  getAllowedBuiltins() {
    // Only allow safe built-in modules
    return [
      'assert', 'buffer', 'crypto', 'events', 'path', 
      'querystring', 'stream', 'string_decoder', 'url', 'util'
    ];
  }

  createMockedModules() {
    return {
      // Mock dangerous modules
      'fs': {
        readFile: (path, cb) => cb(new Error('fs module not allowed')),
        writeFile: (path, data, cb) => cb(new Error('fs module not allowed'))
      },
      'child_process': {
        exec: () => { throw new Error('child_process not allowed'); },
        spawn: () => { throw new Error('child_process not allowed'); }
      },
      'os': {
        platform: () => process.platform,
        arch: () => process.arch,
        hostname: () => 'plugin-sandbox'
      }
    };
  }

  checkFilePermission(filePath, mode) {
    if (!this.permissions.filesystem) {return false;}
    
    for (const perm of this.permissions.filesystem) {
      if (filePath.startsWith(perm.path)) {
        if (perm.mode === 'readwrite' || perm.mode === mode) {
          return true;
        }
      }
    }
    return false;
  }

  checkNetworkPermission(url) {
    if (!this.permissions.network?.outbound) {return false;}
    
    try {
      const urlObj = new URL(url);
      for (const allowed of this.permissions.network.outbound) {
        const allowedUrl = new URL(allowed);
        if (allowedUrl.hostname === '*' || urlObj.hostname === allowedUrl.hostname) {
          return true;
        }
        // Check wildcard subdomains
        if (allowedUrl.hostname.startsWith('*.')) {
          const domain = allowedUrl.hostname.slice(2);
          if (urlObj.hostname.endsWith(domain)) {
            return true;
          }
        }
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  checkModulePermission(moduleName) {
    // Always allow relative imports
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      return true;
    }
    
    // Check against safe modules list
    const safeModules = [
      'lodash', 'axios', 'moment', 'uuid', 'joi',
      // Add more safe third-party modules as needed
    ];
    
    return safeModules.includes(moduleName);
  }

  async loadPlugin() {
    try {
      const pluginEntryPath = path.join(this.pluginPath, this.manifest.entry);
      const pluginCode = require('fs').readFileSync(pluginEntryPath, 'utf8');
      
      // Run plugin in VM
      this.plugin = this.vm.run(`
        (function() {
          ${pluginCode}
          
          // Return the module exports
          if (typeof module !== 'undefined' && module.exports) {
            return module.exports;
          }
          return {};
        })()
      `);
      
      // Call onLoad hook if defined
      if (this.manifest.hooks.onLoad && this.plugin[this.manifest.hooks.onLoad]) {
        await this.plugin[this.manifest.hooks.onLoad]();
      }

      parentPort.postMessage({ 
        id: 'load-response',
        type: 'LOAD_SUCCESS',
        data: { pluginName: this.manifest.name }
      });
    } catch (error) {
      parentPort.postMessage({ 
        id: 'load-response',
        type: 'LOAD_ERROR',
        error: error.message,
        data: { pluginName: this.manifest.name }
      });
    }
  }

  async unloadPlugin() {
    try {
      // Call onUnload hook if defined
      if (this.manifest.hooks.onUnload && this.plugin?.[this.manifest.hooks.onUnload]) {
        await this.plugin[this.manifest.hooks.onUnload]();
      }
      
      this.plugin = null;
      
      parentPort.postMessage({ 
        id: 'unload-response',
        type: 'UNLOAD_SUCCESS',
        data: { pluginName: this.manifest.name }
      });
    } catch (error) {
      parentPort.postMessage({ 
        id: 'unload-response',
        type: 'UNLOAD_ERROR',
        error: error.message,
        data: { pluginName: this.manifest.name }
      });
    }
  }

  async handleMessage(message) {
    try {
      switch (message.type) {
        case 'LOAD':
          await this.loadPlugin();
          break;
          
        case 'UNLOAD':
          await this.unloadPlugin();
          break;
          
        case 'USB_EVENT':
          await this.handleUSBEvent(message.data);
          break;
          
        case 'JOB_RECEIVED':
          await this.handleJob(message.data);
          break;
          
        case 'SHUTDOWN':
          await this.unloadPlugin();
          process.exit(0);
          break;
          
        default:
          parentPort.postMessage({ 
            id: message.id,
            type: 'ERROR',
            error: `Unknown message type: ${message.type}`
          });
      }
    } catch (error) {
      parentPort.postMessage({ 
        id: message.id,
        type: 'ERROR',
        error: error.message
      });
    }
  }

  async handleUSBEvent(data) {
    const { eventType, deviceInfo } = data;
    const hookName = eventType === 'attach' ? this.manifest.hooks.onUSBAttach : this.manifest.hooks.onUSBDetach;
    
    if (hookName && this.plugin?.[hookName]) {
      const result = await this.plugin[hookName](deviceInfo);
      parentPort.postMessage({ 
        type: 'USB_EVENT_HANDLED',
        data: { eventType, result, pluginName: this.manifest.name }
      });
    }
  }

  async handleJob(jobData) {
    if (this.manifest.hooks.onJobReceived && this.plugin?.[this.manifest.hooks.onJobReceived]) {
      const result = await this.plugin[this.manifest.hooks.onJobReceived](jobData);
      parentPort.postMessage({ 
        type: 'JOB_RESULT',
        data: { result, pluginName: this.manifest.name }
      });
    }
  }
}

// Initialize sandbox
const sandbox = new SecurePluginSandbox();

// Listen for messages from parent
parentPort.on('message', async (message) => {
  await sandbox.handleMessage(message);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    type: 'ERROR',
    error: `Uncaught exception: ${error.message}`,
    data: { stack: error.stack }
  });
});

process.on('unhandledRejection', (reason, promise) => {
  parentPort.postMessage({
    type: 'ERROR',
    error: `Unhandled rejection: ${reason}`,
    data: { promise: String(promise) }
  });
});