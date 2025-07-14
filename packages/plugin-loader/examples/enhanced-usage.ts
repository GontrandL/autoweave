import { 
  EnhancedPluginManager, 
  PluginPriority,
  PluginManifest 
} from '../src';

async function main() {
  // Create enhanced plugin manager with production-ready configuration
  const manager = new EnhancedPluginManager({
    pluginDirectory: './plugins',
    
    // Worker pool configuration
    workerPool: {
      minWorkers: 2,        // Keep 2 workers always ready
      maxWorkers: 10,       // Maximum 10 concurrent workers
      workerIdleTimeout: 300000  // 5 minutes idle timeout
    },
    
    // File watcher configuration
    watcher: {
      debounceMs: 500,      // 500ms debounce for file changes
      manifestOnly: true    // Only watch manifest files for performance
    },
    
    // Lazy loading configuration
    loader: {
      preloadQueue: ['core-plugin', 'auth-plugin'], // High-priority plugins
      priorityMap: new Map([
        ['core-plugin', PluginPriority.CRITICAL],
        ['auth-plugin', PluginPriority.HIGH],
        ['analytics-plugin', PluginPriority.LOW]
      ]),
      maxConcurrentLoads: 3
    },
    
    // Security configuration
    security: {
      enableSignatureValidation: true,
      maxPluginSize: 10 * 1024 * 1024  // 10MB max plugin size
    }
  });

  // Set up event handlers
  manager.on('plugin:loaded', (event) => {
    console.log(`Plugin loaded: ${event.plugin.manifest.name} in ${event.loadTime}ms`);
  });

  manager.on('plugin:error', (event) => {
    console.error(`Plugin error: ${event.pluginName}`, event.error);
  });

  manager.on('worker:created', (event) => {
    console.log(`Worker created for plugin: ${event.pluginId}`);
  });

  manager.on('worker:terminated', (event) => {
    console.log(`Worker terminated: ${event.pluginId} (reason: ${event.reason})`);
  });

  // Start the plugin manager
  await manager.start();

  // Example: Manually load a plugin with specific priority
  const customManifest: PluginManifest = {
    name: 'custom-plugin',
    version: '1.0.0',
    description: 'A custom plugin example',
    entry: 'index.js',
    permissions: {
      filesystem: [{
        path: '/tmp/plugin-data',
        mode: 'readwrite'
      }],
      network: {
        outbound: ['https://api.example.com/*']
      },
      memory: {
        max_heap_mb: 256
      }
    },
    hooks: {
      onLoad: 'initialize',
      onUnload: 'cleanup',
      onUSBAttach: 'handleUSBAttach'
    }
  };

  const result = await manager.loadPlugin(
    customManifest, 
    '/path/to/custom-plugin',
    PluginPriority.NORMAL
  );

  if (result.success) {
    console.log('Custom plugin loaded successfully');
  }

  // Example: Send USB event to plugins
  manager.sendUSBEventToPlugins('attach', {
    vendorId: '0x1234',
    productId: '0x5678',
    deviceName: 'Example USB Device'
  });

  // Example: Get plugin and send job
  const plugin = manager.getPlugin('custom-plugin');
  if (plugin) {
    manager.sendJobToPlugin('custom-plugin', {
      type: 'process-data',
      data: { message: 'Hello from main process' }
    });
  }

  // Monitor performance
  setInterval(() => {
    const stats = manager.getManagerStats();
    console.log('Plugin Manager Stats:', {
      plugins: stats.plugins,
      workers: stats.workers,
      loader: {
        loaded: stats.loader.loadedCount,
        queued: stats.loader.queuedCount,
        averageLoadTime: `${stats.loader.averageLoadTime.toFixed(2)}ms`
      }
    });
  }, 30000); // Every 30 seconds

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down plugin manager...');
    await manager.stop();
    process.exit(0);
  });
}

// Example plugin code that would be loaded
const examplePluginCode = `
// index.js - Example plugin
module.exports = {
  async initialize() {
    console.log('Plugin initialized');
    
    // Use the autoweave API
    autoweave.metric('plugin.initialized', 1, { plugin: 'custom-plugin' });
  },
  
  async cleanup() {
    console.log('Plugin cleaning up');
  },
  
  async handleUSBAttach(deviceInfo) {
    console.log('USB device attached:', deviceInfo);
    
    // Check if we can handle this device
    if (deviceInfo.vendorId === '0x1234') {
      // Process the device
      autoweave.emit('device.recognized', deviceInfo);
      
      // Read some data (permission checked)
      try {
        const data = await autoweave.readFile('/tmp/plugin-data/config.json');
        console.log('Config loaded:', data);
      } catch (error) {
        console.error('Failed to read config:', error);
      }
    }
  },
  
  async processJob(jobData) {
    console.log('Processing job:', jobData);
    
    // Make an API call (permission checked)
    try {
      const response = await autoweave.fetch('https://api.example.com/process', {
        method: 'POST',
        body: JSON.stringify(jobData),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};
`;

// Run the example
main().catch(console.error);