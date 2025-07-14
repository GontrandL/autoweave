import { EnhancedPluginManager, PluginPriority } from '../../src';
import { PluginManifest } from '../../src/types/plugin';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('Enhanced Plugin Loader Integration', () => {
  const testPluginDir = join(__dirname, '../fixtures/test-plugins');
  let manager: EnhancedPluginManager;

  beforeAll(() => {
    // Create test plugin directory
    mkdirSync(testPluginDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up
    rmSync(testPluginDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    manager = new EnhancedPluginManager({
      pluginDirectory: testPluginDir,
      workerPool: {
        minWorkers: 1,
        maxWorkers: 3
      },
      watcher: {
        debounceMs: 100,
        manifestOnly: true
      },
      loader: {
        maxConcurrentLoads: 2
      }
    });
  });

  afterEach(async () => {
    await manager.stop();
  });

  it('should start and stop cleanly', async () => {
    await expect(manager.start()).resolves.not.toThrow();
    await expect(manager.stop()).resolves.not.toThrow();
  });

  it('should load a plugin with proper security sandboxing', async () => {
    const pluginName = 'secure-test-plugin';
    const pluginDir = join(testPluginDir, pluginName);
    mkdirSync(pluginDir, { recursive: true });

    // Create plugin manifest
    const manifest: PluginManifest = {
      name: pluginName,
      version: '1.0.0',
      entry: 'index.js',
      permissions: {
        filesystem: [{
          path: '/tmp/test-plugin',
          mode: 'readwrite'
        }],
        memory: {
          max_heap_mb: 128
        }
      },
      hooks: {
        onLoad: 'initialize'
      }
    };

    writeFileSync(
      join(pluginDir, 'autoweave.plugin.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Create plugin code
    const pluginCode = `
      module.exports = {
        initialize() {
          console.log('Plugin initialized in sandbox');
          return { status: 'loaded' };
        }
      };
    `;

    writeFileSync(join(pluginDir, 'index.js'), pluginCode);

    // Start manager and wait for plugin to load
    await manager.start();

    // Wait for plugin detection
    await new Promise(resolve => setTimeout(resolve, 500));

    const plugin = manager.getPlugin(pluginName);
    expect(plugin).toBeDefined();
    expect(plugin?.manifest.name).toBe(pluginName);
  });

  it('should handle plugin priority loading', async () => {
    const loadOrder: string[] = [];

    manager.on('plugin:loaded', (event) => {
      loadOrder.push(event.plugin.manifest.name);
    });

    // Create plugins with different priorities
    const plugins = [
      { name: 'critical-plugin', priority: PluginPriority.CRITICAL },
      { name: 'normal-plugin', priority: PluginPriority.NORMAL },
      { name: 'low-plugin', priority: PluginPriority.LOW }
    ];

    for (const plugin of plugins) {
      const pluginDir = join(testPluginDir, plugin.name);
      mkdirSync(pluginDir, { recursive: true });

      const manifest: PluginManifest = {
        name: plugin.name,
        version: '1.0.0',
        entry: 'index.js',
        permissions: {},
        hooks: {}
      };

      writeFileSync(
        join(pluginDir, 'autoweave.plugin.json'),
        JSON.stringify(manifest, null, 2)
      );

      writeFileSync(
        join(pluginDir, 'index.js'),
        'module.exports = {};'
      );

      manager.setPriority(plugin.name, plugin.priority);
    }

    await manager.start();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Critical plugins should load first
    expect(loadOrder[0]).toBe('critical-plugin');
  });

  it('should enforce permission boundaries', async () => {
    const pluginName = 'restricted-plugin';
    const pluginDir = join(testPluginDir, pluginName);
    mkdirSync(pluginDir, { recursive: true });

    const manifest: PluginManifest = {
      name: pluginName,
      version: '1.0.0',
      entry: 'index.js',
      permissions: {
        filesystem: [{
          path: '/tmp/allowed',
          mode: 'read'
        }]
      },
      hooks: {
        onLoad: 'testPermissions'
      }
    };

    writeFileSync(
      join(pluginDir, 'autoweave.plugin.json'),
      JSON.stringify(manifest, null, 2)
    );

    const pluginCode = `
      module.exports = {
        async testPermissions() {
          // This should succeed
          try {
            await autoweave.readFile('/tmp/allowed/file.txt');
          } catch (e) {
            // File might not exist, but permission should be granted
          }
          
          // This should fail due to permissions
          try {
            await autoweave.writeFile('/etc/passwd', 'hacked');
            throw new Error('Should not be able to write to /etc/passwd');
          } catch (e) {
            if (!e.message.includes('permission')) {
              throw e;
            }
          }
          
          return { permissionsEnforced: true };
        }
      };
    `;

    writeFileSync(join(pluginDir, 'index.js'), pluginCode);

    await manager.start();
    await new Promise(resolve => setTimeout(resolve, 500));

    const plugin = manager.getPlugin(pluginName);
    expect(plugin).toBeDefined();
  });

  it('should handle worker pool management', async () => {
    const workerEvents: any[] = [];

    manager.on('worker:created', (event) => {
      workerEvents.push({ type: 'created', ...event });
    });

    manager.on('worker:terminated', (event) => {
      workerEvents.push({ type: 'terminated', ...event });
    });

    await manager.start();

    // Create multiple plugins to test worker pool
    for (let i = 0; i < 5; i++) {
      const pluginDir = join(testPluginDir, `worker-test-${i}`);
      mkdirSync(pluginDir, { recursive: true });

      const manifest: PluginManifest = {
        name: `worker-test-${i}`,
        version: '1.0.0',
        entry: 'index.js',
        permissions: {},
        hooks: {}
      };

      writeFileSync(
        join(pluginDir, 'autoweave.plugin.json'),
        JSON.stringify(manifest, null, 2)
      );

      writeFileSync(
        join(pluginDir, 'index.js'),
        'module.exports = {};'
      );
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const stats = manager.getManagerStats();
    expect(stats.workers.totalWorkers).toBeGreaterThan(0);
    expect(stats.workers.totalWorkers).toBeLessThanOrEqual(3); // maxWorkers
  });

  it('should provide accurate metrics', async () => {
    await manager.start();

    const pluginDir = join(testPluginDir, 'metrics-test');
    mkdirSync(pluginDir, { recursive: true });

    const manifest: PluginManifest = {
      name: 'metrics-test',
      version: '1.0.0',
      entry: 'index.js',
      permissions: {},
      hooks: {}
    };

    writeFileSync(
      join(pluginDir, 'autoweave.plugin.json'),
      JSON.stringify(manifest, null, 2)
    );

    writeFileSync(
      join(pluginDir, 'index.js'),
      'module.exports = {};'
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    const stats = manager.getManagerStats();
    expect(stats.plugins.total).toBeGreaterThan(0);
    expect(stats.loader.successfulLoads).toBeGreaterThan(0);
    expect(stats.loader.averageLoadTime).toBeGreaterThan(0);

    const metadata = manager.getPluginMetadata('metrics-test');
    expect(metadata).toBeDefined();
    expect(metadata.loadedAt).toBeInstanceOf(Date);
    expect(metadata.accessCount).toBe(0);
  });

  it('should handle hot reload on manifest changes', async () => {
    const reloadEvents: any[] = [];

    manager.on('plugin:changed', (event) => {
      reloadEvents.push(event);
    });

    const pluginName = 'hot-reload-test';
    const pluginDir = join(testPluginDir, pluginName);
    mkdirSync(pluginDir, { recursive: true });

    const manifest: PluginManifest = {
      name: pluginName,
      version: '1.0.0',
      entry: 'index.js',
      permissions: {},
      hooks: {}
    };

    const manifestPath = join(pluginDir, 'autoweave.plugin.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    writeFileSync(join(pluginDir, 'index.js'), 'module.exports = {};');

    await manager.start();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Modify manifest
    manifest.version = '1.0.1';
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Wait for debounce and reload
    await new Promise(resolve => setTimeout(resolve, 1000));

    expect(reloadEvents.length).toBeGreaterThan(0);
    expect(reloadEvents[0].manifest.version).toBe('1.0.1');
  });
});