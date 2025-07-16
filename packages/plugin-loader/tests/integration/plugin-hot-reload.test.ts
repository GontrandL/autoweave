/**
 * Plugin Hot Reload Integration Tests
 * Tests plugin loading, unloading, and hot-reload functionality
 */

import { EnhancedPluginManager } from '../../src/enhanced-plugin-manager';
import { PluginManifest } from '../../src/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient, RedisClientType } from 'redis';
import chokidar from 'chokidar';

// Test plugin directory
const TEST_PLUGIN_DIR = path.join(__dirname, '../fixtures/test-plugins');
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

describe('Plugin Hot Reload Integration', () => {
  let pluginManager: EnhancedPluginManager;
  let redisClient: RedisClientType;
  let watcher: chokidar.FSWatcher;

  beforeAll(async () => {
    // Ensure test plugin directory exists
    await fs.mkdir(TEST_PLUGIN_DIR, { recursive: true });
    
    // Setup Redis
    redisClient = createClient({ url: REDIS_URL });
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient?.disconnect();
    // Clean up test plugins
    await fs.rm(TEST_PLUGIN_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    pluginManager = new EnhancedPluginManager({
      pluginDirectory: TEST_PLUGIN_DIR,
      redis: redisClient,
      watchForChanges: true,
      validationStrict: true,
    });

    await pluginManager.initialize();
  });

  afterEach(async () => {
    await pluginManager.shutdown();
  });

  describe('plugin loading', () => {
    it('should load a valid plugin within 250ms', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'fast-plugin');
      await createTestPlugin(pluginPath, {
        name: 'fast-plugin',
        version: '1.0.0',
        entry: './index.js',
      });

      const startTime = performance.now();
      const plugin = await pluginManager.loadPlugin(pluginPath);
      const loadTime = performance.now() - startTime;

      expect(plugin).toBeDefined();
      expect(plugin.manifest.name).toBe('fast-plugin');
      expect(loadTime).toBeLessThan(250);
    });

    it('should validate and reject invalid manifests', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'invalid-plugin');
      await createTestPlugin(pluginPath, {
        name: 'invalid-plugin',
        // Missing required fields
      });

      await expect(pluginManager.loadPlugin(pluginPath)).rejects.toThrow('Invalid manifest');
    });

    it('should verify plugin signatures', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'signed-plugin');
      const { manifest, signature } = await createSignedPlugin(pluginPath, {
        name: 'signed-plugin',
        version: '1.0.0',
        entry: './index.js',
      });

      const plugin = await pluginManager.loadPlugin(pluginPath);
      
      expect(plugin.manifest.signature).toEqual(signature);
      expect(plugin.verified).toBe(true);
    });

    it('should enforce permission boundaries', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'restricted-plugin');
      await createTestPlugin(pluginPath, {
        name: 'restricted-plugin',
        version: '1.0.0',
        entry: './index.js',
        permissions: ['memory:read', 'fs:read:/plugins'],
      });

      const plugin = await pluginManager.loadPlugin(pluginPath);
      
      // Plugin should not be able to access denied resources
      const worker = (plugin as any).worker;
      worker.postMessage({
        type: 'execute',
        action: 'fs:write:/etc/passwd',
        payload: { data: 'malicious' },
      });

      const response = await new Promise((resolve) => {
        worker.once('message', resolve);
      });

      expect(response).toMatchObject({
        type: 'error',
        error: expect.stringContaining('Permission denied'),
      });
    });
  });

  describe('hot reload functionality', () => {
    it('should detect and reload changed plugins', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'hot-reload-plugin');
      
      // Create initial plugin
      await createTestPlugin(pluginPath, {
        name: 'hot-reload-plugin',
        version: '1.0.0',
        entry: './index.js',
        metadata: { iteration: 1 },
      });

      const plugin1 = await pluginManager.loadPlugin(pluginPath);
      expect(plugin1.manifest.metadata?.iteration).toBe(1);

      // Update plugin
      await createTestPlugin(pluginPath, {
        name: 'hot-reload-plugin',
        version: '1.0.1',
        entry: './index.js',
        metadata: { iteration: 2 },
      });

      // Wait for file watcher to detect change
      await new Promise(resolve => setTimeout(resolve, 500));

      // Plugin should be reloaded
      const plugin2 = pluginManager.getPlugin('hot-reload-plugin');
      expect(plugin2?.manifest.version).toBe('1.0.1');
      expect(plugin2?.manifest.metadata?.iteration).toBe(2);
    });

    it('should handle rapid plugin changes gracefully', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'rapid-change-plugin');
      
      // Create initial plugin
      await createTestPlugin(pluginPath, {
        name: 'rapid-change-plugin',
        version: '1.0.0',
        entry: './index.js',
      });

      await pluginManager.loadPlugin(pluginPath);

      // Rapid changes
      for (let i = 1; i <= 10; i++) {
        await createTestPlugin(pluginPath, {
          name: 'rapid-change-plugin',
          version: `1.0.${i}`,
          entry: './index.js',
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Wait for debouncing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have latest version
      const plugin = pluginManager.getPlugin('rapid-change-plugin');
      expect(plugin?.manifest.version).toBe('1.0.10');
      
      // Should not have memory leaks from rapid reloads
      const stats = pluginManager.getStats();
      expect(stats.totalReloads).toBeLessThan(15); // Some reloads were debounced
    });

    it('should maintain plugin state during reload', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'stateful-plugin');
      
      // Create plugin with state hook
      await createTestPlugin(pluginPath, {
        name: 'stateful-plugin',
        version: '1.0.0',
        entry: './index.js',
        hooks: {
          onLoad: './hooks/onLoad.js',
          onUnload: './hooks/onUnload.js',
        },
      }, {
        'hooks/onLoad.js': `
          module.exports = async function onLoad(context) {
            context.setState({ counter: (context.getState()?.counter || 0) + 1 });
          }
        `,
        'hooks/onUnload.js': `
          module.exports = async function onUnload(context) {
            return context.getState();
          }
        `,
      });

      const plugin1 = await pluginManager.loadPlugin(pluginPath);
      
      // Update plugin
      await createTestPlugin(pluginPath, {
        name: 'stateful-plugin',
        version: '1.0.1',
        entry: './index.js',
        hooks: {
          onLoad: './hooks/onLoad.js',
          onUnload: './hooks/onUnload.js',
        },
      }, {
        'hooks/onLoad.js': `
          module.exports = async function onLoad(context) {
            const state = context.getState() || { counter: 0 };
            context.setState({ counter: state.counter + 1 });
          }
        `,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // State should be preserved
      const plugin2 = pluginManager.getPlugin('stateful-plugin');
      const state = await plugin2?.getState();
      expect(state?.counter).toBeGreaterThan(1);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple plugins loading simultaneously', async () => {
      const pluginPromises = Array.from({ length: 10 }, async (_, i) => {
        const pluginPath = path.join(TEST_PLUGIN_DIR, `concurrent-plugin-${i}`);
        await createTestPlugin(pluginPath, {
          name: `concurrent-plugin-${i}`,
          version: '1.0.0',
          entry: './index.js',
        });
        return pluginManager.loadPlugin(pluginPath);
      });

      const plugins = await Promise.all(pluginPromises);
      
      expect(plugins).toHaveLength(10);
      plugins.forEach((plugin, i) => {
        expect(plugin.manifest.name).toBe(`concurrent-plugin-${i}`);
      });

      // Check for proper isolation
      const stats = pluginManager.getStats();
      expect(stats.loadedPlugins).toBe(10);
      expect(stats.failedLoads).toBe(0);
    });

    it('should handle USB events during plugin operations', async () => {
      // Subscribe to Redis stream
      const events: any[] = [];
      const streamKey = 'aw:hotplug';
      
      // Start listening for events
      const listenForEvents = async () => {
        let lastId = '$';
        while (events.length < 5) {
          const messages = await redisClient.xRead(
            [{ key: streamKey, id: lastId }],
            { BLOCK: 100, COUNT: 10 }
          );
          
          if (messages) {
            messages[0].messages.forEach(msg => {
              events.push(msg.message);
              lastId = msg.id;
            });
          }
        }
      };

      const eventListener = listenForEvents();

      // Load plugins while publishing USB events
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'usb-aware-plugin');
      await createTestPlugin(pluginPath, {
        name: 'usb-aware-plugin',
        version: '1.0.0',
        entry: './index.js',
        permissions: ['queue:subscribe'],
      });

      const loadPromise = pluginManager.loadPlugin(pluginPath);

      // Simulate USB events
      for (let i = 0; i < 5; i++) {
        await redisClient.xAdd(streamKey, '*', {
          event: 'device.attached',
          deviceId: `device-${i}`,
          vendor: '0x1234',
          product: `0x${5678 + i}`,
          timestamp: Date.now().toString(),
        });
      }

      const plugin = await loadPromise;
      await eventListener;

      expect(plugin).toBeDefined();
      expect(events).toHaveLength(5);
    });
  });

  describe('error recovery', () => {
    it('should recover from plugin crashes', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'crashy-plugin');
      await createTestPlugin(pluginPath, {
        name: 'crashy-plugin',
        version: '1.0.0',
        entry: './index.js',
      }, {
        'index.js': `
          setTimeout(() => {
            throw new Error('Intentional crash');
          }, 100);
        `,
      });

      const plugin = await pluginManager.loadPlugin(pluginPath);
      
      // Wait for crash
      await new Promise(resolve => setTimeout(resolve, 200));

      // Plugin should be marked as failed
      const stats = pluginManager.getStats();
      expect(stats.crashedPlugins).toBeGreaterThan(0);

      // Manager should still be operational
      const healthyPath = path.join(TEST_PLUGIN_DIR, 'healthy-plugin');
      await createTestPlugin(healthyPath, {
        name: 'healthy-plugin',
        version: '1.0.0',
        entry: './index.js',
      });

      const healthyPlugin = await pluginManager.loadPlugin(healthyPath);
      expect(healthyPlugin).toBeDefined();
    });

    it('should handle file system errors gracefully', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'missing-entry');
      await createTestPlugin(pluginPath, {
        name: 'missing-entry',
        version: '1.0.0',
        entry: './does-not-exist.js',
      });

      await expect(pluginManager.loadPlugin(pluginPath)).rejects.toThrow();

      // Should not affect other plugins
      const stats = pluginManager.getStats();
      expect(stats.failedLoads).toBeGreaterThan(0);
    });

    it('should enforce resource limits', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'resource-heavy');
      await createTestPlugin(pluginPath, {
        name: 'resource-heavy',
        version: '1.0.0',
        entry: './index.js',
        isolation: {
          workerThread: true,
          memoryLimit: '32MB',
          cpuLimit: '25%',
        },
      }, {
        'index.js': `
          // Try to allocate excessive memory
          const bigArray = new Array(10 * 1024 * 1024).fill('x');
          module.exports = { bigArray };
        `,
      });

      const plugin = await pluginManager.loadPlugin(pluginPath);
      
      // Worker should be terminated for exceeding limits
      await new Promise(resolve => setTimeout(resolve, 500));

      const pluginState = pluginManager.getPlugin('resource-heavy');
      expect(pluginState?.status).toBe('failed');
    });
  });

  describe('performance benchmarks', () => {
    it('should maintain performance under load', async () => {
      const metrics = {
        loadTimes: [] as number[],
        reloadTimes: [] as number[],
        memoryUsage: [] as number[],
      };

      // Load 20 plugins
      for (let i = 0; i < 20; i++) {
        const pluginPath = path.join(TEST_PLUGIN_DIR, `perf-plugin-${i}`);
        await createTestPlugin(pluginPath, {
          name: `perf-plugin-${i}`,
          version: '1.0.0',
          entry: './index.js',
        });

        const start = performance.now();
        await pluginManager.loadPlugin(pluginPath);
        metrics.loadTimes.push(performance.now() - start);
        
        metrics.memoryUsage.push(process.memoryUsage().heapUsed);
      }

      // Calculate averages
      const avgLoadTime = metrics.loadTimes.reduce((a, b) => a + b) / metrics.loadTimes.length;
      const p95LoadTime = metrics.loadTimes.sort((a, b) => a - b)[Math.floor(metrics.loadTimes.length * 0.95)];

      expect(avgLoadTime).toBeLessThan(200);
      expect(p95LoadTime).toBeLessThan(250);

      // Memory should not grow excessively
      const memoryGrowth = metrics.memoryUsage[metrics.memoryUsage.length - 1] - metrics.memoryUsage[0];
      const avgMemoryPerPlugin = memoryGrowth / 20;
      expect(avgMemoryPerPlugin).toBeLessThan(1024 * 1024); // Less than 1MB per plugin
    });
  });
});

