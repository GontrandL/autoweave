import { join } from 'path';
import { parentPort, workerData } from 'worker_threads';

import type { PluginManifest } from '../types/plugin';

interface WorkerData {
  manifest: PluginManifest;
  pluginPath: string;
  permissions: any;
}

class PluginSandbox {
  private plugin: any;
  private manifest: PluginManifest;
  private pluginPath: string;

  constructor() {
    const data = workerData as WorkerData;
    this.manifest = data.manifest;
    this.pluginPath = data.pluginPath;
    this.setupSecurityContext();
  }

  private setupSecurityContext(): void {
    // Restrict global objects based on permissions
    if (!this.manifest.permissions.network) {
      // Remove network access if not permitted
      delete (global as any).fetch;
      delete (global as any).WebSocket;
    }

    // Override require/import to check permissions
    this.overrideModuleLoading();

    // Set memory limits if specified
    if (this.manifest.permissions.memory?.max_heap_mb) {
      // Note: Memory limits are enforced at Worker creation time
      console.log(`Plugin ${this.manifest.name} memory limit: ${this.manifest.permissions.memory.max_heap_mb}MB`);
    }
  }

  private overrideModuleLoading(): void {
    // This is a simplified implementation
    // In production, you'd want more sophisticated module loading controls
    const originalRequire = require;

    // Override require to check permissions
    const moduleWhitelist = [
      'util', 'path', 'crypto', 'url', 'querystring',
      // Add other safe modules as needed
    ];

    (global as any).require = function(id: string) {
      // Allow relative requires within plugin directory
      if (id.startsWith('./') || id.startsWith('../')) {
        return originalRequire(id);
      }

      // Check if module is in whitelist
      if (moduleWhitelist.includes(id)) {
        return originalRequire(id);
      }

      // Block other modules unless explicitly permitted
      throw new Error(`Module '${id}' not permitted for plugin ${this.manifest.name}`);
    }.bind(this);
  }

  async loadPlugin(): Promise<void> {
    try {
      const pluginEntryPath = join(this.pluginPath, this.manifest.entry);

      // Dynamic import of the plugin
      this.plugin = await import(pluginEntryPath);

      // Call onLoad hook if defined
      if (this.manifest.hooks.onLoad && this.plugin[this.manifest.hooks.onLoad]) {
        await this.plugin[this.manifest.hooks.onLoad]();
      }

      parentPort?.postMessage({
        type: 'LOAD_SUCCESS',
        pluginName: this.manifest.name
      });
    } catch (error) {
      parentPort?.postMessage({
        type: 'LOAD_ERROR',
        error: error instanceof Error ? error.message : String(error),
        pluginName: this.manifest.name
      });
    }
  }

  async unloadPlugin(): Promise<void> {
    try {
      // Call onUnload hook if defined
      if (this.manifest.hooks.onUnload && this.plugin[this.manifest.hooks.onUnload]) {
        await this.plugin[this.manifest.hooks.onUnload]();
      }

      parentPort?.postMessage({
        type: 'UNLOAD_SUCCESS',
        pluginName: this.manifest.name
      });
    } catch (error) {
      parentPort?.postMessage({
        type: 'UNLOAD_ERROR',
        error: error instanceof Error ? error.message : String(error),
        pluginName: this.manifest.name
      });
    }
  }

  async handleUSBEvent(eventType: 'attach' | 'detach', deviceInfo: any): Promise<void> {
    try {
      const hookName = eventType === 'attach' ? this.manifest.hooks.onUSBAttach : this.manifest.hooks.onUSBDetach;

      if (hookName && this.plugin[hookName]) {
        await this.plugin[hookName](deviceInfo);
      }

      parentPort?.postMessage({
        type: 'USB_EVENT_SUCCESS',
        eventType,
        pluginName: this.manifest.name
      });
    } catch (error) {
      parentPort?.postMessage({
        type: 'USB_EVENT_ERROR',
        error: error instanceof Error ? error.message : String(error),
        eventType,
        pluginName: this.manifest.name
      });
    }
  }

  async handleJobReceived(jobData: any): Promise<void> {
    try {
      if (this.manifest.hooks.onJobReceived && this.plugin[this.manifest.hooks.onJobReceived]) {
        const result = await this.plugin[this.manifest.hooks.onJobReceived](jobData);

        parentPort?.postMessage({
          type: 'JOB_RESULT',
          result,
          pluginName: this.manifest.name
        });
      }
    } catch (error) {
      parentPort?.postMessage({
        type: 'JOB_ERROR',
        error: error instanceof Error ? error.message : String(error),
        pluginName: this.manifest.name
      });
    }
  }
}

const sandbox = new PluginSandbox();

parentPort?.on('message', (message) => {
  void (async () => {
    switch (message.type) {
      case 'LOAD':
        await sandbox.loadPlugin();
        break;
    case 'UNLOAD':
      await sandbox.unloadPlugin();
      break;
    case 'USB_EVENT':
      await sandbox.handleUSBEvent(message.eventType, message.deviceInfo);
      break;
    case 'JOB_RECEIVED':
      await sandbox.handleJobReceived(message.jobData);
      break;
    default:
      parentPort?.postMessage({
        type: 'ERROR',
        error: `Unknown message type: ${message.type}`
      });
    }
  })();
});