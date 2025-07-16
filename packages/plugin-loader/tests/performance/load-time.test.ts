/**
 * Plugin Load Time Performance Tests
 * Ensures plugins load within the 250ms target
 */

import { EnhancedPluginManager } from '../../src/enhanced-plugin-manager';
import { performance } from 'perf_hooks';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createClient } from 'redis';

const TEST_PLUGIN_DIR = path.join(__dirname, '../fixtures/perf-test-plugins');

describe('Plugin Load Time Performance', () => {
  let pluginManager: EnhancedPluginManager;
  
  beforeAll(async () => {
    await fs.mkdir(TEST_PLUGIN_DIR, { recursive: true });
    await createPerformanceTestPlugins();
  });

  afterAll(async () => {
    await fs.rm(TEST_PLUGIN_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Mock Redis to avoid external dependencies in performance tests
    const mockRedis = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      xAdd: jest.fn(),
      isReady: true,
    };

    pluginManager = new EnhancedPluginManager({
      pluginDirectory: TEST_PLUGIN_DIR,
      redis: mockRedis as any,
      watchForChanges: false, // Disable for performance tests
    });

    await pluginManager.initialize();
  });

  afterEach(async () => {
    await pluginManager.shutdown();
  });

  describe('single plugin load time', () => {
    it('should load a minimal plugin in under 250ms', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'minimal-plugin');
      
      const loadTimes: number[] = [];
      const iterations = 10;

      // Warm up
      await pluginManager.loadPlugin(pluginPath);
      await pluginManager.unloadPlugin('minimal-plugin');

      // Measure load times
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await pluginManager.loadPlugin(pluginPath);
        const loadTime = performance.now() - start;
        loadTimes.push(loadTime);
        
        await pluginManager.unloadPlugin('minimal-plugin');
      }

      const avgLoadTime = loadTimes.reduce((a, b) => a + b) / loadTimes.length;
      const maxLoadTime = Math.max(...loadTimes);
      const p95LoadTime = loadTimes.sort((a, b) => a - b)[Math.floor(loadTimes.length * 0.95)];

      console.log('Minimal plugin load times:', {
        avg: avgLoadTime.toFixed(2),
        max: maxLoadTime.toFixed(2),
        p95: p95LoadTime.toFixed(2),
      });

      expect(avgLoadTime).toBeLessThan(250);
      expect(p95LoadTime).toBeLessThan(250);
    });

    it('should load a complex plugin in under 250ms', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'complex-plugin');
      
      const start = performance.now();
      await pluginManager.loadPlugin(pluginPath);
      const loadTime = performance.now() - start;

      console.log(`Complex plugin load time: ${loadTime.toFixed(2)}ms`);
      
      expect(loadTime).toBeLessThan(250);
    });

    it('should load plugins with dependencies in under 250ms', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'dependency-plugin');
      
      const start = performance.now();
      await pluginManager.loadPlugin(pluginPath);
      const loadTime = performance.now() - start;

      console.log(`Plugin with dependencies load time: ${loadTime.toFixed(2)}ms`);
      
      expect(loadTime).toBeLessThan(250);
    });
  });

  describe('parallel plugin loading', () => {
    it('should maintain performance when loading multiple plugins', async () => {
      const pluginPaths = [
        'parallel-plugin-1',
        'parallel-plugin-2',
        'parallel-plugin-3',
        'parallel-plugin-4',
        'parallel-plugin-5',
      ].map(name => path.join(TEST_PLUGIN_DIR, name));

      const start = performance.now();
      await Promise.all(pluginPaths.map(path => pluginManager.loadPlugin(path)));
      const totalTime = performance.now() - start;
      const avgTimePerPlugin = totalTime / pluginPaths.length;

      console.log(`Parallel load: ${pluginPaths.length} plugins in ${totalTime.toFixed(2)}ms (avg: ${avgTimePerPlugin.toFixed(2)}ms)`);

      // Average should still be under 250ms even with parallel loading
      expect(avgTimePerPlugin).toBeLessThan(250);
    });

    it('should handle burst loading efficiently', async () => {
      const burstSize = 20;
      const plugins = Array.from({ length: burstSize }, (_, i) => ({
        name: `burst-plugin-${i}`,
        path: path.join(TEST_PLUGIN_DIR, `burst-plugin-${i}`),
      }));

      // Create plugins
      await Promise.all(plugins.map(p => createSimplePlugin(p.path, p.name)));

      const start = performance.now();
      const loadPromises = plugins.map(p => pluginManager.loadPlugin(p.path));
      const results = await Promise.allSettled(loadPromises);
      const totalTime = performance.now() - start;

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const avgTimePerPlugin = totalTime / successful;

      console.log(`Burst load: ${successful}/${burstSize} plugins in ${totalTime.toFixed(2)}ms (avg: ${avgTimePerPlugin.toFixed(2)}ms)`);

      expect(successful).toBe(burstSize);
      expect(avgTimePerPlugin).toBeLessThan(300); // Slightly higher threshold for burst
    });
  });

  describe('load time breakdown', () => {
    it('should profile load time components', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'profiled-plugin');
      
      const metrics = {
        manifestRead: 0,
        validation: 0,
        workerCreation: 0,
        pluginLoad: 0,
        hookExecution: 0,
        total: 0,
      };

      // Mock with timing
      const originalLoadPlugin = pluginManager.loadPlugin.bind(pluginManager);
      pluginManager.loadPlugin = async function(path: string) {
        const totalStart = performance.now();
        
        // Measure manifest read
        const manifestStart = performance.now();
        const manifestPath = path.join(path, 'autoweave.plugin.json');
        await fs.readFile(manifestPath, 'utf8');
        metrics.manifestRead = performance.now() - manifestStart;

        // Call original method
        const result = await originalLoadPlugin(path);
        
        metrics.total = performance.now() - totalStart;
        return result;
      };

      await pluginManager.loadPlugin(pluginPath);

      console.log('Load time breakdown:', {
        manifestRead: `${metrics.manifestRead.toFixed(2)}ms`,
        total: `${metrics.total.toFixed(2)}ms`,
      });

      // Manifest read should be fast
      expect(metrics.manifestRead).toBeLessThan(10);
      expect(metrics.total).toBeLessThan(250);
    });
  });

  describe('optimization verification', () => {
    it('should benefit from V8 optimization', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'optimized-plugin');
      const loadTimes: number[] = [];

      // First 10 loads (cold)
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        await pluginManager.loadPlugin(pluginPath);
        loadTimes.push(performance.now() - start);
        await pluginManager.unloadPlugin('optimized-plugin');
      }

      const coldAvg = loadTimes.slice(0, 5).reduce((a, b) => a + b) / 5;
      const warmAvg = loadTimes.slice(5, 10).reduce((a, b) => a + b) / 5;

      console.log('V8 optimization effect:', {
        coldAvg: coldAvg.toFixed(2),
        warmAvg: warmAvg.toFixed(2),
        improvement: `${((coldAvg - warmAvg) / coldAvg * 100).toFixed(1)}%`,
      });

      // Warm loads should be faster
      expect(warmAvg).toBeLessThan(coldAvg);
    });

    it('should cache manifest validation', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'cached-validation-plugin');
      
      // First load
      const start1 = performance.now();
      await pluginManager.loadPlugin(pluginPath);
      const time1 = performance.now() - start1;
      await pluginManager.unloadPlugin('cached-validation-plugin');

      // Second load (should use cached validation)
      const start2 = performance.now();
      await pluginManager.loadPlugin(pluginPath);
      const time2 = performance.now() - start2;

      console.log('Validation caching effect:', {
        firstLoad: time1.toFixed(2),
        secondLoad: time2.toFixed(2),
        improvement: `${((time1 - time2) / time1 * 100).toFixed(1)}%`,
      });

      expect(time2).toBeLessThan(time1);
    });
  });

  describe('edge cases', () => {
    it('should handle large manifest files efficiently', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'large-manifest-plugin');
      
      // Create plugin with large manifest
      const largeManifest = {
        name: 'large-manifest-plugin',
        version: '1.0.0',
        entry: './index.js',
        description: 'x'.repeat(10000), // 10KB description
        metadata: Array.from({ length: 100 }, (_, i) => ({
          key: `key-${i}`,
          value: 'x'.repeat(100),
        })),
      };

      await createPluginWithManifest(pluginPath, largeManifest);

      const start = performance.now();
      await pluginManager.loadPlugin(pluginPath);
      const loadTime = performance.now() - start;

      console.log(`Large manifest load time: ${loadTime.toFixed(2)}ms`);
      
      expect(loadTime).toBeLessThan(250);
    });

    it('should maintain performance with deep dependency trees', async () => {
      const pluginPath = path.join(TEST_PLUGIN_DIR, 'deep-deps-plugin');
      
      const start = performance.now();
      await pluginManager.loadPlugin(pluginPath);
      const loadTime = performance.now() - start;

      console.log(`Deep dependency tree load time: ${loadTime.toFixed(2)}ms`);
      
      expect(loadTime).toBeLessThan(250);
    });
  });
});