// Helper functions
async function createTestPlugin(
  pluginPath: string,
  manifest: Partial<PluginManifest>,
  additionalFiles: Record<string, string> = {}
): Promise<void> {
  await fs.mkdir(pluginPath, { recursive: true });
  
  // Create manifest
  const fullManifest: PluginManifest = {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'Test plugin',
    entry: './index.js',
    permissions: [],
    isolation: {
      workerThread: true,
      memoryLimit: '128MB',
      cpuLimit: '50%',
    },
    ...manifest,
  } as PluginManifest;

  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify(fullManifest, null, 2)
  );

  // Create entry file
  const entryContent = additionalFiles['index.js'] || `
    module.exports = {
      name: '${fullManifest.name}',
      version: '${fullManifest.version}',
      activate: async () => console.log('Plugin activated'),
      deactivate: async () => console.log('Plugin deactivated'),
    };
  `;

  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    entryContent
  );

  // Create additional files
  for (const [filePath, content] of Object.entries(additionalFiles)) {
    if (filePath !== 'index.js') {
      const fullPath = path.join(pluginPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
  }
}

async function createSignedPlugin(
  pluginPath: string,
  manifest: Partial<PluginManifest>
): Promise<{ manifest: PluginManifest; signature: any }> {
  // In real implementation, this would use actual cryptographic signing
  const signature = {
    algorithm: 'SHA-256',
    hash: 'mock-hash-' + Date.now(),
    publicKey: '-----BEGIN PUBLIC KEY-----\nMOCK-KEY\n-----END PUBLIC KEY-----',
  };

  const fullManifest = {
    ...manifest,
    signature,
  } as PluginManifest;

  await createTestPlugin(pluginPath, fullManifest);

  return { manifest: fullManifest, signature };
}