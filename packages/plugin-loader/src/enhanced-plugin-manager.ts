import { EventEmitter } from 'events';
import { PluginManifest, PluginInstance, PluginLoadResult } from './types/plugin';
import { PluginWorkerPool } from './workers/plugin-worker-pool';
import { OptimizedPluginWatcher } from './watcher/optimized-plugin-watcher';
import { FastManifestParser } from './parsers/fast-manifest-parser';
import { LazyPluginLoader, PluginPriority } from './loaders/lazy-plugin-loader';
import { PermissionManager } from './security/permission-manager';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';

export interface EnhancedPluginManagerOptions {
  pluginDirectory: string;
  workerPool?: {
    minWorkers?: number;
    maxWorkers?: number;
    workerIdleTimeout?: number;
  };
  watcher?: {
    debounceMs?: number;
    manifestOnly?: boolean;
  };
  loader?: {
    preloadQueue?: string[];
    priorityMap?: Map<string, PluginPriority>;
    maxConcurrentLoads?: number;
  };
  security?: {
    enableSignatureValidation?: boolean;
    maxPluginSize?: number;
  };
}

interface PluginRegistry {
  [pluginName: string]: {
    instance: PluginInstance;
    metadata: {
      loadedAt: Date;
      lastAccessed: Date;
      accessCount: number;
      errors: Array<{ timestamp: Date; error: string }>;
    };
  };
}

export class EnhancedPluginManager extends EventEmitter {
  private pluginDirectory: string;
  private workerPool: PluginWorkerPool;
  private watcher: OptimizedPluginWatcher;
  private manifestParser: FastManifestParser;
  private lazyLoader: LazyPluginLoader;
  private registry: PluginRegistry = {};
  private options: EnhancedPluginManagerOptions;
  private isStarted = false;