// Helper functions
async function createPerformanceTestPlugins() {
  // Minimal plugin
  await createSimplePlugin(
    path.join(TEST_PLUGIN_DIR, 'minimal-plugin'),
    'minimal-plugin'
  );

  // Complex plugin with more code
  await createComplexPlugin(
    path.join(TEST_PLUGIN_DIR, 'complex-plugin'),
    'complex-plugin'
  );

  // Plugin with dependencies
  await createPluginWithDependencies(
    path.join(TEST_PLUGIN_DIR, 'dependency-plugin'),
    'dependency-plugin'
  );

  // Parallel test plugins
  for (let i = 1; i <= 5; i++) {
    await createSimplePlugin(
      path.join(TEST_PLUGIN_DIR, `parallel-plugin-${i}`),
      `parallel-plugin-${i}`
    );
  }

  // Profiled plugin with hooks
  await createPluginWithHooks(
    path.join(TEST_PLUGIN_DIR, 'profiled-plugin'),
    'profiled-plugin'
  );

  // Optimized plugin
  await createSimplePlugin(
    path.join(TEST_PLUGIN_DIR, 'optimized-plugin'),
    'optimized-plugin'
  );

  // Cached validation plugin
  await createSimplePlugin(
    path.join(TEST_PLUGIN_DIR, 'cached-validation-plugin'),
    'cached-validation-plugin'
  );

  // Deep dependency plugin
  await createDeepDependencyPlugin(
    path.join(TEST_PLUGIN_DIR, 'deep-deps-plugin'),
    'deep-deps-plugin'
  );
}

