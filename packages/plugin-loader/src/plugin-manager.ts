import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
// @ts-ignore
import { watch } from 'chokidar';
import { PluginManifest, PluginInstance, PluginLoadResult } from './types/plugin';
import { PluginManifestValidator } from './validators/manifest-validator';

export class PluginWorker extends EventEmitter {
  private worker: Worker;
  private manifest: PluginManifest;
  private pluginPath: string;

  constructor(manifest: PluginManifest, pluginPath: string) {
    super();
    this.manifest = manifest;
    this.pluginPath = pluginPath;
    
    this.worker = new Worker(join(__dirname, 'workers/plugin-worker-runner.js'), {
      workerData: {
        manifest,
        pluginPath: this.pluginPath,
        permissions: manifest.permissions
      },
      resourceLimits: {
        maxOldGenerationSizeMb: manifest.permissions.memory?.max_heap_mb || 128,
        maxYoungGenerationSizeMb: 32
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.worker.on('message', this.handleWorkerMessage.bind(this));
    this.worker.on('error', this.handleWorkerError.bind(this));
    this.worker.on('exit', this.handleWorkerExit.bind(this));
  }

  private handleWorkerMessage(message: any): void {
    this.emit('message', message);
  }

  private handleWorkerError(error: Error): void {
    this.emit('error', error);
  }

  private handleWorkerExit(code: number): void {
    this.emit('exit', code);
  }

  async load(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin ${this.manifest.name} load timeout`));
      }, 10000);

      this.worker.postMessage({ type: 'LOAD' });
      
      const messageHandler = (message: any) => {
        if (message.type === 'LOAD_SUCCESS') {
          clearTimeout(timeout);
          this.worker.off('message', messageHandler);
          resolve();
        } else if (message.type === 'LOAD_ERROR') {
          clearTimeout(timeout);
          this.worker.off('message', messageHandler);
          reject(new Error(message.error));
        }
      };
      
      this.worker.on('message', messageHandler);
    });
  }

  async unload(): Promise<void> {
    this.worker.postMessage({ type: 'UNLOAD' });
    await this.worker.terminate();
  }

  sendUSBEvent(eventType: 'attach' | 'detach', deviceInfo: any): void {
    this.worker.postMessage({ 
      type: 'USB_EVENT', 
      eventType, 
      deviceInfo 
    });
  }

  sendJob(jobData: any): void {
    this.worker.postMessage({ 
      type: 'JOB_RECEIVED', 
      jobData 
    });
  }

  getManifest(): PluginManifest {
    return this.manifest;
  }
}

export class PluginManager extends EventEmitter {
  private plugins = new Map<string, PluginInstance>();
  private validator = new PluginManifestValidator();
  private pluginDirectory: string;
  private watcher?: ReturnType<typeof watch>;

  constructor(pluginDirectory: string) {
    super();
    this.pluginDirectory = pluginDirectory;
  }

  async start(): Promise<void> {
    // Load existing plugins
    await this.scanPlugins();
    
    // Start watching for changes
    this.startWatching();
    
    console.log(`Plugin Manager started, watching ${this.pluginDirectory}`);
  }

  async stop(): Promise<void> {
    // Stop watching
    if (this.watcher) {
      await this.watcher.close();
    }
    
    // Unload all plugins
    const unloadPromises = Array.from(this.plugins.values()).map(plugin => 
      this.unloadPlugin(plugin.manifest.name)
    );
    
    await Promise.all(unloadPromises);
    console.log('Plugin Manager stopped');
  }

  private startWatching(): void {
    this.watcher = watch(this.pluginDirectory, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      depth: 2 // Don't go too deep
    });

    this.watcher
      .on('add', this.handleFileAdded.bind(this))
      .on('change', this.handleFileChanged.bind(this))
      .on('unlink', this.handleFileRemoved.bind(this));
  }

  private async handleFileAdded(path: string): Promise<void> {
    if (path.endsWith('autoweave.plugin.json')) {
      const pluginPath = join(path, '..');
      await this.loadPluginFromPath(pluginPath);
    }
  }

  private async handleFileChanged(path: string): Promise<void> {
    if (path.endsWith('autoweave.plugin.json')) {
      const pluginPath = join(path, '..');
      await this.reloadPluginFromPath(pluginPath);
    }
  }

  private async handleFileRemoved(path: string): Promise<void> {
    if (path.endsWith('autoweave.plugin.json')) {
      // Find plugin by path and unload it
      for (const [name, plugin] of this.plugins) {
        if (plugin.path === path) {
          await this.unloadPlugin(name);
          break;
        }
      }
    }
  }

  private async scanPlugins(): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    
    if (!existsSync(this.pluginDirectory)) {
      console.warn(`Plugin directory ${this.pluginDirectory} does not exist`);
      return;
    }
    
    const entries = fs.readdirSync(this.pluginDirectory, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.pluginDirectory, entry.name);
        const manifestPath = path.join(pluginPath, 'autoweave.plugin.json');
        
        if (existsSync(manifestPath)) {
          await this.loadPluginFromPath(pluginPath);
        }
      }
    }
  }

  private async loadPluginFromPath(pluginPath: string): Promise<PluginLoadResult> {
    try {
      const manifestPath = join(pluginPath, 'autoweave.plugin.json');
      const manifestContent = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent) as PluginManifest;
      
      return await this.loadPlugin(manifest, pluginPath);
    } catch (error) {
      const errorMsg = `Failed to load plugin from ${pluginPath}: ${error}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  private async reloadPluginFromPath(pluginPath: string): Promise<void> {
    // Find existing plugin by path
    let pluginName: string | undefined;
    for (const [name, plugin] of this.plugins) {
      if (plugin.path === pluginPath) {
        pluginName = name;
        break;
      }
    }
    
    if (pluginName) {
      await this.unloadPlugin(pluginName);
    }
    
    await this.loadPluginFromPath(pluginPath);
  }

  async loadPlugin(manifest: PluginManifest, pluginPath: string): Promise<PluginLoadResult> {
    try {
      // Validate manifest
      const validation = this.validator.validateManifest(manifest);
      if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors?.join(', ')}`);
      }
      
      // Validate signature if present
      if (manifest.signature) {
        const signatureValid = this.validator.validateSignature(manifest, pluginPath);
        if (!signatureValid) {
          throw new Error(`Invalid plugin signature for ${manifest.name}`);
        }
      }
      
      // Check if plugin already loaded
      if (this.plugins.has(manifest.name)) {
        throw new Error(`Plugin ${manifest.name} is already loaded`);
      }
      
      // Create plugin instance
      const worker = new PluginWorker(manifest, pluginPath);
      const signature = this.validator.generatePluginSignature(manifest, pluginPath);
      
      const pluginInstance: PluginInstance = {
        manifest,
        worker,
        path: pluginPath,
        loaded: false,
        signature
      };
      
      // Load the plugin
      await worker.load();
      
      pluginInstance.loaded = true;
      pluginInstance.loadedAt = new Date();
      
      this.plugins.set(manifest.name, pluginInstance);
      
      console.log(`Plugin ${manifest.name} loaded successfully`);
      this.emit('plugin:loaded', pluginInstance);
      
      return { success: true, plugin: pluginInstance };
    } catch (error) {
      const errorMsg = `Failed to load plugin ${manifest.name}: ${error}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    try {
      if (plugin.worker) {
        await plugin.worker.unload();
      }
      
      this.plugins.delete(name);
      console.log(`Plugin ${name} unloaded successfully`);
      this.emit('plugin:unloaded', plugin);
    } catch (error) {
      console.error(`Failed to unload plugin ${name}:`, error);
      throw error;
    }
  }

  getPlugin(name: string): PluginInstance | undefined {
    return this.plugins.get(name);
  }

  getLoadedPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values()).filter(p => p.loaded);
  }

  sendUSBEventToPlugins(eventType: 'attach' | 'detach', deviceInfo: any): void {
    for (const plugin of this.plugins.values()) {
      // Check if plugin has USB permissions and the appropriate hook
      const hasUSBPermission = plugin.manifest.permissions.usb;
      const hasHook = eventType === 'attach' 
        ? plugin.manifest.hooks.onUSBAttach 
        : plugin.manifest.hooks.onUSBDetach;
      
      if (hasUSBPermission && hasHook && plugin.worker) {
        plugin.worker.sendUSBEvent(eventType, deviceInfo);
      }
    }
  }

  sendJobToPlugin(pluginName: string, jobData: any): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin && plugin.worker) {
      plugin.worker.sendJob(jobData);
    }
  }
}