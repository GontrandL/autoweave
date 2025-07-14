# AutoWeave Enhanced Plugin Loader

A production-ready plugin loader with advanced security, performance optimization, and resource management features.

## Features

### 🔒 Security
- **VM2 Sandboxing**: Plugins run in isolated VM2 sandboxes with strict security policies
- **Granular Permissions**: Fine-grained permission system for filesystem, network, USB, and memory access
- **Resource Limits**: Enforced memory and CPU limits per plugin
- **Module Whitelisting**: Only safe modules can be loaded by plugins
- **Path Validation**: Protection against directory traversal attacks

### ⚡ Performance
- **Worker Pool Management**: Efficient worker thread pooling with auto-scaling
- **Lazy Loading**: Plugins are loaded on-demand with priority-based scheduling
- **Fast Manifest Parsing**: LRU-cached manifest parsing with pre-compiled schemas
- **Optimized File Watching**: Debounced file system monitoring with hash-based change detection
- **Batch Operations**: Support for batch loading and processing

### 🎯 Features
- **Hot Reload**: Automatic plugin reloading on file changes
- **Priority Loading**: Critical plugins load first
- **Health Monitoring**: Automatic health checks and recovery
- **Metrics & Monitoring**: Built-in performance metrics and monitoring
- **Error Recovery**: Automatic retry with exponential backoff

## Installation

```bash
npm install @autoweave/plugin-loader
```

## Quick Start

```typescript
import { EnhancedPluginManager, PluginPriority } from '@autoweave/plugin-loader';

const manager = new EnhancedPluginManager({
  pluginDirectory: './plugins',
  workerPool: {
    minWorkers: 2,
    maxWorkers: 10
  },
  loader: {
    preloadQueue: ['critical-plugin'],
    priorityMap: new Map([
      ['critical-plugin', PluginPriority.CRITICAL]
    ])
  }
});

await manager.start();
```

## Plugin Manifest

Plugins must include an `autoweave.plugin.json` manifest file:

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "An example plugin",
  "entry": "index.js",
  "permissions": {
    "filesystem": [{
      "path": "/tmp/plugin-data",
      "mode": "readwrite"
    }],
    "network": {
      "outbound": ["https://api.example.com/*"]
    },
    "memory": {
      "max_heap_mb": 256
    }
  },
  "hooks": {
    "onLoad": "initialize",
    "onUnload": "cleanup",
    "onUSBAttach": "handleUSBDevice"
  }
}
```

## Plugin API

Plugins have access to a secure API within their sandbox:

```javascript
module.exports = {
  async initialize() {
    // Called when plugin loads
    console.log('Plugin initialized');
    
    // Emit metrics
    autoweave.metric('plugin.started', 1);
  },
  
  async cleanup() {
    // Called when plugin unloads
    console.log('Plugin cleanup');
  },
  
  async handleUSBDevice(deviceInfo) {
    // Handle USB events
    if (deviceInfo.vendorId === '0x1234') {
      // Read file (permission checked)
      const data = await autoweave.readFile('/tmp/plugin-data/config.json');
      
      // Make API call (permission checked)
      const response = await autoweave.fetch('https://api.example.com/device', {
        method: 'POST',
        body: JSON.stringify(deviceInfo)
      });
    }
  }
};
```

## Advanced Configuration

### Worker Pool Configuration

```typescript
{
  workerPool: {
    minWorkers: 2,              // Minimum workers to keep alive
    maxWorkers: 10,             // Maximum concurrent workers
    workerIdleTimeout: 300000,  // 5 minutes idle timeout
    healthCheckInterval: 60000  // 1 minute health checks
  }
}
```

### File Watcher Configuration

```typescript
{
  watcher: {
    debounceMs: 500,       // Debounce file changes
    maxDepth: 2,           // Max directory depth
    manifestOnly: true,    // Only watch manifest files
    ignorePatterns: [      // Patterns to ignore
      '**/node_modules/**',
      '**/.git/**'
    ]
  }
}
```

### Lazy Loading Configuration

```typescript
{
  loader: {
    preloadQueue: ['core-plugin'],     // Plugins to preload
    priorityMap: new Map([             // Plugin priorities
      ['core-plugin', PluginPriority.CRITICAL],
      ['analytics', PluginPriority.LOW]
    ]),
    maxConcurrentLoads: 3,             // Max parallel loads
    loadTimeout: 30000                 // Load timeout
  }
}
```

## Permission System

### Filesystem Permissions

```json
{
  "filesystem": [{
    "path": "/tmp/plugin-data",
    "mode": "read"  // read, write, or readwrite
  }]
}
```

### Network Permissions

```json
{
  "network": {
    "outbound": [
      "https://api.example.com/*",
      "https://*.mydomain.com/*"
    ],
    "inbound": {
      "port": 8080,
      "interface": "localhost"  // localhost or all
    }
  }
}
```

### USB Permissions

```json
{
  "usb": {
    "vendor_ids": ["0x1234", "0x5678"],
    "product_ids": ["0xABCD"]
  }
}
```

### Memory Limits

```json
{
  "memory": {
    "max_heap_mb": 256,
    "max_workers": 2
  }
}
```

## Events

The plugin manager emits various events:

```typescript
manager.on('plugin:loaded', (event) => {
  console.log(`Plugin ${event.plugin.manifest.name} loaded`);
});

manager.on('plugin:error', (event) => {
  console.error(`Plugin error: ${event.error}`);
});

manager.on('worker:created', (event) => {
  console.log(`Worker created for ${event.pluginId}`);
});

manager.on('worker:terminated', (event) => {
  console.log(`Worker terminated: ${event.reason}`);
});
```

## Monitoring & Metrics

Get real-time statistics:

```typescript
const stats = manager.getManagerStats();
console.log({
  plugins: stats.plugins,        // Plugin counts
  workers: stats.workers,        // Worker pool stats
  loader: stats.loader,          // Loader metrics
  cache: stats.cache            // Cache statistics
});

// Get plugin-specific metadata
const metadata = manager.getPluginMetadata('my-plugin');
console.log({
  loadedAt: metadata.loadedAt,
  accessCount: metadata.accessCount,
  errors: metadata.errors,
  workerMetrics: metadata.workerMetrics
});
```

## Security Best Practices

1. **Validate All Manifests**: Always validate plugin manifests before loading
2. **Minimal Permissions**: Grant only the minimum required permissions
3. **Path Restrictions**: Use absolute paths and avoid broad filesystem access
4. **Network Allowlisting**: Explicitly allowlist network endpoints
5. **Resource Limits**: Set appropriate memory and CPU limits
6. **Regular Updates**: Keep the plugin loader and dependencies updated

## Performance Optimization

1. **Use Lazy Loading**: Load plugins on-demand rather than all at startup
2. **Set Priorities**: Mark critical plugins for immediate loading
3. **Monitor Metrics**: Track load times and resource usage
4. **Cache Manifests**: The parser automatically caches manifests
5. **Batch Operations**: Use batch methods for multiple plugins

## Troubleshooting

### Plugin Fails to Load

1. Check manifest syntax and schema compliance
2. Verify file paths and permissions
3. Check worker pool capacity
4. Review error logs for specific issues

### High Memory Usage

1. Review plugin memory limits
2. Check for memory leaks in plugins
3. Monitor worker pool size
4. Enable health checks for automatic recovery

### Performance Issues

1. Enable manifest-only watching
2. Increase debounce time for file changes
3. Review plugin priorities
4. Check worker pool configuration

## License

MIT