async function createSimplePlugin(pluginPath: string, name: string) {
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
    `module.exports = { name: '${name}', activate: () => {} };`
  );
}

async function createComplexPlugin(pluginPath: string, name: string) {
  await fs.mkdir(pluginPath, { recursive: true });
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      entry: './index.js',
      permissions: ['memory:read', 'memory:write', 'llm:access'],
      isolation: { workerThread: true, memoryLimit: '128MB', cpuLimit: '50%' },
    })
  );

  // Create a more complex plugin with multiple exports and functions
  const complexCode = `
    const state = { initialized: false, data: {} };
    
    function processData(input) {
      return input.map(x => x * 2).filter(x => x > 10).reduce((a, b) => a + b, 0);
    }
    
    class PluginCore {
      constructor() {
        this.cache = new Map();
      }
      
      process(key, value) {
        this.cache.set(key, value);
        return processData([value, value * 2, value * 3]);
      }
    }
    
    module.exports = {
      name: '${name}',
      core: new PluginCore(),
      activate: async () => {
        state.initialized = true;
        // Simulate some initialization work
        await new Promise(resolve => setImmediate(resolve));
      },
      deactivate: async () => {
        state.initialized = false;
      },
      process: (data) => new PluginCore().process('key', data),
    };
  `;

  await fs.writeFile(path.join(pluginPath, 'index.js'), complexCode);
}

