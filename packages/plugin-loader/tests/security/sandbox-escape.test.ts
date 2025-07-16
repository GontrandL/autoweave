/**
 * Sandbox Escape Security Tests
 * Tests to ensure plugins cannot escape their security sandbox
 */

import { SecurePluginWorker } from '../../src/workers/secure-plugin-worker';
import { PluginManifest, PluginContext } from '../../src/types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Worker } from 'worker_threads';

// Test directory for malicious plugins
const MALICIOUS_PLUGIN_DIR = path.join(__dirname, '../fixtures/malicious-plugins');

describe('Sandbox Escape Prevention', () => {
  let secureWorker: SecurePluginWorker;

  beforeAll(async () => {
    await fs.mkdir(MALICIOUS_PLUGIN_DIR, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(MALICIOUS_PLUGIN_DIR, { recursive: true, force: true });
  });

  beforeEach(() => {
    secureWorker = new SecurePluginWorker({
      maxMemory: 128 * 1024 * 1024, // 128MB
      maxCpuPercent: 50,
      timeout: 5000,
    });
  });

  afterEach(async () => {
    await secureWorker.terminate();
  });

  describe('filesystem access prevention', () => {
    it('should prevent reading system files', async () => {
      const maliciousCode = `
        const fs = require('fs');
        try {
          const passwd = fs.readFileSync('/etc/passwd', 'utf8');
          module.exports = { passwd };
        } catch (error) {
          module.exports = { error: error.message };
        }
      `;

      const pluginPath = await createMaliciousPlugin('fs-reader', maliciousCode);
      const manifest: PluginManifest = {
        name: 'fs-reader',
        version: '1.0.0',
        entry: './index.js',
        permissions: ['fs:read:/plugins'], // Only plugins directory
      } as any;

      const result = await secureWorker.loadPlugin(pluginPath, manifest);
      
      expect(result.error).toBeDefined();
      expect(result.passwd).toBeUndefined();
    });

    it('should prevent writing to system directories', async () => {
      const maliciousCode = `
        const fs = require('fs');
        try {
          fs.writeFileSync('/tmp/malicious.txt', 'pwned');
          module.exports = { success: true };
        } catch (error) {
          module.exports = { error: error.message };
        }
      `;

      const pluginPath = await createMaliciousPlugin('fs-writer', maliciousCode);
      const manifest: PluginManifest = {
        name: 'fs-writer',
        version: '1.0.0',
        entry: './index.js',
        permissions: ['fs:read:/plugins'],
      } as any;

      const result = await secureWorker.loadPlugin(pluginPath, manifest);
      
      expect(result.error).toBeDefined();
      expect(result.success).toBeUndefined();
      
      // Verify file wasn't created
      await expect(fs.access('/tmp/malicious.txt')).rejects.toThrow();
    });

    it('should prevent path traversal attacks', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/plugins/../../../etc/shadow',
        '/plugins/./../../sensitive',
        '/plugins/%2e%2e%2f%2e%2e%2f',
      ];

      for (const path of traversalAttempts) {
        const code = `
          const fs = require('fs');
          try {
            const data = fs.readFileSync('${path}', 'utf8');
            module.exports = { data };
          } catch (error) {
            module.exports = { error: error.message };
          }
        `;

        const pluginPath = await createMaliciousPlugin(`traversal-${Date.now()}`, code);
        const manifest: PluginManifest = {
          name: 'traversal-plugin',
          version: '1.0.0',
          entry: './index.js',
          permissions: ['fs:read:/plugins'],
        } as any;

        const result = await secureWorker.loadPlugin(pluginPath, manifest);
        
        expect(result.data).toBeUndefined();
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('process/child_process prevention', () => {
    it('should prevent spawning child processes', async () => {
      const maliciousCode = `
        const { spawn, exec, execSync } = require('child_process');
        const results = {};
        
        try {
          const ls = spawn('ls', ['-la', '/']);
          results.spawn = 'success';
        } catch (error) {
          results.spawnError = error.message;
        }
        
        try {
          exec('whoami', (err, stdout) => {
            results.exec = stdout;
          });
        } catch (error) {
          results.execError = error.message;
        }
        
        try {
          const output = execSync('pwd').toString();
          results.execSync = output;
        } catch (error) {
          results.execSyncError = error.message;
        }
        
        module.exports = results;
      `;

      const pluginPath = await createMaliciousPlugin('process-spawner', maliciousCode);
      const manifest: PluginManifest = {
        name: 'process-spawner',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any;

      const result = await secureWorker.loadPlugin(pluginPath, manifest);
      
      expect(result.spawn).toBeUndefined();
      expect(result.exec).toBeUndefined();
      expect(result.execSync).toBeUndefined();
      expect(result.spawnError || result.execError || result.execSyncError).toBeDefined();
    });

    it('should prevent access to process.binding', async () => {
      const maliciousCode = `
        try {
          const processBinding = process.binding('fs');
          const tcp = process.binding('tcp_wrap');
          module.exports = { hasBindings: true };
        } catch (error) {
          module.exports = { error: error.message };
        }
      `;

      const pluginPath = await createMaliciousPlugin('process-binding', maliciousCode);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'process-binding',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      expect(result.hasBindings).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('network access prevention', () => {
    it('should prevent unauthorized network requests', async () => {
      const maliciousCode = `
        const http = require('http');
        const https = require('https');
        const net = require('net');
        const results = {};
        
        // Try HTTP request
        http.get('http://example.com', (res) => {
          results.httpSuccess = true;
        }).on('error', (err) => {
          results.httpError = err.message;
        });
        
        // Try raw socket
        try {
          const socket = net.createConnection(80, 'example.com');
          results.socketSuccess = true;
        } catch (error) {
          results.socketError = error.message;
        }
        
        setTimeout(() => {
          module.exports = results;
        }, 100);
      `;

      const pluginPath = await createMaliciousPlugin('network-access', maliciousCode);
      const manifest: PluginManifest = {
        name: 'network-access',
        version: '1.0.0',
        entry: './index.js',
        permissions: [], // No network permissions
      } as any;

      const result = await secureWorker.loadPlugin(pluginPath, manifest);
      
      expect(result.httpSuccess).toBeUndefined();
      expect(result.socketSuccess).toBeUndefined();
      expect(result.httpError || result.socketError).toBeDefined();
    });

    it('should allow network access with proper permissions', async () => {
      const allowedCode = `
        const https = require('https');
        https.get('https://api.example.com/data', (res) => {
          module.exports = { statusCode: res.statusCode };
        }).on('error', (err) => {
          module.exports = { error: err.message };
        });
      `;

      const pluginPath = await createMaliciousPlugin('network-allowed', allowedCode);
      const manifest: PluginManifest = {
        name: 'network-allowed',
        version: '1.0.0',
        entry: './index.js',
        permissions: ['network:https'],
      } as any;

      const result = await secureWorker.loadPlugin(pluginPath, manifest);
      
      // Should be allowed but may fail due to actual network
      expect(result.statusCode || result.error).toBeDefined();
    });
  });

  describe('global object pollution prevention', () => {
    it('should prevent modifying global objects', async () => {
      const maliciousCode = `
        // Try to pollute Object prototype
        try {
          Object.prototype.polluted = 'hacked';
          Array.prototype.polluted = 'hacked';
          Function.prototype.polluted = 'hacked';
        } catch (error) {
          module.exports = { prototypeError: error.message };
        }
        
        // Try to modify global
        try {
          global.hacked = true;
          global.process.env.HACKED = 'true';
        } catch (error) {
          module.exports = { globalError: error.message };
        }
        
        module.exports = { attempted: true };
      `;

      const pluginPath = await createMaliciousPlugin('global-pollution', maliciousCode);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'global-pollution',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      // Verify prototypes aren't polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect((Array.prototype as any).polluted).toBeUndefined();
      expect((global as any).hacked).toBeUndefined();
      expect(process.env.HACKED).toBeUndefined();
    });

    it('should prevent require cache manipulation', async () => {
      const maliciousCode = `
        try {
          // Try to access and modify require cache
          const cache = require.cache;
          for (const key in cache) {
            delete cache[key];
          }
          
          // Try to override require
          const Module = require('module');
          const originalRequire = Module.prototype.require;
          Module.prototype.require = function(id) {
            return { hacked: true };
          };
          
          module.exports = { cacheCleared: true };
        } catch (error) {
          module.exports = { error: error.message };
        }
      `;

      const pluginPath = await createMaliciousPlugin('require-manipulation', maliciousCode);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'require-manipulation',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      expect(result.cacheCleared).toBeUndefined();
      expect(result.error).toBeDefined();
      
      // Verify require still works normally
      const path = require('path');
      expect(path.join).toBeDefined();
    });
  });

  describe('eval and code generation prevention', () => {
    it('should prevent eval usage', async () => {
      const evalCode = `
        const results = {};
        
        // Direct eval
        try {
          eval('process.exit(1)');
          results.evalSuccess = true;
        } catch (error) {
          results.evalError = error.message;
        }
        
        // Function constructor
        try {
          const fn = new Function('return process.env');
          results.functionSuccess = fn();
        } catch (error) {
          results.functionError = error.message;
        }
        
        // VM module
        try {
          const vm = require('vm');
          const script = new vm.Script('process.exit(1)');
          script.runInThisContext();
          results.vmSuccess = true;
        } catch (error) {
          results.vmError = error.message;
        }
        
        module.exports = results;
      `;

      const pluginPath = await createMaliciousPlugin('eval-usage', evalCode);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'eval-usage',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      expect(result.evalSuccess).toBeUndefined();
      expect(result.functionSuccess).toBeUndefined();
      expect(result.vmSuccess).toBeUndefined();
      expect(result.evalError || result.functionError || result.vmError).toBeDefined();
    });
  });

  describe('resource exhaustion prevention', () => {
    it('should prevent infinite loops', async () => {
      const infiniteCode = `
        // Infinite loop
        while (true) {
          // Consume CPU
        }
        module.exports = { completed: true };
      `;

      const pluginPath = await createMaliciousPlugin('infinite-loop', infiniteCode);
      
      const loadPromise = secureWorker.loadPlugin(pluginPath, {
        name: 'infinite-loop',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      // Should timeout
      await expect(loadPromise).rejects.toThrow('timeout');
    });

    it('should prevent memory exhaustion', async () => {
      const memoryBomb = `
        const arrays = [];
        try {
          while (true) {
            // Allocate 10MB at a time
            arrays.push(new Array(10 * 1024 * 1024 / 8).fill(1));
          }
        } catch (error) {
          module.exports = { error: error.message, allocated: arrays.length };
        }
        module.exports = { allocated: arrays.length };
      `;

      const pluginPath = await createMaliciousPlugin('memory-bomb', memoryBomb);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'memory-bomb',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
        isolation: {
          memoryLimit: '50MB',
        },
      } as any);

      // Should hit memory limit
      expect(result.error).toBeDefined();
      expect(result.allocated).toBeLessThan(20); // Less than 200MB allocated
    });

    it('should prevent fork bombs', async () => {
      const forkBomb = `
        const { Worker } = require('worker_threads');
        try {
          for (let i = 0; i < 1000; i++) {
            new Worker('while(true){}', { eval: true });
          }
          module.exports = { forked: true };
        } catch (error) {
          module.exports = { error: error.message };
        }
      `;

      const pluginPath = await createMaliciousPlugin('fork-bomb', forkBomb);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'fork-bomb',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      expect(result.forked).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe('timing attack prevention', () => {
    it('should prevent high-resolution timing attacks', async () => {
      const timingCode = `
        const results = {};
        
        // Try performance.now()
        try {
          const start = performance.now();
          // Some operation
          const end = performance.now();
          results.performanceResolution = end - start;
        } catch (error) {
          results.performanceError = error.message;
        }
        
        // Try process.hrtime()
        try {
          const start = process.hrtime.bigint();
          // Some operation
          const end = process.hrtime.bigint();
          results.hrtimeResolution = Number(end - start);
        } catch (error) {
          results.hrtimeError = error.message;
        }
        
        module.exports = results;
      `;

      const pluginPath = await createMaliciousPlugin('timing-attack', timingCode);
      const result = await secureWorker.loadPlugin(pluginPath, {
        name: 'timing-attack',
        version: '1.0.0',
        entry: './index.js',
        permissions: [],
      } as any);

      // High-resolution timing should be limited or unavailable
      if (result.performanceResolution !== undefined) {
        expect(result.performanceResolution).toBeGreaterThan(1); // Reduced precision
      }
    });
  });
});

// Helper to create malicious test plugins
async function createMaliciousPlugin(name: string, code: string): Promise<string> {
  const pluginPath = path.join(MALICIOUS_PLUGIN_DIR, name);
  await fs.mkdir(pluginPath, { recursive: true });
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      entry: './index.js',
    })
  );
  
  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    code
  );
  
  return pluginPath;
}