  constructor(options: EnhancedPluginManagerOptions) {
    super();
    this.options = options;
    this.pluginDirectory = options.pluginDirectory;

    // Initialize components
    this.workerPool = new PluginWorkerPool(options.workerPool);
    this.watcher = new OptimizedPluginWatcher(options.watcher);
    this.manifestParser = FastManifestParser.getInstance();
    this.lazyLoader = new LazyPluginLoader(this.workerPool, options.loader);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Worker pool events
    this.workerPool.on('worker:created', (data) => {
      this.emit('worker:created', data);
    });

    this.workerPool.on('worker:terminated', (data) => {
      this.emit('worker:terminated', data);
    });

    this.workerPool.on('worker:error', (data) => {
      this.handleWorkerError(data);
    });

    // Watcher events
    this.watcher.on('plugin:added', async (data) => {
      await this.handlePluginAdded(data);
    });

    this.watcher.on('plugin:changed', async (data) => {
      await this.handlePluginChanged(data);
    });

    this.watcher.on('plugin:removed', async (data) => {
      await this.handlePluginRemoved(data);
    });

    // Loader events
    this.lazyLoader.on('plugin:loaded', (data) => {
      this.emit('plugin:loaded', data);
    });

    this.lazyLoader.on('plugin:load-failed', (data) => {
      this.handlePluginLoadFailed(data);
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Plugin manager already started');
    }

    console.log('Starting Enhanced Plugin Manager...');

    // Start worker pool
    await this.workerPool.start();

    // Initialize lazy loader
    await this.lazyLoader.initialize();

    // Scan for existing plugins
    await this.scanPlugins();

    // Start watching for changes
    await this.watcher.watch(this.pluginDirectory);

    this.isStarted = true;
    console.log('Enhanced Plugin Manager started successfully');
    this.emit('manager:started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    console.log('Stopping Enhanced Plugin Manager...');

    // Stop watching
    await this.watcher.stop();

    // Unload all plugins
    const unloadPromises = Object.keys(this.registry).map(name => 
      this.unloadPlugin(name)
    );
    await Promise.all(unloadPromises);

    // Stop worker pool
    await this.workerPool.stop();

    this.isStarted = false;
    console.log('Enhanced Plugin Manager stopped');
    this.emit('manager:stopped');
  }

  private async scanPlugins(): Promise<void> {
    if (!existsSync(this.pluginDirectory)) {
      console.warn(`Plugin directory ${this.pluginDirectory} does not exist`);
      return;
    }

    const entries = readdirSync(this.pluginDirectory, { withFileTypes: true });
    const scanPromises: Promise<void>[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = join(this.pluginDirectory, entry.name);
        const manifestPath = join(pluginPath, 'autoweave.plugin.json');
        
        if (existsSync(manifestPath)) {
          scanPromises.push(this.loadPluginFromPath(pluginPath, manifestPath));
        }
      }
    }

    await Promise.all(scanPromises);
  }

  private async loadPluginFromPath(
    pluginPath: string, 
    manifestPath: string
  ): Promise<void> {
    try {
      // Parse manifest with caching
      const parseResult = await this.manifestParser.parseManifest(manifestPath);
      
      if (!parseResult.valid || !parseResult.manifest) {
        console.error(`Invalid manifest at ${manifestPath}:`, parseResult.errors);
        return;
      }

      const manifest = parseResult.manifest;

      // Validate permissions
      const permissionErrors = PermissionManager.validatePermissions(manifest.permissions);
      if (permissionErrors.length > 0) {
        console.error(`Permission errors for ${manifest.name}:`, permissionErrors);
        return;
      }

      // Determine priority
      const priority = this.options.loader?.priorityMap?.get(manifest.name) || 
                      (this.options.loader?.preloadQueue?.includes(manifest.name) 
                        ? PluginPriority.HIGH 
                        : PluginPriority.NORMAL);

      // Create lazy proxy or load immediately based on priority
      if (priority <= PluginPriority.HIGH) {
        // Load immediately for high priority plugins
        const instance = await this.lazyLoader.loadPlugin(manifest, pluginPath, priority);
        this.registerPlugin(instance);
      } else {
        // Create lazy proxy for lower priority plugins
        const proxy = this.lazyLoader.createLazyProxy(manifest, pluginPath);
        this.registerPlugin(proxy);
      }
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      this.emit('plugin:error', { pluginPath, error });
    }
  }

  private registerPlugin(instance: PluginInstance): void {
    this.registry[instance.manifest.name] = {
      instance,
      metadata: {
        loadedAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        errors: []
      }
    };
  }

  private async handlePluginAdded(data: any): Promise<void> {
    console.log(`New plugin detected: ${data.manifest.name}`);
    await this.loadPluginFromPath(data.pluginPath, data.manifestPath);
  }

  private async handlePluginChanged(data: any): Promise<void> {
    console.log(`Plugin changed: ${data.manifest.name}`);
    
    // Unload existing version
    if (this.registry[data.manifest.name]) {
      await this.unloadPlugin(data.manifest.name);
    }
    
    // Reload plugin
    await this.loadPluginFromPath(data.pluginPath, data.manifestPath);
  }

  private async handlePluginRemoved(data: any): Promise<void> {
    // Find plugin by path
    for (const [name, entry] of Object.entries(this.registry)) {
      if (entry.instance.path === data.pluginPath) {
        console.log(`Plugin removed: ${name}`);
        await this.unloadPlugin(name);
        break;
      }
    }
  }

  private handleWorkerError(data: any): void {
    const { pluginId, error } = data;
    console.error(`Worker error for plugin ${pluginId}:`, error);
    
    // Record error in registry
    const [name] = pluginId.split('@');
    if (this.registry[name]) {
      this.registry[name].metadata.errors.push({
        timestamp: new Date(),
        error: error.message || String(error)
      });
      
      // Keep only last 10 errors
      if (this.registry[name].metadata.errors.length > 10) {
        this.registry[name].metadata.errors.shift();
      }
    }
  }

  private handlePluginLoadFailed(data: any): void {
    console.error(`Failed to load plugin ${data.manifest.name} after ${data.attempts} attempts`);
    this.emit('plugin:error', {
      pluginName: data.manifest.name,
      error: data.error,
      attempts: data.attempts
    });
  }

  async loadPlugin(
    manifest: PluginManifest, 
    pluginPath: string,
    priority?: PluginPriority
  ): Promise<PluginLoadResult> {
    try {
      const instance = await this.lazyLoader.loadPlugin(
        manifest, 
        pluginPath, 
        priority || PluginPriority.NORMAL
      );
      
      this.registerPlugin(instance);
      
      return { success: true, plugin: instance };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const entry = this.registry[name];
    if (!entry) {
      throw new Error(`Plugin ${name} not found`);
    }

    try {
      await this.lazyLoader.unloadPlugin(name);
      delete this.registry[name];
      
      console.log(`Plugin ${name} unloaded successfully`);
      this.emit('plugin:unloaded', { pluginName: name });
    } catch (error) {
      console.error(`Failed to unload plugin ${name}:`, error);
      throw error;
    }
  }

  getPlugin(name: string): PluginInstance | undefined {
    const entry = this.registry[name];
    if (entry) {
      // Update access metadata
      entry.metadata.lastAccessed = new Date();
      entry.metadata.accessCount++;
      
      return entry.instance;
    }
    return undefined;
  }

  getLoadedPlugins(): PluginInstance[] {
    return Object.values(this.registry).map(entry => entry.instance);
  }

  sendUSBEventToPlugins(eventType: 'attach' | 'detach', deviceInfo: any): void {
    for (const entry of Object.values(this.registry)) {
      const { instance } = entry;
      
      // Check permissions
      const hasUSBPermission = instance.manifest.permissions.usb;
      const hasHook = eventType === 'attach' 
        ? instance.manifest.hooks.onUSBAttach 
        : instance.manifest.hooks.onUSBDetach;
      
      if (hasUSBPermission && hasHook && instance.worker) {
        // Validate device access
        const { allowed, reason } = PermissionManager.checkUSBAccess(
          deviceInfo.vendorId,
          deviceInfo.productId,
          instance.manifest.permissions
        );

        if (allowed) {
          instance.worker.sendUSBEvent(eventType, deviceInfo).catch((error: Error) => {
            console.error(`Error sending USB event to ${instance.manifest.name}:`, error);
          });
        } else {
          console.warn(`USB access denied for ${instance.manifest.name}: ${reason}`);
        }
      }
    }
  }

  sendJobToPlugin(pluginName: string, jobData: any): void {
    const entry = this.registry[pluginName];
    if (entry && entry.instance.worker) {
      entry.instance.worker.sendJob(jobData).catch((error: Error) => {
        console.error(`Error sending job to ${pluginName}:`, error);
      });
    }
  }

  getManagerStats(): {
    plugins: {
      total: number;
      loaded: number;
      errors: number;
    };
    workers: ReturnType<PluginWorkerPool['getPoolStats']>;
    watcher: ReturnType<OptimizedPluginWatcher['getStats']>;
    loader: ReturnType<LazyPluginLoader['getMetrics']>;
    cache: ReturnType<FastManifestParser['getCacheStats']>;
  } {
    const pluginsWithErrors = Object.values(this.registry)
      .filter(entry => entry.metadata.errors.length > 0).length;

    return {
      plugins: {
        total: Object.keys(this.registry).length,
        loaded: this.lazyLoader.getAllLoadedPlugins().length,
        errors: pluginsWithErrors
      },
      workers: this.workerPool.getPoolStats(),
      watcher: this.watcher.getStats(),
      loader: this.lazyLoader.getMetrics(),
      cache: this.manifestParser.getCacheStats()
    };
  }

  getPluginMetadata(name: string): any {
    const entry = this.registry[name];
    if (!entry) {
      return null;
    }

    return {
      ...entry.metadata,
      workerMetrics: entry.instance.worker 
        ? this.workerPool.getWorkerMetrics(entry.instance.manifest)
        : null
    };
  }

  setPriority(pluginName: string, priority: PluginPriority): void {
    this.lazyLoader.setPriority(pluginName, priority);
  }

  clearCaches(): void {
    this.manifestParser.clearCache();
    console.log('Caches cleared');
  }
}