async function createPluginWithDependencies(pluginPath: string, name: string) {
  await fs.mkdir(pluginPath, { recursive: true });
  await fs.mkdir(path.join(pluginPath, 'lib'), { recursive: true });
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      entry: './index.js',
      dependencies: {
        external: ['lodash@4.17.21'],
        autoweave: ['@autoweave/memory@2.0.0'],
      },
    })
  );

  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    `
    const utils = require('./lib/utils');
    const helper = require('./lib/helper');
    
    module.exports = {
      name: '${name}',
      activate: () => {
        utils.init();
        helper.setup();
      },
    };
    `
  );

  await fs.writeFile(
    path.join(pluginPath, 'lib/utils.js'),
    `exports.init = () => { /* utility initialization */ };`
  );

  await fs.writeFile(
    path.join(pluginPath, 'lib/helper.js'),
    `exports.setup = () => { /* helper setup */ };`
  );
}

async function createPluginWithHooks(pluginPath: string, name: string) {
  await fs.mkdir(pluginPath, { recursive: true });
  await fs.mkdir(path.join(pluginPath, 'hooks'), { recursive: true });
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      entry: './index.js',
      hooks: {
        onLoad: './hooks/onLoad.js',
        onUnload: './hooks/onUnload.js',
      },
    })
  );

  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    `module.exports = { name: '${name}' };`
  );

  await fs.writeFile(
    path.join(pluginPath, 'hooks/onLoad.js'),
    `module.exports = async () => { /* load hook */ };`
  );

  await fs.writeFile(
    path.join(pluginPath, 'hooks/onUnload.js'),
    `module.exports = async () => { /* unload hook */ };`
  );
}

async function createDeepDependencyPlugin(pluginPath: string, name: string) {
  await fs.mkdir(pluginPath, { recursive: true });
  
  // Create nested module structure
  const modules = ['core', 'utils', 'helpers', 'services', 'models'];
  for (const mod of modules) {
    await fs.mkdir(path.join(pluginPath, mod), { recursive: true });
  }

  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      entry: './index.js',
    })
  );

  // Create interconnected modules
  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    `
    const core = require('./core');
    module.exports = { name: '${name}', ...core };
    `
  );

  await fs.writeFile(
    path.join(pluginPath, 'core/index.js'),
    `
    const utils = require('../utils');
    const helpers = require('../helpers');
    module.exports = { init: () => utils.process(helpers.data) };
    `
  );

  await fs.writeFile(
    path.join(pluginPath, 'utils/index.js'),
    `
    const services = require('../services');
    exports.process = (data) => services.handle(data);
    `
  );

  await fs.writeFile(
    path.join(pluginPath, 'helpers/index.js'),
    `
    const models = require('../models');
    exports.data = models.getData();
    `
  );

  await fs.writeFile(
    path.join(pluginPath, 'services/index.js'),
    `exports.handle = (data) => data;`
  );

  await fs.writeFile(
    path.join(pluginPath, 'models/index.js'),
    `exports.getData = () => ({ loaded: true });`
  );
}

async function createPluginWithManifest(pluginPath: string, manifest: any) {
  await fs.mkdir(pluginPath, { recursive: true });
  
  await fs.writeFile(
    path.join(pluginPath, 'autoweave.plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  await fs.writeFile(
    path.join(pluginPath, 'index.js'),
    `module.exports = { name: '${manifest.name}' };`
  );
}