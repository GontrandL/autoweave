# Migration Guide: From PluginManager to EnhancedPluginManager

This guide helps you migrate from the basic `PluginManager` to the new `EnhancedPluginManager` with improved security and performance features.

## Key Differences

### 1. Security Enhancements
- **VM2 Sandboxing**: Plugins now run in isolated VM2 sandboxes
- **Stricter Permissions**: More granular permission system
- **Resource Limits**: Enforced memory and CPU limits

### 2. Performance Improvements
- **Worker Pool**: Efficient worker thread management
- **Lazy Loading**: On-demand plugin loading with priorities
- **Optimized Watching**: Better file system monitoring

### 3. New Features
- **Health Monitoring**: Automatic health checks
- **Metrics**: Built-in performance monitoring
- **Priority Loading**: Control plugin load order

## Migration Steps

### Step 1: Update Imports

**Before:**
```typescript
import { PluginManager } from '@autoweave/plugin-loader';
```

**After:**
```typescript
import { EnhancedPluginManager } from '@autoweave/plugin-loader';
```

### Step 2: Update Configuration

**Before:**
```typescript
const manager = new PluginManager('./plugins');
```

**After:**
```typescript
const manager = new EnhancedPluginManager({
  pluginDirectory: './plugins',
  workerPool: {
    minWorkers: 2,
    maxWorkers: 10
  },
  watcher: {
    debounceMs: 500,
    manifestOnly: true
  },
  loader: {
    maxConcurrentLoads: 3
  }
});
```

### Step 3: Update Plugin Code

The enhanced loader requires plugins to be compatible with the VM2 sandbox environment.

**Before:**
```javascript
// Direct require/import
const fs = require('fs');
const data = fs.readFileSync('/path/to/file');

// Direct network access
const axios = require('axios');
const response = await axios.get('https://api.example.com');
```

**After:**
```javascript
// Use the autoweave API
module.exports = {
  async initialize() {
    // File access through API (permission checked)
    const data = await autoweave.readFile('/path/to/file');
    
    // Network access through API (permission checked)
    const response = await autoweave.fetch('https://api.example.com');
  }
};
```

### Step 4: Update Manifest Permissions

The enhanced loader requires explicit permissions in the manifest.

**Before:**
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": {},
  "hooks": {}
}
```

**After:**
```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": {
    "filesystem": [{
      "path": "/data/my-plugin",
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
    "onUnload": "cleanup"
  }
}
```

### Step 5: Handle New Events

The enhanced manager provides more detailed events.

**Before:**
```typescript
manager.on('plugin:loaded', (plugin) => {
  console.log(`Plugin ${plugin.manifest.name} loaded`);
});
```

**After:**
```typescript
manager.on('plugin:loaded', (event) => {
  console.log(`Plugin ${event.plugin.manifest.name} loaded in ${event.loadTime}ms`);
});

manager.on('worker:created', (event) => {
  console.log(`Worker created for ${event.pluginId}`);
});

manager.on('worker:terminated', (event) => {
  console.log(`Worker terminated: ${event.reason}`);
});
```

### Step 6: Use Priority Loading

Take advantage of priority-based loading for critical plugins.

```typescript
import { PluginPriority } from '@autoweave/plugin-loader';

// Set plugin priorities
manager.setPriority('auth-plugin', PluginPriority.CRITICAL);
manager.setPriority('analytics-plugin', PluginPriority.LOW);

// Or configure during initialization
const manager = new EnhancedPluginManager({
  pluginDirectory: './plugins',
  loader: {
    priorityMap: new Map([
      ['auth-plugin', PluginPriority.CRITICAL],
      ['analytics-plugin', PluginPriority.LOW]
    ])
  }
});
```

## Breaking Changes

### 1. Direct File System Access
Plugins can no longer directly access the file system. Use the `autoweave.readFile()` and `autoweave.writeFile()` APIs.

### 2. Module Loading
Only whitelisted modules can be loaded. Dangerous modules like `child_process` are blocked.

### 3. Network Requests
Network requests must go through `autoweave.fetch()` and require explicit permissions.

### 4. Global Variables
Limited global scope in the sandbox. Some Node.js globals may not be available.

## Compatibility Mode

For gradual migration, you can still use the old `PluginManager`:

```typescript
import { PluginManager } from '@autoweave/plugin-loader';

// Old API still available but deprecated
const manager = new PluginManager('./plugins');
```

However, we strongly recommend migrating to `EnhancedPluginManager` for better security and performance.

## Common Issues

### Issue: "Module not permitted"
**Solution:** Add the module to permissions or use the autoweave API instead.

### Issue: "No filesystem permissions"
**Solution:** Add filesystem permissions to your manifest.

### Issue: "Worker pool at maximum capacity"
**Solution:** Increase `maxWorkers` or optimize plugin loading.

### Issue: "Plugin load timeout"
**Solution:** Increase `loadTimeout` or optimize plugin initialization.

## Performance Tips

1. **Use Lazy Loading**: Don't load all plugins at startup
2. **Set Priorities**: Load critical plugins first
3. **Monitor Metrics**: Use `getManagerStats()` to track performance
4. **Optimize Manifests**: Keep manifests small and cache-friendly

## Security Best Practices

1. **Minimal Permissions**: Only request necessary permissions
2. **Path Validation**: Use absolute paths and avoid `..`
3. **Network Allowlisting**: Explicitly list allowed endpoints
4. **Resource Limits**: Set appropriate memory limits

## Need Help?

- Check the [README](./README.md) for detailed documentation
- Review [examples](./examples/) for usage patterns
- File issues on our GitHub repository