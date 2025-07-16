import { EventEmitter } from 'events';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import { getLogger } from '@autoweave/observability';

// Type-safe logger wrapper to work around observability package type issues
interface Logger {
  info(message: string, meta?: unknown): void;
  error(message: string, error?: Error, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
}

import { LazyPluginLoader, PluginPriority } from './loaders/lazy-plugin-loader';
import { FastManifestParser } from './parsers/fast-manifest-parser';
import { PermissionManager } from './security/permission-manager';
import type { PluginManifest, PluginInstance, PluginLoadResult } from './types/plugin';
import { OptimizedPluginWatcher } from './watcher/optimized-plugin-watcher';
import { PluginWorkerPool } from './workers/plugin-worker-pool';


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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  private readonly logger = getLogger() as unknown as Logger;

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
      this.handleWorkerError(data as { pluginId: string; error: Error });
    });

    // Watcher events
    this.watcher.on('plugin:added', (data) => {
      void this.handlePluginAdded(data as {
        pluginPath: string;
        manifestPath: string;
        manifest: PluginManifest;
      });
    });

    this.watcher.on('plugin:changed', (data) => {
      void this.handlePluginChanged(data as {
        pluginPath: string;
        manifestPath: string;
        manifest: PluginManifest;
      });
    });

    this.watcher.on('plugin:removed', (data) => {
      this.handlePluginRemoved(data as {
        pluginPath: string;
        manifestPath: string;
      });
    });

    // Loader events
    this.lazyLoader.on('plugin:loaded', (data) => {
      this.emit('plugin:loaded', data);
    });

    this.lazyLoader.on('plugin:load-failed', (data) => {
      this.handlePluginLoadFailed(data as {
        manifest: PluginManifest;
        error: Error;
        attempts: number;
      });
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Plugin manager already started');
    }

    this.logger.info('Starting Enhanced Plugin Manager...');

    // Start worker pool
    await this.workerPool.start();

    // Initialize lazy loader
    await this.lazyLoader.initialize();

    // Scan for existing plugins
    await this.scanPlugins();

    // Start watching for changes
    await this.watcher.watch(this.pluginDirectory);

    this.isStarted = true;
    this.logger.info('Enhanced Plugin Manager started successfully');
    this.emit('manager:started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.logger.info('Stopping Enhanced Plugin Manager...');

    // Stop watching
    await this.watcher.stop();

    // Unload all plugins
    Object.keys(this.registry).forEach(name =>
      this.unloadPlugin(name)
    );

    // Stop worker pool
    await this.workerPool.stop();

    this.isStarted = false;
    this.logger.info('Enhanced Plugin Manager stopped');
    this.emit('manager:stopped');
  }

  private async scanPlugins(): Promise<void> {
    if (!existsSync(this.pluginDirectory)) {
      this.logger.warn(`Plugin directory ${this.pluginDirectory} does not exist`);
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
        this.logger.error(`Invalid manifest at ${manifestPath}:`, undefined, { errors: parseResult.errors });
        return;
      }

      const manifest = parseResult.manifest;

      // Validate permissions
      const permissionErrors = PermissionManager.validatePermissions(manifest.permissions);
      if (permissionErrors.length > 0) {
        this.logger.error(`Permission errors for ${manifest.name}:`, undefined, { errors: permissionErrors });
        return;
      }

      // Determine priority
      const priority = this.options.loader?.priorityMap?.get(manifest.name) ??
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
      this.logger.error(`Failed to load plugin from ${pluginPath}:`, error instanceof Error ? error : new Error(String(error)));
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

  private async handlePluginAdded(data: {
    pluginPath: string;
    manifestPath: string;
    manifest: PluginManifest;
  }): Promise<void> {
    this.logger.info(`New plugin detected: ${data.manifest.name}`);
    await this.loadPluginFromPath(data.pluginPath, data.manifestPath);
  }

  private async handlePluginChanged(data: {
    pluginPath: string;
    manifestPath: string;
    manifest: PluginManifest;
  }): Promise<void> {
    this.logger.info(`Plugin changed: ${data.manifest.name}`);

    // Unload existing version
    if (this.registry[data.manifest.name]) {
      this.unloadPlugin(data.manifest.name);
    }

    // Reload plugin
    await this.loadPluginFromPath(data.pluginPath, data.manifestPath);
  }

  private handlePluginRemoved(data: {
    pluginPath: string;
    manifestPath: string;
  }): void {
    // Find plugin by path
    for (const [name, entry] of Object.entries(this.registry)) {
      if (entry.instance.path === data.pluginPath) {
        this.logger.info(`Plugin removed: ${name}`);
        this.unloadPlugin(name);
        break;
      }
    }
  }

  private handleWorkerError(data: {
    pluginId: string;
    error: Error;
  }): void {
    const { pluginId, error } = data;
    this.logger.error(`Worker error for plugin ${pluginId}:`, error);

    // Record error in registry
    const [name] = pluginId.split('@');
    if (name && this.registry[name]) {
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

  private handlePluginLoadFailed(data: {
    manifest: PluginManifest;
    error: Error;
    attempts: number;
  }): void {
    this.logger.error(`Failed to load plugin ${data.manifest.name} after ${data.attempts} attempts`, data.error, {
      attempts: data.attempts
    });
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
        priority ?? PluginPriority.NORMAL
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

  unloadPlugin(name: string): void {
    const entry = this.registry[name];
    if (!entry) {
      throw new Error(`Plugin ${name} not found`);
    }

    try {
      this.lazyLoader.unloadPlugin(name);
      delete this.registry[name];

      this.logger.info(`Plugin ${name} unloaded successfully`);
      this.emit('plugin:unloaded', { pluginName: name });
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${name}:`, error instanceof Error ? error : new Error(String(error)));
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

  sendUSBEventToPlugins(eventType: 'attach' | 'detach', deviceInfo: {
    vendorId: number;
    productId: number;
    [key: string]: unknown;
  }): void {
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
          String(deviceInfo.vendorId),
          String(deviceInfo.productId),
          instance.manifest.permissions
        );

        if (allowed) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          void instance.worker.sendUSBEvent(eventType, deviceInfo).catch((error: Error) => {
            this.logger.error(`Error sending USB event to ${instance.manifest.name}:`, error);
          });
        } else {
          this.logger.warn(`USB access denied for ${instance.manifest.name}: ${reason}`);
        }
      }
    }
  }

  sendJobToPlugin(pluginName: string, jobData: unknown): void {
    const entry = this.registry[pluginName];
    if (entry?.instance.worker) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      void entry.instance.worker.sendJob(jobData).catch((error: Error) => {
        this.logger.error(`Error sending job to ${pluginName}:`, error);
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

  getPluginMetadata(name: string): null | {
    loadedAt: Date;
    lastAccessed: Date;
    accessCount: number;
    errors: Array<{ timestamp: Date; error: string }>;
    workerMetrics: ReturnType<PluginWorkerPool['getWorkerMetrics']>;
  } {
    const entry = this.registry[name];
    if (!entry) {
      return null;
    }

    return {
      ...entry.metadata,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    this.logger.info('Caches cleared');
  }
}